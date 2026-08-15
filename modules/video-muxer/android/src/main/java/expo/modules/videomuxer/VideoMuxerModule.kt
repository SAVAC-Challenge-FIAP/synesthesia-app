package expo.modules.videomuxer

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val TAG = "VideoMuxer"

class MuxException(message: String) : CodedException(message)

/**
 * Gera o .mp4 do pacote sensorial (imagem com filtro + trilha) usando o
 * **Media3 Transformer** do Google.
 *
 * A implementação anterior fazia isso na mão com MediaCodec/MediaMuxer e
 * esbarrou em três bugs de nível de device em sequência (Surface de software
 * incompatível, estouro de buffer no reencode do áudio e falha no stop do
 * muxer). Esses são justamente os detalhes que variam por fabricante — e que o
 * Transformer encapsula. Menos código nosso, mais device coberto.
 */
class VideoMuxerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoMuxer")

    AsyncFunction("muxImageAndAudio") { imagePath: String, audioPath: String, outputPath: String, durationSeconds: Double, promise: Promise ->
      val saida = stripFileScheme(outputPath)
      val duracaoMs = (durationSeconds * 1000).toLong().coerceAtLeast(1000L)
      // O Transformer precisa de um Looper vivo e reporta no mesmo thread em que
      // foi criado; a AsyncFunction do Expo roda numa fila própria, então
      // montamos e disparamos tudo na main thread.
      Handler(Looper.getMainLooper()).post {
        try {
          exportar(imagePath, audioPath, saida, duracaoMs, promise)
        } catch (e: Exception) {
          Log.e(TAG, "Falha ao montar a exportação", e)
          promise.reject(MuxException("Falha ao gerar o vídeo: ${detalhe(e)}"))
        }
      }
    }
  }

  private fun stripFileScheme(uri: String) = uri.removePrefix("file://")

  private fun detalhe(e: Exception) = e.message ?: e.cause?.message ?: e::class.java.simpleName

  private fun exportar(imagePath: String, audioPath: String, outputPath: String, duracaoMs: Long, promise: Promise) {
    val contexto = appContext.reactContext
      ?: throw IllegalStateException("Contexto Android indisponível")

    File(outputPath).parentFile?.mkdirs()

    // setImageDuration é obrigatório: é ele que faz o Transformer tratar a URI
    // como imagem parada (e define por quanto tempo ela aparece no vídeo).
    val imagem = MediaItem.Builder()
      .setUri(Uri.parse(imagePath))
      .setImageDurationMs(duracaoMs)
      .build()
    val trilhaVisual = EditedMediaItem.Builder(imagem)
      .setFrameRate(30)
      .build()

    val audio = EditedMediaItem.Builder(MediaItem.fromUri(Uri.parse(audioPath))).build()

    // A imagem vira a sequência de vídeo; o áudio entra como sequência paralela
    // em loop, para cobrir a duração inteira mesmo se a prévia for mais curta.
    val sequenciaVideo = EditedMediaItemSequence.withAudioAndVideoFrom(listOf(trilhaVisual))
    val sequenciaAudio = EditedMediaItemSequence.withAudioFrom(listOf(audio))
      .buildUpon()
      .setIsLooping(true)
      .build()

    val composicao = Composition.Builder(sequenciaVideo, sequenciaAudio).build()

    val transformer = Transformer.Builder(contexto)
      // Sem isto o device escolhe o codec — o Redmi entrega H.265/HEVC, que é mais
      // eficiente mas tem upload menos garantido nas redes. Como o destino do pacote
      // é justamente Instagram/TikTok/WhatsApp, fixamos H.264 + AAC.
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          Log.i(TAG, "mp4 pronto: $outputPath (${exportResult.durationMs}ms, ${exportResult.fileSizeBytes} bytes)")
          promise.resolve("file://$outputPath")
        }

        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          Log.e(TAG, "Transformer falhou", exportException)
          promise.reject(MuxException("Falha ao gerar o vídeo: ${detalhe(exportException)}"))
        }
      })
      .build()

    transformer.start(composicao, outputPath)
  }
}

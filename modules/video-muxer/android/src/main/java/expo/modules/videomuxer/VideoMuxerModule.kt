package expo.modules.videomuxer

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.os.bundleOf
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val TAG = "VideoMuxer"

/**
 * Intervalo de consulta do progresso. O Transformer não faz callback — só
 * responde a `getProgress`. 250ms dá uma barra fluida sem inundar a ponte JS.
 */
private const val INTERVALO_PROGRESSO_MS = 250L

/**
 * Janela de qualificação da fonte de progresso.
 *
 * Medido no Redmi Note 8 Pro: para a nossa composição (imagem parada + áudio
 * em loop), `getProgress` devolve **100 aos 280ms** de uma exportação que leva
 * ~10s. Ele reporta o avanço da *sequência de entrada* — e uma imagem parada é
 * um único frame, "consumido" de imediato —, não o encoding, que é onde o
 * tempo está. Uma barra cravada em 100% por 9,5s mente mais que um indicador
 * indefinido, e o FR-Q09 pede progresso proporcional ao trabalho real.
 *
 * Por isso o módulo **observa antes de emitir**: se ao fim desta janela o
 * progresso já estiver no talo, a fonte é degenerada e nenhum valor é emitido
 * (C-04) — o JS permanece no indicador indefinido. Um device onde o progresso
 * seja fiel passa na qualificação e ganha a barra determinada, sem hard-code.
 */
private const val QUALIFICACAO_MS = 1000L

/** Acima disto, no fim da janela de qualificação, a fonte não é fiel. */
private const val LIMIAR_DEGENERADO = 95

private const val EVENTO_PROGRESSO = "onProgress"

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

    // Progresso é informativo (C-01): a Promise continua sendo a fonte da
    // verdade de sucesso/falha, e quem ignorar o evento se comporta como no v1.
    Events(EVENTO_PROGRESSO)

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

  /** Último valor emitido, para garantir progresso monotônico (C-03). */
  private var ultimoProgresso = 0

  private fun emitir(progresso: Int, estado: String) {
    Log.d(TAG, "progresso=$progresso estado=$estado t=${System.currentTimeMillis() - inicioMs}ms")
    sendEvent(EVENTO_PROGRESSO, bundleOf("progresso" to progresso, "estado" to estado))
  }

  private var inicioMs = 0L

  /**
   * Consulta periódica do progresso (C-02: nunca bloqueia a exportação — só lê
   * um contador entre um post e outro na main thread).
   *
   * O Transformer não notifica progresso; ele responde a `getProgress`. Quando
   * o estado devolvido não é `AVAILABLE`, o device não sabe dizer quanto falta:
   * aí **não emitimos nada** em vez de inventar um número (C-04), e o JS
   * permanece no indicador indefinido.
   */
  private fun acompanhar(transformer: Transformer, handler: Handler) {
    val holder = ProgressHolder()
    handler.post(object : Runnable {
      override fun run() {
        if (!emExportacao) return
        val decorrido = System.currentTimeMillis() - inicioMs

        if (transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) {
          // `coerceAtLeast` porque o Transformer pode devolver um valor menor
          // que o anterior ao trocar de etapa — a barra nunca anda para trás.
          val valor = holder.progress.coerceIn(0, 100).coerceAtLeast(ultimoProgresso)

          // Janela de qualificação: observa sem emitir. Só depois dela se sabe
          // se esta fonte diz algo útil neste device.
          if (decorrido < QUALIFICACAO_MS) {
            ultimoProgresso = valor
          } else if (!fonteQualificada) {
            fonteQualificada = true
            if (valor >= LIMIAR_DEGENERADO) {
              // Já no talo com a exportação recém-começada: a fonte reporta a
              // entrada consumida, não o encoding. Cala a boca (C-04).
              fonteConfiavel = false
              Log.i(TAG, "progresso do Transformer nao e fiel aqui ($valor% em ${decorrido}ms) — caindo para indicador indefinido")
              return
            }
            emitir(valor, "exportando")
          } else if (valor != ultimoProgresso) {
            ultimoProgresso = valor
            emitir(valor, "exportando")
          }
        }
        handler.postDelayed(this, INTERVALO_PROGRESSO_MS)
      }
    })
  }

  /** A janela de qualificação já foi avaliada nesta exportação? */
  private var fonteQualificada = false

  /** A fonte de progresso deste device diz algo proporcional ao trabalho real? */
  private var fonteConfiavel = true

  /** Enquanto true, o polling continua reagendando a si mesmo. */
  private var emExportacao = false

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
          emExportacao = false
          // C-03: a última emissão antes de `concluido` chega a 100 — mas só
          // se a barra chegou a existir. Emitir 100 numa exportação que nunca
          // teve progresso fiel faria a barra piscar cheia no último instante.
          if (fonteConfiavel) emitir(100, "concluido")
          promise.resolve("file://$outputPath")
        }

        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          Log.e(TAG, "Transformer falhou", exportException)
          emExportacao = false
          emitir(ultimoProgresso, "falhou")
          promise.reject(MuxException("Falha ao gerar o vídeo: ${detalhe(exportException)}"))
        }
      })
      .build()

    ultimoProgresso = 0
    emExportacao = true
    fonteQualificada = false
    fonteConfiavel = true
    inicioMs = System.currentTimeMillis()
    emitir(0, "iniciando")
    transformer.start(composicao, outputPath)
    // Só depois do start: antes disso o Transformer não tem progresso a dar.
    acompanhar(transformer, Handler(Looper.getMainLooper()))
  }
}

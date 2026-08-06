package expo.modules.videomuxer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Rect
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.min

private const val VIDEO_MIME = "video/avc"
private const val AUDIO_MIME_OUT = "audio/mp4a-latm"
private const val TIMEOUT_US = 10_000L
private const val FRAME_RATE = 30
private const val I_FRAME_INTERVAL = 1
private const val BIT_RATE = 4_000_000

class MuxException(message: String) : CodedException(message)

class VideoMuxerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoMuxer")

    AsyncFunction("muxImageAndAudio") { imagePath: String, audioPath: String, outputPath: String, durationSeconds: Double ->
      try {
        muxImageAndAudio(
          imagePath = stripFileScheme(imagePath),
          audioPath = stripFileScheme(audioPath),
          outputPath = stripFileScheme(outputPath),
          durationUs = (durationSeconds * 1_000_000).toLong().coerceAtLeast(1_000_000L),
        )
        "file://$outputPath"
      } catch (e: Exception) {
        throw MuxException("Falha ao gerar o vídeo: ${e.message}")
      }
    }
  }

  private fun stripFileScheme(uri: String) = uri.removePrefix("file://")

  /**
   * Codifica a imagem como um único frame de vídeo H.264 (repetido por `durationUs`,
   * desenhado via Canvas de software no Surface do encoder — sem GL/shaders) e remuxa
   * o áudio (decodificado e reencodado para AAC) numa segunda trilha, escrevendo um
   * .mp4 com MediaMuxer. Sem FFmpeg: só MediaCodec/MediaMuxer do Android.
   */
  private fun muxImageAndAudio(imagePath: String, audioPath: String, outputPath: String, durationUs: Long) {
    File(outputPath).parentFile?.mkdirs()

    val sourceBitmap = BitmapFactory.decodeFile(imagePath)
      ?: throw IllegalArgumentException("Não foi possível decodificar a imagem em $imagePath")

    // Dimensões pares (exigência do encoder H.264) e um teto razoável de resolução.
    val maxDim = 1280
    val scale = min(1f, maxDim.toFloat() / maxOf(sourceBitmap.width, sourceBitmap.height))
    var width = (sourceBitmap.width * scale).toInt()
    var height = (sourceBitmap.height * scale).toInt()
    if (width % 2 != 0) width -= 1
    if (height % 2 != 0) height -= 1
    width = width.coerceAtLeast(2)
    height = height.coerceAtLeast(2)

    val frameBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    Canvas(frameBitmap).drawBitmap(
      sourceBitmap,
      Rect(0, 0, sourceBitmap.width, sourceBitmap.height),
      Rect(0, 0, width, height),
      null,
    )
    sourceBitmap.recycle()

    val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var videoTrackIndex = -1
    var audioTrackIndex = -1

    // --- Trilha de vídeo: o mesmo bitmap desenhado a cada frame via Canvas de software ---
    // As amostras são bufferizadas (não escritas ainda!): o MediaMuxer só aceita
    // writeSampleData() depois de start(), e start() só pode ocorrer depois que
    // TODAS as trilhas (vídeo + áudio) já foram registradas via addTrack().
    val videoFormat = MediaFormat.createVideoFormat(VIDEO_MIME, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
      setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, I_FRAME_INTERVAL)
    }
    val videoEncoder = MediaCodec.createEncoderByType(VIDEO_MIME)
    videoEncoder.configure(videoFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val inputSurface = videoEncoder.createInputSurface()
    videoEncoder.start()

    val totalFrames = ((durationUs / 1_000_000.0) * FRAME_RATE).toInt().coerceAtLeast(1)
    val videoBufferInfo = MediaCodec.BufferInfo()
    val videoSamples = mutableListOf<EncodedSample>()

    for (frameIndex in 0 until totalFrames) {
      val canvas = inputSurface.lockCanvas(null)
      canvas.drawBitmap(frameBitmap, 0f, 0f, null)
      inputSurface.unlockCanvasAndPost(canvas)
      drainVideoEncoder(
        videoEncoder,
        videoBufferInfo,
        muxer,
        endOfStream = false,
        onFormatChanged = { index -> videoTrackIndex = index },
        onSample = { sample -> videoSamples.add(sample) },
      )
    }
    frameBitmap.recycle()

    videoEncoder.signalEndOfInputStream()
    drainVideoEncoder(
      videoEncoder,
      videoBufferInfo,
      muxer,
      endOfStream = true,
      onFormatChanged = { index -> videoTrackIndex = index },
      onSample = { sample -> videoSamples.add(sample) },
    )
    videoEncoder.stop()
    videoEncoder.release()
    inputSurface.release()

    if (videoTrackIndex < 0) throw IllegalStateException("Nenhuma trilha de vídeo foi gerada")

    // --- Trilha de áudio: decodifica a fonte (mp3/aac) e reencoda para AAC-LC ---
    val audioSamples = mutableListOf<EncodedSample>()
    transcodeAudioTrack(audioPath, durationUs, onTrackAdded = { format ->
      audioTrackIndex = muxer.addTrack(format)
    }, onSample = { sample -> audioSamples.add(sample) })

    // Todas as trilhas já foram adicionadas (addTrack) — agora sim o muxer pode começar
    // e as amostras bufferizadas de vídeo/áudio podem ser escritas.
    muxer.start()
    videoSamples.forEach { sample ->
      muxer.writeSampleData(videoTrackIndex, sample.buffer, sample.info)
    }
    audioSamples.forEach { sample ->
      muxer.writeSampleData(audioTrackIndex, sample.buffer, sample.info)
    }

    muxer.stop()
    muxer.release()
  }

  private class EncodedSample(val buffer: ByteBuffer, val info: MediaCodec.BufferInfo)

  /**
   * Drena o encoder de vídeo, bufferizando as amostras já disponíveis (não escreve no
   * muxer ainda — `writeSampleData` só é válido depois de `muxer.start()`, que só
   * ocorre depois que a trilha de áudio também é conhecida). A trilha é reportada via
   * `onFormatChanged` assim que o formato de saída aparece (uma vez só).
   */
  private fun drainVideoEncoder(
    encoder: MediaCodec,
    bufferInfo: MediaCodec.BufferInfo,
    muxer: MediaMuxer,
    endOfStream: Boolean,
    onFormatChanged: (Int) -> Unit,
    onSample: (EncodedSample) -> Unit,
  ) {
    while (true) {
      val outIndex = encoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
      when {
        outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream) return
        }
        outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          onFormatChanged(muxer.addTrack(encoder.outputFormat))
        }
        outIndex >= 0 -> {
          val encoded = encoder.getOutputBuffer(outIndex)!!
          if (bufferInfo.size > 0 && (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
            encoded.position(bufferInfo.offset)
            encoded.limit(bufferInfo.offset + bufferInfo.size)
            val copy = ByteBuffer.allocate(bufferInfo.size)
            copy.put(encoded)
            copy.flip()
            val infoCopy = MediaCodec.BufferInfo().apply {
              set(0, bufferInfo.size, bufferInfo.presentationTimeUs, bufferInfo.flags)
            }
            onSample(EncodedSample(copy, infoCopy))
          }
          encoder.releaseOutputBuffer(outIndex, false)
          if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return
        }
      }
    }
  }

  /**
   * Decodifica o áudio de entrada (mp3/aac/o que o MediaExtractor aceitar) e reencoda
   * para AAC-LC, entregando cada amostra pronta via `onSample`. O muxer só pode receber
   * essas amostras depois de `muxer.start()`, então elas são coletadas pelo chamador.
   */
  private fun transcodeAudioTrack(
    audioPath: String,
    maxDurationUs: Long,
    onTrackAdded: (MediaFormat) -> Unit,
    onSample: (EncodedSample) -> Unit,
  ) {
    val extractor = MediaExtractor()
    extractor.setDataSource(audioPath)
    var audioTrack = -1
    var inputFormat: MediaFormat? = null
    for (i in 0 until extractor.trackCount) {
      val fmt = extractor.getTrackFormat(i)
      val mime = fmt.getString(MediaFormat.KEY_MIME) ?: continue
      if (mime.startsWith("audio/")) {
        audioTrack = i
        inputFormat = fmt
        break
      }
    }
    if (audioTrack < 0 || inputFormat == null) {
      extractor.release()
      return
    }
    extractor.selectTrack(audioTrack)

    val inputMime = inputFormat.getString(MediaFormat.KEY_MIME)!!
    val sampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    val channelCount = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

    val decoder = MediaCodec.createDecoderByType(inputMime)
    decoder.configure(inputFormat, null, null, 0)
    decoder.start()

    val outputFormat = MediaFormat.createAudioFormat(AUDIO_MIME_OUT, sampleRate, channelCount).apply {
      setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
    }
    val encoder = MediaCodec.createEncoderByType(AUDIO_MIME_OUT)
    encoder.configure(outputFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    encoder.start()

    var trackReported = false
    var extractorDone = false
    var decoderDone = false
    var encoderDone = false
    val decInfo = MediaCodec.BufferInfo()
    val encInfo = MediaCodec.BufferInfo()

    while (!encoderDone) {
      if (!extractorDone) {
        val inIndex = decoder.dequeueInputBuffer(TIMEOUT_US)
        if (inIndex >= 0) {
          val buffer = decoder.getInputBuffer(inIndex)!!
          val sampleTime = extractor.sampleTime
          if (sampleTime < 0 || sampleTime > maxDurationUs) {
            decoder.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            extractorDone = true
          } else {
            val size = extractor.readSampleData(buffer, 0)
            decoder.queueInputBuffer(inIndex, 0, size.coerceAtLeast(0), sampleTime, 0)
            extractor.advance()
          }
        }
      }

      if (!decoderDone) {
        val outIndex = decoder.dequeueOutputBuffer(decInfo, TIMEOUT_US)
        if (outIndex >= 0) {
          val isEos = (decInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
          if (decInfo.size > 0) {
            val decoded = decoder.getOutputBuffer(outIndex)!!
            decoded.position(decInfo.offset)
            decoded.limit(decInfo.offset + decInfo.size)
            val encInIndex = encoder.dequeueInputBuffer(TIMEOUT_US)
            if (encInIndex >= 0) {
              val encBuffer = encoder.getInputBuffer(encInIndex)!!
              encBuffer.clear()
              encBuffer.put(decoded)
              encoder.queueInputBuffer(encInIndex, 0, decInfo.size, decInfo.presentationTimeUs, 0)
            }
          }
          decoder.releaseOutputBuffer(outIndex, false)
          if (isEos) {
            decoderDone = true
            val encInIndex = encoder.dequeueInputBuffer(TIMEOUT_US)
            if (encInIndex >= 0) {
              encoder.queueInputBuffer(encInIndex, 0, 0, decInfo.presentationTimeUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            }
          }
        }
      }

      val encOutIndex = encoder.dequeueOutputBuffer(encInfo, TIMEOUT_US)
      when {
        encOutIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          if (!trackReported) {
            onTrackAdded(encoder.outputFormat)
            trackReported = true
          }
        }
        encOutIndex >= 0 -> {
          if (encInfo.size > 0 && (encInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
            val encoded = encoder.getOutputBuffer(encOutIndex)!!
            encoded.position(encInfo.offset)
            encoded.limit(encInfo.offset + encInfo.size)
            val copy = ByteBuffer.allocate(encInfo.size)
            copy.put(encoded)
            copy.flip()
            val infoCopy = MediaCodec.BufferInfo().apply {
              set(0, encInfo.size, encInfo.presentationTimeUs, encInfo.flags)
            }
            onSample(EncodedSample(copy, infoCopy))
          }
          encoder.releaseOutputBuffer(encOutIndex, false)
          if ((encInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
            encoderDone = true
          }
        }
      }
    }

    decoder.stop()
    decoder.release()
    encoder.stop()
    encoder.release()
    extractor.release()
  }
}

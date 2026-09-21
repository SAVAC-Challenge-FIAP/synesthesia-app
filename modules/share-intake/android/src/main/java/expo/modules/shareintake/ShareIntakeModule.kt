package expo.modules.shareintake

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Bundle
import androidx.core.content.IntentCompat
import androidx.core.os.bundleOf
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

private const val EVENTO = "onCompartilhamento"

private const val PASTA = "synesthesia-recebidas"

/**
 * Mesmo teto de `src/services/enquadrar.ts` (AREA_MAXIMA_FOTO). O Redmi Note 8
 * Pro é o aparelho de referência: uma foto de 48 MP decodificada inteira em
 * ARGB_8888 passa de 190 MB de heap e derruba o processo antes de o JS ver
 * qualquer coisa.
 */
private const val AREA_MAXIMA = 24_000_000L

private const val QUALIDADE_JPEG = 95

class ShareIntakeException(message: String) : CodedException(message)

/**
 * Recebe a foto que outro app mandou pelo "Compartilhar" do sistema.
 *
 * Três coisas justificam código nativo aqui, em vez de resolver no JS:
 *
 * 1. **O intent não é uma URL.** `ACTION_SEND` entrega a imagem em
 *    `EXTRA_STREAM`, e não em `getData()` — que é o único lugar de onde
 *    `Linking.getInitialURL()` lê. Do lado do JS o compartilhamento
 *    simplesmente não existe.
 * 2. **A permissão é emprestada e temporária.** O grant do `content://` vale
 *    enquanto a tarefa viver; por isso a imagem é copiada para o cache do app
 *    na entrada, e o resto do app só vê um `file://` seu.
 * 3. **EXIF.** Foto de galeria costuma ser gravada deitada, com a orientação
 *    num metadado. O `expo-image-manipulator` decodifica com `BitmapFactory` e
 *    ignora esse metadado, e o Skia e o view-shot idem — a foto apareceria em
 *    pé na tela (o `<Image>` respeita EXIF) e deitada no `.mp4`. A rotação é
 *    aplicada aos pixels aqui, de uma vez.
 */
class ShareIntakeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw ShareIntakeException("Contexto Android indisponível.")

  override fun definition() = ModuleDefinition {
    Name("ShareIntake")

    Events(EVENTO)

    // App já aberto: o sistema reaproveita a tarefa (launchMode singleTask) e
    // entrega o compartilhamento por aqui, sem passar pelo `uriPendente`.
    OnNewIntent { intent ->
      uriCompartilhada(intent)?.let { sendEvent(EVENTO, bundleOf("uri" to it)) }
    }

    // App aberto pelo próprio compartilhamento: o intent está na activity desde
    // antes de o JS montar, e é lido quando a tela de recepção monta.
    Function("uriPendente") {
      uriCompartilhada(appContext.currentActivity?.intent)
    }

    AsyncFunction("prepararImagem") { origem: String ->
      prepararImagem(Uri.parse(origem))
    }
  }

  /**
   * Devolve a imagem do intent **e marca o intent como consumido**: sem isso,
   * uma remontagem da tela (ou o app voltando do background) reabriria a mesma
   * foto por cima do que a pessoa estiver fazendo.
   */
  private fun uriCompartilhada(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("image/") != true) return null

    val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
      ?: return null

    intent.removeExtra(Intent.EXTRA_STREAM)
    appContext.currentActivity?.intent
      ?.takeIf { it !== intent }
      ?.removeExtra(Intent.EXTRA_STREAM)

    return uri.toString()
  }

  private fun prepararImagem(origem: Uri): Bundle {
    val resolver = context.contentResolver

    val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    val medicao = resolver.openInputStream(origem)
      ?: throw ShareIntakeException("Não deu para abrir a imagem compartilhada.")
    medicao.use { BitmapFactory.decodeStream(it, null, limites) }
    if (limites.outWidth <= 0 || limites.outHeight <= 0) {
      throw ShareIntakeException("A imagem compartilhada não tem dimensões legíveis.")
    }

    val opcoes = BitmapFactory.Options().apply {
      inSampleSize = amostraPara(limites.outWidth, limites.outHeight)
    }
    val bruto = resolver.openInputStream(origem)?.use { BitmapFactory.decodeStream(it, null, opcoes) }
      ?: throw ShareIntakeException("Não deu para decodificar a imagem compartilhada.")

    val graus = try {
      resolver.openInputStream(origem)?.use { ExifInterface(it).rotationDegrees } ?: 0
    } catch (e: Exception) {
      0
    }

    val emPe = if (graus == 0) {
      bruto
    } else {
      Bitmap.createBitmap(
        bruto,
        0,
        0,
        bruto.width,
        bruto.height,
        Matrix().apply { postRotate(graus.toFloat()) },
        true
      ).also { bruto.recycle() }
    }

    val destino = File(pasta(), "recebida-${System.currentTimeMillis()}.jpg")
    FileOutputStream(destino).use { saida ->
      emPe.compress(Bitmap.CompressFormat.JPEG, QUALIDADE_JPEG, saida)
    }

    val largura = emPe.width
    val altura = emPe.height
    emPe.recycle()

    return bundleOf(
      "uri" to Uri.fromFile(destino).toString(),
      "largura" to largura,
      "altura" to altura
    )
  }

  /**
   * Só potências de 2: é o que o `BitmapFactory` aceita de verdade — qualquer
   * outro valor ele arredonda para baixo até a potência anterior.
   */
  private fun amostraPara(largura: Int, altura: Int): Int {
    var amostra = 1
    while (largura.toLong() * altura / (amostra.toLong() * amostra) > AREA_MAXIMA) {
      amostra *= 2
    }
    return amostra
  }

  /**
   * Uma foto recebida por vez: a anterior ou já virou mídia salva (copiada para
   * `documents/galeria`) ou foi descartada. Guardar as antigas encheria o cache
   * com dezenas de MB por sessão.
   */
  private fun pasta(): File {
    val dir = File(context.cacheDir, PASTA)
    if (!dir.exists()) dir.mkdirs()
    dir.listFiles()?.forEach { it.delete() }
    return dir
  }
}

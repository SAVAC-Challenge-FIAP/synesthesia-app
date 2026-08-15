package expo.modules.sharetarget

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Lado do ícone em px. 96 é o `mipmap-xhdpi` da maioria dos apps: acima disso
 * o `PackageManager` devolve o mesmo desenho reescalado, e cada ícone atravessa
 * a ponte JS como base64 — o custo dobra sem ganho visível num tile de 52dp.
 */
private const val LADO_ICONE_PX = 96

class ShareTargetException(message: String) : CodedException(message)

/**
 * Descobre e aciona os destinos de compartilhamento **reais do aparelho**.
 *
 * O modal de postagem mostrava uma grade fixa de seis redes com emoji, e os
 * seis botões abriam a mesma folha genérica do sistema — desenho sem função.
 * Aqui a grade passa a ser o que o `PackageManager` responde: os apps que a
 * pessoa tem, com o nome e o ícone que eles próprios declaram, e cada toque
 * cai direto no app certo em vez de reabrir a folha.
 */
class ShareTargetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw ShareTargetException("Contexto Android indisponível.")

  override fun definition() = ModuleDefinition {
    Name("ShareTarget")

    Function("listarDestinos") { mimeType: String ->
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_SEND).setType(mimeType)

      pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
        // O próprio Synesthesia não é destino de si mesmo.
        .filter { it.activityInfo.packageName != context.packageName }
        .map { resolve ->
          mapOf(
            "pacote" to resolve.activityInfo.packageName,
            "atividade" to resolve.activityInfo.name,
            "nome" to rotulo(pm, resolve),
            "icone" to iconeComoDataUri(pm, resolve),
          )
        }
    }

    AsyncFunction("compartilharEm") {
        pacote: String,
        atividade: String,
        caminho: String,
        mimeType: String,
        texto: String? ->

      val arquivo = File(Uri.parse(caminho).path ?: caminho)
      if (!arquivo.exists()) {
        throw ShareTargetException("Arquivo do pacote não existe: ${arquivo.path}")
      }

      val conteudo = try {
        FileProvider.getUriForFile(
          context,
          "${context.packageName}.ShareTargetFileProvider",
          arquivo,
        )
      } catch (e: IllegalArgumentException) {
        // Caminho fora do que share_target_paths.xml cobre. Falhar aqui com
        // mensagem é melhor que a tela "não fazer nada" ao toque.
        throw ShareTargetException("Caminho não compartilhável: ${arquivo.path} (${e.message})")
      }

      val intent = Intent(Intent.ACTION_SEND).apply {
        setClassName(pacote, atividade)
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, conteudo)
        if (!texto.isNullOrBlank()) putExtra(Intent.EXTRA_TEXT, texto)
        // A permissão viaja no Intent: sem a flag o destino recebe a URI e não
        // consegue ler o arquivo, que é o clássico "abriu vazio".
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        // Saindo da nossa task, o botão "voltar" do app de destino devolve a
        // pessoa para o Synesthesia em vez de empilhar telas alheias na nossa.
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      try {
        context.startActivity(intent)
      } catch (e: Exception) {
        // App desinstalado entre a listagem e o toque, ou activity que deixou
        // de ser exportada numa atualização.
        throw ShareTargetException("Não deu para abrir $pacote: ${e.message}")
      }
    }
  }

  private fun rotulo(pm: PackageManager, resolve: ResolveInfo): String =
    runCatching { resolve.loadLabel(pm).toString() }
      .getOrDefault(resolve.activityInfo.packageName)

  /**
   * Ícone do app como data URI PNG. Passa por `Canvas` porque ícone adaptativo
   * (`AdaptiveIconDrawable`, o padrão desde o Android 8) não é `BitmapDrawable`
   * e não tem bitmap para extrair — precisa ser desenhado.
   */
  private fun iconeComoDataUri(pm: PackageManager, resolve: ResolveInfo): String {
    val drawable: Drawable = runCatching { resolve.loadIcon(pm) }.getOrNull()
      ?: return ""
    val bitmap = paraBitmap(drawable)
    val saida = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, saida)
    val base64 = Base64.encodeToString(saida.toByteArray(), Base64.NO_WRAP)
    return "data:image/png;base64,$base64"
  }

  private fun paraBitmap(drawable: Drawable): Bitmap {
    if (drawable is BitmapDrawable && drawable.bitmap != null) {
      return Bitmap.createScaledBitmap(drawable.bitmap, LADO_ICONE_PX, LADO_ICONE_PX, true)
    }
    val bitmap = Bitmap.createBitmap(LADO_ICONE_PX, LADO_ICONE_PX, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)
    return bitmap
  }
}

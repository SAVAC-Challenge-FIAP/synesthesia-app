import { Directory, File, Paths } from 'expo-file-system';

import { resolverReceita } from '@/constants/filters';
import { matrizDeCor } from '@/services/looks';
import { carregarSkia } from '@/services/skiaBridge';
import { FilterDef, LookRecipe } from '@/types';

/**
 * Render offscreen em resolução cheia (feature 003, US3, research R3).
 *
 * Substitui o `captureRef(previewRef)` de `CaptureSheet.tsx`: aquele é
 * literalmente um print da prévia, então o arquivo nasce na resolução da
 * *tela*, não da *foto* (FR-024). Aqui a matriz de cor e o overlay do preset
 * são desenhados sobre a imagem original, pixel a pixel, na resolução com que
 * ela foi capturada.
 *
 * `null` sempre que o Skia nativo não está disponível ou qualquer etapa falha
 * — quem chama (`CaptureSheet.renderizarComFiltro`) cai para o caminho antigo
 * nesse caso. Nunca lança: perder a foto por causa do render do filtro seria
 * pior que entregá-la sem o tratamento mais fiel.
 */
export async function renderizarLook(
  photoUri: string,
  filtro: FilterDef | null
): Promise<string | null> {
  if (!filtro) return null;
  const mod = await carregarSkia();
  if (!mod) return null;

  try {
    const { Skia: SkiaApi } = mod;

    const dados = await SkiaApi.Data.fromURI(photoUri);
    const imagem = SkiaApi.Image.MakeImageFromEncoded(dados);
    if (!imagem) return null;

    const largura = imagem.width();
    const altura = imagem.height();
    const surface = SkiaApi.Surface.MakeOffscreen(largura, altura);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    const retangulo = SkiaApi.XYWHRect(0, 0, largura, altura);

    const paintCor = SkiaApi.Paint();
    paintCor.setColorFilter(SkiaApi.ColorFilter.MakeMatrix(matrizDeCor(filtro)));
    canvas.drawImageRect(imagem, retangulo, retangulo, paintCor);

    // Overlays de identidade do preset, desenhados por cima — mesmo papel que
    // `FilterLayer` cumpre no render em tela (research R3).
    if (filtro.overlayOpacity > 0) {
      const paintOverlay = SkiaApi.Paint();
      paintOverlay.setColor(SkiaApi.Color(filtro.overlayColor));
      paintOverlay.setAlphaf(filtro.overlayOpacity);
      canvas.drawRect(retangulo, paintOverlay);
    }
    if (filtro.overlayColor2 && (filtro.overlayOpacity2 ?? 0) > 0) {
      const paintOverlay2 = SkiaApi.Paint();
      paintOverlay2.setColor(SkiaApi.Color(filtro.overlayColor2));
      paintOverlay2.setAlphaf(filtro.overlayOpacity2 ?? 0);
      canvas.drawRect(retangulo, paintOverlay2);
    }

    surface.flush();
    // Sem `fmt` explícito: o padrão do Skia já é PNG (`encodeToBytes()`), e
    // pedir JPEG exigiria importar o enum `ImageFormat` do módulo carregado
    // dinamicamente — um passo a mais sem ganho que justifique o risco.
    const bytes = surface.makeImageSnapshot().encodeToBytes();

    const dir = new Directory(Paths.cache, 'synesthesia-looks');
    if (!dir.exists) dir.create({ intermediates: true });
    const arquivo = new File(dir, `look-${Date.now()}.png`);
    if (arquivo.exists) arquivo.delete();
    arquivo.write(bytes);
    return arquivo.uri;
  } catch (error) {
    console.warn('[renderLook] falha ao renderizar via Skia:', error);
    return null;
  }
}

/** Atalho para quem já tem o `LookRecipe` em vez do `FilterDef` resolvido. */
export function renderizarComLook(photoUri: string, look: LookRecipe | null): Promise<string | null> {
  return renderizarLook(photoUri, look ? resolverReceita(look) : null);
}

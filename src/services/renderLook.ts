/**
 * @docs docs/components/renderLook.md
 */
import { Directory, File, Paths } from "expo-file-system";

import { resolverReceita } from "@/constants/filters";
import { matrizDeCor } from "@/services/looks";
import { carregarSkia } from "@/services/skiaBridge";
import { FilterDef, LookRecipe } from "@/types";

const AREA_MAXIMA = 12_000_000;

export async function renderizarLook(
  photoUri: string,
  filtro: FilterDef | null,
): Promise<string | null> {
  if (!filtro) return null;
  const mod = await carregarSkia();
  if (!mod) return null;

  const descartaveis: { dispose(): void }[] = [];
  try {
    const { Skia: SkiaApi } = mod;

    const dados = await SkiaApi.Data.fromURI(photoUri);
    descartaveis.push(dados);
    const imagem = SkiaApi.Image.MakeImageFromEncoded(dados);
    if (!imagem) return null;
    descartaveis.push(imagem);

    const larguraOriginal = imagem.width();
    const alturaOriginal = imagem.height();

    const escala = Math.min(
      1,
      Math.sqrt(AREA_MAXIMA / (larguraOriginal * alturaOriginal)),
    );
    const largura = Math.max(1, Math.round(larguraOriginal * escala));
    const altura = Math.max(1, Math.round(alturaOriginal * escala));

    const surface = SkiaApi.Surface.MakeOffscreen(largura, altura);
    if (!surface) return null;
    descartaveis.push(surface);
    const canvas = surface.getCanvas();
    const retangulo = SkiaApi.XYWHRect(0, 0, largura, altura);
    const origem = SkiaApi.XYWHRect(0, 0, larguraOriginal, alturaOriginal);

    const paintCor = SkiaApi.Paint();
    descartaveis.push(paintCor);
    paintCor.setColorFilter(
      SkiaApi.ColorFilter.MakeMatrix(matrizDeCor(filtro)),
    );
    canvas.drawImageRect(imagem, origem, retangulo, paintCor);

    if (filtro.overlayOpacity > 0) {
      const paintOverlay = SkiaApi.Paint();
      descartaveis.push(paintOverlay);
      paintOverlay.setColor(SkiaApi.Color(filtro.overlayColor));
      paintOverlay.setAlphaf(filtro.overlayOpacity);
      canvas.drawRect(retangulo, paintOverlay);
    }
    if (filtro.overlayColor2 && (filtro.overlayOpacity2 ?? 0) > 0) {
      const paintOverlay2 = SkiaApi.Paint();
      descartaveis.push(paintOverlay2);
      paintOverlay2.setColor(SkiaApi.Color(filtro.overlayColor2));
      paintOverlay2.setAlphaf(filtro.overlayOpacity2 ?? 0);
      canvas.drawRect(retangulo, paintOverlay2);
    }

    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    descartaveis.push(snapshot);
    const bytes = snapshot.encodeToBytes(3, 92);

    const dir = new Directory(Paths.cache, "synesthesia-looks");
    if (!dir.exists) dir.create({ intermediates: true });
    const arquivo = new File(dir, `look-${Date.now()}.jpg`);
    if (arquivo.exists) arquivo.delete();
    arquivo.write(bytes);
    return arquivo.uri;
  } catch (error) {
    console.warn("[renderLook] falha ao renderizar via Skia:", error);
    return null;
  } finally {
    for (const item of descartaveis.reverse()) {
      try {
        item.dispose();
      } catch {}
    }
  }
}

export function renderizarComLook(
  photoUri: string,
  look: LookRecipe | null,
): Promise<string | null> {
  return renderizarLook(photoUri, look ? resolverReceita(look) : null);
}

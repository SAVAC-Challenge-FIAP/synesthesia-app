import { Directory, File, Paths } from 'expo-file-system';

import { resolverReceita } from '@/constants/filters';
import { matrizDeCor } from '@/services/looks';
import { carregarSkia } from '@/services/skiaBridge';
import { FilterDef, LookRecipe } from '@/types';

/**
 * Área máxima (em pixels) da surface offscreen — 12 MP.
 *
 * Não é preferência estética: acima disso o Skia nativo estoura a memória e
 * derruba o processo com SIGSEGV, sem exceção de JS para capturar. Ver o
 * comentário em `renderizarLook` para o caso medido que motivou o teto.
 */
const AREA_MAXIMA = 12_000_000;

/**
 * Render offscreen em resolução cheia (feature 003, US3, research R3).
 *
 * Substitui o `captureRef(previewRef)` de `CaptureSheet.tsx`: aquele é
 * literalmente um print da prévia, então o arquivo nasce na resolução da
 * *tela*, não da *foto* (FR-024). Aqui a matriz de cor e o overlay do preset
 * são desenhados sobre a imagem original, na resolução com que ela foi
 * capturada — limitada a `AREA_MAXIMA` por segurança de memória (fotos de
 * 64 MP matavam o processo; ver o comentário no corpo da função).
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

  // Tudo que o Skia aloca aqui é memória **nativa**, fora do alcance do GC do
  // JS: sem `dispose()` explícito ela só volta quando o processo morre. Medido
  // em 2026-08-21: cada captura deixava ~180 MB para trás, e depois de duas o
  // app já estava em 875 MB (contra 389 MB recém-aberto) — a degradação que
  // fazia o app ficar lento e acabar fechando sozinho.
  //
  // A lista é liberada no `finally` para valer também nos caminhos de erro e
  // nos `return null` no meio da função.
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

    // Teto de área para a surface offscreen. Sem isto o app **morre**: a
    // câmera deste aparelho entrega 6936×9248 (64 MP), e uma surface RGBA
    // desse tamanho pede ~256 MB de uma vez — mais outro tanto no
    // `makeImageSnapshot()`. O estouro vem como SIGSEGV dentro do Skia
    // nativo, que o `try/catch` daqui **não** intercepta (só pega exceção de
    // JS) e o `if (!surface)` também não, porque não há retorno nenhum: o
    // processo inteiro cai. Reproduzido no Redmi Note 8 Pro em 2026-08-21.
    //
    // 12 MP mantém o espírito do FR-024 — o arquivo continua saindo na
    // resolução da *foto*, não na da *tela* (~1080×1920, o que o `captureRef`
    // dava), e 12 MP ainda é bem acima de qualquer destino de rede social.
    const escala = Math.min(1, Math.sqrt(AREA_MAXIMA / (larguraOriginal * alturaOriginal)));
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
    paintCor.setColorFilter(SkiaApi.ColorFilter.MakeMatrix(matrizDeCor(filtro)));
    canvas.drawImageRect(imagem, origem, retangulo, paintCor);

    // Overlays de identidade do preset, desenhados por cima — mesmo papel que
    // `FilterLayer` cumpre no render em tela (research R3).
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

    // JPEG (`ImageFormat.JPEG === 3`), não PNG. O comentário anterior aqui
    // dizia que o padrão PNG evitava importar o enum `ImageFormat` do módulo
    // dinâmico "sem ganho que justifique o risco" — medido no device, o ganho
    // é o app não morrer: em 3000×4000 o PNG sai com **10,2 MB**, e devolver
    // um `Uint8Array` desse tamanho pela ponte do Hermes derruba o processo
    // com SIGSEGV logo depois do snapshot (medido em 2026-08-21; o `write()`
    // nunca chegava a rodar). O mesmo quadro em JPEG q=0.92 fica na casa de
    // centenas de KB. O literal `3` mantém a intenção original de não
    // importar nada do pacote carregado dinamicamente.
    const snapshot = surface.makeImageSnapshot();
    descartaveis.push(snapshot);
    const bytes = snapshot.encodeToBytes(3, 92);

    const dir = new Directory(Paths.cache, 'synesthesia-looks');
    if (!dir.exists) dir.create({ intermediates: true });
    const arquivo = new File(dir, `look-${Date.now()}.jpg`);
    if (arquivo.exists) arquivo.delete();
    arquivo.write(bytes);
    return arquivo.uri;
  } catch (error) {
    console.warn('[renderLook] falha ao renderizar via Skia:', error);
    return null;
  } finally {
    // Ordem inversa da criação: o snapshot depende da surface, que depende da
    // imagem. Cada `dispose()` vai no seu próprio try — um objeto que já tenha
    // sido liberado não pode impedir a liberação dos outros.
    for (const item of descartaveis.reverse()) {
      try {
        item.dispose();
      } catch {
        // Sem log: um dispose que falha não muda nada para quem chamou, e o
        // ruído esconderia as falhas que importam.
      }
    }
  }
}

/** Atalho para quem já tem o `LookRecipe` em vez do `FilterDef` resolvido. */
export function renderizarComLook(photoUri: string, look: LookRecipe | null): Promise<string | null> {
  return renderizarLook(photoUri, look ? resolverReceita(look) : null);
}

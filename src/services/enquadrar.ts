import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Recorte real da foto no enquadramento escolhido (T066).
 *
 * A máscara no visor sozinha seria decoração: ela mostraria um 1:1 e o arquivo
 * sairia 4:3. O recorte tem de acontecer **no arquivo salvo**, e é aqui.
 *
 * Recorta sempre pelo centro e sempre para dentro — o lado que já está na
 * proporção certa é mantido inteiro, e só o excedente do outro sai. Assim
 * nenhuma foto é ampliada nem ganha borda.
 */
export async function recortarNoAspecto(
  uri: string,
  larguraOriginal: number,
  alturaOriginal: number,
  razaoDesejada: number,
): Promise<string> {
  if (!larguraOriginal || !alturaOriginal || !Number.isFinite(razaoDesejada)) return uri;

  const razaoAtual = larguraOriginal / alturaOriginal;
  // Diferença desprezível: recortar 1px não melhora nada e custa uma reescrita
  // do arquivo inteiro no caminho crítico da captura.
  if (Math.abs(razaoAtual - razaoDesejada) < 0.01) return uri;

  let largura: number;
  let altura: number;
  if (razaoAtual > razaoDesejada) {
    // Foto larga demais: corta nas laterais.
    altura = alturaOriginal;
    largura = Math.round(alturaOriginal * razaoDesejada);
  } else {
    // Foto alta demais: corta em cima e embaixo.
    largura = larguraOriginal;
    altura = Math.round(larguraOriginal / razaoDesejada);
  }
  const originX = Math.max(0, Math.round((larguraOriginal - largura) / 2));
  const originY = Math.max(0, Math.round((alturaOriginal - altura) / 2));

  try {
    const contexto = ImageManipulator.manipulate(uri);
    contexto.crop({ originX, originY, width: largura, height: altura });
    const imagem = await contexto.renderAsync();
    // `compress: 1` porque isto é a foto do pacote, não o envio ao Gemini: aqui
    // a perda seria permanente e visível na exportação.
    const salva = await imagem.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    return salva.uri;
  } catch (e) {
    // Nunca perder a captura por causa do recorte (RV-02): sem recorte a foto
    // ainda é a foto; sem foto não há pacote nenhum.
    console.log('[enquadrar] recorte falhou, mantendo a foto original:', e);
    return uri;
  }
}

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Tolerância de proporção: 0,02 separa 4:3 (0,75) de 1:1 e de 16:9 com folga. */
const TOLERANCIA = 0.02;

/**
 * Escolhe, entre as resoluções que o sensor oferece, a maior que **já nasce**
 * no enquadramento pedido (T086).
 *
 * É a diferença entre pedir e cortar. A câmera nativa parece natural porque ela
 * não recorta 4:3 e 16:9 — ela pede ao sensor um modo que tem essa proporção, e
 * a foto sai inteira, com o campo de visão que o visor mostrava. Só o 1:1, que
 * sensor nenhum tem, é corte de verdade (a nativa também corta).
 *
 * Formato do `expo-camera`, sempre em paisagem: "4000x3000". Comparamos
 * `menor/maior` porque a foto sai em retrato e a razão vem invertida.
 *
 * Devolve `null` quando nenhuma resolução bate — o chamador então recorta.
 */
export function escolherTamanhoNativo(tamanhos: string[], razao: number): string | null {
  let melhor: string | null = null;
  let maiorArea = 0;
  for (const t of tamanhos) {
    const [l, a] = t.split('x').map(Number);
    if (!l || !a) continue;
    const proporcao = Math.min(l, a) / Math.max(l, a);
    const alvo = razao > 1 ? 1 / razao : razao;
    if (Math.abs(proporcao - alvo) > TOLERANCIA) continue;
    const area = l * a;
    if (area > maiorArea) {
      maiorArea = area;
      melhor = t;
    }
  }
  return melhor;
}

/**
 * Prepara a foto recém-tirada para virar pacote: **gira** para a orientação em
 * que ela foi enquadrada e, só se ainda precisar, recorta (T084).
 *
 * O giro é a correção de um defeito que estava no app desde sempre e que o
 * recorte escondia. Medido no aparelho do Sávio: `takePictureAsync` devolve
 * 2560×1920 — deitada, e **sem** tag EXIF de orientação. O app, que é
 * `portrait` travado, tratava esse arquivo como se ele já estivesse em pé e
 * recortava um retrato do meio dele. Resultado: a foto salva ficava girada 90°
 * em relação ao visor e perdia quase metade do campo de visão nas laterais —
 * a tal impressão de "zoom" entre o disparo e a tela de captura.
 *
 * Como o app não roda em paisagem, a regra é determinística: foto que chega
 * mais larga que alta foi enquadrada em pé, e precisa girar. Traseira gira no
 * sentido horário, frontal no anti-horário — é o espelho de montagem dos dois
 * sensores.
 *
 * Giro e recorte acontecem no **mesmo contexto** do manipulador: uma leitura,
 * uma recodificação. Duas passagens custariam o dobro no caminho crítico do
 * disparo, que é onde a demora aparece.
 */
export async function prepararFoto(params: {
  uri: string;
  largura: number;
  altura: number;
  razaoAlvo: number;
  frontal: boolean;
}): Promise<{ uri: string; aspecto: number }> {
  const { uri, largura, altura, razaoAlvo, frontal } = params;
  if (!largura || !altura) return { uri, aspecto: razaoAlvo };

  const girar = largura > altura;
  // Depois do giro os lados trocam de papel.
  const l = girar ? altura : largura;
  const a = girar ? largura : altura;
  const razaoAtual = l / a;
  // Diferença desprezível: recortar 1px não melhora nada e custa uma reescrita
  // do arquivo inteiro no caminho crítico da captura.
  const recortar = Math.abs(razaoAtual - razaoAlvo) >= 0.01;

  /**
   * Teto de área da foto guardada — 24 MP.
   *
   * Sensores de 200 MP (o JOVI V70 5G, por exemplo) entregam 16320×12240: um
   * bitmap RGBA de ~800 MB só para girar e recortar, no **caminho crítico do
   * disparo**. É a mesma classe de estouro que derrubava o app com os 64 MP
   * deste Redmi, multiplicada por quatro — e a doc do `expo-image-manipulator`
   * não promete nada sobre imagens desse tamanho; a recomendação dela é
   * justamente reduzir cedo na cadeia.
   *
   * 24 MP (ex.: 6000×4000) é o dobro do teto do render final e continua muito
   * acima de qualquer destino de rede social. Fotos menores que isso passam
   * intactas — no Redmi de 64 MP em 4:3, por exemplo, nada muda.
   */
  const AREA_MAXIMA_FOTO = 24_000_000;
  // Área antes do recorte: se já cabe aqui, o recorte só diminui e não há o
  // que encolher.
  const acimaDoTeto = l * a > AREA_MAXIMA_FOTO;

  if (!girar && !recortar && !acimaDoTeto) return { uri, aspecto: razaoAtual };

  try {
    const contexto = ImageManipulator.manipulate(uri);
    if (girar) contexto.rotate(frontal ? -90 : 90);
    let aspectoFinal = razaoAtual;
    // Dimensões que valem depois do recorte — é sobre elas que o teto se aplica.
    let larguraFinal = l;
    let alturaFinal = a;
    if (recortar) {
      const { origemX, origemY, corteL, corteA } = corteCentral(l, a, razaoAlvo);
      contexto.crop({ originX: origemX, originY: origemY, width: corteL, height: corteA });
      aspectoFinal = corteL / corteA;
      larguraFinal = corteL;
      alturaFinal = corteA;
    }
    // O resize vem por último, sobre as dimensões já recortadas, e só quando
    // a foto passa do teto. Recortar primeiro é o que evita reduzir pixels que
    // seriam descartados de qualquer forma.
    if (larguraFinal * alturaFinal > AREA_MAXIMA_FOTO) {
      const escala = Math.sqrt(AREA_MAXIMA_FOTO / (larguraFinal * alturaFinal));
      contexto.resize({ width: Math.max(1, Math.round(larguraFinal * escala)) });
    }
    const imagem = await contexto.renderAsync();
    // `compress: 1` porque isto é a foto do pacote, não o envio ao Gemini: aqui
    // a perda seria permanente e visível na exportação.
    const salva = await imagem.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    return { uri: salva.uri, aspecto: aspectoFinal };
  } catch (e) {
    // Nunca perder a captura por causa do enquadramento (RV-02): sem isto a
    // foto ainda é a foto; sem foto não há pacote nenhum.
    console.log('[enquadrar] preparo falhou, mantendo a foto original:', e);
    return { uri, aspecto: largura / altura };
  }
}

/** Recorte central para dentro: mantém o lado que já serve, tira só o excedente. */
function corteCentral(largura: number, altura: number, razaoDesejada: number) {
  let corteL: number;
  let corteA: number;
  if (largura / altura > razaoDesejada) {
    // Larga demais: corta nas laterais.
    corteA = altura;
    corteL = Math.round(altura * razaoDesejada);
  } else {
    // Alta demais: corta em cima e embaixo.
    corteL = largura;
    corteA = Math.round(largura / razaoDesejada);
  }
  return {
    origemX: Math.max(0, Math.round((largura - corteL) / 2)),
    origemY: Math.max(0, Math.round((altura - corteA) / 2)),
    corteL,
    corteA,
  };
}

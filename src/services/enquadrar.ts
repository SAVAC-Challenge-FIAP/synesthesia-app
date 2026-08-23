/**
 * @docs docs/components/enquadrar.md
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const TOLERANCIA = 0.02;

const AREA_ALVO_CAPTURA = 12_000_000;

export function escolherTamanhoNativo(
  tamanhos: string[],
  razao: number,
): string | null {
  let melhor: string | null = null;
  let melhorArea = 0;
  let menorDistancia = Infinity;
  for (const t of tamanhos) {
    const [l, a] = t.split("x").map(Number);
    if (!l || !a) continue;
    const proporcao = Math.min(l, a) / Math.max(l, a);
    const alvo = razao > 1 ? 1 / razao : razao;
    if (Math.abs(proporcao - alvo) > TOLERANCIA) continue;
    const area = l * a;
    const distancia = Math.abs(area - AREA_ALVO_CAPTURA);
    if (
      distancia < menorDistancia ||
      (distancia === menorDistancia && area > melhorArea)
    ) {
      menorDistancia = distancia;
      melhorArea = area;
      melhor = t;
    }
  }
  return melhor;
}

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

  const l = girar ? altura : largura;
  const a = girar ? largura : altura;
  const razaoAtual = l / a;

  const recortar = Math.abs(razaoAtual - razaoAlvo) >= 0.01;

  const AREA_MAXIMA_FOTO = 24_000_000;

  const acimaDoTeto = l * a > AREA_MAXIMA_FOTO;

  if (!girar && !recortar && !acimaDoTeto) return { uri, aspecto: razaoAtual };

  try {
    const contexto = ImageManipulator.manipulate(uri);
    if (girar) contexto.rotate(frontal ? -90 : 90);
    let aspectoFinal = razaoAtual;

    let larguraFinal = l;
    let alturaFinal = a;
    if (recortar) {
      const { origemX, origemY, corteL, corteA } = corteCentral(
        l,
        a,
        razaoAlvo,
      );
      contexto.crop({
        originX: origemX,
        originY: origemY,
        width: corteL,
        height: corteA,
      });
      aspectoFinal = corteL / corteA;
      larguraFinal = corteL;
      alturaFinal = corteA;
    }

    if (larguraFinal * alturaFinal > AREA_MAXIMA_FOTO) {
      const escala = Math.sqrt(AREA_MAXIMA_FOTO / (larguraFinal * alturaFinal));
      contexto.resize({
        width: Math.max(1, Math.round(larguraFinal * escala)),
      });
    }
    const imagem = await contexto.renderAsync();

    const salva = await imagem.saveAsync({
      compress: 1,
      format: SaveFormat.JPEG,
    });
    return { uri: salva.uri, aspecto: aspectoFinal };
  } catch (e) {
    console.log("[enquadrar] preparo falhou, mantendo a foto original:", e);
    return { uri, aspecto: largura / altura };
  }
}

export async function aplicarTransformacao(params: {
  uri: string;
  aspectoAtual: number;
  rotacaoGraus: 90 | 180 | 270;
}): Promise<{ uri: string; aspecto: number }> {
  const { uri, aspectoAtual, rotacaoGraus } = params;

  const contexto = ImageManipulator.manipulate(uri);
  contexto.rotate(rotacaoGraus);

  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({ compress: 1, format: SaveFormat.JPEG });

  const giraEixos = rotacaoGraus === 90 || rotacaoGraus === 270;
  const aspecto = giraEixos ? 1 / aspectoAtual : aspectoAtual;

  return { uri: salva.uri, aspecto };
}

function corteCentral(largura: number, altura: number, razaoDesejada: number) {
  let corteL: number;
  let corteA: number;
  if (largura / altura > razaoDesejada) {
    corteA = altura;
    corteL = Math.round(altura * razaoDesejada);
  } else {
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

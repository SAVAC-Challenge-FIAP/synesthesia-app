/**
 * @docs docs/components/looks.md
 */
import {
  FAIXAS_ABSOLUTAS,
  FAIXAS_DELTA,
  FILTERS,
  filterById,
  isFilterId,
  limitar,
  resolverReceita,
} from "@/constants/filters";
import { vibeById } from "@/constants/vibes";
import { chaveDaEscolha, useLookTasteStore } from "@/stores/useLookTasteStore";
import {
  AjustesLook,
  FilterDef,
  FilterId,
  LookRecipe,
  PapelLook,
  VibeId,
} from "@/types";

const PAPEIS_DO_MODELO: readonly string[] = ["certeira", "ousada"];

const PAPEIS_PEDIDOS: PapelLook[] = ["certeira", "ousada", "ousada"];

const DESVIO_MINIMO: Record<
  PapelLook,
  Partial<Record<"brilho" | "saturacao" | "contraste", number>>
> = {
  certeira: { saturacao: 0.08, contraste: 0.06 },
  ousada: { saturacao: 0.18, contraste: 0.12, brilho: -0.06 },

  afinidade: { saturacao: 0.08, contraste: 0.06 },
};

const NOME_AUTORAL: Record<string, { certeira: string; ousada: string }> = {
  vivid: { certeira: "Verão Claro", ousada: "Sol Alto" },
  neon: { certeira: "Luz Urbana", ousada: "Madrugada Neon" },
  love: { certeira: "Rubor", ousada: "Coração Quente" },
  eclipse: { certeira: "Meia-Luz", ousada: "Eclipse Total" },
  retro: { certeira: "Fita Velha", ousada: "Anos Dourados" },
  vintage: { certeira: "Papel Antigo", ousada: "Memória Rara" },
  arctic: { certeira: "Ar Frio", ousada: "Gelo Puro" },
  honey: { certeira: "Mel Suave", ousada: "Hora Dourada" },
};

function nomeAutoral(base: FilterId, papel: PapelLook): string {
  const par = NOME_AUTORAL[base];
  if (!par) return filterById(base).nome;
  return papel === "certeira" ? par.certeira : par.ousada;
}

const LIMIAR_REDUNDANCIA = 0.12;

export const TOTAL_LOOKS = 3;

export function clampAjustes(bruto: unknown): AjustesLook {
  const o = (bruto ?? {}) as Record<string, unknown>;
  const campo = (k: keyof AjustesLook) => {
    const [min, max] = FAIXAS_DELTA[k];
    return limitar(o[k], min, max, 0);
  };
  return {
    brilho: campo("brilho"),
    saturacao: campo("saturacao"),
    contraste: campo("contraste"),
    sepia: campo("sepia"),
    veu: campo("veu"),
  };
}

export function identidadeDoLook(look: LookRecipe | null | undefined): string {
  if (!look) return "sem-look";
  return chaveDaEscolha(look.base, look.ajustes);
}

function nomeDeAfinidade(
  nomeSalvo: string | undefined,
  base: FilterId,
): string {
  const nome = (nomeSalvo ?? "").trim();
  if (!nome) return nomeAutoral(base, "certeira");
  const preset = filterById(base).nome.toLowerCase();
  const cru = nome.toLowerCase();

  const etiquetado =
    cru === preset || cru === `${preset} livre` || cru === `${preset} suave`;
  return etiquetado ? nomeAutoral(base, "certeira") : nome;
}

export function lookDeAfinidade(): LookRecipe | null {
  const preferido = useLookTasteStore.getState().preferido();

  if (!preferido || preferido.base === null) return null;

  return {
    base: preferido.base,
    ajustes: preferido.ajustes ?? {},

    nome: nomeDeAfinidade(preferido.nome, preferido.base),
    justificativa: "você costuma escolher este aqui",
    papel: "afinidade",
  };
}

export function distanciaEntre(a: LookRecipe, b: LookRecipe): number {
  const fa = resolverReceita(a);
  const fb = resolverReceita(b);
  const ia = fa.imageFilter ?? {};
  const ib = fb.imageFilter ?? {};
  const eixo = (
    x: number | undefined,
    y: number | undefined,
    faixa: readonly [number, number],
  ) => Math.abs((x ?? 0) - (y ?? 0)) / (faixa[1] - faixa[0]);
  const A = FAIXAS_ABSOLUTAS;
  return (
    eixo(ia.brightness, ib.brightness, A.brightness) +
    eixo(ia.saturate, ib.saturate, A.saturate) +
    eixo(ia.contrast, ib.contrast, A.contrast) +
    eixo(ia.sepia, ib.sepia, A.sepia) +
    eixo(fa.overlayOpacity, fb.overlayOpacity, A.overlayOpacity) +
    (fa.overlayColor === fb.overlayColor ? 0 : 0.2)
  );
}

function redundante(candidato: LookRecipe, conjunto: LookRecipe[]): boolean {
  return conjunto.some(
    (l) => distanciaEntre(candidato, l) < LIMIAR_REDUNDANCIA,
  );
}

export function receitaDeIdeia(
  bruto: unknown,
  posicao: number,
): LookRecipe | null {
  const o = (bruto ?? {}) as Record<string, unknown>;
  if (!isFilterId(o.base)) return null;

  const papelBruto =
    typeof o.papel === "string" ? o.papel.trim().toLowerCase() : "";

  const papel: PapelLook = PAPEIS_DO_MODELO.includes(papelBruto)
    ? (papelBruto as PapelLook)
    : (PAPEIS_PEDIDOS[posicao] ?? "ousada");

  const nomePreset = filterById(o.base).nome;
  const nomeBruto = typeof o.nome === "string" ? o.nome.trim() : "";
  const nome = nomeBruto || nomePreset;

  const ajustes = clampAjustes(o.ajustes);
  const semDesvio = Object.values(ajustes).every((v) => !v);
  const ajustesFinais = semDesvio ? { ...DESVIO_MINIMO[papel] } : ajustes;

  return {
    base: o.base,
    ajustes: ajustesFinais,

    nome:
      nome.toLowerCase() === nomePreset.toLowerCase()
        ? nomeAutoral(o.base, papel)
        : nome,
    justificativa:
      typeof o.justificativa === "string" ? o.justificativa.trim() : "",
    papel,
  };
}

export function looksBase(vibeId: VibeId): LookRecipe[] {
  const vibe = vibeById(vibeId);
  const inicio = FILTERS.findIndex((f) => f.id === vibe.filtro);
  const ordem: FilterId[] = Array.from(
    { length: FILTERS.length },
    (_, i) => FILTERS[(Math.max(0, inicio) + i) % FILTERS.length].id,
  );
  return ordem.map((base, i) => ({
    base,

    ajustes: {
      ...DESVIO_MINIMO[(i === 0 ? "certeira" : "ousada") as PapelLook],
    },

    nome: nomeAutoral(base, (i === 0 ? "certeira" : "ousada") as PapelLook),
    justificativa:
      i === 0
        ? `combina com a atmosfera ${vibe.nome.toLowerCase()}`
        : `outra leitura da atmosfera ${vibe.nome.toLowerCase()}`,
    papel: (i === 0 ? "certeira" : "ousada") as PapelLook,
  }));
}

export function montarLooks(
  ideias: unknown[] | undefined,
  vibeId: VibeId,
): LookRecipe[] {
  const doModelo = (ideias ?? [])
    .map((bruto, i) => receitaDeIdeia(bruto, i))
    .filter((l): l is LookRecipe => l !== null);

  const conjunto: LookRecipe[] = [];

  const afinidade = lookDeAfinidade();
  if (afinidade) {
    conjunto.push(afinidade);
    console.log(
      `[looks] afinidade local: «${afinidade.nome}» base=${afinidade.base}`,
    );
  }

  for (const look of doModelo) {
    if (conjunto.length >= TOTAL_LOOKS) break;
    if (!redundante(look, conjunto)) conjunto.push(look);
  }

  const reserva = looksBase(vibeId);
  for (const look of reserva) {
    if (conjunto.length >= TOTAL_LOOKS) break;
    if (!redundante(look, conjunto)) conjunto.push(look);
  }

  for (const look of reserva) {
    if (conjunto.length >= TOTAL_LOOKS) break;
    if (!conjunto.some((l) => l.base === look.base)) conjunto.push(look);
  }

  return conjunto.slice(0, TOTAL_LOOKS);
}

export function looksDeMidiaAntiga(
  filtroId: FilterId | null,
  vibeId: VibeId,
): { looks: LookRecipe[]; escolhido: LookRecipe | null } {
  const base = looksBase(vibeId);
  if (!filtroId) return { looks: base.slice(0, TOTAL_LOOKS), escolhido: null };

  const jaEsta = base.find((l) => l.base === filtroId);
  const escolhido: LookRecipe = jaEsta ?? {
    base: filtroId,
    ajustes: {},
    nome: filterById(filtroId).nome,
    justificativa: "o tratamento com que esta foto foi salva",
    papel: "certeira",
  };
  const resto = base.filter((l) => l.base !== filtroId);
  return { looks: [escolhido, ...resto].slice(0, TOTAL_LOOKS), escolhido };
}

type MatrizCor = number[];

function identidadeCor(): MatrizCor {
  // prettier-ignore
  return [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function multiplicarMatrizesCor(a: MatrizCor, b: MatrizCor): MatrizCor {
  const linha = (m: MatrizCor, i: number) => m.slice(i * 5, i * 5 + 5);
  const resultado: number[] = [];
  for (let i = 0; i < 4; i++) {
    const la = linha(a, i);
    for (let j = 0; j < 4; j++) {
      let soma = 0;
      for (let k = 0; k < 4; k++) soma += la[k] * b[k * 5 + j];
      resultado.push(soma);
    }
    let offset = la[4];
    for (let k = 0; k < 4; k++) offset += la[k] * b[k * 5 + 4];
    resultado.push(offset);
  }
  return resultado;
}

function matrizSaturacao(s: number): MatrizCor {
  const [lr, lg, lb] = [0.213, 0.715, 0.072];
  // prettier-ignore
  return [
    lr + (1 - lr) * s, lg - lg * s,       lb - lb * s,       0, 0,
    lr - lr * s,        lg + (1 - lg) * s, lb - lb * s,       0, 0,
    lr - lr * s,        lg - lg * s,       lb + (1 - lb) * s, 0, 0,
    0,                   0,                 0,                 1, 0,
  ];
}

function matrizContraste(c: number): MatrizCor {
  const t = 0.5 * (1 - c);
  // prettier-ignore
  return [
    c, 0, 0, 0, t,
    0, c, 0, 0, t,
    0, 0, c, 0, t,
    0, 0, 0, 1, 0,
  ];
}

function matrizBrilho(b: number): MatrizCor {
  // prettier-ignore
  return [
    b, 0, 0, 0, 0,
    0, b, 0, 0, 0,
    0, 0, b, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

// prettier-ignore
const SEPIA_CLASSICA: MatrizCor = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0,     0,     0,     1, 0,
];

function matrizSepia(f: number): MatrizCor {
  if (f <= 0) return identidadeCor();
  const id = identidadeCor();
  return id.map((v, i) => v * (1 - f) + SEPIA_CLASSICA[i] * f);
}

export function matrizDeCor(filtro: FilterDef): number[] {
  const f = filtro.imageFilter ?? {};
  let m = matrizSaturacao(f.saturate ?? 1);
  m = multiplicarMatrizesCor(matrizContraste(f.contrast ?? 1), m);
  m = multiplicarMatrizesCor(matrizBrilho(f.brightness ?? 1), m);
  m = multiplicarMatrizesCor(matrizSepia(f.sepia ?? 0), m);
  return m;
}

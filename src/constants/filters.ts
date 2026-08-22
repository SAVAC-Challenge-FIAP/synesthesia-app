import { AjustesLook, FilterDef, FilterId, LookRecipe } from '@/types';

/**
 * Os 8 filtros do Synesthesia (Figma).
 * Render no Expo Go: overlays coloridos + style `filter` do RN (new arch).
 * Em dev build, estes parâmetros migram para shaders Skia (ver plano de arquitetura).
 */
export const FILTERS: FilterDef[] = [
  {
    id: 'vivid',
    nome: 'Vivid',
    emoji: '🌟',
    overlayColor: '#F8A20D',
    overlayOpacity: 0.08,
    imageFilter: { saturate: 1.55, contrast: 1.08 },
  },
  {
    id: 'neon',
    nome: 'Neon',
    emoji: '🌈',
    overlayColor: '#B026FF',
    overlayOpacity: 0.16,
    overlayColor2: '#00E5FF',
    overlayOpacity2: 0.08,
    imageFilter: { saturate: 1.8, contrast: 1.12 },
  },
  {
    id: 'love',
    nome: 'Love',
    emoji: '❤️',
    overlayColor: '#FF2D55',
    overlayOpacity: 0.16,
    imageFilter: { saturate: 1.25, brightness: 1.03 },
  },
  {
    id: 'eclipse',
    nome: 'Eclipse',
    emoji: '🌒',
    overlayColor: '#090506',
    overlayOpacity: 0.35,
    imageFilter: { brightness: 0.8, contrast: 1.3, saturate: 0.85 },
  },
  {
    id: 'retro',
    nome: 'Retro',
    emoji: '📼',
    overlayColor: '#D9A441',
    overlayOpacity: 0.18,
    imageFilter: { sepia: 0.35, contrast: 0.92 },
  },
  {
    id: 'vintage',
    nome: 'Vintage',
    emoji: '🧡',
    overlayColor: '#C96F2B',
    overlayOpacity: 0.2,
    imageFilter: { sepia: 0.5, saturate: 0.75 },
  },
  {
    id: 'arctic',
    nome: 'Arctic',
    emoji: '❄️',
    overlayColor: '#7FD4FF',
    overlayOpacity: 0.16,
    imageFilter: { brightness: 1.06, saturate: 0.9 },
  },
  {
    id: 'honey',
    nome: 'Honey',
    emoji: '🍯',
    overlayColor: '#F8A20D',
    overlayOpacity: 0.2,
    imageFilter: { brightness: 1.04, saturate: 1.15, sepia: 0.15 },
  },
];

export const filterById = (id: FilterId): FilterDef =>
  FILTERS.find((f) => f.id === id) ?? FILTERS[0];

export const isFilterId = (v: unknown): v is FilterId =>
  typeof v === 'string' && FILTERS.some((f) => f.id === v);

/**
 * Faixas seguras (feature 003, research R2). Ficam aqui, e não em `looks.ts`,
 * porque descrevem os **parâmetros de filtro** — e porque `looks.ts` já importa
 * este arquivo: pôr as faixas lá criaria import circular.
 *
 * São duas barreiras em série, e as duas são necessárias. Limitar só o delta não
 * basta: um desvio legítimo somado a um preset que já é extremo (o Eclipse tem
 * contraste 1.3) ainda sairia da faixa.
 */

/** Barreira 1 — o desvio que se aceita do modelo. */
export const FAIXAS_DELTA: Record<keyof AjustesLook, readonly [number, number]> = {
  brilho: [-0.2, 0.2],
  saturacao: [-0.5, 0.5],
  contraste: [-0.25, 0.25],
  sepia: [-0.3, 0.3],
  veu: [-0.15, 0.15],
};

/** Barreira 2 — o valor absoluto que chega ao render. */
export const FAIXAS_ABSOLUTAS = {
  brightness: [0.7, 1.3],
  saturate: [0, 2],
  contrast: [0.75, 1.45],
  sepia: [0, 0.8],
  overlayOpacity: [0, 0.5],
} as const;

/**
 * Limita um número a uma faixa. Valor não numérico vira o neutro informado —
 * nunca `NaN`, senão um único campo podre do modelo apagaria a imagem inteira.
 */
export function limitar(v: unknown, min: number, max: number, neutro: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : neutro;
  return Math.min(max, Math.max(min, n));
}

/**
 * Receita → filtro efetivo: preset base + desvios, com a Barreira 2 aplicada.
 *
 * O `id` do resultado continua sendo o do preset base, e isso é de propósito:
 * é o que mantém a ancoragem visível para o resto do app (miniaturas, galeria,
 * `chavePacote`) sem que ninguém precise conhecer a receita.
 */
export function resolverReceita(look: LookRecipe): FilterDef {
  const base = filterById(look.base);
  const a = look.ajustes ?? {};
  const f = base.imageFilter ?? {};
  const A = FAIXAS_ABSOLUTAS;

  const somar = (
    atual: number | undefined,
    delta: number | undefined,
    neutro: number,
    faixa: readonly [number, number],
  ) => limitar((atual ?? neutro) + (delta ?? 0), faixa[0], faixa[1], neutro);

  return {
    ...base,
    overlayOpacity: somar(base.overlayOpacity, a.veu, 0, A.overlayOpacity),
    ...(base.overlayColor2
      ? { overlayOpacity2: somar(base.overlayOpacity2, a.veu, 0, A.overlayOpacity) }
      : {}),
    imageFilter: {
      brightness: somar(f.brightness, a.brilho, 1, A.brightness),
      saturate: somar(f.saturate, a.saturacao, 1, A.saturate),
      contrast: somar(f.contrast, a.contraste, 1, A.contrast),
      sepia: somar(f.sepia, a.sepia, 0, A.sepia),
    },
  };
}

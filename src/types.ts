export type FilterId =
  | 'vivid'
  | 'neon'
  | 'love'
  | 'eclipse'
  | 'retro'
  | 'vintage'
  | 'arctic'
  | 'honey';

export type VibeId =
  | 'energetica'
  | 'sonhadora'
  | 'romantica'
  | 'noturna'
  | 'nostalgica'
  | 'aconchegante'
  | 'gelada'
  | 'dourada';

export interface FilterDef {
  id: FilterId;
  nome: string;
  emoji: string;
  /** Cor do overlay aplicado sobre o visor/foto */
  overlayColor: string;
  overlayOpacity: number;
  /** Segundo overlay (gradiente simulado) — opcional */
  overlayColor2?: string;
  overlayOpacity2?: number;
  /**
   * Filtros de estilo do RN (new arch). Android suporta todos;
   * iOS aplica apenas brightness — o overlay garante a identidade visual.
   */
  imageFilter?: { brightness?: number; saturate?: number; contrast?: number; sepia?: number };
}

export interface Vibe {
  id: VibeId;
  nome: string;
  emoji: string;
  /** Filtro sugerido automaticamente para esta vibe */
  filtro: FilterId;
  /** Palavras-chave para a curadoria musical (Deezer/Gemini) */
  musicaKeywords: string[];
  descricao: string;
}

/**
 * Papel da faixa dentro do conjunto de quatro (T058). Existe para que uma
 * sugestão fora do óbvio chegue como **proposta** e não como erro: sem rótulo,
 * um artista desconhecido no meio de três hits parece defeito da curadoria.
 *
 * - `afinidade`  — casa com o histórico de escolhas **do próprio aparelho**;
 *                  derivado localmente, nunca pedido ao Gemini (ver D7).
 * - `certeira`   — combina com a cena, sem risco.
 * - `descoberta` — artista pouco conhecido, conferido pelo `nb_fan` no T059.
 * - `curinga`    — livre, pode ser inesperada.
 */
export type PapelFaixa = 'afinidade' | 'certeira' | 'descoberta' | 'curinga';

export interface MusicSuggestion {
  id: string;
  titulo: string;
  artista: string;
  emoji: string;
  justificativa: string;
  /** URL de preview (30s) — Deezer */
  previewUrl: string | null;
  origem: 'deezer' | 'gemini' | 'local';
  /** Ausente nas faixas do catálogo local e do Deezer puro. */
  papel?: PapelFaixa;
  /**
   * Id do artista no Deezer, quando a faixa foi resolvida lá. É o que permite
   * conferir `nb_fan` sem cair em homônimo — ver `verificarDescobertas`.
   */
  artistaId?: number;
}

export interface Media {
  id: string;
  /** URI persistente da foto (documentDirectory) */
  photoUri: string;
  /** null = foto original, sem filtro (T-0B) */
  filtroId: FilterId | null;
  vibeId: VibeId;
  musica: MusicSuggestion | null;
  /** Trecho da música em segundos (0–30) */
  trechoInicio: number;
  trechoFim: number;
  criadaEm: number;
  atualizadaEm: number;
}

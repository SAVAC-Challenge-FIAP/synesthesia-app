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

export interface MusicSuggestion {
  id: string;
  titulo: string;
  artista: string;
  emoji: string;
  justificativa: string;
  /** URL de preview (30s) — Deezer */
  previewUrl: string | null;
  origem: 'deezer' | 'gemini' | 'local';
}

export interface Media {
  id: string;
  /** URI persistente da foto (documentDirectory) */
  photoUri: string;
  filtroId: FilterId;
  vibeId: VibeId;
  musica: MusicSuggestion | null;
  /** Trecho da música em segundos (0–30) */
  trechoInicio: number;
  trechoFim: number;
  criadaEm: number;
  atualizadaEm: number;
}

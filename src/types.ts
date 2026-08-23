/**
 * @docs docs/components/types.md
 */
export type FilterId =
  | "vivid"
  | "neon"
  | "love"
  | "eclipse"
  | "retro"
  | "vintage"
  | "arctic"
  | "honey";

export type VibeId =
  | "energetica"
  | "sonhadora"
  | "romantica"
  | "noturna"
  | "nostalgica"
  | "aconchegante"
  | "gelada"
  | "dourada";

export interface FilterDef {
  id: FilterId;
  nome: string;
  emoji: string;
  overlayColor: string;
  overlayOpacity: number;
  overlayColor2?: string;
  overlayOpacity2?: number;
  imageFilter?: {
    brightness?: number;
    saturate?: number;
    contrast?: number;
    sepia?: number;
  };
}

export type PapelLook = "afinidade" | "certeira" | "ousada";

export interface AjustesLook {
  brilho?: number;
  saturacao?: number;
  contraste?: number;
  sepia?: number;
  veu?: number;
}

export interface LookRecipe {
  base: FilterId;
  ajustes: AjustesLook;
  nome: string;
  justificativa: string;
  papel: PapelLook;
}

export interface Vibe {
  id: VibeId;
  nome: string;
  emoji: string;
  filtro: FilterId;
  musicaKeywords: string[];
  descricao: string;
}

export type PapelFaixa = "afinidade" | "certeira" | "descoberta" | "curinga";

export interface MusicSuggestion {
  id: string;
  titulo: string;
  artista: string;
  emoji: string;
  justificativa: string;
  previewUrl: string | null;
  origem: "deezer" | "gemini" | "local";
  papel?: PapelFaixa;
  artistaId?: number;
  genero?: string;
}

export type EnquadramentoId = "1:1" | "4:3" | "16:9";

export interface Media {
  id: string;
  photoUri: string;
  filtroId: FilterId | null;
  vibeId: VibeId;
  vibe?: string;
  musica: MusicSuggestion | null;
  trechoInicio: number;
  trechoFim: number;
  aspecto?: number;
  sugestoes?: MusicSuggestion[];
  looks?: LookRecipe[];
  lookEscolhido?: LookRecipe;
  audioUri?: string;
  criadaEm: number;
  atualizadaEm: number;
}

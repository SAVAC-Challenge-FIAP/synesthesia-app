/**
 * @docs docs/adr/0013-arquitetura-estado-captura.md
 */
import { create } from "zustand";

import { FilterId, LookRecipe, MusicSuggestion, VibeId } from "@/types";

export type EstadoCuradoria = "carregando" | "pronta" | "indisponivel";

export interface CaptureSession {
  mediaId: string | null;
  photoUri: string;
  filtroId: FilterId | null;
  filtroAuto: boolean;
  vibeId: VibeId;
  vibe?: string;
  aspecto: number;
  looks: LookRecipe[];
  lookEscolhido: LookRecipe | null;
  lookAuto: boolean;
  musica: MusicSuggestion | null;
  audioUri: string | null;
  sugestoes: MusicSuggestion[];
  curadoria: EstadoCuradoria;
  trechoInicio: number;
  trechoFim: number;
  trilhaArquivada: boolean;
}

interface CaptureState {
  session: CaptureSession | null;
  start: (
    s: Omit<
      CaptureSession,
      | "sugestoes"
      | "curadoria"
      | "trilhaArquivada"
      | "looks"
      | "lookEscolhido"
      | "lookAuto"
      | "audioUri"
    > & {
      sugestoes?: MusicSuggestion[];
      audioUri?: string | null;
      looks?: LookRecipe[];
      lookEscolhido?: LookRecipe | null;
    },
  ) => void;
  patch: (p: Partial<CaptureSession>) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureState>()((set) => ({
  session: null,
  start: (s) =>
    set({
      session: {
        ...s,
        sugestoes: s.sugestoes ?? [],
        audioUri: s.audioUri ?? null,
        looks: s.looks ?? [],
        lookEscolhido: s.lookEscolhido ?? null,

        lookAuto: true,
        trilhaArquivada: false,

        curadoria: s.musica ? "pronta" : "carregando",
      },
    }),
  patch: (p) =>
    set((state) =>
      state.session ? { session: { ...state.session, ...p } } : state,
    ),
  clear: () => set({ session: null }),
}));

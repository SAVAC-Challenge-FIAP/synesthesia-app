import { create } from 'zustand';

import { FilterId, MusicSuggestion, VibeId } from '@/types';

/**
 * Sessão de captura/edição em andamento (estado sensorial centralizado —
 * ver convenções no CLAUDE.md). Alimenta o modal de captura e a edição
 * reaberta a partir da galeria.
 */
interface CaptureSession {
  /** id da mídia quando é uma edição de item existente; null em captura nova */
  mediaId: string | null;
  photoUri: string;
  /** null = foto original, sem filtro (T-0B) */
  filtroId: FilterId | null;
  /**
   * true enquanto o filtro segue a vibe automaticamente — permite que a
   * análise da foto (Gemini) troque o filtro pela vibe real; qualquer escolha
   * manual no carrossel derruba a flag.
   */
  filtroAuto: boolean;
  vibeId: VibeId;
  musica: MusicSuggestion | null;
  sugestoes: MusicSuggestion[];
  carregandoSugestoes: boolean;
  trechoInicio: number;
  trechoFim: number;
}

interface CaptureState {
  session: CaptureSession | null;
  start: (s: Omit<CaptureSession, 'sugestoes' | 'carregandoSugestoes'>) => void;
  patch: (p: Partial<CaptureSession>) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureState>()((set) => ({
  session: null,
  start: (s) => set({ session: { ...s, sugestoes: [], carregandoSugestoes: false } }),
  patch: (p) =>
    set((state) => (state.session ? { session: { ...state.session, ...p } } : state)),
  clear: () => set({ session: null }),
}));

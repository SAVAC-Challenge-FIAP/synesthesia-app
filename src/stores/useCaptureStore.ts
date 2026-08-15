import { create } from 'zustand';

import { FilterId, MusicSuggestion, VibeId } from '@/types';

/**
 * Estado da curadoria musical da sessão em edição.
 *
 * Existe para desfazer uma ambiguidade que causava perda silenciosa de trilha:
 * `musica === null` significava tanto **"ainda estou buscando"** quanto
 * **"busquei e não achei"**, e a interface liberava a postagem nos dois casos.
 * Com o estado nomeado, cada situação tem uma resposta própria:
 *
 * | Estado | Significado | Postar | Salvar |
 * |---|---|---|---|
 * | `carregando`   | lendo a cena / buscando faixas | bloqueado, com motivo visível | sempre |
 * | `pronta`       | trilha disponível e aprovada   | liberado                      | sempre |
 * | `indisponivel` | terminou sem trilha            | exige confirmação explícita   | sempre |
 *
 * O estado `ocioso` do data-model é representado por `session === null`.
 */
export type EstadoCuradoria = 'carregando' | 'pronta' | 'indisponivel';

/**
 * Sessão de captura/edição em andamento (estado sensorial centralizado —
 * ver convenções no CLAUDE.md). Alimenta o modal de captura e a edição
 * reaberta a partir da galeria.
 */
export interface CaptureSession {
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
  curadoria: EstadoCuradoria;
  trechoInicio: number;
  trechoFim: number;
}

interface CaptureState {
  session: CaptureSession | null;
  start: (s: Omit<CaptureSession, 'sugestoes' | 'curadoria'>) => void;
  patch: (p: Partial<CaptureSession>) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureState>()((set) => ({
  session: null,
  start: (s) =>
    set({
      session: {
        ...s,
        sugestoes: [],
        // Abre em `carregando`, nunca em `indisponivel`: enquanto não se sabe
        // se há trilha, a postagem fica bloqueada em vez de sair sem áudio.
        // Reabrir da galeria uma mídia que já tem trilha entra direto em `pronta`.
        curadoria: s.musica ? 'pronta' : 'carregando',
      },
    }),
  patch: (p) =>
    set((state) => (state.session ? { session: { ...state.session, ...p } } : state)),
  clear: () => set({ session: null }),
}));

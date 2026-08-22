import { create } from 'zustand';

import { FilterId, LookRecipe, MusicSuggestion, VibeId } from '@/types';

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
  /**
   * Vibe livre lida da cena pelo Gemini (feature 005), até duas palavras.
   *
   * `undefined` tem **dois significados distintos**, e a interface precisa dos
   * dois para não mentir:
   *   • `curadoria === 'carregando'` → ainda não chegou → **esqueleto** (FR-031)
   *   • curadoria terminada          → não vai chegar   → nome do `vibeId` (FR-036)
   *
   * Nunca um valor provisório enquanto se espera: mostrar a prévia heurística
   * do visor aqui era exatamente o palpite errado que a feature veio eliminar.
   */
  vibe?: string;
  /**
   * Proporção largura/altura da foto já recortada (T066). Viaja na sessão para
   * a tela de captura desenhar a prévia no formato certo e para o registro
   * salvo na galeria nascer com o campo.
   */
  aspecto: number;
  /**
   * As três sugestões de look da foto (feature 003). `[]` enquanto a curadoria
   * não voltou — a interface mostra as miniaturas dos 8 presets nesse intervalo,
   * e o caminho de salvar nunca espera por isto (FR-020).
   */
  looks: LookRecipe[];
  lookEscolhido: LookRecipe | null;
  /**
   * `true` enquanto ninguém tocou em look nenhum. É o que distingue **escolha
   * explícita** de **aceite passivo** na hora de gravar o histórico (FR-011) —
   * mesma mecânica de `filtroAuto`, que já existia para o filtro.
   */
  lookAuto: boolean;
  musica: MusicSuggestion | null;
  /**
   * Caminho local do .mp3 da trilha, quando já existe (T102). Chega preenchido
   * nas mídias reabertas da galeria e passa a existir na captura nova assim que
   * o `salvar()` baixa a prévia. É o que o player prefere tocar: a
   * `previewUrl` do Deezer expira, o arquivo não.
   */
  audioUri: string | null;
  sugestoes: MusicSuggestion[];
  curadoria: EstadoCuradoria;
  trechoInicio: number;
  trechoFim: number;
  /**
   * Trilha arquivada: continua **escolhida**, mas fora do pacote — a exportação
   * sai só com imagem e filtro.
   *
   * É diferente de `musica: null`. Zerar a faixa obrigaria a curadoria a rodar
   * de novo (e o Gemini junto) se o usuário mudasse de ideia; arquivar guarda a
   * escolha na sessão, e desarquivar é instantâneo e de graça.
   */
  trilhaArquivada: boolean;
}

interface CaptureState {
  session: CaptureSession | null;
  /**
   * `sugestoes` é opcional porque a captura nova não tem nenhuma — elas chegam
   * da curadoria. Quem passa são as mídias reabertas da galeria, que já as
   * carregam salvas (T083).
   */
  start: (
    s: Omit<
      CaptureSession,
      | 'sugestoes'
      | 'curadoria'
      | 'trilhaArquivada'
      | 'looks'
      | 'lookEscolhido'
      | 'lookAuto'
      | 'audioUri'
    > & {
      sugestoes?: MusicSuggestion[];
      /** Só as mídias reabertas da galeria já têm o .mp3 no disco. */
      audioUri?: string | null;
      /** Presentes só nas mídias reabertas da galeria, que já as trazem salvas. */
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
        // Nasce `true`: até alguém tocar, o que estiver aplicado é aceite
        // passivo. Uma mídia reaberta também entra assim — o toque que a
        // escolheu já foi registrado quando ela foi salva.
        lookAuto: true,
        trilhaArquivada: false,
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

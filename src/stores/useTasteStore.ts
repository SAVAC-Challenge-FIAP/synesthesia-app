import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MusicSuggestion, VibeId } from '@/types';

/**
 * Histórico de gosto musical — só no aparelho (Fase 14, T057).
 *
 * Guarda o que a pessoa **escolheu**, não o que apareceu para ela. É a diferença
 * que dá sentido ao peso: uma faixa que ela foi buscar no `MusicSheet` diz muito
 * mais do que uma que o sistema escolheu sozinho e ela não desfez.
 *
 * ⚠️ **LGPD — este dado não sai do aparelho.** O opt-in `deteccaoTempoReal` dos
 * Ajustes autoriza enviar *a foto* ao Gemini; nomes de artistas que a pessoa
 * escolhe são outra divulgação, sobre gosto pessoal, e não estão cobertos por
 * aquele consentimento (ver **D7** no tasks.md). Por isso `artistasFrequentes`
 * é consumido **localmente**, para reordenar e rotular o que o Gemini devolveu —
 * nunca para compor o prompt.
 *
 * `faixasSugeridas` é outra coisa e tem outro regime: são as faixas que o próprio
 * modelo já propôs, não escolhas da pessoa. Devolvê-las ao prompt como lista de
 * bloqueio não revela gosto nenhum — é o modelo lendo a própria saída anterior.
 */

/** Peso relativo de uma escolha manual — ela rejeitou a sugestão e buscou outra. */
const PESO_MANUAL = 3;
const PESO_AUTO = 1;
/** Meia-vida da relevância de uma escolha, em dias. */
const MEIA_VIDA_DIAS = 30;

/** Histórico de gosto, não log de auditoria: um teto modesto basta. */
const TETO_ESCOLHAS = 200;
/** Lista de bloqueio por vibe — o T058 injeta ~20 no prompt. */
const TETO_SUGERIDAS_POR_VIBE = 40;

export interface EscolhaMusical {
  faixaId: string;
  titulo: string;
  artista: string;
  vibeId: VibeId;
  /** `manual` = trocou no MusicSheet; `auto` = aceitou o que o sistema pôs. */
  origem: 'auto' | 'manual';
  em: number;
}

interface FaixaSugerida {
  chave: string;
  em: number;
}

interface TasteState {
  escolhas: EscolhaMusical[];
  sugeridasPorVibe: Record<string, FaixaSugerida[]>;

  registrarEscolha: (
    musica: MusicSuggestion,
    vibeId: VibeId,
    origem: 'auto' | 'manual',
  ) => void;
  registrarSugeridas: (vibeId: VibeId, sugestoes: MusicSuggestion[]) => void;

  /** Artistas mais escolhidos, do mais forte para o mais fraco. */
  artistasFrequentes: (n?: number) => string[];
  /** Chaves `titulo — artista` já sugeridas para a vibe, das mais recentes. */
  faixasSugeridasRecentes: (vibeId: VibeId, n?: number) => string[];
  /** Chaves de tudo que a pessoa já escolheu, para não reoferecer o de sempre. */
  faixasEscolhidasRecentes: (n?: number) => string[];

  limpar: () => void;
}

/** Identidade de faixa que sobrevive a ids diferentes entre Gemini e Deezer. */
export function chaveDaFaixa(titulo: string, artista: string): string {
  return `${titulo.trim().toLowerCase()} — ${artista.trim().toLowerCase()}`;
}

function pesoDe(escolha: EscolhaMusical, agora: number): number {
  const base = escolha.origem === 'manual' ? PESO_MANUAL : PESO_AUTO;
  const idadeDias = Math.max(0, (agora - escolha.em) / 86_400_000);
  return base * 0.5 ** (idadeDias / MEIA_VIDA_DIAS);
}

export const useTasteStore = create<TasteState>()(
  persist(
    (set, get) => ({
      escolhas: [],
      sugeridasPorVibe: {},

      registrarEscolha: (musica, vibeId, origem) =>
        set((s) => {
          // A mesma faixa escolhida de novo não vira duas entradas: a anterior sai
          // e a nova entra na frente, senão um pacote reeditado várias vezes
          // afogaria o histórico inteiro num artista só.
          const chave = chaveDaFaixa(musica.titulo, musica.artista);
          const anterior = s.escolhas.find(
            (e) => chaveDaFaixa(e.titulo, e.artista) === chave,
          );
          const nova: EscolhaMusical = {
            faixaId: musica.id,
            titulo: musica.titulo,
            artista: musica.artista,
            vibeId,
            // `manual` nunca é rebaixado para `auto`. Sem isto, trocar a música e
            // então salvar o pacote — que é o caminho normal — apagaria o sinal
            // forte e registraria a mesma faixa como aceitação passiva.
            origem: anterior?.origem === 'manual' ? 'manual' : origem,
            em: Date.now(),
          };
          const semDuplicata = s.escolhas.filter(
            (e) => chaveDaFaixa(e.titulo, e.artista) !== chave,
          );
          console.log(
            `[gosto] escolha ${nova.origem} «${nova.titulo} — ${nova.artista}» ` +
              `vibe=${vibeId} total=${semDuplicata.length + 1}`,
          );
          return { escolhas: [nova, ...semDuplicata].slice(0, TETO_ESCOLHAS) };
        }),

      registrarSugeridas: (vibeId, sugestoes) =>
        set((s) => {
          const agora = Date.now();
          const novas = sugestoes.map((m) => ({
            chave: chaveDaFaixa(m.titulo, m.artista),
            em: agora,
          }));
          const anteriores = (s.sugeridasPorVibe[vibeId] ?? []).filter(
            (f) => !novas.some((n) => n.chave === f.chave),
          );
          return {
            sugeridasPorVibe: {
              ...s.sugeridasPorVibe,
              [vibeId]: [...novas, ...anteriores].slice(0, TETO_SUGERIDAS_POR_VIBE),
            },
          };
        }),

      artistasFrequentes: (n = 8) => {
        const agora = Date.now();
        const peso = new Map<string, number>();
        for (const e of get().escolhas) {
          const artista = e.artista.trim();
          if (!artista) continue;
          peso.set(artista, (peso.get(artista) ?? 0) + pesoDe(e, agora));
        }
        return [...peso.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, n)
          .map(([artista]) => artista);
      },

      faixasSugeridasRecentes: (vibeId, n = 20) =>
        (get().sugeridasPorVibe[vibeId] ?? []).slice(0, n).map((f) => f.chave),

      faixasEscolhidasRecentes: (n = 20) =>
        get()
          .escolhas.slice(0, n)
          .map((e) => chaveDaFaixa(e.titulo, e.artista)),

      limpar: () => set({ escolhas: [], sugeridasPorVibe: {} }),
    }),
    {
      name: 'synesthesia-gosto',
      storage: createJSONStorage(() => AsyncStorage),
      // Métodos não vão para o disco; só os dois campos de dado.
      partialize: (s) => ({
        escolhas: s.escolhas,
        sugeridasPorVibe: s.sugeridasPorVibe,
      }),
    },
  ),
);

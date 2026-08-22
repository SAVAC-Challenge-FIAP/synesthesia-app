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
/**
 * Lista de bloqueio — o prompt injeta ~20 dela.
 *
 * Deixou de ser por vibe na feature 005 (D3): com vibe livre não há chave fixa
 * por onde agrupar. O caminho principal já vivia sem o agrupamento — a análise
 * por foto sempre usou a lista global, porque a vibe ainda não existe no
 * momento do pedido. A feature só formalizou isso.
 */
const TETO_SUGERIDAS = 40;
/** Quantas escolhas reais vão ao prompt (FR-033) — teto pedido pelo Sávio. */
const TETO_GOSTO_NO_PROMPT = 20;

export interface EscolhaMusical {
  faixaId: string;
  titulo: string;
  artista: string;
  /**
   * Gênero da faixa (T074). É o que permite generalizar: saber que ela escolheu
   * Skillet vale menos do que saber que ela escolhe **rock** — o artista não se
   * repete, o gênero sim. Vem do Gemini junto da sugestão, sem chamada extra.
   */
  genero?: string;
  /**
   * @deprecated Legado da feature 003. Continua **gravado** por compatibilidade
   * — apagá-lo exigiria reescrever dado persistido sem ganho —, mas não é mais
   * lido: com vibe livre, agrupar escolhas por vibe deixou de fazer sentido
   * (feature 005, D3).
   */
  vibeId?: VibeId;
  /** `manual` = trocou no MusicSheet; `auto` = aceitou o que o sistema pôs. */
  origem: 'auto' | 'manual';
  em: number;
}

interface FaixaSugerida {
  chave: string;
  em: number;
}

/**
 * Uma escolha real, no formato que vai ao prompt (FR-033).
 *
 * O Sávio pediu nome, gênero e banda — é exatamente isto. Lista bruta por
 * recência, não agregação por peso: `generosFrequentes` responde "o que ela
 * mais gosta", esta responde "o que ela escolheu por último", e o prompt quer a
 * segunda pergunta.
 */
export interface GostoMusical {
  titulo: string;
  artista: string;
  genero?: string;
}

interface TasteState {
  escolhas: EscolhaMusical[];
  /** Lista única, sem agrupamento — a vibe deixou de ser chave (feature 005). */
  sugeridas: FaixaSugerida[];

  registrarEscolha: (
    musica: MusicSuggestion,
    vibeId: VibeId | undefined,
    origem: 'auto' | 'manual',
  ) => void;
  registrarSugeridas: (sugestoes: MusicSuggestion[]) => void;

  /** Artistas mais escolhidos, do mais forte para o mais fraco. */
  artistasFrequentes: (n?: number) => string[];
  /** Gêneros mais escolhidos — a generalização que o T074 pede. */
  generosFrequentes: (n?: number) => string[];
  /** Chaves `titulo — artista` já sugeridas, das mais recentes. */
  faixasSugeridasRecentes: (n?: number) => string[];
  /**
   * As N últimas escolhas reais, para o prompt (FR-033). Não confundir com
   * `artistasFrequentes`/`generosFrequentes`, que agregam por peso: aqui é
   * lista bruta ordenada por recência, que é o que a spec pede.
   */
  ultimasEscolhas: (n?: number) => GostoMusical[];
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
      sugeridas: [],

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
            genero: musica.genero ?? anterior?.genero,
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

      registrarSugeridas: (sugestoes) =>
        set((s) => {
          const agora = Date.now();
          const novas = sugestoes.map((m) => ({
            chave: chaveDaFaixa(m.titulo, m.artista),
            em: agora,
          }));
          const anteriores = s.sugeridas.filter(
            (f) => !novas.some((n) => n.chave === f.chave),
          );
          return { sugeridas: [...novas, ...anteriores].slice(0, TETO_SUGERIDAS) };
        }),

      generosFrequentes: (n = 4) => {
        const agora = Date.now();
        const peso = new Map<string, number>();
        for (const e of get().escolhas) {
          const g = e.genero?.trim().toLowerCase();
          if (!g) continue;
          peso.set(g, (peso.get(g) ?? 0) + pesoDe(e, agora));
        }
        return [...peso.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, n)
          .map(([g]) => g);
      },

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

      faixasSugeridasRecentes: (n = TETO_GOSTO_NO_PROMPT) =>
        get().sugeridas.slice(0, n).map((f) => f.chave),

      ultimasEscolhas: (n = TETO_GOSTO_NO_PROMPT) =>
        get()
          .escolhas.slice(0, n)
          .map((e) => ({ titulo: e.titulo, artista: e.artista, genero: e.genero })),

      faixasEscolhidasRecentes: (n = 20) =>
        get()
          .escolhas.slice(0, n)
          .map((e) => chaveDaFaixa(e.titulo, e.artista)),

      limpar: () => set({ escolhas: [], sugeridas: [] }),
    }),
    {
      name: 'synesthesia-gosto',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      /**
       * v0 → v1 (feature 005): `sugeridasPorVibe` achatado em `sugeridas`.
       *
       * É lista de bloqueio, não histórico de gosto — perdê-la não teria
       * consequência real. Mas achatar é trivial e evita a lista voltar vazia
       * na primeira captura pós-atualização, que faria o modelo repetir de
       * imediato as faixas que acabou de sugerir.
       *
       * `escolhas` atravessa intacta: o `vibeId` de cada registro fica gravado
       * e simplesmente deixa de ser lido (D3).
       */
      migrate: (persistido, versao) => {
        const estado = (persistido ?? {}) as Partial<TasteState> & {
          sugeridasPorVibe?: Record<string, FaixaSugerida[]>;
        };
        if (versao >= 1 || !estado.sugeridasPorVibe) return estado as TasteState;
        const vistas = new Set<string>();
        const sugeridas = Object.values(estado.sugeridasPorVibe)
          .flat()
          .sort((a, b) => b.em - a.em)
          .filter((f) => (vistas.has(f.chave) ? false : (vistas.add(f.chave), true)))
          .slice(0, TETO_SUGERIDAS);
        const { sugeridasPorVibe: _obsoleto, ...resto } = estado;
        return { ...resto, sugeridas } as TasteState;
      },
      // Métodos não vão para o disco; só os dois campos de dado.
      partialize: (s) => ({
        escolhas: s.escolhas,
        sugeridas: s.sugeridas,
      }),
    },
  ),
);

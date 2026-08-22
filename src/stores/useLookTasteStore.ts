import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AjustesLook, FilterId, LookRecipe, VibeId } from '@/types';

/**
 * Histórico de gosto **visual** — só no aparelho (feature 003, US2).
 *
 * Espelha `useTasteStore`, que faz o mesmo para música, com os mesmos parâmetros
 * já validados lá. Store separada de propósito (D3): o gosto musical é
 * persistido sob outra chave, tem regime de privacidade próprio documentado e
 * migração própria; misturar os dois num blob só complicaria as três coisas sem
 * ganhar nada.
 *
 * ⚠️ **LGPD — mudou na feature 005.** Até a 003 este dado **não saía do
 * aparelho** (FR-014). O FR-033 da feature 005 reverte isso por decisão
 * expressa do Sávio — "e do mesmo jeito para o filtro: guardamos o filtro x com
 * esses valores e enviamos uma lista para o Gemini" —, a mesma decisão que o
 * T074 já tinha tomado para o gosto musical.
 *
 * O que passa a sair: as **20 últimas** escolhas (`ultimosTratamentos`), como
 * base + ajustes + nome. O que continua sem sair: o histórico inteiro, os
 * pesos e as datas.
 *
 * O comentário antigo foi reescrito no mesmo commit que passou a enviar a
 * lista, de propósito: código que documenta uma garantia que ele não cumpre
 * mais é pior que código sem comentário nenhum.
 *
 * `preferido()` continua sendo consumido **só localmente**, por
 * `lookDeAfinidade()`. Isso não é privacidade, é confiabilidade: a afinidade
 * vira consulta a um dado que o app tem, não palpite de um modelo que nunca viu
 * o histórico.
 */

/** Peso de uma troca explícita — ela recusou o que estava aplicado e escolheu outro. */
const PESO_MANUAL = 3;
const PESO_AUTO = 1;
/** Meia-vida da relevância de uma escolha, em dias. */
const MEIA_VIDA_DIAS = 30;
/** Histórico de gosto, não log de auditoria: um teto modesto basta. */
const TETO_ESCOLHAS = 200;

/**
 * Limiar de afinidade (FR-015). São **dois** critérios, e os dois precisam
 * passar: peso acumulado e número de escolhas.
 *
 * Só o peso não bastaria — uma única troca manual já dá 3.0 e passaria sozinha,
 * e o edge case da spec é explícito em que "uma escolha isolada não é gosto
 * estabelecido". Só a contagem também não: duas escolhas de meses atrás já
 * decaíram e não deveriam mandar na sugestão de hoje.
 *
 * Na feature 005 passaram a ser avaliados sobre o histórico **inteiro**, e não
 * sobre o recorte de uma vibe: com vibe livre não há recorte possível. A
 * intenção original está preservada — ela era sobre volume de sinal, nunca
 * sobre vibe — e de quebra fica mais robusta, por deixar de fragmentar o sinal
 * em oito baldes.
 */
const LIMIAR_PESO = 2;
const LIMIAR_ESCOLHAS = 2;

export interface EscolhaVisual {
  /**
   * `null` = "sem tratamento". É uma escolha legítima, não ausência de dado —
   * a spec trata a foto original como opção de primeira classe, e registrá-la
   * como vazio faria o app aprender o oposto do que a pessoa disse.
   */
  base: FilterId | null;
  ajustes: AjustesLook;
  nome: string;
  /**
   * @deprecated Legado da feature 003. Continua **gravado** por compatibilidade
   * — reescrever dado persistido sem ganho seria risco à toa —, mas não é mais
   * lido: com vibe livre, agrupar escolhas por vibe deixou de fazer sentido
   * (feature 005, D3).
   */
  vibeId?: VibeId;
  /** `manual` = trocou o look/filtro; `auto` = aceitou o que já estava. */
  origem: 'auto' | 'manual';
  em: number;
}

/**
 * Identidade de um tratamento: âncora + ajustes arredondados.
 *
 * Mora aqui, e não em `looks.ts`, para que `looks.ts` possa importar a store sem
 * import circular. O `nome` fica de fora de propósito — dois looks com nomes
 * diferentes e a mesma receita são o mesmo look.
 */
export function chaveDaEscolha(base: FilterId | null, ajustes: AjustesLook | undefined): string {
  const a = ajustes ?? {};
  const n = (v: number | undefined) => (v ?? 0).toFixed(2);
  return [base ?? 'original', n(a.brilho), n(a.saturacao), n(a.contraste), n(a.sepia), n(a.veu)].join(
    ':',
  );
}

function pesoDe(escolha: EscolhaVisual, agora: number): number {
  const base = escolha.origem === 'manual' ? PESO_MANUAL : PESO_AUTO;
  const idadeDias = Math.max(0, (agora - escolha.em) / 86_400_000);
  return base * 0.5 ** (idadeDias / MEIA_VIDA_DIAS);
}

export interface PreferenciaVisual {
  base: FilterId | null;
  ajustes: AjustesLook;
  nome: string;
  peso: number;
}

/**
 * Um tratamento escolhido, no formato que vai ao prompt (FR-033).
 *
 * Sem peso e sem data: o modelo recebe *o que* foi escolhido, na ordem em que
 * foi, e nada além disso.
 */
export interface GostoVisual {
  base: FilterId | null;
  ajustes: AjustesLook;
  nome: string;
}

interface LookTasteState {
  escolhas: EscolhaVisual[];

  /** `look === null` registra "sem tratamento", que é uma escolha, não um vazio. */
  registrarEscolha: (
    look: LookRecipe | null,
    vibeId: VibeId | undefined,
    origem: 'auto' | 'manual',
  ) => void;

  /**
   * O tratamento mais forte do histórico, **ou `null`** quando ele ainda não
   * tem sinal suficiente. Devolver `null` é o comportamento correto, não uma
   * falha: melhor um slot de cena do que um rótulo de afinidade mentindo.
   */
  preferido: () => PreferenciaVisual | null;

  /** Os N últimos tratamentos escolhidos, para o prompt (FR-033). */
  ultimosTratamentos: (n?: number) => GostoVisual[];

  limpar: () => void;
}

/** Quantos tratamentos vão ao prompt (FR-033) — teto pedido pelo Sávio. */
const TETO_GOSTO_NO_PROMPT = 20;

export const useLookTasteStore = create<LookTasteState>()(
  persist(
    (set, get) => ({
      escolhas: [],

      registrarEscolha: (look, vibeId, origem) =>
        set((s) => {
          const chave = chaveDaEscolha(look?.base ?? null, look?.ajustes);
          // Dedupe só pela receita desde a feature 005: o mesmo tratamento
          // escolhido em cenas diferentes é o mesmo gosto, e antes virava uma
          // entrada por vibe — o que diluía o sinal em vez de somá-lo.
          const anterior = s.escolhas.find(
            (e) => chaveDaEscolha(e.base, e.ajustes) === chave,
          );
          const nova: EscolhaVisual = {
            base: look?.base ?? null,
            ajustes: look?.ajustes ?? {},
            nome: look?.nome ?? 'Original',
            vibeId,
            // `manual` nunca é rebaixado para `auto` — mesma regra do gosto
            // musical: trocar o look e então salvar é o caminho normal, e
            // rebaixar apagaria justamente o sinal forte.
            origem: anterior?.origem === 'manual' ? 'manual' : origem,
            em: Date.now(),
          };
          const semDuplicata = s.escolhas.filter(
            (e) => chaveDaEscolha(e.base, e.ajustes) !== chave,
          );
          console.log(
            `[gosto-visual] escolha ${nova.origem} «${nova.nome}» base=${nova.base ?? 'original'} ` +
              `vibe=${vibeId} total=${semDuplicata.length + 1}`,
          );
          return { escolhas: [nova, ...semDuplicata].slice(0, TETO_ESCOLHAS) };
        }),

      preferido: () => {
        const agora = Date.now();
        const todas = get().escolhas;
        if (todas.length < LIMIAR_ESCOLHAS) return null;

        const acumulado = new Map<string, PreferenciaVisual>();
        for (const e of todas) {
          const chave = chaveDaEscolha(e.base, e.ajustes);
          const atual = acumulado.get(chave);
          const peso = (atual?.peso ?? 0) + pesoDe(e, agora);
          acumulado.set(chave, { base: e.base, ajustes: e.ajustes, nome: e.nome, peso });
        }

        const vencedor = [...acumulado.values()].sort((a, b) => b.peso - a.peso)[0];
        if (!vencedor || vencedor.peso < LIMIAR_PESO) return null;
        return vencedor;
      },

      ultimosTratamentos: (n = TETO_GOSTO_NO_PROMPT) =>
        get()
          .escolhas.slice(0, n)
          .map((e) => ({ base: e.base, ajustes: e.ajustes, nome: e.nome })),

      limpar: () => set({ escolhas: [] }),
    }),
    {
      name: 'synesthesia-gosto-visual',
      storage: createJSONStorage(() => AsyncStorage),
      // Métodos não vão para o disco; só o campo de dado.
      partialize: (s) => ({ escolhas: s.escolhas }),
    },
  ),
);

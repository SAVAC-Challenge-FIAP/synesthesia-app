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
 * ⚠️ **LGPD — este dado não sai do aparelho** (FR-014). Ao contrário do gosto
 * musical, que o Sávio autorizou expressamente a entrar no prompt no T074, o
 * gosto visual é consumido **apenas** por `lookDeAfinidade()` em `looks.ts`,
 * localmente. E não é só privacidade: é o que torna a afinidade confiável, já
 * que ela vira consulta a um dado que o app tem, não palpite de um modelo que
 * nunca viu o histórico.
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
  vibeId: VibeId;
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

interface LookTasteState {
  escolhas: EscolhaVisual[];

  /** `look === null` registra "sem tratamento", que é uma escolha, não um vazio. */
  registrarEscolha: (look: LookRecipe | null, vibeId: VibeId, origem: 'auto' | 'manual') => void;

  /**
   * O tratamento mais forte para aquela vibe, **ou `null`** quando o histórico
   * ainda não tem sinal suficiente. Devolver `null` é o comportamento correto,
   * não uma falha: melhor um slot de cena do que um rótulo de afinidade mentindo.
   */
  preferidoDaVibe: (vibeId: VibeId) => PreferenciaVisual | null;

  limpar: () => void;
}

export const useLookTasteStore = create<LookTasteState>()(
  persist(
    (set, get) => ({
      escolhas: [],

      registrarEscolha: (look, vibeId, origem) =>
        set((s) => {
          const chave = chaveDaEscolha(look?.base ?? null, look?.ajustes);
          const anterior = s.escolhas.find(
            (e) => chaveDaEscolha(e.base, e.ajustes) === chave && e.vibeId === vibeId,
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
            (e) => !(chaveDaEscolha(e.base, e.ajustes) === chave && e.vibeId === vibeId),
          );
          console.log(
            `[gosto-visual] escolha ${nova.origem} «${nova.nome}» base=${nova.base ?? 'original'} ` +
              `vibe=${vibeId} total=${semDuplicata.length + 1}`,
          );
          return { escolhas: [nova, ...semDuplicata].slice(0, TETO_ESCOLHAS) };
        }),

      preferidoDaVibe: (vibeId) => {
        const agora = Date.now();
        const daVibe = get().escolhas.filter((e) => e.vibeId === vibeId);
        if (daVibe.length < LIMIAR_ESCOLHAS) return null;

        const acumulado = new Map<string, PreferenciaVisual>();
        for (const e of daVibe) {
          const chave = chaveDaEscolha(e.base, e.ajustes);
          const atual = acumulado.get(chave);
          const peso = (atual?.peso ?? 0) + pesoDe(e, agora);
          acumulado.set(chave, { base: e.base, ajustes: e.ajustes, nome: e.nome, peso });
        }

        const vencedor = [...acumulado.values()].sort((a, b) => b.peso - a.peso)[0];
        if (!vencedor || vencedor.peso < LIMIAR_PESO) return null;
        return vencedor;
      },

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

/**
 * @docs docs/adr/0011-privacidade-e-historico-lgpd.md
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { AjustesLook, FilterId, LookRecipe, VibeId } from "@/types";

const PESO_MANUAL = 3;
const PESO_AUTO = 1;
const MEIA_VIDA_DIAS = 30;
const TETO_ESCOLHAS = 200;

const LIMIAR_PESO = 2;
const LIMIAR_ESCOLHAS = 2;

export interface EscolhaVisual {
  base: FilterId | null;
  ajustes: AjustesLook;
  nome: string;
  vibeId?: VibeId;
  origem: "auto" | "manual";
  em: number;
}

export function chaveDaEscolha(
  base: FilterId | null,
  ajustes: AjustesLook | undefined,
): string {
  const a = ajustes ?? {};
  const n = (v: number | undefined) => (v ?? 0).toFixed(2);
  return [
    base ?? "original",
    n(a.brilho),
    n(a.saturacao),
    n(a.contraste),
    n(a.sepia),
    n(a.veu),
  ].join(":");
}

function pesoDe(escolha: EscolhaVisual, agora: number): number {
  const base = escolha.origem === "manual" ? PESO_MANUAL : PESO_AUTO;
  const idadeDias = Math.max(0, (agora - escolha.em) / 86_400_000);
  return base * 0.5 ** (idadeDias / MEIA_VIDA_DIAS);
}

export interface PreferenciaVisual {
  base: FilterId | null;
  ajustes: AjustesLook;
  nome: string;
  peso: number;
}

export interface GostoVisual {
  base: FilterId | null;
  ajustes: AjustesLook;
  nome: string;
}

interface LookTasteState {
  escolhas: EscolhaVisual[];

  registrarEscolha: (
    look: LookRecipe | null,
    vibeId: VibeId | undefined,
    origem: "auto" | "manual",
  ) => void;

  preferido: () => PreferenciaVisual | null;

  ultimosTratamentos: (n?: number) => GostoVisual[];

  limpar: () => void;
}

const TETO_GOSTO_NO_PROMPT = 20;

export const useLookTasteStore = create<LookTasteState>()(
  persist(
    (set, get) => ({
      escolhas: [],

      registrarEscolha: (look, vibeId, origem) =>
        set((s) => {
          const chave = chaveDaEscolha(look?.base ?? null, look?.ajustes);

          const anterior = s.escolhas.find(
            (e) => chaveDaEscolha(e.base, e.ajustes) === chave,
          );
          const nova: EscolhaVisual = {
            base: look?.base ?? null,
            ajustes: look?.ajustes ?? {},
            nome: look?.nome ?? "Original",
            vibeId,

            origem: anterior?.origem === "manual" ? "manual" : origem,
            em: Date.now(),
          };
          const semDuplicata = s.escolhas.filter(
            (e) => chaveDaEscolha(e.base, e.ajustes) !== chave,
          );
          console.log(
            `[gosto-visual] escolha ${nova.origem} «${nova.nome}» base=${nova.base ?? "original"} ` +
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
          acumulado.set(chave, {
            base: e.base,
            ajustes: e.ajustes,
            nome: e.nome,
            peso,
          });
        }

        const vencedor = [...acumulado.values()].sort(
          (a, b) => b.peso - a.peso,
        )[0];
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
      name: "synesthesia-gosto-visual",
      storage: createJSONStorage(() => AsyncStorage),

      partialize: (s) => ({ escolhas: s.escolhas }),
    },
  ),
);

/**
 * @docs docs/adr/0011-privacidade-e-historico-lgpd.md
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { MusicSuggestion, VibeId } from "@/types";

const PESO_MANUAL = 3;
const PESO_AUTO = 1;
const MEIA_VIDA_DIAS = 30;

const TETO_ESCOLHAS = 200;
const TETO_SUGERIDAS = 40;
const TETO_GOSTO_NO_PROMPT = 20;

export interface EscolhaMusical {
  faixaId: string;
  titulo: string;
  artista: string;
  genero?: string;
  vibeId?: VibeId;
  origem: "auto" | "manual";
  em: number;
}

interface FaixaSugerida {
  chave: string;
  em: number;
}

export interface GostoMusical {
  titulo: string;
  artista: string;
  genero?: string;
}

interface TasteState {
  escolhas: EscolhaMusical[];
  sugeridas: FaixaSugerida[];

  registrarEscolha: (
    musica: MusicSuggestion,
    vibeId: VibeId | undefined,
    origem: "auto" | "manual",
  ) => void;
  registrarSugeridas: (sugestoes: MusicSuggestion[]) => void;

  artistasFrequentes: (n?: number) => string[];
  generosFrequentes: (n?: number) => string[];
  faixasSugeridasRecentes: (n?: number) => string[];
  ultimasEscolhas: (n?: number) => GostoMusical[];
  faixasEscolhidasRecentes: (n?: number) => string[];

  limpar: () => void;
}

export function chaveDaFaixa(titulo: string, artista: string): string {
  return `${titulo.trim().toLowerCase()} — ${artista.trim().toLowerCase()}`;
}

function pesoDe(escolha: EscolhaMusical, agora: number): number {
  const base = escolha.origem === "manual" ? PESO_MANUAL : PESO_AUTO;
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

            origem: anterior?.origem === "manual" ? "manual" : origem,
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
          return {
            sugeridas: [...novas, ...anteriores].slice(0, TETO_SUGERIDAS),
          };
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
        get()
          .sugeridas.slice(0, n)
          .map((f) => f.chave),

      ultimasEscolhas: (n = TETO_GOSTO_NO_PROMPT) =>
        get()
          .escolhas.slice(0, n)
          .map((e) => ({
            titulo: e.titulo,
            artista: e.artista,
            genero: e.genero,
          })),

      faixasEscolhidasRecentes: (n = 20) =>
        get()
          .escolhas.slice(0, n)
          .map((e) => chaveDaFaixa(e.titulo, e.artista)),

      limpar: () => set({ escolhas: [], sugeridas: [] }),
    }),
    {
      name: "synesthesia-gosto",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistido, versao) => {
        const estado = (persistido ?? {}) as Partial<TasteState> & {
          sugeridasPorVibe?: Record<string, FaixaSugerida[]>;
        };
        if (versao >= 1 || !estado.sugeridasPorVibe)
          return estado as TasteState;
        const vistas = new Set<string>();
        const sugeridas = Object.values(estado.sugeridasPorVibe)
          .flat()
          .sort((a, b) => b.em - a.em)
          .filter((f) =>
            vistas.has(f.chave) ? false : (vistas.add(f.chave), true),
          )
          .slice(0, TETO_SUGERIDAS);
        const { sugeridasPorVibe: _obsoleto, ...resto } = estado;
        return { ...resto, sugeridas } as TasteState;
      },

      partialize: (s) => ({
        escolhas: s.escolhas,
        sugeridas: s.sugeridas,
      }),
    },
  ),
);

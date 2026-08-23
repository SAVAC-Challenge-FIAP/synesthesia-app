/**
 * @docs docs/adr/0011-privacidade-e-historico-lgpd.md
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  filtroAutomatico: boolean;
  deteccaoTempoReal: boolean;
  gradeComposicao: boolean;
  sugestaoAutomatica: boolean;
  usarLocalizacao: boolean;
  fonteAudio: "deezer";
  metadadosAnonimos: boolean;
  toggle: (
    key:
      | "filtroAutomatico"
      | "deteccaoTempoReal"
      | "gradeComposicao"
      | "sugestaoAutomatica"
      | "usarLocalizacao"
      | "metadadosAnonimos",
  ) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      filtroAutomatico: true,
      deteccaoTempoReal: true,
      gradeComposicao: false,
      sugestaoAutomatica: true,
      usarLocalizacao: true,
      fonteAudio: "deezer",
      metadadosAnonimos: false,
      toggle: (key) =>
        set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
    }),
    {
      name: "synesthesia-ajustes",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

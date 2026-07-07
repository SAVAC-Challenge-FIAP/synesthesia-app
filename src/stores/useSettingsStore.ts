import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Preferências do ecossistema (tela Ajustes) + opt-in LGPD de metadados.
 * Persistidas entre sessões (FR-010, FR-015).
 */
interface SettingsState {
  filtroAutomatico: boolean;
  deteccaoTempoReal: boolean;
  gradeComposicao: boolean;
  sugestaoAutomatica: boolean;
  fonteAudio: 'deezer';
  metadadosAnonimos: boolean;
  toggle: (
    key:
      | 'filtroAutomatico'
      | 'deteccaoTempoReal'
      | 'gradeComposicao'
      | 'sugestaoAutomatica'
      | 'metadadosAnonimos',
  ) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      filtroAutomatico: true,
      deteccaoTempoReal: true,
      gradeComposicao: false,
      sugestaoAutomatica: true,
      fonteAudio: 'deezer',
      metadadosAnonimos: false,
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
    }),
    {
      name: 'synesthesia-ajustes',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

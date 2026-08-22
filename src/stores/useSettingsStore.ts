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
  /**
   * Autoriza enviar a **cidade** ao Gemini junto da foto (FR-034).
   *
   * Nasce **ligado** (decisão do Sávio, 2026-08-22 — emenda 1.2.0 da
   * constituição). O consentimento não vem deste default e sim do **onboarding**,
   * onde a localização é apresentada num card próprio, com justificativa, antes
   * de o sistema pedir a permissão: quem recusa ali nunca tem lugar enviado,
   * porque sem permissão do SO não há o que enviar.
   *
   * O flag continua sendo a via de **revogação** exigida pelo Princípio IV —
   * desligar nos Ajustes corta o envio na hora, sem depender de mexer nas
   * configurações do sistema.
   *
   * O que trafega é `"Santos, SP"`, nunca coordenada (D5).
   */
  usarLocalizacao: boolean;
  fonteAudio: 'deezer';
  metadadosAnonimos: boolean;
  toggle: (
    key:
      | 'filtroAutomatico'
      | 'deteccaoTempoReal'
      | 'gradeComposicao'
      | 'sugestaoAutomatica'
      | 'usarLocalizacao'
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
      usarLocalizacao: true,
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

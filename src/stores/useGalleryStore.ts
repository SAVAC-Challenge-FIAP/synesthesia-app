import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deleteAudio, deletePhoto } from '@/services/mediaStorage';
import { Media } from '@/types';

/**
 * Galeria persistente — cada Media é o "pacote sensorial" completo
 * (imagem + filtro + música + trecho), nunca quebrado (RN-001, FR-011).
 */
interface GalleryState {
  medias: Media[];
  add: (media: Media) => void;
  update: (id: string, patch: Partial<Media>) => void;
  remove: (id: string) => void;
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set, get) => ({
      medias: [],
      add: (media) => set((s) => ({ medias: [media, ...s.medias] })),
      update: (id, patch) =>
        set((s) => ({
          medias: s.medias.map((m) =>
            m.id === id ? { ...m, ...patch, atualizadaEm: Date.now() } : m,
          ),
        })),
      remove: (id) => {
        const media = get().medias.find((m) => m.id === id);
        if (media) {
          deletePhoto(media.photoUri);
          // A trilha local é parte do pacote (T102): apagar o momento apaga as
          // duas metades, senão o .mp3 fica órfão ocupando disco para sempre.
          if (media.audioUri) deleteAudio(media.audioUri);
        }
        set((s) => ({ medias: s.medias.filter((m) => m.id !== id) }));
      },
    }),
    {
      name: 'synesthesia-galeria',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

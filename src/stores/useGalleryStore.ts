/**
 * @docs docs/components/useGalleryStore.md
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { deleteAudio, deletePhoto } from "@/services/mediaStorage";
import { Media } from "@/types";

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

          if (media.audioUri) deleteAudio(media.audioUri);
        }
        set((s) => ({ medias: s.medias.filter((m) => m.id !== id) }));
      },
    }),
    {
      name: "synesthesia-galeria",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

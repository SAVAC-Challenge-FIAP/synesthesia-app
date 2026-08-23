/**
 * @docs docs/components/sharePackage.md
 */
import { File, Paths } from "expo-file-system";

import { muxImageAndAudio } from "@/services/videoMuxer";
import { MusicSuggestion } from "@/types";

export interface SharePackage {
  videoUri: string | null;
  imageUri: string;
  audioUri: string | null;
  caption: string | null;
  musica: MusicSuggestion | null;
}

function formatSeconds(s: number): string {
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function buildCaption(
  musica: MusicSuggestion,
  trechoInicio: number,
  trechoFim: number,
): string {
  return (
    `🎵 Trilha: “${musica.titulo}” — ${musica.artista}` +
    ` (trecho ${formatSeconds(trechoInicio)}–${formatSeconds(trechoFim)})` +
    " · criado com Synesthesia"
  );
}

async function downloadAudioPreview(
  musica: MusicSuggestion,
): Promise<string | null> {
  if (!musica.previewUrl) return null;
  try {
    const dest = new File(Paths.cache, `synesthesia-trilha-${musica.id}.mp3`);
    if (dest.exists) return dest.uri;
    const file = await File.downloadFileAsync(musica.previewUrl, dest);
    return file.uri;
  } catch {
    return null;
  }
}

export async function exportPackage(params: {
  imageUri: string;
  musica: MusicSuggestion | null;
  trechoInicio: number;
  trechoFim: number;
  onProgresso?: (progresso: number) => void;
}): Promise<SharePackage> {
  const { imageUri, musica, trechoInicio, trechoFim, onProgresso } = params;
  if (!musica) {
    return {
      videoUri: null,
      imageUri,
      audioUri: null,
      caption: null,
      musica: null,
    };
  }
  const audioUri = await downloadAudioPreview(musica);
  const videoUri = audioUri
    ? await muxImageAndAudio({
        imageUri,
        audioUri,
        durationSeconds: Math.max(1, trechoFim - trechoInicio),
        onProgresso,
      })
    : null;
  return {
    videoUri,
    imageUri,
    audioUri,
    caption: buildCaption(musica, trechoInicio, trechoFim),
    musica,
  };
}

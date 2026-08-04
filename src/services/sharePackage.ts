import { File, Paths } from 'expo-file-system';

import { muxImageAndAudio } from '@/services/videoMuxer';
import { MusicSuggestion } from '@/types';

/**
 * Exportação do pacote sensorial (T-01 / FR-013, RN-001).
 *
 * Decisão registrada em specs/001-synesthesia-mvp/plan.md (T-01a): no Expo Go
 * não existe muxer nativo (FFmpeg), então o `.mp4` único imagem+áudio é
 * impossível ali — é por isso que `videoUri` some no Expo Go e só aparece em
 * development build, onde `modules/video-muxer` (T-07, MediaMuxer/MediaCodec)
 * consegue gerá-lo. Sem ele (Expo Go, ou qualquer falha de encoding), o
 * pacote compartilhável mais fiel ao Princípio I é composto: imagem
 * renderizada + arquivo de áudio da prévia (30s, Deezer) + legenda com a
 * trilha e o trecho aprovados.
 */

export interface SharePackage {
  /** `.mp4` imagem+áudio — só existirá no development build (T-07/FFmpeg) */
  videoUri: string | null;
  /** Imagem com o filtro aplicado (ou a foto pura, sem filtro) */
  imageUri: string;
  /** Arquivo local .mp3 da prévia de 30s — null se sem música ou download falhou */
  audioUri: string | null;
  /** Legenda pronta com trilha + trecho, para acompanhar a postagem */
  caption: string | null;
  musica: MusicSuggestion | null;
}

function formatSeconds(s: number): string {
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Legenda que carrega a metade sonora do pacote na postagem. */
export function buildCaption(
  musica: MusicSuggestion,
  trechoInicio: number,
  trechoFim: number
): string {
  return (
    `🎵 Trilha: “${musica.titulo}” — ${musica.artista}` +
    ` (trecho ${formatSeconds(trechoInicio)}–${formatSeconds(trechoFim)})` +
    ' · criado com Synesthesia'
  );
}

/**
 * Baixa a prévia de 30s da faixa para o cache e devolve a URI local,
 * pronta para o share intent. Best-effort: qualquer falha devolve null
 * (o pacote degrada para imagem + legenda — nunca bloqueia a postagem).
 */
async function downloadAudioPreview(musica: MusicSuggestion): Promise<string | null> {
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

/** Monta o pacote compartilhável a partir da sessão aprovada. */
export async function exportPackage(params: {
  imageUri: string;
  musica: MusicSuggestion | null;
  trechoInicio: number;
  trechoFim: number;
}): Promise<SharePackage> {
  const { imageUri, musica, trechoInicio, trechoFim } = params;
  if (!musica) {
    return { videoUri: null, imageUri, audioUri: null, caption: null, musica: null };
  }
  const audioUri = await downloadAudioPreview(musica);
  const videoUri = audioUri
    ? await muxImageAndAudio({
        imageUri,
        audioUri,
        durationSeconds: Math.max(1, trechoFim - trechoInicio),
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

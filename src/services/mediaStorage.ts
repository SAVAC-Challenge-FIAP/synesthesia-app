/**
 * @docs docs/components/mediaStorage.md
 */
import { Directory, File, Paths } from "expo-file-system";

const GALLERY_DIR = "galeria";

function galleryDir(): Directory {
  const dir = new Directory(Paths.document, GALLERY_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function persistPhoto(cacheUri: string, mediaId: string): string {
  const src = new File(cacheUri);
  const ext = cacheUri.split(".").pop() ?? "jpg";
  const dest = new File(galleryDir(), `${mediaId}.${ext}`);
  if (dest.exists) dest.delete();
  src.copy(dest);
  return dest.uri;
}

export async function persistAudioPreview(
  previewUrl: string | null,
  mediaId: string,
): Promise<string | null> {
  if (!previewUrl) return null;
  try {
    const dest = new File(galleryDir(), `${mediaId}.mp3`);
    if (dest.exists) dest.delete();
    const file = await File.downloadFileAsync(previewUrl, dest);
    return file.uri;
  } catch {
    return null;
  }
}

export async function cacheAudioPreview(
  previewUrl: string | null,
  faixaId: string,
): Promise<string | null> {
  if (!previewUrl) return null;
  try {
    const dest = new File(Paths.cache, `synesthesia-cand-${faixaId}.mp3`);

    if (dest.exists) return dest.uri;
    const file = await File.downloadFileAsync(previewUrl, dest);
    return file.uri;
  } catch {
    return null;
  }
}

export function audioEmCache(faixaId: string): string | null {
  try {
    const f = new File(Paths.cache, `synesthesia-cand-${faixaId}.mp3`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

export function deletePhoto(photoUri: string): void {
  try {
    const file = new File(photoUri);
    if (file.exists) file.delete();
  } catch {}
}

export function deleteAudio(audioUri: string): void {
  try {
    const file = new File(audioUri);
    if (file.exists) file.delete();
  } catch {}
}

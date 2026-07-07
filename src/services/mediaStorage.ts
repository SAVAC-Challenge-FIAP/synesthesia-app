import { Directory, File, Paths } from 'expo-file-system';

/**
 * Persistência física das fotos: copia do cache da câmera para o
 * documentDirectory, garantindo que a mídia sobreviva entre sessões (FR-011).
 */

const GALLERY_DIR = 'galeria';

function galleryDir(): Directory {
  const dir = new Directory(Paths.document, GALLERY_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copia a foto capturada para armazenamento permanente e retorna a URI nova. */
export function persistPhoto(cacheUri: string, mediaId: string): string {
  const src = new File(cacheUri);
  const ext = cacheUri.split('.').pop() ?? 'jpg';
  const dest = new File(galleryDir(), `${mediaId}.${ext}`);
  if (dest.exists) dest.delete();
  src.copy(dest);
  return dest.uri;
}

/** Remove o arquivo físico da foto (exclusão permanente — FR-012). */
export function deletePhoto(photoUri: string): void {
  try {
    const file = new File(photoUri);
    if (file.exists) file.delete();
  } catch {
    // arquivo já removido — o registro na galeria é a fonte de verdade
  }
}

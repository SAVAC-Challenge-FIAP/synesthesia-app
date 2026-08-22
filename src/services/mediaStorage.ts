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

/**
 * Baixa a prévia de 30s da faixa para o armazenamento permanente e devolve a
 * URI local (T102).
 *
 * O `downloadAudioPreview` de `sharePackage.ts` grava em `Paths.cache`, e cache
 * é apagável pelo sistema a qualquer momento — serve para o share intent, que
 * consome o arquivo em seguida, mas não para o registro da galeria, que precisa
 * durar (Pilar 3 / FR-011). Por isso o áudio do momento mora ao lado da foto,
 * em `documentDirectory/galeria/`, e é apagado junto com ela.
 *
 * Best-effort: sem `previewUrl`, sem rede ou com o disco cheio devolve `null` e
 * a mídia é salva sem áudio local — o player degrada para a URL remota em vez
 * de bloquear o salvamento.
 */
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

/**
 * Prévia de uma faixa **candidata**, no cache (T106).
 *
 * Diferente de `persistAudioPreview`: a trilha escolhida é parte do momento e
 * mora no `documentDirectory`, permanente. As outras três sugestões são
 * material de decisão — se o sistema as limpar, nada se perde, e voltar a
 * baixá-las é barato. Por isso `Paths.cache`, que é exatamente o lugar de algo
 * reconstituível.
 *
 * Devolve a URI local, ou `null` em qualquer falha (sem rede, disco cheio).
 */
export async function cacheAudioPreview(
  previewUrl: string | null,
  faixaId: string,
): Promise<string | null> {
  if (!previewUrl) return null;
  try {
    const dest = new File(Paths.cache, `synesthesia-cand-${faixaId}.mp3`);
    // Já em cache: não baixa de novo. É o que torna barato chamar isto sempre
    // que a mídia é reaberta.
    if (dest.exists) return dest.uri;
    const file = await File.downloadFileAsync(previewUrl, dest);
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * Caminho que uma candidata **teria** no cache, se já tiver sido baixada.
 *
 * Consulta síncrona e sem rede: é o que o player usa para decidir, no momento
 * do toque, se toca do disco ou cai para a URL remota.
 */
export function audioEmCache(faixaId: string): string | null {
  try {
    const f = new File(Paths.cache, `synesthesia-cand-${faixaId}.mp3`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
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

/**
 * Remove o .mp3 local da trilha (T102). Mesma tolerância do `deletePhoto`:
 * o registro manda, o arquivo é consequência.
 */
export function deleteAudio(audioUri: string): void {
  try {
    const file = new File(audioUri);
    if (file.exists) file.delete();
  } catch {
    // já removido
  }
}

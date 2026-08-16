import * as MediaLibrary from 'expo-media-library';

/**
 * Acesso à galeria do sistema (expo-media-library) com degradação graciosa.
 *
 * No Expo Go (Android 13+) TODAS as chamadas do módulo rejeitam com CodedError
 * ("Expo Go can no longer provide full access to the media library"). A galeria
 * do sistema é só o destino de EXPORTAÇÃO da foto renderizada — a cópia
 * permanente vive no documentDirectory do app (mediaStorage). Portanto nenhuma
 * falha aqui pode bloquear onboarding, salvar ou compartilhar (RN "nunca
 * perder a foto"). Num development build o módulo volta a funcionar inteiro.
 */

export type SystemGalleryPermission =
  | 'granted'
  | 'denied'
  /** módulo indisponível no runtime atual (Expo Go) — tratar como opcional */
  | 'unavailable';

// Só o que o app de fato grava — pedir a granular certa evita arrastar a
// permissão AUDIO, que não está declarada no manifest.
const GRANULAR: MediaLibrary.GranularPermission[] = ['photo'];
/**
 * Baixar o .mp4 gerado grava **vídeo**, e no Android 13+ isso é outra permissão
 * (T089). Pedindo só `photo`, a chamada era negada, o `catch` engolia o erro e
 * o botão "BAIXAR VÍDEO" ficava para sempre no mesmo estado, sem dizer nada.
 * `READ_MEDIA_VIDEO` já está declarada no manifest, então não muda o build.
 */
const GRANULAR_VIDEO: MediaLibrary.GranularPermission[] = ['photo', 'video'];

function toStatus(p: MediaLibrary.PermissionResponse): SystemGalleryPermission {
  // Android 14+ pode conceder acesso "limitado" — suficiente para exportar
  return p.granted || p.accessPrivileges === 'limited' ? 'granted' : 'denied';
}

export async function checkSystemGalleryPermission(): Promise<SystemGalleryPermission> {
  try {
    return toStatus(await MediaLibrary.getPermissionsAsync(false, GRANULAR));
  } catch {
    return 'unavailable';
  }
}

export async function requestSystemGalleryPermission(
  tipo: 'photo' | 'video' = 'photo',
): Promise<SystemGalleryPermission> {
  try {
    return toStatus(
      await MediaLibrary.requestPermissionsAsync(
        false,
        tipo === 'video' ? GRANULAR_VIDEO : GRANULAR,
      ),
    );
  } catch {
    return 'unavailable';
  }
}

/**
 * Exporta a mídia renderizada para a galeria do sistema. Retorna `false` em
 * qualquer falha (sem permissão, Expo Go) — a mídia segue salva no app.
 *
 * O `tipo` decide qual permissão é pedida; ele **não** é cosmético, é a
 * diferença entre o arquivo aparecer na galeria e a chamada ser negada em
 * silêncio (T089).
 */
export async function saveToSystemGallery(
  localUri: string,
  tipo: 'photo' | 'video' = 'photo',
): Promise<boolean> {
  try {
    if ((await requestSystemGalleryPermission(tipo)) !== 'granted') return false;
    await MediaLibrary.saveToLibraryAsync(localUri);
    return true;
  } catch (e) {
    // Falha aqui nunca bloqueia o fluxo, mas some do rastro se não for dita —
    // foi assim que o download quebrado passou despercebido.
    console.log('[systemGallery] falha ao salvar na galeria do sistema:', e);
    return false;
  }
}

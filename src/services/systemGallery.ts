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

// O app só lê/escreve imagens: pedir a permissão granular 'photo' evita a
// permissão AUDIO, que não está declarada no manifest.
const GRANULAR: MediaLibrary.GranularPermission[] = ['photo'];

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

export async function requestSystemGalleryPermission(): Promise<SystemGalleryPermission> {
  try {
    return toStatus(await MediaLibrary.requestPermissionsAsync(false, GRANULAR));
  } catch {
    return 'unavailable';
  }
}

/**
 * Exporta a imagem renderizada para a galeria do sistema. Retorna `false` em
 * qualquer falha (sem permissão, Expo Go) — a mídia segue salva no app.
 */
export async function saveToSystemGallery(localUri: string): Promise<boolean> {
  try {
    if ((await requestSystemGalleryPermission()) !== 'granted') return false;
    await MediaLibrary.saveToLibraryAsync(localUri);
    return true;
  } catch {
    return false;
  }
}

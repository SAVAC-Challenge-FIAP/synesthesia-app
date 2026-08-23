/**
 * @docs docs/runbooks/armadilhas-conhecidas.md
 */
import * as MediaLibrary from "expo-media-library";

export type SystemGalleryPermission = "granted" | "denied" | "unavailable";

const GRANULAR: MediaLibrary.GranularPermission[] = ["photo"];
const GRANULAR_VIDEO: MediaLibrary.GranularPermission[] = ["photo", "video"];

function toStatus(p: MediaLibrary.PermissionResponse): SystemGalleryPermission {
  return p.granted || p.accessPrivileges === "limited" ? "granted" : "denied";
}

export async function checkSystemGalleryPermission(): Promise<SystemGalleryPermission> {
  try {
    return toStatus(await MediaLibrary.getPermissionsAsync(false, GRANULAR));
  } catch {
    return "unavailable";
  }
}

export async function requestSystemGalleryPermission(
  tipo: "photo" | "video" = "photo",
): Promise<SystemGalleryPermission> {
  try {
    return toStatus(
      await MediaLibrary.requestPermissionsAsync(
        false,
        tipo === "video" ? GRANULAR_VIDEO : GRANULAR,
      ),
    );
  } catch {
    return "unavailable";
  }
}

export async function saveToSystemGallery(
  localUri: string,
  tipo: "photo" | "video" = "photo",
): Promise<boolean> {
  try {
    if ((await requestSystemGalleryPermission(tipo)) !== "granted")
      return false;
    await MediaLibrary.saveToLibraryAsync(localUri);
    return true;
  } catch (e) {
    console.log("[systemGallery] falha ao salvar na galeria do sistema:", e);
    return false;
  }
}

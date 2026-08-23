/**
 * @docs docs/components/skiaBridge.md
 */
import type * as SkiaExports from "@shopify/react-native-skia";

export type SkiaMod = typeof SkiaExports;

let carregando: Promise<SkiaMod | null> | null = null;

export function carregarSkia(): Promise<SkiaMod | null> {
  if (!carregando) {
    carregando = import("@shopify/react-native-skia")
      .then((mod) => mod)
      .catch((error: unknown) => {
        console.warn(
          "[skiaBridge] Skia indisponível (dev build sem rebuild?):",
          error,
        );
        return null;
      });
  }
  return carregando;
}

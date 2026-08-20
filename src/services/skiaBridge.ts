import type * as SkiaExports from '@shopify/react-native-skia';

/**
 * Carga opcional do módulo nativo Skia (feature 003, US3, research R3).
 *
 * `@shopify/react-native-skia` é módulo nativo: o pacote npm pode estar
 * instalado sem que o dev build tenha sido regerado com ele dentro. Um import
 * estático em `FilteredImage.tsx` — usado em toda a foto do app, não só nesta
 * feature — transformaria "ainda não rebuildei" em "o app não abre", e
 * US1/US2/US4 não têm nada a ver com Skia.
 *
 * Por isso o carregamento é dinâmico e memoizado: a primeira chamada tenta o
 * `import()`, guarda a Promise, e qualquer falha (native module ausente,
 * plataforma sem suporte) vira `null` em vez de propagar. Quem chama nunca
 * precisa de try/catch próprio.
 */

export type SkiaMod = typeof SkiaExports;

let carregando: Promise<SkiaMod | null> | null = null;

export function carregarSkia(): Promise<SkiaMod | null> {
  if (!carregando) {
    carregando = import('@shopify/react-native-skia')
      .then((mod) => mod)
      .catch((error: unknown) => {
        console.warn('[skiaBridge] Skia indisponível (dev build sem rebuild?):', error);
        return null;
      });
  }
  return carregando;
}

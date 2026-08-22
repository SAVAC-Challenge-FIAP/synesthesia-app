import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FilterDef } from '@/types';

/**
 * Overlays de cor que dão a identidade do filtro sobre o visor ao vivo ou
 * sobre uma foto.
 *
 * Reavaliado na US3 (T045): com o render de foto por Skia (`FilteredImage`),
 * o overlay virou parte da receita desenhada no Canvas (`renderLook.ts`,
 * `FilteredImageSkia`), e não passa mais por aqui. Este componente continua
 * existindo por dois consumidores que **não** usam Skia: o visor ao vivo em
 * `app/camera.tsx` (FR-021 — sem rede, sem depender de rebuild nativo) e o
 * render legado de foto em `FilteredImage.tsx`, a rede de segurança enquanto
 * o dev build não tiver o módulo nativo do Skia (research R3).
 */
export function FilterLayer({ filter }: { filter: FilterDef }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: filter.overlayColor, opacity: filter.overlayOpacity },
        ]}
      />
      {filter.overlayColor2 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: filter.overlayColor2, opacity: filter.overlayOpacity2 ?? 0.1 },
          ]}
        />
      ) : null}
    </View>
  );
}

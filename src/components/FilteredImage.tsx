import React from 'react';
import {
  FilterFunction,
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { FilterLayer } from '@/components/FilterLayer';
import { filterById, resolverReceita } from '@/constants/filters';
import { FilterId, LookRecipe } from '@/types';

interface Props {
  uri: string;
  /** null = foto original, sem filtro (T-0B) */
  filtroId: FilterId | null;
  /**
   * Receita completa (feature 003). Quando presente, manda: `filtroId` vira
   * apenas a âncora e o render usa o preset base mais os desvios.
   *
   * Os dois convivem porque nem todo chamador tem receita — o visor ao vivo
   * (FR-021), as miniaturas dos 8 presets e as mídias antigas seguem passando
   * só `filtroId`, e isso continua sendo um caminho de primeira classe.
   */
  look?: LookRecipe | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Foto com o tratamento aplicado: style `filter` do RN (brightness/saturate/
 * contrast/sepia — Android integral, iOS parcial) + overlays de identidade.
 * Com `filtroId` nulo e sem `look`, renderiza a imagem pura, como capturada.
 *
 * A parcialidade em iOS é a dívida que a US3 paga trocando este render por
 * Skia; até lá, três looks distintos ficam menos distintos em iOS do que
 * deveriam — e é por isso que a US3 existe.
 */
export function FilteredImage({ uri, filtroId, look, style, imageStyle }: Props) {
  const filter = look ? resolverReceita(look) : filtroId ? filterById(filtroId) : null;
  const f = filter?.imageFilter;
  const filterFns: FilterFunction[] = f
    ? [
        ...(f.brightness !== undefined ? [{ brightness: f.brightness }] : []),
        ...(f.saturate !== undefined ? [{ saturate: f.saturate }] : []),
        ...(f.contrast !== undefined ? [{ contrast: f.contrast }] : []),
        ...(f.sepia !== undefined ? [{ sepia: f.sepia }] : []),
      ]
    : [];

  return (
    <View style={[styles.wrap, style]}>
      <View style={[StyleSheet.absoluteFill, filterFns.length > 0 && { filter: filterFns }]}>
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill as ImageStyle, imageStyle]}
          resizeMode="cover"
        />
      </View>
      {filter ? <FilterLayer filter={filter} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#090506',
  },
});

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
import { filterById } from '@/constants/filters';
import { FilterId } from '@/types';

interface Props {
  uri: string;
  /** null = foto original, sem filtro (T-0B) */
  filtroId: FilterId | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Foto com o filtro aplicado: style `filter` do RN (brightness/saturate/
 * contrast/sepia — Android integral, iOS parcial) + overlays de identidade.
 * Com `filtroId` nulo renderiza a imagem pura, como capturada.
 */
export function FilteredImage({ uri, filtroId, style, imageStyle }: Props) {
  const filter = filtroId ? filterById(filtroId) : null;
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

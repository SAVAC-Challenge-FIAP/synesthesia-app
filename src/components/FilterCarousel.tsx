import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { FILTERS } from '@/constants/filters';
import { colors, fonts, hitSlops, radii } from '@/theme/tokens';
import { FilterId } from '@/types';

interface Props {
  /** null = chip "Original" (sem filtro, T-0B) */
  ativo: FilterId | null;
  onSelect: (id: FilterId | null) => void;
  /** chip "AUTO" indica que o filtro veio da vibe (não escolhido manualmente) */
  autoAtivo?: boolean;
}

interface CarouselItem {
  id: FilterId | null;
  nome: string;
  emoji: string;
}

/** "Original" + os 8 filtros: a foto sem filtro é uma escolha de primeira classe. */
const ITEMS: CarouselItem[] = [{ id: null, nome: 'Original', emoji: '📷' }, ...FILTERS];

/** Carrossel horizontal dos filtros (chips do Figma, radius 15). */
export function FilterCarousel({ ativo, onSelect, autoAtivo }: Props) {
  return (
    <FlatList
      horizontal
      data={ITEMS}
      keyExtractor={(f) => f.id ?? 'original'}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => {
        const selected = item.id === ativo;
        return (
          <Pressable
            onPress={() => onSelect(item.id)}
            hitSlop={hitSlops.chip}
            style={[styles.chip, selected && styles.chipAtivo]}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.nome, selected && styles.nomeAtivo]}>
              {item.nome.toUpperCase()}
              {selected && autoAtivo ? ' · AUTO' : ''}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderWidth: 1,
    borderColor: colors.parchment25,
  },
  chipAtivo: {
    backgroundColor: colors.ruby,
    borderColor: colors.ruby,
  },
  emoji: {
    fontSize: 14,
  },
  nome: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
  },
  nomeAtivo: {
    color: colors.parchment,
  },
});

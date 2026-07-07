import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { FILTERS } from '@/constants/filters';
import { colors, fonts, radii } from '@/theme/tokens';
import { FilterId } from '@/types';

interface Props {
  ativo: FilterId;
  onSelect: (id: FilterId) => void;
  /** chip "AUTO" indica que o filtro veio da vibe (não escolhido manualmente) */
  autoAtivo?: boolean;
}

/** Carrossel horizontal dos 8 filtros (chips do Figma, radius 15). */
export function FilterCarousel({ ativo, onSelect, autoAtivo }: Props) {
  return (
    <FlatList
      horizontal
      data={FILTERS}
      keyExtractor={(f) => f.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => {
        const selected = item.id === ativo;
        return (
          <Pressable
            onPress={() => onSelect(item.id)}
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

import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { FILTERS } from '@/constants/filters';
import { colors, fonts, hitSlops, radii } from '@/theme/tokens';
import { FilterId } from '@/types';

interface Props {
  /** null = chip "Original" (sem filtro, T-0B) */
  ativo: FilterId | null;
  onSelect: (id: FilterId | null) => void;
}

interface CarouselItem {
  id: FilterId | null;
  nome: string;
  emoji: string;
}

/** "Original" + os 8 filtros: a foto sem filtro é uma escolha de primeira classe. */
const ITEMS: CarouselItem[] = [{ id: null, nome: 'Original', emoji: '📷' }, ...FILTERS];

const PAD_HORIZONTAL = 16;
const GAP = 8;

/**
 * Chip memoizado: sem isto, trocar de filtro re-renderiza os nove — medido em
 * ~25 frames por troca, com 95º percentil em 200ms. Só os dois chips que mudam
 * de estado precisam redesenhar.
 */
const Chip = React.memo(function Chip({
  item,
  selected,
  onSelect,
}: {
  item: CarouselItem;
  selected: boolean;
  onSelect: (id: FilterId | null) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      hitSlop={hitSlops.chip}
      style={[styles.chip, selected && styles.chipAtivo]}
    >
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.nome}>{item.nome.toUpperCase()}</Text>
    </Pressable>
  );
});

/**
 * Carrossel horizontal dos filtros (chips do Figma, radius 15) — **só no
 * visor da câmera**. O modal de captura usa o `FilterThumbs`, que mostra a
 * foto com cada filtro aplicado; aqui não há foto capturada para miniaturizar,
 * só o preview ao vivo, e por isso os dois carrosséis divergem de propósito
 * (T054).
 *
 * Já teve um chip "+N" na borda, que contava quantos filtros ainda não tinham
 * cabido na tela (US4/T025). Foi retirado a pedido do Sávio: virou peso visual
 * numa faixa que já é densa. Com ele saiu também toda a medição de larguras que
 * existia só para calcular esse número — o componente voltou a ser uma lista.
 */
export function FilterCarousel({ ativo, onSelect }: Props) {
  const renderItem = useCallback(
    ({ item }: { item: CarouselItem }) => (
      <Chip
        item={item}
        selected={item.id === ativo}
        onSelect={onSelect}
      />
    ),
    [ativo, onSelect],
  );

  return (
    <FlatList
      horizontal
      data={ITEMS}
      keyExtractor={(f) => f.id ?? 'original'}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={renderItem}
      extraData={ativo}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: PAD_HORIZONTAL,
    gap: GAP,
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
    fontFamily: fonts.labelForte,
    fontSize: 11,
    letterSpacing: 1,
  },
});

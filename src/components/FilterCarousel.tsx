/**
 * @docs docs/runbooks/armadilhas-conhecidas.md
 */
import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";

import { FILTERS } from "@/constants/filters";
import { colors, fonts, hitSlops, radii } from "@/theme/tokens";
import { FilterId } from "@/types";

interface Props {
  ativo: FilterId | null;
  onSelect: (id: FilterId | null) => void;
}

interface CarouselItem {
  id: FilterId | null;
  nome: string;
  emoji: string;
}

const ITEMS: CarouselItem[] = [
  { id: null, nome: "Original", emoji: "📷" },
  ...FILTERS,
];

const PAD_HORIZONTAL = 16;
const GAP = 8;

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

export function FilterCarousel({ ativo, onSelect }: Props) {
  const renderItem = useCallback(
    ({ item }: { item: CarouselItem }) => (
      <Chip item={item} selected={item.id === ativo} onSelect={onSelect} />
    ),
    [ativo, onSelect],
  );

  return (
    <FlatList
      horizontal
      data={ITEMS}
      keyExtractor={(f) => f.id ?? "original"}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: "rgba(9,5,6,0.55)",
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

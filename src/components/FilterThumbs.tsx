/**
 * @docs docs/components/FilterThumbs.md
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { FilteredImage } from "@/components/FilteredImage";
import { previaParaSkia } from "@/services/previaFoto";
import { FILTERS } from "@/constants/filters";
import { colors, fonts, radii } from "@/theme/tokens";
import { FilterId } from "@/types";

interface Props {
  photoUri: string;
  ativo: FilterId | null;
  onSelect: (id: FilterId | null) => void;
}

interface ThumbItem {
  id: FilterId | null;
  nome: string;
  emoji: string;
}

const ITEMS: ThumbItem[] = [
  { id: null, nome: "Original", emoji: "📷" },
  ...FILTERS,
];

const LARGURA = 70;
const ALTURA = 93;
const GAP = 10;
const PAD_HORIZONTAL = 16;

const LIMITE_FONTE_AMPLIADA = 1.3;

const Thumb = React.memo(function Thumb({
  item,
  photoUri,
  selected,
  mostrarNome,
  onSelect,
}: {
  item: ThumbItem;
  photoUri: string;
  selected: boolean;
  mostrarNome: boolean;
  onSelect: (id: FilterId | null) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filtro ${item.nome}`}

      style={[styles.thumb, selected && styles.thumbSelecionada]}
    >
      <FilteredImage
        uri={photoUri}
        filtroId={item.id}
        style={StyleSheet.absoluteFill}
      />
      {}
      <View pointerEvents="none" style={styles.veu} />
      <Text style={styles.emoji}>{item.emoji}</Text>
      {mostrarNome ? (
        <Text
          style={[styles.nome, selected && styles.nomeSelecionado]}
          numberOfLines={1}
        >
          {item.nome.toUpperCase()}
        </Text>
      ) : null}
    </Pressable>
  );
});

export function FilterThumbs({ photoUri, ativo, onSelect }: Props) {
  const { fontScale } = useWindowDimensions();
  const mostrarNomeSempre = fontScale <= LIMITE_FONTE_AMPLIADA;

  const [uriLeve, setUriLeve] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    previaParaSkia(photoUri).then((u) => {
      if (vivo) setUriLeve(u);
    });
    return () => {
      vivo = false;
    };
  }, [photoUri]);
  const uriDasThumbs = uriLeve ?? photoUri;

  const renderItem = useCallback(
    ({ item }: { item: ThumbItem }) => {
      const selected = item.id === ativo;
      return (
        <Thumb
          item={item}
          photoUri={uriDasThumbs}
          selected={selected}
          mostrarNome={mostrarNomeSempre || selected}
          onSelect={onSelect}
        />
      );
    },
    [ativo, uriDasThumbs, mostrarNomeSempre, onSelect],
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
  thumb: {
    width: LARGURA,
    height: ALTURA,
    borderRadius: radii.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,

    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbSelecionada: {
    borderColor: colors.amber,
  },
  veu: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,5,6,0.28)",
  },
  emoji: {
    fontSize: 24,
  },
  nome: {
    position: "absolute",
    bottom: 6,
    left: 2,
    right: 2,
    textAlign: "center",
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  nomeSelecionado: {
    color: colors.amber,
  },
});

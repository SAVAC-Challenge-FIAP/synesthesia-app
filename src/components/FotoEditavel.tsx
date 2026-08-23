/**
 * @docs docs/components/FotoEditavel.md
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { FilteredImage } from "@/components/FilteredImage";
import { colors, hitSlops, radii } from "@/theme/tokens";
import { FilterId, LookRecipe } from "@/types";

interface Props {
  uri: string;
  filtroId: FilterId | null;
  look?: LookRecipe | null;
  aspectRatio: number;
  girando: boolean;
  onGirar: () => void;
}

export function FotoEditavel({
  uri,
  filtroId,
  look,
  aspectRatio,
  girando,
  onGirar,
}: Props) {
  return (
    <View style={styles.wrap}>
      <FilteredImage
        uri={uri}
        filtroId={filtroId}
        look={look}
        usarSkia
        style={{ width: "100%", aspectRatio }}
      />

      <Pressable
        style={styles.botaoIcone}
        hitSlop={hitSlops.icone}
        disabled={girando}
        accessibilityRole="button"
        accessibilityLabel="Girar a foto 90 graus"
        onPress={onGirar}
      >
        {girando ? (
          <ActivityIndicator size="small" color={colors.parchment} />
        ) : (
          <Ionicons name="sync-outline" size={18} color={colors.parchment} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.card,
  },
  botaoIcone: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: radii.card,
    backgroundColor: colors.inkOverlay,
    alignItems: "center",
    justifyContent: "center",
  },
});

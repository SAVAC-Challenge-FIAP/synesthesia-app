/**
 * @docs docs/components/CameraOptionsBar.md
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, hitSlops } from "@/theme/tokens";

export function CameraOptionsBar({
  onFechar,
  onAjustes,
  slotFlash,
  slotEnquadramento,
}: {
  onFechar?: () => void;
  onAjustes: () => void;
  slotFlash?: React.ReactNode;
  slotEnquadramento?: React.ReactNode;
}) {
  return (
    <View style={styles.barra}>
      {onFechar ? (
        <Pressable
          onPress={onFechar}
          hitSlop={hitSlops.chip}
          style={styles.botao}
        >
          <Ionicons name="close" size={20} color={colors.parchment} />
        </Pressable>
      ) : null}

      {slotFlash ?? null}
      {slotEnquadramento ?? null}

      <Pressable
        onPress={onAjustes}
        hitSlop={hitSlops.chip}
        style={styles.botao}
      >
        <Ionicons name="settings-outline" size={22} color={colors.parchment} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    height: 24,
    flex: 1,
  },
  botao: {
    alignItems: "center",
    justifyContent: "center",
  },
});

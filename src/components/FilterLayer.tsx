/**
 * @docs docs/components/FilterLayer.md
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { FilterDef } from "@/types";

export function FilterLayer({ filter }: { filter: FilterDef }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: filter.overlayColor,
            opacity: filter.overlayOpacity,
          },
        ]}
      />
      {filter.overlayColor2 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: filter.overlayColor2,
              opacity: filter.overlayOpacity2 ?? 0.1,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

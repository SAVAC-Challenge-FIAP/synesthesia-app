/**
 * @docs docs/components/FundoBase.md
 */
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet } from "react-native";

import { colors } from "@/theme/tokens";

export function FundoBase({ style }: { style?: object }) {
  return (
    <LinearGradient
      colors={[colors.rubyGradientTop, colors.rubyGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }, style]}
      pointerEvents="none"
    />
  );
}

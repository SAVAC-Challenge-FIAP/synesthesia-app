/**
 * @docs docs/components/SetaRolagem.md
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

import { colors, hitSlops, radii } from "@/theme/tokens";

interface Props {
  visivel: boolean;
  onPress: () => void;
}

export function SetaRolagem({ visivel, onPress }: Props) {
  const quique = useRef(new Animated.Value(0)).current;
  const opacidade = useRef(new Animated.Value(visivel ? 1 : 0)).current;

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(quique, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(quique, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [quique]);

  useEffect(() => {
    Animated.timing(opacidade, {
      toValue: visivel ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visivel, opacidade]);

  const deslocamentoY = quique.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  return (
    <Animated.View
      pointerEvents={visivel ? "auto" : "none"}
      style={[
        styles.wrap,
        { opacity: opacidade, transform: [{ translateY: deslocamentoY }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        hitSlop={hitSlops.icone}
        accessibilityRole="button"
        accessibilityLabel="Rolar até os filtros e a música"
      >
        <Ionicons name="chevron-down" size={22} color={colors.parchment} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 150,
    alignSelf: "center",
    width: 36,
    height: 36,
    borderRadius: radii.card,
    backgroundColor: colors.inkOverlay,
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * @docs docs/components/EsqueletoTexto.md
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, ViewStyle } from "react-native";

import { radii } from "@/theme/tokens";

export const EsqueletoTexto = React.memo(function EsqueletoTexto({
  largura,
  altura,
  atraso = 0,
  estilo,
  rotuloAcessivel = "Carregando",
}: {
  largura: number;
  altura: number;
  atraso?: number;
  estilo?: ViewStyle | ViewStyle[];
  rotuloAcessivel?: string;
}) {
  const brilho = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.delay(atraso),
        Animated.timing(brilho, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(brilho, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(420),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [brilho, atraso]);

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [pulso]);

  const deslocamento = brilho.interpolate({
    inputRange: [0, 1],
    outputRange: [-largura, largura],
  });

  const deslocamentoFino = brilho.interpolate({
    inputRange: [0, 1],
    outputRange: [-largura * 1.5, largura * 1.4],
  });

  const respiracao = pulso.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <Animated.View
      style={[
        styles.base,
        { width: largura, height: altura, opacity: respiracao },
        estilo as ViewStyle,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={rotuloAcessivel}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.brilho,
          {
            top: -altura / 2,
            width: largura * 0.55,
            height: altura * 2,
            transform: [{ translateX: deslocamento }, { rotate: "18deg" }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.brilhoFino,
          {
            top: -altura / 2,
            width: largura * 0.18,
            height: altura * 2,
            transform: [{ translateX: deslocamentoFino }, { rotate: "18deg" }],
          },
        ]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(248,162,13,0.07)",
    borderWidth: 2,
    borderColor: "rgba(248,162,13,0.40)",
  },
  brilho: {
    position: "absolute",
    left: 0,

    backgroundColor: "rgba(248,162,13,0.30)",
  },
  brilhoFino: {
    position: "absolute",
    left: 0,
    backgroundColor: "rgba(255,224,150,0.45)",
  },
});

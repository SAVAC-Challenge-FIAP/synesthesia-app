/**
 * @docs docs/components/LoaderMarca.md
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

const MARCA = require("../../assets/splash-icon.png");

export function LoaderMarca({
  tamanho = 44,
  opacidadeMinima = 0.45,
}: {
  tamanho?: number;
  opacidadeMinima?: number;
}) {
  const pulso = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const respirar = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const rodar = Animated.loop(
      Animated.timing(giro, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    respirar.start();
    rodar.start();
    return () => {
      respirar.stop();
      rodar.stop();
    };
  }, [pulso, giro]);

  return (
    <Animated.Image
      source={MARCA}
      resizeMode="contain"
      style={[
        styles.marca,
        {
          width: tamanho,
          height: tamanho,
          opacity: pulso.interpolate({
            inputRange: [0, 1],
            outputRange: [opacidadeMinima, 1],
          }),
          transform: [
            {
              scale: pulso.interpolate({
                inputRange: [0, 1],
                outputRange: [0.88, 1],
              }),
            },
            {
              rotate: giro.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  marca: {
    alignSelf: "center",
  },
});

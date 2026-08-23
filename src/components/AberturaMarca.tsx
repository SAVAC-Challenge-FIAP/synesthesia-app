/**
 * @docs docs/components/AberturaMarca.md
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { FundoBase } from "@/components/FundoBase";
import { LoaderMarca } from "@/components/LoaderMarca";
import { colors, fonts } from "@/theme/tokens";

export function AberturaMarca({
  pronto,
  mostrarNome,
  onFim,
}: {
  pronto: boolean;
  mostrarNome: boolean;
  onFim: () => void;
}) {
  const saida = useRef(new Animated.Value(0)).current;
  const entrada = useRef(new Animated.Value(0)).current;
  const nascidoEm = useRef(Date.now()).current;

  useEffect(() => {
    if (!mostrarNome) return;

    Animated.timing(entrada, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mostrarNome, entrada]);

  useEffect(() => {
    if (!pronto) return;

    const restante = Math.max(0, 1100 - (Date.now() - nascidoEm));
    const t = setTimeout(() => {
      Animated.timing(saida, {
        toValue: 1,
        duration: 420,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFim();
      });
    }, restante);
    return () => clearTimeout(t);
  }, [pronto, saida, onFim, nascidoEm]);

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: saida.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),

          transform: [
            {
              scale: saida.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.08],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <FundoBase />
      <View style={styles.centro}>
        <LoaderMarca tamanho={132} opacidadeMinima={0.82} />
        <Animated.View
          style={{
            opacity: entrada,
            transform: [
              {
                translateY: entrada.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
        >
          {}
          <Text style={styles.nome}>SYNESTHESIA</Text>
          <Text style={styles.assinatura}>SINTA A CENA · OUÇA A IMAGEM</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ink,
    zIndex: 10,
  },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
  },
  nome: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 4,
    textAlign: "center",
  },
  assinatura: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 10,
  },
});

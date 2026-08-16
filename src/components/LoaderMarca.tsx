import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

const MARCA = require('../../assets/splash-icon.png');

/**
 * Loader feito da própria marca (T070).
 *
 * **Por que não é o loader "certo" do desenho.** A animação ideal — arco
 * externo girando e anéis internos pulsando em contratempo — precisaria de
 * `react-native-svg` **e** `react-native-reanimated`, que são duas dependências
 * nativas novas e mais um rebuild. A própria task chama de alternativa honesta
 * animar opacidade e escala sobre o PNG com a `Animated` que já vem no React
 * Native: some sofisticação, zero dependência.
 *
 * O símbolo é uma íris, então respirar e girar devagar já lê como "processando"
 * sem prometer progresso que o sistema não sabe medir (contrato C-04).
 */
export function LoaderMarca({ tamanho = 44 }: { tamanho?: number }) {
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
    // O giro é lento de propósito: o símbolo tem quatro marcas nos eixos, e
    // girar rápido vira cata-vento em vez de diafragma.
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
          opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
          transform: [
            { scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
            {
              rotate: giro.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
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
    alignSelf: 'center',
  },
});

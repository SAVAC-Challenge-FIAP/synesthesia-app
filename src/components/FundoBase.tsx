import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * Fundo base da identidade visual (T068) — nó [563:52](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=563-52&m=dev):
 * `linear-gradient(180deg, rgba(141,21,20,0.5), rgba(39,6,6,0.25))` sobre `#090506`.
 *
 * **Nunca tinha sido implementado.** O `CLAUDE.md` descreve este fundo desde o
 * começo e os tokens `rubyGradientTop`/`rubyGradientBottom` existem em
 * `tokens.ts` desde então — sem nenhum componente que os usasse. As telas
 * escuras eram `ink` chapado.
 *
 * As duas paradas do gradiente têm alfa, então ele **depende** do `ink` por
 * baixo para dar a cor final: o `backgroundColor` do container não é detalhe,
 * é a primeira camada dos três.
 */
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

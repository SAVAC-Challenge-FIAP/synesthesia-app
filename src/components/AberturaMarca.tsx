import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { FundoBase } from '@/components/FundoBase';
import { LoaderMarca } from '@/components/LoaderMarca';
import { colors, fonts } from '@/theme/tokens';

/**
 * Abertura do app (T080/T094) — a marca **em movimento**, e não mais um pisca.
 *
 * O que o Sávio viu: *"aparece a logo e depois troca para logo, tipo em uma
 * piscada"*. Não era bug, eram duas marcas em sequência com escalas diferentes:
 * o Android 12+ mostra sozinho o ícone do app enquanto o processo sobe, e logo
 * atrás vinha o splash do `expo-splash-screen` com a mesma arte em outro
 * tamanho. Dois estáticos quase iguais lidos em sequência = salto.
 *
 * A correção tem duas metades. A outra é o `app.json`, onde o splash passou a
 * exibir a marca no tamanho em que o sistema já a mostrava. Aqui fica a
 * terceira imagem da sequência — só que esta **respira**, e sai por fade em vez
 * de sumir de um frame para o outro. O movimento cobre o que ainda restar de
 * diferença entre as duas anteriores.
 *
 * É o mesmo `LoaderMarca` da espera do Gemini, que o Sávio aprovou — a mesma
 * ideia de movimento nos dois lugares em que o app pede tempo a quem usa.
 */
export function AberturaMarca({
  /** Só sai quando o app tem o que mostrar no lugar (fontes carregadas). */
  pronto,
  /** Com as fontes ainda carregando, o nome esperaria — e trocaria de fonte à vista. */
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
    // O nome entra depois do símbolo: dá uma leitura em vez de um bloco só.
    Animated.timing(entrada, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mostrarNome, entrada]);

  useEffect(() => {
    if (!pronto) return;
    // Tempo mínimo em cena: sem ele, um arranque rápido faria a marca aparecer
    // e sumir — que é exatamente a piscada que esta tela veio resolver.
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
          opacity: saida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          // Some crescendo de leve, como se a íris abrisse para o visor.
          transform: [
            { scale: saida.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
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
              { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          }}
        >
          {/* O nome vem da tipografia do app, não do `logo-full-name.png`: o
              arquivo traz um retângulo preto embutido (a pendência conhecida dos
              assets), e sobre o gradiente ele aparecia como uma caixa preta em
              volta da palavra. Escrito, fica na identidade e sem remendo. */}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
  },
  nome: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 4,
    textAlign: 'center',
  },
  assinatura: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 10,
  },
});

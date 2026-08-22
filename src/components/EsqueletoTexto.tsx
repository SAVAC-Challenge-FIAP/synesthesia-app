import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle } from 'react-native';

import { radii } from '@/theme/tokens';

/**
 * Lugar reservado para conteúdo que ainda não chegou — shimmer dourado com
 * respiração.
 *
 * Nasceu dentro de `TratamentoCarrossel` como o placeholder dos três looks
 * (T104) e foi extraído aqui na feature 005, quando a vibe passou a precisar do
 * mesmo vocabulário de espera (FR-031). Reescrever um retângulo novo produziria
 * **dois** vocabulários de espera na mesma tela — o do carrossel e o da vibe
 * logo acima dele, pulsando fora de sincronia.
 *
 * Prefere-se ao spinner porque diz outra coisa: um spinner comunica
 * "processando, aguarde" — e aqui nada está bloqueado, a pessoa pode escolher
 * qualquer preset e salvar. O shimmer comunica "conteúdo a caminho neste
 * lugar", que é exatamente o caso, e é o vocabulário que as redes sociais já
 * ensinaram ao público deste app.
 */
export const EsqueletoTexto = React.memo(function EsqueletoTexto({
  largura,
  altura,
  atraso = 0,
  estilo,
  rotuloAcessivel = 'Carregando',
}: {
  largura: number;
  altura: number;
  /**
   * Escalonamento entre esqueletos vizinhos: é o que faz uma fileira parecer
   * viva em vez de várias caixas piscando em uníssono.
   */
  atraso?: number;
  estilo?: ViewStyle | ViewStyle[];
  rotuloAcessivel?: string;
}) {
  /**
   * Shimmer: uma faixa clara atravessa o lugar reservado da esquerda para a
   * direita, em laço. `translateX` no driver nativo, então a animação roda fora
   * da thread de JS e continua fluida enquanto a curadoria a ocupa.
   */
  const brilho = useRef(new Animated.Value(0)).current;
  /**
   * Respiração do dourado (T104): a opacidade sobe e desce devagar, fora de
   * fase com o reflexo. É o que dá o ar de "algo raro sendo lapidado" em vez de
   * "campo vazio" — o reflexo sozinho lê como placeholder comum e neutro.
   */
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

  // O reflexo fino corre à frente do largo: o atraso entre os dois é o que faz
  // a luz parecer atravessar um material, não uma barra só passando.
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
            transform: [{ translateX: deslocamento }, { rotate: '18deg' }],
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
            transform: [{ translateX: deslocamentoFino }, { rotate: '18deg' }],
          },
        ]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Fundo levemente dourado e borda âmbar contínua — o lugar reservado já
    // pertence à família do que vai chegar, em vez de parecer uma caixa vazia
    // tracejada de sistema.
    backgroundColor: 'rgba(248,162,13,0.07)',
    borderWidth: 2,
    borderColor: 'rgba(248,162,13,0.40)',
  },
  brilho: {
    position: 'absolute',
    left: 0,
    // Ouro, não pergaminho (T104): o reflexo que cruza a espera é o mesmo âmbar
    // que marca o conteúdo quando ele chega. A promessa e a entrega falam a
    // mesma língua.
    backgroundColor: 'rgba(248,162,13,0.30)',
  },
  /**
   * Segundo reflexo, mais estreito e mais claro, correndo logo atrás do
   * primeiro: é o que separa "carregando" de "vem coisa boa aí". Um brilho só
   * lê como placeholder; dois, desencontrados, leem como algo sendo lapidado.
   */
  brilhoFino: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'rgba(255,224,150,0.45)',
  },
});

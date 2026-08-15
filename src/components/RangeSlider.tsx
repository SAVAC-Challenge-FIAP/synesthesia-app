import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface Props {
  min: number;
  max: number;
  step: number;
  inicio: number;
  fim: number;
  /** Distância mínima entre as duas bolinhas, na unidade dos valores. */
  minGap: number;
  /**
   * Posição absoluta da reprodução, para pintar o quanto do trecho já tocou.
   * Fica **dentro** da faixa selecionada, então o movimento acontece no próprio
   * trilho — sem precisar de uma segunda barra só para mostrar andamento.
   */
  progresso?: number;
  /** Chamado ao **soltar** a bolinha, não a cada pixel — ver nota abaixo. */
  onChange: (inicio: number, fim: number) => void;
}

const THUMB = 22;
const TRILHO = 6;

/**
 * Seletor de faixa com duas bolinhas num trilho só — o padrão que o mercado usa
 * para recortar um trecho, e o que está no Figma (nó 462-926).
 *
 * Construído à mão com `PanResponder` porque o `@react-native-community/slider`
 * só tem um thumb, e trazer uma biblioteca de range slider seria desvio da stack
 * fixada no CLAUDE.md. Como o desenho é simples — dois círculos sobre um trilho
 * pintado —, o custo de fazer à mão é menor que o de mais uma dependência.
 *
 * **Por que `onChange` só dispara no release**: cada mudança de recorte invalida
 * o vídeo pré-gerado (ver `preExport.ts`). Emitir a cada pixel arrastado faria a
 * chave do pacote mudar dezenas de vezes por gesto. Durante o arraste o
 * componente se desenha com estado local; quem está de fora só ouve o resultado.
 */
export function RangeSlider({ min, max, step, inicio, fim, minGap, progresso, onChange }: Props) {
  const [largura, setLargura] = useState(0);
  const [local, setLocal] = useState({ inicio, fim });
  const [arrastando, setArrastando] = useState<'inicio' | 'fim' | null>(null);

  // Refs espelham o estado para o PanResponder, que é criado uma vez só e não
  // enxergaria valores novos capturados por closure.
  const larguraRef = useRef(0);
  const valoresRef = useRef({ inicio, fim });
  const partidaRef = useRef(0);

  const valores = arrastando ? local : { inicio, fim };
  valoresRef.current = valores;
  larguraRef.current = largura;

  // Mudou por fora (troca de faixa, reset) enquanto ninguém arrasta: acompanha
  useEffect(() => {
    if (!arrastando) setLocal({ inicio, fim });
  }, [inicio, fim, arrastando]);

  const responders = useMemo(() => {
    const criar = (qual: 'inicio' | 'fim') =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          partidaRef.current = valoresRef.current[qual];
          setArrastando(qual);
          setLocal(valoresRef.current);
        },
        onPanResponderMove: (_, gesto) => {
          const w = larguraRef.current;
          if (w <= 0) return;
          const delta = (gesto.dx / w) * (max - min);
          const bruto = Math.round((partidaRef.current + delta) / step) * step;
          setLocal((atual) => {
            if (qual === 'inicio') {
              // Empurrar o início nunca engole o fim: sobra sempre o mínimo
              const v = Math.min(Math.max(min, bruto), atual.fim - minGap);
              return { ...atual, inicio: v };
            }
            const v = Math.max(Math.min(max, bruto), atual.inicio + minGap);
            return { ...atual, fim: v };
          });
        },
        onPanResponderRelease: () => {
          setArrastando(null);
          const v = valoresRef.current;
          onChange(v.inicio, v.fim);
        },
        onPanResponderTerminate: () => {
          setArrastando(null);
          const v = valoresRef.current;
          onChange(v.inicio, v.fim);
        },
      });
    return { inicio: criar('inicio'), fim: criar('fim') };
  }, [max, min, minGap, step, onChange]);

  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  const fracao = (v: number) => (max - min === 0 ? 0 : (v - min) / (max - min));
  const px = (v: number) => fracao(v) * largura;

  const esquerda = px(valores.inicio);
  const direita = px(valores.fim);

  // Quanto do trecho já tocou, em px, limitado à faixa selecionada
  const tocado =
    progresso === undefined
      ? 0
      : Math.max(0, Math.min(direita - esquerda, px(progresso) - esquerda));

  return (
    <View style={styles.area}>
      <View style={styles.medidor} onLayout={aoMedir}>
        {/* Trilho completo (fora da seleção) */}
        <View style={styles.trilho} />
        {/* Faixa selecionada */}
        <View
          style={[styles.selecao, { left: esquerda, width: Math.max(0, direita - esquerda) }]}
        />
        {/* Andamento da reprodução, dentro da seleção */}
        {tocado > 0 ? (
          <View style={[styles.tocado, { left: esquerda, width: tocado }]} />
        ) : null}

        <View
          {...responders.inicio.panHandlers}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={[styles.thumb, { left: esquerda - THUMB / 2 }]}
        />
        <View
          {...responders.fim.panHandlers}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={[styles.thumb, { left: direita - THUMB / 2 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Altura folgada para o alvo de toque das bolinhas (FR-Q02, 48dp)
  area: {
    height: 48,
    justifyContent: 'center',
  },
  medidor: {
    height: THUMB,
    justifyContent: 'center',
    // Meia bolinha de folga de cada lado para os extremos não vazarem
    marginHorizontal: THUMB / 2,
  },
  trilho: {
    height: TRILHO,
    borderRadius: TRILHO / 2,
    backgroundColor: colors.parchment25,
  },
  selecao: {
    position: 'absolute',
    height: TRILHO,
    borderRadius: TRILHO / 2,
    backgroundColor: colors.parchment,
  },
  tocado: {
    position: 'absolute',
    height: TRILHO,
    borderRadius: TRILHO / 2,
    backgroundColor: colors.amber,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
  },
});

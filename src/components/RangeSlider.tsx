/**
 * @docs docs/components/RangeSlider.md
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";

import { colors } from "@/theme/tokens";

interface Props {
  min: number;
  max: number;
  step: number;
  inicio: number;
  fim: number;
  minGap: number;
  progresso?: number;
  onChange: (inicio: number, fim: number) => void;
}

const THUMB = 22;
const TRILHO = 6;

export function RangeSlider({
  min,
  max,
  step,
  inicio,
  fim,
  minGap,
  progresso,
  onChange,
}: Props) {
  const [largura, setLargura] = useState(0);
  const [local, setLocal] = useState({ inicio, fim });
  const [arrastando, setArrastando] = useState<"inicio" | "fim" | null>(null);

  const larguraRef = useRef(0);
  const valoresRef = useRef({ inicio, fim });
  const partidaRef = useRef(0);

  const valores = arrastando ? local : { inicio, fim };
  valoresRef.current = valores;
  larguraRef.current = largura;

  useEffect(() => {
    if (!arrastando) setLocal({ inicio, fim });
  }, [inicio, fim, arrastando]);

  const responders = useMemo(() => {
    const criar = (qual: "inicio" | "fim") =>
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
            if (qual === "inicio") {
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
    return { inicio: criar("inicio"), fim: criar("fim") };
  }, [max, min, minGap, step, onChange]);

  const aoMedir = (e: LayoutChangeEvent) =>
    setLargura(e.nativeEvent.layout.width);

  const fracao = (v: number) => (max - min === 0 ? 0 : (v - min) / (max - min));
  const px = (v: number) => fracao(v) * largura;

  const esquerda = px(valores.inicio);
  const direita = px(valores.fim);

  const tocado =
    progresso === undefined
      ? 0
      : Math.max(0, Math.min(direita - esquerda, px(progresso) - esquerda));

  return (
    <View style={styles.area}>
      <View style={styles.medidor} onLayout={aoMedir}>
        {}
        <View style={styles.trilho} />
        {}
        <View
          style={[
            styles.selecao,
            { left: esquerda, width: Math.max(0, direita - esquerda) },
          ]}
        />
        {}
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
  area: {
    height: 48,
    justifyContent: "center",
  },
  medidor: {
    height: THUMB,
    justifyContent: "center",

    marginHorizontal: THUMB / 2,
  },
  trilho: {
    height: TRILHO,
    borderRadius: TRILHO / 2,
    backgroundColor: colors.parchment25,
  },
  selecao: {
    position: "absolute",
    height: TRILHO,
    borderRadius: TRILHO / 2,
    backgroundColor: colors.parchment,
  },
  tocado: {
    position: "absolute",
    height: TRILHO,
    borderRadius: TRILHO / 2,
    backgroundColor: colors.amber,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
  },
});

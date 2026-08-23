/**
 * @docs docs/components/CameraOptionsBar.md
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, hitSlops } from "@/theme/tokens";

export function CameraOptionsBar({
  resolucao,
  onTrocarResolucao,
  onFechar,
  onAjustes,
  slotFlash,
  slotEnquadramento,
}: {
  resolucao: string | null;
  onTrocarResolucao?: () => void;
  onFechar?: () => void;
  onAjustes: () => void;
  slotFlash?: React.ReactNode;
  slotEnquadramento?: React.ReactNode;
}) {
  return (
    <View style={styles.barra}>
      {onFechar ? (
        <Pressable
          onPress={onFechar}
          hitSlop={hitSlops.chip}
          style={styles.botao}
        >
          <Ionicons name="close" size={20} color={colors.parchment} />
        </Pressable>
      ) : null}

      {slotFlash ?? null}
      {slotEnquadramento ?? null}

      {resolucao ? (
        onTrocarResolucao ? (
          <Pressable
            onPress={onTrocarResolucao}
            hitSlop={hitSlops.chip}
            accessibilityRole="button"
            accessibilityLabel={`Resolução ${resolucao}. Tocar para trocar.`}
          >
            <Text style={[styles.resolucao, styles.resolucaoToc]}>
              {resolucao}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.resolucao}>{resolucao}</Text>
        )
      ) : null}

      <Pressable
        onPress={onAjustes}
        hitSlop={hitSlops.chip}
        style={styles.botao}
      >
        <Ionicons name="settings-outline" size={22} color={colors.parchment} />
      </Pressable>
    </View>
  );
}

export function rotuloDeResolucao(tamanhos: string[]): string | null {
  let maiorPixels = 0;
  for (const t of tamanhos) {
    const [l, a] = t.split("x").map((n) => Number(n));
    if (!Number.isFinite(l) || !Number.isFinite(a)) continue;
    maiorPixels = Math.max(maiorPixels, l * a);
  }
  if (maiorPixels === 0) return null;
  return `${Math.round(maiorPixels / 1_000_000)}M`;
}

export function opcoesDeResolucao(
  tamanhos: string[],
  razaoAlvo: number,
): string[] {
  const compativeis = tamanhos
    .map((t) => {
      const [l, a] = t.split("x").map(Number);
      return { t, l, a, px: l * a, razao: l / a };
    })
    .filter((x) => Number.isFinite(x.px) && x.px > 0)

    .filter(
      (x) =>
        Math.abs(x.razao - razaoAlvo) < 0.06 ||
        Math.abs(1 / x.razao - razaoAlvo) < 0.06,
    )

    .filter((x) => x.px >= 8_000_000)
    .sort((a, b) => b.px - a.px);

  if (compativeis.length === 0) return [];
  if (compativeis.length <= 3) return compativeis.map((x) => x.t);

  return [
    compativeis[0].t,
    compativeis[Math.floor(compativeis.length / 2)].t,
    compativeis[compativeis.length - 1].t,
  ];
}

export function megapixels(tamanho: string): string {
  const [l, a] = tamanho.split("x").map(Number);
  if (!Number.isFinite(l) || !Number.isFinite(a)) return "?";
  const mp = (l * a) / 1_000_000;
  return mp >= 10 ? `${Math.round(mp)}M` : `${mp.toFixed(1)}M`;
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    height: 24,
    flex: 1,
  },
  botao: {
    alignItems: "center",
    justifyContent: "center",
  },
  resolucao: {
    color: colors.parchment50,
    fontFamily: fonts.label,
    fontSize: 12,
    letterSpacing: 1,
  },
  resolucaoToc: {
    color: colors.parchment,
  },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, hitSlops } from '@/theme/tokens';

/**
 * Painel "+ Opções" do visor — nó [462:889](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=462-889&m=dev).
 *
 * Barra de 382×24 com `paddingHorizontal: 10` e `space-between`, na ordem do
 * Figma: fechar · flash · resolução · ajustes. Antes o chip "+ OPÇÕES"
 * empurrava direto para os Ajustes; agora ele abre isto, e quem leva aos
 * Ajustes é a engrenagem.
 *
 * A tipografia do "12M" no Figma é DM Mono, que está **desatualizada** desde a
 * D2/T046 — o código usa `fonts.label` (Lato) com `letterSpacing`, que é o que
 * mantém as labels com caráter técnico depois da troca de família.
 *
 * Cada slot só aparece quando tem função de verdade: um ícone que não faz nada
 * é pior que ícone nenhum, porque promete.
 */
export function CameraOptionsBar({
  resolucao,
  onFechar,
  onAjustes,
  slotFlash,
  slotEnquadramento,
}: {
  /** Rótulo de megapixels do sensor, medido de verdade; `null` esconde o slot. */
  resolucao: string | null;
  onFechar: () => void;
  onAjustes: () => void;
  /** Controle de flash (T067). */
  slotFlash?: React.ReactNode;
  /** Seletor de enquadramento (T066). */
  slotEnquadramento?: React.ReactNode;
}) {
  return (
    <View style={styles.barra}>
      <Pressable onPress={onFechar} hitSlop={hitSlops.chip} style={styles.botao}>
        <Ionicons name="close" size={20} color={colors.parchment} />
      </Pressable>

      {slotFlash ?? null}
      {slotEnquadramento ?? null}

      {resolucao ? <Text style={styles.resolucao}>{resolucao}</Text> : null}

      <Pressable onPress={onAjustes} hitSlop={hitSlops.chip} style={styles.botao}>
        <Ionicons name="settings-outline" size={22} color={colors.parchment} />
      </Pressable>
    </View>
  );
}

/**
 * Megapixels a partir da maior resolução que o sensor oferece — é isto que faz
 * o rótulo dizer a verdade em vez de repetir o "12M" que estava desenhado no
 * Figma. Formato do `expo-camera`: "4000x3000".
 */
export function rotuloDeResolucao(tamanhos: string[]): string | null {
  let maiorPixels = 0;
  for (const t of tamanhos) {
    const [l, a] = t.split('x').map((n) => Number(n));
    if (!Number.isFinite(l) || !Number.isFinite(a)) continue;
    maiorPixels = Math.max(maiorPixels, l * a);
  }
  if (maiorPixels === 0) return null;
  return `${Math.round(maiorPixels / 1_000_000)}M`;
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: 24,
    flex: 1,
  },
  botao: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolucao: {
    color: '#E3E3E3',
    fontFamily: fonts.label,
    fontSize: 15,
    letterSpacing: 0.5,
  },
});

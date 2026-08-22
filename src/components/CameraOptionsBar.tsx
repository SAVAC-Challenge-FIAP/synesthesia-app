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
  onTrocarResolucao,
  onFechar,
  onAjustes,
  slotFlash,
  slotEnquadramento,
}: {
  /** Rótulo de megapixels em uso; `null` esconde o slot. */
  resolucao: string | null;
  /**
   * Alterna para a próxima resolução disponível. Quando ausente, o rótulo
   * segue apenas informativo — que era o comportamento antes de a resolução
   * virar escolha.
   */
  onTrocarResolucao?: () => void;
  onFechar?: () => void;
  onAjustes: () => void;
  /** Controle de flash (T067). */
  slotFlash?: React.ReactNode;
  /** Seletor de enquadramento (T066). */
  slotEnquadramento?: React.ReactNode;
}) {
  return (
    <View style={styles.barra}>
      {onFechar ? (
        <Pressable onPress={onFechar} hitSlop={hitSlops.chip} style={styles.botao}>
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
            <Text style={[styles.resolucao, styles.resolucaoToc]}>{resolucao}</Text>
          </Pressable>
        ) : (
          <Text style={styles.resolucao}>{resolucao}</Text>
        )
      ) : null}

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

/**
 * Opções de resolução oferecidas à pessoa, da maior para a menor.
 *
 * Não são todos os tamanhos do sensor: este aparelho lista dezenas, muitos em
 * proporções esquisitas, e uma lista assim vira ruído. Filtra-se pela
 * proporção pedida e escolhe-se no máximo três degraus bem separados — grande,
 * médio, pequeno — que é o que dá controle real sem virar menu de engenharia.
 *
 * Menos megapixels significa disparo mais rápido, menos memória e arquivo
 * menor; a resolução máxima deste sensor (64 MP) é justamente a que mais pesa.
 */
export function opcoesDeResolucao(tamanhos: string[], razaoAlvo: number): string[] {
  const compativeis = tamanhos
    .map((t) => {
      const [l, a] = t.split('x').map(Number);
      return { t, l, a, px: l * a, razao: l / a };
    })
    .filter((x) => Number.isFinite(x.px) && x.px > 0)
    // A mesma tolerância que `escolherTamanhoNativo` usa para casar proporção.
    .filter((x) => Math.abs(x.razao - razaoAlvo) < 0.06 || Math.abs(1 / x.razao - razaoAlvo) < 0.06)
    // Piso de 8 MP (decisão do Sávio, 2026-08-22). O primeiro corte foi em
    // 2 MP, só para tirar da lista os modos-miniatura que o sensor expõe
    // (320×240 e afins); 8 MP sobe a régua para o que ainda rende uma foto
    // boa em tela cheia e impressão pequena — abaixo disso a economia de
    // memória não paga a perda visível.
    .filter((x) => x.px >= 8_000_000)
    .sort((a, b) => b.px - a.px);

  if (compativeis.length === 0) return [];
  if (compativeis.length <= 3) return compativeis.map((x) => x.t);
  // Três degraus: o maior, o do meio e o menor.
  return [
    compativeis[0].t,
    compativeis[Math.floor(compativeis.length / 2)].t,
    compativeis[compativeis.length - 1].t,
  ];
}

/** "4000x3000" -> "12M". O rótulo curto que cabe na barra. */
export function megapixels(tamanho: string): string {
  const [l, a] = tamanho.split('x').map(Number);
  if (!Number.isFinite(l) || !Number.isFinite(a)) return '?';
  const mp = (l * a) / 1_000_000;
  return mp >= 10 ? `${Math.round(mp)}M` : `${mp.toFixed(1)}M`;
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
  /**
   * Mesma tipografia dos chips de enquadramento (4:3 · 1:1 · 16:9), a pedido
   * do Sávio: são controles do mesmo tipo — escolhas discretas de captura — e
   * ler os dois no mesmo registro faz a barra parecer uma coisa só, em vez de
   * quatro elementos com pesos diferentes disputando a atenção.
   */
  resolucao: {
    color: colors.parchment50,
    fontFamily: fonts.label,
    fontSize: 12,
    letterSpacing: 1,
  },
  /** Tocável: um passo de contraste acima do informativo, sem virar botão. */
  resolucaoToc: {
    color: colors.parchment,
  },
});

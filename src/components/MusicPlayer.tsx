import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, hitSlops } from '@/theme/tokens';
import { MusicSuggestion } from '@/types';

/** A prévia do Deezer tem 30s — é o teto do que dá para recortar. */
export const TRECHO_MAX_S = 30;

/** Piso do recorte: abaixo disso o vídeo não dá tempo de ser visto. */
export const TRECHO_MIN_S = 5;

interface Props {
  musica: MusicSuggestion;
  trechoInicio: number;
  trechoFim: number;
  onTrecho: (inicio: number, fim: number) => void;
  /**
   * Cede a saída de áudio a outro player (T044). Este componente e o
   * `MusicSheet` têm players independentes de `expo-audio`, e nenhum enxerga o
   * outro: com o modal de música aberto por cima, dar play numa sugestão fazia
   * as duas faixas soarem juntas. Quem monta decide quem é o dono da vez.
   */
  ativo?: boolean;
}

/**
 * Player do trecho sonoro (FR-006/FR-008): recorta a prévia de 30s da faixa no
 * pedaço que vai virar vídeo. Monte com `key={musica.id}` para recriar o player
 * ao trocar de faixa.
 *
 * O desenho mudou depois do QA de uso real: antes havia **um slider só**, que
 * definia o início e ficava parado enquanto a música tocava. Ele parecia uma
 * barra de progresso e não era — e não havia como escolher onde o trecho
 * termina, então todo vídeo saía com 30s. Agora são coisas separadas:
 *
 * - uma **barra de progresso** (não interativa) que anda com a reprodução;
 * - **dois sliders**, início e fim, que definem o recorte;
 * - a duração do vídeo, que é a diferença entre eles, em destaque.
 */
export function MusicPlayer({
  musica,
  trechoInicio,
  trechoFim,
  onTrecho,
  ativo = true,
}: Props) {
  const player = useAudioPlayer(musica.previewUrl);
  const status = useAudioPlayerStatus(player);

  // A reprodução respeita o FIM ESCOLHIDO, não os 30s da prévia: era isso que
  // fazia a música seguir tocando para além do recorte e parar sozinha no fim
  // do arquivo, em vez de demarcar o trecho que o usuário selecionou.
  useEffect(() => {
    if (status.playing && status.currentTime >= trechoFim) {
      player.pause();
      player.seekTo(trechoInicio).catch(() => {});
    }
  }, [status.playing, status.currentTime, player, trechoInicio, trechoFim]);

  // Perdeu a vez: cala a boca na hora. Silenciar na subida de `ativo=false`
  // (e não só no toque que abre o modal) cobre também o caminho em que o modal
  // aparece por outra via — o dono da saída é sempre um só.
  useEffect(() => {
    if (!ativo) player.pause();
  }, [ativo, player]);

  if (!musica.previewUrl) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.offline}>PRÉVIA INDISPONÍVEL OFFLINE — o trecho será definido ao reconectar</Text>
      </View>
    );
  }

  const duracao = Math.max(0, trechoFim - trechoInicio);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      // Fora do recorte? Começa do início dele — tocar é ouvir o trecho, não a faixa.
      if (status.currentTime < trechoInicio || status.currentTime >= trechoFim) {
        player.seekTo(trechoInicio).catch(() => {});
      }
      player.play();
    }
  };

  /** Início não pode encostar no fim: sempre sobra o piso de duração. */
  const mudarInicio = (v: number) => {
    const inicio = Math.min(Math.max(0, Math.round(v)), trechoFim - TRECHO_MIN_S);
    onTrecho(inicio, trechoFim);
    player.seekTo(inicio).catch(() => {});
  };

  const mudarFim = (v: number) => {
    const fim = Math.max(Math.min(TRECHO_MAX_S, Math.round(v)), trechoInicio + TRECHO_MIN_S);
    onTrecho(trechoInicio, fim);
    // Se a cabeça de leitura ficou fora do novo recorte, traz de volta
    if (status.currentTime >= fim) player.seekTo(trechoInicio).catch(() => {});
  };

  // Posição da reprodução DENTRO do recorte, 0–1. É isto que faltava se mexer.
  const andamento =
    duracao > 0
      ? Math.min(1, Math.max(0, (status.currentTime - trechoInicio) / duracao))
      : 0;
  const decorrido = Math.max(0, Math.min(duracao, status.currentTime - trechoInicio));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable onPress={toggle} hitSlop={hitSlops.botao} style={styles.playBtn}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={17} color={colors.ink} />
        </Pressable>

        <View style={styles.corpo}>
          {/* Progresso REAL da reprodução dentro do trecho — não é seletor */}
          <View style={styles.trilho}>
            <View style={[styles.preenchido, { width: `${andamento * 100}%` }]} />
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legend}>
              {Math.floor(decorrido)}s / {duracao}s
            </Text>
            <Text style={styles.legendForte}>VÍDEO DE {duracao}s</Text>
          </View>
        </View>
      </View>

      {/* Recorte: onde começa e onde termina o pedaço que vira vídeo */}
      <View style={styles.recorte}>
        <View style={styles.linhaSlider}>
          <Text style={styles.slidLabel}>INÍCIO</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={TRECHO_MAX_S - TRECHO_MIN_S}
            step={1}
            value={trechoInicio}
            minimumTrackTintColor={colors.parchment25}
            maximumTrackTintColor={colors.parchment25}
            thumbTintColor={colors.amber}
            onSlidingComplete={mudarInicio}
          />
          <Text style={styles.slidValor}>{trechoInicio}s</Text>
        </View>

        <View style={styles.linhaSlider}>
          <Text style={styles.slidLabel}>FIM</Text>
          <Slider
            style={styles.slider}
            minimumValue={TRECHO_MIN_S}
            maximumValue={TRECHO_MAX_S}
            step={1}
            value={trechoFim}
            minimumTrackTintColor={colors.parchment25}
            maximumTrackTintColor={colors.parchment25}
            thumbTintColor={colors.amber}
            onSlidingComplete={mudarFim}
          />
          <Text style={styles.slidValor}>{trechoFim}s</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: {
    flex: 1,
    gap: 6,
  },
  trilho: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.parchment25,
    overflow: 'hidden',
  },
  preenchido: {
    height: '100%',
    backgroundColor: colors.amber,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legend: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 1,
  },
  legendForte: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  recorte: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: colors.parchment25,
    paddingTop: 6,
  },
  linhaSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slidLabel: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 9,
    letterSpacing: 1,
    width: 42,
  },
  slider: {
    flex: 1,
    height: 28,
  },
  slidValor: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
    width: 30,
    textAlign: 'right',
  },
  offline: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 11,
  },
});

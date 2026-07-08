import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';
import { MusicSuggestion } from '@/types';

export const TRECHO_MAX_S = 30;

interface Props {
  musica: MusicSuggestion;
  trechoInicio: number;
  onTrechoInicio: (s: number) => void;
}

/**
 * Player do trecho sonoro (FR-006/FR-008): reproduz a prévia de 30s da faixa,
 * com slider que define o início do trecho — sempre travado em 0–30s.
 * Monte com `key={musica.id}` para recriar o player ao trocar de faixa.
 */
export function MusicPlayer({ musica, trechoInicio, onTrechoInicio }: Props) {
  const player = useAudioPlayer(musica.previewUrl);
  const status = useAudioPlayerStatus(player);

  // Fim do trecho = fim da prévia (máx. 30s) — pausa e volta ao início escolhido
  useEffect(() => {
    if (status.playing && status.currentTime >= TRECHO_MAX_S) {
      player.pause();
      player.seekTo(trechoInicio).catch(() => {});
    }
  }, [status.playing, status.currentTime, player, trechoInicio]);

  if (!musica.previewUrl) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.offline}>PRÉVIA INDISPONÍVEL OFFLINE — o trecho será definido ao reconectar</Text>
      </View>
    );
  }

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.currentTime < trechoInicio || status.currentTime >= TRECHO_MAX_S) {
        player.seekTo(trechoInicio).catch(() => {});
      }
      player.play();
    }
  };

  const duracao = Math.max(0, TRECHO_MAX_S - trechoInicio);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable onPress={toggle} style={styles.playBtn}>
          <Text style={styles.playIcon}>{status.playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <View style={styles.sliderWrap}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={TRECHO_MAX_S - 5}
            step={1}
            value={trechoInicio}
            minimumTrackTintColor={colors.amber}
            maximumTrackTintColor={colors.parchment25}
            thumbTintColor={colors.amber}
            onSlidingComplete={(v) => {
              const inicio = Math.min(Math.max(0, Math.round(v)), TRECHO_MAX_S);
              onTrechoInicio(inicio);
              player.seekTo(inicio).catch(() => {});
            }}
          />
          <View style={styles.legendRow}>
            <Text style={styles.legend}>
              TRECHO {trechoInicio}s–{TRECHO_MAX_S}s · {duracao}s
            </Text>
            <Text style={styles.legend}>{Math.floor(status.currentTime)}s</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
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
  playIcon: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.monoMedium,
  },
  sliderWrap: {
    flex: 1,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legend: {
    color: colors.amber,
    fontFamily: fonts.monoLight,
    fontSize: 10,
    letterSpacing: 1,
  },
  offline: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 11,
  },
});

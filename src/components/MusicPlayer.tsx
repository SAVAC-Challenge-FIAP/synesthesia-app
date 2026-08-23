/**
 * @docs docs/components/MusicPlayer.md
 */
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RangeSlider } from "@/components/RangeSlider";
import { colors, fonts, hitSlops, radii } from "@/theme/tokens";
import { MusicSuggestion } from "@/types";

export const TRECHO_MAX_S = 30;

export const TRECHO_MIN_S = 5;

const TIMEOUT_PREVIA_MS = 10_000;

export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return `${m}:${String(seg).padStart(2, "0")}`;
}

interface Props {
  musica: MusicSuggestion;
  trechoInicio: number;
  trechoFim: number;
  onTrecho: (inicio: number, fim: number) => void;
  ativo?: boolean;
  audioUri?: string | null;
}

export function MusicPlayer({
  musica,
  trechoInicio,
  trechoFim,
  onTrecho,
  ativo = true,
  audioUri,
}: Props) {
  const fonte = audioUri ?? musica.previewUrl;
  const player = useAudioPlayer(fonte);
  const status = useAudioPlayerStatus(player);

  const [expirada, setExpirada] = useState(false);
  const remota = !audioUri;

  useEffect(() => {
    setExpirada(false);
  }, [fonte]);

  useEffect(() => {
    if (!remota || status.isLoaded || expirada) return;
    const t = setTimeout(() => setExpirada(true), TIMEOUT_PREVIA_MS);
    return () => clearTimeout(t);
  }, [remota, status.isLoaded, expirada, fonte]);

  useEffect(() => {
    if (status.playing && status.currentTime >= trechoFim) {
      player.pause();
      player.seekTo(trechoInicio).catch(() => {});
    }
  }, [status.playing, status.currentTime, player, trechoInicio, trechoFim]);

  useEffect(() => {
    if (!ativo) player.pause();
  }, [ativo, player]);

  const aplicarTrecho = useCallback(
    (inicio: number, fim: number) => {
      onTrecho(inicio, fim);
      player.seekTo(inicio).catch(() => {});
    },
    [onTrecho, player],
  );

  if (!fonte) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.offline}>
          PRÉVIA INDISPONÍVEL OFFLINE — o trecho será definido ao reconectar
        </Text>
      </View>
    );
  }

  if (expirada && !status.isLoaded) {
    return (
      <View style={styles.wrap}>
        <View style={styles.linha}>
          <Pressable
            onPress={() => {
              setExpirada(false);
              player.replace(fonte);
            }}
            hitSlop={hitSlops.botao}
            style={styles.playBtn}
          >
            <Ionicons name="refresh" size={20} color={colors.ruby} />
          </Pressable>
          <Text style={[styles.offline, { flex: 1 }]}>
            A PRÉVIA DESTA FAIXA EXPIROU — TOQUE PARA TENTAR DE NOVO
          </Text>
        </View>
      </View>
    );
  }

  const duracao = Math.max(0, trechoFim - trechoInicio);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (
        status.currentTime < trechoInicio ||
        status.currentTime >= trechoFim
      ) {
        player.seekTo(trechoInicio).catch(() => {});
      }
      player.play();
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.linha}>
        <Pressable
          onPress={toggle}
          hitSlop={hitSlops.botao}
          style={styles.playBtn}
        >
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={20}
            color={colors.ruby}
          />
        </Pressable>

        <View style={styles.controle}>
          <RangeSlider
            min={0}
            max={TRECHO_MAX_S}
            step={1}
            minGap={TRECHO_MIN_S}
            inicio={trechoInicio}
            fim={trechoFim}
            progresso={status.currentTime}
            onChange={aplicarTrecho}
          />
          <View style={styles.marcas}>
            <Text style={styles.marca}>{mmss(0)}</Text>
            <Text style={styles.marca}>{mmss(TRECHO_MAX_S / 2)}</Text>
            <Text style={styles.marca}>{mmss(TRECHO_MAX_S)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.trecho}>
        Trecho · {mmss(trechoInicio)} → {mmss(trechoFim)} · vídeo de {duracao}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 4,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  playBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  controle: {
    flex: 1,
  },
  marcas: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -6,
  },
  marca: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 1,
  },
  trecho: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 2,
  },
  offline: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 11,
  },
});

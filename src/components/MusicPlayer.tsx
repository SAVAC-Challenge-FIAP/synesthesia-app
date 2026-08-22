import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RangeSlider } from '@/components/RangeSlider';
import { colors, fonts, hitSlops, radii } from '@/theme/tokens';
import { MusicSuggestion } from '@/types';

/** A prévia do Deezer tem 30s — é o teto do que dá para recortar. */
export const TRECHO_MAX_S = 30;

/** Piso do recorte: abaixo disso o vídeo não dá tempo de ser visto. */
export const TRECHO_MIN_S = 5;

/**
 * Espera máxima por uma prévia remota antes de declará-la expirada (T102).
 *
 * Generoso de propósito: 10s cobre 3G ruim sem nunca chegar ao "para sempre"
 * que o QA viu. Passando disso, a tela diz o que houve e oferece recarregar,
 * em vez de girar calada.
 */
const TIMEOUT_PREVIA_MS = 10_000;

/** `0:07`, `1:05` — o formato das marcas no Figma (nó 462-926). */
export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return `${m}:${String(seg).padStart(2, '0')}`;
}

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
  /**
   * Caminho local do .mp3 já baixado, quando existe (T102). Tem precedência
   * sobre `musica.previewUrl`: o link do Deezer expira e depende de rede a cada
   * reabertura, e era isso que deixava a trilha de uma mídia reaberta pela
   * galeria carregando para sempre. Ausente = mídia antiga ou trilha ainda não
   * salva; aí a URL remota segue valendo, agora com falha visível.
   */
  audioUri?: string | null;
}

/**
 * Player do trecho sonoro (FR-006/FR-008): recorta a prévia de 30s no pedaço
 * que vira vídeo. Monte com `key={musica.id}` para recriar o player ao trocar
 * de faixa.
 *
 * Segue o Figma (nó 462-926): **um trilho com duas bolinhas**, marcas de tempo
 * embaixo e a legenda `Trecho · 0:00 → 0:15`. Duas versões anteriores erraram
 * aqui — primeiro um slider único que definia só o início e ficava parado
 * enquanto a música tocava, depois dois sliders empilhados, que resolviam a
 * função mas não são o padrão que o mercado usa nem o que o design pede.
 */
export function MusicPlayer({
  musica,
  trechoInicio,
  trechoFim,
  onTrecho,
  ativo = true,
  audioUri,
}: Props) {
  /**
   * Arquivo local primeiro, link do Deezer como reserva (T102). A ordem é o
   * conserto: `previewUrl` é uma URL assinada e temporária — mídia recente
   * ainda tocava, mídia de dias atrás não, e o player não tinha como distinguir
   * "carregando" de "nunca vai carregar".
   */
  const fonte = audioUri ?? musica.previewUrl;
  const player = useAudioPlayer(fonte);
  const status = useAudioPlayerStatus(player);

  /**
   * Prévia que não carrega em tempo hábil (T102).
   *
   * Sem isto, uma fonte morta deixava o botão de play mudo e o trilho parado,
   * sem nada na tela dizendo o que houve — o sintoma de "carregando para
   * sempre" que o QA relatou. Só vale para a fonte remota: um arquivo local
   * ou carrega ou estoura na hora.
   */
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

  // A reprodução respeita o FIM ESCOLHIDO, não os 30s da prévia: era isso que
  // fazia a música seguir tocando para além do recorte e parar sozinha no fim
  // do arquivo, em vez de demarcar o trecho selecionado.
  useEffect(() => {
    if (status.playing && status.currentTime >= trechoFim) {
      player.pause();
      player.seekTo(trechoInicio).catch(() => {});
    }
  }, [status.playing, status.currentTime, player, trechoInicio, trechoFim]);

  // Perdeu a vez: cala a boca na hora (T044).
  useEffect(() => {
    if (!ativo) player.pause();
  }, [ativo, player]);

  // Estável para não recriar os PanResponder do RangeSlider a cada tick do status
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
        <Text style={styles.offline}>PRÉVIA INDISPONÍVEL OFFLINE — o trecho será definido ao reconectar</Text>
      </View>
    );
  }

  // A prévia remota morreu (T102). O momento não se perde — imagem, look e
  // trecho continuam de pé; só a metade sonora precisa de rede para voltar.
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
      // Fora do recorte? Começa do início dele — tocar é ouvir o trecho.
      if (status.currentTime < trechoInicio || status.currentTime >= trechoFim) {
        player.seekTo(trechoInicio).catch(() => {});
      }
      player.play();
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.linha}>
        <Pressable onPress={toggle} hitSlop={hitSlops.botao} style={styles.playBtn}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={colors.ruby} />
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
        Trecho · {mmss(trechoInicio)} → {mmss(trechoFim)}  ·  vídeo de {duracao}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 4,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Quadrado arredondado amber com o ícone em ruby — como no Figma
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controle: {
    flex: 1,
  },
  marcas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    textAlign: 'center',
    marginTop: 2,
  },
  offline: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 11,
  },
});

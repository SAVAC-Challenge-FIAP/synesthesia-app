import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { vibeById } from '@/constants/vibes';
import { getSuggestions } from '@/services/music';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { colors, fonts, radii } from '@/theme/tokens';
import { MusicSuggestion } from '@/types';

/**
 * Modal "Trocar música" (US4) — superfície clara (parchment) do Figma.
 * Confirmar aplica a escolha; Cancelar não muda nada (constituição II).
 */
export function MusicSheet({ onClose }: { onClose: () => void }) {
  const session = useCaptureStore((s) => s.session);
  const patch = useCaptureStore((s) => s.patch);

  const [escolhida, setEscolhida] = useState<MusicSuggestion | null>(session?.musica ?? null);
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Busca sob demanda quando o usuário abriu sem sugestões prontas
  useEffect(() => {
    const s = useCaptureStore.getState().session;
    if (!s || s.sugestoes.length > 0 || s.carregandoSugestoes) return;
    patch({ carregandoSugestoes: true });
    getSuggestions(vibeById(s.vibeId))
      .then((sugestoes) => patch({ sugestoes, carregandoSugestoes: false }))
      .catch(() => patch({ carregandoSugestoes: false }));
  }, [patch]);

  if (!session) return null;
  const vibe = vibeById(session.vibeId);

  const tocar = (m: MusicSuggestion) => {
    if (!m.previewUrl) return;
    if (tocandoId === m.id && status.playing) {
      player.pause();
      setTocandoId(null);
      return;
    }
    player.replace(m.previewUrl);
    player.play();
    setTocandoId(m.id);
  };

  const confirmar = () => {
    player.pause();
    if (escolhida) patch({ musica: escolhida, trechoInicio: 0, trechoFim: 30 });
    onClose();
  };

  const cancelar = () => {
    player.pause();
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cancelar}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>
            {vibe.emoji} VIBE {vibe.nome.toUpperCase()}
          </Text>
          <Text style={styles.title}>Escolha a vibe sonora.</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {session.carregandoSugestoes ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.ruby} />
                <Text style={styles.loadingText}>BUSCANDO SUGESTÕES...</Text>
              </View>
            ) : session.sugestoes.length === 0 ? (
              <Text style={styles.loadingText}>
                Sem sugestões agora (verifique a conexão). Você pode salvar sem áudio.
              </Text>
            ) : (
              session.sugestoes.map((m) => {
                const selecionada = escolhida?.id === m.id;
                const tocando = tocandoId === m.id && status.playing;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.item, selecionada && styles.itemAtiva]}
                    onPress={() => setEscolhida(m)}
                  >
                    <Text style={styles.itemEmoji}>{m.emoji}</Text>
                    <View style={styles.itemText}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {m.titulo}
                      </Text>
                      <Text style={styles.itemArtist} numberOfLines={1}>
                        {m.artista}
                      </Text>
                      <Text style={styles.itemReason} numberOfLines={2}>
                        {m.justificativa}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => tocar(m)}
                      hitSlop={8}
                      style={[styles.playBtn, !m.previewUrl && { opacity: 0.3 }]}
                    >
                      <Text style={styles.playIcon}>{tocando ? '❚❚' : '▶'}</Text>
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={cancelar}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, !escolhida && { opacity: 0.4 }]}
              disabled={!escolhida}
              onPress={confirmar}
            >
              <Text style={styles.confirmText}>Confirmar escolha</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,5,6,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.parchment,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  kicker: {
    color: colors.ruby,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    marginBottom: 14,
  },
  list: {
    flexGrow: 0,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    color: 'rgba(9,5,6,0.6)',
    fontFamily: fonts.monoLight,
    fontSize: 11,
    letterSpacing: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(9,5,6,0.15)',
    borderRadius: radii.card,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  itemAtiva: {
    borderColor: colors.ruby,
    borderWidth: 2,
  },
  itemEmoji: {
    fontSize: 22,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    color: colors.ink,
    fontFamily: fonts.monoMedium,
    fontSize: 13,
  },
  itemArtist: {
    color: 'rgba(9,5,6,0.65)',
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  itemReason: {
    color: 'rgba(9,5,6,0.5)',
    fontFamily: fonts.monoLight,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ruby,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: colors.parchment,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(9,5,6,0.3)',
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  confirm: {
    flex: 1.4,
    backgroundColor: colors.ruby,
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 14,
  },
});

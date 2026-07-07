import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { FilterCarousel } from '@/components/FilterCarousel';
import { FilteredImage } from '@/components/FilteredImage';
import { MusicPlayer, TRECHO_MAX_S } from '@/components/MusicPlayer';
import { MusicSheet } from '@/components/MusicSheet';
import { PostSheet } from '@/components/PostSheet';
import { filterById } from '@/constants/filters';
import { vibeById } from '@/constants/vibes';
import { getSuggestions } from '@/services/music';
import { persistPhoto } from '@/services/mediaStorage';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { colors, fonts, radii, sizes } from '@/theme/tokens';
import { Media } from '@/types';

/**
 * Modal de Captura (US3/US4/US5): pacote sensorial em edição — foto + filtro
 * + música + trecho. Salvar/Postar preservam a unidade aprovada (RN-001).
 */
export function CaptureSheet() {
  const session = useCaptureStore((s) => s.session);
  const patch = useCaptureStore((s) => s.patch);
  const clear = useCaptureStore((s) => s.clear);
  const add = useGalleryStore((s) => s.add);
  const update = useGalleryStore((s) => s.update);
  const sugestaoAutomatica = useSettingsStore((s) => s.sugestaoAutomatica);

  const previewRef = useRef<View>(null);
  const [showMusic, setShowMusic] = useState(false);
  const [shareUri, setShareUri] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const photoUri = session?.photoUri;

  // Curadoria musical fora do caminho crítico do frame (constituição III)
  useEffect(() => {
    if (!photoUri) return;
    const { session: s } = useCaptureStore.getState();
    if (!s || s.sugestoes.length > 0 || s.carregandoSugestoes) return;
    if (!sugestaoAutomatica) return;
    patch({ carregandoSugestoes: true });
    getSuggestions(vibeById(s.vibeId))
      .then((sugestoes) => {
        const atual = useCaptureStore.getState().session;
        if (!atual || atual.photoUri !== photoUri) return;
        const primeira =
          sugestoes.find((m) => m.previewUrl) ?? sugestoes[0] ?? null;
        patch({
          sugestoes,
          carregandoSugestoes: false,
          // Redução do atrito: o sistema decide, o usuário refina (US3)
          ...(atual.musica === null && atual.mediaId === null ? { musica: primeira } : {}),
        });
      })
      .catch(() => patch({ carregandoSugestoes: false }));
  }, [photoUri, sugestaoAutomatica, patch]);

  if (!session) return null;

  const filtro = filterById(session.filtroId);
  const vibe = vibeById(session.vibeId);
  const editando = session.mediaId !== null;

  const renderizarComFiltro = async (): Promise<string> => {
    try {
      return await captureRef(previewRef, { format: 'jpg', quality: 0.92 });
    } catch {
      return session.photoUri;
    }
  };

  const salvar = async (fechar: boolean): Promise<Media | null> => {
    if (salvando) return null;
    setSalvando(true);
    try {
      let media: Media;
      if (session.mediaId) {
        media = {
          id: session.mediaId,
          photoUri: session.photoUri,
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          criadaEm: 0,
          atualizadaEm: Date.now(),
        };
        update(session.mediaId, {
          filtroId: session.filtroId,
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
        });
      } else {
        const id = `${Date.now()}`;
        const uriPersistente = persistPhoto(session.photoUri, id);
        media = {
          id,
          photoUri: uriPersistente,
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          criadaEm: Date.now(),
          atualizadaEm: Date.now(),
        };
        add(media);
        patch({ mediaId: id, photoUri: uriPersistente });
        // Exporta a versão com filtro para a galeria do sistema
        try {
          const renderizada = await renderizarComFiltro();
          await MediaLibrary.saveToLibraryAsync(renderizada);
        } catch {
          // sem permissão de escrita — a mídia segue salva no app
        }
      }
      if (fechar) clear();
      return media;
    } finally {
      setSalvando(false);
    }
  };

  const postar = async () => {
    const renderizada = await renderizarComFiltro();
    await salvar(false);
    setShareUri(renderizada);
  };

  const descartar = () => {
    if (editando) {
      clear();
      return;
    }
    Alert.alert('Descartar captura?', 'A foto e o pacote sensorial serão perdidos.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: clear },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={descartar}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{editando ? 'Lapidar.' : 'Captura.'}</Text>
            <Pressable onPress={descartar} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Foto com o filtro aplicado (frame ~735/913 do Figma) */}
            <View ref={previewRef} collapsable={false} style={styles.previewShot}>
              <FilteredImage
                uri={session.photoUri}
                filtroId={session.filtroId}
                style={styles.preview}
              />
            </View>

            <View style={styles.filtroRow}>
              <Text style={styles.sectionLabel}>FILTRO</Text>
              <Text style={styles.filtroAtual}>
                {filtro.emoji} {filtro.nome.toUpperCase()} · VIBE {vibe.nome.toUpperCase()}
              </Text>
            </View>
            <View style={styles.carouselWrap}>
              <FilterCarousel
                ativo={session.filtroId}
                onSelect={(id) => patch({ filtroId: id })}
              />
            </View>

            {/* Música: a outra metade do pacote sensorial */}
            <Text style={[styles.sectionLabel, { paddingHorizontal: 20, marginTop: 18 }]}>
              TRILHA SONORA
            </Text>
            <View style={styles.musicBox}>
              {session.carregandoSugestoes ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.amber} />
                  <Text style={styles.loadingText}>CURANDO A TRILHA DA SUA VIBE...</Text>
                </View>
              ) : session.musica ? (
                <>
                  <View style={styles.musicHeader}>
                    <Text style={styles.musicEmoji}>{session.musica.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.musicTitle} numberOfLines={1}>
                        {session.musica.titulo}
                      </Text>
                      <Text style={styles.musicArtist} numberOfLines={1}>
                        {session.musica.artista}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.musicReason}>{session.musica.justificativa}</Text>
                  <MusicPlayer
                    key={session.musica.id}
                    musica={session.musica}
                    trechoInicio={session.trechoInicio}
                    onTrechoInicio={(s) =>
                      patch({ trechoInicio: s, trechoFim: TRECHO_MAX_S })
                    }
                  />
                  <View style={styles.musicActions}>
                    <Pressable style={styles.musicBtn} onPress={() => setShowMusic(true)}>
                      <Text style={styles.musicBtnText}>TROCAR MÚSICA</Text>
                    </Pressable>
                    <Pressable
                      style={styles.musicBtn}
                      onPress={() => patch({ musica: null })}
                    >
                      <Text style={[styles.musicBtnText, { color: colors.parchment50 }]}>
                        REMOVER ÁUDIO
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.semAudio}>
                  <Text style={styles.semAudioText}>
                    {session.sugestoes.length > 0
                      ? 'Sem áudio — o pacote será salvo só com a imagem.'
                      : 'Sem sugestões no momento — você pode salvar só a imagem.'}
                  </Text>
                  <Pressable style={styles.musicBtn} onPress={() => setShowMusic(true)}>
                    <Text style={styles.musicBtnText}>
                      {session.sugestoes.length > 0 ? 'ESCOLHER MÚSICA' : 'BUSCAR MÚSICA'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.action, styles.actionSalvar]}
              disabled={salvando}
              onPress={() => salvar(true)}
            >
              <Text style={styles.actionText}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
            </Pressable>
            <Pressable
              style={[styles.action, styles.actionPostar]}
              disabled={salvando}
              onPress={postar}
            >
              <Text style={[styles.actionText, { color: colors.ink }]}>Postar agora</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {showMusic ? <MusicSheet onClose={() => setShowMusic(false)} /> : null}
      {shareUri ? (
        <PostSheet
          shareUri={shareUri}
          onClose={() => {
            setShareUri(null);
            clear();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,5,6,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '94%',
    backgroundColor: colors.ink,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 26,
  },
  close: {
    color: colors.parchment50,
    fontSize: 20,
    padding: 4,
  },
  scroll: {
    paddingBottom: 16,
  },
  previewShot: {
    marginHorizontal: 20,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    aspectRatio: sizes.photoAspect,
    borderRadius: radii.card,
  },
  filtroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 10,
    letterSpacing: 2,
  },
  filtroAtual: {
    color: colors.amber,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
  },
  carouselWrap: {
    marginHorizontal: 4,
  },
  musicBox: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.parchment25,
    padding: 14,
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.amber,
    fontFamily: fonts.monoLight,
    fontSize: 11,
    letterSpacing: 1,
  },
  musicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  musicEmoji: {
    fontSize: 24,
  },
  musicTitle: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 14,
  },
  musicArtist: {
    color: colors.parchment50,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  musicReason: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 11,
    fontStyle: 'italic',
  },
  musicActions: {
    flexDirection: 'row',
    gap: 10,
  },
  musicBtn: {
    borderWidth: 1,
    borderColor: colors.parchment25,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  musicBtnText: {
    color: colors.amber,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  semAudio: {
    gap: 10,
    alignItems: 'flex-start',
  },
  semAudioText: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 11,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.parchment25,
  },
  action: {
    flex: 1,
    borderRadius: radii.card,
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionSalvar: {
    backgroundColor: colors.ruby,
  },
  actionPostar: {
    backgroundColor: colors.amber,
  },
  actionText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 15,
  },
});

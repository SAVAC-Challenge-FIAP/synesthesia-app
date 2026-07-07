import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureSheet } from '@/components/CaptureSheet';
import { FilteredImage } from '@/components/FilteredImage';
import { vibeById } from '@/constants/vibes';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { colors, fonts, radii, sizes } from '@/theme/tokens';
import { Media } from '@/types';

/**
 * Galeria inteligente (US7): pacotes sensoriais persistentes — revisitar,
 * lapidar (reabrir edição) e excluir com confirmação (FR-012).
 */
export default function GalleryScreen() {
  const router = useRouter();
  const medias = useGalleryStore((s) => s.medias);
  const remove = useGalleryStore((s) => s.remove);
  const start = useCaptureStore((s) => s.start);
  const session = useCaptureStore((s) => s.session);

  const lapidar = (m: Media) => {
    start({
      mediaId: m.id,
      photoUri: m.photoUri,
      filtroId: m.filtroId,
      vibeId: m.vibeId,
      musica: m.musica,
      trechoInicio: m.trechoInicio,
      trechoFim: m.trechoFim,
    });
  };

  const excluir = (m: Media) => {
    Alert.alert(
      'Excluir mídia?',
      'A exclusão é permanente: foto, filtro e música deste pacote serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => remove(m.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Galeria.</Text>
        <Text style={styles.count}>
          {medias.length} {medias.length === 1 ? 'PACOTE' : 'PACOTES'}
        </Text>
      </View>

      {medias.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏞️</Text>
          <Text style={styles.emptyText}>
            Nada por aqui ainda.{'\n'}Capture uma cena e o pacote sensorial aparece nesta galeria.
          </Text>
        </View>
      ) : (
        <FlatList
          data={medias}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const vibe = vibeById(item.vibeId);
            return (
              <Pressable
                style={styles.card}
                onPress={() => lapidar(item)}
                onLongPress={() => excluir(item)}
              >
                <FilteredImage uri={item.photoUri} filtroId={item.filtroId} style={styles.photo} />
                <View style={styles.meta}>
                  <Text style={styles.metaVibe}>
                    {vibe.emoji} {vibe.nome.toUpperCase()}
                  </Text>
                  <Text style={styles.metaMusic} numberOfLines={1}>
                    {item.musica ? `🎵 ${item.musica.titulo}` : 'SEM ÁUDIO'}
                  </Text>
                </View>
                <Pressable style={styles.trash} hitSlop={8} onPress={() => excluir(item)}>
                  <Text style={styles.trashIcon}>🗑️</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {session ? <CaptureSheet /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  back: {
    color: colors.parchment,
    fontSize: 32,
    lineHeight: 34,
  },
  title: {
    flex: 1,
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 28,
  },
  count: {
    color: colors.amber,
    fontFamily: fonts.monoLight,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
  },
  card: {
    flex: 1,
    marginBottom: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: 'hidden',
    backgroundColor: 'rgba(141,21,20,0.12)',
  },
  photo: {
    width: '100%',
    aspectRatio: sizes.photoAspect,
  },
  meta: {
    padding: 10,
    gap: 4,
  },
  metaVibe: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  metaMusic: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 10,
  },
  trash: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(9,5,6,0.6)',
    borderRadius: 14,
    padding: 5,
  },
  trashIcon: {
    fontSize: 13,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyText: {
    color: colors.parchment50,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});

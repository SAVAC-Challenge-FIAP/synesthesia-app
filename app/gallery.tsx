import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilteredImage } from '@/components/FilteredImage';
import { FundoBase } from '@/components/FundoBase';
import { vibeById } from '@/constants/vibes';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { colors, fonts, hitSlops, radii, sizes } from '@/theme/tokens';
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

  const lapidar = (m: Media) => {
    start({
      mediaId: m.id,
      photoUri: m.photoUri,
      filtroId: m.filtroId,
      filtroAuto: false, // edição preserva o filtro salvo; só o usuário troca
      vibeId: m.vibeId,
      musica: m.musica,
      // O leque de opções volta com o pacote (T083): reabrir não dispara
      // curadoria nenhuma, e "Trocar música" já abre com as quatro faixas.
      sugestoes: m.sugestoes ?? [],
      trechoInicio: m.trechoInicio,
      trechoFim: m.trechoFim,
      // Mídias salvas antes do T066 não têm `aspecto`; o padrão é exatamente a
      // proporção com que elas foram criadas, então reabrir não as deforma.
      aspecto: m.aspecto ?? sizes.photoAspect,
    });
    // Empurra para a tela de captura. Enquanto o `CaptureSheet` era `<Modal>`,
    // bastava a galeria renderizá-lo quando houvesse sessão: o Modal desenhava
    // na própria janela, por cima. Virando corpo de tela (T063), o mesmo JSX
    // passou a ser conteúdo no fluxo normal — ia parar embaixo da lista, fora
    // da vista, e reabrir uma mídia deixou de funcionar sem erro nenhum.
    router.push('/capture');
  };

  const excluir = (m: Media) => {
    Alert.alert(
      'Excluir mídia?',
      'A exclusão é permanente: foto, filtro e música deste momento serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => remove(m.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <FundoBase />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={30} color={colors.parchment} />
        </Pressable>
        <Text style={styles.title}>Galeria.</Text>
        <Text style={styles.count}>
          {medias.length} {medias.length === 1 ? 'MOMENTO' : 'MOMENTOS'}
        </Text>
      </View>

      {medias.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏞️</Text>
          <Text style={styles.emptyText}>
            Nada por aqui ainda.{'\n'}Capture uma cena e o momento aparece nesta galeria.
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
                  <View style={styles.metaMusicRow}>
                    {item.musica ? (
                      <Ionicons name="musical-notes" size={11} color={colors.parchment50} />
                    ) : null}
                    <Text style={styles.metaMusic} numberOfLines={1}>
                      {item.musica ? item.musica.titulo : 'SEM ÁUDIO'}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.trash} hitSlop={hitSlops.icone} onPress={() => excluir(item)}>
                  <Ionicons name="trash-outline" size={15} color={colors.parchment} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

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
    fontFamily: fonts.labelLight,
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
  /**
   * Vitrine uniforme (T082): todo card é quadrado, independentemente do
   * enquadramento com que a foto foi tirada. A grade antes usava a proporção de
   * cada mídia, e uma 16:9 ao lado de uma 1:1 deixava a coluna serrilhada.
   *
   * A proporção real não se perde: ela continua em `Media.aspecto` e é ela que
   * manda na tela de captura. Aqui é só miniatura.
   */
  card: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: 'hidden',
    backgroundColor: 'rgba(141,21,20,0.12)',
  },
  /**
   * A `FilteredImage` desenha a foto em `absoluteFill` — ela precisa de um
   * container com altura própria. Este estilo declarava só `width: '100%'`, sem
   * altura: cada card ficava com 0px de foto, e foi por isso que as prévias
   * sumiram da galeria (T081).
   */
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  /**
   * Com o card quadrado, os metadados passam a flutuar sobre o rodapé da foto —
   * antes eles ocupavam altura própria e disputavam espaço com a imagem.
   */
  meta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    gap: 4,
    backgroundColor: 'rgba(9,5,6,0.62)',
  },
  metaVibe: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  metaMusicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaMusic: {
    flex: 1,
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
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
    fontFamily: fonts.label,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});

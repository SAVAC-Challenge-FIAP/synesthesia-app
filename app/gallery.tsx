/**
 * @docs docs/components/gallery.md
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FilteredImage } from "@/components/FilteredImage";
import { FundoBase } from "@/components/FundoBase";
import { vibeById } from "@/constants/vibes";
import { looksDeMidiaAntiga } from "@/services/looks";
import { cacheAudioPreview } from "@/services/mediaStorage";
import { useCaptureStore } from "@/stores/useCaptureStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { colors, fonts, hitSlops, radii, sizes } from "@/theme/tokens";
import { Media } from "@/types";

export default function GalleryScreen() {
  const router = useRouter();
  const medias = useGalleryStore((s) => s.medias);
  const remove = useGalleryStore((s) => s.remove);
  const start = useCaptureStore((s) => s.start);

  const lapidar = (m: Media) => {
    const antiga = m.looks?.length
      ? null
      : looksDeMidiaAntiga(m.filtroId, m.vibeId);
    start({
      mediaId: m.id,
      photoUri: m.photoUri,
      filtroId: m.filtroId,
      filtroAuto: false,
      vibeId: m.vibeId,

      vibe: m.vibe,
      musica: m.musica,

      audioUri: m.audioUri ?? null,

      looks: antiga ? antiga.looks : (m.looks ?? []),
      lookEscolhido: antiga ? antiga.escolhido : (m.lookEscolhido ?? null),

      sugestoes: m.sugestoes ?? [],
      trechoInicio: m.trechoInicio,
      trechoFim: m.trechoFim,

      aspecto: m.aspecto ?? sizes.photoAspect,
    });
    for (const s of m.sugestoes ?? []) {
      if (s.id !== m.musica?.id) {
        cacheAudioPreview(s.previewUrl, s.id).catch(() => {});
      }
    }

    router.push("/capture");
  };

  const voltar = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/camera");
    return true;
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", voltar);
      return () => sub.remove();
    }, [voltar]),
  );

  const excluir = (m: Media) => {
    Alert.alert(
      "Excluir mídia?",
      "A exclusão é permanente: foto, filtro e música deste momento serão removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => remove(m.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <FundoBase />
      <View style={styles.header}>
        {}
        <Pressable onPress={voltar} hitSlop={12}>
          <Ionicons name="chevron-back" size={30} color={colors.parchment} />
        </Pressable>
        <Text style={styles.title}>Galeria.</Text>
        <Text style={styles.count}>
          {medias.length} {medias.length === 1 ? "MOMENTO" : "MOMENTOS"}
        </Text>
      </View>

      {medias.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏞️</Text>
          <Text style={styles.emptyText}>
            Nada por aqui ainda.{"\n"}Capture uma cena e o momento aparece nesta
            galeria.
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
            const rotuloVibe = item.vibe
              ? item.vibe.toUpperCase()
              : `${vibe.emoji} ${vibe.nome.toUpperCase()}`;
            return (
              <Pressable
                style={styles.card}
                onPress={() => lapidar(item)}
                onLongPress={() => excluir(item)}
              >
                <FilteredImage
                  uri={item.photoUri}
                  filtroId={item.filtroId}
                  style={styles.photo}
                />
                <View style={styles.meta}>
                  <Text style={styles.metaVibe} numberOfLines={1}>
                    {rotuloVibe}
                  </Text>
                  <View style={styles.metaMusicRow}>
                    {item.musica ? (
                      <Ionicons
                        name="musical-notes"
                        size={11}
                        color={colors.parchment50}
                      />
                    ) : null}
                    <Text style={styles.metaMusic} numberOfLines={1}>
                      {item.musica ? item.musica.titulo : "SEM ÁUDIO"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.trash}
                  hitSlop={hitSlops.icone}
                  onPress={() => excluir(item)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={15}
                    color={colors.parchment}
                  />
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
    flexDirection: "row",
    alignItems: "center",
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
  card: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: "hidden",
    backgroundColor: "rgba(141,21,20,0.12)",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  meta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    gap: 4,
    backgroundColor: "rgba(9,5,6,0.62)",
  },
  metaVibe: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  metaMusicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaMusic: {
    flex: 1,
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 10,
  },
  trash: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(9,5,6,0.6)",
    borderRadius: 14,
    padding: 5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    textAlign: "center",
  },
});

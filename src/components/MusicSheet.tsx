/**
 * @docs docs/components/MusicSheet.md
 */
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { vibeById } from "@/constants/vibes";
import { LoaderMarca } from "@/components/LoaderMarca";
import { getSuggestions } from "@/services/music";
import { audioEmCache } from "@/services/mediaStorage";
import { useCaptureStore } from "@/stores/useCaptureStore";
import { useTasteStore } from "@/stores/useTasteStore";
import { colors, fonts, hitSlops, radii } from "@/theme/tokens";
import { MusicSuggestion, PapelFaixa } from "@/types";

const PAPEL_ROTULO: Record<PapelFaixa, string> = {
  afinidade: "DO SEU GOSTO",
  certeira: "CERTEIRA",
  descoberta: "DESCOBERTA",
  curinga: "CURINGA",
};

const PAPEL_ESTILO: Record<PapelFaixa, { color: string }> = {
  afinidade: { color: colors.ruby },
  certeira: { color: "rgba(9,5,6,0.45)" },

  descoberta: { color: "#8A5A00" },
  curinga: { color: "rgba(9,5,6,0.45)" },
};

const TIMEOUT_PREVIA_MS = 10_000;

export function MusicSheet({ onClose }: { onClose: () => void }) {
  const session = useCaptureStore((s) => s.session);
  const patch = useCaptureStore((s) => s.patch);
  const registrarEscolha = useTasteStore((s) => s.registrarEscolha);

  const insets = useSafeAreaInsets();
  const [escolhida, setEscolhida] = useState<MusicSuggestion | null>(
    session?.musica ?? null,
  );
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const [expiradasIds, setExpiradasIds] = useState<Set<string>>(new Set());
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status.isLoaded && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [status.isLoaded]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    const s = useCaptureStore.getState().session;
    if (!s || s.sugestoes.length > 0 || s.curadoria === "carregando") return;
    patch({ curadoria: "carregando" });
    getSuggestions(vibeById(s.vibeId))
      .then((sugestoes) =>
        patch({
          sugestoes,

          curadoria: useCaptureStore.getState().session?.musica
            ? "pronta"
            : "indisponivel",
        }),
      )
      .catch(() => patch({ curadoria: "indisponivel" }));
  }, [patch]);

  if (!session) return null;
  const vibe = vibeById(session.vibeId);

  const tocar = (m: MusicSuggestion) => {
    const fonteJaBaixada =
      session.musica?.id === m.id ? session.audioUri : null;
    const fonte = fonteJaBaixada ?? audioEmCache(m.id) ?? m.previewUrl;
    if (!fonte) return;
    if (tocandoId === m.id && status.playing) {
      player.pause();
      setTocandoId(null);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setExpiradasIds((atual) => {
      if (!atual.has(m.id)) return atual;
      const proximo = new Set(atual);
      proximo.delete(m.id);
      return proximo;
    });
    player.replace(fonte);
    player.play();
    setTocandoId(m.id);
    timeoutRef.current = setTimeout(() => {
      setTocandoId((atual) => (atual === m.id ? null : atual));
      setExpiradasIds((atual) => new Set(atual).add(m.id));
    }, TIMEOUT_PREVIA_MS);
  };

  const confirmar = () => {
    player.pause();

    if (escolhida) {
      patch({ musica: escolhida, curadoria: "pronta", audioUri: null });

      registrarEscolha(escolhida, session.vibeId, "manual");
    }
    onClose();
  };

  const cancelar = () => {
    player.pause();
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cancelar}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 8, 28) },
          ]}
        >
          {}
          <Text style={styles.kicker} numberOfLines={1}>
            {session.vibe
              ? `VIBE ${session.vibe.toUpperCase()}`
              : `${vibe.emoji} VIBE ${vibe.nome.toUpperCase()}`}
          </Text>
          <Text style={styles.title}>Escolha a vibe sonora.</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {session.curadoria === "carregando" ? (
              <View style={styles.loading}>
                <LoaderMarca tamanho={30} />
                <Text style={styles.loadingText}>BUSCANDO SUGESTÕES...</Text>
              </View>
            ) : session.sugestoes.length === 0 ? (
              <Text style={styles.loadingText}>
                Sem sugestões agora (verifique a conexão). Você pode salvar sem
                áudio.
              </Text>
            ) : (
              session.sugestoes.map((m) => {
                const selecionada = escolhida?.id === m.id;
                const tocando = tocandoId === m.id && status.playing;
                const carregando =
                  tocandoId === m.id && !status.isLoaded && !status.playing;
                const expirada = expiradasIds.has(m.id);
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.item, selecionada && styles.itemAtiva]}
                    onPress={() => setEscolhida(m)}
                  >
                    <Text style={styles.itemEmoji}>{m.emoji}</Text>
                    <View style={styles.itemText}>
                      {m.papel ? (
                        <Text style={[styles.itemPapel, PAPEL_ESTILO[m.papel]]}>
                          {PAPEL_ROTULO[m.papel]}
                        </Text>
                      ) : null}
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
                      accessibilityLabel={
                        expirada
                          ? "Prévia expirou, toque para tentar de novo"
                          : undefined
                      }
                      style={[
                        styles.playBtn,
                        !m.previewUrl && { opacity: 0.3 },
                      ]}
                    >
                      {carregando ? (
                        <ActivityIndicator size="small" color={colors.parchment} />
                      ) : (
                        <Ionicons
                          name={
                            expirada ? "refresh" : tocando ? "pause" : "play"
                          }
                          size={15}
                          color={colors.parchment}
                        />
                      )}
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancel}
              hitSlop={hitSlops.botao}
              onPress={cancelar}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, !escolhida && { opacity: 0.4 }]}
              hitSlop={hitSlops.botao}
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
    backgroundColor: "rgba(9,5,6,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: colors.parchment,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  kicker: {
    color: colors.ruby,
    fontFamily: fonts.labelForte,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    color: "rgba(9,5,6,0.6)",
    fontFamily: fonts.labelLight,
    fontSize: 11,
    letterSpacing: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(9,5,6,0.15)",
    borderRadius: radii.card,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.4)",
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
  itemPapel: {
    fontFamily: fonts.labelForte,
    fontSize: 9,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  itemTitle: {
    color: colors.ink,
    fontFamily: fonts.labelForte,
    fontSize: 13,
  },
  itemArtist: {
    color: "rgba(9,5,6,0.65)",
    fontFamily: fonts.label,
    fontSize: 12,
  },
  itemReason: {
    color: "rgba(9,5,6,0.5)",
    fontFamily: fonts.labelLight,
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ruby,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(9,5,6,0.3)",
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: "center",
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
    alignItems: "center",
  },
  confirmText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 14,
  },
});

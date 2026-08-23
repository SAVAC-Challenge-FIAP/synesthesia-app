/**
 * @docs docs/adr/0013-arquitetura-estado-captura.md
 */
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SharePackage } from "@/services/sharePackage";
import { mimeDoPacote } from "@/services/shareTargets";
import { saveToSystemGallery } from "@/services/systemGallery";
import { colors, fonts, hitSlops, radii } from "@/theme/tokens";

export function PostSheet({
  pacote,
  onClose,
}: {
  pacote: SharePackage;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const temVideo = pacote.videoUri !== null;
  const temTrilha = pacote.musica !== null;

  const arquivo = pacote.videoUri ?? pacote.imageUri;
  const mimeType = mimeDoPacote(temVideo);

  const resultado = temVideo
    ? {
        icone: "checkmark" as const,
        corIlustracao: colors.amber,
        titulo: "Vídeo gerado!",
        conteudo: "IMAGEM + TRILHA NUM SÓ ARQUIVO",
        detalhe: "Escolha para onde vai no compartilhamento do aparelho.",
      }
    : temTrilha
      ? {
          icone: "layers-outline" as const,
          corIlustracao: colors.ruby,
          titulo: "Momento pronto, em duas partes.",
          conteudo: "IMAGEM + ÁUDIO DE 30S + LEGENDA, SEPARADOS",
          detalhe:
            "A imagem vai pelo destino escolhido; a trilha segue nas ações abaixo. O vídeo único imagem+trilha chega na versão final do app.",
        }
      : {
          icone: "image-outline" as const,
          corIlustracao: colors.amber,
          titulo: "Imagem pronta!",
          conteudo: "SÓ A IMAGEM, COMO VOCÊ ESCOLHEU",
          detalhe:
            "A trilha está desativada neste momento. Quer som? Feche, escolha uma música e poste de novo.",
        };
  const [baixando, setBaixando] = useState(false);
  const [baixado, setBaixado] = useState(false);
  const [falhouBaixar, setFalhouBaixar] = useState(false);

  const baixarArquivo = async () => {
    if (!arquivo || baixando) return;
    setBaixando(true);
    setFalhouBaixar(false);
    try {
      const ok = await saveToSystemGallery(
        arquivo,
        temVideo ? "video" : "photo",
      );
      setBaixado(ok);
      setFalhouBaixar(!ok);
    } finally {
      setBaixando(false);
    }
  };

  const postar = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(arquivo, {
          mimeType,
          dialogTitle: "Compartilhar momento",
        });
      }
    } catch {}
  };

  const compartilharAudio = async () => {
    if (!pacote.audioUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pacote.audioUri, {
          mimeType: "audio/mpeg",
          dialogTitle: "Enviar trilha (prévia de 30s)",
        });
      }
    } catch {}
  };

  const compartilharLegenda = async () => {
    if (!pacote.caption) return;
    try {
      await Share.share({ message: pacote.caption });
    } catch {}
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 8, 32) },
          ]}
        >
          {}
          <View
            style={[
              styles.ilustracao,
              { backgroundColor: resultado.corIlustracao },
            ]}
          >
            <Ionicons
              name={resultado.icone}
              size={26}
              color={colors.parchment}
            />
          </View>
          <Text style={styles.title}>{resultado.titulo}</Text>
          {}
          {}
          <Text
            style={[
              styles.conteudo,
              temTrilha && !temVideo && styles.conteudoSemTrilha,
            ]}
          >
            {resultado.conteudo}
          </Text>
          <Text style={styles.subtitle}>{resultado.detalhe}</Text>

          {}
          {arquivo ? (
            <Pressable
              style={[styles.baixar, baixado && styles.baixarFeito]}
              hitSlop={hitSlops.botao}
              disabled={baixando}
              accessibilityRole="button"
              onPress={baixarArquivo}
            >
              <Ionicons
                name={
                  baixado
                    ? "checkmark"
                    : falhouBaixar
                      ? "alert-circle-outline"
                      : "download-outline"
                }
                size={17}
                color={baixado ? "rgba(9,5,6,0.45)" : colors.ink}
              />
              <Text
                style={[styles.baixarText, baixado && styles.baixarTextFeito]}
              >
                {baixando
                  ? "Baixando..."
                  : baixado
                    ? "Salvo na galeria"
                    : falhouBaixar
                      ? "Não deu — tocar de novo"
                      : temVideo
                        ? "Baixar vídeo"
                        : "Baixar imagem"}
              </Text>
            </Pressable>
          ) : null}

          {!temVideo && temTrilha ? (
            <View style={styles.trilhaBox}>
              <Text style={styles.trilhaLabel}>
                TRILHA · {pacote.musica!.titulo.toUpperCase()} —{" "}
                {pacote.musica!.artista.toUpperCase()}
              </Text>
              <View style={styles.trilhaActions}>
                {pacote.audioUri ? (
                  <Pressable
                    style={styles.trilhaBtn}
                    hitSlop={hitSlops.chip}
                    onPress={compartilharAudio}
                  >
                    <Ionicons
                      name="musical-notes"
                      size={12}
                      color={colors.ruby}
                    />
                    <Text style={styles.trilhaBtnText}>ENVIAR ÁUDIO (30S)</Text>
                  </Pressable>
                ) : null}
                {pacote.caption ? (
                  <Pressable
                    style={styles.trilhaBtn}
                    hitSlop={hitSlops.chip}
                    onPress={compartilharLegenda}
                  >
                    <Ionicons
                      name="create-outline"
                      size={13}
                      color={colors.ruby}
                    />
                    <Text style={styles.trilhaBtnText}>ENVIAR LEGENDA</Text>
                  </Pressable>
                ) : null}
              </View>
              {!pacote.audioUri ? (
                <Text style={styles.trilhaAviso}>
                  Prévia de áudio indisponível para esta faixa — a legenda leva
                  a trilha.
                </Text>
              ) : null}
            </View>
          ) : null}

          {}
          <View style={styles.linhaAcoes}>
            <Pressable
              style={[styles.acao, styles.acaoFechar]}
              onPress={onClose}
            >
              <Text style={[styles.acaoText, { color: colors.parchment }]}>
                Fechar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.acao, styles.acaoPostar]}
              accessibilityRole="button"
              onPress={postar}
            >
              <Ionicons name="share-social" size={17} color={colors.ink} />
              <Text style={[styles.acaoText, { color: colors.ink }]}>
                Postar
              </Text>
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
    backgroundColor: colors.parchment,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    padding: 24,
    paddingBottom: 32,
    alignItems: "center",
  },
  ilustracao: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 26,
    marginBottom: 6,
    textAlign: "center",
  },
  conteudo: {
    color: colors.ruby,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 10,
  },
  conteudoSemTrilha: {
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtitle: {
    color: "rgba(9,5,6,0.6)",
    fontFamily: fonts.label,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  baixar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(9,5,6,0.07)",
    borderWidth: 1,
    borderColor: "rgba(9,5,6,0.14)",
    borderRadius: radii.card,
    paddingVertical: 14,
    marginBottom: 12,
  },
  baixarFeito: {
    backgroundColor: "transparent",
    borderColor: "rgba(9,5,6,0.10)",
  },
  baixarText: {
    color: colors.ink,
    fontFamily: fonts.labelForte,
    fontSize: 14,
  },
  baixarTextFeito: {
    color: "rgba(9,5,6,0.45)",
  },
  linhaAcoes: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  acao: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.card,
    paddingVertical: 15,
  },
  acaoFechar: {
    backgroundColor: colors.ruby,
  },

  acaoPostar: {
    backgroundColor: colors.amber,
  },
  acaoText: {
    fontFamily: fonts.display,
    fontSize: 15,
  },
  trilhaBox: {
    width: "100%",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: "rgba(9,5,6,0.15)",
    backgroundColor: "rgba(255,255,255,0.5)",
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  trilhaLabel: {
    color: colors.ink,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  trilhaActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  trilhaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trilhaBtnText: {
    color: colors.ruby,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  trilhaAviso: {
    color: "rgba(9,5,6,0.5)",
    fontFamily: fonts.labelLight,
    fontSize: 10,
    lineHeight: 15,
  },
});

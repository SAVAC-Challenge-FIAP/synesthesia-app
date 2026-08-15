import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SharePackage } from '@/services/sharePackage';
import { saveToSystemGallery } from '@/services/systemGallery';
import { colors, fonts, radii } from '@/theme/tokens';

/**
 * Confirmação de postagem (US8/FR-014): compartilha o pacote sensorial.
 *
 * Honestidade de UI (T-01c): no Expo Go não há FFmpeg, então o pacote sai
 * composto — a imagem vai pelo destino escolhido e a trilha segue como
 * arquivo de áudio (prévia 30s) + legenda. Quando `videoUri` existir
 * (T-07, development build), o mesmo fluxo compartilha o `.mp4` único.
 */
const DESTINOS = [
  { id: 'instagram', nome: 'Instagram', emoji: '📸' },
  { id: 'tiktok', nome: 'TikTok', emoji: '🎵' },
  { id: 'whatsapp', nome: 'WhatsApp', emoji: '💬' },
  { id: 'linkedin', nome: 'LinkedIn', emoji: '💼' },
  { id: 'x', nome: 'X / Twitter', emoji: '🐦' },
  { id: 'mais', nome: 'Mais', emoji: '➕' },
];

export function PostSheet({ pacote, onClose }: { pacote: SharePackage; onClose: () => void }) {
  // Mesmo motivo do CaptureSheet: modal desenha na própria janela, então o
  // espaçamento inferior vem do inset real do aparelho (ver baseline.md T004).
  const insets = useSafeAreaInsets();
  const temVideo = pacote.videoUri !== null;
  const temTrilha = pacote.musica !== null;
  const [baixando, setBaixando] = useState(false);
  const [baixado, setBaixado] = useState(false);

  const baixarVideo = async () => {
    if (!pacote.videoUri || baixando) return;
    setBaixando(true);
    try {
      setBaixado(await saveToSystemGallery(pacote.videoUri));
    } finally {
      setBaixando(false);
    }
  };

  const compartilharPrincipal = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        // Com vídeo gerado (T-07) o pacote inteiro vai num arquivo só;
        // sem ele, vai a imagem — e a trilha segue pelas ações abaixo.
        await Sharing.shareAsync(pacote.videoUri ?? pacote.imageUri, {
          dialogTitle: 'Compartilhar pacote sensorial',
        });
      }
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  const compartilharAudio = async () => {
    if (!pacote.audioUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pacote.audioUri, {
          mimeType: 'audio/mpeg',
          dialogTitle: 'Enviar trilha (prévia de 30s)',
        });
      }
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  const compartilharLegenda = async () => {
    if (!pacote.caption) return;
    try {
      await Share.share({ message: pacote.caption });
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 32) }]}>
          <Text style={styles.emoji}>{temVideo ? '🎬' : '📦'}</Text>
          <Text style={styles.title}>{temVideo ? 'Vídeo gerado!' : 'Pacote pronto!'}</Text>
          <Text style={styles.subtitle}>
            {temVideo
              ? 'Imagem e trilha unidas num só vídeo. Escolha o destino:'
              : temTrilha
                ? 'A imagem vai pelo destino escolhido; a trilha segue como áudio e legenda logo abaixo. O vídeo único imagem+trilha chega na versão final do app.'
                : 'Sua captura vai como imagem, sem trilha. Escolha o destino:'}
          </Text>

          <View style={styles.grid}>
            {DESTINOS.map((d) => (
              <Pressable key={d.id} style={styles.destino} onPress={compartilharPrincipal}>
                <Text style={styles.destinoEmoji}>{d.emoji}</Text>
                <Text style={styles.destinoNome}>{d.nome}</Text>
              </Pressable>
            ))}
          </View>

          {temVideo ? (
            <Pressable
              style={[styles.baixarBtn, baixado && styles.baixarBtnFeito]}
              disabled={baixando}
              onPress={baixarVideo}
            >
              <Text style={styles.baixarBtnText}>
                {baixando ? 'BAIXANDO...' : baixado ? '✓ SALVO NA GALERIA' : '⬇️ BAIXAR VÍDEO'}
              </Text>
            </Pressable>
          ) : null}

          {!temVideo && temTrilha ? (
            <View style={styles.trilhaBox}>
              <Text style={styles.trilhaLabel}>
                TRILHA · {pacote.musica!.titulo.toUpperCase()} — {pacote.musica!.artista.toUpperCase()}
              </Text>
              <View style={styles.trilhaActions}>
                {pacote.audioUri ? (
                  <Pressable style={styles.trilhaBtn} onPress={compartilharAudio}>
                    <Text style={styles.trilhaBtnText}>🎵 ENVIAR ÁUDIO (30S)</Text>
                  </Pressable>
                ) : null}
                {pacote.caption ? (
                  <Pressable style={styles.trilhaBtn} onPress={compartilharLegenda}>
                    <Text style={styles.trilhaBtnText}>✍️ ENVIAR LEGENDA</Text>
                  </Pressable>
                ) : null}
              </View>
              {!pacote.audioUri ? (
                <Text style={styles.trilhaAviso}>
                  Prévia de áudio indisponível para esta faixa — a legenda leva a trilha.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.fechar} onPress={onClose}>
            <Text style={styles.fecharText}>Fechar</Text>
          </Pressable>
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
    backgroundColor: colors.parchment,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    padding: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 26,
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(9,5,6,0.6)',
    fontFamily: fonts.mono,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  destino: {
    width: '30%',
    aspectRatio: 1.15,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(9,5,6,0.15)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  destinoEmoji: {
    fontSize: 24,
  },
  destinoNome: {
    color: colors.ink,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  baixarBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.card,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  baixarBtnFeito: {
    borderColor: 'rgba(9,5,6,0.15)',
  },
  baixarBtnText: {
    color: colors.ruby,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
  },
  trilhaBox: {
    width: '100%',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(9,5,6,0.15)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  trilhaLabel: {
    color: colors.ink,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  trilhaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trilhaBtn: {
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trilhaBtnText: {
    color: colors.ruby,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  trilhaAviso: {
    color: 'rgba(9,5,6,0.5)',
    fontFamily: fonts.monoLight,
    fontSize: 10,
    lineHeight: 15,
  },
  fechar: {
    width: '100%',
    backgroundColor: colors.ruby,
    borderRadius: radii.card,
    paddingVertical: 15,
    alignItems: 'center',
  },
  fecharText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 15,
  },
});

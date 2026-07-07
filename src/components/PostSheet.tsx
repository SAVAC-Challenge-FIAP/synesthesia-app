import * as Sharing from 'expo-sharing';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

/**
 * Confirmação de postagem (US8/FR-014): pacote pronto + grade de destinos.
 * Cada destino dispara o share intent nativo com a imagem filtrada.
 * (A geração do .mp4 imagem+áudio via FFmpeg entra no dev build nativo;
 * no Expo Go compartilhamos a imagem renderizada com o filtro.)
 */
const DESTINOS = [
  { id: 'instagram', nome: 'Instagram', emoji: '📸' },
  { id: 'tiktok', nome: 'TikTok', emoji: '🎵' },
  { id: 'whatsapp', nome: 'WhatsApp', emoji: '💬' },
  { id: 'linkedin', nome: 'LinkedIn', emoji: '💼' },
  { id: 'x', nome: 'X / Twitter', emoji: '🐦' },
  { id: 'mais', nome: 'Mais', emoji: '➕' },
];

export function PostSheet({ shareUri, onClose }: { shareUri: string; onClose: () => void }) {
  const compartilhar = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, { dialogTitle: 'Compartilhar pacote sensorial' });
      }
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>🎬</Text>
          <Text style={styles.title}>Pacote gerado!</Text>
          <Text style={styles.subtitle}>
            Sua captura está salva com filtro e trilha. Escolha o destino:
          </Text>

          <View style={styles.grid}>
            {DESTINOS.map((d) => (
              <Pressable key={d.id} style={styles.destino} onPress={compartilhar}>
                <Text style={styles.destinoEmoji}>{d.emoji}</Text>
                <Text style={styles.destinoNome}>{d.nome}</Text>
              </Pressable>
            ))}
          </View>

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

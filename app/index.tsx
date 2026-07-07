import { useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii } from '@/theme/tokens';

/**
 * Onboarding de permissões (US01/FR-009): justificativa clara + ênfase no
 * processamento local (LGPD) antes de pedir câmera e galeria.
 */
export default function PermissionsScreen() {
  const router = useRouter();
  const [cameraPerm, requestCamera] = useCameraPermissions();
  // Só fotos: o app não acessa mídia de áudio/vídeo. Evita a permissão AUDIO
  // (que exige READ_MEDIA_AUDIO no manifest e é rejeitada no Expo Go).
  const [mediaPerm, requestMedia] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });
  const [negado, setNegado] = useState(false);

  // Android 14+ pode conceder acesso "limitado" (usuário escolhe algumas fotos):
  // isso é suficiente para salvar/compartilhar, então contamos como liberado.
  const mediaOk = (p: MediaLibrary.PermissionResponse | null): boolean =>
    !!p && (p.granted || p.accessPrivileges === 'limited');

  if (cameraPerm?.granted && mediaOk(mediaPerm)) {
    return <Redirect href="/camera" />;
  }

  const permitirTudo = async () => {
    const cam = cameraPerm?.granted ? cameraPerm : await requestCamera();
    const med = mediaOk(mediaPerm) ? mediaPerm : await requestMedia();
    if (cam?.granted && mediaOk(med)) {
      router.replace('/camera');
    } else {
      setNegado(true);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.kicker}>SYNESTHESIA · SAVAC</Text>
        <Text style={styles.title}>Sinta a cena.{'\n'}Ouça a imagem.</Text>
        <Text style={styles.subtitle}>
          Para traduzir a vibe do momento em filtro e trilha sonora, o Synesthesia precisa de dois
          acessos:
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardEmoji}>📸</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>CÂMERA</Text>
            <Text style={styles.cardDesc}>
              Para ler o contexto da cena e aplicar o filtro ao vivo no visor.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEmoji}>🏞️</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>GALERIA</Text>
            <Text style={styles.cardDesc}>
              Para salvar suas capturas com filtro e música, prontas para compartilhar.
            </Text>
          </View>
        </View>

        <Text style={styles.privacy}>
          🔒 Tudo processado no seu celular. Suas imagens não saem do dispositivo sem você mandar.
        </Text>
      </View>

      <View style={styles.footer}>
        {negado ? (
          <>
            <Text style={styles.deniedText}>
              Sem esses acessos a câmera não abre. Você pode liberar nas configurações do sistema.
            </Text>
            <Pressable style={styles.cta} onPress={() => Linking.openSettings()}>
              <Text style={styles.ctaText}>Abrir configurações</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={permitirTudo}>
              <Text style={styles.secondaryText}>Tentar novamente</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.cta} onPress={permitirTudo}>
            <Text style={styles.ctaText}>Permitir tudo</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  kicker: {
    color: colors.amber,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 12,
  },
  subtitle: {
    color: colors.parchment50,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(141,21,20,0.18)',
    borderColor: colors.parchment25,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 26,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 4,
  },
  cardDesc: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 12,
    lineHeight: 18,
  },
  privacy: {
    color: colors.amber,
    fontFamily: fonts.monoLight,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  footer: {
    padding: 24,
    gap: 10,
  },
  cta: {
    backgroundColor: colors.ruby,
    borderRadius: radii.card,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 16,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    color: colors.parchment50,
    fontFamily: fonts.mono,
    fontSize: 13,
  },
  deniedText: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

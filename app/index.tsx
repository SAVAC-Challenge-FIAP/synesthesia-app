import { useCameraPermissions } from 'expo-camera';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  checkSystemGalleryPermission,
  requestSystemGalleryPermission,
  SystemGalleryPermission,
} from '@/services/systemGallery';
import { pedirLocalizacao } from '@/services/contexto';
import { colors, fonts, radii } from '@/theme/tokens';

/**
 * Onboarding de permissões (US01/FR-009): justificativa clara + ênfase no
 * processamento local (LGPD) antes de pedir câmera, galeria e localização.
 *
 * Duas classes de permissão, de propósito:
 *
 * - **Bloqueantes** — câmera. Sem ela o visor não abre, e o gate segura aqui.
 * - **Best-effort** — galeria (no Expo Go o expo-media-library rejeita toda
 *   chamada com 'unavailable') e **localização** (feature 005).
 *
 * A localização é pedida junto das outras (decisão do Sávio, 2026-08-22) mas
 * **nunca entra no gate**: recusar o lugar não pode impedir alguém de usar o
 * app. Sem ela, a vibe é lida só da imagem e da hora — que é exatamente o
 * comportamento que FR-034 descreve para o caso de permissão negada.
 */
export default function PermissionsScreen() {
  const router = useRouter();
  const [cameraPerm, requestCamera] = useCameraPermissions();
  const [mediaStatus, setMediaStatus] = useState<SystemGalleryPermission | null>(null);
  const [negado, setNegado] = useState(false);

  useEffect(() => {
    checkSystemGalleryPermission().then(setMediaStatus);
  }, []);

  const mediaOk = (s: SystemGalleryPermission | null): boolean =>
    s === 'granted' || s === 'unavailable';

  // Segura o splash escuro enquanto os dois estados carregam, para decidir
  // uma única vez entre redirecionar e mostrar o onboarding (sem flash)
  if (!cameraPerm || mediaStatus === null) {
    return <View style={styles.root} />;
  }

  if (cameraPerm.granted && mediaOk(mediaStatus)) {
    return <Redirect href="/camera" />;
  }

  const permitirTudo = async () => {
    const cam = cameraPerm?.granted ? cameraPerm : await requestCamera();
    const med = mediaOk(mediaStatus) ? mediaStatus : await requestSystemGalleryPermission();
    setMediaStatus(med);
    // Localização por último e **fora do gate** (feature 005): pedir depois das
    // duas essenciais evita empilhar três diálogos do sistema antes de a pessoa
    // ver o app, e o resultado não influencia a decisão de entrar. Recusou? A
    // vibe segue saindo da imagem e da hora (FR-034).
    await pedirLocalizacao();
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
          acessos — e usa um terceiro, se você deixar:
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

        {/* Card próprio, e não uma linha na letra miúda: é aqui que o
            consentimento de localização de fato acontece (feature 005). O texto
            diz o que sai — cidade, não posição exata — e que dá para recusar,
            porque um opt-in que esconde o custo não é informado. */}
        <View style={styles.card}>
          <Text style={styles.cardEmoji}>📍</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>LOCALIZAÇÃO · OPCIONAL</Text>
            <Text style={styles.cardDesc}>
              Para a vibe combinar com o lugar — praia, cidade, estrada. Só a cidade é enviada,
              nunca sua posição exata, e nada fica guardado. Pode recusar: o app funciona igual.
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
    fontFamily: fonts.labelForte,
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
    fontFamily: fonts.label,
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
    fontFamily: fonts.labelForte,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 4,
  },
  cardDesc: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 12,
    lineHeight: 18,
  },
  privacy: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
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
    fontFamily: fonts.label,
    fontSize: 13,
  },
  deniedText: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { colors, fonts, radii } from '@/theme/tokens';

/**
 * Ajustes (US9/FR-015) + opt-in LGPD de metadados anônimos (FR-010).
 * Toggles ruby, seções em DM Mono, título display em Syne — Figma.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const s = useSettingsStore();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Ajustes.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>CÂMERA</Text>
        <Row
          titulo="Filtro automático"
          desc="Aplica o filtro da vibe detectada, ao vivo no visor"
          value={s.filtroAutomatico}
          onToggle={() => s.toggle('filtroAutomatico')}
        />
        <Row
          titulo="Detecção em tempo real"
          desc="Recalcula a vibe continuamente (ML Kit on-device no build nativo)"
          value={s.deteccaoTempoReal}
          onToggle={() => s.toggle('deteccaoTempoReal')}
        />
        <Row
          titulo="Grade de composição"
          desc="Linhas de terços sobre o visor"
          value={s.gradeComposicao}
          onToggle={() => s.toggle('gradeComposicao')}
        />

        <Text style={styles.section}>MÚSICA</Text>
        <Row
          titulo="Sugestão automática"
          desc="Curadoria da trilha na captura (Gemini + Deezer)"
          value={s.sugestaoAutomatica}
          onToggle={() => s.toggle('sugestaoAutomatica')}
        />
        <View style={styles.rowStatic}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Fonte do áudio</Text>
            <Text style={styles.rowDesc}>Prévias de 30 segundos</Text>
          </View>
          <Text style={styles.valueMono}>DEEZER</Text>
        </View>

        <Text style={styles.section}>PRIVACIDADE</Text>
        <Row
          titulo="Metadados anônimos"
          desc="Opt-in: compartilhar estatísticas anônimas de uso. Revogável a qualquer momento."
          value={s.metadadosAnonimos}
          onToggle={() => s.toggle('metadadosAnonimos')}
        />
        <Text style={styles.privacyNote}>
          🔒 A análise da cena acontece no seu celular. Somente a curadoria musical consulta a
          internet — nunca com as suas imagens.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  titulo,
  desc,
  value,
  onToggle,
}: {
  titulo: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{titulo}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(245,238,222,0.2)', true: colors.ruby }}
        thumbColor={colors.parchment}
      />
    </View>
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
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 28,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  section: {
    color: colors.amber,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.parchment25,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 10,
  },
  rowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.parchment25,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 10,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.parchment,
    fontFamily: fonts.mono,
    fontSize: 14,
    marginBottom: 3,
  },
  rowDesc: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 11,
    lineHeight: 16,
  },
  valueMono: {
    color: colors.amber,
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 2,
  },
  privacyNote: {
    color: colors.parchment50,
    fontFamily: fonts.monoLight,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
});

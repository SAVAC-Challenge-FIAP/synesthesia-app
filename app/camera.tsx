import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureSheet } from '@/components/CaptureSheet';
import { FilterCarousel } from '@/components/FilterCarousel';
import { FilterLayer } from '@/components/FilterLayer';
import { FilteredImage } from '@/components/FilteredImage';
import { filterById } from '@/constants/filters';
import { vibeById } from '@/constants/vibes';
import { detectVibe, VIBE_TICK_MS } from '@/services/vibeEngine';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { colors, fonts, sizes } from '@/theme/tokens';
import { FilterId, VibeId } from '@/types';

/**
 * Visor principal (US1/US2): vibe recalculada em tempo real, filtro ao vivo,
 * carrossel manual, flip frontal/traseira, grade e atalho para Ajustes.
 */
export default function CameraScreen() {
  const router = useRouter();
  const [cameraPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const { filtroAutomatico, deteccaoTempoReal, gradeComposicao } = useSettingsStore();
  const medias = useGalleryStore((s) => s.medias);
  const startSession = useCaptureStore((s) => s.start);
  const session = useCaptureStore((s) => s.session);

  const [facing, setFacing] = useState<CameraType>('back');
  const [sceneSeed, setSceneSeed] = useState(0);
  const [vibeId, setVibeId] = useState<VibeId>(() => detectVibe({ facing: 'back', sceneSeed: 0 }).id);
  const [manualFiltro, setManualFiltro] = useState<FilterId | null>(null);
  const [capturando, setCapturando] = useState(false);

  // Contexto em tempo real: a vibe muda com a cena (tick) e com o flip da câmera
  useEffect(() => {
    if (!deteccaoTempoReal) return;
    const t = setInterval(() => setSceneSeed((s) => s + 1), VIBE_TICK_MS);
    return () => clearInterval(t);
  }, [deteccaoTempoReal]);

  useEffect(() => {
    setVibeId(detectVibe({ facing, sceneSeed }).id);
  }, [facing, sceneSeed]);

  const vibe = vibeById(vibeId);
  const filtroAtivo: FilterId | null =
    manualFiltro ?? (filtroAutomatico ? vibe.filtro : null);
  const filtro = filtroAtivo ? filterById(filtroAtivo) : null;

  const flip = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setSceneSeed((s) => s + 1); // flip também recalcula a vibe (FR-001)
  };

  const capturar = useCallback(async () => {
    if (capturando || !cameraRef.current) return;
    setCapturando(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (foto?.uri) {
        startSession({
          mediaId: null,
          photoUri: foto.uri,
          filtroId: filtroAtivo ?? vibe.filtro,
          vibeId,
          musica: null,
          trechoInicio: 0,
          trechoFim: 30,
        });
      }
    } finally {
      setCapturando(false);
    }
  }, [capturando, filtroAtivo, startSession, vibe.filtro, vibeId]);

  // Guards DEPOIS de todos os hooks (Rules of Hooks): um return antecipado
  // entre hooks muda a ordem entre renders e derruba a tela
  if (!cameraPerm) {
    // permissão ainda carregando (1º render do hook): segurar a tela — um
    // <Redirect> aqui cria ping-pong com o redirect do index
    return <View style={styles.root} />;
  }
  if (!cameraPerm.granted) {
    return <Redirect href="/" />;
  }

  const ultimaMedia = medias[0];

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
      {filtro ? <FilterLayer filter={filtro} /> : null}

      {gradeComposicao ? <GridOverlay /> : null}

      <SafeAreaView style={styles.ui} pointerEvents="box-none">
        {/* Barra de status: vibe detectada + Ajustes */}
        <View style={styles.topBar}>
          <View style={styles.vibeBadge}>
            <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
            <View>
              <Text style={styles.vibeLabel}>VIBE {deteccaoTempoReal ? '· AO VIVO' : ''}</Text>
              <Text style={styles.vibeNome}>{vibe.nome.toUpperCase()}</Text>
            </View>
          </View>
          <Pressable style={styles.opcoes} onPress={() => router.push('/settings')}>
            <Text style={styles.opcoesText}>+ OPÇÕES</Text>
          </Pressable>
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {manualFiltro ? (
            <Pressable style={styles.autoBtn} onPress={() => setManualFiltro(null)}>
              <Text style={styles.autoBtnText}>↺ VOLTAR AO AUTOMÁTICO</Text>
            </Pressable>
          ) : null}

          <FilterCarousel
            ativo={filtroAtivo ?? vibe.filtro}
            autoAtivo={manualFiltro === null && filtroAutomatico}
            onSelect={(id) => setManualFiltro(id)}
          />

          {/* Home bar: galeria / captura / flip */}
          <View style={styles.controls}>
            <Pressable style={styles.sideBtn} onPress={() => router.push('/gallery')}>
              {ultimaMedia ? (
                <FilteredImage
                  uri={ultimaMedia.photoUri}
                  filtroId={ultimaMedia.filtroId}
                  style={styles.thumb}
                />
              ) : (
                <Text style={styles.sideIcon}>🏞️</Text>
              )}
            </Pressable>

            <Pressable
              onPress={capturar}
              style={[styles.shutterOuter, capturando && { opacity: 0.5 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <Pressable style={styles.sideBtn} onPress={flip}>
              <Text style={styles.sideIcon}>🔄</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {session ? <CaptureSheet /> : null}
    </View>
  );
}

function GridOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.gridLine, { left: '33.3%', width: 1, height: '100%' }]} />
      <View style={[styles.gridLine, { left: '66.6%', width: 1, height: '100%' }]} />
      <View style={[styles.gridLine, { top: '33.3%', height: 1, width: '100%' }]} />
      <View style={[styles.gridLine, { top: '66.6%', height: 1, width: '100%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  ui: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  vibeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.parchment25,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  vibeEmoji: {
    fontSize: 18,
  },
  vibeLabel: {
    color: colors.amber,
    fontFamily: fonts.monoLight,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  vibeNome: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1,
  },
  opcoes: {
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.parchment25,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  opcoesText: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
  },
  bottom: {
    gap: 14,
    paddingBottom: 18,
  },
  autoBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  autoBtnText: {
    color: colors.amber,
    fontFamily: fonts.monoLight,
    fontSize: 10,
    letterSpacing: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.parchment25,
    paddingTop: 14,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.parchment25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(9,5,6,0.4)',
  },
  sideIcon: {
    fontSize: 20,
  },
  thumb: {
    width: 48,
    height: 48,
  },
  shutterOuter: {
    width: sizes.captureButton,
    height: sizes.captureButton,
    borderRadius: sizes.captureButton / 2,
    borderWidth: 4,
    borderColor: colors.parchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: sizes.captureButton - 16,
    height: sizes.captureButton - 16,
    borderRadius: (sizes.captureButton - 16) / 2,
    backgroundColor: colors.ruby,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(245,238,222,0.18)',
  },
});

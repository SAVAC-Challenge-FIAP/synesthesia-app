/**
 * @docs docs/components/camera.md
 */
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import {
  CameraType,
  CameraView,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  CameraOptionsBar,
  megapixels,
  opcoesDeResolucao,
  rotuloDeResolucao,
} from "@/components/CameraOptionsBar";
import { FilterCarousel } from "@/components/FilterCarousel";
import { FundoBase } from "@/components/FundoBase";
import { FilterLayer } from "@/components/FilterLayer";
import { FilteredImage } from "@/components/FilteredImage";
import { filterById } from "@/constants/filters";
import {
  ENQUADRAMENTO_PADRAO,
  ENQUADRAMENTOS,
  enquadramentoPor,
} from "@/constants/enquadramentos";
import { escolherTamanhoNativo, prepararFoto } from "@/services/enquadrar";
import { detectVibe } from "@/services/vibeEngine";
import { useCaptureStore } from "@/stores/useCaptureStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { colors, fonts, hitSlops, radii, sizes } from "@/theme/tokens";
import { EnquadramentoId, FilterId } from "@/types";

export default function CameraScreen() {
  const router = useRouter();
  const [cameraPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const gradeComposicao = useSettingsStore((s) => s.gradeComposicao);
  const ultimaMedia = useGalleryStore((s) => s.medias[0]);
  const startSession = useCaptureStore((s) => s.start);

  const focada = useIsFocused();

  const [camPronta, setCamPronta] = useState(false);
  useEffect(() => {
    if (!focada) {
      setCamPronta(false);
      return;
    }
    const tarefa = InteractionManager.runAfterInteractions(() =>
      setCamPronta(true),
    );
    return () => tarefa.cancel();
  }, [focada]);

  const [facing, setFacing] = useState<CameraType>("back");
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [enquadramentoId, setEnquadramentoId] =
    useState<EnquadramentoId>(ENQUADRAMENTO_PADRAO);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [faixas, setFaixas] = useState({
    ui: 0,
    topo: 0,
    baixo: 0,
    controles: 0,
  });
  const { width: larguraTela } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const enquadramento = enquadramentoPor(enquadramentoId);
  const razaoAlvo =
    enquadramento.razao ?? (faixas.ui > 0 ? larguraTela / faixas.ui : 9 / 16);

  const tamanhoNativo = useMemo(
    () => escolherTamanhoNativo(tamanhos, razaoAlvo),
    [tamanhos, razaoAlvo],
  );

  const indices = useMemo(() => ENQUADRAMENTOS.map((_, i) => i), []);
  const geometrias = useMemo(() => {
    const { ui, topo, baixo, controles } = faixas;
    if (!ui || !larguraTela) return null;

    const topoConteudo = insets.top;
    const fundoConteudo = ui - insets.bottom;
    const alturaUtil = fundoConteudo - topoConteudo - topo - baixo;
    return ENQUADRAMENTOS.map((e) => {
      if (e.ancora === "tela") return { top: 0, height: ui };
      const height = larguraTela / (e.razao ?? larguraTela / ui);
      const top =
        e.ancora === "controles"
          ? fundoConteudo - controles - height
          : topoConteudo + topo + (alturaUtil - height) / 2;
      return { top, height };
    });
  }, [faixas, larguraTela, insets]);

  const indiceAtual = Math.max(
    0,
    ENQUADRAMENTOS.findIndex((e) => e.id === enquadramentoId),
  );
  const anim = useRef(new Animated.Value(indiceAtual)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: indiceAtual,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [indiceAtual, anim]);

  const visorAnimado = useMemo(() => {
    if (!geometrias) return null;
    return {
      top: anim.interpolate({
        inputRange: indices,
        outputRange: geometrias.map((g) => g.top),
      }),
      height: anim.interpolate({
        inputRange: indices,
        outputRange: geometrias.map((g) => g.height),
      }),
    };
  }, [geometrias, indices, anim]);

  const [manualFiltro, setManualFiltro] = useState<
    FilterId | "original" | null
  >(null);
  const [capturando, setCapturando] = useState(false);

  const vibe = useMemo(() => detectVibe({ facing }), [facing]);
  const filtroAtivo: FilterId | null =
    manualFiltro === "original" ? null : manualFiltro;
  const filtro = filtroAtivo ? filterById(filtroAtivo) : null;

  const escolherFiltro = useCallback(
    (id: FilterId | null) => setManualFiltro(id ?? "original"),
    [],
  );

  const lerTamanhos = useCallback(() => {
    if (!cameraRef.current) return;
    cameraRef.current
      .getAvailablePictureSizesAsync()
      .then(setTamanhos)
      .catch(() => {});
  }, []);
  const [resolucaoEscolhida, setResolucaoEscolhida] = useState<string | null>(
    null,
  );
  const opcoesResolucao = useMemo(
    () => opcoesDeResolucao(tamanhos, razaoAlvo),
    [tamanhos, razaoAlvo],
  );

  useEffect(() => {
    if (resolucaoEscolhida && !opcoesResolucao.includes(resolucaoEscolhida)) {
      setResolucaoEscolhida(null);
    }
  }, [opcoesResolucao, resolucaoEscolhida]);

  const pictureSize = resolucaoEscolhida ?? tamanhoNativo;

  const proximaResolucao = useCallback(() => {
    if (opcoesResolucao.length === 0) return;
    const atual = resolucaoEscolhida ?? opcoesResolucao[0];
    const i = opcoesResolucao.indexOf(atual);
    setResolucaoEscolhida(opcoesResolucao[(i + 1) % opcoesResolucao.length]);
  }, [opcoesResolucao, resolucaoEscolhida]);

  const resolucao =
    resolucaoEscolhida !== null
      ? megapixels(resolucaoEscolhida)
      : opcoesResolucao.length > 0
        ? megapixels(opcoesResolucao[0])
        : tamanhos.length > 0
          ? rotuloDeResolucao(tamanhos)
          : null;

  const proximoFlash = () =>
    setFlash((f) => (f === "off" ? "auto" : f === "auto" ? "on" : "off"));

  const flashDisponivel = facing === "back";

  const flip = () => {
    setFacing((f) => {
      const novo = f === "back" ? "front" : "back";
      if (novo === "front") setFlash("off");
      return novo;
    });
  };

  const capturar = useCallback(async () => {
    if (capturando || !cameraRef.current) return;
    setCapturando(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (foto?.uri) {
        const { uri: photoUri, aspecto } = await prepararFoto({
          uri: foto.uri,
          largura: foto.width,
          altura: foto.height,
          razaoAlvo,
          frontal: facing === "front",
        });
        router.push("/capture");
        startSession({
          mediaId: null,
          photoUri,
          aspecto,
          filtroId: filtroAtivo,

          filtroAuto: manualFiltro === null,
          vibeId: vibe.id,
          musica: null,
          trechoInicio: 0,
          trechoFim: 30,
        });
      }
    } finally {
      setCapturando(false);
    }
  }, [
    capturando,
    facing,
    razaoAlvo,
    filtroAtivo,
    manualFiltro,
    router,
    startSession,
    vibe.id,
  ]);

  if (!cameraPerm) {
    return <View style={styles.root} />;
  }
  if (!cameraPerm.granted) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.root}>
      <FundoBase />

      <SafeAreaView
        style={styles.ui}
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setFaixas((f) => ({ ...f, ui: h }));
        }}
      >
        {}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[
              styles.visor,
              {
                width: larguraTela,
                top: visorAnimado?.top ?? 0,
                height: visorAnimado?.height ?? 0,
              },
            ]}
          >
            {focada && camPronta && geometrias ? (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                flash={flash}

                {...(pictureSize ? { pictureSize } : {})}
                onCameraReady={lerTamanhos}
              />
            ) : null}
            {}
            {filtro ? <FilterLayer filter={filtro} /> : null}
            {gradeComposicao ? <GridOverlay /> : null}
          </Animated.View>
        </View>

        {}
        <View
          style={styles.topBar}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setFaixas((f) => ({ ...f, topo: h }));
          }}
        >
          {}
          <CameraOptionsBar
            resolucao={resolucao}
            onTrocarResolucao={
              opcoesResolucao.length > 1 ? proximaResolucao : undefined
            }
            onAjustes={() => router.push("/settings")}
            slotFlash={
              <Pressable
                hitSlop={hitSlops.chip}
                disabled={!flashDisponivel}
                onPress={proximoFlash}
                style={!flashDisponivel && { opacity: 0.3 }}
              >
                <View style={styles.flashSlot}>
                  <Ionicons
                    name={flash === "off" ? "flash-off-outline" : "flash"}
                    size={20}
                    color={flash === "off" ? colors.parchment : colors.amber}
                  />
                  {flash === "auto" ? (
                    <Text style={styles.flashAuto}>A</Text>
                  ) : null}
                </View>
              </Pressable>
            }
            slotEnquadramento={
              <View style={styles.enquadramentos}>
                {ENQUADRAMENTOS.map((e) => (
                  <Pressable
                    key={e.id}
                    hitSlop={hitSlops.chip}
                    onPress={() => setEnquadramentoId(e.id)}
                  >
                    <Text
                      style={[
                        styles.enquadramentoChip,
                        e.id === enquadramentoId && styles.enquadramentoAtivo,
                      ]}
                    >
                      {e.rotulo}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        </View>

        {}
        <View style={styles.espaco} pointerEvents="none" />

        <View
          style={styles.bottom}
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setFaixas((f) => ({ ...f, baixo: h }));
          }}
        >
          {}
          <LinearGradient
            colors={["rgba(9,5,6,0)", "rgba(9,5,6,0.55)", "rgba(9,5,6,0.9)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <FilterCarousel ativo={filtroAtivo} onSelect={escolherFiltro} />

          {}
          <View
            style={styles.controls}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height + 18;
              setFaixas((f) => ({ ...f, controles: h }));
            }}
          >
            <Pressable
              style={styles.sideBtn}
              onPress={() => router.push("/gallery")}
            >
              {ultimaMedia ? (
                <FilteredImage
                  uri={ultimaMedia.photoUri}
                  filtroId={ultimaMedia.filtroId}
                  style={styles.thumb}
                />
              ) : (
                <Ionicons
                  name="images-outline"
                  size={22}
                  color={colors.parchment}
                />
              )}
            </Pressable>

            <Pressable
              onPress={capturar}
              style={[styles.shutterOuter, capturando && { opacity: 0.5 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <Pressable style={styles.sideBtn} onPress={flip}>
              <Ionicons
                name="camera-reverse-outline"
                size={24}
                color={colors.parchment}
              />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function GridOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[styles.gridLine, { left: "33.3%", width: 1, height: "100%" }]}
      />
      <View
        style={[styles.gridLine, { left: "66.6%", width: 1, height: "100%" }]}
      />
      <View
        style={[styles.gridLine, { top: "33.3%", height: 1, width: "100%" }]}
      />
      <View
        style={[styles.gridLine, { top: "66.6%", height: 1, width: "100%" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  espaco: {
    flex: 1,
  },
  visor: {
    position: "absolute",
    left: 0,
    overflow: "hidden",
    borderRadius: radii.card,
  },
  flashSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  flashAuto: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  enquadramentos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  enquadramentoChip: {
    color: colors.parchment50,
    fontFamily: fonts.label,
    fontSize: 12,
    letterSpacing: 1,
  },
  enquadramentoAtivo: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
  },
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  ui: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,

    height: 60,
    justifyContent: "center",
  },
  bottom: {
    gap: 14,
    paddingBottom: 18,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(9,5,6,0.4)",
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
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: sizes.captureButton - 16,
    height: sizes.captureButton - 16,
    borderRadius: (sizes.captureButton - 16) / 2,
    backgroundColor: colors.ruby,
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(245,238,222,0.18)",
  },
});

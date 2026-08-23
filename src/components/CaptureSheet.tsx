/**
 * @docs docs/adr/0013-arquitetura-estado-captura.md
 * @docs docs/runbooks/armadilhas-conhecidas.md
 * @docs docs/research/limiares_e_metricas.md
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import type { LayoutAnimationConfig } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { EsqueletoTexto } from "@/components/EsqueletoTexto";
import { FotoEditavel } from "@/components/FotoEditavel";
import { FundoBase } from "@/components/FundoBase";
import { LoaderMarca } from "@/components/LoaderMarca";
import { SetaRolagem } from "@/components/SetaRolagem";
import { TratamentoCarrossel } from "@/components/TratamentoCarrossel";
import { MusicPlayer } from "@/components/MusicPlayer";
import { MusicSheet } from "@/components/MusicSheet";
import { PostSheet } from "@/components/PostSheet";
import { aplicarTransformacao } from "@/services/enquadrar";
import { filterById, resolverReceita } from "@/constants/filters";
import { vibeById } from "@/constants/vibes";
import { identidadeDoLook, montarLooks } from "@/services/looks";
import {
  analyzePhotoAndSuggest,
  EtapaCuradoria,
  getSuggestions,
} from "@/services/music";
import { persistAudioPreview, persistPhoto } from "@/services/mediaStorage";
import * as preExport from "@/services/preExport";
import { renderizarLook } from "@/services/renderLook";
import { exportPackage, SharePackage } from "@/services/sharePackage";
import { saveToSystemGallery } from "@/services/systemGallery";
import { useCaptureStore } from "@/stores/useCaptureStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useLookTasteStore } from "@/stores/useLookTasteStore";
import { useTasteStore } from "@/stores/useTasteStore";
import { colors, fonts, hitSlops, radii } from "@/theme/tokens";
import { FilterId, LookRecipe, Media } from "@/types";

const LIMITE_CURADORIA_MS = 30_000;

const ESPERA_QUIETUDE_MS = 2_500;

const LIMIAR_ASPECTO_SETA = 0.65;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TRANSICAO_TRILHA: LayoutAnimationConfig = {
  duration: 260,
  create: { type: "easeInEaseOut", property: "opacity" },
  update: { type: "easeInEaseOut" },
  delete: { type: "easeInEaseOut", property: "opacity" },
};

const TEXTO_ETAPA: Record<EtapaCuradoria, string> = {
  preparando: "PREPARANDO A CENA...",
  lendo: "LENDO A CENA...",
  buscando: "BUSCANDO AS FAIXAS...",
};

export function CaptureSheet() {
  const session = useCaptureStore((s) => s.session);
  const patch = useCaptureStore((s) => s.patch);
  const clear = useCaptureStore((s) => s.clear);
  const add = useGalleryStore((s) => s.add);
  const update = useGalleryStore((s) => s.update);
  const registrarEscolha = useTasteStore((s) => s.registrarEscolha);
  const registrarEscolhaVisual = useLookTasteStore((s) => s.registrarEscolha);
  const sugestaoAutomatica = useSettingsStore((s) => s.sugestaoAutomatica);
  const deteccaoTempoReal = useSettingsStore((s) => s.deteccaoTempoReal);
  const filtroAutomatico = useSettingsStore((s) => s.filtroAutomatico);

  const insets = useSafeAreaInsets();
  const previewRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [jaRolou, setJaRolou] = useState(false);
  const [yAlvoFiltros, setYAlvoFiltros] = useState<number | null>(null);
  const [girando, setGirando] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [sharePkg, setSharePkg] = useState<SharePackage | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState<EtapaCuradoria>("preparando");

  const [postando, setPostando] = useState(false);
  const postandoRef = useRef(false);
  const [progresso, setProgresso] = useState<number | null>(null);

  const escolherFiltro = useCallback(
    (id: FilterId | null) =>
      patch({
        filtroId: id,
        filtroAuto: false,
        lookEscolhido: null,
        lookAuto: false,
      }),
    [patch],
  );

  const escolherLook = useCallback(
    (look: LookRecipe) =>
      patch({
        lookEscolhido: look,
        filtroId: look.base,
        filtroAuto: false,
        lookAuto: false,
      }),
    [patch],
  );

  const aplicarTrecho = useCallback(
    (inicio: number, fim: number) =>
      patch({ trechoInicio: inicio, trechoFim: fim }),
    [patch],
  );

  const alternarArquivo = useCallback(
    (arquivar: boolean) => {
      if (useCaptureStore.getState().session?.curadoria !== "carregando") {
        LayoutAnimation.configureNext(TRANSICAO_TRILHA);
      }
      patch({ trilhaArquivada: arquivar });
    },
    [patch],
  );

  const trilhaArquivada = session?.trilhaArquivada ?? false;
  const opacidadeInfo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(opacidadeInfo, {
      toValue: trilhaArquivada ? 0.38 : 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [trilhaArquivada, opacidadeInfo]);

  const photoUri = session?.photoUri;

  const [aspectoReal, setAspectoReal] = useState<number | null>(null);
  useEffect(() => {
    if (!photoUri) return;
    let vivo = true;
    setAspectoReal(null);
    Image.getSize(
      photoUri,
      (largura, altura) => {
        if (vivo && largura > 0 && altura > 0) setAspectoReal(largura / altura);
      },

      () => {},
    );
    return () => {
      vivo = false;
    };
  }, [photoUri]);

  const analisada = useRef<string | null>(null);
  useEffect(() => {
    if (!photoUri || analisada.current === photoUri) return;
    const { session: s } = useCaptureStore.getState();
    if (!s || s.sugestoes.length > 0) return;

    if (s.mediaId !== null) {
      analisada.current = photoUri;
      patch({ curadoria: s.musica ? "pronta" : "indisponivel" });
      return;
    }

    analisada.current = photoUri;

    if (!sugestaoAutomatica && !deteccaoTempoReal) {
      patch({ curadoria: s.musica ? "pronta" : "indisponivel" });
      return;
    }

    patch({ curadoria: "carregando" });

    const limite = setTimeout(() => {
      if (useCaptureStore.getState().session?.curadoria === "carregando") {
        patch({ curadoria: "indisponivel" });
      }
    }, LIMITE_CURADORIA_MS);

    const analise = deteccaoTempoReal
      ? analyzePhotoAndSuggest(s.photoUri, vibeById(s.vibeId), setEtapa)
      : getSuggestions(vibeById(s.vibeId), setEtapa).then((sugestoes) => ({
          vibeId: null,

          vibe: undefined,
          sugestoes,
          looks: montarLooks(undefined, s.vibeId),
        }));
    analise
      .then(({ vibeId: vibeReal, vibe: vibeLivre, sugestoes, looks }) => {
        clearTimeout(limite);
        const atual = useCaptureStore.getState().session;
        if (!atual || atual.photoUri !== photoUri) return;
        const primeira =
          sugestoes.find((m) => m.previewUrl) ?? sugestoes[0] ?? null;

        const escolheSozinho =
          sugestaoAutomatica && atual.musica === null && atual.mediaId === null;
        const musicaFinal = escolheSozinho ? primeira : atual.musica;

        const lookPrincipal = looks[0] ?? null;

        const aplicaLook =
          filtroAutomatico && atual.lookAuto && lookPrincipal !== null;
        patch({
          sugestoes,
          looks,
          ...(aplicaLook
            ? { lookEscolhido: lookPrincipal, filtroId: lookPrincipal.base }
            : {}),

          curadoria: musicaFinal ? "pronta" : "indisponivel",

          vibe: vibeLivre,

          ...(vibeReal ? { vibeId: vibeReal } : {}),

          ...(vibeReal && atual.filtroAuto && !aplicaLook
            ? { filtroId: vibeById(vibeReal).filtro }
            : {}),

          ...(escolheSozinho ? { musica: primeira, audioUri: null } : {}),
        });
      })
      .catch(() => {
        clearTimeout(limite);
        patch({ curadoria: "indisponivel" });
      });
  }, [
    photoUri,
    sugestaoAutomatica,
    deteccaoTempoReal,
    filtroAutomatico,
    patch,
  ]);

  const renderizarComFiltro = useCallback(async (): Promise<string> => {
    const s = useCaptureStore.getState().session;
    if (!s) return "";

    if (!s.filtroId) return s.photoUri;
    const filtro = s.lookEscolhido
      ? resolverReceita(s.lookEscolhido)
      : filterById(s.filtroId);
    const viaSkia = await renderizarLook(s.photoUri, filtro);
    if (viaSkia) return viaSkia;
    try {
      return await captureRef(previewRef, { format: "jpg", quality: 0.92 });
    } catch {
      return s.photoUri;
    }
  }, []);

  const girarFoto = useCallback(async () => {
    const s = useCaptureStore.getState().session;
    if (!s || girando) return;
    setGirando(true);
    try {
      const resultado = await aplicarTransformacao({
        uri: s.photoUri,
        aspectoAtual: aspectoReal ?? s.aspecto,
        rotacaoGraus: 90,
      });
      patch({ photoUri: resultado.uri, aspecto: resultado.aspecto });
      setAspectoReal(resultado.aspecto);
    } catch (e) {
      console.warn("[capture] girar falhou:", e);
    } finally {
      setGirando(false);
    }
  }, [girando, aspectoReal, patch]);

  const chave = session
    ? preExport.chavePacote({
        photoUri: session.photoUri,

        filtroId: session.lookEscolhido
          ? identidadeDoLook(session.lookEscolhido)
          : session.filtroId,

        musicaId: session.trilhaArquivada ? null : (session.musica?.id ?? null),
        trechoInicio: session.trechoInicio,
        trechoFim: session.trechoFim,
      })
    : null;

  const pronta = session?.curadoria === "pronta";
  const temMusica = Boolean(session?.musica);
  useEffect(() => {
    if (!chave || !pronta || !temMusica) return;

    if (postando || sharePkg) return;
    const t = setTimeout(() => {
      preExport.agendar(chave, async () => {
        const s = useCaptureStore.getState().session;
        return {
          imageUri: await renderizarComFiltro(),
          musica: s?.trilhaArquivada ? null : (s?.musica ?? null),
          trechoInicio: s?.trechoInicio ?? 0,
          trechoFim: s?.trechoFim ?? 30,
        };
      });
    }, ESPERA_QUIETUDE_MS);
    return () => clearTimeout(t);
  }, [chave, pronta, temMusica, postando, sharePkg, renderizarComFiltro]);

  useEffect(
    () => () => {
      console.log("[capture] tela desmontada — pré-geração descartada");
      preExport.limpar();
    },
    [],
  );

  const descartarRef = useRef<() => void>(() => {});
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      descartarRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  if (!session || !chave) return null;

  const curando = session.curadoria === "carregando";
  const esperandoVibe = curando && !session.vibe;
  const vibeExibida = session.vibe ?? vibeById(session.vibeId).nome;

  const arquivada = session.trilhaArquivada;
  const filtro = session.filtroId ? filterById(session.filtroId) : null;
  const editando = session.mediaId !== null;

  const salvar = async (fechar: boolean): Promise<Media | null> => {
    if (salvando) return null;
    setSalvando(true);
    try {
      const musicaDoPacote = session.trilhaArquivada ? null : session.musica;

      const idNovo = session.mediaId ?? `${Date.now()}`;

      if (musicaDoPacote) {
        registrarEscolha(musicaDoPacote, session.vibeId, "auto");
      }

      registrarEscolhaVisual(
        session.lookEscolhido,
        session.vibeId,
        session.lookAuto ? "auto" : "manual",
      );
      const audioUri =
        musicaDoPacote === null
          ? null
          : (session.audioUri ??
            (await persistAudioPreview(
              musicaDoPacote.previewUrl,
              session.mediaId ?? idNovo,
            )));

      let media: Media;
      if (session.mediaId) {
        media = {
          id: session.mediaId,
          photoUri: session.photoUri,
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          vibe: session.vibe,
          musica: musicaDoPacote,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          aspecto: session.aspecto,
          sugestoes: session.sugestoes,
          looks: session.looks,
          lookEscolhido: session.lookEscolhido ?? undefined,
          audioUri: audioUri ?? undefined,
          criadaEm: 0,
          atualizadaEm: Date.now(),
        };
        update(session.mediaId, {
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          vibe: session.vibe,
          musica: musicaDoPacote,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,

          sugestoes: session.sugestoes,

          looks: session.looks,
          lookEscolhido: session.lookEscolhido ?? undefined,

          audioUri: audioUri ?? undefined,
        });
      } else {
        const id = idNovo;

        let uriPersistente: string;
        try {
          uriPersistente = persistPhoto(session.photoUri, id);
        } catch {
          uriPersistente = session.photoUri;
        }
        media = {
          id,
          photoUri: uriPersistente,
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          vibe: session.vibe,
          musica: musicaDoPacote,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          aspecto: session.aspecto,

          sugestoes: session.sugestoes,

          looks: session.looks,
          lookEscolhido: session.lookEscolhido ?? undefined,
          audioUri: audioUri ?? undefined,
          criadaEm: Date.now(),
          atualizadaEm: Date.now(),
        };
        add(media);
        patch({ mediaId: id, photoUri: uriPersistente });

        await saveToSystemGallery(await renderizarComFiltro());
      }

      if (audioUri && audioUri !== session.audioUri) patch({ audioUri });
      if (fechar) clear();
      return media;
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async () => {
    if (postandoRef.current) return;

    const jaPronto = preExport.obterPronto(chave);
    if (jaPronto) {
      postandoRef.current = true;
      setPostando(true);
      try {
        await salvar(false);
        setSharePkg(jaPronto);
      } finally {
        postandoRef.current = false;
        setPostando(false);
      }
      return;
    }

    postandoRef.current = true;
    setPostando(true);
    setProgresso(null);
    try {
      await salvar(false);

      const emVoo = preExport.obterEmVoo(chave);

      const pacote =
        (emVoo ? await emVoo : null) ??
        (await exportPackage({
          imageUri: await renderizarComFiltro(),
          musica: arquivada ? null : session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          onProgresso: setProgresso,
        }));
      setSharePkg(pacote);
    } catch {
      Alert.alert(
        "Não deu para montar o momento",
        "A imagem está salva na galeria. Tente postar de novo em instantes.",
      );
    } finally {
      postandoRef.current = false;
      setPostando(false);
      setProgresso(null);
    }
  };

  const postar = async () => {
    if (session.curadoria === "carregando") return;

    if (postandoRef.current) return;

    if (session.curadoria === "indisponivel" && !arquivada) {
      Alert.alert(
        "Postar sem trilha?",
        "Este momento vai só com a imagem — sem a metade sonora. Você pode esperar a curadoria, escolher uma faixa ou seguir assim mesmo.",
        [
          { text: "Escolher música", onPress: () => setShowMusic(true) },
          { text: "Cancelar", style: "cancel" },
          {
            text: "Postar sem trilha",
            style: "destructive",
            onPress: exportar,
          },
        ],
      );
      return;
    }
    await exportar();
  };

  const descartar = () => {
    if (editando) {
      clear();
      return;
    }
    Alert.alert("Descartar captura?", "A foto e o momento serão perdidos.", [
      { text: "Continuar editando", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: clear },
    ]);
  };

  descartarRef.current = descartar;

  return (
    <View style={styles.backdrop}>
      <FundoBase />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{editando ? "Lapidar." : "Captura."}</Text>
          <Pressable onPress={descartar} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.parchment50} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          onScroll={() => {
            if (!jaRolou) setJaRolou(true);
          }}
          scrollEventThrottle={16}
        >
          {}
          <View ref={previewRef} collapsable={false} style={styles.previewShot}>
            {}
            <FotoEditavel
              uri={session.photoUri}
              filtroId={session.filtroId}
              look={session.lookEscolhido}
              aspectRatio={aspectoReal ?? session.aspecto}
              girando={girando}
              onGirar={girarFoto}
            />
          </View>

          <View
            style={styles.filtroRow}
            onLayout={(e: LayoutChangeEvent) =>
              setYAlvoFiltros(e.nativeEvent.layout.y)
            }
          >
            {}
            <Text style={styles.sectionLabel}>VIBE</Text>
            <View style={styles.tratamentoEVibe}>
              <Text style={styles.filtroAtual}>
                {session.lookEscolhido
                  ? session.lookEscolhido.nome.toUpperCase()
                  : filtro
                    ? `${filtro.emoji} ${filtro.nome.toUpperCase()}`
                    : "📷 ORIGINAL"}{" "}
                ·{" "}
              </Text>
              {}
              {esperandoVibe ? (
                <EsqueletoTexto
                  largura={92}
                  altura={13}
                  rotuloAcessivel="Lendo a vibe desta foto"
                />
              ) : (
                <Text style={styles.filtroAtual}>
                  {vibeExibida.toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          {}
          <View style={styles.carouselWrap}>
            <TratamentoCarrossel
              photoUri={session.photoUri}
              looks={session.looks}
              carregando={session.curadoria === "carregando"}
              lookEscolhido={session.lookEscolhido}
              filtroAtivo={session.filtroId}
              onSelectLook={escolherLook}
              onSelectFiltro={escolherFiltro}
            />
          </View>

          {}
          <Text
            style={[
              styles.sectionLabel,
              { paddingHorizontal: 20, marginTop: 18 },
            ]}
          >
            TRILHA SONORA
          </Text>
          <View style={styles.musicBox}>
            {session.curadoria === "carregando" ? (
              <View style={styles.loadingRow}>
                <LoaderMarca tamanho={34} />
                <Text style={styles.loadingText}>{TEXTO_ETAPA[etapa]}</Text>
              </View>
            ) : session.musica ? (
              <>
                {}
                <View
                  style={[
                    styles.musicHeader,
                    arquivada && styles.musicHeaderArquivada,
                  ]}
                >
                  {}
                  <Animated.View
                    style={[styles.musicIdent, { opacity: opacidadeInfo }]}
                  >
                    <Text style={styles.musicEmoji}>
                      {session.musica.emoji}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.musicTitle} numberOfLines={1}>
                        {session.musica.titulo}
                      </Text>
                      <Text style={styles.musicArtist} numberOfLines={1}>
                        {session.musica.artista}
                      </Text>
                      {arquivada ? (
                        <Text style={styles.musicReason} numberOfLines={2}>
                          {session.musica.justificativa}
                        </Text>
                      ) : null}
                    </View>
                  </Animated.View>

                  {}
                  {arquivada ? (
                    <Pressable
                      style={styles.btnReativar}
                      hitSlop={hitSlops.botao}
                      accessibilityRole="button"
                      accessibilityLabel="Reativar trilha no pacote"
                      onPress={() => alternarArquivo(false)}
                    >
                      <Ionicons name="power" size={20} color={colors.ink} />
                    </Pressable>
                  ) : null}
                </View>

                {}
                {arquivada ? null : (
                  <>
                    <Text style={styles.musicReason}>
                      {session.musica.justificativa}
                    </Text>
                    <MusicPlayer
                      key={`${session.musica.id}:${session.audioUri ?? "remoto"}`}
                      musica={session.musica}
                      audioUri={session.audioUri}

                      ativo={!showMusic}
                      trechoInicio={session.trechoInicio}
                      trechoFim={session.trechoFim}

                      onTrecho={aplicarTrecho}
                    />
                    <View style={styles.musicActions}>
                      <Pressable
                        style={styles.btnTrocar}
                        hitSlop={hitSlops.botao}
                        onPress={() => setShowMusic(true)}
                      >
                        <Ionicons
                          name="musical-notes"
                          size={16}
                          color={colors.parchment}
                        />
                        <Text style={styles.btnTrocarText}>Trocar música</Text>
                      </Pressable>
                      <Pressable
                        style={styles.btnArquivar}
                        hitSlop={hitSlops.botao}
                        accessibilityRole="button"
                        accessibilityLabel="Arquivar trilha e exportar só a imagem"
                        onPress={() => alternarArquivo(true)}
                      >
                        <Ionicons
                          name="trash"
                          size={19}
                          color={colors.parchment}
                        />
                      </Pressable>
                    </View>
                  </>
                )}
              </>
            ) : (
              <View style={styles.semAudio}>
                <Text style={styles.semAudioText}>
                  {session.sugestoes.length > 0
                    ? "Sem áudio — o momento será salvo só com a imagem."
                    : "Sem sugestões no momento — você pode salvar só a imagem."}
                </Text>
                <Pressable
                  style={styles.musicBtn}
                  hitSlop={hitSlops.chip}
                  onPress={() => setShowMusic(true)}
                >
                  <Text style={styles.musicBtnText}>
                    {session.sugestoes.length > 0
                      ? "ESCOLHER MÚSICA"
                      : "BUSCAR MÚSICA"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>

        <SetaRolagem
          visivel={!jaRolou && (aspectoReal ?? session.aspecto) <= LIMIAR_ASPECTO_SETA}
          onPress={() => {
            if (yAlvoFiltros !== null) {
              scrollRef.current?.scrollTo({ y: yAlvoFiltros, animated: true });
            }
            setJaRolou(true);
          }}
        />

        <View
          style={[
            styles.actions,
            { paddingBottom: Math.max(insets.bottom + 8, 20) },
          ]}
        >
          {}
          {curando ? (
            <View style={styles.motivoLinha}>
              <Ionicons
                name="hourglass-outline"
                size={12}
                color={colors.amber}
              />
              <Text style={styles.motivoBloqueio}>
                {TEXTO_ETAPA[etapa]} POSTAR LIBERA QUANDO A TRILHA CHEGAR.
                SALVAR JÁ FUNCIONA.
              </Text>
            </View>
          ) : postando ? (
            <View style={styles.progressoBloco}>
              <View style={styles.motivoLinha}>
                {progresso === null ? (
                  <ActivityIndicator size="small" color={colors.amber} />
                ) : (
                  <Ionicons
                    name="film-outline"
                    size={12}
                    color={colors.amber}
                  />
                )}
                <Text style={styles.motivoBloqueio}>
                  {progresso === null
                    ? "MONTANDO O MOMENTO — GERANDO O VÍDEO. ISSO LEVA ALGUNS SEGUNDOS."
                    : `GERANDO O VÍDEO — ${progresso}%`}
                </Text>
              </View>
              {progresso === null ? null : (
                <View style={styles.barraTrilho}>
                  <View
                    style={[styles.barraPreenchida, { width: `${progresso}%` }]}
                  />
                </View>
              )}
            </View>
          ) : null}
          <View style={styles.actionsRow}>
            {}
            <Pressable
              style={[
                styles.action,
                styles.actionSalvar,
                postando && styles.actionDesabilitada,
              ]}
              disabled={salvando || postando}
              onPress={async () => {
                const m = await salvar(true);

                if (m) router.replace("/gallery");
              }}
            >
              <Text style={styles.actionText}>
                {salvando ? "Salvando..." : "Salvar"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.action,
                styles.actionPostar,
                (curando || postando) && styles.actionDesabilitada,
              ]}
              disabled={salvando || curando || postando}
              accessibilityState={{
                disabled: curando || postando,
                busy: postando,
              }}
              accessibilityHint={
                curando
                  ? "Disponível quando a curadoria da trilha terminar"
                  : undefined
              }
              onPress={postar}
            >
              <Text style={[styles.actionText, { color: colors.ink }]}>
                {curando
                  ? "Aguarde a trilha"
                  : postando
                    ? "Postando..."
                    : "Postar agora"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {showMusic ? <MusicSheet onClose={() => setShowMusic(false)} /> : null}
      {sharePkg ? (
        <PostSheet pacote={sharePkg} onClose={() => setSharePkg(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: "flex-end",
  },
  sheet: {
    height: "94%",
    backgroundColor: colors.ink,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 26,
  },
  scroll: {
    paddingBottom: 28,
  },
  previewShot: {
    marginHorizontal: 20,
    borderRadius: radii.card,
    overflow: "hidden",
  },
  filtroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 2,
  },
  tratamentoEVibe: {
    flexDirection: "row",
    alignItems: "center",
  },
  filtroAtual: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
    fontSize: 11,
    letterSpacing: 1,
  },
  carouselWrap: {
    marginHorizontal: 4,
  },
  musicBox: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.parchment25,
    padding: 14,
    gap: 10,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 11,
    letterSpacing: 1,
  },
  musicHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  musicEmoji: {
    fontSize: 24,
  },
  musicTitle: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 14,
  },
  musicArtist: {
    color: colors.parchment50,
    fontFamily: fonts.label,
    fontSize: 12,
  },
  musicReason: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 11,
    fontStyle: "italic",
  },

  musicHeaderArquivada: {
    alignItems: "center",
  },
  musicIdent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  musicActions: {
    flexDirection: "row",
    gap: 10,
  },

  btnTrocar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 50,
    borderWidth: 1,
    borderColor: colors.parchment25,
    borderRadius: radii.card,
  },
  btnTrocarText: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 13,
    letterSpacing: 1,
  },
  btnArquivar: {
    width: 50,
    height: 50,
    borderRadius: radii.card,
    backgroundColor: colors.ruby,
    alignItems: "center",
    justifyContent: "center",
  },

  btnReativar: {
    width: 44,
    height: 44,
    borderRadius: radii.card,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  musicBtn: {
    borderWidth: 1,
    borderColor: colors.parchment25,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  musicBtnText: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  semAudio: {
    gap: 10,
    alignItems: "flex-start",
  },
  semAudioText: {
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 11,
    lineHeight: 17,
  },
  actions: {
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.parchment25,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  motivoLinha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  progressoBloco: {
    gap: 6,
  },
  barraTrilho: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.parchment25,
    overflow: "hidden",
  },
  barraPreenchida: {
    height: "100%",
    backgroundColor: colors.amber,
  },
  motivoBloqueio: {
    flex: 1,
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 15,
  },
  actionDesabilitada: {
    opacity: 0.4,
  },
  action: {
    flex: 1,
    borderRadius: radii.card,
    paddingVertical: 15,
    alignItems: "center",
  },
  actionSalvar: {
    backgroundColor: colors.ruby,
  },
  actionPostar: {
    backgroundColor: colors.amber,
  },
  actionText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 15,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { CameraType, CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraOptionsBar, rotuloDeResolucao } from '@/components/CameraOptionsBar';
import { FilterCarousel } from '@/components/FilterCarousel';
import { FundoBase } from '@/components/FundoBase';
import { FilterLayer } from '@/components/FilterLayer';
import { FilteredImage } from '@/components/FilteredImage';
import { filterById } from '@/constants/filters';
import { ENQUADRAMENTO_PADRAO, ENQUADRAMENTOS, enquadramentoPor } from '@/constants/enquadramentos';
import { escolherTamanhoNativo, prepararFoto } from '@/services/enquadrar';
import { detectVibe } from '@/services/vibeEngine';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { colors, fonts, hitSlops, radii, sizes } from '@/theme/tokens';
import { EnquadramentoId, FilterId } from '@/types';

/**
 * Visor principal (US1/US2): prévia de vibe determinística (hora + câmera),
 * filtro ao vivo opcional, carrossel manual (com "Original"), flip
 * frontal/traseira, grade e atalho para Ajustes. A vibe REAL é inferida da
 * foto na captura (T-0A), então o visor mostra "PRÉVIA" — sem timer/sorteio.
 */
export default function CameraScreen() {
  const router = useRouter();
  const [cameraPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Seletores fatiados de propósito (T038). Antes esta tela assinava os stores
  // inteiros e redesenhava — com CameraView, FilterLayer e carrossel junto — a
  // cada mexida em qualquer campo deles:
  // - `useSettingsStore()` sem seletor reagia a ajustes que o visor nem usa
  //   (sugestão automática, detecção em tempo real, metadados anônimos);
  // - `s.session` inteiro reagia a **cada** `patch()` da curadoria, que são
  //   vários por captura — e aqui só interessa se existe sessão ou não;
  // - `s.medias` inteiro reagia a qualquer mídia, quando só a capa é usada.
  const filtroAutomatico = useSettingsStore((s) => s.filtroAutomatico);
  const gradeComposicao = useSettingsStore((s) => s.gradeComposicao);
  const ultimaMedia = useGalleryStore((s) => s.medias[0]);
  const startSession = useCaptureStore((s) => s.start);

  /**
   * A câmera só existe enquanto esta tela está em foco (T063).
   *
   * É esta linha que cumpre o objetivo da Fase 15, não a mudança de modal para
   * rota. O T062 mediu que `/settings`, empilhada por cima daqui, deixava o
   * cliente de câmera ativo: o `expo-router` mantém a tela de baixo montada, e
   * a `CameraView` continuava produzindo frames para ninguém.
   *
   * Desmontar é a única alavanca no Android — a prop `active` da `CameraView`,
   * que existiria para isso, é `@platform ios`.
   */
  const focada = useIsFocused();

  const [facing, setFacing] = useState<CameraType>('back');
  // Painel "+ Opções" (T065): o chip deixou de empurrar para os Ajustes e passou
  // a abrir a barra do Figma; quem leva aos Ajustes agora é a engrenagem dela.
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [enquadramentoId, setEnquadramentoId] = useState<EnquadramentoId>(ENQUADRAMENTO_PADRAO);
  const [flash, setFlash] = useState<FlashMode>('off');
  /** Área entre a barra superior e os controles — o palco real do visor (T087). */
  const [palco, setPalco] = useState({ largura: 0, altura: 0 });

  const razaoAlvo = enquadramentoPor(enquadramentoId).razao;

  /**
   * Resolução do sensor que já nasce no enquadramento escolhido (T086).
   *
   * Quando existe, a `CameraView` recebe essa `pictureSize` e a foto sai pronta:
   * nada é recortado depois, e o que o visor mostrou é o que o arquivo tem. O
   * 1:1 não existe em sensor nenhum — ali `null` significa "vai ter de cortar".
   */
  const tamanhoNativo = useMemo(
    () => escolherTamanhoNativo(tamanhos, razaoAlvo),
    [tamanhos, razaoAlvo],
  );

  /**
   * Tamanho do visor, animado (T077/T087).
   *
   * Antes isto era um `aspectRatio` num `Animated.View` de largura cheia, dentro
   * de um palco `absoluteFill` — a prévia se centralizava na **tela inteira**,
   * com os controles por cima dela, e no 16:9 a altura pedida (largura ÷ 0,5625)
   * passava do que sobra entre as barras. Daí a impressão de desproporção e de
   * visor fora do lugar.
   *
   * Agora largura e altura são calculadas a partir do palco medido: o lado que
   * limita é respeitado, o outro segue a razão. A `interpolate` sobre as três
   * razões conhecidas faz a transição entre elas continuar fluida — o que anima
   * é a mesma escala, só que agora dentro de um espaço que existe de verdade.
   */
  const razoes = useMemo(
    () => [...ENQUADRAMENTOS.map((e) => e.razao)].sort((a, b) => a - b),
    [],
  );
  const anim = useRef(new Animated.Value(enquadramentoPor(ENQUADRAMENTO_PADRAO).razao)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: razaoAlvo,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [razaoAlvo, anim]);

  const medidas = useMemo(() => {
    if (!palco.largura || !palco.altura) return null;
    const larguras = razoes.map((r) => Math.min(palco.largura, palco.altura * r));
    return {
      largura: anim.interpolate({ inputRange: razoes, outputRange: larguras }),
      altura: anim.interpolate({
        inputRange: razoes,
        outputRange: larguras.map((l, i) => l / razoes[i]),
      }),
    };
  }, [palco, razoes, anim]);
  // 'original' = usuário escolheu explicitamente sem filtro; null = automático
  const [manualFiltro, setManualFiltro] = useState<FilterId | 'original' | null>(null);
  const [capturando, setCapturando] = useState(false);

  const vibe = useMemo(() => detectVibe({ facing }), [facing]);
  const filtroAuto = manualFiltro === null && filtroAutomatico;
  const filtroAtivo: FilterId | null =
    manualFiltro === 'original' ? null : (manualFiltro ?? (filtroAutomatico ? vibe.filtro : null));
  const filtro = filtroAtivo ? filterById(filtroAtivo) : null;

  // Callback estável: recriado a cada render, ele invalidaria a memoização dos
  // chips e o carrossel inteiro voltaria a redesenhar a cada troca de filtro.
  const escolherFiltro = useCallback(
    (id: FilterId | null) => setManualFiltro(id ?? 'original'),
    [],
  );

  /**
   * Lê as resoluções reais do sensor. Serve a duas coisas: o rótulo de
   * megapixels do painel (o Figma traz "12M" cravado, e repetir isso seria
   * inventar um número sobre o aparelho de quem usa) e, desde o T086, a escolha
   * da `pictureSize` que já sai no enquadramento certo.
   *
   * Passou a rodar assim que a câmera fica pronta, e não mais só quando o painel
   * abre: agora a lista decide como a **foto** é tirada, então precisa estar em
   * mãos antes do primeiro disparo, não depois de alguém abrir "+ Opções".
   */
  const lerTamanhos = useCallback(() => {
    if (!cameraRef.current) return;
    cameraRef.current
      .getAvailablePictureSizesAsync()
      .then(setTamanhos)
      .catch(() => {});
  }, []);
  const resolucao = tamanhos.length > 0 ? rotuloDeResolucao(tamanhos) : null;

  /**
   * Flash (T067) — três estados **visíveis**, não um toggle cego: a pessoa
   * precisa saber se está em automático ou forçado antes de disparar.
   */
  const proximoFlash = () =>
    setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'));

  /**
   * Câmera frontal deste tipo de aparelho não tem flash. Em vez de mostrar um
   * controle que não faz nada — e portanto mente —, ele fica esmaecido e
   * inerte, e o modo volta para `off` para o ícone não prometer luz que não vem.
   */
  const flashDisponivel = facing === 'back';

  const flip = () => {
    // flip recalcula a prévia da vibe (FR-001): frontal puxa vibes pessoais
    setFacing((f) => {
      const novo = f === 'back' ? 'front' : 'back';
      if (novo === 'front') setFlash('off');
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
        /**
         * O que barateia o disparo (T085/T086) é a `pictureSize`: pedindo ao
         * sensor um modo que já tem a proporção escolhida, o preparo vira só o
         * giro, sem recorte — e sem os 64MP que este aparelho entregava por
         * padrão, que eram o grosso do tempo de recodificação.
         *
         * O giro em si não tem como ser pulado: o arquivo vem deitado do
         * sensor, e é ele que precisa ir para o pacote em pé.
         */
        const { uri: photoUri, aspecto } = await prepararFoto({
          uri: foto.uri,
          largura: foto.width,
          altura: foto.height,
          razaoAlvo,
          frontal: facing === 'front',
        });
        router.push('/capture');
        startSession({
          mediaId: null,
          photoUri,
          aspecto,
          filtroId: filtroAtivo,
          filtroAuto,
          vibeId: vibe.id,
          musica: null,
          trechoInicio: 0,
          trechoFim: 30,
        });
      }
    } finally {
      setCapturando(false);
    }
  }, [capturando, facing, razaoAlvo, filtroAtivo, filtroAuto, router, startSession, vibe.id]);

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

  return (
    <View style={styles.root}>
      <FundoBase />

      <SafeAreaView style={styles.ui} pointerEvents="box-none">
        {/* Barra de status: vibe detectada + Ajustes */}
        <View style={styles.topBar}>
          {/* O painel aberto toma a linha inteira. O Figma desenhou 4 slots numa
              barra de 382; com flash, três enquadramentos, resolução e ajustes
              são seis, e dividir a linha com o badge fazia "16:9" e "64M" se
              encostarem. A vibe volta assim que o painel fecha. */}
          {opcoesAbertas ? null : (
            <View style={styles.vibeBadge}>
              <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
              <View>
                <Text style={styles.vibeLabel}>VIBE · PRÉVIA</Text>
                <Text style={styles.vibeNome}>{vibe.nome.toUpperCase()}</Text>
              </View>
            </View>
          )}
          {opcoesAbertas ? (
            <CameraOptionsBar
              resolucao={resolucao}
              onFechar={() => setOpcoesAbertas(false)}
              onAjustes={() => router.push('/settings')}
              slotFlash={
                <Pressable
                  hitSlop={hitSlops.chip}
                  disabled={!flashDisponivel}
                  onPress={proximoFlash}
                  style={!flashDisponivel && { opacity: 0.3 }}
                >
                  <View style={styles.flashSlot}>
                    <Ionicons
                      name={flash === 'off' ? 'flash-off-outline' : 'flash'}
                      size={20}
                      color={flash === 'off' ? colors.parchment : colors.amber}
                    />
                    {flash === 'auto' ? <Text style={styles.flashAuto}>A</Text> : null}
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
          ) : (
            <Pressable
              style={styles.opcoes}
              hitSlop={hitSlops.chip}
              onPress={() => setOpcoesAbertas(true)}
            >
              <Text style={styles.opcoesText}>+ OPÇÕES</Text>
            </Pressable>
          )}
        </View>

        {/* Palco do visor (T087): a faixa entre a barra superior e os controles.
            Era `absoluteFill`, e por isso a prévia se centralizava na tela toda
            — com meia foto atrás do carrossel e dos botões. O filtro e a grade
            vêm para dentro dele pelo mesmo motivo: são camadas *da imagem*, e
            estavam pintando a tela inteira, fundo da identidade incluído. */}
        <View
          style={styles.palco}
          pointerEvents="none"
          onLayout={(e) =>
            setPalco({
              largura: e.nativeEvent.layout.width,
              altura: e.nativeEvent.layout.height,
            })
          }
        >
          {medidas ? (
            <Animated.View
              style={[styles.visor, { width: medidas.largura, height: medidas.altura }]}
            >
              {focada ? (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  flash={flash}
                  // Pede ao sensor o modo que já tem a proporção escolhida; sem
                  // um que sirva (1:1), fica no padrão e o recorte resolve.
                  {...(tamanhoNativo ? { pictureSize: tamanhoNativo } : {})}
                  onCameraReady={lerTamanhos}
                />
              ) : null}
              {filtro ? <FilterLayer filter={filtro} /> : null}
              {gradeComposicao ? <GridOverlay /> : null}
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {manualFiltro ? (
            <Pressable
              style={styles.autoBtn}
              hitSlop={hitSlops.chip}
              onPress={() => setManualFiltro(null)}
            >
              <Ionicons name="refresh" size={12} color={colors.amber} />
              <Text style={styles.autoBtnText}>VOLTAR AO AUTOMÁTICO</Text>
            </Pressable>
          ) : null}

          <FilterCarousel ativo={filtroAtivo} autoAtivo={filtroAuto} onSelect={escolherFiltro} />

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
                <Ionicons name="images-outline" size={22} color={colors.parchment} />
              )}
            </Pressable>

            <Pressable
              onPress={capturar}
              style={[styles.shutterOuter, capturando && { opacity: 0.5 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <Pressable style={styles.sideBtn} onPress={flip}>
              <Ionicons name="camera-reverse-outline" size={24} color={colors.parchment} />
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
      <View style={[styles.gridLine, { left: '33.3%', width: 1, height: '100%' }]} />
      <View style={[styles.gridLine, { left: '66.6%', width: 1, height: '100%' }]} />
      <View style={[styles.gridLine, { top: '33.3%', height: 1, width: '100%' }]} />
      <View style={[styles.gridLine, { top: '66.6%', height: 1, width: '100%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  palco: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visor: {
    overflow: 'hidden',
    borderRadius: radii.card,
  },
  flashSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  flashAuto: {
    color: colors.amber,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  enquadramentos: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: fonts.labelLight,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  vibeNome: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
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
    fontFamily: fonts.labelForte,
    fontSize: 11,
    letterSpacing: 1,
  },
  bottom: {
    gap: 14,
    paddingBottom: 18,
  },
  autoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  autoBtnText: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
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

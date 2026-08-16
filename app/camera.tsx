import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { CameraType, CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  /**
   * As faixas da tela, medidas no layout (T093). São quatro, de cima para
   * baixo: barra de opções, área útil, filtros e controles. O visor se posiciona
   * em relação a elas, e cada enquadramento escolhe a sua âncora.
   */
  const [faixas, setFaixas] = useState({ ui: 0, topo: 0, baixo: 0, controles: 0 });
  const { width: larguraTela } = useWindowDimensions();
  /**
   * Os insets entram na conta porque a camada do visor é `absoluteFill` dentro
   * da `SafeAreaView`, e `absoluteFill` **ignora o padding** dela: a camada vai
   * até a borda física, enquanto a barra de controles para na borda segura.
   * Sem descontar isso, o 16:9 ancorado "no topo dos controles" descia a altura
   * da barra de navegação inteira — e voltava a aparecer atrás dos botões.
   */
  const insets = useSafeAreaInsets();

  const enquadramento = enquadramentoPor(enquadramentoId);
  /** FULL não tem razão própria: a razão dele é a da tela. */
  const razaoAlvo =
    enquadramento.razao ?? (faixas.ui > 0 ? larguraTela / faixas.ui : 9 / 16);

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
   * Posição e altura do visor, animadas (T077/T091/T093). **A largura é sempre
   * a da tela**, nos quatro enquadramentos.
   *
   * O que muda entre eles é a âncora, e ela não segue da razão — é escolha,
   * declarada em `ENQUADRAMENTOS`:
   *
   * - 4:3 e 1:1 cabem na área útil e ficam centralizados **nela**, entre a barra
   *   de opções e os filtros. Centralizá-los na tela inteira, como a versão
   *   anterior fazia, subia os dois e desalinhava o que já estava bom.
   * - 16:9 não cabe: encosta no topo dos controles e cresce para cima. Ancorado
   *   assim, ele não deixa faixa de imagem sobrando entre os filtros e os
   *   botões — que era o "passa por baixo dos controladores" que o Sávio viu — e
   *   passa por baixo dos filtros e das opções inteiro, nunca pela metade.
   * - FULL é a tela toda, atrás de tudo.
   *
   * A animação corre sobre o **índice** do enquadramento, não sobre a razão:
   * `top` e `height` de cada um são pontos conhecidos, e interpolar entre eles
   * mantém a transição contínua mesmo com âncoras diferentes.
   */
  const indices = useMemo(() => ENQUADRAMENTOS.map((_, i) => i), []);
  const geometrias = useMemo(() => {
    const { ui, topo, baixo, controles } = faixas;
    if (!ui || !larguraTela) return null;
    // Bordas do conteúdo, já descontados os paddings da área segura.
    const topoConteudo = insets.top;
    const fundoConteudo = ui - insets.bottom;
    const alturaUtil = fundoConteudo - topoConteudo - topo - baixo;
    return ENQUADRAMENTOS.map((e) => {
      if (e.ancora === 'tela') return { top: 0, height: ui };
      const height = larguraTela / (e.razao ?? larguraTela / ui);
      const top =
        e.ancora === 'controles'
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
      top: anim.interpolate({ inputRange: indices, outputRange: geometrias.map((g) => g.top) }),
      height: anim.interpolate({
        inputRange: indices,
        outputRange: geometrias.map((g) => g.height),
      }),
    };
  }, [geometrias, indices, anim]);
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
   * Abertura do painel "+ Opções" (T079). Ele trocava de conteúdo num frame —
   * o chip sumia e a barra aparecia no lugar, seca. Agora o badge de vibe e o
   * chip saem esmaecendo enquanto a barra entra deslizando de cima, e o inverso
   * ao fechar. É a mesma troca, com o tempo que ela precisava para ser lida.
   *
   * `useNativeDriver` liga porque só opacidade e `translateY` estão em jogo.
   */
  const abertura = useRef(new Animated.Value(0)).current;

  /**
   * A entrada roda num efeito, **depois** da montagem — e não junto com o
   * comando. Com `useNativeDriver`, uma animação disparada antes de o nó nativo
   * existir termina no vazio: o driver não tem o que atualizar e a barra
   * aparecia com opacidade 0, invisível. Visto no aparelho.
   */
  useEffect(() => {
    if (!opcoesAbertas) return;
    abertura.setValue(0);
    Animated.timing(abertura, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opcoesAbertas, abertura]);

  const fecharOpcoes = useCallback(() => {
    Animated.timing(abertura, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Só desmonta no fim: desmontar junto com o toque cortaria a saída.
      if (finished) setOpcoesAbertas(false);
    });
  }, [abertura]);

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

      <SafeAreaView
        style={styles.ui}
        pointerEvents="box-none"
        onLayout={(e) => {
          // O valor é lido **antes** do updater: dentro dele o evento já foi
          // reciclado pelo React e `nativeEvent` vem nulo (visto no aparelho).
          const h = e.nativeEvent.layout.height;
          setFaixas((f) => ({ ...f, ui: h }));
        }}
      >
        {/* Camada do visor (T091/T093): posiciona a prévia pela âncora do
            enquadramento. Mora **dentro** da área segura de propósito — as
            faixas são medidas neste mesmo referencial, e montá-la na raiz
            deslocaria tudo pela altura da barra de status. Vem antes da
            interface no JSX, então tudo desenha por cima dela. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[
              styles.visor,
              { width: larguraTela, top: visorAnimado?.top ?? 0, height: visorAnimado?.height ?? 0 },
            ]}
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
            {/* Camadas *da imagem*: dentro do visor, não sobre a tela inteira. */}
            {filtro ? <FilterLayer filter={filtro} /> : null}
            {gradeComposicao ? <GridOverlay /> : null}
          </Animated.View>
        </View>

        {/* Barra de status: vibe detectada + Ajustes */}
        <View
          style={styles.topBar}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setFaixas((f) => ({ ...f, topo: h }));
          }}
        >
          {/* O painel aberto toma a linha inteira. O Figma desenhou 4 slots numa
              barra de 382; com flash, três enquadramentos, resolução e ajustes
              são seis, e dividir a linha com o badge fazia "16:9" e "64M" se
              encostarem. A vibe volta assim que o painel fecha.

              Os dois estados ficam **sobrepostos** e trocam por opacidade: era a
              troca instantânea de um pelo outro que fazia o painel "abrir seco"
              (T079). Desmontar um para montar o outro não deixa nada para
              animar. */}
          <Animated.View
            style={[
              styles.linhaPadrao,
              { opacity: abertura.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ]}
            pointerEvents={opcoesAbertas ? 'none' : 'box-none'}
          >
            <View style={styles.vibeBadge}>
              <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
              <View>
                <Text style={styles.vibeLabel}>VIBE · PRÉVIA</Text>
                <Text style={styles.vibeNome}>{vibe.nome.toUpperCase()}</Text>
              </View>
            </View>
            <Pressable
              style={styles.opcoes}
              hitSlop={hitSlops.chip}
              onPress={() => setOpcoesAbertas(true)}
            >
              <Text style={styles.opcoesText}>+ OPÇÕES</Text>
            </Pressable>
          </Animated.View>

          {opcoesAbertas ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  justifyContent: 'center',
                  opacity: abertura,
                  transform: [
                    {
                      translateY: abertura.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-14, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
            <CameraOptionsBar
              resolucao={resolucao}
              onFechar={fecharOpcoes}
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
            </Animated.View>
          ) : null}
        </View>

        {/* O visor mora fora da interface; aqui só sobra o espaço que empurra a
            barra de baixo para o rodapé. */}
        <View style={styles.espaco} pointerEvents="none" />

        <View
          style={styles.bottom}
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setFaixas((f) => ({ ...f, baixo: h }));
          }}
        >
          {/* A "sombrinha" que o Sávio pediu: no 16:9 o carrossel fica sobre a
              imagem, e sem este degradê os chips disputariam contraste com
              qualquer cena clara. Ele morre antes dos controles, que já têm o
              fundo da identidade atrás. */}
          <LinearGradient
            colors={['rgba(9,5,6,0)', 'rgba(9,5,6,0.55)', 'rgba(9,5,6,0.9)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
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

          {/* Home bar: galeria / captura / flip. A medida daqui é o piso do
              visor — por isso ela é lida no layout (T091). */}
          <View
            style={styles.controls}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height + 18;
              setFaixas((f) => ({ ...f, controles: h }));
            }}
          >
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
  espaco: {
    flex: 1,
  },
  /**
   * Faixa em que o visor pode viver: do topo da tela até o topo dos controles.
   * Ele se centraliza aqui dentro — no 4:3 e no 1:1 sobra folga dos dois lados;
   * no 16:9 a altura toma quase tudo e o carrossel passa a flutuar por cima.
   */
  visor: {
    position: 'absolute',
    left: 0,
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
    paddingHorizontal: 16,
    paddingTop: 8,
    // Altura fixa para os dois estados ocuparem exatamente o mesmo espaço — sem
    // isso a linha saltaria de tamanho no meio do crossfade.
    height: 60,
    justifyContent: 'center',
  },
  linhaPadrao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import type { LayoutAnimationConfig } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { FilteredImage } from '@/components/FilteredImage';
import { FundoBase } from '@/components/FundoBase';
import { LoaderMarca } from '@/components/LoaderMarca';
import { TratamentoCarrossel } from '@/components/TratamentoCarrossel';
import { MusicPlayer } from '@/components/MusicPlayer';
import { MusicSheet } from '@/components/MusicSheet';
import { PostSheet } from '@/components/PostSheet';
import { filterById, resolverReceita } from '@/constants/filters';
import { vibeById } from '@/constants/vibes';
import { identidadeDoLook, montarLooks } from '@/services/looks';
import { analyzePhotoAndSuggest, EtapaCuradoria, getSuggestions } from '@/services/music';
import { persistAudioPreview, persistPhoto } from '@/services/mediaStorage';
import * as preExport from '@/services/preExport';
import { renderizarLook } from '@/services/renderLook';
import { exportPackage, SharePackage } from '@/services/sharePackage';
import { saveToSystemGallery } from '@/services/systemGallery';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLookTasteStore } from '@/stores/useLookTasteStore';
import { useTasteStore } from '@/stores/useTasteStore';
import { colors, fonts, hitSlops, radii, sizes } from '@/theme/tokens';
import { FilterId, LookRecipe, Media } from '@/types';

/**
 * Tempo máximo em `carregando` antes de liberar a postagem com confirmação.
 * A mediana medida é de ~6s (baseline.md T003); 30s é folga de 5x sobre o pior
 * caso observado, e existe só para que uma requisição pendurada não prenda o
 * usuário — nunca para encurtar uma curadoria que está progredindo.
 */
const LIMITE_CURADORIA_MS = 30_000;

/**
 * Quietude antes de disparar a pré-geração do vídeo em segundo plano.
 *
 * Arrastar o slider do recorte muda a chave do pacote a cada passo; sem esta
 * espera, cada passo dispararia uma exportação de ~10s que seria descartada no
 * passo seguinte — gasto de bateria puro. Esperar o usuário assentar a escolha
 * é o que torna a antecipação barata.
 */
const ESPERA_QUIETUDE_MS = 2_500;

// Na arquitetura antiga do Android o LayoutAnimation vem desligado. Ligar é
// idempotente e barato; sem isso, arquivar a trilha seria um corte seco.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Transição de arquivar/reativar a trilha: o player e a linha de ações somem, e
 * a identidade da faixa escorrega para o espaço que sobrou.
 *
 * `LayoutAnimation` anima a mudança de layout inteira numa tacada — o que é
 * exatamente o caso aqui, porque o que se move não é uma propriedade só, é a
 * altura do card e a posição de tudo que está dentro dele.
 */
const TRANSICAO_TRILHA: LayoutAnimationConfig = {
  duration: 260,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};

/**
 * Texto de cada etapa da curadoria (FR-Q08). Substitui o rótulo único que
 * ficava parado por até 30s — o Princípio III trata percepção de latência como
 * defeito, e um texto imóvel é o que faz a espera parecer travamento.
 */
const TEXTO_ETAPA: Record<EtapaCuradoria, string> = {
  preparando: 'PREPARANDO A CENA...',
  lendo: 'LENDO A CENA...',
  buscando: 'BUSCANDO AS FAIXAS...',
};

/**
 * Modal de Captura (US3/US4/US5): pacote sensorial em edição — foto + filtro
 * + música + trecho. Salvar/Postar preservam a unidade aprovada (RN-001).
 */
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

  // Um <Modal> desenha na própria janela, sem o SafeAreaView da tela por baixo:
  // o espaçamento inferior tem de vir do inset real, senão a barra de navegação
  // come a metade de baixo de "Salvar" e "Postar agora" (medido: 130px em
  // navegação por botões, 44px em gestos — ver baseline.md T004).
  const insets = useSafeAreaInsets();
  /**
   * Teto de altura da prévia, em pixels reais.
   *
   * `maxHeight` percentual não serve aqui: dentro de um ScrollView a
   * porcentagem se mede contra a altura do *conteúdo*, não da tela. Sem o
   * teto, uma foto retrato (3:4) em `width: 100%` rende ~1400px e empurra o
   * carrossel de tratamentos para fora da dobra — a pessoa teria de rolar
   * para ver as opções que o app acabou de sugerir. 58% deixa a foto
   * claramente dominante e ainda cabe a fileira de escolhas.
   */
  const { height: alturaJanela } = useWindowDimensions();
  const alturaMaxPreview = Math.round(alturaJanela * 0.58);
  const previewRef = useRef<View>(null);
  const [showMusic, setShowMusic] = useState(false);
  const [sharePkg, setSharePkg] = useState<SharePackage | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState<EtapaCuradoria>('preparando');

  /**
   * Exportação em curso (T045). `salvando` não servia para isto: ele é ligado
   * e já desligado dentro de `salvar()`, *antes* de `exportPackage()` rodar — e
   * é `exportPackage` que leva os 20–30s da geração do .mp4. Nesse intervalo o
   * botão ficava habilitado e mudo, então cada toque disparava uma exportação
   * nova em paralelo; a que resolvia sem vídeo abria a tela de pacote "em duas
   * partes", e a mais lenta sobrescrevia depois. Daí a sensação de travamento.
   */
  const [postando, setPostando] = useState(false);
  /** Espelho síncrono de `postando`: dois toques seguidos chegam antes do re-render. */
  const postandoRef = useRef(false);
  /**
   * Progresso real da geração do .mp4, 0–100 (FR-Q09/T035). `null` significa
   * "o device não sabe informar" — e aí o indicador fica indefinido em vez de
   * fingir avanço (contrato C-04).
   */
  const [progresso, setProgresso] = useState<number | null>(null);

  // Estável pelo mesmo motivo do visor: mantém a memoização dos chips de pé
  const escolherFiltro = useCallback(
    // Escolher um dos 8 presets zera a receita: o que ela pediu foi o preset
    // puro, não o look ajustado. `lookAuto: false` porque houve toque — e é o
    // toque, não o resultado, que distingue escolha de aceite passivo (FR-011).
    (id: FilterId | null) =>
      patch({ filtroId: id, filtroAuto: false, lookEscolhido: null, lookAuto: false }),
    [patch],
  );

  /**
   * Troca entre as três sugestões (FR-005). Só mexe no estado da sessão — nada
   * de rede, nada de recarregar a tela: as três receitas já estão na memória
   * desde que a curadoria voltou, e é isso que faz a troca ser instantânea
   * (SC-003).
   *
   * `filtroId` acompanha a âncora do look para que tudo que ainda raciocina por
   * filtro (miniaturas, rótulo "FILTRO", galeria, mídias antigas) continue certo.
   */
  const escolherLook = useCallback(
    (look: LookRecipe) =>
      patch({ lookEscolhido: look, filtroId: look.base, filtroAuto: false, lookAuto: false }),
    [patch],
  );

  // Estável também: o `status` do áudio muda a cada tick e re-renderiza o
  // player; se este callback fosse recriado junto, os `PanResponder` das
  // bolinhas do recorte seriam refeitos no meio do arraste.
  const aplicarTrecho = useCallback(
    (inicio: number, fim: number) => patch({ trechoInicio: inicio, trechoFim: fim }),
    [patch],
  );

  /**
   * Arquiva ou reativa a trilha. A faixa **continua escolhida** nos dois casos;
   * o que muda é se ela entra no pacote. Por isso reativar é instantâneo — não
   * há nada para buscar de novo, nem no Deezer nem no Gemini.
   */
  const alternarArquivo = useCallback(
    (arquivar: boolean) => {
      /**
       * A animação só é agendada quando o carrossel **não** está prestes a
       * trocar de filhos (T103).
       *
       * `LayoutAnimation.configureNext` vale para a próxima atualização da
       * árvore inteira, não só para este card. Se a curadoria voltar dentro dos
       * 260ms da transição, a `FlatList` de tratamentos troca os três
       * esqueletos (`esq-*`) pelos três looks (`look-*`) — chaves diferentes,
       * três filhos desmontados e três montados — e o
       * `ReactClippingViewManager` tenta reinserir uma view que a animação
       * ainda segura: `addViewAt: failed to insert view ... already has a
       * parent`, que derruba o app com uma exceção nativa.
       *
       * Enquanto a curadoria corre, arquivar/reativar faz o corte seco. É a
       * troca certa: perder 260ms de suavidade num caso de borda vale menos que
       * um crash que leva o momento junto.
       */
      if (useCaptureStore.getState().session?.curadoria !== 'carregando') {
        LayoutAnimation.configureNext(TRANSICAO_TRILHA);
      }
      patch({ trilhaArquivada: arquivar });
    },
    [patch],
  );

  // O `LayoutAnimation` cuida do movimento; o esmaecer da faixa arquivada é uma
  // propriedade só, e sai mais suave (e na GPU) por `Animated`.
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

  /**
   * Proporção **do arquivo**, medida nele (T084).
   *
   * A prévia usava `session.aspecto`, que é a razão *pedida* no visor. Quando as
   * duas discordavam — recorte que não rodou, sensor que entregou outra coisa —,
   * a foto era desenhada em `cover` dentro de um quadro da razão errada, e o que
   * sobrava era cortado: exatamente o "zoom" que aparecia entre o disparo e a
   * tela de captura.
   *
   * Medindo o arquivo, largura 100% e altura pela razão real, não há corte nem
   * distorção possível — é a regra que o Sávio deu, e ela se cumpre sozinha.
   */
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
      // Não deu para medir: fica com o aspecto da sessão, que é o que havia
      // antes — pior que a medida, melhor que nada.
      () => {},
    );
    return () => {
      vivo = false;
    };
  }, [photoUri]);

  // Análise sensorial fora do caminho crítico do frame (constituição III):
  // com "Detecção em tempo real" ativa, a PRÓPRIA FOTO vai ao Gemini, que
  // infere a vibe real da cena e cura as faixas numa só chamada (T-0A/T-0B);
  // desativada, nada sai do aparelho e a curadoria usa a vibe heurística.
  // Guarda de disparo único por foto. Antes esse papel era do próprio
  // `carregandoSugestoes`, o que impedia a sessão de já nascer "carregando" —
  // e era nessa janela que a postagem escapava sem trilha.
  const analisada = useRef<string | null>(null);
  useEffect(() => {
    if (!photoUri || analisada.current === photoUri) return;
    const { session: s } = useCaptureStore.getState();
    if (!s || s.sugestoes.length > 0) return;

    /**
     * Mídia reaberta da galeria não se cura de novo (T083).
     *
     * A guarda acima olhava só para `sugestoes`, e um pacote salvo volta com a
     * lista vazia — as sugestões nunca tinham sido persistidas. Reabrir uma foto
     * antiga saía chamando o Gemini, jogava a tela de volta em `carregando` e
     * ainda sobrescrevia a vibe salva pela vibe recalculada. O pacote já está
     * decidido; quem quiser mexer na trilha abre o "Trocar música", e aí sim a
     * busca acontece — por pedido, não sozinha.
     */
    if (s.mediaId !== null) {
      analisada.current = photoUri;
      patch({ curadoria: s.musica ? 'pronta' : 'indisponivel' });
      return;
    }

    analisada.current = photoUri;

    // Curadoria desligada nos ajustes: não há o que esperar. Sai de
    // `carregando` na hora, senão a postagem ficaria bloqueada para sempre.
    if (!sugestaoAutomatica && !deteccaoTempoReal) {
      patch({ curadoria: s.musica ? 'pronta' : 'indisponivel' });
      return;
    }

    patch({ curadoria: 'carregando' });

    // Transição "carregando --(tempo limite)--> indisponivel" do data-model.
    // Rede curta em `music.ts` (22s no Gemini, 8s no Deezer) já cobre o caso
    // normal; este limite é a rede de segurança da interface, para qualquer
    // caminho que ainda assim não devolva — sem ele o bloqueio da postagem
    // vira armadilha, como se observou no device na validação da US2.
    const limite = setTimeout(() => {
      if (useCaptureStore.getState().session?.curadoria === 'carregando') {
        patch({ curadoria: 'indisponivel' });
      }
    }, LIMITE_CURADORIA_MS);

    const analise = deteccaoTempoReal
      ? analyzePhotoAndSuggest(s.photoUri, vibeById(s.vibeId), setEtapa)
      : // Curadoria por vibe: não há cena lida, mas os três looks saem do mesmo
        // jeito, derivados da vibe heurística. Um caminho que devolvesse zero
        // looks quebraria FR-001 justamente para quem desligou o Gemini.
        getSuggestions(vibeById(s.vibeId), setEtapa).then((sugestoes) => ({
          vibeId: null,
          sugestoes,
          looks: montarLooks(undefined, s.vibeId),
        }));
    analise
      .then(({ vibeId: vibeReal, sugestoes, looks }) => {
        clearTimeout(limite);
        const atual = useCaptureStore.getState().session;
        if (!atual || atual.photoUri !== photoUri) return;
        const primeira =
          sugestoes.find((m) => m.previewUrl) ?? sugestoes[0] ?? null;
        // Redução do atrito: o sistema decide, o usuário refina (US3)
        const escolheSozinho =
          sugestaoAutomatica && atual.musica === null && atual.mediaId === null;
        const musicaFinal = escolheSozinho ? primeira : atual.musica;
        // A sugestão principal já vem aplicada, sem exigir toque (FR-004) — mas
        // só se ninguém tiver tocado em nada enquanto a curadoria rodava.
        // Sobrescrever uma escolha feita durante a espera seria desfazer a
        // decisão da pessoa por causa de uma resposta que chegou atrasada.
        const lookPrincipal = looks[0] ?? null;
        // `filtroAutomatico` (Ajustes → "Tratamento automático") é o que
        // autoriza a aplicação sem toque. Desligado, as três sugestões
        // aparecem e esperam a escolha.
        const aplicaLook = filtroAutomatico && atual.lookAuto && lookPrincipal !== null;
        patch({
          sugestoes,
          looks,
          ...(aplicaLook ? { lookEscolhido: lookPrincipal, filtroId: lookPrincipal.base } : {}),
          // `pronta` só quando existe trilha de fato; caso contrário a
          // postagem passa a exigir confirmação em vez de sair calada (RV-01)
          curadoria: musicaFinal ? 'pronta' : 'indisponivel',
          // A vibe real da foto substitui a prévia do visor (T-0A)
          ...(vibeReal ? { vibeId: vibeReal } : {}),
          // Filtro acompanha a vibe real enquanto o usuário não escolher um.
          // Só vale quando não houve look para aplicar: a partir da feature 003
          // quem manda no tratamento é a sugestão principal, e a tabela fixa
          // `vibe → filtro` fica sendo apenas o piso da degradação.
          ...(vibeReal && atual.filtroAuto && !aplicaLook
            ? { filtroId: vibeById(vibeReal).filtro }
            : {}),
          // Mesma invalidação da troca manual (T102): faixa nova, arquivo
          // local antigo não vale mais.
          ...(escolheSozinho ? { musica: primeira, audioUri: null } : {}),
        });
      })
      .catch(() => {
        clearTimeout(limite);
        patch({ curadoria: 'indisponivel' });
      });
  }, [photoUri, sugestaoAutomatica, deteccaoTempoReal, filtroAutomatico, patch]);

  /**
   * Exporta a foto com o tratamento aplicado, na resolução do arquivo
   * original (T037, FR-024) — não mais um print da prévia na resolução da
   * tela, que é o que `captureRef` sempre fez.
   *
   * `renderizarLook` (Skia) é o caminho de primeira classe; o `captureRef`
   * continua como rede de segurança para quando o nativo ainda não foi
   * regerado no dev build (research R3, carga opcional) — sem ele, salvar ou
   * postar antes do rebuild sairia sem filtro nenhum, enquanto a prévia na
   * tela (que já cai para o render legado nesse caso) mostraria um. Manter
   * os dois em série é o que garante que o arquivo exportado sempre bate com
   * o que a pessoa viu na prévia, com ou sem o rebuild.
   */
  const renderizarComFiltro = useCallback(async (): Promise<string> => {
    const s = useCaptureStore.getState().session;
    if (!s) return '';
    // Sem filtro, a imagem sai exatamente como capturada (T-0B)
    if (!s.filtroId) return s.photoUri;
    const filtro = s.lookEscolhido ? resolverReceita(s.lookEscolhido) : filterById(s.filtroId);
    const viaSkia = await renderizarLook(s.photoUri, filtro);
    if (viaSkia) return viaSkia;
    try {
      return await captureRef(previewRef, { format: 'jpg', quality: 0.92 });
    } catch {
      return s.photoUri;
    }
  }, []);

  /**
   * Identidade do pacote a exportar. Muda quando muda qualquer coisa que o
   * vídeo carrega — foto, filtro, faixa ou recorte —, e é ela que decide se um
   * vídeo pré-gerado ainda serve.
   */
  const chave = session
    ? preExport.chavePacote({
        photoUri: session.photoUri,
        // A âncora não basta: dois looks podem partir do mesmo preset e sair
        // diferentes. Sem a receita na chave, o vídeo pré-gerado de um look
        // seria servido para outro (D7).
        filtroId: session.lookEscolhido
          ? identidadeDoLook(session.lookEscolhido)
          : session.filtroId,
        // Arquivada entra como "sem música" na chave: o pacote resultante é
        // outro, e servir o vídeo com trilha aqui seria entregar o que o
        // usuário acabou de tirar.
        musicaId: session.trilhaArquivada ? null : (session.musica?.id ?? null),
        trechoInicio: session.trechoInicio,
        trechoFim: session.trechoFim,
      })
    : null;

  /**
   * Antecipa a geração do .mp4 enquanto o usuário ainda decide. A premissa do
   * produto é agilizar o post; o tempo que ele passa ouvindo a prévia e
   * ajustando o recorte é tempo que o aparelho pode estar trabalhando, em vez
   * de cobrar ~10s parado depois do toque em "Postar".
   */
  const pronta = session?.curadoria === 'pronta';
  const temMusica = Boolean(session?.musica);
  useEffect(() => {
    if (!chave || !pronta || !temMusica) return;
    // Não competir com a exportação de verdade nem com a tela de destinos já
    // aberta: ali o arquivo pode estar em uso, e a limpeza de cache o apagaria.
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

  // Sessão encerrada: o pacote pré-gerado não vale para a próxima foto.
  // Continua valendo agora que a captura é uma tela: o unmount acontece ao sair
  // da rota, e sem isto o cache de vídeo voltaria a crescer (foi o T040).
  useEffect(
    () => () => {
      console.log('[capture] tela desmontada — pré-geração descartada');
      preExport.limpar();
    },
    [],
  );

  /**
   * Botão/gesto de voltar do Android.
   *
   * Enquanto a captura era `<Modal>`, quem fazia este papel era o
   * `onRequestClose`. Na tela ele some, e sem substituto a pessoa perde a
   * captura sem confirmação nenhuma — regressão direta da US2, que existe para
   * que a foto nunca se perca em silêncio.
   *
   * A ref é necessária porque `descartar` só pode ser definido depois do
   * `if (!session)`, e hooks não podem ficar atrás de um return antecipado.
   */
  const descartarRef = useRef<() => void>(() => {});
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      descartarRef.current();
      return true; // consumimos o evento: quem fecha a tela é o descartar()
    });
    return () => sub.remove();
  }, []);

  if (!session || !chave) return null;

  // Enquanto a curadoria corre, ninguém consegue postar um pacote pela metade
  const curando = session.curadoria === 'carregando';
  // Trilha escolhida mas fora do pacote: exporta só imagem + filtro
  const arquivada = session.trilhaArquivada;
  const filtro = session.filtroId ? filterById(session.filtroId) : null;
  const vibe = vibeById(session.vibeId);
  const editando = session.mediaId !== null;

  const salvar = async (fechar: boolean): Promise<Media | null> => {
    if (salvando) return null;
    setSalvando(true);
    try {
      // A mídia gravada reflete o pacote: com a trilha arquivada, o registro
      // sai sem música, igual ao que foi exportado.
      const musicaDoPacote = session.trilhaArquivada ? null : session.musica;
      // O id sobe para antes do download da trilha: o .mp3 é nomeado por ele, e
      // no ramo de captura nova ele só existia lá embaixo.
      const idNovo = session.mediaId ?? `${Date.now()}`;
      // Histórico de gosto (T057): vale a faixa que de fato foi no pacote, e só
      // ela. Trilha arquivada é rejeição — não registra. O peso é `auto`, bem
      // menor que o da troca no MusicSheet, porque aceitar passivamente o que o
      // sistema escolheu diz pouco sobre gosto.
      if (musicaDoPacote) {
        registrarEscolha(musicaDoPacote, session.vibeId, 'auto');
      }
      // Gosto visual (US2): registra o tratamento que de fato foi ao ar, sob a
      // vibe daquela foto. `lookAuto` é o que separa os dois pesos — quem tocou
      // num chip recusou o que estava aplicado, e isso diz muito mais do que
      // aceitar em silêncio o que o sistema propôs (FR-010, FR-011).
      //
      // "Sem tratamento" também é registrado, como escolha e não como vazio: a
      // spec trata a foto original como opção de primeira classe.
      registrarEscolhaVisual(
        session.lookEscolhido,
        session.vibeId,
        session.lookAuto ? 'auto' : 'manual',
      );
      /**
       * Trilha em disco (T102). A prévia do Deezer é um link que expira; sem
       * uma cópia local, reabrir o momento pela galeria deixava o player
       * girando para sempre. Baixa uma vez por faixa e reaproveita: trocar de
       * música invalida, salvar de novo a mesma não rebaixa nada.
       *
       * Best-effort de ponta a ponta — falhar aqui devolve `null` e a mídia é
       * salva com a URL remota, como antes. Salvar a foto nunca depende de rede.
       */
      /**
       * O que vai para o registro é SEMPRE a cópia permanente.
       *
       * O cache de candidatas (T106) serve para tocar a prévia na hora, não
       * para ser guardado: `Paths.cache` é apagável pelo sistema, e um
       * `audioUri` apontando para lá traria de volta o T102 — player travado —
       * só que com um caminho local morto em vez de uma URL expirada. Por isso
       * `persistAudioPreview` roda de qualquer forma; o cache economiza a
       * *reprodução*, nunca a persistência.
       */
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
          musica: musicaDoPacote,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          // Reabrir e trocar de música atualiza o leque salvo junto com a
          // escolha — senão a mídia guardaria a faixa nova e as opções velhas.
          sugestoes: session.sugestoes,
          // Mesma lógica para o look (T039): sem isto, trocar de look numa
          // mídia reaberta nunca sobrevivia ao Salvar (FR-022).
          looks: session.looks,
          lookEscolhido: session.lookEscolhido ?? undefined,
          // Trocar de música numa mídia reaberta troca o arquivo local junto —
          // senão o registro guardaria a faixa nova e o .mp3 da antiga.
          audioUri: audioUri ?? undefined,
        });
      } else {
        const id = idNovo;
        // Nunca perder a foto: se a cópia permanente falhar, o registro
        // entra na galeria apontando para o arquivo original do cache.
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
          musica: musicaDoPacote,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          aspecto: session.aspecto,
          // As quatro opções vão junto: reabrir esta foto não precisa mais
          // consultar o Gemini para mostrar de onde a escolha saiu (T083).
          sugestoes: session.sugestoes,
          // Mesma ideia para os looks (T039): sem isto a US4 só funcionava
          // pela reconstrução de mídia antiga, e a decisão real nunca persistia.
          looks: session.looks,
          lookEscolhido: session.lookEscolhido ?? undefined,
          audioUri: audioUri ?? undefined,
          criadaEm: Date.now(),
          atualizadaEm: Date.now(),
        };
        add(media);
        patch({ mediaId: id, photoUri: uriPersistente });
        // Exporta a versão com filtro para a galeria do sistema (best-effort:
        // sem permissão ou no Expo Go retorna false e a mídia segue no app)
        await saveToSystemGallery(await renderizarComFiltro());
      }
      // A sessão passa a conhecer o arquivo: quem salvou e continuou editando
      // (o caminho do `salvar(false)` dentro de `exportar`) já toca do disco, e
      // um segundo Salvar não baixa de novo.
      if (audioUri && audioUri !== session.audioUri) patch({ audioUri });
      if (fechar) clear();
      return media;
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async () => {
    // Guarda de reentrada: uma exportação por vez. Sem isto, cada toque no
    // botão mudo abria uma geração de vídeo concorrente (T045).
    if (postandoRef.current) return;

    // Caminho rápido: o vídeo deste pacote já foi gerado enquanto o usuário
    // decidia. Sem barra, sem espera — a tela de destinos abre na hora, que é
    // a razão de existir da pré-geração.
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
      // Já tem uma pré-geração desta mesma chave em voo? Aproveita em vez de
      // começar outra — duas exportações do mesmo pacote seria desperdício.
      const emVoo = preExport.obterEmVoo(chave);
      // O pacote leva a unidade aprovada: imagem + trilha + trecho (RN-001).
      // No Expo Go sai como imagem + áudio + legenda; no dev build, .mp4 (T-07).
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
      // Falhar calado é o mesmo defeito de fundo da US2: ação de saída sem o
      // usuário saber em que pé está. A foto já foi salva por `salvar(false)`.
      Alert.alert(
        'Não deu para montar o momento',
        'A imagem está salva na galeria. Tente postar de novo em instantes.',
      );
    } finally {
      postandoRef.current = false;
      setPostando(false);
      setProgresso(null);
    }
  };

  /**
   * Postar nunca sai calado sem a metade sonora (constituição I):
   * - `carregando`: a ação nem chega aqui, está desabilitada com o motivo à vista;
   * - `indisponivel`: só segue depois de o usuário confirmar que aceita ir sem trilha;
   * - `pronta`: segue direto.
   */
  const postar = async () => {
    if (session.curadoria === 'carregando') return;
    // Também aqui, e não só em `exportar()`: sem isto o alerta de "postar sem
    // trilha" empilharia uma cópia por toque enquanto a exportação corre.
    if (postandoRef.current) return;
    // Arquivar já é a confirmação explícita de ir sem trilha (RV-01): o
    // usuário tirou a música com as próprias mãos, não faz sentido perguntar.
    if (session.curadoria === 'indisponivel' && !arquivada) {
      Alert.alert(
        'Postar sem trilha?',
        'Este momento vai só com a imagem — sem a metade sonora. Você pode esperar a curadoria, escolher uma faixa ou seguir assim mesmo.',
        [
          { text: 'Escolher música', onPress: () => setShowMusic(true) },
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Postar sem trilha', style: 'destructive', onPress: exportar },
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
    Alert.alert('Descartar captura?', 'A foto e o momento serão perdidos.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: clear },
    ]);
  };
  // O handler do botão de voltar aponta sempre para a versão corrente.
  descartarRef.current = descartar;

  return (
    <View style={styles.backdrop}>
      <FundoBase />
      <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{editando ? 'Lapidar.' : 'Captura.'}</Text>
            <Pressable onPress={descartar} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.parchment50} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Foto com o filtro aplicado (frame ~735/913 do Figma) */}
            <View ref={previewRef} collapsable={false} style={styles.previewShot}>
              {/* Único lugar do app com `usarSkia`: aqui a pessoa compara os
                  três looks de perto, então a fidelidade da matriz de cor se
                  paga, e há uma imagem só na tela. Galeria e miniaturas usam o
                  render leve — ver a nota em `FilteredImage`. */}
              <FilteredImage
                uri={session.photoUri}
                filtroId={session.filtroId}
                look={session.lookEscolhido}
                usarSkia
                style={[
                  styles.preview,
                  { aspectRatio: aspectoReal ?? session.aspecto, maxHeight: alturaMaxPreview },
                ]}
              />
            </View>

            <View style={styles.filtroRow}>
              {/* "VIBE", não "TRATAMENTO" (decisão do Sávio, 1.2.1): o rótulo
                  longo dominava a linha e competia com o nome do look à
                  direita, que é a informação que importa ali. "Vibe" é curto e
                  é a palavra que o produto já usa com o usuário. */}
              <Text style={styles.sectionLabel}>VIBE</Text>
              <Text style={styles.filtroAtual}>
                {session.lookEscolhido
                  ? session.lookEscolhido.nome.toUpperCase()
                  : filtro
                    ? `${filtro.emoji} ${filtro.nome.toUpperCase()}`
                    : '📷 ORIGINAL'}{' '}
                · VIBE {vibe.nome.toUpperCase()}
              </Text>
            </View>
            {/* Uma fileira só: os três looks (ou seus lugares reservados) e os
                nove presets. Antes eram duas seções que somadas passavam de
                300px — mais espaço que a própria foto. Ver
                `TratamentoCarrossel`. */}
            <View style={styles.carouselWrap}>
              <TratamentoCarrossel
                photoUri={session.photoUri}
                looks={session.looks}
                carregando={session.curadoria === 'carregando'}
                lookEscolhido={session.lookEscolhido}
                filtroAtivo={session.filtroId}
                onSelectLook={escolherLook}
                onSelectFiltro={escolherFiltro}
              />
            </View>

            {/* Música: a outra metade do pacote sensorial */}
            <Text style={[styles.sectionLabel, { paddingHorizontal: 20, marginTop: 18 }]}>
              TRILHA SONORA
            </Text>
            <View style={styles.musicBox}>
              {session.curadoria === 'carregando' ? (
                <View style={styles.loadingRow}>
                  <LoaderMarca tamanho={34} />
                  <Text style={styles.loadingText}>{TEXTO_ETAPA[etapa]}</Text>
                </View>
              ) : session.musica ? (
                <>
                  {/* Identidade da faixa. Arquivada, ela apaga e escorrega para
                      baixo — o espaço do player e do "Trocar música" fecha, e
                      ela fica lado a lado com o botão de reativar. */}
                  <View style={[styles.musicHeader, arquivada && styles.musicHeaderArquivada]}>
                    {/* Só a identidade da faixa esmaece — o botão de reativar
                        fica fora daqui, senão o único controle acionável do
                        estado arquivado apareceria apagado. */}
                    <Animated.View style={[styles.musicIdent, { opacity: opacidadeInfo }]}>
                      <Text style={styles.musicEmoji}>{session.musica.emoji}</Text>
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

                    {/* Arquivada, o botão de reativar sobe para cá — a linha de
                        ações inteira sai da tela e o card encolhe. */}
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

                  {/* Tudo que só existe com a trilha ativa */}
                  {arquivada ? null : (
                    <>
                      <Text style={styles.musicReason}>{session.musica.justificativa}</Text>
                      <MusicPlayer
                        // A chave inclui a fonte: quando o .mp3 local aparece
                        // (logo depois do Salvar), o player precisa nascer de
                        // novo apontando para o disco — `useAudioPlayer` fixa a
                        // origem na criação.
                        key={`${session.musica.id}:${session.audioUri ?? 'remoto'}`}
                        musica={session.musica}
                        audioUri={session.audioUri}
                        // Com o modal de música aberto, o dono da saída de áudio
                        // é ele — este player fica montado por baixo, mas calado
                        ativo={!showMusic}
                        trechoInicio={session.trechoInicio}
                        trechoFim={session.trechoFim}
                        // O fim agora vem do usuário. Antes era fixado em 30 aqui,
                        // e por isso todo vídeo saía com a prévia inteira.
                        onTrecho={aplicarTrecho}
                      />
                      <View style={styles.musicActions}>
                        <Pressable
                          style={styles.btnTrocar}
                          hitSlop={hitSlops.botao}
                          onPress={() => setShowMusic(true)}
                        >
                          <Ionicons name="musical-notes" size={16} color={colors.parchment} />
                          <Text style={styles.btnTrocarText}>Trocar música</Text>
                        </Pressable>
                        <Pressable
                          style={styles.btnArquivar}
                          hitSlop={hitSlops.botao}
                          accessibilityRole="button"
                          accessibilityLabel="Arquivar trilha e exportar só a imagem"
                          onPress={() => alternarArquivo(true)}
                        >
                          <Ionicons name="trash" size={19} color={colors.parchment} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.semAudio}>
                  <Text style={styles.semAudioText}>
                    {session.sugestoes.length > 0
                      ? 'Sem áudio — o momento será salvo só com a imagem.'
                      : 'Sem sugestões no momento — você pode salvar só a imagem.'}
                  </Text>
                  <Pressable style={styles.musicBtn} hitSlop={hitSlops.chip} onPress={() => setShowMusic(true)}>
                    <Text style={styles.musicBtnText}>
                      {session.sugestoes.length > 0 ? 'ESCOLHER MÚSICA' : 'BUSCAR MÚSICA'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
            {/* O motivo fica visível junto da ação, não escondido num toque
                que não responde (FR-Q05) */}
            {curando ? (
              <View style={styles.motivoLinha}>
                <Ionicons name="hourglass-outline" size={12} color={colors.amber} />
                <Text style={styles.motivoBloqueio}>
                  {TEXTO_ETAPA[etapa]} POSTAR LIBERA QUANDO A TRILHA CHEGAR. SALVAR JÁ FUNCIONA.
                </Text>
              </View>
            ) : postando ? (
              /* A geração do .mp4 leva 20–30s. Um botão mudo nesse intervalo é
                 o que fazia o usuário tocar de novo (T045). Com progresso real
                 (T033–T037) a barra avança proporcionalmente ao trabalho; sem
                 ele — device que não sabe informar — cai no indicador
                 indefinido em vez de fingir avanço (C-04). */
              <View style={styles.progressoBloco}>
                <View style={styles.motivoLinha}>
                  {progresso === null ? (
                    <ActivityIndicator size="small" color={colors.amber} />
                  ) : (
                    <Ionicons name="film-outline" size={12} color={colors.amber} />
                  )}
                  <Text style={styles.motivoBloqueio}>
                    {progresso === null
                      ? 'MONTANDO O MOMENTO — GERANDO O VÍDEO. ISSO LEVA ALGUNS SEGUNDOS.'
                      : `GERANDO O VÍDEO — ${progresso}%`}
                  </Text>
                </View>
                {progresso === null ? null : (
                  <View style={styles.barraTrilho}>
                    <View style={[styles.barraPreenchida, { width: `${progresso}%` }]} />
                  </View>
                )}
              </View>
            ) : null}
            <View style={styles.actionsRow}>
              {/* RV-02: salvar é acionável em TODOS os estados da curadoria — a
                  foto nunca pode ser perdida nem bloqueada pela espera da
                  trilha. Durante a exportação ele descansa porque a foto já foi
                  salva por `exportar()`; tocar de novo só duplicaria o registro. */}
              <Pressable
                style={[styles.action, styles.actionSalvar, postando && styles.actionDesabilitada]}
                disabled={salvando || postando}
                onPress={async () => {
                  const m = await salvar(true);
                  // Salvar leva à galeria: o momento acabou de virar registro,
                  // e é lá que ele existe. Antes o modal apenas fechava e a
                  // pessoa caía de volta no visor, sem confirmação visível de
                  // que a mídia tinha sido guardada. `replace` para que o
                  // "voltar" da galeria vá para a câmera, e não reabra a
                  // captura que acabou de ser salva.
                  if (m) router.replace('/gallery');
                }}
              >
                <Text style={styles.actionText}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.action,
                  styles.actionPostar,
                  (curando || postando) && styles.actionDesabilitada,
                ]}
                disabled={salvando || curando || postando}
                accessibilityState={{ disabled: curando || postando, busy: postando }}
                accessibilityHint={
                  curando ? 'Disponível quando a curadoria da trilha terminar' : undefined
                }
                onPress={postar}
              >
                <Text style={[styles.actionText, { color: colors.ink }]}>
                  {curando ? 'Aguarde a trilha' : postando ? 'Postando...' : 'Postar agora'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

      {showMusic ? <MusicSheet onClose={() => setShowMusic(false)} /> : null}
      {sharePkg ? (
        <PostSheet
          pacote={sharePkg}
          /**
           * Fechar a folha fecha **só a folha** (T101).
           *
           * Aqui havia um `clear()` junto. Fechar depois de postar é o gesto de
           * quem mudou de ideia e quer lapidar de novo — e zerar a sessão nesse
           * momento desmontava o `CaptureSheet` inteiro: quem publicou a partir
           * da captura caía no visor com a foto, o look e a trilha perdidos, e
           * quem veio da galeria voltava para a lista em vez da mídia aberta.
           * A conclusão do fluxo tem donos próprios — o X (`descartar`) e o
           * `salvar(true)` —, e é lá que a sessão termina.
           */
          onClose={() => setSharePkg(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    // Era o vidro do modal sobre a câmera. Agora é a própria tela, e atrás dela
    // não há mais visor nenhum — cor sólida, em vez de translucidez sobre preto.
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '94%',
    backgroundColor: colors.ink,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    // Folga para o rodapé fixo (Salvar/Postar), que desenha por cima do fim
    // da rolagem. Com 16 a última fileira de miniaturas aparecia cortada ao
    // meio e os nomes dos tratamentos ficavam escondidos atrás dos botões.
    paddingBottom: 28,
  },
  previewShot: {
    marginHorizontal: 20,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    borderRadius: radii.card,
  },
  filtroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 11,
    letterSpacing: 1,
  },
  musicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontStyle: 'italic',
  },
  // Arquivada, a identidade da faixa passa a dividir a linha com o botão de
  // reativar — é ela que ocupa o espaço que era do "Trocar música".
  musicHeaderArquivada: {
    alignItems: 'center',
  },
  musicIdent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  musicActions: {
    flexDirection: 'row',
    gap: 10,
  },
  // "Trocar música" toma toda a largura que sobra (Figma, nó 303:417); o
  // arquivar fica quadrado e fixo no canto.
  btnTrocar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Reativar é ação positiva, então amber — e não o ruby do arquivar.
  btnReativar: {
    width: 44,
    height: 44,
    borderRadius: radii.card,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'flex-start',
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
    flexDirection: 'row',
    gap: 12,
  },
  motivoLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  progressoBloco: {
    gap: 6,
  },
  barraTrilho: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.parchment25,
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
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
    alignItems: 'center',
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

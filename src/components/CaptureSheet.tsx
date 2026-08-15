import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { FilterCarousel } from '@/components/FilterCarousel';
import { FilteredImage } from '@/components/FilteredImage';
import { MusicPlayer } from '@/components/MusicPlayer';
import { MusicSheet } from '@/components/MusicSheet';
import { PostSheet } from '@/components/PostSheet';
import { filterById } from '@/constants/filters';
import { vibeById } from '@/constants/vibes';
import { analyzePhotoAndSuggest, EtapaCuradoria, getSuggestions } from '@/services/music';
import { persistPhoto } from '@/services/mediaStorage';
import * as preExport from '@/services/preExport';
import { exportPackage, SharePackage } from '@/services/sharePackage';
import { saveToSystemGallery } from '@/services/systemGallery';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { colors, fonts, hitSlops, radii, sizes } from '@/theme/tokens';
import { FilterId, Media } from '@/types';

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
  const sugestaoAutomatica = useSettingsStore((s) => s.sugestaoAutomatica);
  const deteccaoTempoReal = useSettingsStore((s) => s.deteccaoTempoReal);

  // Um <Modal> desenha na própria janela, sem o SafeAreaView da tela por baixo:
  // o espaçamento inferior tem de vir do inset real, senão a barra de navegação
  // come a metade de baixo de "Salvar" e "Postar agora" (medido: 130px em
  // navegação por botões, 44px em gestos — ver baseline.md T004).
  const insets = useSafeAreaInsets();
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
    (id: FilterId | null) => patch({ filtroId: id, filtroAuto: false }),
    [patch],
  );

  // Estável também: o `status` do áudio muda a cada tick e re-renderiza o
  // player; se este callback fosse recriado junto, os `PanResponder` das
  // bolinhas do recorte seriam refeitos no meio do arraste.
  const aplicarTrecho = useCallback(
    (inicio: number, fim: number) => patch({ trechoInicio: inicio, trechoFim: fim }),
    [patch],
  );

  const photoUri = session?.photoUri;

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
      : getSuggestions(vibeById(s.vibeId), setEtapa).then((sugestoes) => ({
          vibeId: null,
          sugestoes,
        }));
    analise
      .then(({ vibeId: vibeReal, sugestoes }) => {
        clearTimeout(limite);
        const atual = useCaptureStore.getState().session;
        if (!atual || atual.photoUri !== photoUri) return;
        const primeira =
          sugestoes.find((m) => m.previewUrl) ?? sugestoes[0] ?? null;
        // Redução do atrito: o sistema decide, o usuário refina (US3)
        const escolheSozinho =
          sugestaoAutomatica && atual.musica === null && atual.mediaId === null;
        const musicaFinal = escolheSozinho ? primeira : atual.musica;
        patch({
          sugestoes,
          // `pronta` só quando existe trilha de fato; caso contrário a
          // postagem passa a exigir confirmação em vez de sair calada (RV-01)
          curadoria: musicaFinal ? 'pronta' : 'indisponivel',
          // A vibe real da foto substitui a prévia do visor (T-0A)
          ...(vibeReal ? { vibeId: vibeReal } : {}),
          // Filtro acompanha a vibe real enquanto o usuário não escolher um
          ...(vibeReal && atual.filtroAuto ? { filtroId: vibeById(vibeReal).filtro } : {}),
          ...(escolheSozinho ? { musica: primeira } : {}),
        });
      })
      .catch(() => {
        clearTimeout(limite);
        patch({ curadoria: 'indisponivel' });
      });
  }, [photoUri, sugestaoAutomatica, deteccaoTempoReal, patch]);

  const renderizarComFiltro = useCallback(async (): Promise<string> => {
    const s = useCaptureStore.getState().session;
    if (!s) return '';
    // Sem filtro, a imagem sai exatamente como capturada (T-0B)
    if (!s.filtroId) return s.photoUri;
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
        filtroId: session.filtroId,
        musicaId: session.musica?.id ?? null,
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
          musica: s?.musica ?? null,
          trechoInicio: s?.trechoInicio ?? 0,
          trechoFim: s?.trechoFim ?? 30,
        };
      });
    }, ESPERA_QUIETUDE_MS);
    return () => clearTimeout(t);
  }, [chave, pronta, temMusica, postando, sharePkg, renderizarComFiltro]);

  // Sessão encerrada: o pacote pré-gerado não vale para a próxima foto
  useEffect(() => () => preExport.limpar(), []);

  if (!session || !chave) return null;

  // Enquanto a curadoria corre, ninguém consegue postar um pacote pela metade
  const curando = session.curadoria === 'carregando';
  const filtro = session.filtroId ? filterById(session.filtroId) : null;
  const vibe = vibeById(session.vibeId);
  const editando = session.mediaId !== null;

  const salvar = async (fechar: boolean): Promise<Media | null> => {
    if (salvando) return null;
    setSalvando(true);
    try {
      let media: Media;
      if (session.mediaId) {
        media = {
          id: session.mediaId,
          photoUri: session.photoUri,
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          criadaEm: 0,
          atualizadaEm: Date.now(),
        };
        update(session.mediaId, {
          filtroId: session.filtroId,
          vibeId: session.vibeId,
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
        });
      } else {
        const id = `${Date.now()}`;
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
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          criadaEm: Date.now(),
          atualizadaEm: Date.now(),
        };
        add(media);
        patch({ mediaId: id, photoUri: uriPersistente });
        // Exporta a versão com filtro para a galeria do sistema (best-effort:
        // sem permissão ou no Expo Go retorna false e a mídia segue no app)
        await saveToSystemGallery(await renderizarComFiltro());
      }
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
          musica: session.musica,
          trechoInicio: session.trechoInicio,
          trechoFim: session.trechoFim,
          onProgresso: setProgresso,
        }));
      setSharePkg(pacote);
    } catch {
      // Falhar calado é o mesmo defeito de fundo da US2: ação de saída sem o
      // usuário saber em que pé está. A foto já foi salva por `salvar(false)`.
      Alert.alert(
        'Não deu para montar o pacote',
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
    if (session.curadoria === 'indisponivel') {
      Alert.alert(
        'Postar sem trilha?',
        'Este pacote vai só com a imagem — sem a metade sonora. Você pode esperar a curadoria, escolher uma faixa ou seguir assim mesmo.',
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
    Alert.alert('Descartar captura?', 'A foto e o pacote sensorial serão perdidos.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: clear },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={descartar}>
      <View style={styles.backdrop}>
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
              <FilteredImage
                uri={session.photoUri}
                filtroId={session.filtroId}
                style={styles.preview}
              />
            </View>

            <View style={styles.filtroRow}>
              <Text style={styles.sectionLabel}>FILTRO</Text>
              <Text style={styles.filtroAtual}>
                {filtro ? `${filtro.emoji} ${filtro.nome.toUpperCase()}` : '📷 ORIGINAL'} · VIBE{' '}
                {vibe.nome.toUpperCase()}
              </Text>
            </View>
            <View style={styles.carouselWrap}>
              <FilterCarousel ativo={session.filtroId} onSelect={escolherFiltro} />
            </View>

            {/* Música: a outra metade do pacote sensorial */}
            <Text style={[styles.sectionLabel, { paddingHorizontal: 20, marginTop: 18 }]}>
              TRILHA SONORA
            </Text>
            <View style={styles.musicBox}>
              {session.curadoria === 'carregando' ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.amber} />
                  <Text style={styles.loadingText}>{TEXTO_ETAPA[etapa]}</Text>
                </View>
              ) : session.musica ? (
                <>
                  <View style={styles.musicHeader}>
                    <Text style={styles.musicEmoji}>{session.musica.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.musicTitle} numberOfLines={1}>
                        {session.musica.titulo}
                      </Text>
                      <Text style={styles.musicArtist} numberOfLines={1}>
                        {session.musica.artista}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.musicReason}>{session.musica.justificativa}</Text>
                  <MusicPlayer
                    key={session.musica.id}
                    musica={session.musica}
                    // Com o modal de música aberto, o dono da saída de áudio é
                    // ele — este player fica montado por baixo, mas calado (T044)
                    ativo={!showMusic}
                    trechoInicio={session.trechoInicio}
                    trechoFim={session.trechoFim}
                    // O fim agora vem do usuário. Antes era fixado em 30 aqui,
                    // e por isso todo vídeo saía com a prévia inteira.
                    onTrecho={aplicarTrecho}
                  />
                  <View style={styles.musicActions}>
                    <Pressable style={styles.musicBtn} hitSlop={hitSlops.chip} onPress={() => setShowMusic(true)}>
                      <Text style={styles.musicBtnText}>TROCAR MÚSICA</Text>
                    </Pressable>
                    <Pressable
                      style={styles.musicBtn}
                      hitSlop={hitSlops.chip}
                      onPress={() => patch({ musica: null, curadoria: 'indisponivel' })}
                    >
                      <Text style={[styles.musicBtnText, { color: colors.parchment50 }]}>
                        REMOVER ÁUDIO
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.semAudio}>
                  <Text style={styles.semAudioText}>
                    {session.sugestoes.length > 0
                      ? 'Sem áudio — o pacote será salvo só com a imagem.'
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
                      ? 'MONTANDO O PACOTE — GERANDO O VÍDEO. ISSO LEVA ALGUNS SEGUNDOS.'
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
                onPress={() => salvar(true)}
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
      </View>

      {showMusic ? <MusicSheet onClose={() => setShowMusic(false)} /> : null}
      {sharePkg ? (
        <PostSheet
          pacote={sharePkg}
          onClose={() => {
            setSharePkg(null);
            clear();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,5,6,0.5)',
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
    paddingBottom: 16,
  },
  previewShot: {
    marginHorizontal: 20,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    aspectRatio: sizes.photoAspect,
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
  musicActions: {
    flexDirection: 'row',
    gap: 10,
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

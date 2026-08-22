import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilteredImage } from '@/components/FilteredImage';
import { FundoBase } from '@/components/FundoBase';
import { vibeById } from '@/constants/vibes';
import { looksDeMidiaAntiga } from '@/services/looks';
import { cacheAudioPreview } from '@/services/mediaStorage';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useGalleryStore } from '@/stores/useGalleryStore';
import { colors, fonts, hitSlops, radii, sizes } from '@/theme/tokens';
import { Media } from '@/types';

/**
 * Galeria inteligente (US7): pacotes sensoriais persistentes — revisitar,
 * lapidar (reabrir edição) e excluir com confirmação (FR-012).
 */
export default function GalleryScreen() {
  const router = useRouter();
  const medias = useGalleryStore((s) => s.medias);
  const remove = useGalleryStore((s) => s.remove);
  const start = useCaptureStore((s) => s.start);

  const lapidar = (m: Media) => {
    // Mídias gravadas antes da feature 003 não têm `looks` — e ausência aqui
    // significa "não sei", nunca "não há" (a mesma convenção de `aspecto` e
    // `sugestoes`). Em vez de abrir sem sugestão nenhuma ou inventar sugestões
    // que nunca existiram, reconstrói-se o conjunto base da vibe com o
    // tratamento que a mídia de fato tinha na frente (FR-023, SC-009).
    const antiga = m.looks?.length ? null : looksDeMidiaAntiga(m.filtroId, m.vibeId);
    start({
      mediaId: m.id,
      photoUri: m.photoUri,
      filtroId: m.filtroId,
      filtroAuto: false, // edição preserva o filtro salvo; só o usuário troca
      vibeId: m.vibeId,
      musica: m.musica,
      // A trilha já está no disco (T102): reabrir toca o arquivo, não o link
      // do Deezer, que expira. Mídia gravada antes disto vem sem o campo e o
      // player cai de volta na URL remota.
      audioUri: m.audioUri ?? null,
      // Os três looks voltam com o pacote: reabrir não consulta rede nenhuma
      // (US4), pelo mesmo motivo que fez as faixas passarem a viajar junto.
      looks: antiga ? antiga.looks : (m.looks ?? []),
      lookEscolhido: antiga ? antiga.escolhido : (m.lookEscolhido ?? null),
      // O leque de opções volta com o pacote (T083): reabrir não dispara
      // curadoria nenhuma, e "Trocar música" já abre com as quatro faixas.
      sugestoes: m.sugestoes ?? [],
      trechoInicio: m.trechoInicio,
      trechoFim: m.trechoFim,
      // Mídias salvas antes do T066 não têm `aspecto`; o padrão é exatamente a
      // proporção com que elas foram criadas, então reabrir não as deforma.
      aspecto: m.aspecto ?? sizes.photoAspect,
    });
    /**
     * Pré-carrega as outras sugestões em segundo plano (T106).
     *
     * A trilha escolhida já toca do disco (T102), mas as outras três só tinham
     * a URL do Deezer — que expira. Quem reabre um momento e vai em "Trocar
     * música" costuma fazê-lo logo em seguida, então baixar agora é a diferença
     * entre a prévia tocar na hora e não tocar nunca.
     *
     * Deliberadamente sem `await`: é adiantamento, não etapa do fluxo. Reabrir
     * a mídia não espera por rede nenhuma, e cada falha morre em silêncio no
     * `catch` — a faixa simplesmente segue dependendo da URL, como antes.
     */
    for (const s of m.sugestoes ?? []) {
      if (s.id !== m.musica?.id) {
        cacheAudioPreview(s.previewUrl, s.id).catch(() => {});
      }
    }

    // Empurra para a tela de captura. Enquanto o `CaptureSheet` era `<Modal>`,
    // bastava a galeria renderizá-lo quando houvesse sessão: o Modal desenhava
    // na própria janela, por cima. Virando corpo de tela (T063), o mesmo JSX
    // passou a ser conteúdo no fluxo normal — ia parar embaixo da lista, fora
    // da vista, e reabrir uma mídia deixou de funcionar sem erro nenhum.
    router.push('/capture');
  };

  /**
   * Voltar — do gesto/botão do sistema e do chevron do cabeçalho.
   *
   * Chegando aqui por `replace` (o caminho de "salvei agora"), não existe
   * entrada anterior na pilha: `back()` falha com "GO_BACK was not handled" e
   * o toque não faz nada. A câmera é o destino certo nos dois casos.
   */
  const voltar = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/camera');
    return true;
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', voltar);
      return () => sub.remove();
    }, [voltar]),
  );

  const excluir = (m: Media) => {
    Alert.alert(
      'Excluir mídia?',
      'A exclusão é permanente: foto, filtro e música deste momento serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => remove(m.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <FundoBase />
      <View style={styles.header}>
        {/* `back()` sozinho não serve: quando a galeria é aberta logo depois
            de salvar, ela chega por `replace` da captura e não há entrada
            anterior para onde voltar — o expo-router respondia com "GO_BACK was
            not handled" e o toque não fazia nada. A câmera é o destino certo
            nos dois caminhos (veio do visor ou veio de salvar). */}
        <Pressable
          onPress={voltar}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={30} color={colors.parchment} />
        </Pressable>
        <Text style={styles.title}>Galeria.</Text>
        <Text style={styles.count}>
          {medias.length} {medias.length === 1 ? 'MOMENTO' : 'MOMENTOS'}
        </Text>
      </View>

      {medias.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏞️</Text>
          <Text style={styles.emptyText}>
            Nada por aqui ainda.{'\n'}Capture uma cena e o momento aparece nesta galeria.
          </Text>
        </View>
      ) : (
        <FlatList
          data={medias}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const vibe = vibeById(item.vibeId);
            return (
              <Pressable
                style={styles.card}
                onPress={() => lapidar(item)}
                onLongPress={() => excluir(item)}
              >
                <FilteredImage uri={item.photoUri} filtroId={item.filtroId} style={styles.photo} />
                <View style={styles.meta}>
                  <Text style={styles.metaVibe}>
                    {vibe.emoji} {vibe.nome.toUpperCase()}
                  </Text>
                  <View style={styles.metaMusicRow}>
                    {item.musica ? (
                      <Ionicons name="musical-notes" size={11} color={colors.parchment50} />
                    ) : null}
                    <Text style={styles.metaMusic} numberOfLines={1}>
                      {item.musica ? item.musica.titulo : 'SEM ÁUDIO'}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.trash} hitSlop={hitSlops.icone} onPress={() => excluir(item)}>
                  <Ionicons name="trash-outline" size={15} color={colors.parchment} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

    </SafeAreaView>
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
    flex: 1,
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 28,
  },
  count: {
    color: colors.amber,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
  },
  /**
   * Vitrine uniforme (T082): todo card é quadrado, independentemente do
   * enquadramento com que a foto foi tirada. A grade antes usava a proporção de
   * cada mídia, e uma 16:9 ao lado de uma 1:1 deixava a coluna serrilhada.
   *
   * A proporção real não se perde: ela continua em `Media.aspecto` e é ela que
   * manda na tela de captura. Aqui é só miniatura.
   */
  card: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.parchment25,
    overflow: 'hidden',
    backgroundColor: 'rgba(141,21,20,0.12)',
  },
  /**
   * A `FilteredImage` desenha a foto em `absoluteFill` — ela precisa de um
   * container com altura própria. Este estilo declarava só `width: '100%'`, sem
   * altura: cada card ficava com 0px de foto, e foi por isso que as prévias
   * sumiram da galeria (T081).
   */
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  /**
   * Com o card quadrado, os metadados passam a flutuar sobre o rodapé da foto —
   * antes eles ocupavam altura própria e disputavam espaço com a imagem.
   */
  meta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    gap: 4,
    backgroundColor: 'rgba(9,5,6,0.62)',
  },
  metaVibe: {
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  metaMusicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaMusic: {
    flex: 1,
    color: colors.parchment50,
    fontFamily: fonts.labelLight,
    fontSize: 10,
  },
  trash: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(9,5,6,0.6)',
    borderRadius: 14,
    padding: 5,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyText: {
    color: colors.parchment50,
    fontFamily: fonts.label,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});

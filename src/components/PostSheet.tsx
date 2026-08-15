import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SharePackage } from '@/services/sharePackage';
import {
  compartilharEm,
  DestinoNativo,
  listarDestinos,
  mimeDoPacote,
} from '@/services/shareTargets';
import { saveToSystemGallery } from '@/services/systemGallery';
import { colors, fonts, hitSlops, radii } from '@/theme/tokens';

/**
 * Confirmação de postagem (US8/FR-014): compartilha o pacote sensorial.
 *
 * Honestidade de UI (T-01c): no Expo Go não há muxer nativo, então o pacote sai
 * composto — a imagem vai pelo destino escolhido e a trilha segue como
 * arquivo de áudio (prévia 30s) + legenda. Quando `videoUri` existir
 * (T-07, development build), o mesmo fluxo compartilha o `.mp4` único.
 *
 * A grade de destinos **é do aparelho, não nossa** (T055). Antes eram seis
 * redes fixas com emoji, e os seis botões abriam a mesma folha genérica do
 * sistema: seis caminhos desenhados, um caminho real. Agora vem do
 * `PackageManager` — os apps que a pessoa tem, com o nome e o ícone que eles
 * próprios declaram, cada um abrindo direto no app certo. Quem não tem
 * Instagram não vê Instagram.
 */

/** Cabem 5 destinos + o tile "Mais": duas linhas de três, como no Figma (294:319). */
const MAX_DESTINOS = 5;

export function PostSheet({ pacote, onClose }: { pacote: SharePackage; onClose: () => void }) {
  // Mesmo motivo do CaptureSheet: modal desenha na própria janela, então o
  // espaçamento inferior vem do inset real do aparelho (ver baseline.md T004).
  const insets = useSafeAreaInsets();
  const temVideo = pacote.videoUri !== null;
  const temTrilha = pacote.musica !== null;

  const arquivo = pacote.videoUri ?? pacote.imageUri;
  const mimeType = mimeDoPacote(temVideo);

  /**
   * `null` enquanto a consulta ao `PackageManager` não voltou — é diferente de
   * `[]`, que significa "consultamos e não há nenhum app compatível". Sem essa
   * distinção a grade piscaria o estado vazio a cada abertura do modal.
   */
  const [destinos, setDestinos] = useState<DestinoNativo[] | null>(null);
  useEffect(() => {
    let vivo = true;
    listarDestinos(mimeType).then((lista) => {
      if (vivo) setDestinos(lista);
    });
    return () => {
      vivo = false;
    };
  }, [mimeType]);

  /**
   * Nenhuma variante anuncia "pronto" sem declarar o que o pacote leva
   * (FR-Q07). O caso sem trilha diz isso no próprio título, em vez de esconder
   * a perda num parágrafo de rodapé.
   */
  const resultado = temVideo
    ? {
        icone: 'checkmark' as const,
        corIlustracao: colors.amber,
        titulo: 'Vídeo gerado!',
        conteudo: 'IMAGEM + TRILHA NUM SÓ ARQUIVO',
        detalhe: 'Compartilhar com:',
      }
    : temTrilha
      ? {
          icone: 'layers-outline' as const,
          corIlustracao: colors.ruby,
          titulo: 'Pacote pronto, em duas partes.',
          conteudo: 'IMAGEM + ÁUDIO DE 30S + LEGENDA, SEPARADOS',
          detalhe:
            'A imagem vai pelo destino escolhido; a trilha segue nas ações abaixo. O vídeo único imagem+trilha chega na versão final do app.',
        }
      : {
          icone: 'image-outline' as const,
          corIlustracao: colors.ruby,
          titulo: 'Pacote só com a imagem.',
          conteudo: 'SEM TRILHA — A METADE SONORA NÃO ENTROU',
          detalhe:
            'Você pode fechar, escolher uma música e postar de novo para levar o pacote completo.',
        };
  const [baixando, setBaixando] = useState(false);
  const [baixado, setBaixado] = useState(false);

  const baixarVideo = async () => {
    if (!pacote.videoUri || baixando) return;
    setBaixando(true);
    try {
      setBaixado(await saveToSystemGallery(pacote.videoUri));
    } finally {
      setBaixando(false);
    }
  };

  const abrirFolhaNativa = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        // Com vídeo gerado (T-07) o pacote inteiro vai num arquivo só;
        // sem ele, vai a imagem — e a trilha segue pelas ações abaixo.
        await Sharing.shareAsync(arquivo, {
          mimeType,
          dialogTitle: 'Compartilhar pacote sensorial',
        });
      }
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  /**
   * Toque num destino: vai direto para o app. Se o caminho direto falhar — app
   * desinstalado desde a listagem, activity que deixou de ser exportada — cai
   * na folha do sistema em vez de não fazer nada.
   */
  const abrirDestino = async (destino: DestinoNativo) => {
    const foi = await compartilharEm({
      destino,
      caminho: arquivo,
      mimeType,
      texto: pacote.caption,
    });
    if (!foi) await abrirFolhaNativa();
  };

  const compartilharAudio = async () => {
    if (!pacote.audioUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pacote.audioUri, {
          mimeType: 'audio/mpeg',
          dialogTitle: 'Enviar trilha (prévia de 30s)',
        });
      }
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  const compartilharLegenda = async () => {
    if (!pacote.caption) return;
    try {
      await Share.share({ message: pacote.caption });
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
  };

  const visiveis = destinos?.slice(0, MAX_DESTINOS) ?? [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 32) }]}>
          {/* Ilustração do Figma (294:170): círculo de 50 com o glifo do
              resultado. Amber quando o pacote saiu inteiro; ruby quando saiu
              pela metade — a cor não pode comemorar o que foi perdido. */}
          <View style={[styles.ilustracao, { backgroundColor: resultado.corIlustracao }]}>
            <Ionicons name={resultado.icone} size={26} color={colors.parchment} />
          </View>
          <Text style={styles.title}>{resultado.titulo}</Text>
          {/* FR-Q07: o que o pacote contém fica ao lado do "pronto", não
              escondido num parágrafo — inclusive quando falta a trilha */}
          <Text style={[styles.conteudo, !temTrilha && styles.conteudoSemTrilha]}>
            {resultado.conteudo}
          </Text>
          <Text style={styles.subtitle}>{resultado.detalhe}</Text>

          {destinos === null ? (
            // Consulta em voo: espaço reservado, para a grade não empurrar o
            // resto da folha quando chegar.
            <View style={styles.gridPlaceholder} />
          ) : visiveis.length === 0 ? (
            /* Ninguém instalado que receba este tipo (ou Expo Go, onde o módulo
               nativo não carrega): um caminho só, e ele é real. */
            <Pressable style={styles.compartilharUnico} onPress={abrirFolhaNativa}>
              <Ionicons name="share-social" size={18} color={colors.parchment} />
              <Text style={styles.compartilharUnicoText}>Compartilhar</Text>
            </Pressable>
          ) : (
            <View style={styles.grid}>
              {visiveis.map((d) => (
                <Pressable
                  key={`${d.pacote}/${d.atividade}`}
                  style={styles.destino}
                  accessibilityRole="button"
                  accessibilityLabel={`Compartilhar no ${d.nome}`}
                  onPress={() => abrirDestino(d)}
                >
                  <Image source={{ uri: d.icone }} style={styles.destinoIcone} />
                  <Text style={styles.destinoNome} numberOfLines={1}>
                    {d.nome}
                  </Text>
                </Pressable>
              ))}
              {/* "Mais" abre a folha do sistema: o que não coube na grade
                  continua a um toque, e não some. */}
              <Pressable
                style={styles.destino}
                accessibilityRole="button"
                accessibilityLabel="Mais destinos"
                onPress={abrirFolhaNativa}
              >
                <View style={[styles.destinoIcone, styles.destinoMais]}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.parchment} />
                </View>
                <Text style={styles.destinoNome}>Mais</Text>
              </Pressable>
            </View>
          )}

          {temVideo ? (
            <Pressable
              style={[styles.baixarBtn, baixado && styles.baixarBtnFeito]}
              hitSlop={hitSlops.botao}
              disabled={baixando}
              onPress={baixarVideo}
            >
              <Ionicons
                name={baixado ? 'checkmark' : 'download-outline'}
                size={14}
                color={baixado ? 'rgba(9,5,6,0.5)' : colors.ruby}
              />
              <Text style={styles.baixarBtnText}>
                {baixando ? 'BAIXANDO...' : baixado ? 'SALVO NA GALERIA' : 'BAIXAR VÍDEO'}
              </Text>
            </Pressable>
          ) : null}

          {!temVideo && temTrilha ? (
            <View style={styles.trilhaBox}>
              <Text style={styles.trilhaLabel}>
                TRILHA · {pacote.musica!.titulo.toUpperCase()} — {pacote.musica!.artista.toUpperCase()}
              </Text>
              <View style={styles.trilhaActions}>
                {pacote.audioUri ? (
                  <Pressable style={styles.trilhaBtn} hitSlop={hitSlops.chip} onPress={compartilharAudio}>
                    <Ionicons name="musical-notes" size={12} color={colors.ruby} />
                    <Text style={styles.trilhaBtnText}>ENVIAR ÁUDIO (30S)</Text>
                  </Pressable>
                ) : null}
                {pacote.caption ? (
                  <Pressable style={styles.trilhaBtn} hitSlop={hitSlops.chip} onPress={compartilharLegenda}>
                    <Ionicons name="create-outline" size={13} color={colors.ruby} />
                    <Text style={styles.trilhaBtnText}>ENVIAR LEGENDA</Text>
                  </Pressable>
                ) : null}
              </View>
              {!pacote.audioUri ? (
                <Text style={styles.trilhaAviso}>
                  Prévia de áudio indisponível para esta faixa — a legenda leva a trilha.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.fechar} onPress={onClose}>
            <Text style={styles.fecharText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,5,6,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.parchment,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    padding: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  ilustracao: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 26,
    marginBottom: 6,
    textAlign: 'center',
  },
  conteudo: {
    color: colors.ruby,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  conteudoSemTrilha: {
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtitle: {
    color: 'rgba(9,5,6,0.6)',
    fontFamily: fonts.label,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  // Três colunas exatas (Figma 294:319: 93,33 de 280). `width` em vez de gap
  // para as duas linhas alinharem coluna a coluna mesmo com 4 ou 5 destinos.
  destino: {
    width: '33.33%',
    alignItems: 'center',
    gap: 7,
  },
  destinoIcone: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinoMais: {
    backgroundColor: colors.ink,
  },
  destinoNome: {
    maxWidth: '96%',
    color: colors.ink,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // Reserva a altura de duas linhas da grade enquanto o PackageManager
  // responde, para o conteúdo abaixo não pular quando ela aparecer.
  gridPlaceholder: {
    width: '100%',
    height: 52 * 2 + 7 * 2 + 14 + 13 * 2,
    marginBottom: 20,
  },
  compartilharUnico: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: radii.card,
    paddingVertical: 15,
    marginBottom: 20,
  },
  compartilharUnicoText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  baixarBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.card,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  baixarBtnFeito: {
    borderColor: 'rgba(9,5,6,0.15)',
  },
  baixarBtnText: {
    color: colors.ruby,
    fontFamily: fonts.labelForte,
    fontSize: 11,
    letterSpacing: 1,
  },
  trilhaBox: {
    width: '100%',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(9,5,6,0.15)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  trilhaLabel: {
    color: colors.ink,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  trilhaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trilhaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.ruby,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trilhaBtnText: {
    color: colors.ruby,
    fontFamily: fonts.labelForte,
    fontSize: 10,
    letterSpacing: 1,
  },
  trilhaAviso: {
    color: 'rgba(9,5,6,0.5)',
    fontFamily: fonts.labelLight,
    fontSize: 10,
    lineHeight: 15,
  },
  fechar: {
    width: '100%',
    backgroundColor: colors.ruby,
    borderRadius: radii.card,
    paddingVertical: 15,
    alignItems: 'center',
  },
  fecharText: {
    color: colors.parchment,
    fontFamily: fonts.display,
    fontSize: 15,
  },
});

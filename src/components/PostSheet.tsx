import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SharePackage } from '@/services/sharePackage';
import { mimeDoPacote } from '@/services/shareTargets';
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
 * **Um botão só, e ele abre a folha do sistema** (T088). Houve duas tentativas
 * antes desta: seis redes fixas com emoji (Figma), e depois a grade real do
 * `PackageManager` (T055). O Sávio matou as duas pelo mesmo motivo, e ele está
 * certo: *"se eu clicar, eles vão abrir o compartilhar nativo do celular de
 * qualquer forma"*. Seis tiles desenhados para um caminho real é interface
 * cobrando decisão que não muda nada.
 *
 * O Intent direto por activity ainda tinha um custo próprio: era ele que fazia
 * o Instagram recusar o vídeo (só a mensagem funcionava). A folha do sistema
 * concede a permissão de leitura da URI ao app escolhido; o Intent montado por
 * nós não garantia isso.
 */

export function PostSheet({ pacote, onClose }: { pacote: SharePackage; onClose: () => void }) {
  // Mesmo motivo do CaptureSheet: modal desenha na própria janela, então o
  // espaçamento inferior vem do inset real do aparelho (ver baseline.md T004).
  const insets = useSafeAreaInsets();
  const temVideo = pacote.videoUri !== null;
  const temTrilha = pacote.musica !== null;

  const arquivo = pacote.videoUri ?? pacote.imageUri;
  const mimeType = mimeDoPacote(temVideo);

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
        detalhe: 'Escolha para onde vai no compartilhamento do aparelho.',
      }
    : temTrilha
      ? {
          icone: 'layers-outline' as const,
          corIlustracao: colors.ruby,
          titulo: 'Momento pronto, em duas partes.',
          conteudo: 'IMAGEM + ÁUDIO DE 30S + LEGENDA, SEPARADOS',
          detalhe:
            'A imagem vai pelo destino escolhido; a trilha segue nas ações abaixo. O vídeo único imagem+trilha chega na versão final do app.',
        }
      : {
          icone: 'image-outline' as const,
          corIlustracao: colors.amber,
          titulo: 'Imagem pronta!',
          /**
           * A copy anterior — "SEM TRILHA — A METADE SONORA NÃO ENTROU" —
           * descrevia como perda o que na maioria das vezes é escolha: quem
           * arquivou a trilha **quis** postar só a imagem, e era recebido com
           * uma tela que parecia relatar um defeito. O ícone em `ruby` (a cor
           * de alerta/CTA) reforçava a leitura de erro; em `amber` ele lê como
           * conclusão bem-sucedida, igual à do vídeo.
           */
          conteudo: 'SÓ A IMAGEM, COMO VOCÊ ESCOLHEU',
          detalhe:
            'A trilha está desativada neste momento. Quer som? Feche, escolha uma música e poste de novo.',
        };
  const [baixando, setBaixando] = useState(false);
  const [baixado, setBaixado] = useState(false);
  /** Falhou e o usuário precisa saber — antes o `false` sumia sem rastro. */
  const [falhouBaixar, setFalhouBaixar] = useState(false);

  /**
   * Baixa o que o pacote de fato tem: o .mp4 quando existe, a imagem quando
   * não. Antes o botão só aparecia com vídeo, então quem postava só a imagem
   * — por escolha, tendo arquivado a trilha — não tinha como salvá-la no
   * aparelho a partir daqui.
   */
  const baixarArquivo = async () => {
    if (!arquivo || baixando) return;
    setBaixando(true);
    setFalhouBaixar(false);
    try {
      // 'video'/'photo' é o que corrige o T089: a permissão pedida tem de ser a
      // do que se está gravando, senão a chamada é negada e o botão mente.
      const ok = await saveToSystemGallery(arquivo, temVideo ? 'video' : 'photo');
      setBaixado(ok);
      setFalhouBaixar(!ok);
    } finally {
      setBaixando(false);
    }
  };

  const postar = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        // Com vídeo gerado (T-07) o pacote inteiro vai num arquivo só;
        // sem ele, vai a imagem — e a trilha segue pelas ações abaixo.
        await Sharing.shareAsync(arquivo, {
          mimeType,
          dialogTitle: 'Compartilhar momento',
        });
      }
    } catch {
      // usuário cancelou o share — sem efeito colateral
    }
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
          {/* A moldura de alerta vale para o pacote que saiu **partido** — a
              trilha existe e não coube no arquivo. Postar só a imagem por
              escolha não é alerta nenhum, e emoldurar em vermelho era o que
              fazia a tela parecer relato de erro. */}
          <Text style={[styles.conteudo, temTrilha && !temVideo && styles.conteudoSemTrilha]}>
            {resultado.conteudo}
          </Text>
          <Text style={styles.subtitle}>{resultado.detalhe}</Text>

          {/* Baixar fica **acima** da dupla e ocupa a linha inteira: é a ação
              secundária, e o app já trata secundário assim (o "Trocar música"
              da captura). Antes ele vinha depois do Postar, com moldura
              vermelha e texto em caixa alta — o único botão da tela nesse
              registro, e por isso o que parecia fora do lugar (T095). */}
          {arquivo ? (
            <Pressable
              style={[styles.baixar, baixado && styles.baixarFeito]}
              hitSlop={hitSlops.botao}
              disabled={baixando}
              accessibilityRole="button"
              onPress={baixarArquivo}
            >
              <Ionicons
                name={
                  baixado ? 'checkmark' : falhouBaixar ? 'alert-circle-outline' : 'download-outline'
                }
                size={17}
                color={baixado ? 'rgba(9,5,6,0.45)' : colors.ink}
              />
              <Text style={[styles.baixarText, baixado && styles.baixarTextFeito]}>
                {baixando
                  ? 'Baixando...'
                  : baixado
                    ? 'Salvo na galeria'
                    : falhouBaixar
                      ? 'Não deu — tocar de novo'
                      : temVideo
                        ? 'Baixar vídeo'
                        : 'Baixar imagem'}
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

          {/* Fechar à esquerda, Postar à direita — a ordem que o Sávio pediu, e
              a mesma da captura: sair de um lado, seguir do outro. */}
          <View style={styles.linhaAcoes}>
            <Pressable style={[styles.acao, styles.acaoFechar]} onPress={onClose}>
              <Text style={[styles.acaoText, { color: colors.parchment }]}>Fechar</Text>
            </Pressable>
            <Pressable
              style={[styles.acao, styles.acaoPostar]}
              accessibilityRole="button"
              onPress={postar}
            >
              <Ionicons name="share-social" size={17} color={colors.ink} />
              <Text style={[styles.acaoText, { color: colors.ink }]}>Postar</Text>
            </Pressable>
          </View>
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
  /** Moldura de atenção: o pacote saiu em duas partes (imagem + áudio). */
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
  /**
   * Ação secundária, na linguagem do resto do app: pílula cheia em `parchment`
   * escurecido sobre a folha clara, texto em caixa normal. O registro anterior
   * — moldura ruby + caixa alta com `letterSpacing` — é o das *labels técnicas*
   * do visor, e num modal claro de conclusão ele soava como aviso.
   */
  baixar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(9,5,6,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(9,5,6,0.14)',
    borderRadius: radii.card,
    paddingVertical: 14,
    marginBottom: 12,
  },
  baixarFeito: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(9,5,6,0.10)',
  },
  baixarText: {
    color: colors.ink,
    fontFamily: fonts.labelForte,
    fontSize: 14,
  },
  baixarTextFeito: {
    color: 'rgba(9,5,6,0.45)',
  },
  linhaAcoes: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  acao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.card,
    paddingVertical: 15,
  },
  acaoFechar: {
    backgroundColor: colors.ruby,
  },
  // Amber é a cor da ação que conclui, igual ao "Postar agora" da captura.
  acaoPostar: {
    backgroundColor: colors.amber,
  },
  acaoText: {
    fontFamily: fonts.display,
    fontSize: 15,
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
});

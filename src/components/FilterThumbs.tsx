import React, { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { FilteredImage } from '@/components/FilteredImage';
import { FILTERS } from '@/constants/filters';
import { colors, fonts, radii } from '@/theme/tokens';
import { FilterId } from '@/types';

interface Props {
  /** URI da foto da sessão — é ela que aparece dentro de cada miniatura */
  photoUri: string;
  /** null = "Original" (sem filtro, T-0B) */
  ativo: FilterId | null;
  onSelect: (id: FilterId | null) => void;
}

interface ThumbItem {
  id: FilterId | null;
  nome: string;
  emoji: string;
}

/** "Original" + os 8 filtros: a foto sem filtro é uma escolha de primeira classe. */
const ITEMS: ThumbItem[] = [{ id: null, nome: 'Original', emoji: '📷' }, ...FILTERS];

/** Figma 468:950 — miniatura 70×93, intervalo de 10 (frames em x = 0, 80, 160...) */
const LARGURA = 70;
const ALTURA = 93;
const GAP = 10;
const PAD_HORIZONTAL = 16;

/**
 * Acima desta ampliação de fonte do sistema o nome sai só da miniatura
 * selecionada. Em 70px de largura o rótulo já vive em 9px; esticá-lo mais
 * truncaria os oito ao mesmo tempo. Era a alternativa combinada no T054, e o
 * nome do filtro em caixa alta continua visível na linha "FILTRO" logo acima.
 */
const LIMITE_FONTE_AMPLIADA = 1.3;

/**
 * Miniatura memoizada — mesmo motivo do `Chip` do carrossel de emoji, e mais
 * forte aqui: sem memo, cada troca de filtro redesenharia as nove imagens
 * filtradas, não nove textos.
 */
const Thumb = React.memo(function Thumb({
  item,
  photoUri,
  selected,
  mostrarNome,
  onSelect,
}: {
  item: ThumbItem;
  photoUri: string;
  selected: boolean;
  mostrarNome: boolean;
  onSelect: (id: FilterId | null) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filtro ${item.nome}`}
      // 70×93 já passa folgado do alvo mínimo de 48dp (FR-Q02): sem hitSlop.
      style={[styles.thumb, selected && styles.thumbSelecionada]}
    >
      <FilteredImage uri={photoUri} filtroId={item.id} style={StyleSheet.absoluteFill} />
      {/* Véu: o emoji e o nome precisam ler sobre qualquer foto, inclusive
          uma estourada de sol. */}
      <View pointerEvents="none" style={styles.veu} />
      <Text style={styles.emoji}>{item.emoji}</Text>
      {mostrarNome ? (
        <Text
          style={[styles.nome, selected && styles.nomeSelecionado]}
          numberOfLines={1}
        >
          {item.nome.toUpperCase()}
        </Text>
      ) : null}
    </Pressable>
  );
});

/**
 * Carrossel de filtros do **modal de captura**: a própria foto da sessão
 * miniaturizada com cada filtro aplicado, o emoji ao centro e o nome embaixo
 * (Figma 462:926 → "Filtros disponiveis", acima do bloco de música).
 *
 * O visor da câmera continua com o `FilterCarousel` de chips de emoji, e isso
 * é de propósito: lá não existe foto capturada para miniaturizar. Os dois
 * carrosséis são diferentes porque as duas telas são diferentes — não é
 * inconsistência a ser "corrigida".
 */
export function FilterThumbs({ photoUri, ativo, onSelect }: Props) {
  const { fontScale } = useWindowDimensions();
  const mostrarNomeSempre = fontScale <= LIMITE_FONTE_AMPLIADA;

  const renderItem = useCallback(
    ({ item }: { item: ThumbItem }) => {
      const selected = item.id === ativo;
      return (
        <Thumb
          item={item}
          photoUri={photoUri}
          selected={selected}
          mostrarNome={mostrarNomeSempre || selected}
          onSelect={onSelect}
        />
      );
    },
    [ativo, photoUri, mostrarNomeSempre, onSelect],
  );

  return (
    <FlatList
      horizontal
      data={ITEMS}
      keyExtractor={(f) => f.id ?? 'original'}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={renderItem}
      extraData={ativo}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: PAD_HORIZONTAL,
    gap: GAP,
  },
  thumb: {
    width: LARGURA,
    height: ALTURA,
    borderRadius: radii.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    // A borda existe sempre, transparente quando não selecionada: assim a
    // seleção não empurra as vizinhas 2px para o lado a cada troca.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbSelecionada: {
    borderColor: colors.amber,
  },
  veu: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,5,6,0.28)',
  },
  emoji: {
    fontSize: 24,
  },
  nome: {
    position: 'absolute',
    bottom: 6,
    left: 2,
    right: 2,
    textAlign: 'center',
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  nomeSelecionado: {
    color: colors.amber,
  },
});

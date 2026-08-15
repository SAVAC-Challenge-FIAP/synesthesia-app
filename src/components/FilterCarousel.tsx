import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FILTERS } from '@/constants/filters';
import { colors, fonts, hitSlops, radii } from '@/theme/tokens';
import { FilterId } from '@/types';

interface Props {
  /** null = chip "Original" (sem filtro, T-0B) */
  ativo: FilterId | null;
  onSelect: (id: FilterId | null) => void;
  /** chip "AUTO" indica que o filtro veio da vibe (não escolhido manualmente) */
  autoAtivo?: boolean;
}

interface CarouselItem {
  id: FilterId | null;
  nome: string;
  emoji: string;
}

/** "Original" + os 8 filtros: a foto sem filtro é uma escolha de primeira classe. */
const ITEMS: CarouselItem[] = [{ id: null, nome: 'Original', emoji: '📷' }, ...FILTERS];

const PAD_HORIZONTAL = 16;
const GAP = 8;

/**
 * Carrossel horizontal dos filtros (chips do Figma, radius 15).
 *
 * Em repouso cabem três chips e meio, e o meio chip cortado lia como defeito de
 * layout em vez de "tem mais à direita" — ainda mais para quem abre o app pela
 * primeira vez, que é o caso do avaliador (US4). A pista é dupla: um
 * chip "+N" na borda, na mesma linguagem visual dos outros, que diz de uma vez
 * que a lista continua e **quantos** filtros ainda existem.
 *
 * O número é o que fecha o aceite: o teste da US4 é mostrar uma captura de tela
 * a alguém e perguntar quantos filtros o app tem. Numa imagem parada, um
 * esmaecimento diria "tem mais", nunca "tem mais seis" — por isso a pista aqui
 * é numérica, e não um degradê. Degradê teria outro problema: no visor o fundo
 * é a câmera ao vivo, e qualquer faixa escura vira tarja, não transição.
 */
/**
 * Chip memoizado: sem isto, trocar de filtro re-renderiza os nove — medido em
 * ~25 frames por troca, com 95º percentil em 200ms. Só os dois chips que mudam
 * de estado precisam redesenhar.
 */
const Chip = React.memo(function Chip({
  item,
  index,
  selected,
  autoAtivo,
  onSelect,
  onLayout,
}: {
  item: CarouselItem;
  index: number;
  selected: boolean;
  autoAtivo?: boolean;
  onSelect: (id: FilterId | null) => void;
  onLayout: (index: number) => (e: LayoutChangeEvent) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      hitSlop={hitSlops.chip}
      onLayout={onLayout(index)}
      style={[styles.chip, selected && styles.chipAtivo]}
    >
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={[styles.nome, selected && styles.nomeAtivo]}>
        {item.nome.toUpperCase()}
        {selected && autoAtivo ? ' · AUTO' : ''}
      </Text>
    </Pressable>
  );
});

export function FilterCarousel({ ativo, onSelect, autoAtivo }: Props) {
  const listaRef = useRef<FlatList<CarouselItem>>(null);
  const larguras = useRef<number[]>([]);
  const [larguraVisivel, setLarguraVisivel] = useState(0);
  const [offset, setOffset] = useState(0);
  const [medidos, setMedidos] = useState(0);

  const medirItem = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      if (larguras.current[index] === e.nativeEvent.layout.width) return;
      larguras.current[index] = e.nativeEvent.layout.width;
      setMedidos(larguras.current.filter(Boolean).length);
    },
    [],
  );

  // Conta os itens que ainda não couberam, somando larguras reais em vez de
  // estimar: os chips têm larguras diferentes ("ORIGINAL" contra "LOVE"), então
  // qualquer média erraria a conta — e um número errado é pior que nenhum.
  const restantes = useCallback(() => {
    if (!larguraVisivel || medidos < ITEMS.length) return 0;
    const limite = offset + larguraVisivel;
    let borda = PAD_HORIZONTAL;
    let visiveis = 0;
    for (let i = 0; i < ITEMS.length; i += 1) {
      borda += larguras.current[i];
      if (borda <= limite) visiveis += 1;
      borda += GAP;
    }
    return ITEMS.length - visiveis;
  }, [larguraVisivel, offset, medidos])();

  const aoRolar = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(e.nativeEvent.contentOffset.x),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: CarouselItem; index: number }) => (
      <Chip
        item={item}
        index={index}
        selected={item.id === ativo}
        autoAtivo={autoAtivo}
        onSelect={onSelect}
        onLayout={medirItem}
      />
    ),
    [ativo, autoAtivo, onSelect, medirItem],
  );

  const noFim = restantes === 0 && offset > 4;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listaRef}
        horizontal
        style={styles.lista}
        onLayout={(e) => setLarguraVisivel(e.nativeEvent.layout.width)}
        data={ITEMS}
        keyExtractor={(f) => f.id ?? 'original'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onScroll={aoRolar}
        scrollEventThrottle={32}
        renderItem={renderItem}
        extraData={ativo}
      />

      {/* Fica sempre montado, e com largura fixa: se aparecesse e sumisse
          conforme a rolagem, o carrossel inteiro pularia de lugar. */}
      <Pressable
        style={styles.contador}
        hitSlop={hitSlops.chip}
        accessibilityRole="button"
        accessibilityLabel={
          restantes > 0 ? `Mais ${restantes} filtros à direita` : 'Voltar ao primeiro filtro'
        }
        onPress={() =>
          listaRef.current?.scrollToOffset({
            offset: restantes > 0 ? offset + larguraVisivel * 0.75 : 0,
            animated: true,
          })
        }
      >
        {restantes > 0 ? (
          <Text style={styles.contadorTexto}>+{restantes}</Text>
        ) : (
          <Ionicons name="refresh" size={16} color={colors.amber} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lista: {
    flex: 1,
  },
  row: {
    paddingLeft: PAD_HORIZONTAL,
    paddingRight: 8,
    gap: GAP,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderWidth: 1,
    borderColor: colors.parchment25,
  },
  chipAtivo: {
    backgroundColor: colors.ruby,
    borderColor: colors.ruby,
  },
  emoji: {
    fontSize: 14,
  },
  nome: {
    color: colors.parchment,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
  },
  nomeAtivo: {
    color: colors.parchment,
  },
  // Mesmo desenho dos chips (radius 15), mas com borda âmbar: é um controle de
  // navegação, não mais um filtro. Fora da lista, para não tapar chip nenhum.
  contador: {
    width: 46,
    marginRight: PAD_HORIZONTAL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderWidth: 1,
    borderColor: colors.amber,
  },
  contadorTexto: {
    color: colors.amber,
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});

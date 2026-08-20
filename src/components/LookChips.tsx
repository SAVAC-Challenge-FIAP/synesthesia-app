import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { filterById } from '@/constants/filters';
import { identidadeDoLook } from '@/services/looks';
import { colors, fonts, hitSlops, radii } from '@/theme/tokens';
import { LookRecipe, PapelLook } from '@/types';

interface Props {
  looks: LookRecipe[];
  escolhido: LookRecipe | null;
  onSelect: (look: LookRecipe) => void;
}

/**
 * Rótulo do papel. Existe pelo mesmo motivo do papel das faixas: sem ele, a
 * sugestão que veio do histórico não teria como se apresentar como tal, e a
 * `ousada` pareceria erro de curadoria em vez de proposta.
 */
const ROTULO: Record<PapelLook, string> = {
  afinidade: 'DO SEU JEITO',
  certeira: 'DA CENA',
  ousada: 'MAIS OUSADA',
};

const Chip = React.memo(function Chip({
  look,
  selected,
  onSelect,
}: {
  look: LookRecipe;
  selected: boolean;
  onSelect: (look: LookRecipe) => void;
}) {
  // Amber marca o que veio do aparelho, consistente com o uso de amber para
  // música e foco na identidade (Princípio VI).
  const daAfinidade = look.papel === 'afinidade';
  return (
    <Pressable
      onPress={() => onSelect(look)}
      hitSlop={hitSlops.chip}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Look ${look.nome}, ${ROTULO[look.papel].toLowerCase()}${
        look.justificativa ? `. ${look.justificativa}` : ''
      }`}
      style={[styles.chip, selected && styles.chipAtivo]}
    >
      <View style={styles.linhaTopo}>
        <Text style={styles.emoji}>{filterById(look.base).emoji}</Text>
        <Text style={styles.nome} numberOfLines={1}>
          {look.nome.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.papel, daAfinidade && styles.papelAfinidade]} numberOfLines={1}>
        {ROTULO[look.papel]}
      </Text>
      {look.justificativa ? (
        <Text style={styles.justificativa} numberOfLines={2}>
          {look.justificativa}
        </Text>
      ) : null}
    </Pressable>
  );
});

/**
 * Os três looks sugeridos para a foto (feature 003, US1).
 *
 * Fica **acima** das miniaturas dos 8 presets, e não no lugar delas: as
 * sugestões vêm primeiro porque são a resposta do sistema, e os 8 base seguem
 * acessíveis logo abaixo para quem quer algo fora delas (FR-006).
 *
 * Enquanto a curadoria não volta, este componente não renderiza nada — em vez
 * de três esqueletos piscando. A foto já está salvável nesse intervalo, e
 * anunciar uma espera que não bloqueia nada só criaria uma (FR-020).
 */
export function LookChips({ looks, escolhido, onSelect }: Props) {
  const idEscolhido = escolhido ? identidadeDoLook(escolhido) : null;

  const renderItem = useCallback(
    ({ item }: { item: LookRecipe }) => (
      <Chip look={item} selected={identidadeDoLook(item) === idEscolhido} onSelect={onSelect} />
    ),
    [idEscolhido, onSelect],
  );

  if (looks.length === 0) return null;

  return (
    <FlatList
      horizontal
      data={looks}
      keyExtractor={identidadeDoLook}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={renderItem}
      extraData={idEscolhido}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    width: 150,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.chip,
    backgroundColor: 'rgba(9,5,6,0.55)',
    borderWidth: 1,
    borderColor: colors.parchment25,
    gap: 2,
  },
  chipAtivo: {
    backgroundColor: colors.ruby,
    borderColor: colors.ruby,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 14,
  },
  nome: {
    flex: 1,
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 11,
    letterSpacing: 1,
  },
  papel: {
    color: colors.parchment50,
    fontFamily: fonts.labelForte,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  papelAfinidade: {
    color: colors.amber,
  },
  justificativa: {
    color: colors.parchment,
    fontFamily: fonts.labelLight,
    fontSize: 10,
    lineHeight: 13,
  },
});

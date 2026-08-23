/**
 * @docs docs/runbooks/armadilhas-conhecidas.md
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { FilteredImage } from "@/components/FilteredImage";
import { EsqueletoTexto } from "@/components/EsqueletoTexto";
import { FILTERS } from "@/constants/filters";
import { identidadeDoLook } from "@/services/looks";
import { previaParaSkia } from "@/services/previaFoto";
import { colors, fonts, radii } from "@/theme/tokens";
import { FilterId, LookRecipe, PapelLook } from "@/types";

interface Props {
  photoUri: string;
  looks: LookRecipe[];
  carregando: boolean;
  lookEscolhido: LookRecipe | null;
  filtroAtivo: FilterId | null;
  onSelectLook: (look: LookRecipe) => void;
  onSelectFiltro: (id: FilterId | null) => void;
}

const ROTULO: Record<PapelLook, string> = {
  afinidade: "do seu jeito",
  certeira: "da cena",
  ousada: "mais ousada",
};

const LARGURA = 70;
const ALTURA = 93;
const QUANTOS_LOOKS = 3;

const LIMITE_FONTE_AMPLIADA = 1.3;

const PRESETS = [
  { id: null as FilterId | null, nome: "Original", emoji: "📷" },
  ...FILTERS,
];

const Esqueleto = React.memo(function Esqueleto({
  atraso = 0,
}: {
  atraso?: number;
}) {
  return (
    <EsqueletoTexto
      largura={LARGURA}
      altura={ALTURA}
      atraso={atraso}
      rotuloAcessivel="Procurando um tratamento para esta foto"
    />
  );
});

const Miniatura = React.memo(function Miniatura({
  photoUri,
  filtroId,
  nome,
  emoji,
  ehLook,
  selecionada,
  mostrarNome,
  rotuloAcessivel,
  onPress,
}: {
  photoUri: string;
  filtroId: FilterId | null;
  nome: string;
  emoji?: string;
  ehLook: boolean;
  selecionada: boolean;
  mostrarNome: boolean;
  rotuloAcessivel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={rotuloAcessivel}

      style={[
        styles.thumb,

        ehLook && styles.thumbLook,
        selecionada &&
          (ehLook ? styles.thumbLookAtivo : styles.thumbSelecionada),
      ]}
    >
      <FilteredImage
        uri={photoUri}
        filtroId={filtroId}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.veu} />
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      {mostrarNome ? (
        <Text
          style={[styles.nome, selecionada && styles.nomeSelecionado]}
          numberOfLines={1}
        >
          {nome.toUpperCase()}
        </Text>
      ) : null}
    </Pressable>
  );
});

type Item =
  | { tipo: "esqueleto"; chave: string; atraso: number }
  | { tipo: "look"; chave: string; look: LookRecipe }
  | {
      tipo: "preset";
      chave: string;
      id: FilterId | null;
      nome: string;
      emoji: string;
    };

export function TratamentoCarrossel({
  photoUri,
  looks,
  carregando,
  lookEscolhido,
  filtroAtivo,
  onSelectLook,
  onSelectFiltro,
}: Props) {
  const { fontScale } = useWindowDimensions();
  const mostrarNomeSempre = fontScale <= LIMITE_FONTE_AMPLIADA;
  const idEscolhido = lookEscolhido ? identidadeDoLook(lookEscolhido) : null;

  const [uriLeve, setUriLeve] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    previaParaSkia(photoUri).then((u) => {
      if (vivo) setUriLeve(u);
    });
    return () => {
      vivo = false;
    };
  }, [photoUri]);
  const uri = uriLeve ?? photoUri;

  const itens: Item[] = [
    ...(looks.length > 0
      ? looks.map((look, i) => ({
          tipo: "look" as const,
          chave: `slot-${i}`,
          look,
        }))
      : carregando
        ? Array.from({ length: QUANTOS_LOOKS }, (_, i) => ({
            tipo: "esqueleto" as const,
            chave: `slot-${i}`,
            atraso: i * 260,
          }))
        : []),
    ...PRESETS.map((p) => ({
      tipo: "preset" as const,
      chave: `preset-${p.id ?? "original"}`,
      id: p.id,
      nome: p.nome,
      emoji: p.emoji,
    })),
  ];

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.tipo === "esqueleto") return <Esqueleto atraso={item.atraso} />;
      if (item.tipo === "look") {
        const selecionada = identidadeDoLook(item.look) === idEscolhido;
        return (
          <Miniatura
            photoUri={uri}
            filtroId={item.look.base}
            nome={item.look.nome}
            ehLook
            selecionada={selecionada}
            mostrarNome={mostrarNomeSempre || selecionada}
            rotuloAcessivel={`Look ${item.look.nome}, ${ROTULO[item.look.papel]}${
              item.look.justificativa ? `. ${item.look.justificativa}` : ""
            }`}
            onPress={() => onSelectLook(item.look)}
          />
        );
      }

      const selecionada = idEscolhido === null && item.id === filtroAtivo;
      return (
        <Miniatura
          photoUri={uri}
          filtroId={item.id}
          nome={item.nome}
          emoji={item.emoji}
          ehLook={false}
          selecionada={selecionada}
          mostrarNome={mostrarNomeSempre || selecionada}
          rotuloAcessivel={`Filtro ${item.nome}`}
          onPress={() => onSelectFiltro(item.id)}
        />
      );
    },
    [
      uri,
      idEscolhido,
      filtroAtivo,
      mostrarNomeSempre,
      onSelectLook,
      onSelectFiltro,
    ],
  );

  const justificativa = lookEscolhido?.justificativa ?? null;

  return (
    <View>
      <View style={styles.faixaJustificativa}>
        {justificativa ? (
          <Text style={styles.justificativa} numberOfLines={2}>
            {justificativa}
          </Text>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={itens}
        keyExtractor={(i) => i.chave}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        renderItem={renderItem}
        extraData={`${idEscolhido}|${filtroAtivo}|${mostrarNomeSempre}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 10,
  },
  faixaJustificativa: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  justificativa: {
    color: colors.parchment,
    fontFamily: fonts.labelLight,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
  },
  thumb: {
    width: LARGURA,
    height: ALTURA,
    borderRadius: radii.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,

    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbLook: {
    borderColor: "rgba(248,162,13,0.45)",
  },
  thumbLookAtivo: {
    borderColor: colors.amber,
  },
  thumbSelecionada: {
    borderColor: colors.parchment,
  },
  veu: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,5,6,0.28)",
  },
  emoji: {
    fontSize: 24,
  },
  nome: {
    position: "absolute",
    bottom: 6,
    left: 2,
    right: 2,
    textAlign: "center",
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  nomeSelecionado: {
    color: colors.amber,
  },
});

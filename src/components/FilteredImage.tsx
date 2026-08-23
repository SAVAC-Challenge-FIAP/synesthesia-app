/**
 * @docs docs/components/FilteredImage.md
 */
import React, { useEffect, useState } from "react";
import {
  FilterFunction,
  Image,
  ImageStyle,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { FilterLayer } from "@/components/FilterLayer";
import { filterById, resolverReceita } from "@/constants/filters";
import { matrizDeCor } from "@/services/looks";
import { previaParaSkia } from "@/services/previaFoto";
import { carregarSkia, SkiaMod } from "@/services/skiaBridge";
import { FilterDef, FilterId, LookRecipe } from "@/types";

interface Props {
  uri: string;
  filtroId: FilterId | null;
  look?: LookRecipe | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  usarSkia?: boolean;
}

export function FilteredImage(props: Props) {
  const [skia, setSkia] = useState<SkiaMod | null>(null);

  useEffect(() => {
    let vivo = true;

    if (!props.usarSkia) return;
    carregarSkia().then((mod) => {
      if (vivo) setSkia(mod);
    });
    return () => {
      vivo = false;
    };
  }, [props.usarSkia]);

  const filtro = props.look
    ? resolverReceita(props.look)
    : props.filtroId
      ? filterById(props.filtroId)
      : null;

  if (props.usarSkia && skia) {
    return (
      <FilteredImageSkia
        uri={props.uri}
        filtro={filtro}
        mod={skia}
        style={props.style}
      />
    );
  }
  return (
    <FilteredImageLegado
      uri={props.uri}
      filtro={filtro}
      style={props.style}
      imageStyle={props.imageStyle}
    />
  );
}

function FilteredImageLegado({
  uri,
  filtro,
  style,
  imageStyle,
}: {
  uri: string;
  filtro: FilterDef | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  const f = filtro?.imageFilter;
  const filterFns: FilterFunction[] = f
    ? [
        ...(f.brightness !== undefined ? [{ brightness: f.brightness }] : []),
        ...(f.saturate !== undefined ? [{ saturate: f.saturate }] : []),
        ...(f.contrast !== undefined ? [{ contrast: f.contrast }] : []),
        ...(f.sepia !== undefined ? [{ sepia: f.sepia }] : []),
      ]
    : [];

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          filterFns.length > 0 && { filter: filterFns },
        ]}
      >
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill as ImageStyle, imageStyle]}
          resizeMode="cover"
        />
      </View>
      {filtro ? <FilterLayer filter={filtro} /> : null}
    </View>
  );
}

function FilteredImageSkia({
  uri,
  filtro,
  mod,
  style,
}: {
  uri: string;
  filtro: FilterDef | null;
  mod: SkiaMod;
  style?: StyleProp<ViewStyle>;
}) {
  const { Canvas, Image: SkiaImageNode, ColorMatrix, Fill, useImage } = mod;

  const [uriLeve, setUriLeve] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    previaParaSkia(uri).then((u) => {
      if (vivo) setUriLeve(u);
    });
    return () => {
      vivo = false;
    };
  }, [uri]);

  const imagem = useImage(uriLeve ?? undefined);
  const [tamanho, setTamanho] = useState<{
    largura: number;
    altura: number;
  } | null>(null);

  const aoMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setTamanho({ largura: width, altura: height });
  };

  const matriz = filtro ? matrizDeCor(filtro) : null;

  return (
    <View style={[styles.wrap, style]} onLayout={aoMedir}>
      {imagem && tamanho ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImageNode
            image={imagem}
            x={0}
            y={0}
            width={tamanho.largura}
            height={tamanho.altura}
            fit="cover"
          >
            {matriz ? <ColorMatrix matrix={matriz} /> : null}
          </SkiaImageNode>
          {filtro && filtro.overlayOpacity > 0 ? (
            <Fill color={filtro.overlayColor} opacity={filtro.overlayOpacity} />
          ) : null}
          {filtro?.overlayColor2 && (filtro.overlayOpacity2 ?? 0) > 0 ? (
            <Fill
              color={filtro.overlayColor2}
              opacity={filtro.overlayOpacity2 ?? 0}
            />
          ) : null}
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#090506",
  },
});

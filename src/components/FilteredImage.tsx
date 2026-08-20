import React, { useEffect, useState } from 'react';
import {
  FilterFunction,
  Image,
  ImageStyle,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { FilterLayer } from '@/components/FilterLayer';
import { filterById, resolverReceita } from '@/constants/filters';
import { matrizDeCor } from '@/services/looks';
import { carregarSkia, SkiaMod } from '@/services/skiaBridge';
import { FilterDef, FilterId, LookRecipe } from '@/types';

interface Props {
  uri: string;
  /** null = foto original, sem filtro (T-0B) */
  filtroId: FilterId | null;
  /**
   * Receita completa (feature 003). Quando presente, manda: `filtroId` vira
   * apenas a âncora e o render usa o preset base mais os desvios.
   *
   * Os dois convivem porque nem todo chamador tem receita — o visor ao vivo
   * (FR-021), as miniaturas dos 8 presets e as mídias antigas seguem passando
   * só `filtroId`, e isso continua sendo um caminho de primeira classe.
   */
  look?: LookRecipe | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Foto com o tratamento aplicado (feature 003, US3).
 *
 * Dois caminhos de render, escolhidos em runtime:
 * - **Skia** (`FilteredImageSkia`, abaixo): uma matriz de cor 20 floats +
 *   overlay desenhados no Canvas — fiel em Android e iOS, o que fecha FR-025.
 * - **RN legado** (`FilteredImageLegado`): `style.filter` do RN + `FilterLayer`
 *   — o render que o app sempre teve, e a rede de segurança enquanto o Skia
 *   nativo não estiver presente no dev build (research R3).
 *
 * Nenhum dos dois é importado estaticamente daqui: `carregarSkia()` só
 * resolve depois de tentar o `import()` do módulo nativo, e só então este
 * componente decide qual dos dois renderiza. Até lá — e para sempre, se o
 * rebuild nunca rodar — o legado responde sozinho, sem qualquer diferença de
 * comportamento em relação a antes desta feature.
 */
export function FilteredImage(props: Props) {
  const [skia, setSkia] = useState<SkiaMod | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarSkia().then((mod) => {
      if (vivo) setSkia(mod);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const filtro = props.look
    ? resolverReceita(props.look)
    : props.filtroId
      ? filterById(props.filtroId)
      : null;

  if (skia) {
    return <FilteredImageSkia uri={props.uri} filtro={filtro} mod={skia} style={props.style} />;
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

/**
 * Render antigo: `style.filter` do RN (Android integral, iOS só `brightness`)
 * mais `FilterLayer` para o overlay de identidade. É a dívida que a US3 paga
 * — três looks distintos ficam menos distintos em iOS do que deveriam aqui.
 */
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
      <View style={[StyleSheet.absoluteFill, filterFns.length > 0 && { filter: filterFns }]}>
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

/**
 * Render por Skia (T035): uma matriz de cor no Canvas em vez de quatro
 * filtros de estilo — igual nos dois sistemas, porque não depende de
 * `style.filter` do RN.
 *
 * Nada aqui importa `@shopify/react-native-skia` estaticamente: `Canvas`,
 * `Image` e `ColorMatrix` vêm do módulo já carregado (`mod`), recebido como
 * prop de quem só monta este componente depois de confirmar que o nativo
 * respondeu (`FilteredImage` acima). É o que garante que o `import()` do
 * pacote só é avaliado uma vez, e só quando já se sabe que não vai lançar.
 */
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
  const imagem = useImage(uri);
  const [tamanho, setTamanho] = useState<{ largura: number; altura: number } | null>(null);

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
            <Fill color={filtro.overlayColor2} opacity={filtro.overlayOpacity2 ?? 0} />
          ) : null}
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#090506',
  },
});

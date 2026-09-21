/**
 * @docs docs/components/compartilhamentoRecebido.md
 */
import { Platform } from "react-native";

import type { ImagemRecebida } from "../../modules/share-intake/src/ShareIntake.types";

export type { ImagemRecebida };

type ModuloNativo =
  typeof import("../../modules/share-intake/src/ShareIntakeModule").default;

export interface Inscricao {
  remove: () => void;
}

let modulo: ModuloNativo | null | undefined;

async function carregar(): Promise<ModuloNativo | null> {
  if (modulo !== undefined) return modulo;
  if (Platform.OS !== "android") {
    modulo = null;
    return null;
  }
  try {
    const { default: ShareIntake } = await import(
      "../../modules/share-intake/src/ShareIntakeModule"
    );
    modulo = ShareIntake;
  } catch (error) {
    console.warn("[compartilhamento] módulo nativo indisponível:", error);
    modulo = null;
  }
  return modulo;
}

export async function uriPendente(): Promise<string | null> {
  const nativo = await carregar();
  if (!nativo) return null;
  try {
    return nativo.uriPendente() ?? null;
  } catch (error) {
    console.warn("[compartilhamento] leitura do intent falhou:", error);
    return null;
  }
}

export async function prepararImagem(
  origem: string,
): Promise<ImagemRecebida | null> {
  const nativo = await carregar();
  if (!nativo) return null;
  try {
    const imagem = await nativo.prepararImagem(origem);
    console.log(
      `[compartilhamento] foto recebida ${imagem.largura}x${imagem.altura} → ${imagem.uri}`,
    );
    return imagem;
  } catch (error) {
    console.warn("[compartilhamento] preparo da foto falhou:", error);
    return null;
  }
}

export async function assinarCompartilhamento(
  ouvinte: (uri: string) => void,
): Promise<Inscricao | null> {
  const nativo = await carregar();
  if (!nativo) return null;
  try {
    return nativo.addListener("onCompartilhamento", ({ uri }) => ouvinte(uri));
  } catch (error) {
    console.warn("[compartilhamento] assinatura do evento falhou:", error);
    return null;
  }
}

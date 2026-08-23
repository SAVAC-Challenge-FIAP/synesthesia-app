/**
 * @docs docs/components/shareTargets.md
 */
import { Platform } from "react-native";

import type { DestinoNativo } from "../../modules/share-target/src/ShareTarget.types";

export type { DestinoNativo };

const PREFERIDOS = [
  "com.instagram.android",
  "com.zhiliaoapp.musically",
  "com.ss.android.ugc.trill",
  "com.whatsapp",
  "com.whatsapp.w4b",
  "com.linkedin.android",
  "com.twitter.android",
  "com.x.android",
  "org.telegram.messenger",
  "com.facebook.katana",
  "com.snapchat.android",
];

export function mimeDoPacote(temVideo: boolean): string {
  return temVideo ? "video/mp4" : "image/jpeg";
}

export async function listarDestinos(
  mimeType: string,
): Promise<DestinoNativo[]> {
  if (Platform.OS !== "android") return [];
  try {
    const { default: ShareTarget } =
      await import("../../modules/share-target/src/ShareTargetModule");
    return ordenar(ShareTarget.listarDestinos(mimeType));
  } catch (error) {
    console.warn(
      "[shareTargets] modulo nativo indisponivel, usando folha do sistema:",
      error,
    );
    return [];
  }
}

function posicao(pacote: string): number {
  const i = PREFERIDOS.indexOf(pacote);
  return i === -1 ? PREFERIDOS.length : i;
}

function ordenar(destinos: DestinoNativo[]): DestinoNativo[] {
  const porPacote = new Map<string, DestinoNativo[]>();
  const jaVistos = new Set<string>();
  for (const d of destinos) {
    const identidade = `${d.pacote} ${d.nome}`;
    if (jaVistos.has(identidade)) continue;
    jaVistos.add(identidade);

    const lista = porPacote.get(d.pacote);
    if (lista) lista.push(d);
    else porPacote.set(d.pacote, [d]);
  }

  const pacotes = [...porPacote.keys()];
  const preferidos = pacotes
    .filter((p) => PREFERIDOS.includes(p))
    .sort((a, b) => posicao(a) - posicao(b));
  const resto = pacotes.filter((p) => !PREFERIDOS.includes(p));

  return [...rodizio(preferidos, porPacote), ...rodizio(resto, porPacote)];
}

function rodizio(
  pacotes: string[],
  porPacote: Map<string, DestinoNativo[]>,
): DestinoNativo[] {
  const saida: DestinoNativo[] = [];
  const maior = pacotes.reduce(
    (max, p) => Math.max(max, porPacote.get(p)!.length),
    0,
  );
  for (let i = 0; i < maior; i++) {
    for (const pacote of pacotes) {
      const destino = porPacote.get(pacote)![i];
      if (destino) saida.push(destino);
    }
  }
  return saida;
}

export async function compartilharEm(params: {
  destino: DestinoNativo;
  caminho: string;
  mimeType: string;
  texto: string | null;
}): Promise<boolean> {
  try {
    const { default: ShareTarget } =
      await import("../../modules/share-target/src/ShareTargetModule");
    await ShareTarget.compartilharEm(
      params.destino.pacote,
      params.destino.atividade,
      params.caminho,
      params.mimeType,
      params.texto,
    );
    return true;
  } catch (error) {
    console.warn("[shareTargets] falha ao abrir destino direto:", error);
    return false;
  }
}

/**
 * @docs docs/adr/0013-arquitetura-estado-captura.md
 */
import { exportPackage, SharePackage } from "@/services/sharePackage";
import { MusicSuggestion } from "@/types";

export interface ParametrosPacote {
  imageUri: string;
  musica: MusicSuggestion | null;
  trechoInicio: number;
  trechoFim: number;
}

export function chavePacote(p: {
  photoUri: string;
  filtroId: string | null;
  musicaId: string | null;
  trechoInicio: number;
  trechoFim: number;
}): string {
  return [
    p.photoUri,
    p.filtroId ?? "sem-filtro",
    p.musicaId ?? "sem-musica",
    p.trechoInicio,
    p.trechoFim,
  ].join("|");
}

interface EmVoo {
  chave: string;
  promise: Promise<SharePackage | null>;
}

let pronto: { chave: string; pacote: SharePackage } | null = null;
let emVoo: EmVoo | null = null;
let pendente: {
  chave: string;
  montar: () => Promise<ParametrosPacote>;
} | null = null;

export function obterPronto(chave: string): SharePackage | null {
  return pronto && pronto.chave === chave ? pronto.pacote : null;
}

export function obterEmVoo(chave: string): Promise<SharePackage | null> | null {
  return emVoo && emVoo.chave === chave ? emVoo.promise : null;
}

export function agendar(
  chave: string,
  montar: () => Promise<ParametrosPacote>,
): void {
  if (pronto?.chave === chave) return;
  if (emVoo?.chave === chave) return;
  if (emVoo) {
    pendente = { chave, montar };
    return;
  }
  iniciar(chave, montar);
}

function iniciar(chave: string, montar: () => Promise<ParametrosPacote>): void {
  pronto = null;

  const promise = (async () => {
    try {
      const params = await montar();

      if (!params.musica) return null;
      return await exportPackage(params);
    } catch (error) {
      console.warn("[preExport] falhou; a postagem gera na hora:", error);
      return null;
    }
  })();

  emVoo = { chave, promise };

  promise
    .then((pacote) => {
      if (pacote && emVoo?.chave === chave) pronto = { chave, pacote };
    })
    .finally(() => {
      if (emVoo?.chave === chave) emVoo = null;
      const proxima = pendente;
      pendente = null;
      if (proxima) iniciar(proxima.chave, proxima.montar);
    });
}

export function limpar(): void {
  pronto = null;
  emVoo = null;
  pendente = null;
}

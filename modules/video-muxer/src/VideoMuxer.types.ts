/**
 * @docs docs/components/VideoMuxer.types.md
 */
export type EstadoExportacao =
  "iniciando" | "exportando" | "concluido" | "falhou";

export interface ProgressoExportacao {
  progresso: number;
  estado: EstadoExportacao;
}

export type VideoMuxerModuleEvents = {
  onProgress: (evento: ProgressoExportacao) => void;
};

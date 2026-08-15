/** Estados que o módulo nativo reporta durante a exportação (contrato C-01). */
export type EstadoExportacao = 'iniciando' | 'exportando' | 'concluido' | 'falhou';

export interface ProgressoExportacao {
  /**
   * 0–100, **proporcional ao trabalho concluído** — nunca estimado por tempo
   * decorrido. Monotônico: nunca retrocede (C-03).
   */
  progresso: number;
  estado: EstadoExportacao;
}

/**
 * O evento é informativo: quem o ignora se comporta exatamente como no v1,
 * porque a Promise de `muxImageAndAudio` continua sendo a fonte da verdade
 * de sucesso e falha (C-01).
 *
 * Se o device não souber informar progresso, o módulo **omite** os eventos
 * `exportando` em vez de inventar números (C-04) — o consumidor deve, por
 * isso, tratar "nenhum valor recebido" como indicador indefinido.
 */
export type VideoMuxerModuleEvents = {
  onProgress: (evento: ProgressoExportacao) => void;
};

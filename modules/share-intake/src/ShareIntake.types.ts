/**
 * @docs docs/components/ShareIntake.types.md
 */
export interface ImagemRecebida {
  uri: string;
  largura: number;
  altura: number;
}

export type ShareIntakeModuleEvents = {
  onCompartilhamento: (evento: { uri: string }) => void;
};

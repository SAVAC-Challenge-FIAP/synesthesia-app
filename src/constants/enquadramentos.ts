import { EnquadramentoId } from '@/types';

/**
 * Enquadramentos do visor (T066) — razão **largura/altura**.
 *
 * O padrão continua sendo 4:3, que é o formato nativo da maioria dos sensores e
 * o mais próximo do 735/913 que o app cravava até aqui: assim quem não abrir o
 * painel não percebe mudança nenhuma.
 */
export interface Enquadramento {
  id: EnquadramentoId;
  /** largura / altura */
  razao: number;
  rotulo: string;
}

export const ENQUADRAMENTOS: Enquadramento[] = [
  { id: '4:3', razao: 3 / 4, rotulo: '4:3' },
  { id: '1:1', razao: 1, rotulo: '1:1' },
  { id: '16:9', razao: 9 / 16, rotulo: '16:9' },
];

export const ENQUADRAMENTO_PADRAO: EnquadramentoId = '4:3';

export const enquadramentoPor = (id: EnquadramentoId): Enquadramento =>
  ENQUADRAMENTOS.find((e) => e.id === id) ?? ENQUADRAMENTOS[0];

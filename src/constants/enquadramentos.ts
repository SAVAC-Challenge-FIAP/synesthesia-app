import { EnquadramentoId } from '@/types';

/**
 * Enquadramentos do visor (T066) — razão **largura/altura**.
 *
 * O padrão continua sendo 4:3, que é o formato nativo da maioria dos sensores e
 * o mais próximo do 735/913 que o app cravava até aqui: assim quem não abrir o
 * painel não percebe mudança nenhuma.
 *
 * Cada um também declara **onde vive na tela** (T093), porque isso não é
 * consequência da razão — é decisão de produto, e cada um tem a sua:
 *
 * - `util`      — centralizado na área útil, entre a barra de opções e os
 *                 filtros. É o lugar do 4:3 e do 1:1, que cabem ali com folga.
 * - `controles` — encostado no topo dos controles, crescendo para cima. O 16:9
 *                 não cabe na área útil; ancorando embaixo, ele nunca deixa
 *                 aquela faixa órfã de imagem entre os filtros e os botões, e
 *                 nunca cobre um controle.
 * - `tela`      — a tela inteira, atrás de tudo. Sem uso desde que o FULL saiu
 *                 (decisão do Sávio); a âncora fica porque o cálculo já a trata
 *                 e reintroduzir o modo é uma linha.
 */
export type AncoraEnquadramento = 'util' | 'controles' | 'tela';

export interface Enquadramento {
  id: EnquadramentoId;
  /** largura / altura. `null` = a razão é a da própria tela (FULL). */
  razao: number | null;
  rotulo: string;
  ancora: AncoraEnquadramento;
}

export const ENQUADRAMENTOS: Enquadramento[] = [
  { id: '4:3', razao: 3 / 4, rotulo: '4:3', ancora: 'util' },
  { id: '1:1', razao: 1, rotulo: '1:1', ancora: 'util' },
  { id: '16:9', razao: 9 / 16, rotulo: '16:9', ancora: 'controles' },
];

export const ENQUADRAMENTO_PADRAO: EnquadramentoId = '4:3';

export const enquadramentoPor = (id: EnquadramentoId): Enquadramento =>
  ENQUADRAMENTOS.find((e) => e.id === id) ?? ENQUADRAMENTOS[0];

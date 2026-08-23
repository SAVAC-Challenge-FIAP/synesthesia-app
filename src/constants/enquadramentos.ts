/**
 * @docs docs/components/enquadramentos.md
 */
import { EnquadramentoId } from "@/types";

export type AncoraEnquadramento = "util" | "controles" | "tela";

export interface Enquadramento {
  id: EnquadramentoId;
  razao: number | null;
  rotulo: string;
  ancora: AncoraEnquadramento;
}

export const ENQUADRAMENTOS: Enquadramento[] = [
  { id: "4:3", razao: 3 / 4, rotulo: "4:3", ancora: "util" },
  { id: "1:1", razao: 1, rotulo: "1:1", ancora: "util" },
  { id: "16:9", razao: 9 / 16, rotulo: "16:9", ancora: "controles" },
];

export const ENQUADRAMENTO_PADRAO: EnquadramentoId = "4:3";

export const enquadramentoPor = (id: EnquadramentoId): Enquadramento =>
  ENQUADRAMENTOS.find((e) => e.id === id) ?? ENQUADRAMENTOS[0];

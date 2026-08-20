import {
  FAIXAS_ABSOLUTAS,
  FAIXAS_DELTA,
  FILTERS,
  filterById,
  isFilterId,
  limitar,
  resolverReceita,
} from '@/constants/filters';
import { vibeById } from '@/constants/vibes';
import { chaveDaEscolha, useLookTasteStore } from '@/stores/useLookTasteStore';
import { AjustesLook, FilterId, LookRecipe, PapelLook, VibeId } from '@/types';

/**
 * Montagem dos três looks sugeridos por foto (feature 003).
 *
 * O contrato com quem chama é curto e vale sempre: **três receitas ancoradas,
 * válidas e distintas entre si**, com ou sem rede, com ou sem chave do Gemini,
 * com ou sem histórico. Nenhum consumidor precisa validar nada — se precisasse,
 * a validação estaria no lugar errado.
 *
 * Este arquivo existe separado de `music.ts` de propósito: `music.ts` já
 * concentra a cadeia inteira de degradação musical, e enfiar a visual lá dentro
 * misturaria duas máquinas de estado que só têm em comum a chamada de rede.
 */

/** Papéis que o modelo tem permissão de emitir — `afinidade` é sempre local. */
const PAPEIS_DO_MODELO: readonly string[] = ['certeira', 'ousada'];

/** Ordem dos papéis pedidos ao Gemini; vale quando o campo `papel` não presta. */
const PAPEIS_PEDIDOS: PapelLook[] = ['certeira', 'ousada'];

/**
 * Abaixo desta distância dois looks são a mesma imagem com nomes diferentes.
 *
 * Calibrado por inspeção dos 8 presets (research R2): os dois mais próximos
 * entre si, `vivid` e `honey`, ficam em ~0.19. Um limiar de 0.12 nunca acusa
 * dois presets base distintos como redundantes, mas ainda pega dois looks que o
 * modelo devolveu praticamente iguais.
 */
const LIMIAR_REDUNDANCIA = 0.12;

export const TOTAL_LOOKS = 3;

/**
 * Barreira 1 do clamp (FR-026): limita o **desvio** aceito do modelo.
 *
 * Recebe `unknown` porque é isto que chega de um JSON de modelo — e um campo que
 * veio como string, `null` ou `NaN` precisa virar 0, não derrubar o look.
 */
export function clampAjustes(bruto: unknown): AjustesLook {
  const o = (bruto ?? {}) as Record<string, unknown>;
  const campo = (k: keyof AjustesLook) => {
    const [min, max] = FAIXAS_DELTA[k];
    return limitar(o[k], min, max, 0);
  };
  return {
    brilho: campo('brilho'),
    saturacao: campo('saturacao'),
    contraste: campo('contraste'),
    sepia: campo('sepia'),
    veu: campo('veu'),
  };
}

/**
 * Identidade de um look: a âncora mais os cinco ajustes arredondados.
 *
 * O `nome` fica de fora — dois looks com nomes diferentes e a mesma receita são
 * o mesmo look. É o que `chavePacote` usa para não servir o vídeo de um look
 * para outro, e o que o histórico de gosto usa para agrupar escolhas.
 */
export function identidadeDoLook(look: LookRecipe | null | undefined): string {
  if (!look) return 'sem-look';
  return chaveDaEscolha(look.base, look.ajustes);
}

/**
 * A sugestão que vem do histórico do aparelho (FR-013).
 *
 * Consulta **só** `useLookTasteStore`, localmente. Nada disto entra no prompt do
 * Gemini, nem pode entrar (FR-014).
 *
 * Devolve `null` quando o histórico daquela vibe não tem sinal suficiente — o
 * limiar mora na store, junto do cálculo de peso. Aqui `null` não é falha: é o
 * caso normal de aparelho novo, e o slot vira mais uma sugestão de cena em vez
 * de exibir um rótulo que mente sobre a própria origem (FR-015).
 */
export function lookDeAfinidade(vibeId: VibeId): LookRecipe | null {
  const preferido = useLookTasteStore.getState().preferidoDaVibe(vibeId);
  // "Sem tratamento" é uma preferência legítima, mas não vira sugestão de look:
  // a foto original já está sempre disponível no carrossel dos presets, e um
  // chip "Original" no lugar de uma sugestão gastaria um dos três slots com o
  // que a pessoa já tem a um toque de distância.
  if (!preferido || preferido.base === null) return null;

  return {
    base: preferido.base,
    ajustes: preferido.ajustes ?? {},
    nome: preferido.nome || filterById(preferido.base).nome,
    justificativa: 'você costuma escolher este aqui',
    papel: 'afinidade',
  };
}

/**
 * Distância entre duas receitas, em unidades de faixa.
 *
 * Compara os valores **absolutos resolvidos**, não os deltas: dois presets
 * diferentes com ajustes opostos podem convergir para a mesma imagem, e comparar
 * deltas não veria isso. Cada eixo é normalizado pela largura da própria faixa,
 * senão `sepia` (0–0.8) pesaria menos que `saturate` (0–2) sem motivo.
 */
export function distanciaEntre(a: LookRecipe, b: LookRecipe): number {
  const fa = resolverReceita(a);
  const fb = resolverReceita(b);
  const ia = fa.imageFilter ?? {};
  const ib = fb.imageFilter ?? {};
  const eixo = (x: number | undefined, y: number | undefined, faixa: readonly [number, number]) =>
    Math.abs((x ?? 0) - (y ?? 0)) / (faixa[1] - faixa[0]);
  const A = FAIXAS_ABSOLUTAS;
  return (
    eixo(ia.brightness, ib.brightness, A.brightness) +
    eixo(ia.saturate, ib.saturate, A.saturate) +
    eixo(ia.contrast, ib.contrast, A.contrast) +
    eixo(ia.sepia, ib.sepia, A.sepia) +
    eixo(fa.overlayOpacity, fb.overlayOpacity, A.overlayOpacity) +
    // Overlays de cor diferentes já são identidades visuais diferentes, mesmo
    // com os mesmos números — o Neon roxo e o Arctic azul não se confundem.
    (fa.overlayColor === fb.overlayColor ? 0 : 0.2)
  );
}

/** Um look é redundante quando já existe outro perto demais no conjunto. */
function redundante(candidato: LookRecipe, conjunto: LookRecipe[]): boolean {
  return conjunto.some((l) => distanciaEntre(candidato, l) < LIMIAR_REDUNDANCIA);
}

/**
 * Interpreta uma ideia crua do Gemini. Devolve `null` só quando não há âncora —
 * todo o resto se corrige (ver a tabela de degradação em `contracts/gemini-look.md`).
 */
export function receitaDeIdeia(bruto: unknown, posicao: number): LookRecipe | null {
  const o = (bruto ?? {}) as Record<string, unknown>;
  if (!isFilterId(o.base)) return null;

  const papelBruto = typeof o.papel === 'string' ? o.papel.trim().toLowerCase() : '';
  // `afinidade` é rejeitado mesmo se vier: o modelo não viu o histórico, então
  // esse rótulo mentiria sobre a própria origem (FR-013/FR-015).
  const papel: PapelLook = PAPEIS_DO_MODELO.includes(papelBruto)
    ? (papelBruto as PapelLook)
    : (PAPEIS_PEDIDOS[posicao] ?? 'ousada');

  const nome = typeof o.nome === 'string' && o.nome.trim() ? o.nome.trim() : filterById(o.base).nome;

  return {
    base: o.base,
    ajustes: clampAjustes(o.ajustes),
    nome,
    justificativa: typeof o.justificativa === 'string' ? o.justificativa.trim() : '',
    papel,
  };
}

/**
 * Looks derivados só da vibe — o degrau do meio da cadeia de degradação
 * (FR-019) e a reserva que completa o conjunto quando o modelo entrega pouco.
 *
 * Determinístico de propósito (FR-009): a mesma vibe produz sempre os mesmos
 * looks, na mesma ordem. O primeiro é o preset que a vibe já apontava — a
 * tabela fixa antiga vira o piso do sistema novo, não some.
 */
export function looksBase(vibeId: VibeId): LookRecipe[] {
  const vibe = vibeById(vibeId);
  const inicio = FILTERS.findIndex((f) => f.id === vibe.filtro);
  const ordem: FilterId[] = Array.from(
    { length: FILTERS.length },
    (_, i) => FILTERS[(Math.max(0, inicio) + i) % FILTERS.length].id,
  );
  return ordem.map((base, i) => ({
    base,
    ajustes: {},
    nome: filterById(base).nome,
    justificativa:
      i === 0
        ? `combina com a atmosfera ${vibe.nome.toLowerCase()}`
        : `outra leitura da atmosfera ${vibe.nome.toLowerCase()}`,
    papel: (i === 0 ? 'certeira' : 'ousada') as PapelLook,
  }));
}

/**
 * Monta o conjunto final de três (FR-001).
 *
 * Ordem das operações, e cada uma responde a um edge case da spec:
 * 1. o slot de afinidade, do histórico local, se houver sinal (FR-013/FR-015);
 * 2. converte as ideias do modelo, descartando as sem âncora;
 * 3. remove as redundantes entre si (D4 — "três escolhas reais", não três chips);
 * 4. completa com looks base da vibe até fechar três, pulando os que também
 *    seriam redundantes.
 *
 * A afinidade entra **primeiro** porque é a principal: é ela que a pessoa pediu
 * como recomendação de topo, e é ela que faz o app melhorar com o uso. As outras
 * duas seguem vindo só da cena, sem influência do histórico (FR-017).
 *
 * Nunca rejeita. Sem ideia nenhuma — sem rede, sem chave, tempo estourado — o
 * resultado é três looks base, e o caminho de salvar segue igual (FR-020).
 */
export function montarLooks(ideias: unknown[] | undefined, vibeId: VibeId): LookRecipe[] {
  const doModelo = (ideias ?? [])
    .map((bruto, i) => receitaDeIdeia(bruto, i))
    .filter((l): l is LookRecipe => l !== null);

  const conjunto: LookRecipe[] = [];

  const afinidade = lookDeAfinidade(vibeId);
  if (afinidade) {
    conjunto.push(afinidade);
    console.log(`[looks] afinidade local: «${afinidade.nome}» base=${afinidade.base}`);
  }

  for (const look of doModelo) {
    if (conjunto.length >= TOTAL_LOOKS) break;
    if (!redundante(look, conjunto)) conjunto.push(look);
  }

  const reserva = looksBase(vibeId);
  for (const look of reserva) {
    if (conjunto.length >= TOTAL_LOOKS) break;
    if (!redundante(look, conjunto)) conjunto.push(look);
  }
  // Rede de segurança da rede de segurança: se o limiar barrou tudo (só possível
  // com faixas mal calibradas), três é três — repete-se da reserva sem filtrar.
  for (const look of reserva) {
    if (conjunto.length >= TOTAL_LOOKS) break;
    if (!conjunto.some((l) => l.base === look.base)) conjunto.push(look);
  }

  return conjunto.slice(0, TOTAL_LOOKS);
}

/**
 * Reconstrói o conjunto de uma mídia salva antes desta feature (FR-023).
 *
 * `looks` ausente significa "não sei", não "não há" — então o que se devolve é
 * o conjunto base da vibe, com o tratamento que a mídia realmente tinha na
 * frente. Sem inventar sugestões que nunca existiram.
 */
export function looksDeMidiaAntiga(
  filtroId: FilterId | null,
  vibeId: VibeId,
): { looks: LookRecipe[]; escolhido: LookRecipe | null } {
  const base = looksBase(vibeId);
  if (!filtroId) return { looks: base.slice(0, TOTAL_LOOKS), escolhido: null };

  const jaEsta = base.find((l) => l.base === filtroId);
  const escolhido: LookRecipe = jaEsta ?? {
    base: filtroId,
    ajustes: {},
    nome: filterById(filtroId).nome,
    justificativa: 'o tratamento com que esta foto foi salva',
    papel: 'certeira',
  };
  const resto = base.filter((l) => l.base !== filtroId);
  return { looks: [escolhido, ...resto].slice(0, TOTAL_LOOKS), escolhido };
}

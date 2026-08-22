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
import { AjustesLook, FilterDef, FilterId, LookRecipe, PapelLook, VibeId } from '@/types';

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
const PAPEIS_PEDIDOS: PapelLook[] = ['certeira', 'ousada', 'ousada'];

/**
 * Desvio mínimo que separa um look do preset de onde ele parte (T105).
 *
 * O Gemini às vezes devolve `ajustes` todos em zero — e um look sem desvio é o
 * preset puro com outro nome: ele ocupa um dos três lugares do carrossel
 * repetindo uma miniatura que já está ali ao lado, e a sugestão perde o
 * sentido. Como pedir de novo custaria outra ida à rede (e a pessoa não pode
 * esperar), o desvio é aplicado **aqui**, localmente e de graça.
 *
 * Os valores são pequenos de propósito: o suficiente para a miniatura ler como
 * tratamento próprio, longe de desfigurar a foto. `certeira` recebe menos que
 * `ousada` — é o papel que promete "realça o que a cena já tem".
 */
const DESVIO_MINIMO: Record<PapelLook, Partial<Record<'brilho' | 'saturacao' | 'contraste', number>>> =
  {
    certeira: { saturacao: 0.08, contraste: 0.06 },
    ousada: { saturacao: 0.18, contraste: 0.12, brilho: -0.06 },
    // Nunca chega do modelo (é rótulo local), mas o tipo exige — e se um dia
    // chegar, trata-se como certeira.
    afinidade: { saturacao: 0.08, contraste: 0.06 },
  };

/**
 * Nome autoral de cada preset, por papel (T107).
 *
 * Existe porque a alternativa era pior: sufixar o preset ("Neon Livre", "Vivid
 * Suave") produz rótulo de sistema, e o público deste app lê nome de filtro
 * como identidade — "Neon Livre" não é nome que ninguém escolhe, é nome que
 * alguém gerou. Como estes rótulos só aparecem quando o Gemini **não** deu
 * nome (falha de rede, chave ausente, resposta sem `nome`), eles precisam
 * segurar a tela sozinhos.
 *
 * Duas palavras no máximo, sempre evocando o que o tratamento faz com a foto —
 * a mesma régua que o prompt pede ao modelo.
 */
const NOME_AUTORAL: Record<string, { certeira: string; ousada: string }> = {
  vivid: { certeira: 'Verão Claro', ousada: 'Sol Alto' },
  neon: { certeira: 'Luz Urbana', ousada: 'Madrugada Neon' },
  love: { certeira: 'Rubor', ousada: 'Coração Quente' },
  eclipse: { certeira: 'Meia-Luz', ousada: 'Eclipse Total' },
  retro: { certeira: 'Fita Velha', ousada: 'Anos Dourados' },
  vintage: { certeira: 'Papel Antigo', ousada: 'Memória Rara' },
  arctic: { certeira: 'Ar Frio', ousada: 'Gelo Puro' },
  honey: { certeira: 'Mel Suave', ousada: 'Hora Dourada' },
};

/** Nome autoral do preset para aquele papel; cai no nome do preset se faltar. */
function nomeAutoral(base: FilterId, papel: PapelLook): string {
  const par = NOME_AUTORAL[base];
  if (!par) return filterById(base).nome;
  return papel === 'certeira' ? par.certeira : par.ousada;
}

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
function nomeDeAfinidade(nomeSalvo: string | undefined, base: FilterId): string {
  const nome = (nomeSalvo ?? '').trim();
  if (!nome) return nomeAutoral(base, 'certeira');
  const preset = filterById(base).nome.toLowerCase();
  const cru = nome.toLowerCase();
  // "Neon", "Neon Livre", "Neon Suave" — todos são o preset com etiqueta.
  const etiquetado =
    cru === preset || cru === `${preset} livre` || cru === `${preset} suave`;
  return etiquetado ? nomeAutoral(base, 'certeira') : nome;
}

export function lookDeAfinidade(): LookRecipe | null {
  // Sem recorte por vibe desde a feature 005 (D3): com vibe livre não há chave
  // por onde recortar, e o limiar passou a valer sobre o histórico inteiro.
  const preferido = useLookTasteStore.getState().preferido();
  // "Sem tratamento" é uma preferência legítima, mas não vira sugestão de look:
  // a foto original já está sempre disponível no carrossel dos presets, e um
  // chip "Original" no lugar de uma sugestão gastaria um dos três slots com o
  // que a pessoa já tem a um toque de distância.
  if (!preferido || preferido.base === null) return null;

  return {
    base: preferido.base,
    ajustes: preferido.ajustes ?? {},
    // O histórico guarda o nome com que o look foi escolhido — inclusive os
    // rótulos antigos, no formato "<Preset> Livre"/"<Preset> Suave", que esta
    // feature aposentou (T107). Deixá-los passar traria "Love Livre" de volta à
    // tela por um caminho lateral, meses depois. Nome que ainda carrega o
    // padrão velho é reescrito no autoral do preset; nome do próprio Gemini
    // ("Ciber Samurai") passa intacto, que é o caso comum.
    nome: nomeDeAfinidade(preferido.nome, preferido.base),
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

  const nomePreset = filterById(o.base).nome;
  const nomeBruto = typeof o.nome === 'string' ? o.nome.trim() : '';
  const nome = nomeBruto || nomePreset;

  /**
   * Um look tem de ser diferente do preset de que parte (T105).
   *
   * `clampAjustes` já devolve `{}` quando o modelo manda ajustes inválidos ou
   * todos em zero — e nesse caso a receita renderiza **idêntica** ao preset,
   * que na prática é o preset repetido no carrossel com outro rótulo. Em vez de
   * pedir de novo ao Gemini (outra ida à rede, com a pessoa esperando), aplica-
   * se aqui o desvio mínimo do papel: sai de graça, na hora, e o look passa a
   * valer o lugar que ocupa.
   */
  const ajustes = clampAjustes(o.ajustes);
  const semDesvio = Object.values(ajustes).every((v) => !v);
  const ajustesFinais = semDesvio ? { ...DESVIO_MINIMO[papel] } : ajustes;

  return {
    base: o.base,
    ajustes: ajustesFinais,
    // Nome igual ao do preset apagaria a diferença que o desvio acabou de
    // criar: a miniatura diria "Neon" ao lado do Neon de verdade. O sufixo é
    // discreto e mantém a leitura de "variação disto aqui".
    // Nome igual ao do preset apagaria a diferença que o desvio acabou de criar
    // — a miniatura diria "Neon" ao lado do Neon de verdade. Cai no nome
    // autoral do par (base, papel), nunca num sufixo genérico.
    nome: nome.toLowerCase() === nomePreset.toLowerCase() ? nomeAutoral(o.base, papel) : nome,
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
    // Mesmo desvio mínimo dos looks do modelo (T105): a reserva também entra no
    // carrossel ao lado dos oito presets, e sem desvio ela seria a miniatura do
    // preset repetida — foi assim que um chip "NEON" apareceu entre as
    // sugestões, do lado do NEON de verdade.
    ajustes: { ...DESVIO_MINIMO[(i === 0 ? 'certeira' : 'ousada') as PapelLook] },
    // Pelo mesmo motivo, o rótulo é o nome autoral do par (base, papel): tem de
    // dizer que aquilo é uma leitura do preset, sem virar "Neon Livre".
    nome: nomeAutoral(base, (i === 0 ? 'certeira' : 'ousada') as PapelLook),
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

  const afinidade = lookDeAfinidade();
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

/**
 * Matriz de cor do Skia (feature 003, US3, research R3).
 *
 * Uma matriz de cor 4×5 (RGBA + offset) representa uma transformação afim:
 * `saida = M · entrada`. Compor duas transformações em série — aplicar B e
 * depois A — é multiplicar as matrizes: `M = A · B`. É isto que permite
 * combinar saturação, contraste, brilho e sepia numa matriz só, em vez de
 * quatro filtros encadeados no Canvas (um passe de GPU em vez de quatro).
 *
 * As linhas ficam concatenadas: índices `[0..4]` = R, `[5..9]` = G,
 * `[10..14]` = B, `[15..19]` = A. Skia opera em ponto flutuante 0–1, não em
 * 0–255 — por isso o offset do contraste é `0.5`, não `127.5`.
 */
type MatrizCor = number[];

function identidadeCor(): MatrizCor {
  // prettier-ignore
  return [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** `M = a · b`, ou seja: aplica `b` e depois `a`. */
function multiplicarMatrizesCor(a: MatrizCor, b: MatrizCor): MatrizCor {
  const linha = (m: MatrizCor, i: number) => m.slice(i * 5, i * 5 + 5);
  const resultado: number[] = [];
  for (let i = 0; i < 4; i++) {
    const la = linha(a, i);
    for (let j = 0; j < 4; j++) {
      let soma = 0;
      for (let k = 0; k < 4; k++) soma += la[k] * b[k * 5 + j];
      resultado.push(soma);
    }
    let offset = la[4];
    for (let k = 0; k < 4; k++) offset += la[k] * b[k * 5 + 4];
    resultado.push(offset);
  }
  return resultado;
}

/** Pesos de luminância padrão (Rec. 601), a mesma base de todo filtro CSS/SVG de saturação. */
function matrizSaturacao(s: number): MatrizCor {
  const [lr, lg, lb] = [0.213, 0.715, 0.072];
  // prettier-ignore
  return [
    lr + (1 - lr) * s, lg - lg * s,       lb - lb * s,       0, 0,
    lr - lr * s,        lg + (1 - lg) * s, lb - lb * s,       0, 0,
    lr - lr * s,        lg - lg * s,       lb + (1 - lb) * s, 0, 0,
    0,                   0,                 0,                 1, 0,
  ];
}

/** Escala em torno do cinza médio (research R3): `c` na diagonal, offset `0.5·(1-c)`. */
function matrizContraste(c: number): MatrizCor {
  const t = 0.5 * (1 - c);
  // prettier-ignore
  return [
    c, 0, 0, 0, t,
    0, c, 0, 0, t,
    0, 0, c, 0, t,
    0, 0, 0, 1, 0,
  ];
}

/** Escala uniforme na diagonal — sem offset, então preto continua preto. */
function matrizBrilho(b: number): MatrizCor {
  // prettier-ignore
  return [
    b, 0, 0, 0, 0,
    0, b, 0, 0, 0,
    0, 0, b, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

// prettier-ignore
const SEPIA_CLASSICA: MatrizCor = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0,     0,     0,     1, 0,
];

/** Interpola entre identidade e a matriz sepia clássica pelo fator (research R3). */
function matrizSepia(f: number): MatrizCor {
  if (f <= 0) return identidadeCor();
  const id = identidadeCor();
  return id.map((v, i) => v * (1 - f) + SEPIA_CLASSICA[i] * f);
}

/**
 * Converte um `FilterDef` já resolvido (`resolverReceita()` ou `filterById()`)
 * na matriz de cor 20 floats que o `Skia.ColorFilter.MakeMatrix` espera.
 *
 * Opera sobre o `FilterDef` resolvido, não sobre o `LookRecipe` cru: é o
 * denominador comum entre um look com receita e um dos 8 presets escolhido
 * puro, e os dois já passam pela mesma barreira de clamp antes de chegar aqui.
 *
 * Ordem de composição (research R3): saturação → contraste → brilho → sepia.
 * O overlay de cor do preset **não** entra na matriz — vira um `Skia.Paint`
 * desenhado por cima, por quem chama (`renderLook.ts`, `FilteredImage.tsx`).
 */
export function matrizDeCor(filtro: FilterDef): number[] {
  const f = filtro.imageFilter ?? {};
  let m = matrizSaturacao(f.saturate ?? 1);
  m = multiplicarMatrizesCor(matrizContraste(f.contrast ?? 1), m);
  m = multiplicarMatrizesCor(matrizBrilho(f.brightness ?? 1), m);
  m = multiplicarMatrizesCor(matrizSepia(f.sepia ?? 0), m);
  return m;
}

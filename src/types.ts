export type FilterId =
  | 'vivid'
  | 'neon'
  | 'love'
  | 'eclipse'
  | 'retro'
  | 'vintage'
  | 'arctic'
  | 'honey';

export type VibeId =
  | 'energetica'
  | 'sonhadora'
  | 'romantica'
  | 'noturna'
  | 'nostalgica'
  | 'aconchegante'
  | 'gelada'
  | 'dourada';

export interface FilterDef {
  id: FilterId;
  nome: string;
  emoji: string;
  /** Cor do overlay aplicado sobre o visor/foto */
  overlayColor: string;
  overlayOpacity: number;
  /** Segundo overlay (gradiente simulado) — opcional */
  overlayColor2?: string;
  overlayOpacity2?: number;
  /**
   * Filtros de estilo do RN (new arch). Android suporta todos;
   * iOS aplica apenas brightness — o overlay garante a identidade visual.
   */
  imageFilter?: { brightness?: number; saturate?: number; contrast?: number; sepia?: number };
}

/**
 * Papel do look dentro do conjunto de três (feature 003). Mesma razão de ser do
 * `PapelFaixa`: sem rótulo, uma sugestão fora do óbvio chega como defeito em vez
 * de proposta — e a que vem do histórico não teria como se apresentar.
 *
 * - `afinidade` — casa com o histórico visual **deste aparelho**; derivado
 *                 localmente em `looks.ts`, nunca pedido ao Gemini (D3/FR-013).
 * - `certeira`  — realça o que a cena já tem, sem risco.
 * - `ousada`    — interpretação mais forte, ainda plausível.
 *
 * São três, contra os quatro da música: a spec dispensa os equivalentes visuais
 * de `descoberta` e `curinga`.
 */
export type PapelLook = 'afinidade' | 'certeira' | 'ousada';

/**
 * Desvios em relação ao preset base. **Deltas, nunca valores absolutos** — é o
 * que faz toda sugestão pousar num lugar são: o pior caso vira o preset puro,
 * jamais uma imagem quebrada (D2).
 *
 * Ausente = 0 = "não desvia neste eixo". Faixas seguras em `looks.ts`.
 */
export interface AjustesLook {
  brilho?: number;
  saturacao?: number;
  contraste?: number;
  sepia?: number;
  /** Desvio da opacidade do overlay de cor do preset. */
  veu?: number;
}

/**
 * Um tratamento visual proposto para uma foto específica: **receita ancorada**,
 * não conjunto de números soltos.
 *
 * `base` é obrigatório de propósito. Um look sem âncora reconhecível é
 * descartado, não corrigido — é o que dá explicabilidade de graça ("é o Honey,
 * um pouco mais quente") e o que garante que a degradação sempre tem para onde
 * cair (FR-008).
 */
export interface LookRecipe {
  base: FilterId;
  ajustes: AjustesLook;
  /** Curto — cabe no chip. */
  nome: string;
  /** Uma linha, como as faixas já têm. */
  justificativa: string;
  papel: PapelLook;
}

export interface Vibe {
  id: VibeId;
  nome: string;
  emoji: string;
  /** Filtro sugerido automaticamente para esta vibe */
  filtro: FilterId;
  /** Palavras-chave para a curadoria musical (Deezer/Gemini) */
  musicaKeywords: string[];
  descricao: string;
}

/**
 * Papel da faixa dentro do conjunto de quatro (T058). Existe para que uma
 * sugestão fora do óbvio chegue como **proposta** e não como erro: sem rótulo,
 * um artista desconhecido no meio de três hits parece defeito da curadoria.
 *
 * - `afinidade`  — casa com o histórico de escolhas **do próprio aparelho**;
 *                  derivado localmente, nunca pedido ao Gemini (ver D7).
 * - `certeira`   — combina com a cena, sem risco.
 * - `descoberta` — artista pouco conhecido, conferido pelo `nb_fan` no T059.
 * - `curinga`    — livre, pode ser inesperada.
 */
export type PapelFaixa = 'afinidade' | 'certeira' | 'descoberta' | 'curinga';

export interface MusicSuggestion {
  id: string;
  titulo: string;
  artista: string;
  emoji: string;
  justificativa: string;
  /** URL de preview (30s) — Deezer */
  previewUrl: string | null;
  origem: 'deezer' | 'gemini' | 'local';
  /** Ausente nas faixas do catálogo local e do Deezer puro. */
  papel?: PapelFaixa;
  /**
   * Id do artista no Deezer, quando a faixa foi resolvida lá. É o que permite
   * conferir `nb_fan` sem cair em homônimo — ver `verificarDescobertas`.
   */
  artistaId?: number;
  /** Gênero informado pelo Gemini (T074) — alimenta o histórico de gosto. */
  genero?: string;
}

/**
 * Enquadramentos que o visor oferece (T066). O app forçava um só — 735/913 do
 * Figma —, e forçar enquadramento é decisão que pertence a quem fotografa.
 */
export type EnquadramentoId = '1:1' | '4:3' | '16:9';

export interface Media {
  id: string;
  /** URI persistente da foto (documentDirectory) */
  photoUri: string;
  /** null = foto original, sem filtro (T-0B) */
  filtroId: FilterId | null;
  vibeId: VibeId;
  musica: MusicSuggestion | null;
  /** Trecho da música em segundos (0–30) */
  trechoInicio: number;
  trechoFim: number;
  /**
   * Proporção largura/altura da foto (T066). **Opcional de propósito**: as
   * mídias salvas antes do enquadramento variável não têm o campo, e não podem
   * quebrar — quem lê usa `media.aspecto ?? sizes.photoAspect`, que é
   * exatamente o valor com que elas foram criadas.
   */
  aspecto?: number;
  /**
   * As quatro sugestões que a curadoria produziu para esta foto (T083).
   *
   * Guardar só a faixa escolhida fazia a decisão inteira se perder: reabrir a
   * mídia trazia `sugestoes: []`, e o app saía chamando o Gemini de novo para
   * um pacote que já estava fechado — cobrando rede, tempo e uma vibe
   * recalculada por cima da que estava salva.
   *
   * Opcional pelo mesmo motivo de `aspecto`: as mídias gravadas antes disto não
   * têm o campo, e a ausência significa "não sei", nunca "não há".
   */
  sugestoes?: MusicSuggestion[];
  /**
   * As três sugestões de look produzidas para esta foto (feature 003), e qual
   * delas foi ao ar.
   *
   * Opcionais pelo mesmo motivo de `aspecto` e `sugestoes`: mídias gravadas
   * antes desta feature não têm o campo, e ausência significa "não sei", nunca
   * "não há" — quem lê reconstrói três looks base a partir de `filtroId` e
   * `vibeId` (FR-023).
   *
   * `filtroId` continua existindo e continua sendo a âncora: escolher um look
   * move os dois juntos, e é ele que o visor ao vivo usa (FR-021).
   */
  looks?: LookRecipe[];
  lookEscolhido?: LookRecipe;
  /**
   * Cópia local do .mp3 da prévia, em `documentDirectory/galeria/` (T102).
   *
   * `musica.previewUrl` é um link do Deezer: expira e exige rede a cada
   * reabertura. Guardar só ele fazia o player de uma mídia reaberta ficar
   * carregando para sempre — metade do momento sumia com o tempo, contra o
   * Pilar 3. O arquivo local é o que faz a trilha voltar, inclusive offline.
   *
   * Opcional pelo mesmo motivo de `aspecto`, `sugestoes` e `looks`: mídias
   * gravadas antes disto não têm o campo, e ausência significa "não sei" —
   * quem lê cai de volta na URL remota (ver `fonteDeAudio`).
   */
  audioUri?: string;
  criadaEm: number;
  atualizadaEm: number;
}

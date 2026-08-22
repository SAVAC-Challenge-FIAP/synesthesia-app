import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { FILTERS } from '@/constants/filters';
import { VIBES } from '@/constants/vibes';
import { montarLooks } from '@/services/looks';
import { chaveDaFaixa, useTasteStore } from '@/stores/useTasteStore';
import { LookRecipe, MusicSuggestion, PapelFaixa, Vibe, VibeId } from '@/types';

/**
 * Curadoria musical — até 4 sugestões por vibe (FR-005) — e análise de cena.
 *
 * Caminho principal (T-0A/T-0B): a própria foto capturada vai ao Gemini
 * multimodal, que infere a vibe REAL da cena e sugere as faixas numa só
 * chamada (`analyzePhotoAndSuggest`). Sem sorteio: mesma foto → mesma vibe.
 *
 * Pipeline de degradação graciosa (NFR/edge cases da spec):
 * 1. Gemini com foto (vibe + faixas) — requer EXPO_PUBLIC_GEMINI_API_KEY;
 * 2. Gemini só-texto a partir da vibe (`getSuggestions`);
 * 3. Deezer (API pública, sem chave) resolve cada faixa com preview real de 30s;
 * 4. Sem rede/sem resultados → catálogo local (herdado do musicas.json do MVP
 *    Python), sem bloquear o salvamento da foto.
 */

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

/**
 * Limites de rede. Medindo o T020 no aparelho, a chamada ao Gemini variou de
 * **2,9s a 123s** com a mesma foto e a mesma rede — e sem `AbortController` a
 * requisição de 123s continuava viva muito depois de o usuário desistir.
 *
 * O teto do Gemini é menor que os 30s que a interface espera (`CaptureSheet`),
 * de propósito: assim a degradação graciosa (vibe → Deezer → catálogo local)
 * ainda roda dentro da janela e o usuário recebe alguma trilha, em vez de a
 * interface simplesmente desistir com a requisição pendurada.
 */
const LIMITE_GEMINI_MS = 22_000;
const LIMITE_DEEZER_MS = 8_000;

/** `fetch` que realmente desiste — sem isso uma resposta lenta nunca é abandonada. */
async function fetchComLimite(
  url: string,
  init: RequestInit,
  limiteMs: number,
): Promise<Response> {
  const abortador = new AbortController();
  const timer = setTimeout(() => abortador.abort(), limiteMs);
  try {
    return await fetch(url, { ...init, signal: abortador.signal });
  } finally {
    clearTimeout(timer);
  }
}

const EMOJIS_MOOD = ['🎧', '🎸', '🎹', '🎷', '🥁', '🎻'];

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: { id: number; name: string };
}

async function searchDeezer(
  query: string,
  limit: number,
  index = 0,
): Promise<DeezerTrack[]> {
  const res = await fetchComLimite(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&index=${index}`,
    {},
    LIMITE_DEEZER_MS,
  );
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  const json = (await res.json()) as { data?: DeezerTrack[] };
  return (json.data ?? []).filter((t) => !!t.preview);
}

/**
 * Teto de fãs no Deezer para uma faixa poder se chamar `descoberta` (T059).
 *
 * O T058 mandava começar em ~1.000.000 e ajustar medindo — medido, 1.000.000 é
 * permissivo demais. O `nb_fan` do Deezer conta quem favoritou o artista, não
 * quem ouve, e a escala fica comprimida: M83 tem 964.578 e Kavinsky 491.886, ou
 * seja, os dois artistas que o T056 pegou repetindo em 4/4 rodadas passariam
 * como "descoberta" a 1.000.000.
 *
 * Em 250.000 a separação bate com a intuição: ficam de fora M83, Kavinsky
 * (491.886), Yann Tiersen (598.035), Beach House (294.372), The xx (1.101.216) e
 * The Cure (2.518.360); entram Mr.Kitty (51.085), JVKE (141.826), Mariya
 * Takeuchi (11.854) e HOME (1.630).
 */
const LIMITE_DESCOBERTA_FAS = 250_000;

/** `nb_fan` por artista, com cache — a mesma curadoria consulta poucos ids. */
const fansPorArtista = new Map<number, number>();

async function fansDoArtista(artistId: number): Promise<number | null> {
  const cacheado = fansPorArtista.get(artistId);
  if (cacheado !== undefined) return cacheado;
  try {
    const res = await fetchComLimite(
      `https://api.deezer.com/artist/${artistId}`,
      {},
      LIMITE_DEEZER_MS,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { nb_fan?: number };
    const fas = json.nb_fan ?? null;
    if (fas !== null) fansPorArtista.set(artistId, fas);
    return fas;
  } catch {
    return null;
  }
}

function normalizarNome(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|feat|ft)\b/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

/** Compara nomes de artista com folga — acentos, "&"/"and", "The" solto. */
function mesmoArtista(a: string, b: string): boolean {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Igualdade textual frouxa — pega o titulo que e so a keyword da busca. */
function mesmoTexto(a: string, b: string): boolean {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  return !!x && !!y && x === y;
}

/**
 * Artistas que não são artistas: compilações, karaokê, playback, "tributos".
 *
 * A busca por keyword do Deezer é dominada por eles — o T056 colheu "Chakra
 * Healing Music Academy", "Fred's Dance Instrumentals" e "Top 40 Pop Hits" numa
 * só rodada. Não é um problema de repetição, é de curadoria: nenhuma dessas
 * faixas seria escolhida por alguém, e elas ocupam o lugar de quem seria.
 */
const ARTISTA_DE_CATALOGO =
  /(karaok|tribute|playback|cover band|instrumentals?\b|various artists|top \d+|hits\b|\bacademy\b|compilation|made famous by|as made popular|backing track|ringtones?\b|\bmix\b|\bdj regaeton\b)/i;

/**
 * Faixa boa o bastante para virar sugestão vinda da busca por keyword.
 *
 * O padrão é testado no **título também**, e não só no artista: o Deezer tem
 * "Energetic Electro Pop Alarm Ringtone Instrumental" assinado por um artista de
 * nome inocente. O lixo aparece nos dois campos.
 */
function faixaAproveitavel(t: DeezerTrack, vibe: Vibe): boolean {
  // O título é a própria keyword: «funk brasileiro — RVDENT», três variações de
  // «Dream Pop — Earth Trax». Ruído de catálogo, não música curada.
  if (vibe.musicaKeywords.some((kw) => mesmoTexto(t.title, kw))) return false;
  if (ARTISTA_DE_CATALOGO.test(t.artist.name)) return false;
  if (ARTISTA_DE_CATALOGO.test(t.title)) return false;
  // Título quilométrico é sinal de faixa de coletânea erudita/militar, que a
  // paginação profunda trouxe à tona ("The Jacobite Sword Dance: ...").
  if (t.title.length > 60) return false;
  return true;
}

interface GeminiTrackIdea {
  titulo: string;
  artista: string;
  justificativa: string;
  papel?: string;
  genero?: string;
}

/**
 * Composição do conjunto final (T073, pedido do Sávio): **2 `certeira`,
 * 1 `curinga`, 1 `descoberta`**.
 *
 * O T058 tinha posto duas `descoberta`, decisão minha para atacar a repetição.
 * Funcionou demais na diversidade e de menos na pertinência — "as músicas estão
 * nada a ver". Duas certeiras seguram o conjunto no lugar; a descoberta continua
 * lá, mas como tempero, não como metade do prato.
 */
const SLOTS: Record<PapelFaixa, number> = {
  certeira: 2,
  curinga: 1,
  descoberta: 1,
  afinidade: 0, // derivado localmente, nunca pedido ao modelo
};

/**
 * Quantas candidatas pedir por papel — mais do que os slots, de propósito (T072).
 *
 * "as músicas frequentemente estão vindo desabilitadas isso não pode acontecer".
 * Faixa sem `previewUrl` chega muda: aparece na lista com o play apagado e não dá
 * para ouvir antes de escolher. Pedindo folga, as que não resolvem no Deezer são
 * simplesmente descartadas e o slot é preenchido pela próxima do mesmo papel —
 * sem uma segunda ida ao Gemini, que custaria latência no caminho crítico.
 *
 * A folga é maior na `descoberta` porque é justamente ela que mais falha: quanto
 * mais obscuro o artista, menor a chance de o Deezer o ter.
 */
const CANDIDATAS: Record<string, number> = { certeira: 3, curinga: 2, descoberta: 4 };

const TOTAL_CANDIDATAS = Object.values(CANDIDATAS).reduce((a, b) => a + b, 0);

const PAPEIS_VALIDOS: readonly string[] = ['certeira', 'descoberta', 'curinga'];

/** Ordem em que os papéis são pedidos, repetindo conforme `CANDIDATAS`. */
const PAPEIS_PEDIDOS: PapelFaixa[] = [
  ...Array<PapelFaixa>(CANDIDATAS.certeira).fill('certeira'),
  ...Array<PapelFaixa>(CANDIDATAS.curinga).fill('curinga'),
  ...Array<PapelFaixa>(CANDIDATAS.descoberta).fill('descoberta'),
];

/**
 * Preferências aprendidas, para o prompt (T074).
 *
 * O Sávio pediu explicitamente que a curadoria aprenda — "eu gosto de rock então
 * provavelmente tínhamos que ir entendendo que ele vai ter preferências por rock,
 * metal e por uma banda tipo um Skillet". Isso **resolve a D7 por decisão dele**:
 * o gosto passa a entrar no pedido ao Gemini.
 *
 * O gênero vem primeiro por ser o que generaliza: o artista não se repete, o
 * gênero sim.
 */
function preferenciasAprendidas(): string {
  const estado = useTasteStore.getState();
  const generos = estado.generosFrequentes(3);
  const artistas = estado.artistasFrequentes(4);
  if (generos.length === 0 && artistas.length === 0) return '';
  const partes: string[] = [];
  if (generos.length) partes.push(`gosta de ${generos.join(', ')}`);
  if (artistas.length) partes.push(`já escolheu ${artistas.join(', ')}`);
  return (
    `Esta pessoa ${partes.join(' e ')}. Leve isso em conta nas "certeira", ` +
    `sem repetir os mesmos artistas. `
  );
}

/**
 * Instrução comum aos dois prompts. Concentrada aqui porque a lição do T056 foi
 * exatamente que uma palavra solta ("populares") num prompt duplicado governa o
 * resultado inteiro — duplicar a regra é duplicar o risco de ela divergir.
 */
function instrucaoDeCuradoria(bloqueio: string[]): string {
  const papeis =
    `Devolva ${TOTAL_CANDIDATAS} faixas, nesta ordem de papéis no campo "papel": ` +
    `${CANDIDATAS.certeira}x "certeira" (faixas CONHECIDAS e queridas que combinam com a cena), ` +
    `${CANDIDATAS.curinga}x "curinga" (livre, pode surpreender), ` +
    `${CANDIDATAS.descoberta}x "descoberta" (artista pouco conhecido, fora do mainstream). `;
  const genero =
    `Informe também o campo "genero" de cada faixa, em uma ou duas palavras ` +
    `(ex.: "rock", "metal", "mpb", "synthwave"). `;
  const existir =
    `Só sugira faixas que existam de verdade e sejam encontráveis em serviços de ` +
    `streaming, com o nome exato do artista principal. `;
  const variacao =
    `Varie época, idioma e país de origem entre elas. `;
  const naoRepita = bloqueio.length
    ? `NÃO sugira nenhuma destas, já usadas recentemente: ${bloqueio.join('; ')}. `
    : '';
  return papeis + genero + existir + variacao + preferenciasAprendidas() + naoRepita;
}

/** Aceita só os papéis que o modelo tinha permissão de usar. */
function papelDe(idea: GeminiTrackIdea, i: number): PapelFaixa {
  const bruto = idea.papel?.trim().toLowerCase();
  if (bruto && PAPEIS_VALIDOS.includes(bruto)) return bruto as PapelFaixa;
  // Sem papel utilizável, vale a posição pedida: o prompt fixa a ordem.
  return PAPEIS_PEDIDOS[i] ?? 'curinga';
}

// Modelo com cota disponível no tier gratuito do AI Studio (gemini-3.5-flash e
// gemini-3.1-pro-preview retornam 429 "not enough quota" em contas novas sem billing).
// Aceita imagem de entrada (multimodal): Text, Image, Video, Audio e PDF.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

type GeminiPart = { type: 'text'; text: string } | { type: 'image'; data: string; mime_type: string };

// Interactions API (endpoint atual — o antigo v1beta/models/{model}:generateContent está deprecado)
async function callGemini(input: GeminiPart[]): Promise<string> {
  if (!GEMINI_KEY) return '';
  const res = await fetchComLimite(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({ model: GEMINI_MODEL, input }),
    },
    LIMITE_GEMINI_MS,
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  return (
    json?.steps?.find((s: { type: string }) => s.type === 'model_output')?.content?.[0]?.text ?? ''
  );
}

async function askGemini(vibe: Vibe): Promise<GeminiTrackIdea[]> {
  if (!GEMINI_KEY) return [];
  // Aqui a vibe já é conhecida, então a lista de bloqueio pode ser a dela.
  const bloqueio = useTasteStore.getState().faixasSugeridasRecentes(vibe.id, 20);
  const prompt =
    `Você é o curador musical do app Synesthesia. A foto tem a vibe "${vibe.nome}" (${vibe.descricao}). ` +
    `Sugira músicas reais que combinem. ` +
    instrucaoDeCuradoria(bloqueio) +
    `Responda SOMENTE JSON: ` +
    `[{"titulo":"...","artista":"...","papel":"...","genero":"...","justificativa":"até 12 palavras, em pt-BR"}]`;
  const text = await callGemini([{ type: 'text', text: prompt }]);
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]) as GeminiTrackIdea[];
}

/** Largura e compressão do envio ao Gemini — ver T021 em baseline.md. */
const ENVIO_LARGURA = 448;
const ENVIO_COMPRESSAO = 0.45;

/**
 * Reduz a foto para envio ao Gemini: corta tráfego sem perder o que importa
 * para inferir a atmosfera.
 */
async function photoToBase64(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: ENVIO_LARGURA });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: ENVIO_COMPRESSAO,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!saved.base64) throw new Error('manipulator sem base64');
  return saved.base64;
}

/**
 * Trecho de look da resposta (feature 003) — contrato em
 * `specs/003-looks-sugeridos/contracts/gemini-look.md`.
 *
 * Todos os campos são opcionais **de propósito**: o tipo descreve o que chega,
 * não o que deveria chegar, e o que chega de um modelo às vezes não obedece. A
 * obrigatoriedade real é imposta por `receitaDeIdeia()`, em `looks.ts`.
 */
interface GeminiLookIdea {
  base?: string;
  nome?: string;
  papel?: string;
  justificativa?: string;
  ajustes?: Record<string, unknown>;
}

interface GeminiSceneResult {
  vibe: string;
  cena?: string;
  musicas?: GeminiTrackIdea[];
  looks?: GeminiLookIdea[];
}

/**
 * Instrução do trecho visual. Pede **desvio a partir de um preset nomeado**, e
 * nunca valores absolutos: assim o modelo pousa sempre num lugar são e o pior
 * caso possível é "o preset puro", que é um resultado bom (D2).
 *
 * `afinidade` não está na lista de papéis. O modelo não viu o histórico do
 * aparelho — e não vai ver (FR-014) —, então esse rótulo é montado localmente.
 */
function instrucaoDeLook(): string {
  const presets = FILTERS.map((f) => f.id).join(', ');
  return (
    `Proponha também 3 tratamentos visuais (looks) para esta foto. Cada look PARTE ` +
    `de um destes presets e informa apenas o DESVIO em relação a ele: ${presets}. ` +
    `Papéis, nesta ordem: 1x "certeira" (realça o que a cena já tem), ` +
    `1x "ousada" (interpretação mais forte, ainda plausível), ` +
    `1x "ousada" LIVRE (a leitura mais autoral que a cena permitir — escolha o ` +
    `preset de partida que quiser e desvie dele com liberdade). ` +
    `Os ajustes são deltas entre -0.5 e 0.5. ` +
    // O que dá sentido à sugestão é ela ser DIFERENTE do que a pessoa já tem
    // no carrossel (T105, pedido do Sávio). Um look devolvido com todos os
    // ajustes em zero é o preset puro repetido com outro nome: ocupa um dos
    // três lugares sem oferecer nada. A regra é dita aqui e **imposta** em
    // `receitaDeIdeia`, porque instrução em prompt é pedido, não garantia.
    `REGRA: nenhum look pode ser igual ao preset de partida. Todo look precisa ` +
    `de pelo menos um ajuste diferente de zero. ` +
    // O nome é o que a pessoa lê na miniatura — é identidade, não etiqueta.
    // Sem esta régua o modelo devolve "Neon Variação", "Vivid Forte" e afins,
    // que leem como rótulo de sistema (T107).
    `O "nome" tem NO MÁXIMO 2 palavras, em pt-BR, e evoca a SENSAÇÃO da imagem ` +
    `tratada ("Hora Dourada", "Luz Urbana", "Fita Velha"). Nunca use o nome do ` +
    `preset, nem palavras genéricas como "livre", "suave", "forte" ou "variação". `
  );
}

/** Foto → vibe real + faixas, numa única chamada multimodal (T-0A + T-0B). */
async function askGeminiWithPhoto(photoBase64: string): Promise<GeminiSceneResult | null> {
  if (!GEMINI_KEY) return null;
  const vibesDisponiveis = VIBES.map((v) => `"${v.id}" (${v.descricao})`).join(', ');
  // A vibe ainda não existe neste ponto — é o próprio Gemini que a classifica —,
  // então o bloqueio é o global: "não repita o que você acabou de sugerir".
  const bloqueio = useTasteStore.getState().faixasSugeridasGlobais(20);
  const prompt =
    `Você é o motor sensorial do app Synesthesia. Analise a foto anexada e: ` +
    `1) classifique a atmosfera da cena em EXATAMENTE UMA destas vibes: ${vibesDisponiveis}; ` +
    `2) sugira músicas reais que combinem com o que aparece na foto. ` +
    instrucaoDeCuradoria(bloqueio) +
    instrucaoDeLook() +
    `Responda SOMENTE JSON: {"vibe":"<id da vibe>","cena":"o que há na foto, até 10 palavras", ` +
    `"musicas":[{"titulo":"...","artista":"...","papel":"...","genero":"...","justificativa":"até 12 palavras, em pt-BR, ligada à cena"}], ` +
    `"looks":[{"base":"<preset>","nome":"até 2 palavras","papel":"certeira|ousada",` +
    `"justificativa":"até 10 palavras, em pt-BR, ligada à cena",` +
    `"ajustes":{"brilho":0,"saturacao":0,"contraste":0,"sepia":0,"veu":0}}]}`;
  const text = await callGemini([
    { type: 'text', text: prompt },
    { type: 'image', data: photoBase64, mime_type: 'image/jpeg' },
  ]);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]) as GeminiSceneResult;
}

/** Catálogo offline — última linha de defesa (nunca perder a captura). */
const FALLBACK: Record<string, Omit<MusicSuggestion, 'id' | 'origem'>[]> = {
  energetica: [
    { titulo: 'Envolver', artista: 'Anitta', emoji: '⚡', justificativa: 'Batida intensa para cenas cheias de energia', previewUrl: null },
    { titulo: 'Blinding Lights', artista: 'The Weeknd', emoji: '🎧', justificativa: 'Synths acelerados, movimento puro', previewUrl: null },
    { titulo: 'Bagulho Doido', artista: 'BaianaSystem', emoji: '🥁', justificativa: 'Percussão baiana em alta rotação', previewUrl: null },
    { titulo: 'Pump It Up', artista: 'Danzel', emoji: '🎸', justificativa: 'Eurodance sem freio', previewUrl: null },
    { titulo: 'Tamally Maak', artista: 'Amr Diab', emoji: '🎹', justificativa: 'Pop árabe que não deixa parar', previewUrl: null },
    { titulo: 'Zenit', artista: 'Meute', emoji: '🎷', justificativa: 'Techno tocado por banda marcial', previewUrl: null },
  ],
  sonhadora: [
    { titulo: 'Space Song', artista: 'Beach House', emoji: '💭', justificativa: 'Camadas etéreas como luz difusa', previewUrl: null },
    { titulo: 'Midnight City', artista: 'M83', emoji: '🌌', justificativa: 'Atmosfera flutuante e luminosa', previewUrl: null },
    { titulo: 'Sunset', artista: 'Kaytranada', emoji: '🎧', justificativa: 'Deriva suave de fim de tarde', previewUrl: null },
    { titulo: 'Kimi no Toriko', artista: 'Rainych', emoji: '🎹', justificativa: 'City pop em câmera lenta', previewUrl: null },
    { titulo: 'An Ending (Ascent)', artista: 'Brian Eno', emoji: '🎻', justificativa: 'Ambiente puro, sem contorno', previewUrl: null },
    { titulo: 'Sonho Meu', artista: 'Maria Bethânia', emoji: '🎸', justificativa: 'Sonho cantado em português', previewUrl: null },
  ],
  romantica: [
    { titulo: 'Eu Sei Que Vou Te Amar', artista: 'Tom Jobim', emoji: '💘', justificativa: 'Clássico íntimo e afetuoso', previewUrl: null },
    { titulo: 'Perfect', artista: 'Ed Sheeran', emoji: '❤️', justificativa: 'Balada quente para dois', previewUrl: null },
    { titulo: 'La Vie en Rose', artista: 'Édith Piaf', emoji: '🎷', justificativa: 'O amor em francês, definitivo', previewUrl: null },
    { titulo: 'Sodade', artista: 'Cesária Évora', emoji: '🎸', justificativa: 'Saudade cabo-verdiana em morna', previewUrl: null },
    { titulo: 'Sabor a Mí', artista: 'Los Panchos', emoji: '🎹', justificativa: 'Bolero de outra época', previewUrl: null },
    { titulo: 'First Day of My Life', artista: 'Bright Eyes', emoji: '🥁', justificativa: 'Declaração sem produção nenhuma', previewUrl: null },
  ],
  noturna: [
    { titulo: 'Nightcall', artista: 'Kavinsky', emoji: '🌙', justificativa: 'Sombras elétricas da madrugada', previewUrl: null },
    { titulo: 'After Dark', artista: 'Mr.Kitty', emoji: '🌒', justificativa: 'Pulso escuro e misterioso', previewUrl: null },
    { titulo: 'Ready to Start', artista: 'Arcade Fire', emoji: '🎸', justificativa: 'Cidade acordando ao contrário', previewUrl: null },
    { titulo: 'Nara', artista: 'E.S. Posthumus', emoji: '🎻', justificativa: 'Escuro com escala de cinema', previewUrl: null },
    { titulo: 'Kyoto', artista: 'Yung Lean', emoji: '🎧', justificativa: 'Neblina noturna em trap', previewUrl: null },
    { titulo: 'Preciso Me Encontrar', artista: 'Cartola', emoji: '🎹', justificativa: 'Samba de quem anda de madrugada', previewUrl: null },
  ],
  nostalgica: [
    { titulo: 'Take On Me', artista: 'a-ha', emoji: '📼', justificativa: 'Oitentista até o último frame', previewUrl: null },
    { titulo: 'Plastic Love', artista: 'Mariya Takeuchi', emoji: '📷', justificativa: 'City pop, memória em VHS', previewUrl: null },
    { titulo: 'Ceremony', artista: 'New Order', emoji: '🎸', justificativa: 'Pós-punk que virou memória afetiva', previewUrl: null },
    { titulo: 'Fio Maravilha', artista: 'Jorge Ben Jor', emoji: '🥁', justificativa: 'Brasil em fita cassete', previewUrl: null },
    { titulo: 'Baby I Love You', artista: 'The Ronettes', emoji: '🎹', justificativa: 'Wall of sound dos anos 60', previewUrl: null },
    { titulo: 'Aquellos Ojos Verdes', artista: 'Nat King Cole', emoji: '🎷', justificativa: 'Bolero em disco de vinil', previewUrl: null },
  ],
  aconchegante: [
    { titulo: 'Garota de Ipanema', artista: 'João Gilberto', emoji: '🕯️', justificativa: 'Bossa morna de fim de tarde', previewUrl: null },
    { titulo: 'Holocene', artista: 'Bon Iver', emoji: '🍂', justificativa: 'Folk quente como lareira', previewUrl: null },
    { titulo: 'Ordinary Day', artista: 'Kina Grannis', emoji: '🎸', justificativa: 'Violão de manhã devagar', previewUrl: null },
    { titulo: 'Tsuki', artista: 'Ichiko Aoba', emoji: '🎻', justificativa: 'Voz e violão, quase sussurro', previewUrl: null },
    { titulo: 'Trem das Onze', artista: 'Demônios da Garoa', emoji: '🎹', justificativa: 'Samba de sala de estar', previewUrl: null },
    { titulo: 'Coffee', artista: 'Sylvan Esso', emoji: '🎧', justificativa: 'Eletrônico de temperatura ambiente', previewUrl: null },
  ],
  gelada: [
    { titulo: 'Comptine d’un autre été', artista: 'Yann Tiersen', emoji: '🧊', justificativa: 'Piano cristalino e frio', previewUrl: null },
    { titulo: 'Intro', artista: 'The xx', emoji: '❄️', justificativa: 'Minimalismo de ar gelado', previewUrl: null },
    { titulo: 'Near Light', artista: 'Ólafur Arnalds', emoji: '🎻', justificativa: 'Cordas islandesas em fio de gelo', previewUrl: null },
    { titulo: 'Hoppípolla', artista: 'Sigur Rós', emoji: '🎹', justificativa: 'Islândia inteira num crescendo', previewUrl: null },
    { titulo: 'Avril 14th', artista: 'Aphex Twin', emoji: '🎧', justificativa: 'Dois minutos de vidro', previewUrl: null },
    { titulo: 'Svefn-g-englar', artista: 'Sigur Rós', emoji: '🎷', justificativa: 'Suspensão em temperatura baixa', previewUrl: null },
  ],
  dourada: [
    { titulo: 'Golden Hour', artista: 'JVKE', emoji: '🌅', justificativa: 'Literalmente a hora dourada', previewUrl: null },
    { titulo: 'Wave', artista: 'Tom Jobim', emoji: '🌞', justificativa: 'Luz quente em forma de som', previewUrl: null },
    { titulo: 'September', artista: 'Earth, Wind & Fire', emoji: '🥁', justificativa: 'Soul cor de fim de tarde', previewUrl: null },
    { titulo: 'Zanzibar', artista: 'Bebel Gilberto', emoji: '🎸', justificativa: 'Brasil ensolarado e macio', previewUrl: null },
    { titulo: 'Sunlight', artista: 'Hozier', emoji: '🎹', justificativa: 'Luz cantada com alma', previewUrl: null },
    { titulo: 'Bana Ellerini Ver', artista: 'Barış Manço', emoji: '🎧', justificativa: 'Psicodelia turca em tom quente', previewUrl: null },
  ],
};

function emojiFor(index: number, vibe: Vibe): string {
  return index === 0 ? vibe.emoji : EMOJIS_MOOD[index % EMOJIS_MOOD.length];
}

/**
 * Lista compacta das faixas efetivamente entregues. Instrumentação do T056:
 * `ORIGEM=` já dizia de qual camada as faixas vieram, mas não **quais** eram —
 * e é exatamente isso que precisa ser contado para medir a repetição entre
 * curadorias. Mesma natureza do `[music][tempo]` do T020: só observa.
 */
function registrarFaixas(origem: string, sugestoes: MusicSuggestion[]) {
  // O marcador de preview não é detalhe: quanto mais obscura a `descoberta`,
  // maior a chance de o Deezer não tê-la, e é o preview que dá a metade sonora
  // do pacote. Sem contar isto, "diversificamos" e perdíamos o som sem ver.
  const comAudio = sugestoes.filter((s) => s.previewUrl).length;
  console.log(
    `[music][faixas] origem=${origem} audio=${comAudio}/${sugestoes.length} ` +
      sugestoes
        .map((s) => `${s.previewUrl ? '♪' : '·'}«${s.titulo} — ${s.artista}»[${s.papel ?? '-'}]`)
        .join(' | '),
  );
}

/**
 * Resolve as ideias do Gemini em sugestões com preview real (Deezer).
 *
 * Busca 5 candidatas em vez de 1 e escolhe a que é **do artista certo**. Antes
 * pegava sempre a primeira, e o Deezer devolve covers no topo: "La Vie en Rose
 * / Edith Piaf" resolvia com um preview do Andrea Bocelli. O cartão dizia um
 * artista e o áudio era de outro — e num app cujo produto é o casamento entre
 * imagem e som, isso quebra o pacote inteiro.
 */
async function resolveWithDeezer(ideas: GeminiTrackIdea[], vibe: Vibe): Promise<MusicSuggestion[]> {
  const resolved = await Promise.all(
    ideas.slice(0, TOTAL_CANDIDATAS).map(async (idea, i): Promise<MusicSuggestion | null> => {
      try {
        const candidatas = await searchDeezer(`${idea.titulo} ${idea.artista}`, 5);
        const track =
          candidatas.find((t) => mesmoArtista(t.artist.name, idea.artista)) ?? null;
        // Sem casamento de artista, a faixa fica sem preview em vez de tocar
        // outra pessoa. Perder o áudio é menos grave que entregar o áudio errado.
        if (candidatas.length > 0 && !track) {
          console.log(
            `[music] preview descartado: Deezer devolveu "${candidatas[0].artist.name}" ` +
              `para «${idea.titulo} — ${idea.artista}»`,
          );
        }
        return {
          id: `gemini-${track ? track.id : `${i}-${idea.titulo.slice(0, 12)}`}`,
          titulo: idea.titulo,
          artista: idea.artista,
          emoji: emojiFor(i, vibe),
          justificativa: idea.justificativa,
          previewUrl: track?.preview ?? null,
          origem: 'gemini',
          papel: papelDe(idea, i),
          artistaId: track?.artist.id,
          genero: idea.genero?.trim() || undefined,
        };
      } catch (e) {
        console.log(`[music] Deezer falhou ao resolver preview de "${idea.titulo}"`, e);
        return null;
      }
    }),
  );
  return resolved.filter((s): s is MusicSuggestion => s !== null);
}

/**
 * Monta os quatro slots a partir das candidatas resolvidas (T072/T073).
 *
 * Só entram faixas **com prévia**. Era a reclamação direta do Sávio: "as músicas
 * frequentemente estão vindo desabilitadas isso não pode acontecer... tem que vir
 * sempre 4 músicas certinhas". Uma faixa muda ocupa um slot e não pode ser
 * ouvida antes de escolher — pior que não estar lá.
 *
 * Se um papel não tiver candidatas suficientes com prévia, o slot é preenchido
 * por sobra de outro papel, mantendo o total em 4. Preferir completar com um
 * papel "errado" a devolver três faixas: quem usa quer quatro opções, e o rótulo
 * é auxiliar — a faixa é o produto.
 */
function montarConjunto(resolvidas: MusicSuggestion[]): MusicSuggestion[] {
  const comAudio = resolvidas.filter((s) => s.previewUrl);
  const escolhidas: MusicSuggestion[] = [];
  const usadas = new Set<string>();

  for (const papel of ['certeira', 'curinga', 'descoberta'] as PapelFaixa[]) {
    const querem = SLOTS[papel];
    const doPapel = comAudio.filter((s) => s.papel === papel && !usadas.has(s.id));
    for (const faixa of doPapel.slice(0, querem)) {
      escolhidas.push(faixa);
      usadas.add(faixa.id);
    }
  }
  // Completa o que faltou com qualquer sobra que tenha áudio.
  for (const faixa of comAudio) {
    if (escolhidas.length >= 4) break;
    if (!usadas.has(faixa.id)) {
      escolhidas.push(faixa);
      usadas.add(faixa.id);
    }
  }
  const mudas = resolvidas.length - comAudio.length;
  if (mudas > 0) {
    console.log(`[music] ${mudas} candidata(s) sem prévia descartada(s); ficaram ${escolhidas.length}`);
  }
  return escolhidas.slice(0, 4);
}

/**
 * Confere com número, não com opinião do modelo, quem pode se chamar
 * `descoberta` (T059).
 *
 * O Gemini não sabe quão conhecido um artista é hoje — ele chuta, e o T056
 * mostrou o resultado do chute. O Deezer sabe: `nb_fan`. Reprovada, a faixa
 * **não é removida** (ela pode ser ótima); o que cai é o rótulo, que passa a
 * `curinga`. Um rótulo que mente é pior que rótulo nenhum: destrói a confiança
 * na única coisa que faz uma sugestão estranha parecer proposta e não defeito.
 *
 * A verificação usa o `artistaId` que veio da resolução da faixa. Consultar
 * `search/artist?q=<nome>` seria o caminho óbvio e está **errado**: devolve
 * homônimos obscuros — "Kavinsky" volta com 108 fãs, "Anitta" com 177.
 */
async function verificarDescobertas(sugestoes: MusicSuggestion[]): Promise<MusicSuggestion[]> {
  return Promise.all(
    sugestoes.map(async (s) => {
      if (s.papel !== 'descoberta') return s;
      // Sem id não dá para medir. Faixa que o Deezer nem tem é, por definição,
      // fora do mainstream — o benefício da dúvida vai para a descoberta.
      if (s.artistaId === undefined) return s;
      const fas = await fansDoArtista(s.artistaId);
      if (fas === null) return s;
      if (fas <= LIMITE_DESCOBERTA_FAS) {
        console.log(`[music] descoberta confirmada: ${s.artista} nb_fan=${fas}`);
        return s;
      }
      console.log(
        `[music] descoberta rebaixada: ${s.artista} nb_fan=${fas} > ${LIMITE_DESCOBERTA_FAS}`,
      );
      return { ...s, papel: 'curinga' as PapelFaixa };
    }),
  );
}

/**
 * Personalização que **não sai do aparelho** (D7, alternativa 1).
 *
 * O pedido do Sávio era "aprender de um cantor que a pessoa já escolheu". A via
 * direta seria mandar esses nomes ao Gemini, e é justamente a que o consentimento
 * atual não cobre. Então o histórico age depois: se uma das faixas devolvidas for
 * de artista que a pessoa já escolheu, ela ganha o rótulo `afinidade` e vai para
 * o topo da lista.
 *
 * No máximo **uma** — o T058 pede isso explicitamente, para o histórico
 * personalizar sem fechar a pessoa na própria bolha.
 */
function rotularAfinidade(sugestoes: MusicSuggestion[]): MusicSuggestion[] {
  const frequentes = useTasteStore.getState().artistasFrequentes(8);
  if (frequentes.length === 0) return sugestoes;
  const normalizados = frequentes.map((a) => a.trim().toLowerCase());
  const alvo = sugestoes.findIndex((s) =>
    normalizados.includes(s.artista.trim().toLowerCase()),
  );
  if (alvo < 0) return sugestoes;
  const marcada: MusicSuggestion = { ...sugestoes[alvo], papel: 'afinidade' };
  console.log(`[music] afinidade local: «${marcada.titulo} — ${marcada.artista}»`);
  return [marcada, ...sugestoes.filter((_, i) => i !== alvo)];
}

/**
 * Etapa corrente da curadoria, para a interface comunicar progresso real em
 * vez de um texto parado (FR-Q08). Cada valor corresponde a uma etapa medida
 * no T020, então o que a tela mostra é o que está de fato acontecendo.
 */
export type EtapaCuradoria = 'preparando' | 'lendo' | 'buscando';

export interface PhotoAnalysis {
  /** Vibe real inferida da imagem; null quando o Gemini não pôde analisar */
  vibeId: VibeId | null;
  sugestoes: MusicSuggestion[];
  /**
   * Os três looks daquela foto (feature 003). Sempre três — mesmo sem chave,
   * sem rede ou com o tempo estourado, `montarLooks()` completa com os looks
   * base da vibe (FR-001, SC-004).
   */
  looks: LookRecipe[];
}

/**
 * Cache da análise por foto (FR-009, D5).
 *
 * A mesma foto tem que produzir o mesmo conjunto de três looks — reabrir uma
 * mídia não pode devolver sugestões diferentes sem que nada tenha mudado. O
 * problema é o mesmo que o T083 resolveu para as faixas guardando `sugestoes`
 * junto da mídia; aqui ele é resolvido um nível acima, para valer também dentro
 * da mesma sessão, antes de qualquer coisa ser salva.
 *
 * Teto baixo porque o consumo é serial: quem fotografa mexe numa foto por vez, e
 * isto é cache de determinismo, não de desempenho.
 */
const TETO_CACHE_ANALISE = 8;
const cacheAnalise = new Map<string, PhotoAnalysis>();

function guardarAnalise(photoUri: string, analise: PhotoAnalysis): PhotoAnalysis {
  cacheAnalise.set(photoUri, analise);
  if (cacheAnalise.size > TETO_CACHE_ANALISE) {
    const maisAntiga = cacheAnalise.keys().next().value;
    if (maisAntiga !== undefined) cacheAnalise.delete(maisAntiga);
  }
  return analise;
}

/**
 * Análise sensorial da foto (T-0A/T-0B): envia a imagem capturada ao Gemini
 * multimodal, que infere a vibe real da cena e já cura as faixas — sem
 * depender de filtro, hora ou sorteio. Nunca rejeita: em falha degrada para
 * `getSuggestions(fallbackVibe)` mantendo a vibe heurística do visor.
 */
export async function analyzePhotoAndSuggest(
  photoUri: string,
  fallbackVibe: Vibe,
  onEtapa?: (etapa: EtapaCuradoria) => void,
): Promise<PhotoAnalysis> {
  // Instrumentação das três etapas (T020). O research R3 descartou por inspeção
  // a hipótese "o Deezer está em série"; estes números dizem qual etapa domina
  // de fato, para que a otimização não seja palpite.
  const emCache = cacheAnalise.get(photoUri);
  if (emCache) {
    console.log('[music] análise reaproveitada do cache — mesma foto, mesmas sugestões');
    return emCache;
  }

  const t0 = Date.now();
  let tImagem = 0;
  let tGemini = 0;
  let bytes = 0;
  let expirou = false;
  const registrar = (etapaFinal: string, tDeezer: number) =>
    console.log(
      `[music][tempo] imagem=${tImagem}ms gemini=${tGemini}ms deezer=${tDeezer}ms ` +
        `total=${Date.now() - t0}ms payload=${Math.round(bytes / 1024)}KB saida=${etapaFinal}`,
    );

  try {
    onEtapa?.('preparando');
    const marcoImagem = Date.now();
    const base64 = await photoToBase64(photoUri);
    tImagem = Date.now() - marcoImagem;
    bytes = base64.length;

    onEtapa?.('lendo');
    const marcoGemini = Date.now();
    const scene = await askGeminiWithPhoto(base64);
    tGemini = Date.now() - marcoGemini;

    if (scene) {
      const vibeReal = VIBES.find((v) => v.id === scene.vibe) ?? null;
      console.log(
        `[music] Gemini leu a cena: "${scene.cena ?? '?'}" → vibe="${scene.vibe}"` +
          (vibeReal ? '' : ' (id inválido, mantendo vibe heurística)'),
      );
      const vibe = vibeReal ?? fallbackVibe;
      onEtapa?.('buscando');
      const marcoDeezer = Date.now();
      const resolvidas = await resolveWithDeezer(scene.musicas ?? [], vibe);
      const tDeezer = Date.now() - marcoDeezer;
      if (resolvidas.length > 0) {
        const sugestoes = rotularAfinidade(montarConjunto(await verificarDescobertas(resolvidas)));
        // A lista de bloqueio da próxima curadoria é esta: o que acabou de ser
        // oferecido. Guardar aqui, e não em quem consome, garante que vale para
        // todo caminho que devolve faixas do Gemini.
        useTasteStore.getState().registrarSugeridas(vibe.id, sugestoes);
        console.log(`[music] ORIGEM=gemini-foto — ${sugestoes.length} sugestão(ões) da cena real`);
        registrarFaixas('gemini-foto', sugestoes);
        registrar('gemini-foto', tDeezer);
        return guardarAnalise(photoUri, {
          vibeId: vibeReal?.id ?? null,
          sugestoes,
          looks: montarLooks(scene.looks, vibe.id),
        });
      }
      // Cena lida mas faixas não resolveram → pipeline por vibe, já com a vibe
      // real. Os looks continuam valendo: a cena foi lida, quem não resolveu foi
      // o Deezer, e uma coisa não tem nada a ver com a outra.
      const porVibe = await getSuggestions(vibe, onEtapa);
      registrar('pipeline-por-vibe', tDeezer);
      return guardarAnalise(photoUri, {
        vibeId: vibeReal?.id ?? null,
        sugestoes: porVibe,
        looks: montarLooks(scene.looks, vibe.id),
      });
    }
  } catch (e) {
    console.log('[music] análise da foto falhou (caiu para pipeline por vibe):', e);
    expirou = e instanceof Error && e.name === 'AbortError';
  }
  const degradado = await getSuggestions(fallbackVibe, onEtapa, expirou);
  registrar('degradado', 0);
  // Sem cena lida não há ideia de look nenhuma — e ainda assim saem três, todos
  // derivados da vibe. É o piso da cadeia de degradação (FR-019, SC-004).
  return guardarAnalise(photoUri, {
    vibeId: null,
    sugestoes: degradado,
    looks: montarLooks(undefined, fallbackVibe.id),
  });
}

/**
 * Busca até 4 sugestões para a vibe. Nunca rejeita: em falha total devolve o
 * catálogo local (sem preview), preservando o fluxo de salvar (SC-004).
 */
export async function getSuggestions(
  vibe: Vibe,
  onEtapa?: (etapa: EtapaCuradoria) => void,
  /**
   * Pula a etapa 1 quando o Gemini acabou de estourar o tempo. Sem isso a
   * degradação gasta outros 22s batendo no mesmo serviço que já não respondeu,
   * e o total passa dos 30s que a interface espera — o usuário veria a
   * postagem liberar "sem trilha" enquanto a busca ainda estava viva.
   */
  pularGemini = false,
): Promise<MusicSuggestion[]> {
  console.log(`[music] getSuggestions vibe="${vibe.id}" geminiKey=${GEMINI_KEY ? 'presente' : 'ausente'}`);

  // 1) Gemini cura, Deezer resolve o preview
  try {
    if (pularGemini) throw new Error('Gemini pulado (tempo limite anterior)');
    onEtapa?.('lendo');
    const ideas = await askGemini(vibe);
    console.log(`[music] Gemini retornou ${ideas.length} ideia(s)`, ideas);
    if (ideas.length > 0) {
      onEtapa?.('buscando');
      const resolvidas = await resolveWithDeezer(ideas, vibe);
      if (resolvidas.length > 0) {
        const ok = rotularAfinidade(montarConjunto(await verificarDescobertas(resolvidas)));
        useTasteStore.getState().registrarSugeridas(vibe.id, ok);
        console.log(`[music] ORIGEM=gemini — ${ok.length} sugestão(ões) usadas`);
        registrarFaixas('gemini', ok);
        return ok;
      }
    }
  } catch (e) {
    console.log('[music] Gemini falhou (caiu para Deezer puro):', e);
  }

  // 2) Catálogo curado da vibe, com o preview resolvido no Deezer
  //
  // Vem **antes** da busca por keyword porque é melhor música: o catálogo é
  // escrito à mão, a busca por keyword é o que o Deezer tiver. Medido no
  // aparelho com a chave do Gemini removida, a etapa por keyword devolvia
  // «Funk brasileño — JflowProduciendo» e «ESPAÇO FUNK BRASILEIRO — Eilon»;
  // o catálogo devolve BaianaSystem e Meute. A única coisa que faltava ao
  // catálogo era áudio, e é exatamente isso que o Deezer sabe dar.
  //
  // Só as faixas ainda não oferecidas: esgotadas as seis da vibe, a busca por
  // keyword assume — ela é pobre, mas é infinita, e é o que evita a terceira
  // captura offline repetir tudo.
  let curadasComAudio: MusicSuggestion[] = [];
  try {
    const inéditasCuradas = (FALLBACK[vibe.id] ?? []).filter(
      (s) =>
        !new Set(useTasteStore.getState().faixasSugeridasRecentes(vibe.id, 20)).has(
          chaveDaFaixa(s.titulo, s.artista),
        ),
    );
    if (inéditasCuradas.length > 0) {
      onEtapa?.('buscando');
      const comPreview = await resolveWithDeezer(
        inéditasCuradas.slice(0, 4).map((s) => ({
          titulo: s.titulo,
          artista: s.artista,
          justificativa: s.justificativa,
          papel: 'certeira',
        })),
        vibe,
      );
      curadasComAudio = comPreview
        .filter((s) => s.previewUrl)
        .map((s) => ({ ...s, origem: 'local' as const }));
      // Só encerra aqui com o conjunto cheio. Nem toda faixa curada existe no
      // Deezer com o artista certo — quando sobram uma ou duas, a busca por
      // keyword abaixo completa em vez de a pessoa receber uma lista magra.
      if (curadasComAudio.length >= 4) {
        useTasteStore.getState().registrarSugeridas(vibe.id, curadasComAudio);
        console.log(`[music] ORIGEM=curado — ${curadasComAudio.length} do catálogo com preview`);
        registrarFaixas('curado', curadasComAudio);
        return curadasComAudio;
      }
    }
  } catch (e) {
    console.log('[music] catálogo curado não resolveu no Deezer:', e);
  }

  // 3) Deezer direto pelas keywords da vibe
  //
  // Este é o caminho que aparece quando nem o Gemini nem o catálogo curado
  // serviram, e o T056 o pegou sendo o pior dos três: duas capturas seguidas
  // devolveram as MESMAS quatro faixas, porque a busca usava só as duas
  // primeiras keywords e sempre do índice 0. Agora usa todas as keywords, entra
  // por um ponto variável e descarta o que já foi oferecido.
  try {
    onEtapa?.('buscando');
    const jaOferecidas = new Set(
      useTasteStore.getState().faixasSugeridasRecentes(vibe.id, 20),
    );
    // Ponto de entrada variável na lista do Deezer — mas raso de propósito.
    // Testado no aparelho com amplitude maior (até o índice 21), a variação
    // funcionava e a relevância desabava: vinham banda militar escocesa e Hino
    // Nacional para a vibe "energética". Fundo da busca por keyword é ruído,
    // não descoberta. Buscando 10 por keyword, os índices 0–6 já dão material
    // de sobra para quatro slots depois da filtragem.
    const inicio = Math.floor(Math.random() * 4) * 2;
    const perKeyword = await Promise.all(
      vibe.musicaKeywords.map((kw) => searchDeezer(kw, 10, inicio).catch(() => [])),
    );
    const seen = new Set<number>();
    const tracks = perKeyword.flat().filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      if (jaOferecidas.has(chaveDaFaixa(t.title, t.artist.name))) return false;
      return faixaAproveitavel(t, vibe);
    });
    if (tracks.length > 0 || curadasComAudio.length > 0) {
      console.log(`[music] ORIGEM=deezer — ${tracks.length} faixa(s) via keywords`, vibe.musicaKeywords);
      const faltam = Math.max(0, 4 - curadasComAudio.length);
      const viaKeywords = tracks.slice(0, faltam).map((t, i) => ({
        id: `deezer-${t.id}`,
        titulo: t.title,
        artista: t.artist.name,
        emoji: emojiFor(i, vibe),
        justificativa: `Combina com a atmosfera ${vibe.nome.toLowerCase()} da cena`,
        previewUrl: t.preview,
        origem: 'deezer' as const,
        artistaId: t.artist.id,
      }));
      // Curadas primeiro: são as boas, a keyword só preenche o que sobrou.
      const combinadas = [...curadasComAudio, ...viaKeywords];
      useTasteStore.getState().registrarSugeridas(vibe.id, combinadas);
      registrarFaixas(curadasComAudio.length ? 'curado+deezer' : 'deezer', combinadas);
      return combinadas;
    }
  } catch (e) {
    console.log('[music] Deezer (keywords) falhou (caiu para catálogo local):', e);
  }

  // Rede caiu no meio: o que o catálogo curado já resolveu vale mais que nada.
  if (curadasComAudio.length > 0) {
    useTasteStore.getState().registrarSugeridas(vibe.id, curadasComAudio);
    registrarFaixas('curado', curadasComAudio);
    return curadasComAudio;
  }

  // 4) Sem rede nenhuma — catálogo do MVP Python, ampliado no T060, sem áudio
  //
  // São 6 por vibe e a interface mostra 4: a escolha prioriza o que ainda não
  // foi oferecido. Com as 2 fixas de antes, a terceira captura offline seguida
  // repetia tudo; agora só repete a partir da quarta, e mesmo assim variando.
  console.log(`[music] ORIGEM=local — catálogo offline para vibe="${vibe.id}"`);
  const catalogo = (FALLBACK[vibe.id] ?? []).map((s, i) => ({
    ...s,
    id: `local-${vibe.id}-${i}`,
    origem: 'local' as const,
  }));
  const jaOferecidasLocal = new Set(
    useTasteStore.getState().faixasSugeridasRecentes(vibe.id, 20),
  );
  const inéditas = catalogo.filter(
    (s) => !jaOferecidasLocal.has(chaveDaFaixa(s.titulo, s.artista)),
  );
  // Nunca devolver lista vazia: esgotadas as inéditas, vale o catálogo inteiro.
  const local = [...inéditas, ...catalogo.filter((s) => !inéditas.includes(s))].slice(0, 4);
  useTasteStore.getState().registrarSugeridas(vibe.id, local);
  registrarFaixas('local', local);
  return local;
}

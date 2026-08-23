/**
 * @docs docs/adr/0012-pipeline-de-curadoria-gemini-deezer.md
 * @docs docs/research/limiares_e_metricas.md
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { FILTERS } from "@/constants/filters";
import { VIBES } from "@/constants/vibes";
import { ContextoCena, montarContexto } from "@/services/contexto";
import { montarLooks } from "@/services/looks";
import { GostoVisual, useLookTasteStore } from "@/stores/useLookTasteStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { chaveDaFaixa, useTasteStore } from "@/stores/useTasteStore";
import { LookRecipe, MusicSuggestion, PapelFaixa, Vibe, VibeId } from "@/types";

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const LIMITE_GEMINI_MS = 22_000;
const LIMITE_DEEZER_MS = 8_000;

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

const EMOJIS_MOOD = ["🎧", "🎸", "🎹", "🎷", "🥁", "🎻"];

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

const LIMITE_DESCOBERTA_FAS = 250_000;

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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(the|feat|ft)\b/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function mesmoArtista(a: string, b: string): boolean {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function mesmoTexto(a: string, b: string): boolean {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  return !!x && !!y && x === y;
}

const ARTISTA_DE_CATALOGO =
  /(karaok|tribute|playback|cover band|instrumentals?\b|various artists|top \d+|hits\b|\bacademy\b|compilation|made famous by|as made popular|backing track|ringtones?\b|\bmix\b|\bdj regaeton\b)/i;

function faixaAproveitavel(t: DeezerTrack, vibe: Vibe): boolean {
  if (vibe.musicaKeywords.some((kw) => mesmoTexto(t.title, kw))) return false;
  if (ARTISTA_DE_CATALOGO.test(t.artist.name)) return false;
  if (ARTISTA_DE_CATALOGO.test(t.title)) return false;

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

const SLOTS: Record<PapelFaixa, number> = {
  certeira: 2,
  curinga: 1,
  descoberta: 1,
  afinidade: 0,
};

const CANDIDATAS: Record<string, number> = {
  certeira: 3,
  curinga: 2,
  descoberta: 4,
};

const TOTAL_CANDIDATAS = Object.values(CANDIDATAS).reduce((a, b) => a + b, 0);

const PAPEIS_VALIDOS: readonly string[] = ["certeira", "descoberta", "curinga"];

const PAPEIS_PEDIDOS: PapelFaixa[] = [
  ...Array<PapelFaixa>(CANDIDATAS.certeira).fill("certeira"),
  ...Array<PapelFaixa>(CANDIDATAS.curinga).fill("curinga"),
  ...Array<PapelFaixa>(CANDIDATAS.descoberta).fill("descoberta"),
];

function tratamentoEmLinha(t: GostoVisual): string {
  const eixos: string[] = [];
  const push = (rotulo: string, v: number | undefined) => {
    if (v === undefined || Math.abs(v) < 0.005) return;
    eixos.push(`${rotulo} ${v > 0 ? "+" : ""}${v.toFixed(2)}`);
  };
  push("brilho", t.ajustes.brilho);
  push("saturação", t.ajustes.saturacao);
  push("contraste", t.ajustes.contraste);
  push("sépia", t.ajustes.sepia);
  push("véu", t.ajustes.veu);
  const base = t.base ?? "sem tratamento";
  return `«${t.nome}» (base ${base}${eixos.length ? ", " + eixos.join(", ") : ""})`;
}

function listasDeGosto(): string {
  const musicas = useTasteStore.getState().ultimasEscolhas();
  const tratamentos = useLookTasteStore.getState().ultimosTratamentos();
  if (musicas.length === 0 && tratamentos.length === 0) return "";

  const partes: string[] = [];
  if (musicas.length) {
    const linhas = musicas
      .map(
        (m) =>
          `«${m.titulo} — ${m.artista}»${m.genero ? ` (${m.genero})` : ""}`,
      )
      .join("; ");
    partes.push(
      `Esta pessoa já escolheu estas músicas (mais recentes primeiro): ${linhas}.`,
    );
  }
  if (tratamentos.length) {
    partes.push(
      `E estes tratamentos visuais: ${tratamentos.map(tratamentoEmLinha).join("; ")}.`,
    );
  }
  return (
    partes.join(" ") +
    ` Leve o gosto em conta nas "certeira" e nos looks, sem repetir as mesmas faixas. `
  );
}

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
  const variacao = `Varie época, idioma e país de origem entre elas. `;
  const naoRepita = bloqueio.length
    ? `NÃO sugira nenhuma destas, já usadas recentemente: ${bloqueio.join("; ")}. `
    : "";
  return papeis + genero + existir + variacao + listasDeGosto() + naoRepita;
}

function papelDe(idea: GeminiTrackIdea, i: number): PapelFaixa {
  const bruto = idea.papel?.trim().toLowerCase();
  if (bruto && PAPEIS_VALIDOS.includes(bruto)) return bruto as PapelFaixa;

  return PAPEIS_PEDIDOS[i] ?? "curinga";
}

const GEMINI_MODEL = "gemini-3.1-flash-lite";

type GeminiPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string };

async function callGemini(input: GeminiPart[]): Promise<string> {
  if (!GEMINI_KEY) return "";
  const res = await fetchComLimite(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_KEY,
      },
      body: JSON.stringify({ model: GEMINI_MODEL, input }),
    },
    LIMITE_GEMINI_MS,
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  return (
    json?.steps?.find((s: { type: string }) => s.type === "model_output")
      ?.content?.[0]?.text ?? ""
  );
}

async function askGemini(vibe: Vibe): Promise<GeminiTrackIdea[]> {
  if (!GEMINI_KEY) return [];

  const bloqueio = useTasteStore.getState().faixasSugeridasRecentes(20);
  const prompt =
    `Você é o curador musical do app Synesthesia. A foto tem a vibe "${vibe.nome}" (${vibe.descricao}). ` +
    `Sugira músicas reais que combinem. ` +
    instrucaoDeCuradoria(bloqueio) +
    `Responda SOMENTE JSON: ` +
    `[{"titulo":"...","artista":"...","papel":"...","genero":"...","justificativa":"até 12 palavras, em pt-BR"}]`;
  const text = await callGemini([{ type: "text", text: prompt }]);
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]) as GeminiTrackIdea[];
}

const ENVIO_LARGURA = 448;
const ENVIO_COMPRESSAO = 0.45;

async function photoToBase64(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: ENVIO_LARGURA });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: ENVIO_COMPRESSAO,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!saved.base64) throw new Error("manipulator sem base64");
  return saved.base64;
}

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

function instrucaoDeLook(): string {
  const presets = FILTERS.map((f) => f.id).join(", ");
  return (
    `Proponha também 3 tratamentos visuais (looks) para esta foto. Cada look PARTE ` +
    `de um destes presets e informa apenas o DESVIO em relação a ele: ${presets}. ` +
    `Papéis, nesta ordem: 1x "certeira" (realça o que a cena já tem), ` +
    `1x "ousada" (interpretação mais forte, ainda plausível), ` +
    `1x "ousada" LIVRE (a leitura mais autoral que a cena permitir — escolha o ` +
    `preset de partida que quiser e desvie dele com liberdade). ` +
    `Os ajustes são deltas entre -0.5 e 0.5. ` +
    `REGRA: nenhum look pode ser igual ao preset de partida. Todo look precisa ` +
    `de pelo menos um ajuste diferente de zero. ` +
    `O "nome" tem NO MÁXIMO 2 palavras, em pt-BR, e evoca a SENSAÇÃO da imagem ` +
    `tratada ("Hora Dourada", "Luz Urbana", "Fita Velha"). Nunca use o nome do ` +
    `preset, nem palavras genéricas como "livre", "suave", "forte" ou "variação". `
  );
}

const TETO_VIBE_CHARS = 24;

export function sanearVibe(bruto: unknown): string | undefined {
  if (typeof bruto !== "string") return undefined;
  const semCercas = bruto
    .replace(/```[a-z]*/gi, "")
    .replace(/["'`]/g, "")
    .trim();

  const palavras = semCercas.split(/\s+/).filter(Boolean).slice(0, 2);
  if (palavras.length === 0) return undefined;

  let texto = palavras.join(" ");
  if (texto.length > TETO_VIBE_CHARS) {
    texto = palavras[0].slice(0, TETO_VIBE_CHARS);
  }

  if (!/[\p{L}\p{N}]/u.test(texto)) return undefined;
  return texto;
}

export function vibeIdDePiso(
  vibe: string | undefined,
  cena: string | undefined,
): VibeId | null {
  const texto = normalizarNome(`${vibe ?? ""} ${cena ?? ""}`);
  if (!texto) return null;
  for (const v of VIBES) {
    if (
      texto.includes(normalizarNome(v.nome)) ||
      texto.includes(normalizarNome(v.id))
    ) {
      return v.id;
    }
  }
  return null;
}

async function askGeminiWithPhoto(
  photoBase64: string,
  contexto: ContextoCena,
): Promise<GeminiSceneResult | null> {
  if (!GEMINI_KEY) return null;

  const bloqueio = useTasteStore.getState().faixasSugeridasRecentes(20);
  const prompt =
    `Você é o motor sensorial do app Synesthesia. Analise a foto anexada e: ` +
    `Contexto: a foto foi tirada no ${contexto.hora}. ` +
    (contexto.lugar
      ? `Contexto: quem fotografou está em ${contexto.lugar}. `
      : "") +
    `1) escreva a VIBE da cena: NO MÁXIMO DUAS PALAVRAS, em pt-BR, nomeando um ` +
    `SENTIMENTO ou um LUGAR que a imagem transmite ("Noite Cibernética", ` +
    `"Praiana", "Domingo Lento"). NÃO use categorias genéricas de app ` +
    `("energética", "romântica", "nostálgica"), nem o nome de um filtro, nem ` +
    `adjetivos soltos como "bonita" ou "legal"; ` +
    `2) sugira músicas reais que combinem com o que aparece na foto. ` +
    instrucaoDeCuradoria(bloqueio) +
    instrucaoDeLook() +
    `Responda SOMENTE JSON: {"vibe":"até 2 palavras","cena":"o que há na foto, até 10 palavras", ` +
    `"musicas":[{"titulo":"...","artista":"...","papel":"...","genero":"...","justificativa":"até 12 palavras, em pt-BR, ligada à cena"}], ` +
    `"looks":[{"base":"<preset>","nome":"até 2 palavras","papel":"certeira|ousada",` +
    `"justificativa":"até 10 palavras, em pt-BR, ligada à cena",` +
    `"ajustes":{"brilho":0,"saturacao":0,"contraste":0,"sepia":0,"veu":0}}]}`;
  const text = await callGemini([
    { type: "text", text: prompt },
    { type: "image", data: photoBase64, mime_type: "image/jpeg" },
  ]);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]) as GeminiSceneResult;
}

const FALLBACK: Record<string, Omit<MusicSuggestion, "id" | "origem">[]> = {
  energetica: [
    {
      titulo: "Envolver",
      artista: "Anitta",
      emoji: "⚡",
      justificativa: "Batida intensa para cenas cheias de energia",
      previewUrl: null,
    },
    {
      titulo: "Blinding Lights",
      artista: "The Weeknd",
      emoji: "🎧",
      justificativa: "Synths acelerados, movimento puro",
      previewUrl: null,
    },
    {
      titulo: "Bagulho Doido",
      artista: "BaianaSystem",
      emoji: "🥁",
      justificativa: "Percussão baiana em alta rotação",
      previewUrl: null,
    },
    {
      titulo: "Pump It Up",
      artista: "Danzel",
      emoji: "🎸",
      justificativa: "Eurodance sem freio",
      previewUrl: null,
    },
    {
      titulo: "Tamally Maak",
      artista: "Amr Diab",
      emoji: "🎹",
      justificativa: "Pop árabe que não deixa parar",
      previewUrl: null,
    },
    {
      titulo: "Zenit",
      artista: "Meute",
      emoji: "🎷",
      justificativa: "Techno tocado por banda marcial",
      previewUrl: null,
    },
  ],
  sonhadora: [
    {
      titulo: "Space Song",
      artista: "Beach House",
      emoji: "💭",
      justificativa: "Camadas etéreas como luz difusa",
      previewUrl: null,
    },
    {
      titulo: "Midnight City",
      artista: "M83",
      emoji: "🌌",
      justificativa: "Atmosfera flutuante e luminosa",
      previewUrl: null,
    },
    {
      titulo: "Sunset",
      artista: "Kaytranada",
      emoji: "🎧",
      justificativa: "Deriva suave de fim de tarde",
      previewUrl: null,
    },
    {
      titulo: "Kimi no Toriko",
      artista: "Rainych",
      emoji: "🎹",
      justificativa: "City pop em câmera lenta",
      previewUrl: null,
    },
    {
      titulo: "An Ending (Ascent)",
      artista: "Brian Eno",
      emoji: "🎻",
      justificativa: "Ambiente puro, sem contorno",
      previewUrl: null,
    },
    {
      titulo: "Sonho Meu",
      artista: "Maria Bethânia",
      emoji: "🎸",
      justificativa: "Sonho cantado em português",
      previewUrl: null,
    },
  ],
  romantica: [
    {
      titulo: "Eu Sei Que Vou Te Amar",
      artista: "Tom Jobim",
      emoji: "💘",
      justificativa: "Clássico íntimo e afetuoso",
      previewUrl: null,
    },
    {
      titulo: "Perfect",
      artista: "Ed Sheeran",
      emoji: "❤️",
      justificativa: "Balada quente para dois",
      previewUrl: null,
    },
    {
      titulo: "La Vie en Rose",
      artista: "Édith Piaf",
      emoji: "🎷",
      justificativa: "O amor em francês, definitivo",
      previewUrl: null,
    },
    {
      titulo: "Sodade",
      artista: "Cesária Évora",
      emoji: "🎸",
      justificativa: "Saudade cabo-verdiana em morna",
      previewUrl: null,
    },
    {
      titulo: "Sabor a Mí",
      artista: "Los Panchos",
      emoji: "🎹",
      justificativa: "Bolero de outra época",
      previewUrl: null,
    },
    {
      titulo: "First Day of My Life",
      artista: "Bright Eyes",
      emoji: "🥁",
      justificativa: "Declaração sem produção nenhuma",
      previewUrl: null,
    },
  ],
  noturna: [
    {
      titulo: "Nightcall",
      artista: "Kavinsky",
      emoji: "🌙",
      justificativa: "Sombras elétricas da madrugada",
      previewUrl: null,
    },
    {
      titulo: "After Dark",
      artista: "Mr.Kitty",
      emoji: "🌒",
      justificativa: "Pulso escuro e misterioso",
      previewUrl: null,
    },
    {
      titulo: "Ready to Start",
      artista: "Arcade Fire",
      emoji: "🎸",
      justificativa: "Cidade acordando ao contrário",
      previewUrl: null,
    },
    {
      titulo: "Nara",
      artista: "E.S. Posthumus",
      emoji: "🎻",
      justificativa: "Escuro com escala de cinema",
      previewUrl: null,
    },
    {
      titulo: "Kyoto",
      artista: "Yung Lean",
      emoji: "🎧",
      justificativa: "Neblina noturna em trap",
      previewUrl: null,
    },
    {
      titulo: "Preciso Me Encontrar",
      artista: "Cartola",
      emoji: "🎹",
      justificativa: "Samba de quem anda de madrugada",
      previewUrl: null,
    },
  ],
  nostalgica: [
    {
      titulo: "Take On Me",
      artista: "a-ha",
      emoji: "📼",
      justificativa: "Oitentista até o último frame",
      previewUrl: null,
    },
    {
      titulo: "Plastic Love",
      artista: "Mariya Takeuchi",
      emoji: "📷",
      justificativa: "City pop, memória em VHS",
      previewUrl: null,
    },
    {
      titulo: "Ceremony",
      artista: "New Order",
      emoji: "🎸",
      justificativa: "Pós-punk que virou memória afetiva",
      previewUrl: null,
    },
    {
      titulo: "Fio Maravilha",
      artista: "Jorge Ben Jor",
      emoji: "🥁",
      justificativa: "Brasil em fita cassete",
      previewUrl: null,
    },
    {
      titulo: "Baby I Love You",
      artista: "The Ronettes",
      emoji: "🎹",
      justificativa: "Wall of sound dos anos 60",
      previewUrl: null,
    },
    {
      titulo: "Aquellos Ojos Verdes",
      artista: "Nat King Cole",
      emoji: "🎷",
      justificativa: "Bolero em disco de vinil",
      previewUrl: null,
    },
  ],
  aconchegante: [
    {
      titulo: "Garota de Ipanema",
      artista: "João Gilberto",
      emoji: "🕯️",
      justificativa: "Bossa morna de fim de tarde",
      previewUrl: null,
    },
    {
      titulo: "Holocene",
      artista: "Bon Iver",
      emoji: "🍂",
      justificativa: "Folk quente como lareira",
      previewUrl: null,
    },
    {
      titulo: "Ordinary Day",
      artista: "Kina Grannis",
      emoji: "🎸",
      justificativa: "Violão de manhã devagar",
      previewUrl: null,
    },
    {
      titulo: "Tsuki",
      artista: "Ichiko Aoba",
      emoji: "🎻",
      justificativa: "Voz e violão, quase sussurro",
      previewUrl: null,
    },
    {
      titulo: "Trem das Onze",
      artista: "Demônios da Garoa",
      emoji: "🎹",
      justificativa: "Samba de sala de estar",
      previewUrl: null,
    },
    {
      titulo: "Coffee",
      artista: "Sylvan Esso",
      emoji: "🎧",
      justificativa: "Eletrônico de temperatura ambiente",
      previewUrl: null,
    },
  ],
  gelada: [
    {
      titulo: "Comptine d’un autre été",
      artista: "Yann Tiersen",
      emoji: "🧊",
      justificativa: "Piano cristalino e frio",
      previewUrl: null,
    },
    {
      titulo: "Intro",
      artista: "The xx",
      emoji: "❄️",
      justificativa: "Minimalismo de ar gelado",
      previewUrl: null,
    },
    {
      titulo: "Near Light",
      artista: "Ólafur Arnalds",
      emoji: "🎻",
      justificativa: "Cordas islandesas em fio de gelo",
      previewUrl: null,
    },
    {
      titulo: "Hoppípolla",
      artista: "Sigur Rós",
      emoji: "🎹",
      justificativa: "Islândia inteira num crescendo",
      previewUrl: null,
    },
    {
      titulo: "Avril 14th",
      artista: "Aphex Twin",
      emoji: "🎧",
      justificativa: "Dois minutos de vidro",
      previewUrl: null,
    },
    {
      titulo: "Svefn-g-englar",
      artista: "Sigur Rós",
      emoji: "🎷",
      justificativa: "Suspensão em temperatura baixa",
      previewUrl: null,
    },
  ],
  dourada: [
    {
      titulo: "Golden Hour",
      artista: "JVKE",
      emoji: "🌅",
      justificativa: "Literalmente a hora dourada",
      previewUrl: null,
    },
    {
      titulo: "Wave",
      artista: "Tom Jobim",
      emoji: "🌞",
      justificativa: "Luz quente em forma de som",
      previewUrl: null,
    },
    {
      titulo: "September",
      artista: "Earth, Wind & Fire",
      emoji: "🥁",
      justificativa: "Soul cor de fim de tarde",
      previewUrl: null,
    },
    {
      titulo: "Zanzibar",
      artista: "Bebel Gilberto",
      emoji: "🎸",
      justificativa: "Brasil ensolarado e macio",
      previewUrl: null,
    },
    {
      titulo: "Sunlight",
      artista: "Hozier",
      emoji: "🎹",
      justificativa: "Luz cantada com alma",
      previewUrl: null,
    },
    {
      titulo: "Bana Ellerini Ver",
      artista: "Barış Manço",
      emoji: "🎧",
      justificativa: "Psicodelia turca em tom quente",
      previewUrl: null,
    },
  ],
};

function emojiFor(index: number, vibe: Vibe): string {
  return index === 0 ? vibe.emoji : EMOJIS_MOOD[index % EMOJIS_MOOD.length];
}

function registrarFaixas(origem: string, sugestoes: MusicSuggestion[]) {
  const comAudio = sugestoes.filter((s) => s.previewUrl).length;
  console.log(
    `[music][faixas] origem=${origem} audio=${comAudio}/${sugestoes.length} ` +
      sugestoes
        .map(
          (s) =>
            `${s.previewUrl ? "♪" : "·"}«${s.titulo} — ${s.artista}»[${s.papel ?? "-"}]`,
        )
        .join(" | "),
  );
}

async function resolveWithDeezer(
  ideas: GeminiTrackIdea[],
  vibe: Vibe,
): Promise<MusicSuggestion[]> {
  const resolved = await Promise.all(
    ideas
      .slice(0, TOTAL_CANDIDATAS)
      .map(async (idea, i): Promise<MusicSuggestion | null> => {
        try {
          const candidatas = await searchDeezer(
            `${idea.titulo} ${idea.artista}`,
            5,
          );
          const track =
            candidatas.find((t) => mesmoArtista(t.artist.name, idea.artista)) ??
            null;

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
            origem: "gemini",
            papel: papelDe(idea, i),
            artistaId: track?.artist.id,
            genero: idea.genero?.trim() || undefined,
          };
        } catch (e) {
          console.log(
            `[music] Deezer falhou ao resolver preview de "${idea.titulo}"`,
            e,
          );
          return null;
        }
      }),
  );
  return resolved.filter((s): s is MusicSuggestion => s !== null);
}

function montarConjunto(resolvidas: MusicSuggestion[]): MusicSuggestion[] {
  const comAudio = resolvidas.filter((s) => s.previewUrl);
  const escolhidas: MusicSuggestion[] = [];
  const usadas = new Set<string>();

  for (const papel of ["certeira", "curinga", "descoberta"] as PapelFaixa[]) {
    const querem = SLOTS[papel];
    const doPapel = comAudio.filter(
      (s) => s.papel === papel && !usadas.has(s.id),
    );
    for (const faixa of doPapel.slice(0, querem)) {
      escolhidas.push(faixa);
      usadas.add(faixa.id);
    }
  }

  for (const faixa of comAudio) {
    if (escolhidas.length >= 4) break;
    if (!usadas.has(faixa.id)) {
      escolhidas.push(faixa);
      usadas.add(faixa.id);
    }
  }
  const mudas = resolvidas.length - comAudio.length;
  if (mudas > 0) {
    console.log(
      `[music] ${mudas} candidata(s) sem prévia descartada(s); ficaram ${escolhidas.length}`,
    );
  }
  return escolhidas.slice(0, 4);
}

async function verificarDescobertas(
  sugestoes: MusicSuggestion[],
): Promise<MusicSuggestion[]> {
  return Promise.all(
    sugestoes.map(async (s) => {
      if (s.papel !== "descoberta") return s;

      if (s.artistaId === undefined) return s;
      const fas = await fansDoArtista(s.artistaId);
      if (fas === null) return s;
      if (fas <= LIMITE_DESCOBERTA_FAS) {
        console.log(
          `[music] descoberta confirmada: ${s.artista} nb_fan=${fas}`,
        );
        return s;
      }
      console.log(
        `[music] descoberta rebaixada: ${s.artista} nb_fan=${fas} > ${LIMITE_DESCOBERTA_FAS}`,
      );
      return { ...s, papel: "curinga" as PapelFaixa };
    }),
  );
}

function rotularAfinidade(sugestoes: MusicSuggestion[]): MusicSuggestion[] {
  const frequentes = useTasteStore.getState().artistasFrequentes(8);
  if (frequentes.length === 0) return sugestoes;
  const normalizados = frequentes.map((a) => a.trim().toLowerCase());
  const alvo = sugestoes.findIndex((s) =>
    normalizados.includes(s.artista.trim().toLowerCase()),
  );
  if (alvo < 0) return sugestoes;
  const marcada: MusicSuggestion = { ...sugestoes[alvo], papel: "afinidade" };
  console.log(
    `[music] afinidade local: «${marcada.titulo} — ${marcada.artista}»`,
  );
  return [marcada, ...sugestoes.filter((_, i) => i !== alvo)];
}

export type EtapaCuradoria = "preparando" | "lendo" | "buscando";

export interface PhotoAnalysis {
  vibeId: VibeId | null;
  vibe?: string;
  sugestoes: MusicSuggestion[];
  looks: LookRecipe[];
}

const TETO_CACHE_ANALISE = 8;
const cacheAnalise = new Map<string, PhotoAnalysis>();

function guardarAnalise(
  photoUri: string,
  analise: PhotoAnalysis,
): PhotoAnalysis {
  cacheAnalise.set(photoUri, analise);
  if (cacheAnalise.size > TETO_CACHE_ANALISE) {
    const maisAntiga = cacheAnalise.keys().next().value;
    if (maisAntiga !== undefined) cacheAnalise.delete(maisAntiga);
  }
  return analise;
}

export async function analyzePhotoAndSuggest(
  photoUri: string,
  fallbackVibe: Vibe,
  onEtapa?: (etapa: EtapaCuradoria) => void,
): Promise<PhotoAnalysis> {
  const emCache = cacheAnalise.get(photoUri);
  if (emCache) {
    console.log(
      "[music] análise reaproveitada do cache — mesma foto, mesmas sugestões",
    );
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
    onEtapa?.("preparando");
    const marcoImagem = Date.now();

    const [base64, contexto] = await Promise.all([
      photoToBase64(photoUri),
      montarContexto(useSettingsStore.getState().usarLocalizacao),
    ]);
    tImagem = Date.now() - marcoImagem;
    bytes = base64.length;

    onEtapa?.("lendo");
    const marcoGemini = Date.now();
    const scene = await askGeminiWithPhoto(base64, contexto);
    tGemini = Date.now() - marcoGemini;

    if (scene) {
      const vibeLivre = sanearVibe(scene.vibe);

      const idDePiso = vibeIdDePiso(vibeLivre, scene.cena);
      const vibeReal = idDePiso
        ? (VIBES.find((v) => v.id === idDePiso) ?? null)
        : null;
      console.log(
        `[music] Gemini leu a cena: "${scene.cena ?? "?"}" → vibe="${vibeLivre ?? "(ilegível)"}"` +
          ` piso=${idDePiso ?? "nenhum (usando prévia local)"}`,
      );
      const vibe = vibeReal ?? fallbackVibe;
      onEtapa?.("buscando");
      const marcoDeezer = Date.now();
      const resolvidas = await resolveWithDeezer(scene.musicas ?? [], vibe);
      const tDeezer = Date.now() - marcoDeezer;
      if (resolvidas.length > 0) {
        const sugestoes = rotularAfinidade(
          montarConjunto(await verificarDescobertas(resolvidas)),
        );

        useTasteStore.getState().registrarSugeridas(sugestoes);
        console.log(
          `[music] ORIGEM=gemini-foto — ${sugestoes.length} sugestão(ões) da cena real`,
        );
        registrarFaixas("gemini-foto", sugestoes);
        registrar("gemini-foto", tDeezer);
        return guardarAnalise(photoUri, {
          vibeId: vibeReal?.id ?? null,
          vibe: vibeLivre,
          sugestoes,
          looks: montarLooks(scene.looks, vibe.id),
        });
      }

      const porVibe = await getSuggestions(vibe, onEtapa);
      registrar("pipeline-por-vibe", tDeezer);
      return guardarAnalise(photoUri, {
        vibeId: vibeReal?.id ?? null,

        vibe: vibeLivre,
        sugestoes: porVibe,
        looks: montarLooks(scene.looks, vibe.id),
      });
    }
  } catch (e) {
    console.log(
      "[music] análise da foto falhou (caiu para pipeline por vibe):",
      e,
    );
    expirou = e instanceof Error && e.name === "AbortError";
  }
  const degradado = await getSuggestions(fallbackVibe, onEtapa, expirou);
  registrar("degradado", 0);

  return guardarAnalise(photoUri, {
    vibeId: null,

    vibe: undefined,
    sugestoes: degradado,
    looks: montarLooks(undefined, fallbackVibe.id),
  });
}

export async function getSuggestions(
  vibe: Vibe,
  onEtapa?: (etapa: EtapaCuradoria) => void,
  pularGemini = false,
): Promise<MusicSuggestion[]> {
  console.log(
    `[music] getSuggestions vibe="${vibe.id}" geminiKey=${GEMINI_KEY ? "presente" : "ausente"}`,
  );

  try {
    if (pularGemini) throw new Error("Gemini pulado (tempo limite anterior)");
    onEtapa?.("lendo");
    const ideas = await askGemini(vibe);
    console.log(`[music] Gemini retornou ${ideas.length} ideia(s)`, ideas);
    if (ideas.length > 0) {
      onEtapa?.("buscando");
      const resolvidas = await resolveWithDeezer(ideas, vibe);
      if (resolvidas.length > 0) {
        const ok = rotularAfinidade(
          montarConjunto(await verificarDescobertas(resolvidas)),
        );
        useTasteStore.getState().registrarSugeridas(ok);
        console.log(
          `[music] ORIGEM=gemini — ${ok.length} sugestão(ões) usadas`,
        );
        registrarFaixas("gemini", ok);
        return ok;
      }
    }
  } catch (e) {
    console.log("[music] Gemini falhou (caiu para Deezer puro):", e);
  }

  let curadasComAudio: MusicSuggestion[] = [];
  try {
    const inéditasCuradas = (FALLBACK[vibe.id] ?? []).filter(
      (s) =>
        !new Set(useTasteStore.getState().faixasSugeridasRecentes(20)).has(
          chaveDaFaixa(s.titulo, s.artista),
        ),
    );
    if (inéditasCuradas.length > 0) {
      onEtapa?.("buscando");
      const comPreview = await resolveWithDeezer(
        inéditasCuradas.slice(0, 4).map((s) => ({
          titulo: s.titulo,
          artista: s.artista,
          justificativa: s.justificativa,
          papel: "certeira",
        })),
        vibe,
      );
      curadasComAudio = comPreview
        .filter((s) => s.previewUrl)
        .map((s) => ({ ...s, origem: "local" as const }));

      if (curadasComAudio.length >= 4) {
        useTasteStore.getState().registrarSugeridas(curadasComAudio);
        console.log(
          `[music] ORIGEM=curado — ${curadasComAudio.length} do catálogo com preview`,
        );
        registrarFaixas("curado", curadasComAudio);
        return curadasComAudio;
      }
    }
  } catch (e) {
    console.log("[music] catálogo curado não resolveu no Deezer:", e);
  }

  try {
    onEtapa?.("buscando");
    const jaOferecidas = new Set(
      useTasteStore.getState().faixasSugeridasRecentes(20),
    );

    const inicio = Math.floor(Math.random() * 4) * 2;
    const perKeyword = await Promise.all(
      vibe.musicaKeywords.map((kw) =>
        searchDeezer(kw, 10, inicio).catch(() => []),
      ),
    );
    const seen = new Set<number>();
    const tracks = perKeyword.flat().filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      if (jaOferecidas.has(chaveDaFaixa(t.title, t.artist.name))) return false;
      return faixaAproveitavel(t, vibe);
    });
    if (tracks.length > 0 || curadasComAudio.length > 0) {
      console.log(
        `[music] ORIGEM=deezer — ${tracks.length} faixa(s) via keywords`,
        vibe.musicaKeywords,
      );
      const faltam = Math.max(0, 4 - curadasComAudio.length);
      const viaKeywords = tracks.slice(0, faltam).map((t, i) => ({
        id: `deezer-${t.id}`,
        titulo: t.title,
        artista: t.artist.name,
        emoji: emojiFor(i, vibe),
        justificativa: `Combina com a atmosfera ${vibe.nome.toLowerCase()} da cena`,
        previewUrl: t.preview,
        origem: "deezer" as const,
        artistaId: t.artist.id,
      }));

      const combinadas = [...curadasComAudio, ...viaKeywords];
      useTasteStore.getState().registrarSugeridas(combinadas);
      registrarFaixas(
        curadasComAudio.length ? "curado+deezer" : "deezer",
        combinadas,
      );
      return combinadas;
    }
  } catch (e) {
    console.log(
      "[music] Deezer (keywords) falhou (caiu para catálogo local):",
      e,
    );
  }

  if (curadasComAudio.length > 0) {
    useTasteStore.getState().registrarSugeridas(curadasComAudio);
    registrarFaixas("curado", curadasComAudio);
    return curadasComAudio;
  }

  console.log(`[music] ORIGEM=local — catálogo offline para vibe="${vibe.id}"`);
  const catalogo = (FALLBACK[vibe.id] ?? []).map((s, i) => ({
    ...s,
    id: `local-${vibe.id}-${i}`,
    origem: "local" as const,
  }));
  const jaOferecidasLocal = new Set(
    useTasteStore.getState().faixasSugeridasRecentes(20),
  );
  const inéditas = catalogo.filter(
    (s) => !jaOferecidasLocal.has(chaveDaFaixa(s.titulo, s.artista)),
  );

  const local = [
    ...inéditas,
    ...catalogo.filter((s) => !inéditas.includes(s)),
  ].slice(0, 4);
  useTasteStore.getState().registrarSugeridas(local);
  registrarFaixas("local", local);
  return local;
}

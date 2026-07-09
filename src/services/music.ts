import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { VIBES } from '@/constants/vibes';
import { MusicSuggestion, Vibe, VibeId } from '@/types';

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

const EMOJIS_MOOD = ['🎧', '🎸', '🎹', '🎷', '🥁', '🎻'];

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: { name: string };
}

async function searchDeezer(query: string, limit: number): Promise<DeezerTrack[]> {
  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  const json = (await res.json()) as { data?: DeezerTrack[] };
  return (json.data ?? []).filter((t) => !!t.preview);
}

interface GeminiTrackIdea {
  titulo: string;
  artista: string;
  justificativa: string;
}

// Modelo com cota disponível no tier gratuito do AI Studio (gemini-3.5-flash e
// gemini-3.1-pro-preview retornam 429 "not enough quota" em contas novas sem billing).
// Aceita imagem de entrada (multimodal): Text, Image, Video, Audio e PDF.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

type GeminiPart = { type: 'text'; text: string } | { type: 'image'; data: string; mime_type: string };

// Interactions API (endpoint atual — o antigo v1beta/models/{model}:generateContent está deprecado)
async function callGemini(input: GeminiPart[]): Promise<string> {
  if (!GEMINI_KEY) return '';
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ model: GEMINI_MODEL, input }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  return (
    json?.steps?.find((s: { type: string }) => s.type === 'model_output')?.content?.[0]?.text ?? ''
  );
}

async function askGemini(vibe: Vibe): Promise<GeminiTrackIdea[]> {
  if (!GEMINI_KEY) return [];
  const prompt =
    `Você é o curador musical do app Synesthesia. A foto tem a vibe "${vibe.nome}" (${vibe.descricao}). ` +
    `Sugira 4 músicas reais e populares que combinem. Responda SOMENTE JSON: ` +
    `[{"titulo":"...","artista":"...","justificativa":"até 12 palavras, em pt-BR"}]`;
  const text = await callGemini([{ type: 'text', text: prompt }]);
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]) as GeminiTrackIdea[];
}

/**
 * Reduz a foto para envio ao Gemini (~640px, JPEG comprimido): corta latência
 * e tráfego sem perder o que importa para inferir a atmosfera.
 */
async function photoToBase64(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 640 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('manipulator sem base64');
  return saved.base64;
}

interface GeminiSceneResult {
  vibe: string;
  cena?: string;
  musicas?: GeminiTrackIdea[];
}

/** Foto → vibe real + faixas, numa única chamada multimodal (T-0A + T-0B). */
async function askGeminiWithPhoto(photoBase64: string): Promise<GeminiSceneResult | null> {
  if (!GEMINI_KEY) return null;
  const vibesDisponiveis = VIBES.map((v) => `"${v.id}" (${v.descricao})`).join(', ');
  const prompt =
    `Você é o motor sensorial do app Synesthesia. Analise a foto anexada e: ` +
    `1) classifique a atmosfera da cena em EXATAMENTE UMA destas vibes: ${vibesDisponiveis}; ` +
    `2) sugira 4 músicas reais e populares que combinem com o que aparece na foto. ` +
    `Responda SOMENTE JSON: {"vibe":"<id da vibe>","cena":"o que há na foto, até 10 palavras", ` +
    `"musicas":[{"titulo":"...","artista":"...","justificativa":"até 12 palavras, em pt-BR, ligada à cena"}]}`;
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
  ],
  sonhadora: [
    { titulo: 'Space Song', artista: 'Beach House', emoji: '💭', justificativa: 'Camadas etéreas como luz difusa', previewUrl: null },
    { titulo: 'Midnight City', artista: 'M83', emoji: '🌌', justificativa: 'Atmosfera flutuante e luminosa', previewUrl: null },
  ],
  romantica: [
    { titulo: 'Eu Sei Que Vou Te Amar', artista: 'Tom Jobim', emoji: '💘', justificativa: 'Clássico íntimo e afetuoso', previewUrl: null },
    { titulo: 'Perfect', artista: 'Ed Sheeran', emoji: '❤️', justificativa: 'Balada quente para dois', previewUrl: null },
  ],
  noturna: [
    { titulo: 'Nightcall', artista: 'Kavinsky', emoji: '🌙', justificativa: 'Sombras elétricas da madrugada', previewUrl: null },
    { titulo: 'After Dark', artista: 'Mr.Kitty', emoji: '🌒', justificativa: 'Pulso escuro e misterioso', previewUrl: null },
  ],
  nostalgica: [
    { titulo: 'Take On Me', artista: 'a-ha', emoji: '📼', justificativa: 'Oitentista até o último frame', previewUrl: null },
    { titulo: 'Plastic Love', artista: 'Mariya Takeuchi', emoji: '📷', justificativa: 'City pop, memória em VHS', previewUrl: null },
  ],
  aconchegante: [
    { titulo: 'Garota de Ipanema', artista: 'João Gilberto', emoji: '🕯️', justificativa: 'Bossa morna de fim de tarde', previewUrl: null },
    { titulo: 'Holocene', artista: 'Bon Iver', emoji: '🍂', justificativa: 'Folk quente como lareira', previewUrl: null },
  ],
  gelada: [
    { titulo: 'Comptine d’un autre été', artista: 'Yann Tiersen', emoji: '🧊', justificativa: 'Piano cristalino e frio', previewUrl: null },
    { titulo: 'Intro', artista: 'The xx', emoji: '❄️', justificativa: 'Minimalismo de ar gelado', previewUrl: null },
  ],
  dourada: [
    { titulo: 'Golden Hour', artista: 'JVKE', emoji: '🌅', justificativa: 'Literalmente a hora dourada', previewUrl: null },
    { titulo: 'Wave', artista: 'Tom Jobim', emoji: '🌞', justificativa: 'Luz quente em forma de som', previewUrl: null },
  ],
};

function emojiFor(index: number, vibe: Vibe): string {
  return index === 0 ? vibe.emoji : EMOJIS_MOOD[index % EMOJIS_MOOD.length];
}

/** Resolve as ideias do Gemini em sugestões com preview real (Deezer). */
async function resolveWithDeezer(ideas: GeminiTrackIdea[], vibe: Vibe): Promise<MusicSuggestion[]> {
  const resolved = await Promise.all(
    ideas.slice(0, 4).map(async (idea, i): Promise<MusicSuggestion | null> => {
      try {
        const [track] = await searchDeezer(`${idea.titulo} ${idea.artista}`, 1);
        return {
          id: `gemini-${track ? track.id : i}`,
          titulo: idea.titulo,
          artista: idea.artista,
          emoji: emojiFor(i, vibe),
          justificativa: idea.justificativa,
          previewUrl: track?.preview ?? null,
          origem: 'gemini',
        };
      } catch (e) {
        console.log(`[music] Deezer falhou ao resolver preview de "${idea.titulo}"`, e);
        return null;
      }
    }),
  );
  return resolved.filter((s): s is MusicSuggestion => s !== null);
}

export interface PhotoAnalysis {
  /** Vibe real inferida da imagem; null quando o Gemini não pôde analisar */
  vibeId: VibeId | null;
  sugestoes: MusicSuggestion[];
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
): Promise<PhotoAnalysis> {
  try {
    const base64 = await photoToBase64(photoUri);
    const scene = await askGeminiWithPhoto(base64);
    if (scene) {
      const vibeReal = VIBES.find((v) => v.id === scene.vibe) ?? null;
      console.log(
        `[music] Gemini leu a cena: "${scene.cena ?? '?'}" → vibe="${scene.vibe}"` +
          (vibeReal ? '' : ' (id inválido, mantendo vibe heurística)'),
      );
      const vibe = vibeReal ?? fallbackVibe;
      const sugestoes = await resolveWithDeezer(scene.musicas ?? [], vibe);
      if (sugestoes.length > 0) {
        console.log(`[music] ORIGEM=gemini-foto — ${sugestoes.length} sugestão(ões) da cena real`);
        return { vibeId: vibeReal?.id ?? null, sugestoes };
      }
      // Cena lida mas faixas não resolveram → pipeline por vibe, já com a vibe real
      return { vibeId: vibeReal?.id ?? null, sugestoes: await getSuggestions(vibe) };
    }
  } catch (e) {
    console.log('[music] análise da foto falhou (caiu para pipeline por vibe):', e);
  }
  return { vibeId: null, sugestoes: await getSuggestions(fallbackVibe) };
}

/**
 * Busca até 4 sugestões para a vibe. Nunca rejeita: em falha total devolve o
 * catálogo local (sem preview), preservando o fluxo de salvar (SC-004).
 */
export async function getSuggestions(vibe: Vibe): Promise<MusicSuggestion[]> {
  console.log(`[music] getSuggestions vibe="${vibe.id}" geminiKey=${GEMINI_KEY ? 'presente' : 'ausente'}`);

  // 1) Gemini cura, Deezer resolve o preview
  try {
    const ideas = await askGemini(vibe);
    console.log(`[music] Gemini retornou ${ideas.length} ideia(s)`, ideas);
    if (ideas.length > 0) {
      const ok = await resolveWithDeezer(ideas, vibe);
      if (ok.length > 0) {
        console.log(`[music] ORIGEM=gemini — ${ok.length} sugestão(ões) usadas`);
        return ok;
      }
    }
  } catch (e) {
    console.log('[music] Gemini falhou (caiu para Deezer puro):', e);
  }

  // 2) Deezer direto pelas keywords da vibe
  try {
    const perKeyword = await Promise.all(
      vibe.musicaKeywords.slice(0, 2).map((kw) => searchDeezer(kw, 3).catch(() => [])),
    );
    const seen = new Set<number>();
    const tracks = perKeyword.flat().filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    if (tracks.length > 0) {
      console.log(`[music] ORIGEM=deezer — ${tracks.length} faixa(s) via keywords`, vibe.musicaKeywords);
      return tracks.slice(0, 4).map((t, i) => ({
        id: `deezer-${t.id}`,
        titulo: t.title,
        artista: t.artist.name,
        emoji: emojiFor(i, vibe),
        justificativa: `Combina com a atmosfera ${vibe.nome.toLowerCase()} da cena`,
        previewUrl: t.preview,
        origem: 'deezer' as const,
      }));
    }
  } catch (e) {
    console.log('[music] Deezer (keywords) falhou (caiu para catálogo local):', e);
  }

  // 3) Offline — catálogo herdado do MVP Python
  console.log(`[music] ORIGEM=local — catálogo offline para vibe="${vibe.id}"`);
  return (FALLBACK[vibe.id] ?? []).map((s, i) => ({
    ...s,
    id: `local-${vibe.id}-${i}`,
    origem: 'local' as const,
  }));
}

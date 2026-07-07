import { MusicSuggestion, Vibe } from '@/types';

/**
 * Curadoria musical — até 4 sugestões por vibe (FR-005).
 *
 * Pipeline (degradação graciosa, NFR/edge cases da spec):
 * 1. Gemini (se EXPO_PUBLIC_GEMINI_API_KEY definido) gera a lista de faixas + justificativas;
 * 2. Deezer (API pública, sem chave) resolve cada faixa com preview real de 30s;
 * 3. Sem rede/sem resultados → catálogo local (herdado do musicas.json do MVP Python),
 *    sem bloquear o salvamento da foto.
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

async function askGemini(vibe: Vibe): Promise<GeminiTrackIdea[]> {
  if (!GEMINI_KEY) return [];
  const prompt =
    `Você é o curador musical do app Synesthesia. A foto tem a vibe "${vibe.nome}" (${vibe.descricao}). ` +
    `Sugira 4 músicas reais e populares que combinem. Responda SOMENTE JSON: ` +
    `[{"titulo":"...","artista":"...","justificativa":"até 12 palavras, em pt-BR"}]`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]) as GeminiTrackIdea[];
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

/**
 * Busca até 4 sugestões para a vibe. Nunca rejeita: em falha total devolve o
 * catálogo local (sem preview), preservando o fluxo de salvar (SC-004).
 */
export async function getSuggestions(vibe: Vibe): Promise<MusicSuggestion[]> {
  // 1) Gemini cura, Deezer resolve o preview
  try {
    const ideas = await askGemini(vibe);
    if (ideas.length > 0) {
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
          } catch {
            return null;
          }
        }),
      );
      const ok = resolved.filter((s): s is MusicSuggestion => s !== null);
      if (ok.length > 0) return ok;
    }
  } catch {
    // segue para o Deezer puro
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
  } catch {
    // segue para o catálogo local
  }

  // 3) Offline — catálogo herdado do MVP Python
  return (FALLBACK[vibe.id] ?? []).map((s, i) => ({
    ...s,
    id: `local-${vibe.id}-${i}`,
    origem: 'local' as const,
  }));
}

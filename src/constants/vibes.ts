import { Vibe, VibeId } from '@/types';

/**
 * Vibes / atmosferas do catálogo local (evolução dos moods do MVP terminal em
 * Python — filtros.json/musicas.json).
 *
 * ⚠️ **Mudou de papel na feature 005.** Esta tabela não *dirige* mais nada: a
 * vibe que a pessoa lê é texto livre que o Gemini extrai da própria cena
 * (FR-030), e `musicaKeywords` saiu do prompt da curadoria com foto — era ela
 * que empurrava "funk brasileiro" para uma foto sem nada brasileiro (FR-032).
 *
 * O que a tabela é hoje: **piso local**, para os quatro consumidores que
 * precisam de um valor garantido e determinístico, sem rede —
 *   1. o visor ao vivo (`detectVibe`, FR-021);
 *   2. `looksBase()`, via `filtro`;
 *   3. a busca por keyword de `getSuggestions()`, que só roda quando o Gemini
 *      não serviu — lá o rótulo é a única informação que sobrou;
 *   4. as mídias gravadas antes da 005, que só têm o id.
 */
export const VIBES: Vibe[] = [
  {
    id: 'energetica',
    nome: 'Energética',
    emoji: '⚡',
    filtro: 'vivid',
    musicaKeywords: ['pop dance hit', 'funk brasileiro', 'electro pop energetic'],
    descricao: 'Cena vibrante e cheia de movimento',
  },
  {
    id: 'sonhadora',
    nome: 'Sonhadora',
    emoji: '💭',
    filtro: 'neon',
    musicaKeywords: ['dream pop', 'synthwave', 'indie eletrônico'],
    descricao: 'Luzes difusas e clima etéreo',
  },
  {
    id: 'romantica',
    nome: 'Romântica',
    emoji: '💘',
    filtro: 'love',
    musicaKeywords: ['love song acoustic', 'mpb romântica', 'r&b slow'],
    descricao: 'Atmosfera íntima e afetuosa',
  },
  {
    id: 'noturna',
    nome: 'Noturna',
    emoji: '🌙',
    filtro: 'eclipse',
    musicaKeywords: ['dark r&b night', 'trap noturno', 'moody electronic'],
    descricao: 'Sombras profundas e mistério',
  },
  {
    id: 'nostalgica',
    nome: 'Nostálgica',
    emoji: '📷',
    filtro: 'retro',
    musicaKeywords: ['anos 80 hits', 'city pop', 'rock clássico'],
    descricao: 'Cheiro de fita cassete e memórias',
  },
  {
    id: 'aconchegante',
    nome: 'Aconchegante',
    emoji: '🕯️',
    filtro: 'vintage',
    musicaKeywords: ['lofi chill', 'bossa nova', 'folk acústico'],
    descricao: 'Calor de ambiente interno',
  },
  {
    id: 'gelada',
    nome: 'Gelada',
    emoji: '🧊',
    filtro: 'arctic',
    musicaKeywords: ['ambient chill', 'piano minimalista', 'indie frio'],
    descricao: 'Tons frios e ar cristalino',
  },
  {
    id: 'dourada',
    nome: 'Dourada',
    emoji: '🌅',
    filtro: 'honey',
    musicaKeywords: ['golden hour indie', 'soul suave', 'mpb ensolarada'],
    descricao: 'Luz quente de fim de tarde',
  },
];

export const vibeById = (id: VibeId): Vibe => VIBES.find((v) => v.id === id) ?? VIBES[0];

import { FilterDef, FilterId } from '@/types';

/**
 * Os 8 filtros do Synesthesia (Figma).
 * Render no Expo Go: overlays coloridos + style `filter` do RN (new arch).
 * Em dev build, estes parâmetros migram para shaders Skia (ver plano de arquitetura).
 */
export const FILTERS: FilterDef[] = [
  {
    id: 'vivid',
    nome: 'Vivid',
    emoji: '🌟',
    overlayColor: '#F8A20D',
    overlayOpacity: 0.08,
    imageFilter: { saturate: 1.55, contrast: 1.08 },
  },
  {
    id: 'neon',
    nome: 'Neon',
    emoji: '🌈',
    overlayColor: '#B026FF',
    overlayOpacity: 0.16,
    overlayColor2: '#00E5FF',
    overlayOpacity2: 0.08,
    imageFilter: { saturate: 1.8, contrast: 1.12 },
  },
  {
    id: 'love',
    nome: 'Love',
    emoji: '❤️',
    overlayColor: '#FF2D55',
    overlayOpacity: 0.16,
    imageFilter: { saturate: 1.25, brightness: 1.03 },
  },
  {
    id: 'eclipse',
    nome: 'Eclipse',
    emoji: '🌒',
    overlayColor: '#090506',
    overlayOpacity: 0.35,
    imageFilter: { brightness: 0.8, contrast: 1.3, saturate: 0.85 },
  },
  {
    id: 'retro',
    nome: 'Retro',
    emoji: '📼',
    overlayColor: '#D9A441',
    overlayOpacity: 0.18,
    imageFilter: { sepia: 0.35, contrast: 0.92 },
  },
  {
    id: 'vintage',
    nome: 'Vintage',
    emoji: '🧡',
    overlayColor: '#C96F2B',
    overlayOpacity: 0.2,
    imageFilter: { sepia: 0.5, saturate: 0.75 },
  },
  {
    id: 'arctic',
    nome: 'Arctic',
    emoji: '❄️',
    overlayColor: '#7FD4FF',
    overlayOpacity: 0.16,
    imageFilter: { brightness: 1.06, saturate: 0.9 },
  },
  {
    id: 'honey',
    nome: 'Honey',
    emoji: '🍯',
    overlayColor: '#F8A20D',
    overlayOpacity: 0.2,
    imageFilter: { brightness: 1.04, saturate: 1.15, sepia: 0.15 },
  },
];

export const filterById = (id: FilterId): FilterDef =>
  FILTERS.find((f) => f.id === id) ?? FILTERS[0];

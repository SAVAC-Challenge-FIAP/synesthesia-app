/**
 * Design tokens — fonte da verdade: Figma `JOVI-Challenge---FIAP-2026`
 * + kite_camera_style_guide.html (ver CLAUDE.md).
 */
export const colors = {
  ruby: '#8D1514',
  amber: '#F8A20D',
  ink: '#090506',
  parchment: '#F5EEDE',
  parchment25: 'rgba(245,238,222,0.25)',
  parchment50: 'rgba(245,238,222,0.5)',
  inkOverlay: 'rgba(9,5,6,0.6)',
  rubyGradientTop: 'rgba(141,21,20,0.5)',
  rubyGradientBottom: 'rgba(39,6,6,0.25)',
} as const;

export const fonts = {
  display: 'Syne_700Bold',
  displayExtra: 'Syne_800ExtraBold',
  monoLight: 'DMMono_300Light',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export const radii = {
  chip: 15,
  card: 12,
  modal: 16,
} as const;

export const sizes = {
  captureButton: 70,
  /** Aspecto do frame de foto no Figma (~735/913) */
  photoAspect: 735 / 913,
} as const;

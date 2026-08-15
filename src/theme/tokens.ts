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
  /** Mínimo de área tocável (FR-Q02) */
  alvoMinimo: 48,
} as const;

/**
 * `hitSlop` para controles cujo desenho do Figma é menor que 48dp (FR-Q02).
 * Cresce a área tocável **sem** mexer no tamanho visual — que é justamente o
 * que a US1 exige.
 */
export const hitSlops = {
  /** chips de ~24dp (TROCAR MÚSICA, ENVIAR ÁUDIO, filtros) → ~52dp */
  chip: { top: 14, bottom: 14 },
  /** botões de ~36–42dp (Cancelar, Confirmar, Baixar vídeo) → ~48–54dp */
  botao: { top: 6, bottom: 6 },
  /** ícones pequenos sobre mídia (lixeira da galeria, ~18dp) → ~50dp */
  icone: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

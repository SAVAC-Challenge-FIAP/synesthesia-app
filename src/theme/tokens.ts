/**
 * @docs docs/components/tokens.md
 */
export const colors = {
  ruby: "#8D1514",
  amber: "#F8A20D",
  ink: "#090506",
  parchment: "#F5EEDE",
  parchment25: "rgba(245,238,222,0.25)",
  parchment50: "rgba(245,238,222,0.5)",
  inkOverlay: "rgba(9,5,6,0.6)",
  rubyGradientTop: "rgba(141,21,20,0.5)",
  rubyGradientBottom: "rgba(39,6,6,0.25)",
} as const;

export const fonts = {
  display: "Nunito_700Bold",
  labelLight: "Lato_300Light",
  label: "Lato_400Regular",
  labelForte: "Lato_700Bold",
} as const;

export const radii = {
  chip: 15,
  card: 12,
  modal: 16,
} as const;

export const sizes = {
  captureButton: 70,
  photoAspect: 735 / 913,
  alvoMinimo: 48,
} as const;

export const hitSlops = {
  chip: { top: 14, bottom: 14 },
  botao: { top: 6, bottom: 6 },
  icone: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

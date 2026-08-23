# Documentação de `FilterLayer.tsx`

Overlays de cor que dão a identidade do filtro sobre o visor ao vivo ou
sobre uma foto.

Reavaliado na US3 (T045): com o render de foto por Skia (`FilteredImage`),
o overlay virou parte da receita desenhada no Canvas (`renderLook.ts`,
`FilteredImageSkia`), e não passa mais por aqui. Este componente continua
existindo por dois consumidores que **não** usam Skia: o visor ao vivo em
`app/camera.tsx` (FR-021 — sem rede, sem depender de rebuild nativo) e o
render legado de foto em `FilteredImage.tsx`, a rede de segurança enquanto
o dev build não tiver o módulo nativo do Skia (research R3).


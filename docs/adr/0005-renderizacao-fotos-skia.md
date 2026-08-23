# ADR-0005 — Renderização de Fotos com Skia vs Legado

**Status**: Aceita · **Data**: 2026-08-22

Registro de como renderizamos fotos e miniaturas.

## Renderização via Skia Opcional e Limitada

O módulo nativo `@shopify/react-native-skia` exige que imagens sejam carregadas em memória nativa. O `useImage()` do Skia não faz *downsampling* automático como a tag `<Image>` nativa.
Ao usar o Skia para exibir a foto do modal de Captura, ele causava estouro de memória (SIGSEGV).

1. O Skia é usado para aplicar os "Looks" com extrema fidelidade multiplataforma usando Matrizes de Cor 4x5, compostas sequencialmente (saturação → contraste → brilho → sepia).
2. Na tela, o Skia só atua sobre a visualização grande da foto. Para isso, criamos primeiro uma prévia de baixa resolução usando `expo-image-manipulator`.
3. Nas miniaturas e na Galeria, voltamos ao render legado (`style.filter` do RN + `FilterLayer`), pois a diferença não justifica alocar 250MB+ em miniaturas.

## Geração do Arquivo Exportável Offscreen
Para exportação, a imagem final (com look) é processada via Skia offscreen. O limite foi estipulado em 12 MP (para não estourar RAM), e o output é forçado em formato JPEG, uma vez que `makeImageSnapshot()` em PNG produziria payloads massivos pela ponte JS.

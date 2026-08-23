# Documentação de `FilteredImage.tsx`

/** null = foto original, sem filtro (T-0B) */

Receita completa (feature 003). Quando presente, manda: `filtroId` vira
apenas a âncora e o render usa o preset base mais os desvios.

Os dois convivem porque nem todo chamador tem receita — o visor ao vivo
(FR-021), as miniaturas dos 8 presets e as mídias antigas seguem passando
só `filtroId`, e isso continua sendo um caminho de primeira classe.

Habilita o render por Skia. **Desligado por padrão, de propósito.**

`useImage()` do Skia carrega a imagem inteira, sem downsampling — não há
API para pedir resolução reduzida. Com as fotos de 64 MP desta câmera, um
único card custa ~256 MB de bitmap descomprimido; a galeria, com seis
cards, tentava ~1,5 GB e derrubava o app (SIGSEGV em `mqt_v_js`, medido
em 2026-08-21). O `<Image>` do RN, por outro lado, faz downsampling
sozinho para o tamanho de exibição.

Por isso o Skia vale só onde a fidelidade se paga e há **uma** imagem na
tela: a prévia grande do modal de Captura, onde a pessoa compara os três
looks de perto. Galeria e miniaturas usam o render leve — a diferença de
cor é imperceptível num card pequeno, o custo não.

Foto com o tratamento aplicado (feature 003, US3).

Dois caminhos de render, escolhidos em runtime:
- **Skia** (`FilteredImageSkia`, abaixo): uma matriz de cor 20 floats +
overlay desenhados no Canvas — fiel em Android e iOS, o que fecha FR-025.
- **RN legado** (`FilteredImageLegado`): `style.filter` do RN + `FilterLayer`
— o render que o app sempre teve, e a rede de segurança enquanto o Skia
nativo não estiver presente no dev build (research R3).

Nenhum dos dois é importado estaticamente daqui: `carregarSkia()` só
resolve depois de tentar o `import()` do módulo nativo, e só então este
componente decide qual dos dois renderiza. Até lá — e para sempre, se o
rebuild nunca rodar — o legado responde sozinho, sem qualquer diferença de
comportamento em relação a antes desta feature.

Render antigo: `style.filter` do RN (Android integral, iOS só `brightness`)
mais `FilterLayer` para o overlay de identidade. É a dívida que a US3 paga
— três looks distintos ficam menos distintos em iOS do que deveriam aqui.

Render por Skia (T035): uma matriz de cor no Canvas em vez de quatro
filtros de estilo — igual nos dois sistemas, porque não depende de
`style.filter` do RN.

Nada aqui importa `@shopify/react-native-skia` estaticamente: `Canvas`,
`Image` e `ColorMatrix` vêm do módulo já carregado (`mod`), recebido como
prop de quem só monta este componente depois de confirmar que o nativo
respondeu (`FilteredImage` acima). É o que garante que o `import()` do
pacote só é avaliado uma vez, e só quando já se sabe que não vai lançar.


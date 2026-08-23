# Documentação de `FilterThumbs.tsx`

/** URI da foto da sessão — é ela que aparece dentro de cada miniatura */

/** null = "Original" (sem filtro, T-0B) */

/** "Original" + os 8 filtros: a foto sem filtro é uma escolha de primeira classe. */

/** Figma 468:950 — miniatura 70×93, intervalo de 10 (frames em x = 0, 80, 160...) */

Acima desta ampliação de fonte do sistema o nome sai só da miniatura
selecionada. Em 70px de largura o rótulo já vive em 9px; esticá-lo mais
truncaria os oito ao mesmo tempo. Era a alternativa combinada no T054, e o
nome do filtro em caixa alta continua visível na linha "FILTRO" logo acima.

Miniatura memoizada — mesmo motivo do `Chip` do carrossel de emoji, e mais
forte aqui: sem memo, cada troca de filtro redesenharia as nove imagens
filtradas, não nove textos.

Carrossel de filtros do **modal de captura**: a própria foto da sessão
miniaturizada com cada filtro aplicado, o emoji ao centro e o nome embaixo
(Figma 462:926 → "Filtros disponiveis", acima do bloco de música).

O visor da câmera continua com o `FilterCarousel` de chips de emoji, e isso
é de propósito: lá não existe foto capturada para miniaturizar. Os dois
carrosséis são diferentes porque as duas telas são diferentes — não é
inconsistência a ser "corrigida".

As nove miniaturas leem a cópia reduzida, não a foto de 64 MP.

Cada `<Image>` decodifica seu próprio bitmap: nove decodificações de um
JPEG de ~5,7 MB para exibir em 70×93px era boa parte do 1 GB que o modal
de Captura chegou a ocupar (medido em 2026-08-21). A mesma cópia de
~435 KB serve as nove — e `previaParaSkia` memoiza por `uri`, então a
prévia grande e as miniaturas compartilham o mesmo arquivo, gerado uma
vez só.

Enquanto o resize não termina, as miniaturas usam a original: é o
comportamento de antes, e só dura o primeiro instante.


# Documentação de `filters.ts`

Os 8 filtros do Synesthesia (Figma).
Render no Expo Go: overlays coloridos + style `filter` do RN (new arch).
Em dev build, estes parâmetros migram para shaders Skia (ver plano de arquitetura).

Faixas seguras (feature 003, research R2). Ficam aqui, e não em `looks.ts`,
porque descrevem os **parâmetros de filtro** — e porque `looks.ts` já importa
este arquivo: pôr as faixas lá criaria import circular.

São duas barreiras em série, e as duas são necessárias. Limitar só o delta não
basta: um desvio legítimo somado a um preset que já é extremo (o Eclipse tem
contraste 1.3) ainda sairia da faixa.

/** Barreira 1 — o desvio que se aceita do modelo. */

/** Barreira 2 — o valor absoluto que chega ao render. */

Limita um número a uma faixa. Valor não numérico vira o neutro informado —
nunca `NaN`, senão um único campo podre do modelo apagaria a imagem inteira.

Receita → filtro efetivo: preset base + desvios, com a Barreira 2 aplicada.

O `id` do resultado continua sendo o do preset base, e isso é de propósito:
é o que mantém a ancoragem visível para o resto do app (miniaturas, galeria,
`chavePacote`) sem que ninguém precise conhecer a receita.


# Documentação de `RangeSlider.tsx`

/** Distância mínima entre as duas bolinhas, na unidade dos valores. */

Posição absoluta da reprodução, para pintar o quanto do trecho já tocou.
Fica **dentro** da faixa selecionada, então o movimento acontece no próprio
trilho — sem precisar de uma segunda barra só para mostrar andamento.

/** Chamado ao **soltar** a bolinha, não a cada pixel — ver nota abaixo. */

Seletor de faixa com duas bolinhas num trilho só — o padrão que o mercado usa
para recortar um trecho, e o que está no Figma (nó 462-926).

Construído à mão com `PanResponder` porque o `@react-native-community/slider`
só tem um thumb, e trazer uma biblioteca de range slider seria desvio da stack
fixada no CLAUDE.md. Como o desenho é simples — dois círculos sobre um trilho
pintado —, o custo de fazer à mão é menor que o de mais uma dependência.

**Por que `onChange` só dispara no release**: cada mudança de recorte invalida
o vídeo pré-gerado (ver `preExport.ts`). Emitir a cada pixel arrastado faria a
chave do pacote mudar dezenas de vezes por gesto. Durante o arraste o
componente se desenha com estado local; quem está de fora só ouve o resultado.


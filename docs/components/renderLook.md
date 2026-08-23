# Documentação de `renderLook.ts`

Área máxima (em pixels) da surface offscreen — 12 MP.

Não é preferência estética: acima disso o Skia nativo estoura a memória e
derruba o processo com SIGSEGV, sem exceção de JS para capturar. Ver o
comentário em `renderizarLook` para o caso medido que motivou o teto.

Render offscreen em resolução cheia (feature 003, US3, research R3).

Substitui o `captureRef(previewRef)` de `CaptureSheet.tsx`: aquele é
literalmente um print da prévia, então o arquivo nasce na resolução da
*tela*, não da *foto* (FR-024). Aqui a matriz de cor e o overlay do preset
são desenhados sobre a imagem original, na resolução com que ela foi
capturada — limitada a `AREA_MAXIMA` por segurança de memória (fotos de
64 MP matavam o processo; ver o comentário no corpo da função).

`null` sempre que o Skia nativo não está disponível ou qualquer etapa falha
— quem chama (`CaptureSheet.renderizarComFiltro`) cai para o caminho antigo
nesse caso. Nunca lança: perder a foto por causa do render do filtro seria
pior que entregá-la sem o tratamento mais fiel.

/** Atalho para quem já tem o `LookRecipe` em vez do `FilterDef` resolvido. */


# Documentação de `looks.ts`

Montagem dos três looks sugeridos por foto (feature 003).

O contrato com quem chama é curto e vale sempre: **três receitas ancoradas,
válidas e distintas entre si**, com ou sem rede, com ou sem chave do Gemini,
com ou sem histórico. Nenhum consumidor precisa validar nada — se precisasse,
a validação estaria no lugar errado.

Este arquivo existe separado de `music.ts` de propósito: `music.ts` já
concentra a cadeia inteira de degradação musical, e enfiar a visual lá dentro
misturaria duas máquinas de estado que só têm em comum a chamada de rede.

/** Papéis que o modelo tem permissão de emitir — `afinidade` é sempre local. */

/** Ordem dos papéis pedidos ao Gemini; vale quando o campo `papel` não presta. */

Desvio mínimo que separa um look do preset de onde ele parte (T105).

O Gemini às vezes devolve `ajustes` todos em zero — e um look sem desvio é o
preset puro com outro nome: ele ocupa um dos três lugares do carrossel
repetindo uma miniatura que já está ali ao lado, e a sugestão perde o
sentido. Como pedir de novo custaria outra ida à rede (e a pessoa não pode
esperar), o desvio é aplicado **aqui**, localmente e de graça.

Os valores são pequenos de propósito: o suficiente para a miniatura ler como
tratamento próprio, longe de desfigurar a foto. `certeira` recebe menos que
`ousada` — é o papel que promete "realça o que a cena já tem".

Nome autoral de cada preset, por papel (T107).

Existe porque a alternativa era pior: sufixar o preset ("Neon Livre", "Vivid
Suave") produz rótulo de sistema, e o público deste app lê nome de filtro
como identidade — "Neon Livre" não é nome que ninguém escolhe, é nome que
alguém gerou. Como estes rótulos só aparecem quando o Gemini **não** deu
nome (falha de rede, chave ausente, resposta sem `nome`), eles precisam
segurar a tela sozinhos.

Duas palavras no máximo, sempre evocando o que o tratamento faz com a foto —
a mesma régua que o prompt pede ao modelo.

/** Nome autoral do preset para aquele papel; cai no nome do preset se faltar. */

Abaixo desta distância dois looks são a mesma imagem com nomes diferentes.

Calibrado por inspeção dos 8 presets (research R2): os dois mais próximos
entre si, `vivid` e `honey`, ficam em ~0.19. Um limiar de 0.12 nunca acusa
dois presets base distintos como redundantes, mas ainda pega dois looks que o
modelo devolveu praticamente iguais.

Barreira 1 do clamp (FR-026): limita o **desvio** aceito do modelo.

Recebe `unknown` porque é isto que chega de um JSON de modelo — e um campo que
veio como string, `null` ou `NaN` precisa virar 0, não derrubar o look.

Identidade de um look: a âncora mais os cinco ajustes arredondados.

O `nome` fica de fora — dois looks com nomes diferentes e a mesma receita são
o mesmo look. É o que `chavePacote` usa para não servir o vídeo de um look
para outro, e o que o histórico de gosto usa para agrupar escolhas.

A sugestão que vem do histórico do aparelho (FR-013).

Consulta **só** `useLookTasteStore`, localmente. Nada disto entra no prompt do
Gemini, nem pode entrar (FR-014).

Devolve `null` quando o histórico daquela vibe não tem sinal suficiente — o
limiar mora na store, junto do cálculo de peso. Aqui `null` não é falha: é o
caso normal de aparelho novo, e o slot vira mais uma sugestão de cena em vez
de exibir um rótulo que mente sobre a própria origem (FR-015).

Distância entre duas receitas, em unidades de faixa.

Compara os valores **absolutos resolvidos**, não os deltas: dois presets
diferentes com ajustes opostos podem convergir para a mesma imagem, e comparar
deltas não veria isso. Cada eixo é normalizado pela largura da própria faixa,
senão `sepia` (0–0.8) pesaria menos que `saturate` (0–2) sem motivo.

/** Um look é redundante quando já existe outro perto demais no conjunto. */

Interpreta uma ideia crua do Gemini. Devolve `null` só quando não há âncora —
todo o resto se corrige (ver a tabela de degradação em `contracts/gemini-look.md`).

Um look tem de ser diferente do preset de que parte (T105).

`clampAjustes` já devolve `{}` quando o modelo manda ajustes inválidos ou
todos em zero — e nesse caso a receita renderiza **idêntica** ao preset,
que na prática é o preset repetido no carrossel com outro rótulo. Em vez de
pedir de novo ao Gemini (outra ida à rede, com a pessoa esperando), aplica-
se aqui o desvio mínimo do papel: sai de graça, na hora, e o look passa a
valer o lugar que ocupa.

Looks derivados só da vibe — o degrau do meio da cadeia de degradação
(FR-019) e a reserva que completa o conjunto quando o modelo entrega pouco.

Determinístico de propósito (FR-009): a mesma vibe produz sempre os mesmos
looks, na mesma ordem. O primeiro é o preset que a vibe já apontava — a
tabela fixa antiga vira o piso do sistema novo, não some.

Monta o conjunto final de três (FR-001).

Ordem das operações, e cada uma responde a um edge case da spec:
1. o slot de afinidade, do histórico local, se houver sinal (FR-013/FR-015);
2. converte as ideias do modelo, descartando as sem âncora;
3. remove as redundantes entre si (D4 — "três escolhas reais", não três chips);
4. completa com looks base da vibe até fechar três, pulando os que também
seriam redundantes.

A afinidade entra **primeiro** porque é a principal: é ela que a pessoa pediu
como recomendação de topo, e é ela que faz o app melhorar com o uso. As outras
duas seguem vindo só da cena, sem influência do histórico (FR-017).

Nunca rejeita. Sem ideia nenhuma — sem rede, sem chave, tempo estourado — o
resultado é três looks base, e o caminho de salvar segue igual (FR-020).

Reconstrói o conjunto de uma mídia salva antes desta feature (FR-023).

`looks` ausente significa "não sei", não "não há" — então o que se devolve é
o conjunto base da vibe, com o tratamento que a mídia realmente tinha na
frente. Sem inventar sugestões que nunca existiram.

Matriz de cor do Skia (feature 003, US3, research R3).

Uma matriz de cor 4×5 (RGBA + offset) representa uma transformação afim:
`saida = M · entrada`. Compor duas transformações em série — aplicar B e
depois A — é multiplicar as matrizes: `M = A · B`. É isto que permite
combinar saturação, contraste, brilho e sepia numa matriz só, em vez de
quatro filtros encadeados no Canvas (um passe de GPU em vez de quatro).

As linhas ficam concatenadas: índices `[0..4]` = R, `[5..9]` = G,
`[10..14]` = B, `[15..19]` = A. Skia opera em ponto flutuante 0–1, não em
0–255 — por isso o offset do contraste é `0.5`, não `127.5`.

/** `M = a · b`, ou seja: aplica `b` e depois `a`. */

/** Pesos de luminância padrão (Rec. 601), a mesma base de todo filtro CSS/SVG de saturação. */

/** Escala em torno do cinza médio (research R3): `c` na diagonal, offset `0.5·(1-c)`. */

/** Escala uniforme na diagonal — sem offset, então preto continua preto. */

/** Interpola entre identidade e a matriz sepia clássica pelo fator (research R3). */

Converte um `FilterDef` já resolvido (`resolverReceita()` ou `filterById()`)
na matriz de cor 20 floats que o `Skia.ColorFilter.MakeMatrix` espera.

Opera sobre o `FilterDef` resolvido, não sobre o `LookRecipe` cru: é o
denominador comum entre um look com receita e um dos 8 presets escolhido
puro, e os dois já passam pela mesma barreira de clamp antes de chegar aqui.

Ordem de composição (research R3): saturação → contraste → brilho → sepia.
O overlay de cor do preset **não** entra na matriz — vira um `Skia.Paint`
desenhado por cima, por quem chama (`renderLook.ts`, `FilteredImage.tsx`).


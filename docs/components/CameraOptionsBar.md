# Documentação de `CameraOptionsBar.tsx`

Painel "+ Opções" do visor — nó [462:889](https:

Barra de 382×24 com `paddingHorizontal: 10` e `space-between`, na ordem do
Figma: fechar · flash · resolução · ajustes. Antes o chip "+ OPÇÕES"
empurrava direto para os Ajustes; agora ele abre isto, e quem leva aos
Ajustes é a engrenagem.

A tipografia do "12M" no Figma é DM Mono, que está **desatualizada** desde a
D2/T046 — o código usa `fonts.label` (Lato) com `letterSpacing`, que é o que
mantém as labels com caráter técnico depois da troca de família.

Cada slot só aparece quando tem função de verdade: um ícone que não faz nada
é pior que ícone nenhum, porque promete.

/** Rótulo de megapixels em uso; `null` esconde o slot. */

Alterna para a próxima resolução disponível. Quando ausente, o rótulo
segue apenas informativo — que era o comportamento antes de a resolução
virar escolha.

/** Controle de flash (T067). */

/** Seletor de enquadramento (T066). */

Megapixels a partir da maior resolução que o sensor oferece — é isto que faz
o rótulo dizer a verdade em vez de repetir o "12M" que estava desenhado no
Figma. Formato do `expo-camera`: "4000x3000".

Opções de resolução oferecidas à pessoa, da maior para a menor.

Não são todos os tamanhos do sensor: este aparelho lista dezenas, muitos em
proporções esquisitas, e uma lista assim vira ruído. Filtra-se pela
proporção pedida e escolhe-se no máximo três degraus bem separados — grande,
médio, pequeno — que é o que dá controle real sem virar menu de engenharia.

Menos megapixels significa disparo mais rápido, menos memória e arquivo
menor; a resolução máxima deste sensor (64 MP) é justamente a que mais pesa.

/** "4000x3000" -> "12M". O rótulo curto que cabe na barra. */

Mesma tipografia dos chips de enquadramento (4:3 · 1:1 · 16:9), a pedido
do Sávio: são controles do mesmo tipo — escolhas discretas de captura — e
ler os dois no mesmo registro faz a barra parecer uma coisa só, em vez de
quatro elementos com pesos diferentes disputando a atenção.

/** Tocável: um passo de contraste acima do informativo, sem virar botão. */


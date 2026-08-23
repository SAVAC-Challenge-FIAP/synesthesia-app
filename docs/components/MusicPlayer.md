# Documentação de `MusicPlayer.tsx`

/** A prévia do Deezer tem 30s — é o teto do que dá para recortar. */

/** Piso do recorte: abaixo disso o vídeo não dá tempo de ser visto. */

Espera máxima por uma prévia remota antes de declará-la expirada (T102).

Generoso de propósito: 10s cobre 3G ruim sem nunca chegar ao "para sempre"
que o QA viu. Passando disso, a tela diz o que houve e oferece recarregar,
em vez de girar calada.

/** `0:07`, `1:05` — o formato das marcas no Figma (nó 462-926). */

Cede a saída de áudio a outro player (T044). Este componente e o
`MusicSheet` têm players independentes de `expo-audio`, e nenhum enxerga o
outro: com o modal de música aberto por cima, dar play numa sugestão fazia
as duas faixas soarem juntas. Quem monta decide quem é o dono da vez.

Caminho local do .mp3 já baixado, quando existe (T102). Tem precedência
sobre `musica.previewUrl`: o link do Deezer expira e depende de rede a cada
reabertura, e era isso que deixava a trilha de uma mídia reaberta pela
galeria carregando para sempre. Ausente = mídia antiga ou trilha ainda não
salva; aí a URL remota segue valendo, agora com falha visível.

Player do trecho sonoro (FR-006/FR-008): recorta a prévia de 30s no pedaço
que vira vídeo. Monte com `key={musica.id}` para recriar o player ao trocar
de faixa.

Segue o Figma (nó 462-926): **um trilho com duas bolinhas**, marcas de tempo
embaixo e a legenda `Trecho · 0:00 → 0:15`. Duas versões anteriores erraram
aqui — primeiro um slider único que definia só o início e ficava parado
enquanto a música tocava, depois dois sliders empilhados, que resolviam a
função mas não são o padrão que o mercado usa nem o que o design pede.

Arquivo local primeiro, link do Deezer como reserva (T102). A ordem é o
conserto: `previewUrl` é uma URL assinada e temporária — mídia recente
ainda tocava, mídia de dias atrás não, e o player não tinha como distinguir
"carregando" de "nunca vai carregar".

Prévia que não carrega em tempo hábil (T102).

Sem isto, uma fonte morta deixava o botão de play mudo e o trilho parado,
sem nada na tela dizendo o que houve — o sintoma de "carregando para
sempre" que o QA relatou. Só vale para a fonte remota: um arquivo local
ou carrega ou estoura na hora.


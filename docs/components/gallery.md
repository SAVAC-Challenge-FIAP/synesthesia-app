# Documentação de `gallery.tsx`

Galeria inteligente (US7): pacotes sensoriais persistentes — revisitar,
lapidar (reabrir edição) e excluir com confirmação (FR-012).

Pré-carrega as outras sugestões em segundo plano (T106).

A trilha escolhida já toca do disco (T102), mas as outras três só tinham
a URL do Deezer — que expira. Quem reabre um momento e vai em "Trocar
música" costuma fazê-lo logo em seguida, então baixar agora é a diferença
entre a prévia tocar na hora e não tocar nunca.

Deliberadamente sem `await`: é adiantamento, não etapa do fluxo. Reabrir
a mídia não espera por rede nenhuma, e cada falha morre em silêncio no
`catch` — a faixa simplesmente segue dependendo da URL, como antes.

Voltar — do gesto/botão do sistema e do chevron do cabeçalho.

Chegando aqui por `replace` (o caminho de "salvei agora"), não existe
entrada anterior na pilha: `back()` falha com "GO_BACK was not handled" e
o toque não faz nada. A câmera é o destino certo nos dois casos.

Vibe livre não tem emoji, e isso é decisão (feature 005, D4):
pedir um ao Gemini somaria um campo que pode vir vazio, errado
ou com um glifo que a fonte não tem — para ganhar decoração.
Mídia antiga tem um emoji de verdade no catálogo, e aí ele volta.

Vitrine uniforme (T082): todo card é quadrado, independentemente do
enquadramento com que a foto foi tirada. A grade antes usava a proporção de
cada mídia, e uma 16:9 ao lado de uma 1:1 deixava a coluna serrilhada.

A proporção real não se perde: ela continua em `Media.aspecto` e é ela que
manda na tela de captura. Aqui é só miniatura.

A `FilteredImage` desenha a foto em `absoluteFill` — ela precisa de um
container com altura própria. Este estilo declarava só `width: '100%'`, sem
altura: cada card ficava com 0px de foto, e foi por isso que as prévias
sumiram da galeria (T081).

Com o card quadrado, os metadados passam a flutuar sobre o rodapé da foto —
antes eles ocupavam altura própria e disputavam espaço com a imagem.


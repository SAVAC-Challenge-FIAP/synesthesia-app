# Documentação de `camera.tsx`

Visor principal (US1/US2): prévia de vibe determinística (hora + câmera),
filtro ao vivo opcional, carrossel manual (com "Original"), flip
frontal/traseira, grade e atalho para Ajustes. A vibe REAL é inferida da
foto na captura (T-0A), então o visor mostra "PRÉVIA" — sem timer/sorteio.

A câmera só existe enquanto esta tela está em foco (T063).

É esta linha que cumpre o objetivo da Fase 15, não a mudança de modal para
rota. O T062 mediu que `/settings`, empilhada por cima daqui, deixava o
cliente de câmera ativo: o `expo-router` mantém a tela de baixo montada, e
a `CameraView` continuava produzindo frames para ninguém.

Desmontar é a única alavanca no Android — a prop `active` da `CameraView`,
que existiria para isso, é `@platform ios`.

A câmera só monta **depois** que a navegação assenta (T097).

O bug: voltar dos Ajustes para o visor deixava a prévia esticada, e só
trocar o enquadramento consertava. A causa é que a `CameraView` remontava
no mesmo instante em que a tela recebia o foco — ou seja, no meio da
transição do `expo-router`, quando o container ainda não está no tamanho
final. A surface nativa se configura pelo primeiro layout que enxerga e
**não** se recalibra sozinha; trocar o enquadramento só funcionava porque
mudar o tamanho do container a obrigava a refazer a conta.

`runAfterInteractions` espera a transição terminar. Aí o primeiro layout
que a surface vê já é o definitivo.

As faixas da tela, medidas no layout (T093). São quatro, de cima para
baixo: barra de opções, área útil, filtros e controles. O visor se posiciona
em relação a elas, e cada enquadramento escolhe a sua âncora.

Os insets entram na conta porque a camada do visor é `absoluteFill` dentro
da `SafeAreaView`, e `absoluteFill` **ignora o padding** dela: a camada vai
até a borda física, enquanto a barra de controles para na borda segura.
Sem descontar isso, o 16:9 ancorado "no topo dos controles" descia a altura
da barra de navegação inteira — e voltava a aparecer atrás dos botões.

/** FULL não tem razão própria: a razão dele é a da tela. */

Resolução do sensor que já nasce no enquadramento escolhido (T086).

Quando existe, a `CameraView` recebe essa `pictureSize` e a foto sai pronta:
nada é recortado depois, e o que o visor mostrou é o que o arquivo tem. O
1:1 não existe em sensor nenhum — ali `null` significa "vai ter de cortar".

Posição e altura do visor, animadas (T077/T091/T093). **A largura é sempre
a da tela**, nos quatro enquadramentos.

O que muda entre eles é a âncora, e ela não segue da razão — é escolha,
declarada em `ENQUADRAMENTOS`:

- 4:3 e 1:1 cabem na área útil e ficam centralizados **nela**, entre a barra
de opções e os filtros. Centralizá-los na tela inteira, como a versão
anterior fazia, subia os dois e desalinhava o que já estava bom.
- 16:9 não cabe: encosta no topo dos controles e cresce para cima. Ancorado
assim, ele não deixa faixa de imagem sobrando entre os filtros e os
botões — que era o "passa por baixo dos controladores" que o Sávio viu — e
passa por baixo dos filtros e das opções inteiro, nunca pela metade.
- FULL é a tela toda, atrás de tudo.

A animação corre sobre o **índice** do enquadramento, não sobre a razão:
`top` e `height` de cada um são pontos conhecidos, e interpolar entre eles
mantém a transição contínua mesmo com âncoras diferentes.

O visor abre **sem filtro**, e a sugestão automática deixa de existir aqui.

Antes, com `filtroAutomatico` ligado, o visor já aplicava `vibe.filtro` e
o chip aparecia marcado "· AUTO". Isso prometia curadoria onde ela ainda
não existe: a vibe do visor é uma **prévia determinística** (hora do dia +
câmera frontal/traseira), não uma leitura da cena. A leitura de verdade só
acontece depois do disparo, quando o Gemini vê a foto — e é lá, no modal
de Captura, que os três looks sugeridos aparecem.

Começar em Original também deixa a pessoa ver a cena como ela é antes de
decidir tratá-la, e os oito presets seguem a um toque no carrossel.

`filtroAutomatico` (Ajustes) continua valendo para a sugestão pós-captura;
só não manda mais no visor.

Lê as resoluções reais do sensor. Serve a duas coisas: o rótulo de
megapixels do painel (o Figma traz "12M" cravado, e repetir isso seria
inventar um número sobre o aparelho de quem usa) e, desde o T086, a escolha
da `pictureSize` que já sai no enquadramento certo.

Passou a rodar assim que a câmera fica pronta, e não mais só quando o painel
abre: agora a lista decide como a **foto** é tirada, então precisa estar em
mãos antes do primeiro disparo, não depois de alguém abrir "+ Opções".

Resolução escolhida pela pessoa (item 4 do QA do Sávio).

Antes o "64M" era só um rótulo do maior tamanho do sensor, e dava a
entender que se podia trocar. Agora troca de verdade: `opcoesDeResolucao`
devolve até três degraus na proporção do enquadramento atual, e tocar no
rótulo cicla entre eles. Menos megapixels = disparo mais rápido, menos
memória e arquivo menor — o oposto dos 64 MP que pesavam o app.

`null` = ainda não escolheu; vale o que `escolherTamanhoNativo` decidir,
que é o comportamento de sempre.

O que de fato vai para a `CameraView`: a escolha da pessoa quando existe,
senão o tamanho que já nasce no enquadramento certo (T086).

Flash (T067) — três estados **visíveis**, não um toggle cego: a pessoa
precisa saber se está em automático ou forçado antes de disparar.

Câmera frontal deste tipo de aparelho não tem flash. Em vez de mostrar um
controle que não faz nada — e portanto mente —, ele fica esmaecido e
inerte, e o modo volta para `off` para o ícone não prometer luz que não vem.

O que barateia o disparo (T085/T086) é a `pictureSize`: pedindo ao
sensor um modo que já tem a proporção escolhida, o preparo vira só o
giro, sem recorte — e sem os 64MP que este aparelho entregava por
padrão, que eram o grosso do tempo de recodificação.

O giro em si não tem como ser pulado: o arquivo vem deitado do
sensor, e é ele que precisa ir para o pacote em pé.

Faixa em que o visor pode viver: do topo da tela até o topo dos controles.
Ele se centraliza aqui dentro — no 4:3 e no 1:1 sobra folga dos dois lados;
no 16:9 a altura toma quase tudo e o carrossel passa a flutuar por cima.


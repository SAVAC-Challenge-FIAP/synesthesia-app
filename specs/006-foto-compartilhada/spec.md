# Feature Specification: Foto compartilhada de fora do app

**Feature Branch**: `feature/006-foto-compartilhada`

**Created**: 2026-09-21

**Status**: Implementada

**Input**: User description (Sávio, 2026-09-21): "preciso que vc crie uma nova feature eu poder
pegar qualquer foto da galeria e pode compartilhar com o app Synesthesia, aí ele já cai na aba de
processamento da imagem."

## Contexto

Hoje só existe uma porta de entrada para uma foto nova: o disparo do visor. Tudo o que o app sabe
fazer — ler a cena com o Gemini, sugerir três looks, curar a trilha, montar o pacote sensorial —
está preso a fotos tiradas **agora**, com o app já aberto.

Isso deixa de fora o gesto mais natural de quem usa rede social: a pessoa está na galeria, vê a
foto de ontem, e quer postar. Nesse momento ela não quer abrir o Synesthesia, navegar até algum
lugar e procurar a foto; ela quer tocar em "Compartilhar" e escolher o Synesthesia, do mesmo jeito
que escolheria o Instagram.

O ganho é direto no pilar de **redução do atrito de decisão**: a foto entra pelo caminho que a
pessoa já conhece, e o app assume a partir do ponto em que ele é bom — a leitura da cena e a
curadoria. O acervo inteiro do aparelho vira matéria-prima, não só o que a câmera do app capturou.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Synesthesia aparece no compartilhar do sistema (Priority: P1)

Na galeria do aparelho (ou em qualquer app que compartilhe imagem), ao tocar em "Compartilhar", o
Synesthesia aparece entre os destinos, com o ícone e o nome do app.

**Teste**: abrir a galeria do sistema, escolher uma foto, tocar em compartilhar, verificar que o
Synesthesia está na lista.

### User Story 2 - A foto cai direto na tela de captura (Priority: P1)

Ao escolher o Synesthesia, o app abre já com aquela foto na **tela de captura** — a mesma do
disparo —, com a análise do Gemini rodando (vibe, três looks, trilha). Nenhuma tela intermediária,
nenhuma escolha a fazer antes.

**Teste**: compartilhar uma foto com o app fechado; o app abre, mostra um preparo curto e entra na
tela de captura com a foto; a vibe e a música aparecem quando a curadoria responde.

### User Story 3 - Funciona com o app já aberto (Priority: P2)

Se o Synesthesia já estava aberto (em qualquer tela — câmera, galeria ou uma captura em andamento),
compartilhar uma foto traz o app para frente e substitui o conteúdo da tela de captura pela foto
recebida.

**Teste**: abrir o app, ir para a galeria do app, alternar para a galeria do sistema, compartilhar
uma foto, verificar que o app volta já na captura com a foto certa.

### User Story 4 - A foto entra na orientação certa (Priority: P2)

Fotos tiradas na vertical com a câmera do próprio aparelho guardam a orientação em metadado (EXIF)
em vez de nos pixels. A foto recebida precisa chegar na tela **em pé**, como aparece na galeria do
sistema — e continuar em pé no pacote exportado.

**Teste**: compartilhar uma foto vertical tirada pela câmera nativa; conferir que ela aparece em pé
na captura e no `.mp4` gerado.

### User Story 5 - Descartar volta para o app, não para o vazio (Priority: P3)

Quem abriu o app pelo compartilhamento e desiste da foto (X ou botão voltar) fica **dentro do
Synesthesia**, na câmera — não numa tela preta nem fora do app.

**Teste**: compartilhar uma foto com o app fechado, descartar a captura, verificar que a câmera
aparece.

## Requisitos

- **FR-001**: O app é declarado como destino de compartilhamento de imagem (`ACTION_SEND` com
  `image/*`) no Android.
- **FR-002**: A imagem recebida é copiada para o armazenamento do app antes de qualquer uso — a
  permissão de leitura concedida pelo intent é temporária e morre com a tarefa.
- **FR-003**: A orientação registrada em EXIF é aplicada aos pixels na entrada; o restante do app
  (Skia, view-shot, muxer) nunca vê a foto deitada.
- **FR-004**: Imagens acima do teto de área já usado na captura (24 MP) são reduzidas na entrada,
  pelo mesmo motivo do disparo: memória em aparelho de entrada.
- **FR-005**: A sessão criada pela foto recebida é idêntica à de uma captura (`mediaId: null`,
  filtro automático), de modo que a curadoria, os looks, a memória de gosto, o salvar e o postar
  funcionem sem caminho especial.
- **FR-006**: Um compartilhamento já consumido não é reprocessado se a tela for remontada.
- **FR-007**: Falha na leitura da imagem avisa em pt-BR e devolve a pessoa ao app, sem derrubar.

## Fora de escopo

- **iOS**: fora de escopo permanente. Decisão do Sávio (2026-09-21): o Synesthesia é um app
  **100% Android** e não haverá versão iOS. O `android/` é o único nativo gerado, e os três
  módulos locais (`video-muxer`, `share-target`, `share-intake`) são Android-only por desenho —
  não por falta de tempo.
- **Vídeo compartilhado** e **múltiplas fotos de uma vez** (`ACTION_SEND_MULTIPLE`): o pacote
  sensorial é de uma foto; aceitar uma seleção múltipla exigiria uma tela de escolha que não
  existe.
- **Compartilhar texto/URL** para o app.

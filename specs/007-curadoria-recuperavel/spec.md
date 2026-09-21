# Feature Specification: Curadoria recuperável (a IA pode falhar sem travar o momento)

**Feature Branch**: `feature/006-foto-compartilhada` (entregue junto)

**Created**: 2026-09-21

**Status**: Implementada

**Input**: User description (Sávio, 2026-09-21): "sobre o gemini o certo seria ele esperar se o
gemini falhar ou passar de 30s aparece um botão para tentar de novo ou o cara pode baixar a imagem
ou postar da forma que está mesmo sem música ou o filtro personalizado."

## Contexto

Quando o Gemini não responde, o app **não avisava**: ele caía em silêncio para uma busca no Deezer
por palavras-chave da vibe local e **escolhia sozinho** a primeira faixa que voltasse. Medido no
device em 2026-09-21: uma foto de teclado mecânico recebeu "Eu Sou Brasileiro (Funk da Copa)" como
trilha curada. Do lado de quem usa, isso é pior do que não ter música — parece que a IA leu a cena
e concluiu aquilo.

O limite também era apertado demais: `LIMITE_GEMINI_MS` era de 22s, e na janela do teste a própria
API levou **19,9s para responder um prompt de 6 tokens** (HTTP 200). Com imagem, passava do limite
e degradava — por milissegundos, não por falha real.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A espera é maior, e honesta (Priority: P1)

O app espera o Gemini por até **30s**. Se responder, nada muda em relação a hoje.

**Teste**: capturar com rede normal; a curadoria chega e aplica vibe, looks e trilha.

### User Story 2 - Falhou: o app diz, em vez de inventar (Priority: P1)

Se o Gemini falhar ou estourar os 30s, o app **não escolhe faixa sozinho** e **não aplica look
sugerido**. A tela diz o que aconteceu: "A IA não respondeu a tempo. Sem leitura da cena, sem looks
sugeridos e sem trilha curada."

**Teste**: desligar a rede do aparelho e capturar; conferir que nenhuma música é imposta e que o
aviso aparece.

### User Story 3 - Tentar de novo (Priority: P1)

No estado de falha existe um botão **TENTAR DE NOVO** que refaz a curadoria da mesma foto — a
análise em cache daquela foto é descartada, senão a retentativa devolveria o mesmo resultado
degradado.

**Teste**: com a rede de volta, tocar TENTAR DE NOVO e conferir que a curadoria real chega.

### User Story 4 - Seguir sem a IA (Priority: P2)

Quem não quer esperar continua com dois caminhos abertos, ditos com todas as letras na tela:
**Salvar** baixa a imagem para a galeria e **Postar agora** gera o vídeo só com a foto. Os oito
presets locais continuam disponíveis no carrossel — o que falta é o look *sugerido*, não o filtro.

**Teste**: no estado de falha, salvar (imagem na galeria do sistema) e postar (vídeo sem trilha).

## Requisitos

- **FR-001**: `LIMITE_GEMINI_MS` passa de 22s para 30s; o teto da tela acompanha (34s, com margem
  para o `AbortError` chegar ao `catch`).
- **FR-002**: A análise carrega um sinal `degradada`; com ele verdadeiro, nem música nem look
  sugerido são aplicados automaticamente.
- **FR-003**: As faixas que o Deezer devolveu no caminho degradado **não somem** — continuam
  acessíveis em "ESCOLHER MÚSICA". Elas deixam de ser impostas, não de existir.
- **FR-004**: A retentativa invalida o cache de análise daquela foto e funciona mesmo depois de a
  mídia já ter sido salva.
- **FR-005**: O alerta de "postar sem trilha" ganha a opção de tentar de novo quando a falha foi da
  IA.

## Fora de escopo

- Retentativa automática em segundo plano (o toque é explícito, para não gastar rede sem pedir).
- Mudar o piso de degradação em si (a busca por palavras-chave continua existindo como fonte de
  sugestões manuais).

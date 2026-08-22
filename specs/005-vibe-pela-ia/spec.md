# Feature Specification: Vibe definida pela IA

**Feature Branch**: `feature/005-vibe-pela-ia`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description (Sávio, 2026-08-22): "A vibe vai ser definida pelo Gemini. Não vamos mais definir a vibe aleatoriamente — vamos dar os dados para o Gemini: ele vê a localização, a hora do dia, vê a imagem e define a vibe, as músicas e o filtro que combinam. A vibe deixa de ser automática e passa a ser definida pela IA. Onde tinha o nome da vibe escrita ganha esqueleto até ela aparecer. A vibe vira um texto livre, no máximo 2 palavras, mas deve ser algum sentimento ou algum lugar que a imagem transmite — ele vai ver pela localização que eu estou na praia, ver que é uma foto de areia, ver que é um tom alegre e vai me dizer que é uma vibe praiana. O que devemos armazenar de gosto é a música que ele já setou (nome, gênero, banda); dizemos ao Gemini que ele tem apreço por essa lista de músicas e enviamos os dados dessas músicas — e do mesmo jeito para o filtro: guardamos o filtro x com esses valores e enviamos uma lista para o Gemini. Esses 2 gostos devem ser uma lista das últimas 20 escolhas no máximo, para o prompt não gastar muito."

## Contexto

A vibe é hoje um rótulo de uma lista fechada de oito, escolhido localmente pelo
ML Kit a partir de labels da imagem. Esse rótulo entra no prompt como âncora da
curadoria musical — e é aí que ele estraga o resultado: uma foto de papel de
parede de samurai foi classificada como `energetica`, e a curadoria devolveu
funk da Copa do Mundo. Não havia camisa do Brasil, nem verde e amarelo, nem
nada brasileiro na cena. O rótulo genérico empurrou a busca para keywords
("funk brasileiro", "pop dance hit") que nada tinham a ver com o que a foto
mostrava.

O problema não é o Gemini: quando ele responde, ele lê a cena muito bem — na
mesma foto ele nomeou os looks de "Ciber Samurai" e "Sombra Profunda", e
justificou a trilha como "captura a essência futurista e melancólica do papel
de parede". O problema é que a **vibe** chega pronta e errada antes dele, e
contamina a curadoria.

Esta feature inverte a ordem: a vibe deixa de ser um palpite local que restringe
o Gemini, e passa a ser **uma conclusão dele**, tomada com a imagem, a hora e o
lugar em mãos.

A memória de gosto acompanha a inversão. Hoje ela indexa por vibe (`praia` →
tal filtro), o que só funciona enquanto a vibe for um id fixo. Com vibe livre,
o gosto passa a ser o que de fato é: uma **lista das últimas escolhas**, enviada
ao Gemini como "esta pessoa gosta destas músicas e destes tratamentos".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A vibe descreve a cena, não uma categoria (Priority: P1)

Ao capturar, a pessoa vê uma vibe escrita em até duas palavras que descreve o
que a foto transmite — um sentimento ou um lugar —, no lugar de um rótulo de
catálogo. Enquanto o Gemini não responde, o lugar da vibe mostra um esqueleto,
nunca um palpite.

**Why this priority**: É a fatia que entrega a feature sozinha. Sem mudar gosto
nem contexto, trocar o rótulo chutado por uma leitura real da cena já corrige o
defeito que originou a feature.

**Independent Test**: Fotografar um papel de parede de samurai com a chave do
Gemini configurada e verificar que a vibe exibida descreve a cena (ex.: "Noite
Cibernética") e que, até a resposta chegar, o lugar da vibe é um esqueleto.

**Acceptance Scenarios**:

1. **Given** uma foto recém-capturada e curadoria em andamento, **When** o Modal
   de Captura abre, **Then** o lugar da vibe mostra um esqueleto — nunca um nome
   de vibe provisório.
2. **Given** o Gemini respondeu, **When** a vibe chega, **Then** ela aparece com
   no máximo duas palavras, descrevendo sentimento ou lugar da cena.
3. **Given** o Gemini não respondeu (sem rede, sem chave, tempo esgotado),
   **When** a curadoria termina, **Then** a vibe cai no piso local atual e o app
   segue funcionando, sem esqueleto preso na tela.

### User Story 2 - A trilha combina com o que está na foto (Priority: P1)

A curadoria musical deixa de partir de um rótulo e passa a partir do que o
Gemini vê na imagem, mais a hora e o lugar. Uma foto de papel de parede não
recebe mais música de Copa do Mundo.

**Why this priority**: É o defeito relatado. A US1 conserta o que se lê na tela;
esta conserta o que se ouve.

**Independent Test**: Repetir a captura do papel de parede e verificar que as
quatro faixas se relacionam com a cena descrita, e que nenhuma keyword genérica
de vibe entrou na busca.

**Acceptance Scenarios**:

1. **Given** uma foto sem nenhum elemento brasileiro, **When** a curadoria
   termina, **Then** nenhuma faixa é escolhida por keyword derivada de rótulo de
   vibe.
2. **Given** foto tirada às 23h, **When** a curadoria roda, **Then** a hora do
   dia participa da escolha da trilha.

### User Story 3 - O app conhece o gosto da pessoa (Priority: P2)

O Gemini recebe as últimas escolhas reais de música (nome, gênero, banda) e de
tratamento (filtro base e valores), e leva isso em conta ao sugerir.

**Why this priority**: Depende das US1/US2 estarem de pé, e é o que faz a
sugestão melhorar com o uso — mas o produto já funciona sem isso.

**Independent Test**: Escolher manualmente três faixas de um mesmo gênero em
capturas seguidas e verificar que a lista enviada ao Gemini as contém e que as
sugestões seguintes conversam com esse gosto.

**Acceptance Scenarios**:

1. **Given** um aparelho com histórico, **When** a curadoria roda, **Then** o
   prompt carrega no máximo as **20 últimas** escolhas de cada tipo.
2. **Given** um aparelho novo, sem histórico, **When** a curadoria roda,
   **Then** o prompt vai sem lista de gosto e nada quebra.

### US4 - Contexto de lugar e hora (Priority: P3)

O app usa a localização e a hora do aparelho para enriquecer a leitura da cena.

**Acceptance Scenarios**:

1. **Given** permissão de localização concedida, **When** a curadoria roda,
   **Then** o lugar participa da definição da vibe.
2. **Given** permissão negada, **When** a curadoria roda, **Then** só a hora e a
   imagem são usadas, sem bloquear nem repetir o pedido a cada foto.

## Requisitos

- **FR-030**: A vibe é texto livre de no máximo duas palavras, produzido pelo
  Gemini, descrevendo sentimento ou lugar transmitido pela imagem.
- **FR-031**: Enquanto a vibe não chega, a interface mostra esqueleto no lugar
  dela — nunca um valor provisório.
- **FR-032**: O rótulo de vibe deixa de ser âncora da busca musical; a curadoria
  parte da leitura da cena feita pelo Gemini.
- **FR-033**: O histórico de gosto envia ao Gemini no máximo as 20 escolhas mais
  recentes de música (nome, gênero, banda) e de tratamento (base e valores).
- **FR-034**: Localização e hora do dia entram no prompt quando disponíveis;
  ausência de qualquer uma degrada sem bloquear.
- **FR-035**: Mídias salvas antes desta feature continuam abrindo, com a vibe
  que tinham gravada.
- **FR-036**: Sem rede, sem chave ou com tempo esgotado, o app continua
  capturando, tratando e salvando — o piso local de vibe segue existindo.

## Riscos e pontos de atenção

Esta feature toca quatro sistemas hoje validados. Nenhum deles deve regredir:

- **`Media` é persistida.** `vibeId` é hoje um id fixo e aparece em registros
  gravados. Vibe livre exige campo aditivo e leitura tolerante, como já se fez
  com `aspecto`, `sugestoes`, `looks` e `audioUri`.
- **As duas stores de gosto indexam por vibe.** `useTasteStore` e
  `useLookTasteStore` usam a vibe como chave de agrupamento; com vibe livre essa
  chave deixa de existir e o modelo de dados muda.
- **O visor ao vivo não depende de rede** (FR-021). Ele calcula a vibe
  localmente e aplica o preset correspondente em tempo real — não pode passar a
  esperar o Gemini.
- **A galeria agrupa e rotula por vibe**, incluindo o emoji do card.
- **Localização é permissão nova**: entra no onboarding, tem custo de LGPD (o
  app hoje se apresenta como processamento local) e adiciona latência antes da
  curadoria.

## Fora de escopo

- Edição manual de vibe pela pessoa.
- Reescrever a vibe de mídias antigas.
- Qualquer mudança no carrossel de tratamentos, no seletor de resolução, no
  fluxo de salvar ou no render por Skia.

## Histórico

Aberta em 2026-08-22, logo depois do release 1.2.1, a partir do QA de uso real
do Sávio. A decisão de não embutir isto no 1.2.1 foi deliberada: o pitch para os
jurados é nesta semana, o 1.2.1 fecha correções já validadas no aparelho, e esta
feature mexe em sistemas que o 1.2.1 deliberadamente não tocou.

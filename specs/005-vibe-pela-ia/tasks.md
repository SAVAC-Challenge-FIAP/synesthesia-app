---
description: "Task list — Vibe definida pela IA"
---

# Tasks: Vibe definida pela IA

**Input**: Design documents from `/specs/005-vibe-pela-ia/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/gemini-cena.md](./contracts/gemini-cena.md), [quickstart.md](./quickstart.md)

**Tests**: sem runner no repo. A porta de qualidade é `npm run typecheck` + o roteiro manual do [quickstart.md](./quickstart.md). Nenhuma task de teste automatizado é gerada — não seria executável neste projeto.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual User Story a task pertence (US1–US4)

## Path Conventions

Projeto Expo Router existente: telas em `app/`, código em `src/`. Sem diretório novo.

---

## Phase 1: Setup

**Purpose**: nada a inicializar — o projeto existe e roda. Só o preparo mínimo.

- [X] T001 Confirmar branch `feature/005-vibe-pela-ia` e baseline verde rodando `npm run typecheck` na raiz do repo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o campo aditivo que sustenta US1 e o esqueleto compartilhado. **Bloqueia todas as User Stories.**

⚠️ Nada aqui muda comportamento visível — é a fundação de tipo e de UI.

- [X] T002 [P] Adicionar `vibe?: string` a `Media` em `src/types.ts`, com o comentário no padrão de `aspecto`/`sugestoes`/`looks`: opcional porque mídias antigas não têm o campo, ausência significa "não sei"; deixar explícito que `vibeId` continua obrigatório e continua sendo a âncora (data-model §2)
- [X] T003 [P] Extrair o `Esqueleto` de `src/components/TratamentoCarrossel.tsx` para `src/components/EsqueletoTexto.tsx`, parametrizado por largura/altura, preservando shimmer + respiração e o `atraso` escalonado (D7, R6)
- [X] T004 Trocar o `Esqueleto` local de `src/components/TratamentoCarrossel.tsx` pelo componente compartilhado de T003, sem alterar as dimensões dos slots do carrossel

**Checkpoint**: `npm run typecheck` limpo; app roda idêntico ao de antes.

---

## Phase 3: User Story 1 — A vibe descreve a cena (P1) 🎯 MVP

**Goal**: a vibe exibida passa a ser texto livre lido da imagem; enquanto não chega, esqueleto — nunca palpite.

**Independent Test**: fotografar o papel de parede de samurai com a chave configurada e verificar que a vibe descreve a cena e que, até a resposta chegar, o lugar dela é um esqueleto ([quickstart.md](./quickstart.md) V1 e V3).

### Contrato e saneamento

- [X] T005 [US1] Em `src/services/music.ts`, remover do prompt de `askGeminiWithPhoto()` o item 1 que lista os oito ids (`vibesDisponiveis`) e substituir pela instrução de vibe livre do contrato §2.1 — até 2 palavras, sentimento ou lugar, proibindo categorias genéricas, nome de filtro e adjetivos soltos
- [X] T006 [US1] Em `src/services/music.ts`, criar `sanearVibe(bruto: unknown): string | undefined` implementando os 5 passos do contrato §4 (trim/aspas → colapso de espaço → 2 palavras → teto 24 chars sem partir palavra → vazio vira `undefined`), com comentário citando "instrução em prompt é pedido, não garantia"
- [X] T007 [US1] Em `src/services/music.ts`, criar `vibeIdDePiso(vibe: string | undefined, cena: string | undefined): VibeId | null` derivando o piso por casamento de palavras contra `nome`/`descricao` das oito vibes, devolvendo `null` sem casamento (contrato §5) — `null` é resultado legítimo, não erro
- [X] T008 [US1] Em `src/services/music.ts`, adicionar `vibe?: string` a `PhotoAnalysis` e fazer `analyzePhotoAndSuggest()` preencher `vibe` via T006 e `vibeId` via T007 nos **três** retornos do caminho com foto (sucesso, faixas-não-resolveram, degradado), preservando `vibe` quando só o Deezer falhou (contrato §6)

### Sessão e persistência

- [X] T009 [P] [US1] Adicionar `vibe?: string` a `CaptureSession` em `src/stores/useCaptureStore.ts`, documentando os dois significados de `undefined` — carregando (esqueleto) vs. terminado (piso) — conforme data-model §3
- [X] T010 [P] [US1] Em `src/stores/useGalleryStore.ts`, persistir `vibe` ao salvar/atualizar a mídia — **nenhuma alteração necessária**: `add`/`update` recebem `Media`/`Partial<Media>` genéricos, então o campo novo já flui. Quem monta o objeto é `CaptureSheet` (T012)
- [X] T011 [US1] Em `src/components/CaptureSheet.tsx`, propagar `vibe` do retorno da análise para o `patch()` da sessão, no mesmo bloco onde `vibeReal` já é aplicado
- [X] T012 [US1] Em `src/components/CaptureSheet.tsx`, incluir `vibe: session.vibe` nos três pontos que montam o objeto `Media` para salvar (linhas ~555, ~569, ~598)
- [X] T013 [US1] Em `app/gallery.tsx`, passar `vibe: m.vibe` no `start()` de `lapidar()`, para que reabrir da galeria traga a vibe salva sem recurar

### Interface

- [X] T014 [US1] Em `src/components/CaptureSheet.tsx`, trocar `· VIBE {vibe.nome.toUpperCase()}` pela regra de três estados: `curadoria === 'carregando' && !session.vibe` → `EsqueletoTexto`; `session.vibe` → texto em caixa alta; senão → `vibeById(session.vibeId).nome` (FR-031, FR-036). Render condicional simples, **sem `LayoutAnimation`**
- [X] T015 [P] [US1] Em `app/gallery.tsx`, exibir `item.vibe` em caixa alta quando presente, caindo para `{vibe.emoji} {vibe.nome}` quando ausente — sem inventar emoji para vibe livre (D4)
- [X] T016 [P] [US1] Em `src/components/MusicSheet.tsx`, aplicar a mesma queda no cabeçalho: `session.vibe` quando existir, senão `{vibe.emoji} VIBE {vibe.nome}`

**Checkpoint**: US1 entrega sozinha. V1, V3 e V6 do quickstart devem passar.

---

## Phase 4: User Story 2 — A trilha combina com a foto (P1)

**Goal**: a curadoria deixa de partir de rótulo e passa a partir da leitura da cena.

**Independent Test**: repetir a captura do papel de parede e verificar que as quatro faixas se relacionam com a cena e que nenhuma keyword genérica de vibe entrou na busca ([quickstart.md](./quickstart.md) V2).

- [X] T017 [US2] ~~Fazer `resolveWithDeezer()` derivar os termos de busca da leitura da cena~~ — **nenhuma alteração necessária, premissa do plano corrigida na implementação.** `resolveWithDeezer()` já busca por `` `${idea.titulo} ${idea.artista}` ``, nunca por keyword; usa `vibe` só para escolher o emoji. A busca por `musicaKeywords` existe **somente** dentro de `getSuggestions()` (etapa 3), que é caminho de degradação. Logo o defeito relatado não nasceu da busca, e sim do **prompt**: o rótulo entrava na instrução e o Gemini sugeria funk. T005 já o corrigiu
- [X] T018 [US2] ~~Alterar a assinatura de `faixaAproveitavel()`~~ — **nenhuma alteração necessária pelo mesmo motivo.** Ele só é chamado na busca por keyword de `getSuggestions()`, onde a `Vibe` é legítima e é a única informação disponível (R2 continua valendo, mas o risco que ele previa não se materializa: a âncora nunca esteve nesse caminho)
- [X] T019 [US2] Em `src/services/music.ts`, injetar a hora do dia no prompt de `askGeminiWithPhoto()` como período legível (`"início da noite (19h)"`), calculada de `new Date()` — sem permissão, sem rede, sem caminho de falha (D6)
- [X] T020 [US2] Verificar que `getSuggestions(vibe)` — caminho só-texto, sem foto — **continua** usando `musicaKeywords`: é degradação legítima, o rótulo local é a única informação restante (D2, FR-036). Nenhuma alteração esperada; a task é a conferência explícita

**Checkpoint**: US1+US2 = a feature que corrige o defeito relatado. V2 do quickstart passa.

---

## Phase 5: User Story 3 — O app conhece o gosto (P2)

**Goal**: as últimas 20 escolhas reais de música e de tratamento entram no prompt.

**Independent Test**: escolher três faixas do mesmo gênero em capturas seguidas e verificar que a lista enviada as contém, com teto de 20 ([quickstart.md](./quickstart.md) V4).

### Stores: de índice para lista

- [X] T021 [P] [US3] Em `src/stores/useTasteStore.ts`, trocar `sugeridasPorVibe: Record<string, FaixaSugerida[]>` por `sugeridas: FaixaSugerida[]`; `registrarSugeridas(sugestoes)` sem `vibeId`; fundir `faixasSugeridasRecentes`/`faixasSugeridasGlobais` numa só `faixasSugeridasRecentes(n)`; renomear `TETO_SUGERIDAS_POR_VIBE` → `TETO_SUGERIDAS` mantendo o valor 40 (data-model §5)
- [X] T022 [US3] Em `src/stores/useTasteStore.ts`, adicionar `version: 1` e `migrate` ao `persist` achatando `sugeridasPorVibe` em `sugeridas`, para a lista de bloqueio não voltar vazia na primeira captura pós-atualização (data-model §5)
- [X] T023 [US3] Em `src/stores/useTasteStore.ts`, adicionar `ultimasEscolhas(n = 20): GostoMusical[]` — lista bruta por recência (`{titulo, artista, genero}`), **não** agregação por peso como `artistasFrequentes` — e exportar o tipo `GostoMusical` (FR-033)
- [X] T024 [US3] Em `src/stores/useTasteStore.ts`, marcar `EscolhaMusical.vibeId` como legado em comentário: continua gravado por compatibilidade, ignorado na leitura (R4); afrouxar `registrarEscolha` para aceitar `VibeId | undefined`
- [X] T025 [P] [US3] Em `src/stores/useLookTasteStore.ts`, trocar `preferidoDaVibe(vibeId)` por `preferido()` avaliando `LIMIAR_PESO`/`LIMIAR_ESCOLHAS` sobre o histórico inteiro, com o mesmo argumento de origem ("uma escolha isolada não é gosto estabelecido"), e marcar `EscolhaVisual.vibeId` como legado (R4)
- [X] T026 [US3] Em `src/stores/useLookTasteStore.ts`, adicionar `ultimosTratamentos(n = 20): GostoVisual[]` (`{base, ajustes, nome}`) e exportar o tipo `GostoVisual` (FR-033)
- [X] T027 [US3] Em `src/stores/useLookTasteStore.ts`, **reescrever o cabeçalho LGPD**: a garantia "este dado não sai do aparelho (FR-014)" deixa de valer por decisão do Sávio em FR-033; registrar a reversão apontando para a spec 005. Precisa sair no mesmo commit que passa a enviar a lista — código que documenta garantia que não cumpre é pior que código sem comentário (D5)

### Consumo

- [X] T028 [US3] Em `src/services/looks.ts`, trocar `lookDeAfinidade(vibeId)` por `lookDeAfinidade()` consumindo `preferido()`, mantendo `nomeDeAfinidade()` e a regra de que "sem tratamento" não vira sugestão; atualizar a chamada em `montarLooks()`
- [X] T029 [US3] Em `src/services/music.ts`, substituir `preferenciasAprendidas()` por `listasDeGosto()` que monta as duas listas no formato do contrato §2.3 — uma linha por item, no máximo 20 de cada — e devolve string vazia quando não há histórico (US3 cenário 2)
- [X] T030 [US3] Em `src/services/music.ts`, chamar `listasDeGosto()` em `instrucaoDeCuradoria()` no lugar de `preferenciasAprendidas()`, verificando que aparelho novo produz prompt sem nenhuma seção de gosto e sem frase vazia
- [X] T031 [US3] Atualizar os chamadores de `registrarSugeridas` em `src/services/music.ts` (feito: 6 pontos) e de `registrarEscolha` em `src/components/CaptureSheet.tsx` e `src/components/MusicSheet.tsx` — estes últimos **sem alteração de código**: as assinaturas passaram a aceitar `VibeId | undefined` e os call sites seguem gravando `session.vibeId` como legado. Só o comentário que dizia "sob a vibe daquela foto" foi corrigido

**Checkpoint**: V4 do quickstart passa; histórico anterior sobrevive à migração (V6).

---

## Phase 6: User Story 4 — Contexto de lugar (P3)

**Goal**: localização enriquece a leitura da cena, sob opt-in, degradando em silêncio.

**Independent Test**: com permissão concedida, o lugar participa da vibe; negada, só hora e imagem, sem bloquear nem repetir o pedido a cada foto ([quickstart.md](./quickstart.md) V5).

⚠️ **Exige rebuild do dev build** — permissão nativa nova.

- [X] T032 [US4] Instalar `expo-location` com `npx expo install expo-location` e declarar a permissão de localização no `app.json`, com justificativa em pt-BR
- [X] T033 [P] [US4] Adicionar `usarLocalizacao: boolean` a `SettingsState` em `src/stores/useSettingsStore.ts` com default **`true`** — revisto em 2026-08-22 por decisão do Sávio; o consentimento passa para o onboarding e o flag vira a via de revogação (emenda 1.2.0 da constituição)
- [X] T034 [P] [US4] Em `app/settings.tsx`, adicionar o toggle "Usar localização" na seção **PRIVACIDADE** (que já existe), com texto de **revogação** — a cidade, nunca a coordenada, vai junto da foto; desligar corta o envio na hora
- [X] T035 [US4] Criar `src/services/contexto.ts` exportando `ContextoCena` e `montarContexto(usarLocalizacao: boolean): Promise<ContextoCena>`: hora sempre presente como período legível; lugar via `Location.reverseGeocodeAsync` com `Accuracy.Low`, devolvendo `"Cidade, UF"` — **texto, nunca coordenada** — e `undefined` sem opt-in, sem permissão ou fora do teto próprio (D5, data-model §8)
- [X] T036 [US4] ~~Pedir a permissão na primeira captura~~ → **revisto em 2026-08-22**: `pedirLocalizacao()` em `src/services/contexto.ts` é chamado pelo **onboarding** (`app/index.tsx`), uma vez só; `lugarDaCena()` nunca pede, só consome a permissão já concedida. Elimina a trava de sessão, que existia só para o pedido no caminho da captura
- [X] T045 [US4] Em `app/index.tsx`, adicionar o card 📍 LOCALIZAÇÃO · OPCIONAL com justificativa própria e chamar `pedirLocalizacao()` no "Permitir tudo", **fora do gate** de entrada — recusar não pode bloquear o app (emenda 1.2.0)
- [X] T046 [US4] Emendar `.specify/memory/constitution.md` para **1.2.0**: Princípio IV passa de "opt-in" para "consentimento informado, persistido e revogável", admitindo coleta no onboarding com justificativa própria e recusa sem perda de função
- [X] T037 [US4] Em `src/services/music.ts`, resolver `montarContexto()` **em paralelo** com `photoToBase64()` via `Promise.all`, para o lugar não somar latência ao caminho crítico (D5, R5)
- [X] T038 [US4] Em `src/services/music.ts`, injetar as linhas de contexto no prompt de `askGeminiWithPhoto()` conforme o contrato §2.2, omitindo a linha do lugar quando ausente; T019 já cobre a hora, aqui ela passa a vir de `contexto.ts`
- [X] T039 [US4] Adicionar log `[contexto] hora="…" lugar="…"` em `src/services/contexto.ts` para a validação V5 do quickstart — o log é a instrumentação que prova que só texto de cidade trafega

**Checkpoint**: V5 do quickstart passa, incluindo a verificação de que nenhuma coordenada aparece no log.

---

## Phase 7: Polish & Cross-Cutting

- [X] T040 Rodar `npm run typecheck` e zerar qualquer erro remanescente das trocas de assinatura (T021, T025, T028, T031)
- [X] T041 [P] Varrer o repo por referências órfãs a `preferidoDaVibe`, `faixasSugeridasGlobais`, `sugeridasPorVibe` e `preferenciasAprendidas` com `grep -rn` em `src/` e `app/`
- [X] T042 [P] Revisar comentários que ficaram mentindo após a feature: o cabeçalho de `src/constants/vibes.ts` (a tabela virou piso, não direção), o de `src/services/vibeEngine.ts` (a vibe real agora é texto livre) e o de `PhotoAnalysis` em `src/services/music.ts`
- [ ] T043 Executar o roteiro completo do [quickstart.md](./quickstart.md) (V1–V6) em dev build Android — **pendente: validação do Sávio no aparelho**. As funções puras (`sanearVibe`, `vibeIdDePiso`) foram provadas em 17 casos, incluindo o do samurai da spec
- [X] T044 Registrar em `specs/005-vibe-pela-ia/ESTADO.md` onde a implementação parou, no molde de `specs/003-looks-sugeridos/ESTADO.md`

---

## Dependencies & Execution Order

### Ordem entre fases

```
Setup (T001)
  └─> Foundational (T002–T004)   ← BLOQUEIA tudo
        ├─> US1 (T005–T016)  P1  🎯 MVP
        │     └─> US2 (T017–T020)  P1   [mesmo arquivo que US1: sequencial]
        ├─> US3 (T021–T031)  P2   [independente de US2]
        └─> US4 (T032–T039)  P3   [independente de US2 e US3]
              └─> Polish (T040–T044)
```

### Dependências que importam

- **T002 antes de T009–T013**: o campo tem que existir no tipo antes de ser propagado.
- **T003 antes de T004 e T014**: o componente compartilhado antes dos dois consumidores.
- **T006/T007 antes de T008**: as funções antes de quem as chama.
- **T005–T008 antes de T017–T019**: US2 edita as mesmas funções de `music.ts` que US1 acabou de mexer — **não paralelizar entre si**.
- **T021–T027 antes de T028–T031**: as stores antes dos consumidores.
- **T032 antes de T035**: a dependência antes do serviço que a importa.
- **T027 no mesmo commit de T029/T030**: a reversão de LGPD e o envio da lista andam juntos (D5).

### Paralelismo real

Dentro da Foundational: **T002 e T003** (arquivos diferentes).

Dentro da US1, depois de T008: **T009 e T010** (stores diferentes), e depois **T015 e T016** (telas diferentes).

Dentro da US3: **T021 e T025** (stores diferentes).

Dentro da US4: **T033 e T034** juntos após T032.

Entre fases: **US3 e US4 são independentes** e podem ser tocadas por pessoas diferentes depois que US1 fechar.

---

## Implementation Strategy

### MVP (parar aqui já entrega valor)

**Foundational + US1** (T001–T016). Corrige o que se lê na tela: vibe descreve a cena, esqueleto no lugar do palpite. O defeito de curadoria continua, mas o app melhora sozinho.

### Incremento recomendado antes do pitch

**+ US2** (T017–T020). Fecha o defeito relatado inteiro — o que se lê **e** o que se ouve. É a menor entrega que resolve a queixa original do papel de parede/funk.

### Depois

**US3** melhora com o uso; **US4** exige rebuild nativo e permissão nova — é a fatia com maior custo de coordenação e o menor P.

### Regra que atravessa tudo

Nenhuma task pode fazer o **visor ao vivo** esperar rede. `src/services/vibeEngine.ts` não aparece em nenhuma task de alteração de propósito — se uma mudança parecer exigir mexer nele, é sinal de que o desenho saiu do trilho (FR-021, D1).

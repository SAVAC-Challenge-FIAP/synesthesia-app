---
description: "Task list para a feature 003 — Looks sugeridos com memória de gosto"
---

# Tasks: Looks sugeridos com memória de gosto

**Input**: Design documents from `/specs/003-looks-sugeridos/`

**Prerequisites**: [plan.md](./plan.md) (lido), [spec.md](./spec.md) (lido). `research.md`, `data-model.md`, `quickstart.md` e `contracts/` **ainda não existiam** — o plano os prevê nas fases F0/F1 e as tarefas T001, T003, T004 e T013 abaixo os produzem.

**Tests**: o repositório **não tem runner de teste configurado** (`package.json` expõe apenas `start`, `android`, `ios`, `typecheck`) e nem a spec nem o plano pedem TDD. Portanto **não há tarefas de teste automatizado**. A verificação é `npm run typecheck` mais o roteiro manual em dev build descrito no `quickstart.md` (T013), como o próprio plano define em *Technical Context → Testing*.

**Organization**: tarefas agrupadas por user story, para que cada fatia seja implementável e demonstrável sozinha.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual user story a tarefa pertence (US1, US2, US3, US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto **mobile Expo** com a estrutura já vigente (não se cria diretório de topo novo):

- `app/` — rotas do `expo-router`
- `src/components/`, `src/services/`, `src/stores/`, `src/constants/`, `src/theme/`
- `src/types.ts` — modelo de dados compartilhado

---

## Phase 1: Setup (F0 — Research)

**Purpose**: fechar as três incógnitas técnicas antes de tocar em código de produção.

- [X] T001 Criar `specs/003-looks-sugeridos/research.md` com as três decisões da fase F0 do plano: **R1** formato exato do trecho de look no JSON de resposta do Gemini (campos, ordem, o que fazer com campo ausente), **R2** faixa segura de cada parâmetro de ajuste (`brightness`, `saturate`, `contrast`, `sepia`, opacidade de overlay) com o mínimo/máximo que ainda produz imagem utilizável, e **R3** API do `@shopify/react-native-skia` para matriz de cor e render offscreen em resolução cheia
- [X] T002 [P] Registrar o baseline verde do repositório rodando `npm run typecheck` na raiz, para que qualquer erro de tipo posterior seja atribuível a esta feature

**Checkpoint**: incógnitas resolvidas — o contrato e o modelo podem ser escritos sem chute.

---

## Phase 2: Foundational (F1 — Contrato e modelo)

**Purpose**: tipos, ancoragem de receita e o serviço `looks.ts` que **todas** as user stories consomem.

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase terminar.

- [X] T003 Criar `specs/003-looks-sugeridos/data-model.md` descrevendo `LookRecipe`, `PapelLook`, `EscolhaVisual`, `HistoricoGostoVisual` e a extensão aditiva de `Media`, incluindo a regra de que campo ausente significa "não sei" e nunca "não há" (convenção já documentada em `src/types.ts` para `aspecto` e `sugestoes`)
- [X] T004 [P] Criar `specs/003-looks-sugeridos/contracts/gemini-look.md` com o contrato do trecho de look na resposta multimodal: JSON de exemplo, campos obrigatórios/opcionais, os dois papéis que o modelo pode emitir (`certeira`, `ousada`), a proibição de `afinidade` (derivado local, D3) e o comportamento esperado quando o modelo devolve menos de dois looks
- [X] T005 Declarar `PapelLook`, `AjustesLook` e `LookRecipe` em `src/types.ts`, seguindo o molde documental de `PapelFaixa` (comentário explicando por que o rótulo existe) — `LookRecipe` carrega `base: FilterId`, `ajustes: AjustesLook`, `nome`, `justificativa` e `papel`
- [X] T006 Estender `Media` em `src/types.ts` com `looks?: LookRecipe[]` e `lookEscolhido?: LookRecipe`, ambos opcionais de propósito, mantendo `filtroId` intacto para compatibilidade e como âncora do look (D7)
- [X] T007 Adicionar em `src/constants/filters.ts` a função que resolve uma `LookRecipe` no `FilterDef` efetivo (preset base + desvios aplicados sobre `imageFilter` e opacidade de overlay), sem alterar os 8 presets existentes, que seguem sendo a âncora e a rede de segurança
- [X] T008 Criar `src/services/looks.ts` com as faixas seguras de T001/R2 e a função de clamp que limita todo valor vindo do modelo antes de qualquer render (FR-026)
- [X] T009 Implementar em `src/services/looks.ts` a distância entre duas receitas e a deduplicação que substitui um look redundante por um preset base, garantindo três opções realmente distintas (D4)
- [X] T010 Implementar em `src/services/looks.ts` a geração de looks base a partir da vibe — o degrau intermediário da cadeia de degradação looks da IA → presets derivados da vibe → foto sem tratamento (FR-019)
- [X] T011 Implementar `montarLooks()` em `src/services/looks.ts`, orquestrando os três slots (clamp → dedupe → completar com base) e garantindo **exatamente três** looks em qualquer cenário, inclusive sem rede e sem chave (FR-001, SC-004)
- [X] T012 Alterar `src/components/FilteredImage.tsx` para aceitar `look?: LookRecipe` além do `filtroId` atual, renderizando pela receita resolvida em T007 quando presente e mantendo o caminho antigo quando ausente (compatibilidade com `FilterThumbs`, `gallery.tsx` e `camera.tsx`)
- [x] T013 Criar `specs/003-looks-sugeridos/quickstart.md` com o roteiro manual em dev build Android que cobre os cenários de aceitação das quatro user stories e os critérios SC-001 a SC-009

**Checkpoint**: fundação pronta — as user stories podem começar, e US3 pode correr em paralelo às demais.

---

## Phase 3: User Story 1 — Escolher entre três looks sugeridos (Priority: P1) 🎯 MVP

**Goal**: o Modal de Captura abre com três looks rotulados, o primeiro já aplicado, e trocar entre eles é instantâneo e sem rede.

**Independent Test**: capturar uma foto com `EXPO_PUBLIC_GEMINI_API_KEY` configurada e verificar que o Modal de Captura abre com três looks nomeados e justificados, o primeiro aplicado, e que tocar no segundo troca a prévia sem nova chamada de rede e sem recarregar a tela.

### Implementation for User Story 1

- [X] T014 [US1] Declarar `GeminiLookIdea` e estender `GeminiSceneResult` com `looks?: GeminiLookIdea[]` em `src/services/music.ts`, ao lado de `GeminiTrackIdea`, conforme o contrato de T004
- [X] T015 [US1] Estender o prompt de `askGeminiWithPhoto()` em `src/services/music.ts` para pedir **duas** receitas de look como desvio a partir de um dos 8 presets nomeados, nunca valores absolutos, seguindo a lição do T056 já registrada no arquivo — a instrução precisa fixar o formato, senão o modelo governa o resultado (D2)
- [X] T016 [US1] Adicionar `looks: LookRecipe[]` a `PhotoAnalysis` e ligar `montarLooks()` dentro de `analyzePhotoAndSuggest()` em `src/services/music.ts`, em **todos** os caminhos de retorno — cena lida, pipeline por vibe e degradado —, sem nenhuma chamada de rede nova (FR-018, D1)
- [X] T017 [US1] Implementar o cache de análise por `photoUri` em `src/services/music.ts`, para que reabrir ou reanalisar a mesma foto devolva o mesmo conjunto de três looks (FR-009, D5)
- [X] T018 [US1] Estender `CaptureSession` em `src/stores/useCaptureStore.ts` com `looks: LookRecipe[]`, `lookEscolhido: LookRecipe | null` e a flag de aceite passivo, no mesmo molde de `sugestoes`/`filtroAuto` já existentes
- [X] T019 [P] [US1] Criar `src/components/LookChips.tsx` exibindo as três sugestões com nome, justificativa de uma linha e marca de papel, reusando o estilo de chip vigente (`radii.chip`, `fonts.labelForte`, caixa alta com `letterSpacing`) definido em `src/theme/tokens.ts` (Princípio VI)
- [X] T020 [US1] Integrar `LookChips` em `src/components/CaptureSheet.tsx` acima do bloco de filtros e aplicar a sugestão principal automaticamente quando a curadoria chega, sem exigir toque (FR-004)
- [X] T021 [US1] Implementar a troca entre os três looks em `src/components/CaptureSheet.tsx` via `patch({ lookEscolhido })`, sem nova consulta externa e sem sair da tela, marcando a seleção visualmente (FR-005, SC-003)
- [X] T022 [US1] Alterar `src/components/FilterThumbs.tsx` para que os 8 tratamentos base mais o "Original" continuem acessíveis **depois** das sugestões, e não no lugar delas (FR-006) — nota: o plano cita `FilterCarousel.tsx`, mas esse componente é o do visor ao vivo e deve permanecer intocado por FR-021; o carrossel do modal é o `FilterThumbs`
- [x] T023 [US1] Garantir em `src/components/CaptureSheet.tsx` que escolher "Original" mantém a foto exatamente como saiu da câmera e limpa o look aplicado, permanecendo uma escolha de primeira classe (cenário de aceitação US1.5)
- [X] T024 [US1] Incluir a identidade do look em `chavePacote()` em `src/services/preExport.ts`, para que o vídeo pré-gerado de um look não seja servido para outro (D7)
- [x] T025 [US1] Verificar a cadeia de degradação em `src/components/CaptureSheet.tsx` e `src/services/music.ts` nos três cenários — sem chave, sem rede e estouro do `LIMITE_GEMINI_MS` de 22s: três looks base sempre aparecem, o botão Salvar nunca é bloqueado e a interface não anuncia falha de curadoria como se a foto tivesse falhado (FR-019, FR-020, SC-005)

**Checkpoint**: US1 completa — a tabela fixa `vibe → filtro` já foi substituída e o produto é demonstrável sozinho.

---

## Phase 4: User Story 2 — O app aprende o gosto visual da pessoa (Priority: P1)

**Goal**: a sugestão principal passa a vir do histórico local do aparelho, rotulada como afinidade, e melhora com o uso.

**Independent Test**: salvar três fotos da mesma vibe sempre com o mesmo tratamento, capturar uma quarta foto daquela vibe e verificar que a sugestão principal é aquele tratamento, marcada como afinidade.

### Implementation for User Story 2

- [X] T026 [US2] Criar `src/stores/useLookTasteStore.ts` espelhando `src/stores/useTasteStore.ts`: mesmos parâmetros já validados (peso 3 para escolha explícita, 1 para aceite passivo, meia-vida de 30 dias, teto modesto de registros), indexado por `VibeId`, persistido em AsyncStorage com `name` próprio — **store nova, não extensão da existente** (D3)
- [X] T027 [US2] Implementar `lookDeAfinidade(vibeId)` em `src/services/looks.ts`, consultando **apenas** `useLookTasteStore` e aplicando o limiar de sinal suficiente: sem histórico bastante, retorna nulo em vez de um rótulo mentindo (FR-013, FR-015)
- [X] T028 [US2] Integrar o slot de afinidade em `montarLooks()` em `src/services/looks.ts`: quando `lookDeAfinidade` responde, ele é a sugestão principal e as outras duas seguem vindo da cena; quando não responde, o slot vira uma terceira sugestão de cena e nenhum look é rotulado afinidade (FR-017, cenário US2.1)
- [X] T029 [US2] Registrar a escolha visual em `src/components/CaptureSheet.tsx` dentro de `salvar()` e do caminho de postagem, distinguindo escolha explícita de aceite passivo — sem rebaixar `manual` para `auto`, exatamente como `registrarEscolha` já faz para música em `useTasteStore.ts` (FR-010, FR-011)
- [x] T030 [US2] Assegurar em `src/services/music.ts` que o histórico de gosto **visual** não entra no prompt: `preferenciasAprendidas()` segue lendo só o gosto musical, e nenhuma leitura de `useLookTasteStore` aparece em `instrucaoDeCuradoria` ou em `askGeminiWithPhoto` (FR-014, SC-008)
- [x] T031 [US2] Adicionar em `app/settings.tsx` a ação de apagar o histórico de gosto visual, com confirmação explícita, chamando `useLookTasteStore.limpar()` (FR-016, cenário US2.6)
- [x] T032 [US2] Marcar o papel `afinidade` em `amber` (`colors.amber`) em `src/components/LookChips.tsx`, consistente com o uso de amber para música e foco na identidade visual (Princípio VI) — já estava implementado desde a T019 (`papelAfinidade: { color: colors.amber }`), só faltava marcar aqui

**Checkpoint**: US1 e US2 juntas entregam a tese completa da feature — sugestão contextual que aprende.

---

## Phase 5: User Story 3 — Tratamentos fiéis em qualquer aparelho e no arquivo final (Priority: P2)

**Goal**: o look aprovado na tela é o que sai no arquivo, na resolução da foto original, igual nos dois sistemas.

**Independent Test**: salvar a mesma foto com cada um dos três looks e verificar que os arquivos resultantes têm a resolução da foto capturada e são visualmente distintos entre si em Android e iOS.

**Nota de independência**: esta fase depende apenas da Foundational (Phase 2) e pode correr em paralelo às fases 3 e 4.

### Implementation for User Story 3

- [ ] T033 [US3] Adicionar `@shopify/react-native-skia` ao `package.json` e regerar o dev build Android (`npm run android`), confirmando que o app sobe com o módulo nativo presente — **parcial**: pacote já adicionado (`npx expo install`, está no `package.json`/`package-lock.json`) e o bundle Metro já foi verificado com `npx expo export --platform android` (resolve o módulo inteiro sem erro, inclusive a dependência opcional `react-native-reanimated` que o Skia isola no próprio `ReanimatedProxy` — não precisa instalar reanimated à parte). Falta só o `npm run android` de verdade, que exige device/emulador — é o primeiro passo da próxima sessão
- [x] T034 [US3] Implementar em `src/services/looks.ts` a conversão de `LookRecipe` para matriz de cor do Skia (`ColorMatrix`), cobrindo `brightness`, `saturate`, `contrast` e `sepia` conforme R3 de T001 — `matrizDeCor()`, operando sobre o `FilterDef` já resolvido (denominador comum entre look e preset puro), ver nota de decisão no ESTADO.md
- [x] T035 [US3] Reescrever `src/components/FilteredImage.tsx` para renderizar por Skia com a matriz de T034, eliminando a dependência do `style.filter` do RN, que só aplica `brightness` em iOS — a limitação está documentada em `src/types.ts` (FR-025, SC-007) — carga opcional via `skiaBridge.ts`: sem o nativo, cai para o render antigo automaticamente, **não verificado visualmente em device**
- [x] T036 [US3] Criar `src/services/renderLook.ts` com o render offscreen que aplica a receita sobre a foto original em resolução cheia e devolve um arquivo, substituindo o print de tela (FR-024, SC-006)
- [x] T037 [US3] Trocar `renderizarComFiltro()` em `src/components/CaptureSheet.tsx` para usar `renderLook`, removendo o `captureRef` e o import de `react-native-view-shot` se ele não tiver outro uso — **decisão registrada no ESTADO.md**: o `captureRef` foi mantido como rede de segurança para quando o Skia ainda não foi regerado, em vez de removido — sem ele, salvar antes do rebuild sairia sem filtro nenhum, contradizendo a carga opcional da R3
- [ ] T038 [US3] Verificar a paridade visual conferindo, com a mesma foto, que os três looks são distinguíveis entre si e que o arquivo exportado tem a resolução da foto capturada, registrando o resultado em `specs/003-looks-sugeridos/quickstart.md` — **bloqueado por device**: exige o rebuild de T033 rodando de verdade

**Checkpoint**: a feature fica honesta em iOS e o arquivo final deixa de ser uma captura de tela.

---

## Phase 6: User Story 4 — Retomar a decisão pela galeria (Priority: P3)

**Goal**: reabrir uma mídia traz as três sugestões e a escolha, sem rede; mídias antigas continuam abrindo normalmente.

**Independent Test**: salvar uma mídia, fechar o app, reabri-la pela galeria e verificar que as três sugestões aparecem sem chamada externa e que trocar entre elas atualiza a mídia salva.

### Implementation for User Story 4

- [x] T039 [US4] Persistir `looks` e `lookEscolhido` no registro salvo em `src/components/CaptureSheet.tsx` (`salvar()`), pelo mesmo caminho por onde `sugestoes` já é gravado (FR-022)
- [X] T040 [US4] Passar `looks` e `lookEscolhido` para `start()` em `app/gallery.tsx`, como já é feito com `sugestoes: m.sugestoes ?? []`
- [X] T041 [US4] Garantir a compatibilidade das mídias gravadas antes desta feature em `app/gallery.tsx` e `src/services/looks.ts`: `looks` ausente cai para os looks base derivados de `filtroId`/`vibeId`, sem erro e sem sugestões inventadas (FR-023, SC-009)
- [x] T042 [US4] Fazer a troca de look numa mídia reaberta atualizar o registro salvo e contar para o histórico de gosto em `src/components/CaptureSheet.tsx` (cenário US4.3)
- [x] T043 [US4] Impedir que reabrir uma mídia que já traz `looks` redispare a curadoria no `useEffect` de análise em `src/components/CaptureSheet.tsx`, pelo mesmo motivo que motivou o T083 no lado musical

**Checkpoint**: as quatro user stories completas.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T044 Rodar `npm run typecheck` na raiz e zerar qualquer erro de tipo introduzido pela feature — verde, inclusive depois de `@shopify/react-native-skia`
- [x] T045 [P] Reavaliar `src/components/FilterLayer.tsx`: com o render por Skia (T035) os overlays viram parte da receita — atualizar o componente ou removê-lo se nenhum consumidor restar — **mantido**: ainda tem dois consumidores reais (`app/camera.tsx`, o visor ao vivo por FR-021, e `FilteredImageLegado`, a rede de segurança sem Skia); comentário do arquivo atualizado explicando os dois
- [x] T046 [P] Atualizar `CLAUDE.md` e `README.md` trocando a descrição da tabela fixa `vibe → filtro` pela de três looks sugeridos com memória de gosto
- [ ] T047 Executar o roteiro de `specs/003-looks-sugeridos/quickstart.md` de ponta a ponta no dev build e registrar o resultado de cada cenário — **bloqueado por device**, ver ESTADO.md
- [ ] T048 Conferir os critérios SC-001 a SC-009 de `specs/003-looks-sugeridos/spec.md` um a um, anotando no `quickstart.md` como cada um foi verificado — SC-001 a SC-005, SC-008 e SC-009 já confirmados em sessão anterior (ver ESTADO.md); **SC-006 e SC-007 (resolução do arquivo exportado, paridade Android/iOS) dependem do Skia rodando de verdade em device — pendentes**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente
- **Foundational (Phase 2)**: depende da Phase 1 — **bloqueia todas as user stories**
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da Phase 2 e da US1 (registra a escolha feita na interface da US1)
- **US3 (Phase 5)**: depende **só** da Phase 2 — pode correr em paralelo às fases 3 e 4
- **US4 (Phase 6)**: depende da Phase 2 e da US1 (persiste o que a US1 produz)
- **Polish (Phase 7)**: depende de todas as fases desejadas

### User Story Dependencies

- **US1 (P1)**: nenhuma dependência entre stories — é o MVP
- **US2 (P1)**: consome a interface de escolha da US1; sem ela o registro não tem o que registrar
- **US3 (P2)**: independente das demais por decisão de plano (risco "Skia arrastar o cronograma")
- **US4 (P3)**: consome o `looks` que a US1 põe na sessão

### Within Each User Story

- Serviço antes de store, store antes de componente, componente antes de tela
- Degradação verificada por último, quando o caminho feliz já está fechado

### Parallel Opportunities

- **Phase 1**: T002 em paralelo a T001
- **Phase 2**: T004 em paralelo a T003; T012 depende de T005 e T007
- **Phase 3**: T019 (`LookChips.tsx`, arquivo novo) em paralelo a T014–T017 (`music.ts`)
- **Phase 5 inteira** em paralelo às fases 3 e 4, se houver duas pessoas
- **Phase 7**: T045 e T046 em paralelo

---

## Parallel Example: User Story 1

```bash
# T014–T017 mexem todos em src/services/music.ts — SEQUENCIAIS entre si.
# T019 cria um arquivo novo e não colide com nenhum deles:
Task: "Criar src/components/LookChips.tsx com as três sugestões e o papel"
Task: "Declarar GeminiLookIdea e estender GeminiSceneResult em src/services/music.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → Phase 2 (Foundational)
2. Phase 3 (US1)
3. **PARAR E VALIDAR**: capturar, ver os três looks, trocar entre eles, salvar
4. Demonstrável: a tabela fixa já morreu

### Incremental Delivery

1. Setup + Foundational → fundação pronta
2. + US1 → **MVP**, três looks justificados por foto
3. + US2 → a sugestão principal aprende com o uso (a tese completa da feature)
4. + US3 → fidelidade em iOS e resolução cheia no arquivo
5. + US4 → decisão retomável pela galeria

### Parallel Team Strategy

Com duas pessoas, depois da Phase 2:

- Pessoa A: US1 → US2 → US4 (a linha de produto)
- Pessoa B: US3 (Skia), isolada por decisão de plano

---

## Notes

- Sem tarefas de teste automatizado: não há runner no repositório e nem a spec nem o plano pedem TDD. A verificação é `npm run typecheck` mais o `quickstart.md`.
- `FR-021` é o motivo de `app/camera.tsx` e `src/components/FilterCarousel.tsx` aparecerem quase nada aqui: o visor ao vivo continua nos 8 presets locais, sem depender de rede.
- Commits em pt-BR no imperativo, um por tarefa ou por grupo lógico, conforme o `CLAUDE.md`.
- Marcar cada tarefa como `[X]` neste arquivo assim que concluída.

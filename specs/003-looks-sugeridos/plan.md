# Implementation Plan: Looks sugeridos com memória de gosto

**Branch**: `claude/current-filter-system-6gpmbh` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-looks-sugeridos/spec.md`

## Summary

Trocar a tabela fixa `vibe → filtro` por **três looks sugeridos por foto**, no mesmo molde da curadoria musical: um papel de `afinidade` derivado do histórico local do aparelho e dois papéis de cena vindos do Gemini. Cada look é uma **receita ancorada** — um dos oito filtros base mais desvios limitados —, nunca um conjunto de números soltos. Nada de edição manual.

A economia do desenho vem de três reaproveitamentos: a chamada multimodal já existe (`analyzePhotoAndSuggest`), o padrão de papéis já existe (`PapelFaixa`), e a memória de gosto ponderada por vibe já existe (`useTasteStore`). A feature é, em boa medida, espelhar o lado musical no lado visual — o que também é o argumento de Princípio I mais forte que o projeto pode fazer.

## Technical Context

**Language/Version**: TypeScript 5.9 estrito, React 19.1, React Native 0.81.5

**Primary Dependencies**: Expo SDK 54, `expo-router`, `expo-camera` 17, `zustand` 5 + `@react-native-async-storage/async-storage`, Gemini via REST (`EXPO_PUBLIC_GEMINI_API_KEY`), Deezer. **A adicionar (US3)**: `@shopify/react-native-skia`.

**Storage**: AsyncStorage via `zustand/middleware` `persist`; fotos em `documentDirectory`.

**Testing**: sem runner configurado no repo. Verificação por `npm run typecheck` e roteiro manual em dev build (`quickstart.md`).

**Target Platform**: Android (dev build) como alvo primário — os módulos nativos existentes (`modules/share-target`, `modules/video-muxer`) só têm implementação Android. iOS entra pela US3.

**Project Type**: mobile app, Expo dev client (não Expo Go — apesar de comentários no código ainda dizerem isso).

**Performance Goals**: troca entre sugestões percebida como instantânea; visor ao vivo sem regressão de frame; nenhum orçamento novo de rede.

**Constraints**: teto de 22s no Gemini já existente e reaproveitado sem alteração (`LIMITE_GEMINI_MS`); salvamento nunca bloqueado por curadoria; histórico de gosto não trafega.

**Scale/Scope**: ~8 arquivos alterados, ~4 criados, 1 store nova, 1 migração de dado persistido.

## Constitution Check

*GATE: verificado antes da Fase 0 e novamente após a Fase 1.*

| Princípio | Situação | Como o plano atende |
|---|---|---|
| **I. Multimodalidade Primeiro** | ✅ Reforçado | O look passa a ter a mesma estrutura de papéis da música. A escolha visual entra no pacote persistido junto da faixa. |
| **II. Redução do Atrito** | ✅ Atendido | Sugestão principal já aplicada ao abrir o modal; zero toque a mais no caminho padrão. Sem controles manuais (FR-007). |
| **III. Contexto em Tempo Real** | ⚠️ Risco governado | Look gerado depende de rede, então **não toca o visor** (FR-021): visor segue nos 8 presets locais. A curadoria continua fora do caminho crítico do frame. |
| **IV. Privacidade e LGPD** | ⚠️ Risco governado | Histórico visual é consumido **só localmente** e nunca entra no prompt (FR-014), replicando a decisão **D7** já tomada para gosto musical. Botão de apagar nos Ajustes (FR-016). |
| **V. Persistência da Intenção** | ✅ Atendido | Sugestões e escolha persistidas na mídia (FR-022); retomáveis pela galeria (US4); campos opcionais para não quebrar mídias antigas (FR-023). |
| **VI. Identidade Visual** | ✅ Atendido | Chips de look reusam o estilo de chip existente (raio 15px, Lato caixa alta); papel `afinidade` marcado em `amber`, consistente com o uso de amber para música/foco. |

**Sem violações que exijam Complexity Tracking.** A adição do Skia não é desvio: a constituição já fixa Skia na stack, e o código atual é que está aquém dela.

## Decisões de arquitetura

### D1 — Os looks viajam na chamada que já existe

Estender o schema de resposta de `analyzePhotoAndSuggest` para trazer, além de `vibeId` e faixas, **duas** receitas de look. Zero chamada nova.

Motivo: o próprio repo mediu essa chamada variando de **2,9s a 123s** (`src/services/music.ts:25`). Uma segunda chamada dobraria a exposição a essa cauda. O teto de 22s permanece intocado.

A terceira sugestão — a de `afinidade` — **não é pedida ao Gemini**. É montada no aparelho a partir do histórico. Isso não é só privacidade: é o que torna a afinidade confiável, porque ela vira consulta a um dado que o app tem, não palpite de um modelo que não viu o histórico.

### D2 — Look é receita ancorada, não número solto

```
LookRecipe {
  base: FilterId          // um dos 8 — a âncora
  ajustes: { …desvios limitados… }
  nome: string            // curto, exibível no chip
  justificativa: string   // uma linha, como as faixas já têm
  papel: 'afinidade' | 'certeira' | 'ousada'
}
```

Pedir delta a partir de um preset nomeado, em vez de valores absolutos, faz o modelo pousar sempre num lugar sano e dá explicabilidade de graça. É a mesma lição do T056 registrada em `music.ts:244` — a instrução precisa fixar o formato, senão o modelo governa o resultado.

### D3 — `useLookTasteStore`, espelho do `useTasteStore`

Store nova, mesmos parâmetros já validados no lado musical: peso 3 para escolha explícita, 1 para aceite passivo, meia-vida de 30 dias, indexado por `VibeId`, teto modesto de registros.

Não estender o `useTasteStore`: ele é persistido e tem regime de privacidade próprio documentado; misturar gosto visual e musical no mesmo blob complica migração e a leitura da regra D7. Duas stores, mesma forma.

**Limiar de afinidade**: o slot só é rotulado `afinidade` com sinal suficiente naquela vibe (FR-015). Abaixo disso, vira a terceira sugestão de cena — nunca um slot vazio nem um rótulo mentindo.

### D4 — Clamp e dedupe antes de qualquer pixel

Todo valor vindo do modelo passa por faixa segura (FR-026). Looks visualmente redundantes entre si são detectados por distância entre receitas e o redundante é trocado por um preset base. A promessa é "três escolhas reais", não "três chips".

### D5 — Determinismo por foto

Cache da análise por `photoUri` (FR-009). Mesma foto reaberta não redispara curadoria — o problema que a mídia já resolveu para faixas guardando `sugestoes` junto (ver comentário em `src/types.ts`, campo `sugestoes` de `Media`).

### D6 — Skia: fidelidade e resolução (US3)

Duas dívidas que a feature transforma em bloqueio:

1. `style.filter` do RN **só aplica `brightness` em iOS** (`src/types.ts:31`). Com três looks distintos, iOS mostraria três chips e uma imagem só.
2. O export é `captureRef` — **print de tela** (`src/components/CaptureSheet.tsx:300`) —, então o arquivo sai na resolução da prévia.

Solução única: `FilteredImage` passa a renderizar por Skia, e `renderizarComFiltro` vira render offscreen em resolução cheia. Resolve os dois de uma vez e cumpre a stack da constituição.

### D7 — Persistência aditiva

`Media` ganha `looks?: LookRecipe[]` e `lookEscolhido?: LookRecipe`. **Opcionais de propósito**, seguindo a convenção que o próprio `types.ts` já documenta para `aspecto` e `sugestoes`: ausência significa "não sei", nunca "não há". `filtroId` permanece para compatibilidade e como âncora do look.

`chavePacote` em `preExport.ts` passa a considerar a identidade do look, senão o vídeo pré-gerado de um look serve para outro.

## Project Structure

### Documentation (this feature)

```text
specs/003-looks-sugeridos/
├── plan.md              # Este arquivo
├── spec.md              # Especificação
├── data-model.md        # Fase 1 — LookRecipe, EscolhaVisual, migração de Media
├── quickstart.md        # Fase 1 — roteiro manual de verificação em dev build
├── research.md          # Fase 0 — schema Gemini, faixas de clamp, API Skia
├── contracts/
│   └── gemini-look.md   # Contrato do trecho de look na resposta multimodal
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (feito)
└── tasks.md             # Fase 2 — /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── types.ts                          # ALTERA: LookRecipe, PapelLook, Media.looks
├── constants/
│   └── filters.ts                    # ALTERA: 8 presets viram âncoras de receita
├── services/
│   ├── music.ts                      # ALTERA: schema + prompt trazem 2 looks
│   ├── looks.ts                      # CRIA: montar 3 looks, clamp, dedupe, degradação
│   └── preExport.ts                  # ALTERA: chavePacote inclui o look
├── stores/
│   ├── useLookTasteStore.ts          # CRIA: histórico de gosto visual
│   ├── useCaptureStore.ts            # ALTERA: sessão carrega looks + escolhido
│   └── useGalleryStore.ts            # ALTERA: persiste looks (migração aditiva)
├── components/
│   ├── FilteredImage.tsx             # ALTERA: render por receita (Skia na US3)
│   ├── FilterLayer.tsx               # ALTERA/ABSORVE: overlay vira parte da receita
│   ├── LookChips.tsx                 # CRIA: 3 sugestões + papel + justificativa
│   ├── FilterCarousel.tsx            # ALTERA: sugestões primeiro, 8 base depois
│   └── CaptureSheet.tsx              # ALTERA: aplica principal, registra escolha
└── app/
    ├── camera.tsx                    # ALTERA: mínimo — visor segue nos presets locais
    ├── gallery.tsx                   # ALTERA: reabrir com looks (US4)
    └── settings.tsx                  # ALTERA: apagar histórico de gosto visual
```

**Structure Decision**: mantém a estrutura vigente do app (`app/` para rotas via expo-router, `src/` por camada). A feature não introduz diretório novo de topo; a lógica de look ganha um serviço próprio (`src/services/looks.ts`) para não inchar `music.ts`, que já concentra a cadeia de degradação musical.

## Faseamento

| Fase | Entrega | Depende de |
|---|---|---|
| **F0 — Research** | Schema do Gemini para o trecho de look; faixas seguras de clamp; API Skia para matriz de cor e render offscreen | — |
| **F1 — Contrato e modelo** | `LookRecipe`, `PapelLook`, `Media` estendida, `data-model.md`, `contracts/gemini-look.md` | F0 |
| **F2 — US1** | Três looks no Modal de Captura, principal aplicado, 8 base depois, degradação completa | F1 |
| **F3 — US2** | `useLookTasteStore`, registro no salvar/postar, slot de afinidade, limpar nos Ajustes | F2 |
| **F4 — US3** | Skia no `FilteredImage` + export offscreen em resolução cheia | F1 (independente de F2/F3) |
| **F5 — US4** | Looks retomáveis pela galeria, migração de mídias antigas verificada | F2 |

F2 e F3 já entregam a demonstração completa da tese. F4 é fatiável em paralelo e é o que torna a feature honesta em iOS.

## Riscos

| Risco | Mitigação |
|---|---|
| Gemini devolve receita feia ou extrema | Delta a partir de âncora (D2) + clamp (D4). O pior caso é um preset base, nunca uma imagem quebrada. |
| Cauda de latência de 123s já medida | Sem chamada nova (D1); salvamento nunca espera (FR-020); cadeia de degradação obrigatória. |
| Histórico frio nas primeiras semanas | Limiar de afinidade (D3): sem sinal, o slot é de cena e não mente no rótulo. |
| Migração de mídias já salvas | Campos opcionais (D7), seguindo convenção já usada duas vezes no `types.ts`. Cenário coberto por SC-009. |
| Skia arrastar o cronograma | F4 isolada das demais fases; US1/US2 demonstráveis sobre o render atual em Android. |
| Perda de coerência de feed (todo dia um look diferente) | É exatamente o que o histórico corrige: quanto mais a pessoa usa, mais a principal converge para o gosto dela. |

## Próximo passo

`/speckit-tasks` para gerar `tasks.md` a partir deste plano.

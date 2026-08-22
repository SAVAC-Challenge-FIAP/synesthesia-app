# Implementation Plan: Vibe definida pela IA

**Branch**: `feature/005-vibe-pela-ia` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-vibe-pela-ia/spec.md`

## Summary

Inverter a ordem entre vibe e curadoria. Hoje `detectVibe()` chuta um dos oito
`VibeId` por hora do dia, esse rótulo vira âncora da busca — e foi ele que
transformou um papel de parede de samurai em funk de Copa do Mundo. A feature
retira o rótulo do prompt e o transforma em **saída** do Gemini: texto livre de
até duas palavras, lido da imagem com hora e lugar em mãos.

O desenho aproveita quase tudo que já existe. A chamada multimodal
(`analyzePhotoAndSuggest`) já manda a foto e já devolve um campo `vibe` — o que
muda é o **contrato daquele campo**: deixa de ser "escolha um destes oito ids" e
passa a ser "escreva o que a cena transmite". As `musicaKeywords` saem do
caminho da busca; a leitura da cena, que o Gemini já fazia bem (campo `cena`),
passa a governar. Hora e localização entram como duas linhas de texto no mesmo
prompt, sem chamada nova.

O custo real da feature não está no prompt — está nos **quatro sistemas que
indexam por `VibeId`** e que a spec proíbe regredir. A estratégia é não
desmontar nenhum deles: `VibeId` continua existindo como **piso local**
(visor ao vivo, degradação, mídias antigas), e a vibe livre entra como campo
aditivo ao lado. As duas stores de gosto deixam de agrupar por vibe e passam a
ser o que a spec descreve: listas das últimas 20 escolhas.

## Technical Context

**Language/Version**: TypeScript 5.9 estrito, React 19.1, React Native 0.81.5

**Primary Dependencies**: Expo SDK 54, `expo-router`, `expo-camera` 17, `zustand` 5 + `@react-native-async-storage/async-storage`, `@shopify/react-native-skia` 2.2.12, Gemini via REST (`EXPO_PUBLIC_GEMINI_API_KEY`), Deezer. **A adicionar (US4)**: `expo-location`.

**Storage**: AsyncStorage via `zustand/middleware` `persist`; fotos e áudio em `documentDirectory`.

**Testing**: sem runner configurado no repo. Verificação por `npm run typecheck` e roteiro manual em dev build ([quickstart.md](./quickstart.md)).

**Target Platform**: Android (dev build) como alvo primário; módulos nativos do repo (`modules/share-target`, `modules/video-muxer`) são Android-only.

**Project Type**: mobile app, Expo dev client.

**Performance Goals**: nenhum orçamento novo de rede — a vibe viaja na chamada que já existe. Localização com teto próprio e curto, resolvida **antes** e em paralelo ao preparo da imagem, nunca somando ao caminho crítico. Visor ao vivo sem regressão de frame.

**Constraints**: teto de 22s no Gemini (`LIMITE_GEMINI_MS`) preservado sem alteração; salvamento nunca bloqueado por curadoria; localização é opcional em todo caminho; `Media` persistida só admite campo aditivo.

**Scale/Scope**: ~12 arquivos alterados, ~2 criados, 2 stores com modelo de dado alterado, 1 permissão nova, 1 dependência nova.

## Constitution Check

*GATE: verificado antes da Fase 0 e novamente após a Fase 1.*

| Princípio | Situação | Como o plano atende |
|---|---|---|
| **I. Multimodalidade Primeiro** | ✅ Reforçado | A vibe deixa de ser rótulo de catálogo e passa a ser a leitura única daquela cena — a mesma leitura que gera trilha e looks. O pacote sensorial fica mais coeso, não menos. |
| **II. Redução do Atrito** | ✅ Atendido | Nenhum toque a mais: a vibe continua chegando pronta. Fora de escopo edição manual de vibe (spec). O esqueleto substitui um valor errado por uma espera honesta. |
| **III. Contexto em Tempo Real** | ⚠️ Risco governado | **O visor não muda.** `detectVibe()` continua local e determinístico, e o carrossel ao vivo segue nos 8 presets (FR-021 da 003). A vibe do Gemini só existe depois da captura. Localização é resolvida fora do caminho do frame, com teto próprio. |
| **IV. Privacidade e LGPD** | ⚠️ Risco governado — **é o ponto mais caro da feature** | Duas divulgações novas: **localização** e **histórico de gosto visual**. Ambas sob consentimento explícito e degradação silenciosa. A forma do consentimento da localização mudou por decisão do Sávio e exigiu a **emenda 1.2.0** da constituição. Ver [D5](#d5--o-que-sai-do-aparelho-e-sob-qual-consentimento). |
| **V. Persistência da Intenção** | ✅ Atendido | `vibe` livre entra como campo aditivo; `vibeId` permanece gravado. Mídias antigas abrem com a vibe que tinham (FR-035). |
| **VI. Identidade Visual** | ✅ Atendido | O esqueleto reusa o vocabulário já validado em `TratamentoCarrossel` (shimmer + respiração). Sem emoji inventado para vibe livre — ver [D4](#d4--a-vibe-livre-não-tem-emoji). |

**Sem violações que exijam Complexity Tracking.** O risco de LGPD é governado por
decisão registrada (D5), não por exceção.

## Decisões de arquitetura

### D1 — `VibeId` não morre; ganha uma companheira

A tentação é trocar `VibeId` por `string` em toda parte. Seria errado: `VibeId`
é hoje a chave de quatro sistemas que **não dependem de rede** — visor ao vivo,
`looksBase()`, catálogo `FALLBACK` de música, e as mídias já gravadas. Vibe
livre não pode fornecer nenhum deles: ela só existe quando o Gemini responde.

Então o modelo passa a ter **dois campos com papéis distintos**:

```
vibeId: VibeId          // piso local, sempre presente, determinístico
vibe?:  string          // leitura do Gemini, até 2 palavras, pode faltar
```

`vibe` é o que a interface **exibe**. `vibeId` é o que o sistema **usa** quando
precisa de algo garantido. Onde `vibe` falta, a UI mostra esqueleto (durante a
espera) ou cai no nome do `vibeId` (FR-036, mídias antigas).

Isto é exatamente o padrão que `aspecto`, `sugestoes`, `looks` e `audioUri` já
estabeleceram no `Media`: campo aditivo opcional, ausência significa "não sei",
nunca "não há".

### D2 — A busca musical perde a âncora de rótulo, não o filtro de qualidade

`instrucaoDeCuradoria()` e `askGeminiWithPhoto()` deixam de citar
`vibe.musicaKeywords`. É o coração do defeito: `"funk brasileiro"` estava
escrito no prompt antes de qualquer coisa ser vista.

Mas `faixaAproveitavel(t, vibe)` também usa `vibe.musicaKeywords` — para
**rejeitar** faixas cujo título é a própria keyword (ruído de catálogo do
Deezer). Esse uso é defensivo e não contamina nada; ele passa a receber a lista
de keywords **derivada dos termos de busca efetivamente usados**, não da tabela
de vibes. O filtro anti-catálogo continua de pé; a âncora some.

`getSuggestions(vibe)` — o caminho só-texto, sem foto — continua existindo e
continua usando as keywords. Ele é degradação: quando não há foto lida, o
rótulo local é a única informação que sobrou, e usá-lo é melhor que não usar
nada (FR-036).

### D3 — As stores de gosto trocam índice por lista

Hoje as duas indexam por vibe: `sugeridasPorVibe[vibeId]`, `preferidoDaVibe()`.
Com vibe livre, essa chave deixa de existir — não dá para agrupar por um texto
que muda a cada foto.

A spec já diz o que colocar no lugar: **as últimas 20 escolhas, sem
agrupamento** (FR-033). Então:

- `useTasteStore` ganha `ultimasEscolhas(20)` devolvendo `{titulo, artista, genero}`, e `sugeridasPorVibe` vira uma lista global única (`faixasSugeridasGlobais` já existe e já é o que o caminho com foto usa — passa a ser o único).
- `useLookTasteStore` troca `preferidoDaVibe(vibeId)` por `ultimosTratamentos(20)` devolvendo `{base, ajustes, nome}`, e `preferido()` sem argumento para o slot de afinidade.

**O limiar de afinidade sobrevive**, sem a vibe: `LIMIAR_PESO`/`LIMIAR_ESCOLHAS`
passam a ser avaliados sobre o histórico inteiro em vez do recorte por vibe. A
razão de existir deles não era a vibe — era "uma escolha isolada não é gosto
estabelecido", que continua valendo.

Migração: as escolhas antigas têm `vibeId` gravado. Ele é **ignorado na leitura**,
não apagado — os registros continuam válidos como histórico linear. Zero risco
de perda; o campo simplesmente para de ser consultado.

### D4 — A vibe livre não tem emoji

A galeria hoje mostra `{vibe.emoji} {vibe.nome}`. Pedir um emoji ao Gemini
somaria um campo que pode vir vazio, vir errado, ou vir com um glifo que a fonte
não tem — para ganhar decoração.

O card passa a mostrar só o texto da vibe, em caixa alta, no mesmo estilo Lato
com `letterSpacing` que já carrega o caráter técnico das labels. Onde `vibe`
falta (mídia antiga), cai para `vibeById(vibeId)` e aí o emoji volta, porque
aquele registro de fato tem um. Sem inventar glifo para dado que não existe.

### D5 — O que sai do aparelho, e sob qual consentimento

Esta feature aumenta o que trafega em dois eixos, e ambos merecem registro
porque contrariam decisões escritas no próprio código:

**Gosto visual** — `useLookTasteStore` diz, em comentário e em FR-014 da feature
003: *"este dado não sai do aparelho"*. A spec 005 **reverte** isso
explicitamente (FR-033: "e do mesmo jeito para o filtro"). É decisão do Sávio,
igual à que o T074 tomou para o gosto musical. O plano a executa e registra a
reversão em `useLookTasteStore` — o comentário antigo tem que sair junto, ou o
código passa a mentir.

**Localização** — permissão nova, dado de outra natureza.

> **Revisto em 2026-08-22, depois da implementação, por decisão do Sávio**:
> *"localização ligada por padrão, deve pedir ao entrar no app na primeira vez;
> se aceitar, pronto; se não, aí desativa nas configurações"*. A versão original
> desta decisão punha o toggle **desligado** e pedia a permissão na primeira
> captura. Como o Princípio IV exigia opt-in (isto é, desligado por padrão), a
> mudança foi registrada como **emenda 1.2.0 da constituição** — o princípio
> passa a exigir consentimento *informado, persistido e revogável*, admitindo
> que ele seja colhido no onboarding.

Fica sob três travas:

1. **Consentimento no onboarding**, em card próprio com justificativa visível — não uma linha na letra miúda. Recusar não bloqueia nada: a vibe passa a sair só da imagem e da hora. Localização **nunca entra no gate** que segura a entrada no app (esse gate é só da câmera).
2. **Revogação nos Ajustes** (`usarLocalizacao`, nasce ligado). Desligar corta o envio na hora, sem depender das configurações do sistema. É a via que o Princípio IV exige.
3. O que vai ao prompt é **texto humano de cidade/região** (geocodificação reversa local do `expo-location`), nunca coordenada. "Santos, SP" responde a pergunta que o produto faz ("estou na praia?") sem entregar um ponto no mapa. No Android, só `ACCESS_COARSE_LOCATION` é declarada.

O pedido acontece **uma vez, no onboarding**. O caminho da captura só consome a
permissão já concedida — nunca abre diálogo no meio de uma foto (cenário 2 da
US4). Negado, ausente ou lento: some do prompt e nada mais acontece (FR-034).

### D6 — Hora do dia é grátis e entra sempre

`new Date()` não pede permissão nem rede. Entra no prompt como período legível
(`"início da noite (19h)"`), não como timestamp — é o que o modelo consegue usar.
Não tem caminho de falha, então não tem degradação a desenhar.

### D7 — O esqueleto é obrigação, não enfeite

FR-031 é explícito: *nunca um valor provisório*. Hoje `CaptureSheet` mostra
`vibe.nome` da prévia heurística desde o primeiro frame do modal — exatamente o
valor errado que a feature quer eliminar. O esqueleto entra como componente
compartilhado extraído do `Esqueleto` de `TratamentoCarrossel`, que já resolveu
shimmer + respiração e já foi validado no aparelho.

Estado terminal importa: se a curadoria termina sem vibe do Gemini, o esqueleto
**sai** e o nome do `vibeId` entra (FR-036, cenário 3 da US1). Esqueleto preso
na tela é o defeito que a spec nomeia.

## Project Structure

### Documentation (this feature)

```text
specs/005-vibe-pela-ia/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── gemini-cena.md   # Fase 1 — contrato do prompt/resposta
└── tasks.md             # Fase 2 (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
app/
├── camera.tsx           # ALTERADO — sessão nasce sem `vibe`; visor intocado
├── capture.tsx
├── gallery.tsx          # ALTERADO — card lê `vibe` com queda para vibeById (D4)
├── index.tsx            # ALTERADO — card e pedido de localização (D5 revisto)
└── settings.tsx         # ALTERADO — toggle "Usar localização" = revogação (LGPD)

src/
├── components/
│   ├── CaptureSheet.tsx      # ALTERADO — esqueleto da vibe; propaga `vibe`
│   ├── EsqueletoTexto.tsx    # NOVO — esqueleto de linha de texto (D7)
│   ├── MusicSheet.tsx        # ALTERADO — cabeçalho lê vibe livre
│   └── TratamentoCarrossel.tsx  # ALTERADO — extrai o shimmer compartilhado
├── constants/
│   └── vibes.ts         # intocado — vira piso local (D1)
├── services/
│   ├── contexto.ts      # NOVO — hora + lugar → linhas de prompt (D5/D6)
│   ├── looks.ts         # ALTERADO — afinidade sem recorte por vibe (D3)
│   ├── music.ts         # ALTERADO — núcleo: prompt, contrato, gosto (D2)
│   └── vibeEngine.ts    # intocado — piso do visor (FR-021)
├── stores/
│   ├── useCaptureStore.ts    # ALTERADO — campo `vibe?: string`
│   ├── useGalleryStore.ts    # ALTERADO — persiste `vibe`
│   ├── useLookTasteStore.ts  # ALTERADO — lista, não índice (D3/D5)
│   ├── useSettingsStore.ts   # ALTERADO — `usarLocalizacao`
│   └── useTasteStore.ts      # ALTERADO — lista, não índice (D3)
└── types.ts             # ALTERADO — `vibe?: string` em Media (D1)
```

**Structure Decision**: estrutura existente do app Expo Router, sem diretório
novo. A feature é cirúrgica por desenho: o único arquivo que muda de forma
substancial é `src/services/music.ts`, onde o prompt e o contrato vivem. Os dois
arquivos novos (`EsqueletoTexto.tsx`, `contexto.ts`) existem para não duplicar
código já validado e para isolar a única superfície nova de permissão.

## Fatiamento por User Story

Cada fatia é entregável e verificável sozinha, na ordem de prioridade da spec.

| Fatia | Entrega | Toca |
|---|---|---|
| **US1** (P1) | Vibe livre exibida + esqueleto | `music.ts` (contrato de resposta), `types.ts`, stores de sessão/galeria, `CaptureSheet`, `EsqueletoTexto`, `gallery.tsx` |
| **US2** (P1) | Busca sem âncora de rótulo | `music.ts` (prompt, `faixaAproveitavel`, termos de busca) |
| **US3** (P2) | Listas de gosto no prompt | `useTasteStore`, `useLookTasteStore`, `looks.ts`, `music.ts` |
| **US4** (P3) | Lugar e hora | `contexto.ts`, `useSettingsStore`, `settings.tsx`, `music.ts`, `expo-location` |

US1 e US2 tocam o mesmo arquivo e podem sair no mesmo PR; US3 e US4 são
independentes entre si e de tudo acima.

## Riscos e como o plano os cobre

| Risco (da spec) | Cobertura |
|---|---|
| `Media` persistida | Campo aditivo opcional; leitura tolerante; `vibeId` preservado (D1, FR-035) |
| Stores indexam por vibe | Trocam índice por lista; registros antigos permanecem legíveis (D3) |
| Visor não pode esperar rede | `vibeEngine.ts` intocado; nenhuma chamada nova no caminho do frame (D1) |
| Galeria rotula por vibe | Lê `vibe`, cai para `vibeById` quando falta; emoji só onde existe (D4) |
| Localização: LGPD + latência | Consentimento no onboarding com card próprio, revogável nos Ajustes, texto de cidade e não coordenada, teto próprio (D5 + emenda 1.2.0) |
| Vibe livre com mais de 2 palavras | Truncada no cliente, como `receitaDeIdeia` já faz com `nome` — instrução em prompt é pedido, não garantia |

## Complexity Tracking

> Sem violações de constituição que exijam justificativa.

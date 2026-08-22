# Estado da implementação — 005 Vibe definida pela IA

**Atualizado**: 2026-08-22 · **Branch**: `feature/005-vibe-pela-ia`

## Onde parou

**Todas as 46 tasks implementadas** (44 do plano + T045/T046, do ajuste de
localização pedido em 2026-08-22). `npm run typecheck` limpo. Falta a
**validação no aparelho** — é o Sávio quem testa, e o release 1.3.0 depende
dessa aprovação. O plano B para o pitch continua sendo o 1.2.1.

| Fatia | Status |
|---|---|
| Foundational (T001–T004) | ✅ implementado |
| US1 — vibe descreve a cena (T005–T016) | ✅ implementado, não validado no device |
| US2 — trilha combina com a foto (T017–T020) | ✅ implementado, não validado no device |
| US3 — gosto no prompt (T021–T031) | ✅ implementado, não validado no device |
| US4 — lugar e hora (T032–T039, T045–T046) | ✅ implementado, **exige rebuild nativo** |
| Polish (T040–T044) | ✅ typecheck, órfãos, comentários, prova das funções puras |

## ⚠️ O que precisa acontecer antes de testar

**Rebuild do dev build é obrigatório**: `expo-location` entrou como dependência
nova e adiciona `ACCESS_COARSE_LOCATION` ao manifesto. Sem rebuild, a US4
degrada silenciosamente (o `import()` falha e o lugar some) — as US1–US3
funcionam normalmente, mas o V5 do quickstart não tem como passar.

```bash
npx expo run:android
```

Roteiro completo em [quickstart.md](./quickstart.md), V1–V6. O log é a
instrumentação principal:

```bash
adb logcat -s ReactNativeJS | grep -E "\[music\]|\[gosto\]|\[contexto\]"
```

## Duas premissas do plano que a implementação corrigiu

**1. T017/T018 não precisaram de código** (registrado nas próprias tasks).

O plano assumia que a busca do Deezer partia de `musicaKeywords` no caminho com
foto. Não partia: `resolveWithDeezer()` sempre buscou por
`` `${idea.titulo} ${idea.artista}` `` e usava a `Vibe` só para escolher o
emoji. A busca por keyword existe **somente** dentro de `getSuggestions()`, que
é degradação.

Consequência: o defeito relatado (samurai → funk) **nasceu no prompt**, não na
busca. O rótulo `energetica` e suas keywords entravam na instrução, o Gemini
sugeria funk, e o Deezer apenas resolveu fielmente o que foi pedido. **T005
sozinho corrige a US2.** `faixaAproveitavel()` ficou intacto, e a proteção
anti-catálogo que o R2 queria preservar nunca esteve em risco.

**2. `useGalleryStore` não precisou de alteração** (T010).

`add`/`update` recebem `Media`/`Partial<Media>` genéricos, então o campo novo já
flui. Quem monta o objeto é o `CaptureSheet` (T012).

## Riscos que ficaram cobertos, e como conferir

| Risco (spec) | Cobertura | Como conferir |
|---|---|---|
| `Media` persistida | `vibe?` aditivo; `vibeId` intocado | V6: mídia antiga abre com emoji |
| Stores indexavam por vibe | Índice → lista; `vibeId` gravado e ignorado; `migrate` v0→v1 | V6: histórico sobrevive à atualização |
| Visor não pode esperar rede | `vibeEngine.ts` **não foi tocado** | V3: visor troca preset em modo avião |
| Galeria rotula por vibe | `item.vibe` com queda para `vibeById` | V6: cards antigos e novos convivem |
| LGPD / localização | Consentimento no onboarding, revogável nos Ajustes, cidade em texto, `COARSE` apenas | V5: log nunca mostra coordenada; recusar não bloqueia |
| Vibe com mais de 2 palavras | `sanearVibe()` impõe na leitura | provado: 11/11 casos |

## Mudança de regime da localização (2026-08-22)

Depois da implementação, o Sávio decidiu: *"localização ligada por padrão, deve
pedir ao entrar no app na primeira vez; se aceitar, pronto; se não, aí desativa
nas configurações"*. Isso reverteu a D5 original (toggle desligado, pedido na
primeira captura) e exigiu **emenda 1.2.0 da constituição** — o Princípio IV
exigia *opt-in*, que na prática significa desligado por padrão; agora exige
*consentimento informado, persistido e revogável*, admitindo coleta no
onboarding.

O que ficou:

- **Consentimento** no onboarding, card 📍 próprio com justificativa visível.
- **Localização fora do gate de entrada**: recusar não bloqueia o app. Só a câmera bloqueia.
- **Pedido uma única vez**; `lugarDaCena()` nunca abre diálogo no meio de uma foto.
- **Revogação** pelo toggle dos Ajustes, que nasce ligado.
- Android declara só `ACCESS_COARSE_LOCATION` — coerente com "cidade, nunca coordenada".

## Ponto que ainda merece atenção sua

A reversão de privacidade do **gosto visual** está feita e documentada:
`useLookTasteStore` anunciava "este dado não sai do aparelho" (FR-014 da 003) e
agora manda as 20 últimas escolhas visuais ao Gemini, conforme FR-033. O
cabeçalho do módulo foi reescrito no mesmo commit — mas **é decisão sua**,
registrada na spec, e vale reconferir antes do release.

## Arquivos

**Novos**: `src/components/EsqueletoTexto.tsx`, `src/services/contexto.ts`

**Alterados**: `.specify/memory/constitution.md` (emenda 1.2.0), `app/index.tsx`,
`src/types.ts`, `src/services/music.ts`, `src/services/looks.ts`,
`src/services/vibeEngine.ts` (só comentário), `src/constants/vibes.ts` (só
comentário), `src/stores/useTasteStore.ts`, `src/stores/useLookTasteStore.ts`,
`src/stores/useCaptureStore.ts`, `src/stores/useSettingsStore.ts`,
`src/components/CaptureSheet.tsx`, `src/components/MusicSheet.tsx`,
`src/components/TratamentoCarrossel.tsx`, `app/gallery.tsx`, `app/settings.tsx`,
`app.json`, `package.json`

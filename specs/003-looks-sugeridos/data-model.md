# Data Model — Looks sugeridos com memória de gosto (F1)

**Feature**: 003-looks-sugeridos · **Data**: 2026-08-19

Entidades novas e alterações nas existentes. Os tipos vivem em `src/types.ts` (compartilhados) e em `src/stores/useLookTasteStore.ts` (só do histórico).

---

## Convenção que rege este documento

> Campo opcional significa **"não sei"**, nunca **"não há"**.

`src/types.ts` já documenta isso duas vezes — em `Media.aspecto` (T066) e em `Media.sugestoes` (T083). Toda extensão abaixo segue a mesma regra: quem lê um campo ausente reconstrói um valor plausível em vez de tratar como vazio.

---

## `PapelLook`

Rótulo que diz **por que** a sugestão está ali. Espelha `PapelFaixa`, que já existe para música.

| Valor | Origem | Quem produz |
|---|---|---|
| `afinidade` | histórico local do aparelho | `src/services/looks.ts`, nunca o Gemini |
| `certeira` | leitura da cena, sem risco | Gemini |
| `ousada` | leitura da cena, mais solta | Gemini |

São **três** papéis, contra quatro da música: a spec dispensa os equivalentes visuais de `descoberta` e `curinga`.

---

## `AjustesLook`

Os desvios em relação ao preset base. Todos opcionais; ausente = 0 = "não desvia deste eixo".

| Campo | Tipo | Delta aceito | Efeito |
|---|---|---|---|
| `brilho` | `number?` | −0.20 … +0.20 | soma em `imageFilter.brightness` |
| `saturacao` | `number?` | −0.50 … +0.50 | soma em `imageFilter.saturate` |
| `contraste` | `number?` | −0.25 … +0.25 | soma em `imageFilter.contrast` |
| `sepia` | `number?` | −0.30 … +0.30 | soma em `imageFilter.sepia` |
| `veu` | `number?` | −0.15 … +0.15 | soma em `overlayOpacity` do preset |

Faixas e o porquê de cada uma: `research.md` § R2. O clamp roda **antes de qualquer pixel** (FR-026) e de novo sobre o valor absoluto resultante.

---

## `LookRecipe`

A entidade central. **Receita ancorada, não número solto** (D2).

```ts
interface LookRecipe {
  base: FilterId          // âncora: um dos 8 presets — obrigatório
  ajustes: AjustesLook    // desvios limitados
  nome: string            // curto, cabe no chip
  justificativa: string   // uma linha, como as faixas já têm
  papel: PapelLook
}
```

**Invariantes**

1. `base` é sempre um `FilterId` válido — um look sem âncora reconhecível é descartado, não corrigido.
2. `ajustes` já vem clampado; nada não-clampado chega ao render.
3. Um conjunto tem sempre **exatamente três** looks (FR-001), em qualquer cenário de falha.
4. No máximo **um** look por conjunto tem `papel: 'afinidade'`.
5. Dois looks do mesmo conjunto nunca ficam abaixo do limiar de distância (R2), sob pena de as "três escolhas" serem três chips e uma escolha só.

**Identidade de um look** (usada para dedupe, para `chavePacote` e para o histórico): `base` mais os cinco ajustes arredondados. O `nome` não entra — dois looks com nomes diferentes e a mesma receita são o mesmo look.

**Relação com `filtroId`**: `filtroId` **não morre**. Ele continua sendo o que o visor ao vivo usa (FR-021), o que as mídias antigas têm, e a âncora de todo look. `lookEscolhido.base` e `filtroId` andam juntos: escolher um look ajusta os dois.

---

## `EscolhaVisual`

A unidade do histórico de gosto. Espelha `EscolhaMusical` de `useTasteStore.ts`.

```ts
interface EscolhaVisual {
  base: FilterId | null      // null = "sem tratamento" — escolha legítima, não ausência
  ajustes: AjustesLook
  nome: string
  vibeId: VibeId             // índice do histórico
  origem: 'auto' | 'manual'  // manual = trocou; auto = aceitou o que veio
  em: number                 // epoch ms
}
```

`base: null` merece destaque: a spec trata "sem tratamento" como escolha de primeira classe (US1.5, edge case dedicado). Registrar isso como ausência de dado faria o app aprender o oposto do que a pessoa disse.

**Regra de peso** — a mesma já validada na música:

- `manual` pesa **3**, `auto` pesa **1**
- decaimento exponencial com **meia-vida de 30 dias**: `peso = base * 0.5 ** (idadeDias / 30)`
- `manual` **nunca é rebaixado** para `auto` na mesma entrada (o comentário em `useTasteStore.ts:119` explica: trocar e depois salvar é o caminho normal, e rebaixar apagaria o sinal forte)

---

## `HistoricoGostoVisual` (estado de `useLookTasteStore`)

```ts
{
  escolhas: EscolhaVisual[]   // teto de 200, mais recentes primeiro
}
```

- Persistido em AsyncStorage sob a chave **`synesthesia-gosto-visual`** — separada de `synesthesia-gosto` (musical) de propósito (D3): regimes de privacidade e migrações independentes.
- **Nunca sai do aparelho** (FR-014). É consumido só por `lookDeAfinidade()`, localmente.
- `limpar()` devolve o app ao comportamento de aparelho novo (FR-016) sem tocar em nenhuma mídia salva.

**Limiar de afinidade** (FR-015): o slot só é rotulado `afinidade` quando, para aquela vibe, o peso acumulado do look vencedor for **≥ 2.0** e houver **≥ 2 escolhas** registradas naquela vibe. Uma escolha manual isolada dá peso 3.0 mas não passa no segundo critério — e "uma escolha não é gosto estabelecido" é exatamente o que o edge case pede. Duas escolhas passivas dão 2.0 e passam.

---

## `Media` — extensão aditiva

```diff
  interface Media {
    id: string
    photoUri: string
    filtroId: FilterId | null
    vibeId: VibeId
    musica: MusicSuggestion | null
    trechoInicio: number
    trechoFim: number
    aspecto?: number
    sugestoes?: MusicSuggestion[]
+   looks?: LookRecipe[]        // as três sugestões daquela foto
+   lookEscolhido?: LookRecipe  // qual delas foi ao ar
    criadaEm: number
    atualizadaEm: number
  }
```

**Migração**: nenhuma. Os dois campos são opcionais e o `persist` do zustand não precisa de `version`/`migrate` para adição de campo opcional. Uma mídia gravada antes desta feature abre com `looks === undefined`, e quem lê reconstrói três looks base a partir de `filtroId` e `vibeId` (FR-023, SC-009).

**Por que persistir as sugestões e não só a escolha**: o mesmo motivo já registrado em `Media.sugestoes` — sem isso, reabrir uma mídia dispara curadoria nova para um pacote que já estava fechado, cobrando rede, tempo e uma vibe recalculada por cima da que estava salva.

---

## `CaptureSession` — extensão

```diff
  interface CaptureSession {
    ...
    filtroId: FilterId | null
    filtroAuto: boolean
+   looks: LookRecipe[]              // [] enquanto a curadoria não voltou
+   lookEscolhido: LookRecipe | null
+   lookAuto: boolean                // true = ninguém tocou; vira aceite passivo
    ...
  }
```

`lookAuto` é o que distingue escolha explícita de aceite passivo no momento de salvar (FR-011). Nasce `true` e qualquer toque em chip de look ou miniatura de filtro o derruba — mesma mecânica de `filtroAuto`, que já existe.

---

## Fluxo de dados

```
foto capturada
   │
   ├─► analyzePhotoAndSuggest()  ── uma única chamada ao Gemini (D1)
   │        │
   │        ├─ vibe + músicas          (já existia)
   │        └─ 2 receitas de look      (novo)
   │                 │
   │                 ▼
   │        montarLooks(cena, vibeId)
   │           ├─ clamp        (FR-026)
   │           ├─ lookDeAfinidade(vibeId) ◄── useLookTasteStore  [LOCAL, nunca no prompt]
   │           ├─ dedupe       (D4)
   │           └─ completa com looks base da vibe até fechar 3
   │                 │
   ▼                 ▼
CaptureSession.looks ─► LookChips ─► escolha ─► lookEscolhido
                                          │
                            salvar/postar │
                                          ├─► Media.looks + Media.lookEscolhido
                                          └─► useLookTasteStore.registrarEscolha()
```

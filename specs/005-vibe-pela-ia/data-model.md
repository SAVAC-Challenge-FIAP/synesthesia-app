# Data Model: Vibe definida pela IA

**Fase 1** · 2026-08-22 · Deriva de [research.md](./research.md) e das decisões D1/D3 do [plan.md](./plan.md).

Regra que governa este documento: **nada persistido é removido ou mudado de
tipo.** Toda mudança é aditiva ou de leitura. É o que faz FR-035 sair de graça.

---

## 1. `Vibe` — dois conceitos onde havia um

Antes, `VibeId` era ao mesmo tempo o rótulo exibido, a chave dos sistemas locais
e a âncora da busca. A feature separa os papéis.

### `VibeId` (`src/types.ts`) — **inalterado**

Continua sendo a união fechada de oito ids. Passa a ser exclusivamente o **piso
local**: valor garantido, determinístico, disponível sem rede.

Consumidores que permanecem: `detectVibe()` (visor), `looksBase()`,
`FALLBACK` de música, `vibeById()` para mídias antigas.

### `VibeLivre` — **novo, apenas em memória e em `Media`**

```ts
/** Leitura da cena feita pelo Gemini: até 2 palavras, pt-BR. */
type VibeLivre = string;
```

Não é um tipo nominal novo com validação em runtime — é `string` com regras de
saneamento aplicadas no ponto de entrada (ver [contracts/gemini-cena.md](./contracts/gemini-cena.md)).

**Regras de validação** (impostas no cliente, não confiadas ao prompt):

| Regra | Comportamento na violação |
|---|---|
| Máximo 2 palavras | Corta nas 2 primeiras |
| Máximo 24 caracteres | Corta; se cortar no meio da 2ª palavra, fica só a 1ª |
| Não vazia após trim | Vira `undefined` — o campo some, e a UI cai no piso |
| Sem aspas/JSON residual | Removidas |

---

## 2. `Media` (persistida, `useGalleryStore`)

```diff
  export interface Media {
    id: string;
    photoUri: string;
    filtroId: FilterId | null;
    vibeId: VibeId;
+   /**
+    * Leitura livre da cena pelo Gemini (feature 005), até 2 palavras.
+    *
+    * Opcional pelo mesmo motivo de `aspecto`, `sugestoes`, `looks` e
+    * `audioUri`: mídias gravadas antes desta feature não têm o campo, e
+    * ausência significa "não sei", nunca "não há" — quem exibe cai para
+    * `vibeById(vibeId).nome` (FR-035).
+    *
+    * `vibeId` continua obrigatório e continua sendo a âncora: é ele que
+    * `looksDeMidiaAntiga()` e o catálogo offline consultam.
+    */
+   vibe?: string;
    musica: MusicSuggestion | null;
    // … demais campos inalterados
  }
```

**Estados possíveis de um registro**:

| `vibeId` | `vibe` | Origem | O que a galeria exibe |
|---|---|---|---|
| presente | presente | Captura com Gemini respondendo | `VIBE PRAIANA` |
| presente | ausente | Mídia anterior à 005, ou captura degradada | `🌅 DOURADA` (com emoji) |
| presente | `undefined` após saneamento | Gemini devolveu lixo | idem acima |

Não existe registro sem `vibeId`. Nunca existiu, e a feature não cria o caso.

---

## 3. `CaptureSession` (memória, `useCaptureStore`)

```diff
  export interface CaptureSession {
    mediaId: string | null;
    photoUri: string;
    filtroId: FilterId | null;
    filtroAuto: boolean;
    vibeId: VibeId;
+   /**
+    * Vibe livre da cena. `undefined` tem dois significados distintos, e a
+    * interface precisa dos dois:
+    *   • `curadoria === 'carregando'` → ainda não chegou → **esqueleto** (FR-031)
+    *   • curadoria terminada          → não vai chegar   → nome do `vibeId` (FR-036)
+    * Nunca um valor provisório enquanto se espera.
+    */
+   vibe?: string;
    aspecto: number;
    // … demais campos inalterados
  }
```

**Transições**:

```
captura            → { vibeId: prévia local, vibe: undefined, curadoria: 'carregando' }
Gemini respondeu   → { vibe: <saneada>,      curadoria: 'pronta' | 'indisponivel' }
Gemini falhou      → { vibe: undefined,      curadoria: 'indisponivel' }
mídia reaberta     → { vibe: media.vibe,     curadoria: 'pronta' }   // não recura
```

A última linha importa: reabrir da galeria **não** dispara nova curadoria — é a
mesma proteção que o T083 criou para `sugestoes`, e vale igual para a vibe.

---

## 4. `PhotoAnalysis` (retorno de `analyzePhotoAndSuggest`)

```diff
  export interface PhotoAnalysis {
    /** Piso local: vibe do catálogo, quando o Gemini devolveu uma reconhecível. */
    vibeId: VibeId | null;
+   /** Leitura livre da cena; ausente quando não houve leitura utilizável. */
+   vibe?: string;
    sugestoes: MusicSuggestion[];
    looks: LookRecipe[];
  }
```

`vibeId` **continua no retorno** e continua podendo ser `null`. Ele não é mais
pedido ao modelo — passa a ser derivado no cliente, por casamento aproximado
entre a vibe livre/cena e as `descricao` das oito vibes, com `null` quando
nenhuma casa. Serve para dois consumidores que precisam de chave fixa:
`montarLooks(…, vibeId)` e o piso de filtro automático.

---

## 5. `useTasteStore` — de índice para lista

```diff
  interface TasteState {
    escolhas: EscolhaMusical[];
-   sugeridasPorVibe: Record<string, FaixaSugerida[]>;
+   /** Lista única, sem agrupamento — a vibe deixou de ser chave (D3). */
+   sugeridas: FaixaSugerida[];

-   registrarSugeridas: (vibeId: VibeId, sugestoes: MusicSuggestion[]) => void;
+   registrarSugeridas: (sugestoes: MusicSuggestion[]) => void;

-   faixasSugeridasRecentes: (vibeId: VibeId, n?: number) => string[];
-   faixasSugeridasGlobais: (n?: number) => string[];
+   /** Lista de bloqueio: o que o modelo já propôs, das mais recentes. */
+   faixasSugeridasRecentes: (n?: number) => string[];

+   /**
+    * As N últimas escolhas reais, para o prompt (FR-033). Não confundir com
+    * `artistasFrequentes`/`generosFrequentes`, que agregam por peso: aqui é
+    * lista bruta, ordenada por recência, como a spec pede.
+    */
+   ultimasEscolhas: (n?: number) => GostoMusical[];
  }

+ export interface GostoMusical {
+   titulo: string;
+   artista: string;
+   genero?: string;
+ }
```

`EscolhaMusical.vibeId` **permanece no tipo e no disco**, marcado como legado —
gravado por compatibilidade, ignorado na leitura (R4). `registrarEscolha`
continua recebendo a vibe do momento; passar a receber `VibeId | undefined`
evita cascata de mudança nos chamadores.

`TETO_SUGERIDAS_POR_VIBE` vira `TETO_SUGERIDAS = 40`, agora global. Mantido o
valor: 40 continua sendo o dobro dos 20 que entram no prompt.

**Migração**: `sugeridasPorVibe` no disco é lido uma vez e achatado em
`sugeridas` por `migrate` do `persist` (versão 1). É lista de bloqueio, não
histórico de gosto — perdê-la parcialmente não teria consequência, mas achatar
é trivial e evita a lista voltar vazia na primeira captura pós-atualização.

---

## 6. `useLookTasteStore` — mesma troca, mais uma reversão

```diff
  interface LookTasteState {
    escolhas: EscolhaVisual[];

    registrarEscolha: (look: LookRecipe | null, vibeId: VibeId | undefined, origem: 'auto' | 'manual') => void;

-   preferidoDaVibe: (vibeId: VibeId) => PreferenciaVisual | null;
+   /** O tratamento mais forte do histórico inteiro, ou null sem sinal suficiente. */
+   preferido: () => PreferenciaVisual | null;

+   /** Os N últimos tratamentos escolhidos, para o prompt (FR-033). */
+   ultimosTratamentos: (n?: number) => GostoVisual[];
  }

+ export interface GostoVisual {
+   base: FilterId | null;
+   ajustes: AjustesLook;
+   nome: string;
+ }
```

`LIMIAR_PESO` e `LIMIAR_ESCOLHAS` permanecem com os mesmos valores, agora
avaliados sobre `escolhas` inteiro em vez do recorte por vibe (R4).

**Reversão de privacidade a registrar no arquivo (D5)**: o cabeçalho do módulo
afirma hoje *"⚠️ LGPD — este dado não sai do aparelho (FR-014)"*. FR-033 desta
spec reverte isso por decisão do Sávio. O comentário tem que ser reescrito no
mesmo commit que passa a enviar a lista — código que documenta uma garantia que
ele não cumpre mais é pior que código sem comentário.

`lookDeAfinidade(vibeId)` em `looks.ts` passa a `lookDeAfinidade()`.

---

## 7. `SettingsState` — permissão nova sob toggle

```diff
  interface SettingsState {
    filtroAutomatico: boolean;
    deteccaoTempoReal: boolean;
    gradeComposicao: boolean;
    sugestaoAutomatica: boolean;
+   /**
+    * Autoriza enviar cidade/região ao Gemini junto da foto (FR-034).
+    * **Desligado por padrão** — Princípio IV exige opt-in persistido e
+    * revogável, e este é dado de outra natureza que a foto (D5).
+    */
+   usarLocalizacao: boolean;
    fonteAudio: 'deezer';
    metadadosAnonimos: boolean;
  }
```

Default `false`. `persist` do zustand preenche o campo ausente com o default em
instalações existentes — sem migração necessária.

---

## 8. `ContextoCena` — novo, efêmero

Produzido por `src/services/contexto.ts`, consumido só pelo prompt. **Não é
persistido em lugar nenhum** — nem na sessão, nem na mídia.

```ts
export interface ContextoCena {
  /** Período legível: "início da noite (19h)". Sempre presente (D6). */
  hora: string;
  /** "Santos, SP" — texto, nunca coordenada. Ausente sem permissão/opt-in/tempo. */
  lugar?: string;
}
```

Não guardar o lugar é decisão, não esquecimento: a spec não pede histórico de
localização, e um dado que não é gravado não precisa de política de retenção,
de tela de exclusão, nem de resposta a pedido de titular.

---

## Matriz de rastreabilidade

| Requisito | Onde vive |
|---|---|
| FR-030 | `Media.vibe`, `CaptureSession.vibe`, `PhotoAnalysis.vibe` + saneamento |
| FR-031 | `CaptureSession.vibe === undefined` + `curadoria === 'carregando'` |
| FR-032 | Ausência de `musicaKeywords` no prompt com foto (§1, D2) |
| FR-033 | `ultimasEscolhas()`, `ultimosTratamentos()` |
| FR-034 | `ContextoCena`, `SettingsState.usarLocalizacao` |
| FR-035 | `Media.vibe` opcional + queda para `vibeById(vibeId)` |
| FR-036 | `VibeId` preservado em todos os pisos locais (§1) |

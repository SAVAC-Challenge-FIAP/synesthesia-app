# Contrato: leitura de cena pelo Gemini

**Fase 1** · 2026-08-22 · Interface externa desta feature.

O app tem uma única superfície externa relevante aqui: a chamada multimodal a
`generativelanguage.googleapis.com/v1beta/interactions`, feita por
`callGemini()` em `src/services/music.ts`. Este documento fixa o que muda nela.

**Transporte, modelo, tetos e degradação: inalterados.** `GEMINI_MODEL`,
`LIMITE_GEMINI_MS = 22_000`, `LIMITE_DEEZER_MS = 8_000` e a cadeia
`gemini-foto → pipeline-por-vibe → catálogo local` permanecem exatamente como
estão. Zero chamada nova.

---

## 1. O que sai do prompt

```diff
- 1) classifique a atmosfera da cena em EXATAMENTE UMA destas vibes:
-    "energetica" (Cena vibrante e cheia de movimento), "sonhadora" (…), …
```

É a linha que produziu o defeito (R1): oito saídas possíveis, escolhidas antes
de a busca começar, com `musicaKeywords` colada em cada uma.

---

## 2. O que entra no prompt

### 2.1 Vibe como leitura, não como escolha

```
1) escreva a VIBE da cena: no máximo DUAS palavras, em pt-BR, nomeando um
   SENTIMENTO ou um LUGAR que a imagem transmite ("Noite Cibernética",
   "Praiana", "Domingo Lento"). Não use categorias genéricas de app
   ("energética", "romântica"), nem o nome de um filtro, nem adjetivos
   soltos como "bonita" ou "legal".
```

A proibição explícita das categorias genéricas é necessária: os oito nomes
antigos são exatamente o que um modelo produz sozinho quando lhe pedem "a vibe"
de uma foto, e a feature inteira existe para sair deles.

### 2.2 Contexto de hora e lugar

Inseridos antes das instruções, uma linha cada, omitindo a que não existir:

```
Contexto: a foto foi tirada no {hora}.
Contexto: quem fotografou está em {lugar}.
```

- `{hora}` — período legível, sempre presente (D6). Ex.: `início da noite (19h)`.
- `{lugar}` — cidade/região em texto (D5). Ex.: `Santos, SP`. **Nunca coordenada.** Só existe com `usarLocalizacao` ligado, permissão concedida e resolução dentro do teto.

### 2.3 Gosto como lista de escolhas (FR-033)

Substitui `preferenciasAprendidas()`, que hoje manda agregados
("gosta de rock, metal"). Passa a mandar as listas brutas, no máximo 20 de cada:

```
Esta pessoa já escolheu estas músicas (mais recentes primeiro):
  «Monster — Skillet» (rock); «Awake and Alive — Skillet» (rock); …
E estes tratamentos visuais:
  «Sombra Profunda» (base eclipse, contraste +0.2, véu +0.1); …
Leve o gosto em conta sem repetir as mesmas faixas.
```

Listas ausentes (aparelho novo) simplesmente não aparecem no prompt — nenhuma
frase vazia, nenhuma quebra (US3, cenário 2).

**Custo de tokens**: ~20 faixas curtas + ~20 tratamentos compactos ficam na
ordem de algumas centenas de tokens. O pedido do Sávio — "para o prompt não
gastar muito" — é o que fixa o teto em 20 e o formato em uma linha por item.

---

## 3. Schema de resposta

**Inalterado na forma**; muda o significado de um campo.

```jsonc
{
  "vibe": "Noite Cibernética",     // ← era id do catálogo; agora texto livre
  "cena": "papel de parede de samurai neon",
  "musicas": [ { "titulo": "…", "artista": "…", "papel": "certeira|curinga|descoberta",
                 "genero": "…", "justificativa": "até 12 palavras, pt-BR, ligada à cena" } ],
  "looks":   [ { "base": "<preset>", "nome": "até 2 palavras", "papel": "certeira|ousada",
                 "justificativa": "…", "ajustes": { "brilho": 0, "saturacao": 0,
                 "contraste": 0, "sepia": 0, "veu": 0 } } ]
}
```

`musicas` e `looks` seguem idênticos, e com eles todo o pipeline já validado:
`receitaDeIdeia()`, `montarLooks()`, `resolveWithDeezer()`, `montarConjunto()`,
`verificarDescobertas()`, `rotularAfinidade()`. A superfície de mudança é um
campo.

---

## 4. Saneamento no cliente

> *"Instrução em prompt é pedido, não garantia"* — `src/services/looks.ts`.

Toda regra do §2.1 é reimposta na leitura, na ordem:

| # | Passo | Resultado |
|---|---|---|
| 1 | `trim()` + remover aspas e cercas de código residuais | texto cru |
| 2 | Colapsar espaço interno | `"Noite   Cibernética"` → `"Noite Cibernética"` |
| 3 | Cortar nas **2 primeiras palavras** | `"Noite Cibernética Profunda"` → `"Noite Cibernética"` |
| 4 | Teto de **24 caracteres**; se cortar no meio da 2ª palavra, fica só a 1ª | nunca uma palavra partida |
| 5 | Vazio ou só pontuação → `undefined` | UI cai no piso (FR-036) |

Nenhum passo rejeita a resposta inteira: uma vibe malformada não pode custar as
músicas e os looks, que vêm na mesma chamada e estão certos.

---

## 5. Derivação do `VibeId` de piso

`PhotoAnalysis.vibeId` continua existindo (data-model §4), mas deixa de vir do
modelo. É derivado no cliente:

1. Casamento por palavra entre `vibe` + `cena` e os campos `nome`/`descricao` das oito vibes.
2. Sem casamento → `null`.

`null` é resultado legítimo, não erro: `montarLooks(…, fallbackVibe.id)` já
sabe lidar com a ausência, e é assim que o piso continua sendo o piso — um
palpite ruim de `VibeId` seria pior que nenhum, porque voltaria a empurrar a
tabela `vibe → filtro` sobre uma cena que ela não descreve.

---

## 6. Compatibilidade

| Caso | Comportamento |
|---|---|
| Sem `EXPO_PUBLIC_GEMINI_API_KEY` | `callGemini` devolve `''`; caminho degradado; `vibe` ausente; UI mostra nome do `vibeId` |
| Timeout (22s) | `AbortError` → `pularGemini` no fallback, como hoje; `vibe` ausente |
| JSON inválido | `match` falha → `null` → degradado, como hoje |
| `vibe` presente, `musicas` vazio | Faixas caem no pipeline por vibe; **`vibe` é preservada** — a cena foi lida, quem não resolveu foi o Deezer |
| `deteccaoTempoReal` desligado | Não há foto no prompt, logo não há vibe livre; UI mostra o piso desde o início, sem esqueleto preso |

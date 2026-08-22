# Contrato — trecho de look na resposta multimodal do Gemini

**Feature**: 003-looks-sugeridos · **Consumidor**: `src/services/music.ts` → `src/services/looks.ts`

Este contrato descreve **apenas o trecho novo**. O restante da resposta (`vibe`, `cena`, `musicas`) segue exatamente como já está em produção e não é alterado por esta feature.

---

## Onde ele viaja

Na **mesma** chamada de `askGeminiWithPhoto()`. Não há endpoint novo, chamada nova nem orçamento de latência novo (D1, FR-018).

O motivo é medido, não estético: o próprio repositório registra que essa chamada variou de **2,9s a 123s** com a mesma foto e a mesma rede (`src/services/music.ts`). Uma segunda chamada dobraria a exposição a essa cauda. O teto de `LIMITE_GEMINI_MS = 22_000` permanece intocado e continua valendo para o pacote inteiro.

---

## Pedido

Acrescido ao prompt existente, sem remover nada dele:

```
3) proponha 2 tratamentos visuais (looks) para esta foto.
Cada look PARTE de um destes presets e informa apenas o DESVIO em relação a ele:
vivid, neon, love, eclipse, retro, vintage, arctic, honey.
Papéis, nesta ordem: 1x "certeira" (realça o que a cena já tem),
1x "ousada" (interpretação mais forte, ainda plausível).
Ajustes são deltas pequenos, no intervalo -0.5 a 0.5, e todos são opcionais.
```

E o formato de resposta, fixado no mesmo bloco `Responda SOMENTE JSON` que já existe:

```
"looks":[{"base":"<preset>","nome":"até 2 palavras","papel":"certeira|ousada",
"justificativa":"até 10 palavras, em pt-BR, ligada à cena",
"ajustes":{"brilho":0,"saturacao":0,"contraste":0,"sepia":0,"veu":0}}]
```

---

## Resposta — schema

```ts
interface GeminiLookIdea {
  base?: string          // esperado: um dos 8 FilterId
  nome?: string
  papel?: string         // esperado: "certeira" | "ousada"
  justificativa?: string
  ajustes?: {
    brilho?: number
    saturacao?: number
    contraste?: number
    sepia?: number
    veu?: number
  }
}
```

**Tudo é opcional no tipo, de propósito.** O tipo descreve o que *chega*, não o que *deveria* chegar — e o que chega de um modelo é texto que às vezes não obedece. A obrigatoriedade real é imposta na validação abaixo, não no tipo.

### Exemplo íntegro

```json
"looks": [
  {
    "base": "honey",
    "nome": "Fim de tarde",
    "papel": "certeira",
    "justificativa": "puxa o dourado do sol baixo",
    "ajustes": { "brilho": 0.04, "saturacao": 0.15, "veu": 0.03 }
  },
  {
    "base": "eclipse",
    "nome": "Contraluz",
    "papel": "ousada",
    "justificativa": "fecha as sombras e destaca a silhueta",
    "ajustes": { "contraste": 0.18, "saturacao": -0.2 }
  }
]
```

---

## Validação e degradação por campo

Regra geral: **nunca rejeitar a resposta inteira por causa de um campo**. Um look ruim é descartado; um campo ruim é corrigido.

| Campo | Inválido quando | Tratamento |
|---|---|---|
| `base` | ausente, não-string, ou fora dos 8 ids | **descarta este look** — sem âncora não há receita (FR-008) |
| `ajustes` | ausente, não-objeto | vira `{}`; o look é o preset puro, e isso é um resultado válido |
| `ajustes.*` | não numérico, `NaN`, `Infinity` | tratado como `0` |
| `ajustes.*` | fora da faixa de delta (R2) | clampado, não descartado |
| `nome` | ausente ou vazio | usa o nome do preset base (`filterById(base).nome`) |
| `justificativa` | ausente | `''` — o chip apenas não mostra a linha |
| `papel` | fora de `certeira`/`ousada` | cai para a posição pedida, como `papelDe()` já faz para faixas |
| `papel` | vem como `afinidade` | **rejeitado**, vira `certeira` — ver abaixo |
| `looks` | ausente, não-array, ou 0 utilizáveis | `montarLooks()` preenche tudo com looks base da vibe |

### `afinidade` é proibido neste contrato

O modelo nunca recebe `afinidade` na lista de papéis permitidos, e se devolver mesmo assim o valor é rejeitado.

Não é preciosismo: `afinidade` significa "isto casa com o histórico **deste aparelho**", e o modelo não viu o histórico — ele é montado localmente e nunca entra no prompt (FR-013, FR-014, D3). Um `afinidade` vindo do modelo seria um rótulo mentindo sobre a própria origem, que é exatamente o que FR-015 proíbe.

---

## Pós-condições garantidas ao consumidor

Quem chama `montarLooks()` recebe, **sempre**:

1. Exatamente **3** `LookRecipe` (FR-001, SC-004) — inclusive sem chave, sem rede e sem histórico
2. Todo `base` é um `FilterId` válido
3. Todo ajuste dentro das faixas de R2, nas duas barreiras
4. No máximo **um** com `papel: 'afinidade'`
5. Nenhum par abaixo do limiar de redundância (D4)

O consumidor não precisa validar nada. Se ele precisasse, a validação estaria no lugar errado.

---

## O que este contrato **não** cobre

- **O visor ao vivo.** Ele continua nos 8 presets locais e não consulta rede nenhuma (FR-021, Princípio III). Nada aqui o alcança.
- **A escolha da pessoa.** O modelo propõe; quem decide é quem fotografa, e a decisão volta para o histórico local, não para o modelo.

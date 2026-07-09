# Escolha do modelo de IA para a curadoria musical

Registro da decisão de qual LLM usar na curadoria musical do Synesthesia (feature-chave do produto). Data: 2026-07-09.

## O que a tarefa exige

A curadoria musical é uma tarefa de IA **leve**: recebe a "vibe" da foto (texto curto) e devolve 4 músicas em JSON (título, artista, justificativa em pt-BR).

| Dimensão | Nosso caso |
|---|---|
| Entrada | ~100 tokens |
| Saída | ~200 tokens |
| Complexidade | Baixa (não precisa reasoning profundo, código ou multimodal) |
| Latência | Importa (usuário espera após capturar) |
| Idioma | pt-BR |
| **Restrição #1** | **Grátis** (projeto de faculdade — JOVI Challenge FIAP) |
| Volume | Baixíssimo (1 chamada por captura) |

Conclusão: precisamos do modelo **mais barato, rápido e com free tier** que escreva bem em pt-BR. Modelo caro de reasoning seria desperdício.

## Modelos do Google (mais forte → mais fraco)

| Modelo | Força | Velocidade | Custo (in/out 1M tok) | Free tier | Adequado? |
|---|---|---|---|---|---|
| gemini-3.1-pro-preview | Máxima | Lenta | Só pago | ❌ Não | ❌ Overkill + pago |
| gemini-3.5-flash | Alta | Rápida | $1.50 / $9.00 | ⚠️ Cota limitada (deu 429 na nossa conta) | ⚠️ Bloqueado |
| **gemini-3.1-flash-lite** | Média | ⚡ A mais rápida | $0.25 / $1.50 | ✅ **Funciona** | ✅ **ESCOLHIDO** |
| gemma-4-31b / 26b | Baixa-Média | Rápida | Aberto | Varia | ⚠️ Exige self-host |

**Teste real (2026-07-09):** `gemini-3.5-flash` e `gemini-3.1-pro-preview` retornaram **429 "not enough quota"** na conta gratuita do Sávio; `gemini-3.1-flash-lite` respondeu em **~1.4s** com 4 músicas coerentes. Contas gratuitas novas do AI Studio só liberam cota para o modelo *lite*.

## Outros provedores (mercado)

| Provedor / Modelo | Custo (in/out 1M) | Velocidade | Free tier | Nota |
|---|---|---|---|---|
| Groq (Llama 3.1 8B) | $0.05 / $0.08 | 🚀 500+ tok/s (o mais rápido) | ✅ ~14k req/dia | Só open source; formato OpenAI-compatible |
| DeepSeek V3.2 | $0.14 / $0.28 | Média | ✅ Trial 10M tokens | O mais barato |
| gemini-3.1-flash-lite | $0.25 / $1.50 | ⚡ Muito rápida | ✅ Sim | **Integrado** |
| Claude Haiku 4.5 | $1.00 / $5.00 | Rápida | ❌ Sem free real | Qualidade alta, pago |

OpenAI/GPT: sem free tier de API e mais caro — descartado para este projeto.

## Decisão

**`gemini-3.1-flash-lite`** — grátis na conta atual, rápido, bom pt-BR, já integrado e testado em `src/services/music.ts`.

**Plano B (se a cota do Google incomodar na demo):** Groq + Llama (free tier generoso, mais rápido do mercado). Trocar exige só reescrever `askGemini()` para o endpoint do Groq. Ver [[synesthesia-mvp-build]] no restante do contexto.

## Como está implementado

Em `src/services/music.ts`:
- Endpoint: `v1beta/interactions` (Interactions API atual — o antigo `v1beta/models/{model}:generateContent` está deprecado).
- Auth: header `x-goog-api-key`.
- Modelo: constante `GEMINI_MODEL = 'gemini-3.1-flash-lite'`.
- Resposta: extrai o step `model_output` do array `steps`.
- Degradação: se falhar → Deezer puro → catálogo local (nunca perde a foto).

Guia para obter a chave: [GEMINI-SETUP.md](./GEMINI-SETUP.md).

## Fontes (pesquisa 2026-07-09)

- Gemini API Pricing 2026 — MetaCTO, DevTk.AI, PricePerToken
- LLM API Pricing Comparison 2026 — CloudZero, TokenMix
- Groq Pricing 2026 — TokenMix; Free LLM APIs — OpenRouter

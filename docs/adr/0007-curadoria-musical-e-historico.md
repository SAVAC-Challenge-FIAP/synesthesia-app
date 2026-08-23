# ADR-0007 — Curadoria Musical e Histórico

**Status**: Aceita · **Data**: 2026-08-22

Registro da decisão sobre como curar músicas a partir da vibe da cena e uso do Gemini.

## Pipeline de Escolha (4 Etapas)
1. Primeiro Tentamos o modelo multimodal, combinando a foto + faixas possíveis se já houver um histórico de gosto, pedindo o array de ids.
2. Como fallback de recusa de media, caímos para texto, pedindo ao LLM que defina até duas palavras a Vibe.
3. Caso a conexão falhe, usamos o catálogo offline, com seleção determinística (`hash(vibeId)`).

## Histórico de Gosto e Prompt
Enviar sempre todo o gosto (Like/Dislike) ao Gemini deixava o contexto gigantesco. Limitamos o envio às **últimas 20 escolhas** dedupiladas do usuário, para focar nas preferências mais recentes. Afinidade entre faixas não entra no prompt para reduzir complexidade; delegamos ao Gemini retornar de volta o que ele entende, e aplicamos a semântica local.

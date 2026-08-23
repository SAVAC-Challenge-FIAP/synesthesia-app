# ADR-0011 — Privacidade e Histórico (LGPD)

**Status**: Aceita · **Data**: 2026-08-22

Registro da evolução de como lidamos com os dados de histórico de gosto musical e visual, equilibrando personalização com o respeito à privacidade.

## O Desafio (T057 / FR-014)
Inicialmente, todo o histórico (frequência de uso de filtros, músicas rejeitadas, bandas ouvidas) era isolado no aparelho (local-first) para blindar a privacidade. Porém, curadorias começaram a ficar repetitivas e irrelevantes, e recebemos a exigência (FR-033 / T074) de que o Gemini deveria aprender com as escolhas passadas do usuário para sugerir melhor (ex: "se eu escuto Skillet, sugira rock").

## Decisão: Envio Compacto e Recente (As 20 Últimas Escolhas)
Para solucionar o impasse, em vez de enviar todo o histórico com pesos (que identificariam um perfil absoluto) optou-se por enviar apenas **as 20 escolhas mais recentes** num formato achatado para compor o contexto do Prompt do Gemini.

- **Para a Música (`useTasteStore`)**: Gravamos o nome, gênero e banda que a pessoa *efetivamente escolheu*. Agregações pesadas (meia-vida de uso, taxa de rejeição) continuam processadas exclusivamente localmente para uso do app (ex: rotular uma faixa que voltou como "Afinidade").
- **Para o Visual (`useLookTasteStore`)**: Enviamos as últimas 20 receitas base + ajustes como contexto. Nenhuma data ou peso sai do aparelho.
- **Opt-in de Envio (`useSettingsStore`)**: Essa funcionalidade é ancorada ao opt-in de `deteccaoTempoReal` concedido no Onboarding. A localização viaja apenas como String de cidade (ex: "Santos, SP"). Se a pessoa desligar isso, o Prompt volta a operar sem contexto histórico na rede.

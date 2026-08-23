# ADR-0012 — Pipeline de Curadoria (Gemini e Deezer)

**Status**: Aceita · **Data**: 2026-08-22

Registro de toda a lógica arquitetural da Curadoria de Mídias.

## 1. A Vibe como Saída e Não Entrada (Feature 005)
A Vibe agora é lida diretamente da foto enviada ao Gemini Multimodal como texto livre (Até duas palavras, FR-030). A lista local estática de 8 Vibes atua agora exclusivamente como um *Fallback* / Piso Local quando a internet falha ou a requisição estoura o tempo (FR-021). 

## 2. Abort Controller e Teto de Latência
Com medições apontando que a API do Gemini pode pendurar por até 123s, instalamos um teto absoluto na promessa de **30s** para retornar a curadoria. O `AbortController` destrói conexões lentas para não bloquear o fluxo (T020).

## 3. Composição de Sugestões e Filtro de Fãs (T059, T073)
A curadoria musical resolve as faixas na Deezer API pública. A composição fechada requer:
- **2 Faixas Certeiras**, **1 Curinga**, **1 Descoberta**.

Para ser "Descoberta", impomos a regra empírica de que a faixa não pode ter mais de **250.000 `nb_fan`** no Deezer. 
Além disso, pedimos sempre 5+ candidatas ao invés das 4 nominais para poder ignorar silenciosamente músicas que chegam "mudas" (sem `previewUrl`). Faixas sem prévias são descartadas imediatamente no client. Se uma faixa de "descoberta" for reprovada no crivo de fãs, ela não é jogada fora, mas seu rótulo sofre downgrade para "curinga", protegendo a confiança da UI.

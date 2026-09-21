# ADR-0012 — Pipeline de Curadoria (Gemini e Deezer)

**Status**: Aceita · **Data**: 2026-08-22

Registro de toda a lógica arquitetural da Curadoria de Mídias.

## 1. A Vibe como Saída e Não Entrada (Feature 005)
A Vibe agora é lida diretamente da foto enviada ao Gemini Multimodal como texto livre (Até duas palavras, FR-030). A lista local estática de 8 Vibes atua agora exclusivamente como um *Fallback* / Piso Local quando a internet falha ou a requisição estoura o tempo (FR-021). 

## 2. Abort Controller e Teto de Latência
Com medições apontando que a API do Gemini pode pendurar por até 123s, instalamos um teto absoluto na promessa de **30s** para retornar a curadoria. O `AbortController` destrói conexões lentas para não bloquear o fluxo (T020).

## 2.1 Falha da IA é dita, não disfarçada (Feature 007, 2026-09-21)

O teto do Gemini subiu de **22s para 30s**: medido no device em 2026-09-21, a própria API levou
19,9s para responder um prompt de 6 tokens (HTTP 200, ping de 6ms). Com imagem, isso estourava os
22s e degradava por margem, não por falha real.

Mais importante: quando a IA não entrega, o app **para de escolher faixa sozinho**. Antes ele caía
em silêncio para a busca por palavras-chave da vibe local e impunha a primeira faixa — uma foto de
teclado mecânico virou "Eu Sou Brasileiro (Funk da Copa)". Isso é pior que não ter trilha: parece
que a IA leu a cena e concluiu aquilo.

Agora a análise carrega o sinal `degradada`. Com ele verdadeiro:

- nenhuma música é aplicada automaticamente e nenhum look sugerido é aplicado (os 8 presets locais
  seguem no carrossel — falta o look *sugerido*, não o filtro);
- a tela diz o que houve e oferece **TENTAR DE NOVO**, que descarta a análise em cache daquela foto
  (`esquecerAnalise`) — sem isso a retentativa devolveria o mesmo resultado degradado;
- as faixas que o Deezer devolveu continuam acessíveis em "ESCOLHER MÚSICA": deixam de ser
  impostas, não de existir;
- Salvar (baixa a imagem) e Postar agora (vídeo só com a foto) continuam abertos, ditos na tela.

## 3. Composição de Sugestões e Filtro de Fãs (T059, T073)
A curadoria musical resolve as faixas na Deezer API pública. A composição fechada requer:
- **2 Faixas Certeiras**, **1 Curinga**, **1 Descoberta**.

Para ser "Descoberta", impomos a regra empírica de que a faixa não pode ter mais de **250.000 `nb_fan`** no Deezer. 
Além disso, pedimos sempre 5+ candidatas ao invés das 4 nominais para poder ignorar silenciosamente músicas que chegam "mudas" (sem `previewUrl`). Faixas sem prévias são descartadas imediatamente no client. Se uma faixa de "descoberta" for reprovada no crivo de fãs, ela não é jogada fora, mas seu rótulo sofre downgrade para "curinga", protegendo a confiança da UI.

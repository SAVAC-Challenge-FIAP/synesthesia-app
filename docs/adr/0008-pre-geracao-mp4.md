# ADR-0008 — Pré-geração e Exportação

**Status**: Aceita · **Data**: 2026-08-22

Registro da decisão de antecipação do render e muxing.

## Muxing Assíncrono Contínuo
O componente do muxer nativo só permite rodar UMA exportação ao mesmo tempo, senão o pool do codec trava.
Ao invés de esperar o usuário clicar em "Compartilhar" e então fazê-lo aguardar o longo processo de mesclar a foto (via Skia) com o .mp3, a exportação acontece em **background** assim que o "Pacote" (Foto + Vibe + Música + Look) estabiliza no modal (debounce de 3s). 
Se o usuário muda de filtro, o `AbortController` cancela a exportação atual e inicia a próxima, de modo que na maioria das vezes, o arquivo de vídeo (.mp4) já estará pronto no momento do compartilhamento.

## Progresso Monotônico
Durante o processo, se o SDK não relatar o tempo nativo corretamente, a barra de progresso avança com estimativas proporcionais lineares e omite os eventos ao invés de inventar números não-contíguos que causam glitches visuais.

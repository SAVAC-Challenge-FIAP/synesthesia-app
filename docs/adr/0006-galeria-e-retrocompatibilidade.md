# ADR-0006 — Galeria e Retrocompatibilidade

**Status**: Aceita · **Data**: 2026-08-22

Registro do comportamento da Galeria ao carregar fotos antigas após a implementação de atributos dinâmicos.

## Tratamento de Dados Ausentes
O visor oferece enquadramentos variáveis e os metadados (como `aspecto`, `sugestoes`, `looks`, `audioUri` local e a `vibeId`) foram estendidos. Como o aplicativo precisa preservar o histórico das fotos tiradas antes dessas atualizações:
1. Campos antigos são lidos via `coalescence`: se `media.aspecto` não existir, assumimos 4:3 ou o valor gravado inicialmente.
2. A galeria mantém as fotos antigas visualmente iguais usando uma vitrine com quadrados (1:1), independente da proporção nativa da foto.
3. Não disparamos novas requisições na rede. Reabrir a mídia trazia `sugestoes: []` e chamava o Gemini de novo, cobrando e recalculando a vibe por cima. Com a implementação do Histórico Local, a foto mantém seu pacote intocado.

## Áudio Offline (T102)
A trilha sonora antes usava o link remoto da Deezer, que expira rapidamente, causando carregamento infinito ao tentar tocar dias depois. Resolvemos copiando o arquivo `.mp3` da preview para a pasta local da mídia (`documentDirectory/galeria`). Assim, a música da foto tocará offline e anos depois.

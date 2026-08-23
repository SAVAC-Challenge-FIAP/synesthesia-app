# Pesquisas, Métricas e Limiares Base (Baseline)

Este documento centraliza as razões baseadas em dados (empíricos) para os magic numbers utilizados pelo app Synesthesia.

## Latência da Curadoria (Gemini)
No Task T020 medimos a resposta da API do Gemini multimodal com uma mesma foto na mesma rede. O tempo variou drasticamente entre **2,9s a 123s**. 
Sem um `AbortController` cortando a requisição, a UI aguardava indefinidamente.
Por conta disso, foi estipulado o **teto de latência da Curadoria em 30s** (`CaptureSheet` e `music.ts`), servindo como uma folga de 5x sobre a mediana aferida (6s). Após 30s a rede é destruída e o *fallback* local engata.

## Threshold de Fãs para Artistas "Descoberta" (Deezer)
O Task T059 instruiu medir quando um artista começa a figurar como mainstream.
A contagem de fãs (`nb_fan` na Deezer API) agrupa pessoas que favoritaram o artista.
Testamos inicialmente um limiar de 1.000.000 para considerar a faixa "descoberta". O resultado foi péssimo, M83 (964k) e Kavinsky (491k) passavam como "desconhecidos".
A redução do teto para **250.000** demonstrou separação empírica ideal na bolha ocidental:
- The xx (1.1M) e Beach House (294k) reprovados.
- Mr.Kitty (51k), JVKE (141k), HOME (1k) aprovados.

## Peso do Histórico e Decaimento
A meia-vida para degradação de gostos velhos foi arbitrada, testamos e validou-se que escolhas diretas da UI (`MusicSheet` manual search) precisam ter um peso muito maior que uma submissão de faixa escolhida no automático.

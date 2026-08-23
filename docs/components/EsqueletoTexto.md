# Documentação de `EsqueletoTexto.tsx`

Lugar reservado para conteúdo que ainda não chegou — shimmer dourado com
respiração.

Nasceu dentro de `TratamentoCarrossel` como o placeholder dos três looks
(T104) e foi extraído aqui na feature 005, quando a vibe passou a precisar do
mesmo vocabulário de espera (FR-031). Reescrever um retângulo novo produziria
**dois** vocabulários de espera na mesma tela — o do carrossel e o da vibe
logo acima dele, pulsando fora de sincronia.

Prefere-se ao spinner porque diz outra coisa: um spinner comunica
"processando, aguarde" — e aqui nada está bloqueado, a pessoa pode escolher
qualquer preset e salvar. O shimmer comunica "conteúdo a caminho neste
lugar", que é exatamente o caso, e é o vocabulário que as redes sociais já
ensinaram ao público deste app.

Escalonamento entre esqueletos vizinhos: é o que faz uma fileira parecer
viva em vez de várias caixas piscando em uníssono.

Shimmer: uma faixa clara atravessa o lugar reservado da esquerda para a
direita, em laço. `translateX` no driver nativo, então a animação roda fora
da thread de JS e continua fluida enquanto a curadoria a ocupa.

Respiração do dourado (T104): a opacidade sobe e desce devagar, fora de
fase com o reflexo. É o que dá o ar de "algo raro sendo lapidado" em vez de
"campo vazio" — o reflexo sozinho lê como placeholder comum e neutro.

Segundo reflexo, mais estreito e mais claro, correndo logo atrás do
primeiro: é o que separa "carregando" de "vem coisa boa aí". Um brilho só
lê como placeholder; dois, desencontrados, leem como algo sendo lapidado.


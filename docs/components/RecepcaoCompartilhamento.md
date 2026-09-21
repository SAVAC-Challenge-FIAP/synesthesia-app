# Documentação de `RecepcaoCompartilhamento.tsx`

Montado no layout raiz, fora do `<Stack>`: a foto pode chegar com o app em
qualquer tela — ou sem tela nenhuma, quando é o próprio compartilhamento que
abre o app.

**Três gatilhos, um caminho.** O intent pode aparecer de três jeitos, e cada um
cobre um buraco do outro:

1. `uriPendente()` no primeiro render — app aberto **pelo** compartilhamento; o
   intent já estava na activity antes de o JS existir.
2. Evento `onCompartilhamento` — app já aberto, intent entregue por
   `onNewIntent`.
3. `AppState` voltando a `active` — rede de segurança para o evento que chega
   enquanto o JS está suspenso.

Os três chamam o mesmo `receber`, e `uriPendente` é destrutivo do lado nativo,
então disparar em duplicata não reprocessa nada.

**Só navega com o router de pé.** `useRootNavigationState()?.key` é a única
garantia de que o `<Stack>` montou; um `push` antes disso é engolido em
silêncio, e a foto chegaria sem tela. É por isso que o gatilho (1) espera.

**`push`, não `replace`.** Quem abriu o app pelo compartilhamento precisa ficar
dentro do app ao descartar a captura — e é o `capture.tsx` que fecha essa
lacuna, caindo em `/camera` quando não há para onde voltar.

Se a pessoa já estava em `/capture`, não empilha outra: trocar a sessão do
store basta, porque a tela inteira é função dela.

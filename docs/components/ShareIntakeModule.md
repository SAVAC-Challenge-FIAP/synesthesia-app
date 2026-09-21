# Documentação de `ShareIntakeModule.ts`

Ponte com o módulo nativo que recebe a foto vinda do "Compartilhar" de outro
app. Android-only, como os outros dois módulos locais.

`uriPendente()` é **síncrono e destrutivo**: devolve a imagem do intent atual
da activity e, no mesmo movimento, apaga o `EXTRA_STREAM` dele. É o que
impede que uma remontagem da tela, ou o app voltando do background, reabra a
mesma foto por cima do que a pessoa estiver fazendo. Chamar duas vezes devolve
`null` na segunda — e isso é o comportamento desejado, não um defeito.

`prepararImagem()` copia a imagem para o cache do app **já em pé** e devolve as
dimensões reais dos pixels. O porquê dessas duas coisas está em
[`0014-entrada-por-compartilhamento.md`](../adr/0014-entrada-por-compartilhamento.md).

O evento `onCompartilhamento` cobre o caso do app já aberto, em que o intent
chega por `onNewIntent` e nunca passa pelo `uriPendente` do primeiro render.

# Documentação de `_layout.tsx`

Segura o splash até haver algo no lugar dele (T071/T094).

Quem assume agora é a `AberturaMarca`, que entra no **primeiro** render do
JS. Antes o splash só saía com as fontes carregadas, e no intervalo a tela
ficava no preto do `ink` — medido no aparelho: vários segundos de nada entre
a marca e o visor. Chamado no módulo, antes de qualquer render.

A abertura em JS (T094) cobre a troca entre o splash e o app. Ela nasce
visível e some sozinha; sem ela, o que aparecia no lugar da marca era o
corte seco para o visor.


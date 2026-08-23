# Documentação de `FundoBase.tsx`

Fundo base da identidade visual (T068) — nó [563:52](https:
`linear-gradient(180deg, rgba(141,21,20,0.5), rgba(39,6,6,0.25))` sobre `#090506`.

**Nunca tinha sido implementado.** O `CLAUDE.md` descreve este fundo desde o
começo e os tokens `rubyGradientTop`/`rubyGradientBottom` existem em
`tokens.ts` desde então — sem nenhum componente que os usasse. As telas
escuras eram `ink` chapado.

As duas paradas do gradiente têm alfa, então ele **depende** do `ink` por
baixo para dar a cor final: o `backgroundColor` do container não é detalhe,
é a primeira camada dos três.


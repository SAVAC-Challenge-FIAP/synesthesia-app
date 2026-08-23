# Documentação de `LoaderMarca.tsx`

Loader feito da própria marca (T070).

**Por que não é o loader "certo" do desenho.** A animação ideal — arco
externo girando e anéis internos pulsando em contratempo — precisaria de
`react-native-svg` **e** `react-native-reanimated`, que são duas dependências
nativas novas e mais um rebuild. A própria task chama de alternativa honesta
animar opacidade e escala sobre o PNG com a `Animated` que já vem no React
Native: some sofisticação, zero dependência.

O símbolo é uma íris, então respirar e girar devagar já lê como "processando"
sem prometer progresso que o sistema não sabe medir (contrato C-04).

Piso do pulso. 0,45 é o do loader dentro de um card, onde o contraste é
alto. Sobre o gradiente ruby da abertura, esse mesmo piso deixa o amber
marrom — quase invisível (visto no aparelho), e ali o piso sobe.


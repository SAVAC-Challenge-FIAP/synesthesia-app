# Documentação de `AberturaMarca.tsx`

Abertura do app (T080/T094) — a marca **em movimento**, e não mais um pisca.

O que o Sávio viu: *"aparece a logo e depois troca para logo, tipo em uma
piscada"*. Não era bug, eram duas marcas estáticas em sequência com escalas
diferentes: o Android 12+ mostra sozinho o ícone do app enquanto o processo
sobe, e logo atrás vinha o splash do `expo-splash-screen` com a mesma arte em
outro tamanho. Dois quase-iguais lidos em sequência = salto.

A correção tem duas metades. A outra é o `app.json`, onde o splash **perdeu a
imagem** e ficou só com o `backgroundColor`: casar as duas escalas seria
calibração fina e frágil, e a marca não precisa aparecer duas vezes. Agora o
app mostra a marca **uma vez só** — esta —, e ela se move.

O ícone que o sistema desenha antes de tudo é do Android, não nosso: não há
como desligar nem animar. Também não existe splash em GIF — essa fase é
imagem estática por definição da plataforma, e é por isso que a animação
começa aqui, no primeiro frame de JS.

É o mesmo `LoaderMarca` da espera do Gemini, que o Sávio aprovou — a mesma
ideia de movimento nos dois lugares em que o app pede tempo a quem usa.

/** Só sai quando o app tem o que mostrar no lugar (fontes carregadas). */

/** Com as fontes ainda carregando, o nome esperaria — e trocaria de fonte à vista. */


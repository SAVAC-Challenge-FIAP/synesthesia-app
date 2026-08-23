# Regras de código

## Proibido comentário em código-fonte

**Nenhum comentário em `.ts`/`.tsx`** — nem os que explicam uma invariante não-óbvia. Toda
explicação de decisão, contexto ou motivo vai para um `.md`: um ADR (`docs/adr/`) para decisão
arquitetural, o `ESTADO.md` da spec ativa para contexto de trabalho em andamento, ou este diretório
de regras para convenção de processo.

**Por quê**: comentário no código apodrece — fica falando de uma feature que já mudou, ou de um
motivo que só fazia sentido numa versão antiga (foi o caso do cabeçalho de
`useLookTasteStore.ts` e de `vibeEngine.ts`, corrigidos na feature 005 porque mentiam sobre o
comportamento atual). Documentação em `.md` é lida antes de mexer no código, então tem mais chance
de ser atualizada — e fica pesquisável num lugar só.

**Como aplicar**: se sentir vontade de escrever `// isso existe por causa de X`, pare e pergunte
onde X já está documentado (ou devia estar). Nome de função/variável e estrutura do código
continuam sendo a explicação do "o quê"; o "por quê" não-óbvio vira uma frase em `docs/adr/` ou no
`ESTADO.md` da feature.

## TypeScript estrito, componentes funcionais + hooks

Ver `CLAUDE.md` na raiz para convenções de stack, navegação (`expo-router`) e estado (`zustand`).

## Segredos

Chaves de API (`.env`) e keystore de assinatura Android nunca são commitados. Ver
[chaves-e-segredos.md](./chaves-e-segredos.md) para onde cada um vive de fato.

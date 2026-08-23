# Documentação de `contexto.ts`

Contexto da cena — hora e lugar — para enriquecer a leitura do Gemini
(feature 005, US2/US4, FR-034).

Duas informações de naturezas muito diferentes, e o módulo trata cada uma
como ela merece:

- **Hora** é grátis: `new Date()` não pede permissão, não usa rede e não tem
caminho de falha. Entra sempre.
- **Lugar** é permissão nova, dado pessoal e latência. O consentimento
acontece no **onboarding** (card próprio, com justificativa); depois disso
entra como texto de cidade — **nunca coordenada** — e some em silêncio ao
primeiro sinal de problema. O flag `usarLocalizacao` dos Ajustes é a via de
revogação a qualquer momento (Princípio IV).

⚠️ **LGPD**: o que sai daqui para o prompt é `"Santos, SP"`, não um ponto no
mapa. A pergunta que o produto faz é "estou na praia?", e a cidade responde
isso sem entregar a posição de ninguém a um terceiro. Nada disto é
persistido — nem na sessão, nem na mídia: um dado que não é gravado não
precisa de política de retenção nem de tela de exclusão.

/** Período legível do dia — é o que o modelo consegue usar, não um timestamp. */

Teto próprio da resolução de lugar, curto de propósito.

A curadoria já tem o teto de 22s do Gemini e o de 8s do Deezer; o lugar é
enfeite comparado a eles e não pode custar nada perto disso. Estourou, some
do prompt — a foto não espera por um dado opcional (FR-034).

/** Promise que desiste — o mesmo padrão de `fetchComLimite` em `music.ts`. */

`expo-location`, resolvido de forma resiliente — **uma vez**.

Era `await import('expo-location')` dentro de um `try`, na aposta de que o
`catch` cobriria o módulo ausente. Não cobre: quando o JS novo roda sobre um
binário antigo (Metro recarregado sem rebuild nativo), o Metro estoura
`Requiring unknown module "…"` e **derruba o app** antes de qualquer `catch`
do nosso código — foi o que aconteceu numa captura comum, com a build
anterior ao `expo-location` instalada.

`require` síncrono dentro de try/catch resolve no momento em que o módulo é
de fato pedido e devolve `null` quando ele não existe, que é o que faz a
degradação prometida por FR-034 acontecer de verdade: sem lugar, sem crash.

O resultado é memoizado porque a resposta não muda durante a execução — e
porque tentar de novo a cada foto seria repetir o mesmo erro em silêncio.

/** Sempre presente: `"início da noite (19h)"`. */

/** `"Santos, SP"` — texto, nunca coordenada. Ausente sem opt-in/permissão. */

/** A parte que nunca falha, isolada para quem só precisa dela. */

Resolve o lugar como **texto de cidade** (D5).

Três travas, nesta ordem, e qualquer uma delas devolve `undefined` sem
reclamar: opt-in desligado → permissão negada → tempo esgotado. Nenhuma
bloqueia a captura, nenhuma repete o pedido.

A precisão é `Low` de propósito: a pergunta do produto é "estou na praia?", e
`Accuracy.Low` responde isso gastando menos bateria e menos tempo. Precisão
alta responderia melhor uma pergunta que o produto não faz.

Monta o contexto que vai ao prompt. Nunca rejeita: no pior caso devolve só a
hora, que é o piso e sempre existe.

Pede a permissão de localização — **uma vez, no onboarding** (feature 005).

Fica separado de `montarContexto` de propósito: pedido de permissão é evento
de onboarding, não de captura. Misturar os dois faria o diálogo do sistema
aparecer no meio de uma foto, que é o caminho mais curto para alguém negar
por reflexo.

Nunca rejeita e nunca bloqueia: o retorno é informativo. Recusar localização
não impede nada no app — a vibe passa a sair só da imagem e da hora
(FR-034), e a pessoa pode reconsiderar depois pelas configurações do sistema.


# Research: Vibe definida pela IA

**Fase 0** · 2026-08-22 · Alimenta as decisões D1–D7 do [plan.md](./plan.md).

Nenhum item da Technical Context ficou marcado `NEEDS CLARIFICATION`. Os pontos
abaixo são as investigações que fecharam cada um deles.

---

## R1 — O prompt atual carrega a âncora errada antes de ver a foto

**Decisão**: retirar `vibe.musicaKeywords` do caminho de curadoria com foto;
manter a leitura de cena (`cena`) como fonte dos termos de busca.

**Investigação**: `askGeminiWithPhoto()` (`src/services/music.ts:399`) monta o
prompt pedindo *"classifique a atmosfera da cena em EXATAMENTE UMA destas
vibes"*, listando os oito ids com suas descrições. O modelo escolhe o rótulo, e
`resolveWithDeezer(ideas, vibe)` recebe esse `Vibe` — cujo `musicaKeywords`
contém literalmente `['pop dance hit', 'funk brasileiro', 'electro pop
energetic']` para `energetica` (`src/constants/vibes.ts:14`).

Isso confirma o relato da spec de ponta a ponta: a foto do samurai caiu em
`energetica`, e `funk brasileiro` estava escrito no prompt como termo válido de
busca antes de qualquer análise. O rótulo não foi um resumo da cena — foi um
funil de oito saídas possíveis, e a mais próxima ainda estava longe.

**Contraprova a favor do modelo**: no mesmo pipeline, o campo `cena` e os nomes
de look voltaram corretos ("Ciber Samurai", "Sombra Profunda"). O modelo lê bem;
o que estraga é o menu fechado que ele é obrigado a escolher.

**Alternativas consideradas**:
- *Aumentar a lista de oito para trinta vibes* — adia o problema. Qualquer lista fechada é um funil; a spec pede texto livre justamente por isso.
- *Manter o id e adicionar texto livre só para exibição* — deixaria a busca contaminada. Corrige o que se lê, não o que se ouve (US2 continuaria quebrada).

---

## R2 — `musicaKeywords` tem um segundo uso, defensivo, que não pode cair junto

**Decisão**: preservar `faixaAproveitavel()`, alimentando-a com os termos de
busca realmente usados em vez da tabela de vibes.

**Investigação**: `faixaAproveitavel(t, vibe)` (`music.ts:159`) usa
`vibe.musicaKeywords` para **rejeitar** faixas cujo título é a própria keyword —
`«funk brasileiro — RVDENT»`, `«Dream Pop — Earth Trax»`. É ruído de catálogo do
Deezer, e o comentário no código registra que a paginação profunda o traz à tona.

Remover `musicaKeywords` sem olhar mataria essa proteção e reintroduziria um
defeito já resolvido. O uso é legítimo porque é aplicado *depois* da busca, sobre
o resultado — não empurra a busca para lugar nenhum.

**Alternativas consideradas**:
- *Deixar o filtro sem lista* — perderia a proteção contra o caso mais comum (título idêntico ao termo buscado).
- *Lista fixa de termos genéricos* — funciona, mas não acompanha os termos novos que a leitura de cena vai gerar. Derivar dos termos usados é auto-ajustável.

---

## R3 — Vibe livre não pode alimentar o que hoje depende de `VibeId`

**Decisão**: `VibeId` permanece como piso local; `vibe: string` entra como campo
aditivo (D1).

**Investigação**: mapeei todo consumo de `VibeId` fora do prompt:

| Consumidor | Depende de rede? | O que faria com texto livre |
|---|---|---|
| `detectVibe()` → visor ao vivo | Não (FR-021) | Nada — não há foto nem Gemini nesse momento |
| `looksBase(vibeId)` → piso dos 3 looks | Não | Precisa de `vibe.filtro`, que só a tabela tem |
| `FALLBACK[vibeId]` → catálogo offline | Não | Precisa de chave fixa; texto livre não indexa |
| `Media.vibeId` gravado | — | Registros existentes só têm o id |

Os quatro precisam de um valor **garantido e determinístico**. Vibe livre é
nenhuma das duas coisas: pode faltar (sem chave, sem rede, timeout) e muda a
cada foto. Trocar o tipo por `string` quebraria os quatro para ganhar
consistência de nome — mau negócio.

O padrão de campo aditivo já é jurisprudência do repo: `aspecto`, `sugestoes`,
`looks` e `audioUri` foram todos introduzidos assim, com o comentário
"ausência significa *não sei*, nunca *não há*" (`src/types.ts`).

---

## R4 — As duas stores perdem a chave de agrupamento

**Decisão**: trocar índice por lista das 20 últimas; preservar o limiar de
afinidade avaliado sobre o histórico inteiro (D3).

**Investigação**: `useTasteStore.sugeridasPorVibe` é `Record<string,
FaixaSugerida[]>` e `useLookTasteStore.preferidoDaVibe(vibeId)` filtra
`escolhas` por `e.vibeId === vibeId`. Ambos assumem um conjunto pequeno e fixo
de chaves.

Detalhe que já aponta a saída: o caminho com foto **já não usa** o índice.
`askGeminiWithPhoto()` chama `faixasSugeridasGlobais(20)` com o comentário *"a
vibe ainda não existe neste ponto — é o próprio Gemini que a classifica"*
(`music.ts:404`). O caminho principal já vive sem o agrupamento; a feature só
formaliza isso e estende ao lado visual.

Sobre o limiar (`LIMIAR_PESO = 2`, `LIMIAR_ESCOLHAS = 2`): o comentário em
`useLookTasteStore.ts:38` justifica os dois critérios por *"uma escolha isolada
não é gosto estabelecido"* — argumento sobre volume de sinal, não sobre vibe.
Avaliá-lo sobre o histórico inteiro preserva a intenção e ainda fica mais
robusto, já que deixa de fragmentar o sinal em oito baldes.

**Migração**: `EscolhaMusical.vibeId` e `EscolhaVisual.vibeId` permanecem
gravados e passam a ser ignorados na leitura. Nenhum apagamento, nenhuma
transformação de dado em disco — o menor risco possível para dado persistido.

**Alternativas consideradas**:
- *Migração destrutiva reescrevendo as escolhas* — risco desnecessário; o campo obsoleto não atrapalha.
- *Agrupar por embedding da vibe livre* — complexidade fora de proporção para uma lista de 20 itens.

---

## R5 — Localização: qual biblioteca, qual granularidade, qual momento

**Decisão**: `expo-location` com geocodificação reversa; enviar cidade/região em
texto; opt-in desligado por padrão; pedido na primeira captura, não no
onboarding (D5).

**Investigação**:

*Biblioteca* — `expo-location` já está no SDK 54 e é a escolha canônica do
ecossistema; `react-native-vision-camera` não fornece localização e não há outra
dependência do repo que resolva. `expo-location` não está instalado hoje
(`package.json` não o lista), então é dependência nova. Exige rebuild do dev
build por adicionar permissão nativa — custo real a registrar nas tasks.

*Granularidade* — `Location.reverseGeocodeAsync()` devolve `city`, `region`,
`district`. A pergunta que o produto faz é "estou na praia?", e `"Santos, SP"`
responde isso. Coordenada bruta responderia melhor um problema que o produto não
tem, e entregaria um ponto no mapa a um terceiro. `Accuracy.Low` basta e é mais
rápido e mais barato em bateria.

*Momento do pedido* — o onboarding (`app/index.tsx`) se apresenta hoje com
ênfase em processamento local (Princípio IV). Somar um terceiro pedido ali cobra
no instante de maior fragilidade da confiança. E o cenário 2 da US4 proíbe
repetir o pedido a cada foto. Pedido na primeira captura com o toggle ligado
satisfaz os dois: contexto claro para quem aceita, silêncio para quem recusa.

*Latência* — a spec já sinaliza. O plano resolve por concorrência, não por
espera: a resolução do lugar corre em paralelo ao `photoToBase64()`, que hoje já
consome tempo mensurável antes do Gemini, e tem teto próprio curto. Estourou,
some do prompt.

**Alternativas consideradas**:
- *Sempre ligado, sem toggle* — contraria diretamente o Princípio IV (opt-in persistido e revogável).
- *Coordenadas no prompt* — mais dado, menos utilidade, pior LGPD.
- *IP geolocation* — evitaria a permissão, mas seria uma chamada de rede a mais no caminho crítico e um dado enviado a um terceiro não declarado. Pior em todos os eixos.

---

## R6 — Onde o esqueleto já foi resolvido neste repo

**Decisão**: extrair o shimmer de `TratamentoCarrossel` para
`EsqueletoTexto.tsx` em vez de escrever um novo (D7).

**Investigação**: `TratamentoCarrossel.tsx:76` tem um `Esqueleto` completo —
shimmer atravessando da esquerda para a direita, mais respiração por
`Animated.timing` sobre a opacidade. Os comentários registram por que os dois
efeitos coexistem (*"o reflexo sozinho é vocabulário de placeholder — comum,
neutro; a pulsação..."*) e há decisão de `atraso` escalonado por slot para que
dois esqueletos não pulsem em uníssono.

É animação já ajustada e validada no aparelho. Reescrever para um retângulo de
texto produziria dois vocabulários de espera na mesma tela — o do carrossel e o
da vibe, logo acima dele, pulsando fora de sincronia.

**Ponto de atenção registrado**: memória do projeto anota que `LayoutAnimation`
derruba `FlatList` quando a chave de slot troca placeholder por dado. A vibe
não vive em lista, então não incide — mas a troca esqueleto→texto deve ser feita
por render condicional simples, sem animação de layout.

---

## R7 — O contrato de resposta do Gemini muda pouco

**Decisão**: manter o schema JSON de resposta e alterar apenas a semântica do
campo `vibe`, somando contexto ao prompt.

**Investigação**: `GeminiSceneResult` já tem `{ vibe, cena?, musicas?, looks? }`
(`music.ts:357`). A feature muda o que `vibe` significa — de id do catálogo para
texto livre — e não a forma da resposta. `musicas` e `looks` seguem idênticos.

Isso mantém intactos `receitaDeIdeia()`, `montarLooks()`, `montarConjunto()`,
`verificarDescobertas()` e todo o pipeline de resolução do Deezer — os pedaços
mais delicados e mais validados do arquivo. A superfície de mudança fica no
texto do prompt e na leitura de um único campo.

**Validação no cliente**: a lição registrada em `looks.ts` — *"instrução em
prompt é pedido, não garantia"* — vale aqui. "No máximo 2 palavras" precisa ser
imposta na leitura: trim, colapso de espaço, corte em 2 palavras, teto de
caracteres, e `undefined` quando vem vazio. O detalhe fica em
[contracts/gemini-cena.md](./contracts/gemini-cena.md).

# Feature Specification: Looks sugeridos com memória de gosto

**Feature Branch**: `claude/current-filter-system-6gpmbh`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Ao capturar, o app deixa de aplicar um filtro fixo derivado da vibe e passa a oferecer **três looks sugeridos** para aquela foto, do mesmo jeito que já faz com música. A primeira sugestão é a **principal** e nasce do histórico do próprio aparelho: se a pessoa fotografou uma praia e salvou ou postou com determinado tratamento, na próxima foto de praia o app já sabe o que indicar — e já sabe que faixa ela gosta. As outras duas também precisam ser boas, mas são derivadas da cena, sem olhar o histórico. Não há edição manual: a pessoa escolhe entre as sugestões, não mexe em controles."

## Contexto

Hoje o filtro é uma tabela fixa: cada uma das oito vibes aponta para um dos oito filtros, um para um, escrito à mão. O sistema nunca aprende — a milésima foto de praia da pessoa recebe o mesmo tratamento que a primeira, mesmo que ela tenha rejeitado aquele tratamento novecentas vezes.

A curadoria musical já resolveu esse problema. Ela entrega quatro faixas com **papéis** declarados (`afinidade`, `certeira`, `descoberta`, `curinga`), onde a de afinidade é derivada localmente do histórico de escolhas do aparelho e as demais vêm da cena. Esta feature aplica o mesmo mecanismo à metade visual do pacote sensorial, cumprindo o Princípio I (imagem e som nunca tratados como elementos isolados) na estrutura, não só no discurso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher entre três looks sugeridos (Priority: P1)

Ao capturar uma foto, a pessoa recebe três tratamentos visuais propostos para aquela imagem específica, cada um com um rótulo curto que explica por que está ali. O primeiro já vem aplicado. Ela toca em outro para trocar, ou segue direto para salvar/postar sem tocar em nada.

**Why this priority**: É a fatia que entrega o produto sozinha. Sem histórico e sem render novo, três sugestões justificadas já substituem a tabela fixa e já melhoram a decisão de quem fotografa.

**Independent Test**: Capturar uma foto com a chave do Gemini configurada e verificar que o Modal de Captura abre com três looks rotulados, o primeiro aplicado, e que tocar em outro troca a prévia sem recarregar a tela.

**Acceptance Scenarios**:

1. **Given** uma foto recém-capturada e curadoria disponível, **When** o Modal de Captura abre, **Then** três looks aparecem em destaque com o primeiro já aplicado à foto, cada um com nome e justificativa de uma linha.
2. **Given** três looks exibidos, **When** a pessoa toca no segundo, **Then** a prévia passa a mostrar o segundo tratamento e a seleção fica visualmente marcada, sem nova chamada de rede.
3. **Given** três looks exibidos, **When** a pessoa não toca em nenhum e salva, **Then** a mídia é salva com o primeiro look, e essa escolha conta como aceite passivo.
4. **Given** os três looks sugeridos, **When** a pessoa quer algo fora deles, **Then** os oito tratamentos base continuam acessíveis no mesmo carrossel, depois das sugestões.
5. **Given** uma foto capturada, **When** a pessoa escolhe explicitamente "sem tratamento", **Then** a foto permanece exatamente como saiu da câmera.

---

### User Story 2 - O app aprende o gosto visual da pessoa (Priority: P1)

Toda vez que alguém salva ou posta, o app registra qual tratamento foi ao ar e sob qual vibe. Na próxima foto de vibe semelhante, a sugestão principal passa a refletir esse histórico: praia depois de praia, o tratamento que ela já aprovou volta em primeiro lugar, rotulado como afinidade.

**Why this priority**: É o que a pessoa pediu como recomendação **principal**, e é o que diferencia a feature de "três sugestões aleatórias". Sem isto a US1 funciona, mas nunca melhora com o uso.

**Independent Test**: Salvar três fotos da mesma vibe sempre com o mesmo tratamento, capturar uma quarta foto daquela vibe e verificar que a sugestão principal é aquele tratamento, marcada como afinidade.

**Acceptance Scenarios**:

1. **Given** um aparelho sem histórico, **When** a pessoa captura a primeira foto, **Then** as três sugestões vêm todas da cena e nenhuma é rotulada como afinidade — nenhum slot fica vazio ou com rótulo enganoso.
2. **Given** histórico registrando escolhas repetidas de um tratamento para a vibe `praiana`, **When** a pessoa captura outra foto de vibe `praiana`, **Then** a sugestão principal é aquele tratamento, rotulada como afinidade, e as outras duas continuam vindo da cena.
3. **Given** que a pessoa trocou manualmente o tratamento antes de salvar, **When** o registro é gravado, **Then** essa escolha pesa mais que um aceite passivo do que o sistema já havia proposto.
4. **Given** escolhas antigas no histórico, **When** o peso é calculado, **Then** escolhas recentes contam mais que escolhas de meses atrás.
5. **Given** o histórico de gosto visual, **When** a curadoria monta o pedido à IA, **Then** o histórico **não** é enviado — a afinidade é calculada apenas no aparelho.
6. **Given** os Ajustes, **When** a pessoa apaga o histórico de gosto, **Then** as sugestões voltam a ser todas derivadas da cena.

---

### User Story 3 - Tratamentos fiéis em qualquer aparelho e no arquivo final (Priority: P2)

O tratamento que a pessoa aprovou na tela é o tratamento que sai no arquivo salvo ou postado, na resolução da foto original, e é o mesmo nos dois sistemas operacionais.

**Why this priority**: Hoje o arquivo exportado é uma captura de tela da prévia, então perde resolução, e o motor de render atual só aplica parte dos ajustes fora do Android — o que faria três sugestões diferentes parecerem quase idênticas em iOS, esvaziando a feature justamente onde ela precisa convencer.

**Independent Test**: Salvar a mesma foto com cada um dos três looks e verificar que os arquivos resultantes têm a resolução da foto original e são visualmente distintos entre si nos dois sistemas.

**Acceptance Scenarios**:

1. **Given** uma foto com look aplicado, **When** a pessoa salva na galeria do sistema, **Then** o arquivo tem a resolução da foto capturada, não a da prévia em tela.
2. **Given** os três looks sugeridos para a mesma foto, **When** exibidos lado a lado em iOS, **Then** são visualmente distinguíveis entre si.
3. **Given** um look aplicado, **When** a prévia é renderizada durante a escolha, **Then** a troca entre sugestões é imediata na percepção de quem usa.

---

### User Story 4 - Retomar a decisão pela galeria (Priority: P3)

A pessoa reabre uma mídia salva e as três sugestões daquela foto ainda estão lá, com a que ela escolheu marcada. Ela pode trocar de ideia sem que o app precise consultar a rede de novo.

**Why this priority**: O Princípio V exige que a intenção criativa persista e seja retomável. Além disso, sem guardar as sugestões, reabrir uma mídia dispara nova curadoria para um pacote que já estava fechado — problema que a curadoria musical já resolveu guardando as faixas junto da mídia.

**Independent Test**: Salvar uma mídia, fechar o app, reabrir a mídia pela galeria e verificar que as três sugestões aparecem sem chamada de rede e que trocar entre elas atualiza a mídia salva.

**Acceptance Scenarios**:

1. **Given** uma mídia salva com looks, **When** ela é reaberta pela galeria, **Then** as três sugestões e a escolha aparecem sem nova consulta externa.
2. **Given** uma mídia salva antes desta feature, **When** ela é reaberta, **Then** ela abre normalmente com o tratamento que tinha, sem erro e sem sugestões inventadas.
3. **Given** uma mídia reaberta, **When** a pessoa troca de look e sai da tela, **Then** a troca fica salva e conta para o histórico de gosto.

---

### Edge Cases

- **Sem chave de IA configurada ou sem rede**: as sugestões caem para tratamentos base derivados da vibe, o salvamento nunca é bloqueado, e a interface não anuncia erro de curadoria como se a foto tivesse falhado.
- **IA demora além do teto**: a foto já está capturada e salvável; as sugestões chegam quando chegarem, ou a degradação assume. O caminho de salvar nunca espera a curadoria.
- **IA devolve valores fora de faixa ou incoerentes**: valores são limitados a faixas seguras antes de qualquer render; um look que ainda assim fique inválido é descartado e substituído por um tratamento base, mantendo sempre três opções.
- **IA devolve três looks quase idênticos**: sugestões visualmente redundantes são detectadas e a redundante é substituída, para que as três opções sejam sempre uma escolha real.
- **Histórico existe mas para outra vibe**: a afinidade só vale para vibes com histórico próprio; sem isso, o slot vira mais uma sugestão de cena e não é rotulado como afinidade.
- **Histórico com uma única escolha**: uma escolha isolada não é gosto estabelecido; a afinidade só entra quando o histórico daquela vibe tem sinal suficiente para não parecer sorteio.
- **Mesma foto analisada duas vezes**: a mesma foto produz as mesmas três sugestões — a segunda análise não pode devolver um conjunto diferente sem que nada tenha mudado.
- **Pessoa escolhe "sem tratamento"**: é uma escolha legítima e é registrada como tal; não é ausência de dado.
- **Histórico apagado nos Ajustes**: o app volta ao comportamento de aparelho novo, sem quebrar mídias já salvas.

## Requirements *(mandatory)*

### Functional Requirements

**Sugestões**

- **FR-001**: O sistema MUST oferecer exatamente três looks sugeridos por foto capturada.
- **FR-002**: Cada look sugerido MUST ter um nome curto e uma justificativa de uma linha explicando por que foi proposto para aquela foto.
- **FR-003**: Cada look sugerido MUST declarar seu papel, distinguindo a sugestão vinda do histórico das sugestões vindas da cena.
- **FR-004**: O sistema MUST aplicar a sugestão principal automaticamente ao abrir o Modal de Captura, sem exigir toque.
- **FR-005**: A pessoa MUST poder trocar entre as três sugestões sem nova consulta externa e sem sair da tela.
- **FR-006**: Os oito tratamentos base MUST permanecer acessíveis no mesmo carrossel, depois das sugestões, incluindo a opção de não aplicar tratamento nenhum.
- **FR-007**: O sistema MUST NOT oferecer controles manuais de ajuste de imagem — a escolha é entre sugestões, não por manipulação de parâmetros.
- **FR-008**: Cada look MUST ser derivado de um dos tratamentos base identificável, e não construído do zero, de modo que toda sugestão tenha uma ancoragem reconhecível.
- **FR-009**: A mesma foto MUST produzir o mesmo conjunto de três sugestões quando reanalisada sem mudança de contexto.

**Histórico de gosto visual**

- **FR-010**: O sistema MUST registrar, a cada salvamento ou postagem, qual tratamento foi usado e sob qual vibe.
- **FR-011**: O sistema MUST distinguir escolha explícita de aceite passivo, atribuindo mais peso à escolha explícita.
- **FR-012**: O sistema MUST reduzir o peso de escolhas conforme envelhecem.
- **FR-013**: O sistema MUST derivar a sugestão de afinidade exclusivamente do histórico local do aparelho.
- **FR-014**: O sistema MUST NOT enviar o histórico de gosto visual para qualquer serviço externo, nem incluí-lo no pedido de análise da foto.
- **FR-015**: O sistema MUST omitir o rótulo de afinidade quando o histórico daquela vibe não tiver sinal suficiente, preenchendo o slot com uma sugestão de cena.
- **FR-016**: A pessoa MUST poder apagar o histórico de gosto visual pelos Ajustes.
- **FR-017**: As duas sugestões não-principais MUST ser derivadas apenas da cena, sem influência do histórico.

**Integração com a curadoria existente**

- **FR-018**: A análise visual que produz os looks MUST acontecer na mesma consulta externa que já analisa a foto para vibe e música, sem consulta adicional.
- **FR-019**: O sistema MUST degradar em cadeia quando a curadoria falhar: looks da IA → tratamentos base derivados da vibe → foto sem tratamento.
- **FR-020**: A curadoria de looks MUST NOT bloquear o salvamento da foto em nenhuma circunstância.
- **FR-021**: O visor ao vivo MUST continuar usando apenas tratamentos locais, sem depender de rede para exibir a prévia em tempo real.

**Persistência e render**

- **FR-022**: O sistema MUST persistir junto da mídia as três sugestões e qual delas foi escolhida.
- **FR-023**: Mídias salvas antes desta feature MUST continuar abrindo e exportando normalmente.
- **FR-024**: O arquivo exportado MUST ter a resolução da foto capturada, não a da prévia exibida em tela.
- **FR-025**: Três sugestões distintas MUST ser visualmente distinguíveis entre si em ambos os sistemas operacionais suportados.
- **FR-026**: Valores de tratamento vindos da IA MUST ser limitados a faixas seguras antes de qualquer aplicação visual.

### Key Entities

- **Look sugerido**: um tratamento visual proposto para uma foto específica. Tem nome, justificativa, papel, o tratamento base do qual deriva e os desvios em relação a ele.
- **Papel do look**: rótulo que diz por que a sugestão está ali — se veio do histórico do aparelho ou da leitura da cena.
- **Escolha visual**: registro de que um tratamento foi ao ar sob determinada vibe, em determinado momento, por escolha explícita ou aceite passivo. É a unidade do histórico de gosto.
- **Histórico de gosto visual**: coleção de escolhas visuais do aparelho, ponderada por tipo de escolha e por idade, consultada localmente para produzir a sugestão de afinidade. Nunca sai do aparelho.
- **Mídia**: ganha o conjunto de sugestões e a escolha visual, do mesmo modo que já guarda as faixas sugeridas e a faixa escolhida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pessoa chega de foto capturada a mídia salva com tratamento aplicado sem nenhum toque além do disparo e do salvar.
- **SC-002**: Depois de cinco capturas da mesma vibe com o mesmo tratamento escolhido, a sexta captura daquela vibe traz esse tratamento como sugestão principal em 100% das vezes.
- **SC-003**: Trocar entre as três sugestões é percebido como instantâneo, sem espera visível.
- **SC-004**: Em 100% das capturas, três sugestões são apresentadas — inclusive sem rede, sem chave de IA e sem histórico.
- **SC-005**: Nenhuma falha de curadoria impede o salvamento da foto.
- **SC-006**: Arquivos exportados preservam a resolução da foto capturada.
- **SC-007**: Em avaliação lado a lado, as três sugestões de uma mesma foto são identificadas como visualmente diferentes entre si nos dois sistemas operacionais.
- **SC-008**: Nenhum dado de gosto visual aparece em tráfego de rede, verificável por inspeção do que é enviado na análise da foto.
- **SC-009**: Mídias criadas antes da feature abrem, exibem e exportam sem erro.

## Assumptions

- **Três sugestões, não quatro.** A curadoria musical entrega quatro faixas; aqui são três, conforme pedido. Os papéis se reduzem a "veio do seu histórico" e "veio da cena", sem o equivalente visual de `descoberta`/`curinga`.
- **O histórico é indexado por vibe**, espelhando o histórico musical, que já é indexado por vibe. "Foto de praia" é representada pela vibe detectada para aquela foto, não por uma classificação de cenário separada.
- **Edição manual está fora de escopo.** Não há sliders, curvas, HSL ou qualquer controle de parâmetro. A revisão anterior desta ideia previa um editor profissional completo; ele foi descartado a pedido, e o aprendizado por histórico ocupa seu lugar como forma de personalização.
- **"Salvar como meu filtro" está fora de escopo.** O app aprende sozinho pelo histórico em vez de pedir que a pessoa fixe um preset manualmente, o que é mais fiel ao Princípio II.
- **Os oito tratamentos base permanecem** e seguem sendo o que roda no visor ao vivo, por exigência do Princípio III. Eles também são a ancoragem de toda sugestão e a rede de segurança da degradação.
- **A troca do motor de render é pré-requisito da US3, não da US1.** As US1 e US2 podem ser entregues e demonstradas sobre o render atual; sem a troca, porém, a distinção entre as três sugestões fica fraca em iOS e o arquivo exportado continua limitado à resolução da prévia.
- **O aplicativo é hoje entregue em Android**, já que os módulos nativos existentes só têm implementação Android. A paridade em iOS é tratada pela US3.
- **O teto de tempo da consulta externa já existente é reaproveitado**, sem novo orçamento de latência, já que a análise dos looks viaja na mesma consulta.
- **O registro de gosto visual segue o mesmo regime de privacidade do gosto musical** (consumo local, nunca no prompt), por analogia direta à decisão já tomada para música.

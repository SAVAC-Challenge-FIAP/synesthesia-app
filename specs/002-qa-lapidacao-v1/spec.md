# Feature Specification: QA e Lapidação do MVP v1

**Feature Branch**: `002-qa-lapidacao-v1`

**Created**: 2026-08-15

**Status**: Draft

**Input**: Rodada de QA e lapidação do MVP v1 após a entrega do fluxo completo (captura → vibe real via Gemini → curadoria musical → `.mp4` imagem+trilha → compartilhar). Não adiciona funcionalidades: corrige defeitos de usabilidade, alcance de toque, latência percebida e consistência visual encontrados em teste real no dispositivo.

## Contexto

O fluxo do produto está completo e validado ponta a ponta em dispositivo real (Redmi Note 8 Pro, Android 10). Esta rodada **não cria capacidades novas** — ela remove os atritos que fazem o usuário tropeçar num fluxo que já funciona.

Todos os itens abaixo foram **observados em teste no aparelho**, não inferidos do código. Dois deles violam princípios da constituição de forma silenciosa (o usuário não percebe que perdeu algo), e por isso são P1.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alcançar os botões de ação sem brigar com o aparelho (Priority: P1)

O usuário terminou a captura, quer salvar ou postar, e toca no botão. O toque simplesmente não acontece — ele toca de novo, mais forte, e continua sem resposta. Só funciona se ele acertar a metade de cima do botão.

**Why this priority**: Um botão que não responde é o atrito máximo — o oposto do Princípio II (Redução do Atrito de Decisão). O usuário não tem como saber que precisa mirar mais alto; ele conclui que o app travou. É o defeito mais imediatamente visível para qualquer pessoa que pegue o aparelho, incluindo avaliadores.

**Independent Test**: Tocar na metade inferior de cada botão de ação primário em todas as telas e confirmar que 100% dos toques são registrados.

**Acceptance Scenarios**:

1. **Given** o modal de captura aberto, **When** o usuário toca em qualquer ponto dentro da área visível de "Salvar" ou "Postar agora", **Then** a ação correspondente é acionada.
2. **Given** um aparelho com barra de navegação por gestos ou por botões, **When** qualquer tela do app é exibida, **Then** nenhum controle interativo fica sob a área reservada do sistema.
3. **Given** qualquer controle interativo do app, **When** medida sua área de toque, **Then** ela tem no mínimo 48dp × 48dp.

---

### User Story 2 - Nunca perder a trilha sem saber (Priority: P1)

O usuário captura uma foto, a curadoria musical ainda está rodando, e ele toca em "Postar agora". O app gera o pacote **sem música** e anuncia "Pacote pronto!" como se tudo tivesse dado certo. O usuário só descobre que perdeu a metade sonora quando abre o arquivo — ou nunca descobre.

**Why this priority**: Viola diretamente o **Princípio I (Multimodalidade Primeiro)** — a unidade imagem↔som é a proposta central do produto — e faz isso **silenciosamente**, que é o pior modo de falhar. O usuário é levado a acreditar que recebeu o pacote sensorial completo.

**Independent Test**: Capturar e tocar imediatamente na ação de postar, antes da trilha aparecer; confirmar que o sistema impede a perda silenciosa.

**Acceptance Scenarios**:

1. **Given** a curadoria musical em andamento, **When** o usuário observa a ação de postar, **Then** ela está visivelmente indisponível, com indicação do motivo.
2. **Given** a curadoria musical concluída, **When** o usuário observa a ação de postar, **Then** ela está disponível.
3. **Given** a curadoria musical falhou (sem rede, sem resultado), **When** o usuário aciona a postagem, **Then** o sistema informa explicitamente que o pacote sairá sem trilha e pede confirmação.
4. **Given** qualquer estado da curadoria, **When** o usuário aciona "Salvar", **Then** a ação permanece disponível — a foto nunca é bloqueada nem perdida.

---

### User Story 3 - Esperar menos pela trilha (Priority: P2)

Entre disparar a foto e ver a música sugerida passam-se alguns segundos. Nesse intervalo o usuário olha para um texto estático, sem saber se o app está trabalhando ou travado.

> **Revisado em 2026-08-15** (D1): esta história nasceu descrevendo uma espera de **30–45s** que
> não se reproduziu na medição (mediana real: **6,02s** — ver [baseline.md](./baseline.md) T003).
> Com a espera uma ordem de grandeza menor, **o peso da US3 se desloca**: o dano real não é a
> duração, é o *feedback estático* durante ela — o cenário de aceite 2, não o 1. Ver **SC-Q03**.

**Why this priority**: O **Princípio III** afirma que "a percepção de latência é um bug", e o **Princípio II** promete reduzir o atrito de decisão. Uma espera muda no caminho principal contradiz a promessa central do produto. É P2 e não P1 porque o fluxo *conclui* corretamente — o dano é à experiência, não à integridade do resultado.

**Independent Test**: Medir o tempo entre o disparo e a exibição da trilha em 5 capturas, antes e depois, e comparar.

**Acceptance Scenarios**:

1. **Given** uma captura com rede estável, **When** o usuário dispara a foto, **Then** a trilha sugerida aparece em tempo perceptivelmente menor que o atual.
2. **Given** a curadoria em andamento, **When** o usuário aguarda, **Then** o app comunica progresso real (não um estado estático), deixando claro que está trabalhando.
3. **Given** a curadoria demora mais que o esperado, **When** o tempo limite é atingido, **Then** o app degrada para a alternativa disponível sem travar o usuário.

---

### User Story 4 - Descobrir que existem oito filtros (Priority: P2)

O produto oferece oito filtros. Na tela, o usuário enxerga três e um pedaço cortado do quarto, sem nenhuma indicação de que a lista continua.

**Why this priority**: Metade do repertório estético do produto fica invisível. Afeta a percepção de valor e a **Fidelidade à Identidade Visual (Princípio VI)** — um item cortado ao meio parece defeito, não affordance.

**Independent Test**: Mostrar a tela a alguém que nunca usou o app e perguntar quantos filtros existem.

**Acceptance Scenarios**:

1. **Given** o carrossel de filtros exibido, **When** o usuário olha a tela, **Then** há indicação visual clara de que existem mais filtros além dos visíveis.
2. **Given** o carrossel, **When** o usuário percorre a lista, **Then** nenhum item aparece cortado de forma ambígua em repouso.
3. **Given** um filtro selecionado, **When** o usuário troca de filtro, **Then** a mudança é aplicada sem atraso perceptível.

---

### User Story 5 - Ver uma identidade visual coerente (Priority: P3)

Os controles do app (galeria, virar câmera, fechar, reproduzir) usam emojis. Cada fabricante desenha emojis de um jeito, então o app tem aparência diferente em cada aparelho e destoa da identidade autoral construída com Syne, DM Mono e a paleta ruby/amber/ink/parchment.

**Why this priority**: É o **Princípio VI**, mas o impacto é estético e não funcional — o app continua utilizável. Entra depois dos defeitos que quebram uso e integridade.

**Independent Test**: Comparar capturas de tela da mesma versão em dois aparelhos de fabricantes diferentes.

**Acceptance Scenarios**:

1. **Given** o app aberto em aparelhos de fabricantes diferentes, **When** comparadas as telas, **Then** os ícones de controle têm a mesma aparência.
2. **Given** qualquer tela, **When** avaliada contra os design tokens, **Then** os ícones de controle usam as cores da paleta oficial.
3. **Given** os filtros e as vibes, **When** exibidos, **Then** seus emojis são preservados — ali o emoji é linguagem do produto, não ícone de interface.

---

### User Story 6 - Acompanhar a geração do vídeo (Priority: P3)

A geração do `.mp4` leva entre 40 e 70 segundos. Durante todo esse tempo o usuário não sabe quanto falta nem se o processo avançou.

**Why this priority**: Mesma família do Princípio III (latência percebida), mas ocorre no fim do fluxo, quando o usuário já obteve o valor principal. É o último a ser lapidado.

**Independent Test**: Acionar a exportação e observar se o indicador reflete avanço real ao longo do tempo.

**Acceptance Scenarios**:

1. **Given** a exportação do vídeo em andamento, **When** o usuário observa a tela, **Then** vê progresso que avança de forma proporcional ao trabalho concluído.
2. **Given** a exportação em andamento, **When** o usuário aguarda, **Then** a interface permanece responsiva.
3. **Given** o app em uso prolongado, **When** o modal de captura é aberto e fechado repetidamente, **Then** não há degradação acumulada de desempenho.

---

### Edge Cases

- O que acontece quando o aparelho usa navegação por gestos em vez de botões — a área reservada muda de tamanho?
- O que acontece se a curadoria musical falhar depois que o usuário já esperou 40 segundos?
- O que acontece se o usuário girar o aparelho ou receber uma ligação durante a geração do vídeo?
- O que acontece com o carrossel em telas muito estreitas ou com fonte do sistema ampliada por acessibilidade?
- O que acontece se o usuário tocar repetidamente em "Postar agora" enquanto a exportação já está em curso?

## Requirements *(mandatory)*

### Functional Requirements

**Alcance de toque (US1)**

- **FR-Q01**: Nenhum controle interativo pode ficar sob a área reservada pelo sistema operacional (barra de navegação, notch, ilha).
- **FR-Q02**: Todo controle interativo MUST ter área de toque mínima de 48dp × 48dp.
- **FR-Q03**: O espaçamento inferior das telas MUST se adaptar ao aparelho, e não usar valor fixo.

**Integridade do pacote sensorial (US2)**

- **FR-Q04**: A ação de postar MUST ficar indisponível enquanto a curadoria musical estiver em andamento, com indicação visível do motivo.
- **FR-Q05**: Quando não houver trilha disponível, o sistema MUST informar explicitamente que o pacote sairá sem música e obter confirmação antes de prosseguir.
- **FR-Q06**: A ação de salvar MUST permanecer sempre disponível, independentemente do estado da curadoria.
- **FR-Q07**: Nenhuma mensagem de sucesso pode declarar o pacote pronto sem deixar claro o que ele contém.

**Latência percebida (US3, US6)**

- **FR-Q08**: O sistema MUST comunicar progresso durante a curadoria musical, de forma que o usuário perceba que há trabalho em andamento.
- **FR-Q09**: O sistema MUST comunicar progresso real durante a geração do vídeo, proporcional ao trabalho concluído.
- **FR-Q10**: A interface MUST permanecer responsiva durante curadoria e exportação.
- **FR-Q11**: O tempo até a trilha aparecer MUST ser medido antes e depois das mudanças, com os números registrados.

**Descoberta e identidade (US4, US5)**

- **FR-Q12**: O carrossel de filtros MUST indicar visualmente a existência de itens além dos visíveis.
- **FR-Q13**: Os ícones de controle da interface MUST ter aparência idêntica entre fabricantes de aparelhos.
- **FR-Q14**: Os emojis de filtros e vibes MUST ser preservados como linguagem do produto.
- **FR-Q15**: Todos os elementos visuais alterados MUST seguir os design tokens oficiais.

**Não regressão**

- **FR-Q16**: Nenhuma mudança desta rodada pode alterar o resultado do pacote exportado (imagem, trilha, vídeo) já validado no v1.
- **FR-Q17**: Toda alteração MUST ser verificada em dispositivo real com evidência visual de antes e depois.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-Q01**: 100% dos toques dentro da área visível de qualquer botão primário acionam a ação, em aparelhos com navegação por botões e por gestos.
- **SC-Q02**: Zero casos de pacote exportado sem trilha sem que o usuário tenha confirmado explicitamente.
- **SC-Q03**: O tempo entre disparar a foto e ver a trilha sugerida tem **mediana ≤ 6s** em 5 capturas consecutivas com rede estável, e **nenhuma** captura passa de 10s.

  > **Recalibrado em 2026-08-15** (D1, decisão do Sávio). O critério original pedia queda de 40%
  > sobre uma linha de base de 30–45s que **não se reproduz**: medida no mesmo aparelho e na
  > mesma rede, sem nenhuma linha de código alterada, a mediana foi de **6,02s** (ver
  > [baseline.md](./baseline.md) T003). Os 30–45s eram condição de ambiente, não do produto.
  > Perseguir −40% sobre 6,02s exigiria chegar a 3,6s, o que só se alcança trocando o modelo do
  > Gemini — alternativa que o [research.md](./research.md) R3 adiou por degradar a leitura de
  > cena, que é o diferencial do produto, e que o Sávio manteve descartada.
  > O critério agora fixa a **faixa real desejada** em vez de uma redução sobre número instável.
  > **Situação**: atingido — mediana de **5,47s** após a redução de payload do T021 (71 KB → 35 KB).
- **SC-Q04**: Em qualquer momento das esperas longas, o usuário consegue dizer se o app está progredindo ou parado.
- **SC-Q05**: Uma pessoa que nunca usou o app identifica corretamente que existem mais de quatro filtros, apenas olhando a tela.
- **SC-Q06**: Capturas de tela do app em dois fabricantes diferentes mostram ícones de controle idênticos.
- **SC-Q07**: O pacote exportado (imagem, trilha e vídeo de 30s) permanece idêntico em conteúdo ao validado no v1.

## Assumptions

Decisões tomadas para esta rodada, registradas para não travar a execução:

- **Bloqueio em vez de fila**: quando a curadoria está em andamento, a ação de postar fica **desabilitada com explicação**, em vez de enfileirar a intenção do usuário. É o comportamento menos surpreendente e o que melhor protege o Princípio I. Salvar continua liberado, porque a foto nunca pode ser perdida (RN "nunca perder a foto").
- **Emoji só como linguagem do produto**: ícones de **controle** (galeria, virar câmera, fechar, play/pause) migram para um conjunto vetorial consistente; emojis de **filtros e vibes** permanecem, pois ali são identidade e não interface.
- **Sem redesenho**: esta rodada não altera arquitetura de navegação, layout geral nem a proposta visual — apenas corrige e lapida o que existe.
- **Escopo Android**: as validações são feitas no aparelho Android disponível (Redmi Note 8 Pro, Android 10). As correções devem ser escritas de forma independente de aparelho, mas a evidência será coletada nele.
- **Sem EAS Build**: toda verificação usa o build local no dispositivo; a cota de nuvem está reservada para a publicação final.
- **Medição antes de otimizar**: a latência da curadoria é investigada com medição real antes de qualquer mudança, para não otimizar o trecho errado.

## Dependencies

- Fluxo v1 completo e funcional (feature `001-synesthesia-mvp`), incluindo a geração de `.mp4` via módulo nativo.
- Ambiente de build local Android com acesso ao dispositivo por `adb` para coletar evidências.
- Chave da API de curadoria configurada para medir a latência real do caminho principal.

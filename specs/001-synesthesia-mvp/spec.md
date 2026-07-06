# Feature Specification: Synesthesia — App de Câmera Multimodal

**Feature Branch**: `001-synesthesia-mvp`

**Created**: 2026-07-06

**Status**: Draft

**Input**: Documentos-fonte da Sprint 2 (SAVAC / JOVI Challenge FIAP 2026): "Software e Total Experience Design" (backlog US01–US11 + arquitetura) e "Computational Thinking with Python" (MVP terminal). Design: Figma `JOVI-Challenge---FIAP-2026`.

## User Scenarios & Testing *(mandatory)*

App mobile de câmera que traduz o contexto visual de uma cena em filtros e trilha sonora harmônicos, entregando um "pacote sensorial" (foto + filtro + trecho de música) pronto para compartilhar. As histórias abaixo derivam das User Stories US01–US11 do backlog e estão priorizadas como jornadas independentemente testáveis.

### User Story 1 - Capturar com filtro automático por contexto (Priority: P1)

Como criador de conteúdo, quero abrir a câmera e ver a estética (filtro) mudar automaticamente conforme o ambiente e a troca frontal/traseira, para capturar a "vibe" do momento sem configurar nada. (US02, US05)

**Why this priority**: É o núcleo do produto e o diferencial competitivo — sem a captura contextual em tempo real não há Synesthesia. Sozinha já entrega valor: uma câmera que "entende" a cena.

**Independent Test**: Abrir o visor, apontar para cenas distintas e virar a câmera; verificar que a "vibe" recalcula e o filtro correspondente é aplicado ao vivo, e que o disparo salva foto + filtro na galeria.

**Acceptance Scenarios**:

1. **Given** o visor aberto, **When** o ambiente da cena muda, **Then** o sistema recalcula a vibe e aplica um filtro coerente em tempo real.
2. **Given** o visor aberto, **When** o usuário alterna câmera frontal/traseira, **Then** a vibe e o filtro sugerido são recalculados.
3. **Given** uma cena enquadrada, **When** o usuário dispara a captura, **Then** imagem e filtro selecionado são salvos automaticamente na galeria.

---

### User Story 2 - Refinar filtro manualmente no visor (Priority: P1)

Como usuário, quero navegar pelo carrossel de filtros (Vivid, Neon, Love, Eclipse, Retro, Vintage, Arctic, Honey) e sobrepor um manualmente antes de capturar. (US03)

**Why this priority**: Complementa a US1 dando controle sobre a automação — requisito para o caminho de captura ser confiável e não frustrante.

**Independent Test**: Tocar em cada chip de filtro no visor e confirmar que a pré-visualização muda imediatamente e que o filtro escolhido permanece ativo até nova alteração ou recálculo.

**Acceptance Scenarios**:

1. **Given** o visor com filtro automático, **When** o usuário toca em outro filtro, **Then** ele é aplicado imediatamente e marcado como ativo.
2. **Given** um filtro manual ativo, **When** o usuário captura, **Then** o filtro manual é o que fica salvo.

---

### User Story 3 - Sugestão e sincronização de música na captura (Priority: P1)

Como usuário, quero que, ao capturar, o app me ofereça músicas compatíveis com a atmosfera da foto (até 4, via Gemini), para não perder tempo procurando trilha. (US04)

**Why this priority**: É a segunda metade da multimodalidade; sem som sugerido, o "pacote sensorial" não se forma. Junto de US1/US2 fecha o MVP demonstrável.

**Independent Test**: Capturar uma foto e verificar que o modal traz ≥1 música vinculada à vibe, com opção de escolher uma trilha ou seguir sem áudio.

**Acceptance Scenarios**:

1. **Given** uma foto recém-capturada, **When** o modal de captura abre, **Then** são exibidas até 4 sugestões musicais coerentes com a atmosfera.
2. **Given** as sugestões exibidas, **When** o usuário escolhe uma ou remove o áudio, **Then** a escolha é vinculada à mídia.

---

### User Story 4 - Editar janela sonora e trocar música (Priority: P2)

Como usuário, quero ajustar o trecho exato da música (0–30s) e trocar entre outras sugestões da "vibe sonora", para que o áudio combine com o momento. (US06, US08)

**Why this priority**: Refinamento sensorial — eleva a qualidade do resultado, mas o MVP já é utilizável sem ele.

**Independent Test**: No modal de captura/edição, arrastar o slider de trecho e confirmar limites 0–30s; abrir "Trocar música", escolher outra sugestão e confirmar que a mídia atualiza.

**Acceptance Scenarios**:

1. **Given** uma música vinculada, **When** o usuário ajusta o slider, **Then** o trecho fica entre 0 e 30s e é salvo junto à mídia.
2. **Given** o modal "Trocar música", **When** o usuário confirma outra trilha, **Then** a nova música substitui a anterior; **When** cancela, **Then** nada muda.
3. **Given** um filtro aplicado na edição, **When** o usuário troca o filtro pós-captura, **Then** a mudança aparece imediatamente e pode ser salva ou descartada.

---

### User Story 5 - Reproduzir prévia sonora (Priority: P2)

Como usuário, quero reproduzir o trecho da música escolhida antes de salvar, para aprovar a harmonia áudio+imagem. (US07)

**Why this priority**: Fecha o loop de validação da edição; depende de haver música vinculada (US3/US4).

**Independent Test**: Tocar play em uma sugestão, ouvir o trecho selecionado, confirmar identificação correta da faixa e conseguir interromper a qualquer momento.

**Acceptance Scenarios**:

1. **Given** uma música selecionada, **When** o usuário toca play, **Then** o trecho definido é reproduzido e a faixa é identificada.
2. **Given** reprodução em curso, **When** o usuário pausa, **Then** o áudio para imediatamente.

---

### User Story 6 - Permissões e privacidade (Priority: P1)

Como usuário, quero conceder acesso à câmera e à galeria com transparência e optar por compartilhar (ou não) metadados anônimos. (US01)

**Why this priority**: Bloqueia todo o resto — sem permissões não há câmera. Também é requisito de conformidade (LGPD).

**Independent Test**: Na primeira execução, ver a tela de permissões explicando o uso local; conceder e chegar ao visor; alternar o opt-in de metadados em Ajustes e confirmar persistência.

**Acceptance Scenarios**:

1. **Given** primeira abertura, **When** a tela de permissões aparece, **Then** ela explica câmera/galeria e o processamento local antes de pedir acesso.
2. **Given** a opção de metadados, **When** o usuário ativa/desativa, **Then** a escolha é salva e respeitada nas próximas sessões.

---

### User Story 7 - Galeria persistente e exclusão (Priority: P2)

Como usuário, quero que minhas mídias fiquem salvas para retomar edições depois e poder apagá-las para liberar espaço. (US09, US10)

**Why this priority**: Garante continuidade criativa; o MVP de captura funciona antes dela, mas o produto completo exige persistência.

**Independent Test**: Capturar mídias, fechar e reabrir o app e confirmar que permanecem; apagar uma mídia com confirmação e verificar remoção permanente.

**Acceptance Scenarios**:

1. **Given** mídias criadas, **When** o app é reaberto, **Then** todas permanecem disponíveis com suas edições.
2. **Given** uma mídia, **When** o usuário pede exclusão, **Then** o sistema confirma antes e, confirmado, remove permanentemente.

---

### User Story 8 - Exportar e compartilhar em redes sociais (Priority: P2)

Como usuário, quero gerar o vídeo final (imagem + áudio) e compartilhá-lo diretamente em Instagram, TikTok, WhatsApp, LinkedIn, X e outros. (US11)

**Why this priority**: É a entrega de valor final (o "postar"), mas depende de captura + edição estarem prontas.

**Independent Test**: A partir de uma mídia lapidada, acionar "Postar agora", ver a confirmação "Vídeo gerado!" com a grade de destinos e disparar o share intent nativo.

**Acceptance Scenarios**:

1. **Given** uma mídia finalizada, **When** o usuário escolhe compartilhar, **Then** o conteúdo mantém exatamente o visual e o som selecionados.
2. **Given** a exportação concluída, **When** o app confirma, **Then** exibe "Vídeo gerado!" e as opções de destino.

---

### User Story 9 - Ajustes do ecossistema (Priority: P3)

Como usuário, quero controlar filtro automático, detecção em tempo real, grade de composição, sugestão automática de música e fonte de áudio. 

**Why this priority**: Personalização; o app funciona com padrões sensatos sem que o usuário toque aqui.

**Independent Test**: Abrir Ajustes via "+ Opções", alternar cada toggle e confirmar que o comportamento correspondente muda e persiste.

**Acceptance Scenarios**:

1. **Given** Ajustes aberto, **When** o usuário desliga "Filtro automático", **Then** o visor deixa de aplicar filtro sem escolha manual.
2. **Given** os toggles, **When** alterados, **Then** as preferências persistem entre sessões.

---

### Edge Cases

- Cena ambígua / baixa luz onde a IA não identifica vibe clara → aplicar filtro neutro padrão e não travar o visor.
- Sem internet no momento da captura → filtro (on-device) segue funcionando; sugestão musical degrada graciosamente (cache/últimas sugestões ou aviso), sem bloquear salvar.
- Falha/limite da API musical (Gemini/Deezer/Last.fm) → permitir capturar e salvar sem áudio; nunca perder a foto.
- Permissão negada → estado explicativo com caminho para reabrir as configurações do sistema.
- Trecho de música ajustado além dos limites → travar em 0–30s.
- Exclusão acidental → exigir confirmação; ação é irreversível após confirmar.
- App fechado durante edição → intenção criativa preservada (auto-save do estado de edição).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST analisar o visor em tempo real e recalcular a "vibe" ao mudar a cena e ao alternar câmera frontal/traseira. (US02, RF)
- **FR-002**: O sistema MUST aplicar automaticamente um filtro coerente com a vibe detectada, ao vivo. (US02, RF)
- **FR-003**: O usuário MUST poder navegar e aplicar manualmente qualquer um dos 8 filtros no visor, permanecendo ativo até nova alteração. (US03, RF)
- **FR-004**: A captura MUST salvar imagem + filtro + música selecionada como uma unidade na galeria. (US05, RF/RN)
- **FR-005**: O sistema MUST sugerir até 4 músicas vinculadas à atmosfera visual e permitir escolher uma ou remover o áudio. (US04, RF)
- **FR-006**: O usuário MUST poder definir o trecho da música entre 0 e 30 segundos, salvo junto à mídia. (US06, RF/RN)
- **FR-007**: O usuário MUST poder trocar de música e de filtro após a captura, com preview imediato e opção de salvar ou descartar. (US06/US08, RF)
- **FR-008**: O sistema MUST reproduzir o trecho selecionado, identificar a faixa e permitir interromper a qualquer momento. (US07, RF)
- **FR-009**: O sistema MUST apresentar tela de permissões (câmera, galeria) com justificativa e informar processamento local antes do uso. (US01, RN/RNF)
- **FR-010**: O sistema MUST oferecer opt-in persistente e revogável de compartilhamento de metadados anônimos. (US01, RN)
- **FR-011**: O sistema MUST persistir localmente todas as mídias e edições, disponíveis entre sessões. (US09, RNF)
- **FR-012**: O sistema MUST exigir confirmação antes de excluir e remover permanentemente após confirmação. (US10, RF/RN)
- **FR-013**: O sistema MUST gerar o vídeo final unindo imagem e áudio (.mp4) preservando visual e som selecionados. (US11, RF)
- **FR-014**: O sistema MUST oferecer compartilhamento para redes sociais via share intent nativo e confirmar sucesso ("Vídeo gerado!"). (US11, RF)
- **FR-015**: O sistema MUST expor Ajustes para filtro automático, detecção em tempo real, grade de composição, sugestão automática de música e fonte de áudio, com preferências persistentes.

### Non-Functional / Business

- **NFR-001**: Processamento de imagem/IA MUST ocorrer on-device; o visor não pode bloquear aguardando rede.
- **NFR-002**: Filtros MUST ser aplicados com aceleração por GPU, mantendo fluidez do visor.
- **NFR-003**: Segredos (chaves de API) MUST viver em variáveis de ambiente, nunca no repositório.
- **NFR-004**: A UI MUST seguir os design tokens (ruby/amber/ink/parchment; Syne + DM Mono) e textos em pt-BR.
- **RN-001**: Nenhuma operação (salvar/editar/exportar/compartilhar) pode quebrar a unidade imagem↔filtro↔áudio aprovada pelo usuário.

### Key Entities

- **Mídia (Registro)**: unidade persistente — imagem, filtro aplicado, referência de música, trecho (início/fim ≤30s), timestamp, estado de edição.
- **Filtro**: identidade visual nomeada (Vivid, Neon, Love, Eclipse, Retro, Vintage, Arctic, Honey) com emoji e parâmetros de render.
- **Sugestão Musical**: faixa (título, artista, emoji/mood, justificativa), origem (Gemini/Deezer/Last.fm), preview.
- **Vibe / Contexto**: atmosfera detectada da cena que direciona filtro e curadoria musical.
- **Preferências**: toggles de Ajustes + opt-in de metadados, persistidos localmente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O caminho padrão de captura (abrir → disparar → salvar com filtro+som sugeridos) é concluído em ≤ 2 toques além do disparo.
- **SC-002**: Ao alternar frontal/traseira ou mudar de cena, a vibe/filtro atualiza em tempo real sem congelar o visor.
- **SC-003**: Toda captura resulta em uma mídia persistida que sobrevive ao fechamento do app em 100% dos casos.
- **SC-004**: O sistema oferece ≥1 sugestão musical coerente na captura sempre que a rede permitir, e permite salvar sem áudio quando não permitir (0% de perda de foto).
- **SC-005**: O trecho de música respeita o limite de 0–30s em 100% dos ajustes.
- **SC-006**: Compartilhar preserva exatamente o filtro e o áudio aprovados (fidelidade do pacote sensorial).

## Assumptions

- App mobile (iOS/Android) via Expo; web está fora de escopo.
- Nesta fase, "vídeo gerado" combina imagem estática + trilha (imagem animada/still + áudio), coerente com o MVP terminal que originou o produto.
- Curadoria musical depende de APIs externas (Gemini/Deezer/Last.fm) com chaves fornecidas por ambiente; degradação graciosa quando indisponíveis.
- A galeria é local (AsyncStorage + media library); sincronização em nuvem está fora de escopo do MVP.
- Público-alvo: estudantes/geração jovem, uso majoritariamente em pt-BR.

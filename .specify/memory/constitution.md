# Synesthesia Constitution

Princípios inegociáveis do app Synesthesia (JOVI Challenge — FIAP 2026, equipe SAVAC). Esta constituição prevalece sobre preferências pontuais; toda feature, PR e revisão deve verificar conformidade.

## Core Principles

### I. Multimodalidade Primeiro
Imagem e som nunca são tratados como elementos isolados: toda captura produz um **pacote sensorial** único (foto + filtro + trecho de música). Nenhuma funcionalidade pode quebrar essa unidade — salvar, editar, exportar e compartilhar sempre preservam o vínculo imagem↔áudio↔filtro exatamente como o usuário aprovou.

### II. Redução do Atrito de Decisão
O sistema decide por padrão, o usuário refina por escolha. Filtros e músicas são **sugeridos automaticamente** com base no contexto; o caminho de captura padrão não deve exigir mais de um toque além do disparo. Toda tela de refinamento (edição, troca de música) é opcional e reversível, com Cancelar/Descartar sempre disponível.

### III. Contexto em Tempo Real
A "vibe" do visor é recalculada continuamente e ao alternar câmera frontal/traseira, refletindo na estética ao vivo. A percepção de latência é um bug: preferir processamento **on-device** (ML Kit, Skia/GPU) e nunca bloquear o visor esperando rede. Chamadas externas (curadoria musical) acontecem fora do caminho crítico do frame.

### IV. Privacidade e Transparência (LGPD)
Processamento de imagem é local por padrão; o texto de UI deve deixar isso explícito ("tudo processado no seu celular"). Permissões (câmera, galeria) são pedidas com justificativa clara antes do uso. Compartilhamento de metadados anônimos é **opt-in**, persistido e revogável. Nenhuma chave de API ou dado pessoal é commitado no repositório.

### V. Persistência da Intenção Criativa
Cada mídia é uma unidade editável e permanente. Edições nunca se perdem: a galeria persiste localmente e alterações são salvas automaticamente. Exclusão é permanente mas exige confirmação explícita. O usuário pode sempre retomar e finalizar uma edição depois.

### VI. Fidelidade à Identidade Visual
A UI segue os design tokens definidos (ruby `#8D1514`, amber `#F8A20D`, ink `#090506`, parchment `#F5EEDE`; Syne para display, DM Mono para labels técnicas). Código gerado a partir do Figma é **convertido** para React Native `StyleSheet` — sem introduzir Tailwind ou desviar dos tokens sem justificativa registrada.

## Restrições Técnicas

- Plataforma: **Expo + React Native + TypeScript**, navegação com `expo-router`.
- Stack fixada pelo documento de arquitetura (ver `CLAUDE.md`): Vision Camera, Skia+Reanimated, ML Kit, Zustand+AsyncStorage, Gemini+Deezer+Last.fm, expo-av, ffmpeg-kit, expo-media-library, expo-sharing.
- Segredos apenas em variáveis de ambiente; `.env` fora do controle de versão.
- Textos de produto e commits em **pt-BR**.

## Fluxo de Desenvolvimento

- O trabalho é guiado por **Spec Kit**: `constitution → specify → plan → tasks → implement`.
- Cada User Story (US01–US11) é uma fatia independentemente testável; P1 deve entregar um MVP viável sozinho.
- Nenhuma feature entra sem estar rastreável a uma US e a um requisito (RF/RNF/RN) do documento-fonte.

## Governança

Esta constituição supera práticas informais. Emendas exigem: descrição da mudança, justificativa e atualização de versão. Toda revisão de código verifica os seis princípios acima; complexidade adicional deve ser justificada por escrito.

**Version**: 1.0.0 | **Ratified**: 2026-07-06 | **Last Amended**: 2026-07-06

# CLAUDE.md — Synesthesia

Guia para agentes de código (Claude Code) trabalharem neste repositório. Leia isto antes de gerar ou alterar código.

## O que é o Synesthesia

App mobile de câmera **multimodal e contextual** para o **JOVI Challenge — FIAP 2026** (equipe SAVAC). Ele traduz automaticamente o *contexto visual* de uma foto em **filtros** e **trilha sonora** harmônicos, reduzindo o "atrito de decisão" na criação de conteúdo para redes sociais. Público-alvo: estudantes em tempo integral / geração jovem.

Três pilares:
1. **Inteligência Contextual e Adaptativa** — a "vibe" do visor é recalculada em tempo real (inclusive ao virar a câmera frontal/traseira) e o filtro correspondente é aplicado ao vivo.
2. **Fusão entre Atmosfera e Som** — imagem + música formam um único "pacote sensorial"; ao capturar, o sistema sugere trilhas coerentes com a atmosfera.
3. **Ciclo de Vida da Mídia e Memória Persistente** — cada registro é editável e permanente; galeria inteligente permite revisitar, lapidar e exportar.

> A entrega de Python (Sprint 2 — Computational Thinking) foi um **MVP funcional em terminal** (menus numéricos, dados em `filtros.json`/`musicas.json`/`galeria.json`). **Este repositório é a evolução mobile** dessa prova de conceito em React Native/Expo. Os dois `.md` na raiz (`Sprint 2 - ...`) são os documentos-fonte de requisitos e arquitetura — consulte-os como fonte de verdade do produto.

## Stack técnica (definida no doc de arquitetura)

| Camada | Tecnologias |
|---|---|
| **App / navegação** | Expo, `expo-router`, TypeScript |
| **Câmera** | `react-native-vision-camera` (frames contínuos, baixa latência) |
| **Estado / persistência** | `zustand`, `@react-native-async-storage/async-storage` |
| **IA visual (on-device)** | `react-native-mlkit-image-labeling` (detecta objetos/ambiente → "vibe") |
| **Curadoria musical** | `@google/generative-ai` (Gemini), **Deezer API**, **Last.fm API** (até 4 sugestões por mood) |
| **Filtros / render** | `react-native-skia`, `react-native-reanimated` (GPU, tempo real) |
| **Edição** | `@gorhom/bottom-sheet`, `@react-native-community/slider`, `expo-av` |
| **Geração de vídeo** | `ffmpeg-kit-react-native` (une imagem + áudio → `.mp4`) |
| **Saída** | `expo-media-library` (salvar), `expo-sharing` (share intent nativo) |

Regras de stack:
- **Não** adicione Tailwind. O design gerado pelo Figma vem em React+Tailwind — **converta** para `StyleSheet` do React Native usando os tokens abaixo.
- Preferir processamento **on-device** (o ML Kit não exige internet); só a curadoria musical usa APIs externas.
- Chaves de API (Gemini/Last.fm) vivem em variáveis de ambiente, nunca commitadas.

## Identidade visual (design tokens)

Fonte da verdade: Figma `JOVI-Challenge---FIAP-2026` + `kite_camera_style_guide.html`.

**Cores**
| Token | Hex | Uso |
|---|---|---|
| `ruby` | `#8D1514` | Primária — CTAs, toggles ativos, badges |
| `amber` | `#F8A20D` | Acento — música, foco, valores mono destacados |
| `ink` | `#090506` | Fundo base (quase preto) |
| `parchment` | `#F5EEDE` | Texto/ícones sobre fundo escuro |
| `parchment/25` | `rgba(245,238,222,0.25)` | Home bar, divisores |

Fundo da câmera: gradiente `linear-gradient(180deg, rgba(141,21,20,0.5) 0%, rgba(39,6,6,0.25) 100%)` sobre `#090506`.
Modais claros (permissões, compartilhar, música): superfície `parchment` com texto `ink`.

**Tipografia**
- **Syne** (700) — títulos/display (ex.: "Ajustes.").
- **DM Mono** (400 Light / 500 Medium) — labels técnicas, status bar, seções, metadados, chips de filtro.

**Raios/medidas** — chips de filtro `border-radius: 15px`; cards/modais `~10–16px`; botão de captura círculo 70px; frame de foto aspecto ~735/913.

**8 filtros (nome + emoji):** Vivid 🌟 · Neon 🌈 · Love ❤️ · Eclipse 🌒 · Retro 📼 · Vintage 🧡 · Arctic ❄️ · Honey 🍯.

## Telas e modais (do Figma)

1. **Permissões** — onboarding: pede câmera 📸 e galeria 🏞️; "Permitir tudo". Enfatiza processamento local.
2. **Câmera** — visor com filtro ao vivo, carrossel de 8 filtros, galeria / captura / flip, "+ Opções" (→ Ajustes).
3. **Modal Captura** (bottom-sheet) — foto capturada, filtro usado, carrossel de previews, player de música (slider 0–30s com trecho), "Trocar música", ações **Salvar** / **Postar agora**.
4. **Modal Trocar Música** (bottom-sheet claro) — "Escolha a vibe sonora", 3–4 sugestões do Gemini (emoji + título + artista + justificativa + play), Cancelar / Confirmar escolha.
5. **Confirmação de Postagem** — "Vídeo gerado!", grade de destinos (Instagram, TikTok, WhatsApp, LinkedIn, X/Twitter, Mais), Fechar.
6. **Ajustes** — seções CÂMERA (Filtro automático, Detecção em tempo real / ML Kit, Grade de composição) e MÚSICA (Sugestão automática / Gemini, Fonte do áudio: DEEZER); toggles ruby.

## Fluxo de spec-kit

Este repo usa **Spec Kit**. Artefatos e ordem:
- `.specify/memory/constitution.md` — princípios inegociáveis do projeto.
- `specs/001-synesthesia-mvp/spec.md` — especificação (User Stories US01–US11 → priorizadas).
- `specs/001-synesthesia-mvp/plan.md` — plano técnico (gerar via `/speckit-plan`).
- Skills disponíveis: `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`, `/speckit-clarify`, `/speckit-analyze`, `/speckit-checklist`, `/speckit-converge`.

Ao implementar uma feature, siga a spec e o plano correspondentes; a constitution prevalece sobre preferências pontuais.

## Convenções de código

- TypeScript estrito; componentes funcionais + hooks.
- Navegação por arquivos com `expo-router` (`app/`).
- Estado global em `zustand` stores (`src/stores/`); nada de estado sensorial (vibe/mídia em edição) espalhado em componentes.
- Textos de UI em **pt-BR** (o produto é pt-BR).
- Commits em pt-BR, no imperativo. Não commitar `.env`, chaves, nem `node_modules`.

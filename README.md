<div align="center">

# 🎨 Synesthesia — App

### Uma nova forma de ver o mundo através da câmera

[![FIAP](https://img.shields.io/badge/FIAP-Challenge_2026-ED1C24?style=for-the-badge)](https://www.fiap.com.br)
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

## 📖 Sobre

**Synesthesia** é o app mobile da equipe **SAVAC** para o **JOVI Challenge — FIAP 2026**. Ele redefine a câmera do smartphone como uma experiência **multimodal e contextual**: traduz automaticamente o contexto visual de uma cena em **filtros** e **trilha sonora** harmônicos, entregando um "pacote sensorial" (foto + filtro + música) pronto para compartilhar — com o mínimo de atrito de decisão.

Este repositório é a evolução **mobile (Expo / React Native)** do MVP funcional em terminal entregue na disciplina de Python. Os documentos-fonte de requisitos e arquitetura estão em [`docs/`](docs/).

## ✨ Pilares

1. **Inteligência Contextual e Adaptativa** — a "vibe" do visor é recalculada em tempo real (inclusive ao virar a câmera) e o filtro é aplicado ao vivo.
2. **Fusão entre Atmosfera e Som** — imagem e música formam um único pacote sensorial no momento da captura.
3. **Ciclo de Vida da Mídia** — galeria inteligente que preserva a intenção criativa: revisite, lapide e exporte.

## 🚀 Como rodar (Expo Go)

Pré-requisitos: Node 20+, celular com o app **Expo Go** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)) na mesma rede Wi-Fi do computador.

```bash
npm install
npx expo start
```

Escaneie o QR code exibido no terminal: no **Android**, pelo próprio app Expo Go; no **iOS**, pela câmera do sistema. Se a rede bloquear a conexão local (Wi-Fi corporativo/universidade), use `npx expo start --tunnel`.

Chaves de API são **opcionais** (o Deezer não exige chave): copie `.env.example` para `.env` para habilitar a curadoria via Gemini.

### ⚠️ Adaptações para Expo Go

O Expo Go não carrega módulos nativos fora do SDK. Para validação imediata no celular, esta versão substitui parte da stack final por equivalentes compatíveis, mantendo os contratos da arquitetura:

| Arquitetura final | Nesta versão (Expo Go) |
|---|---|
| `react-native-vision-camera` | `expo-camera` |
| ML Kit (rotulagem de cena on-device) | Vibe simulada on-device (`src/services/vibeEngine.ts`) — mesmo contrato `detectVibe() → Vibe` |
| Skia (shaders GPU) | Overlays + style `filter` do RN (GPU) |
| `ffmpeg-kit` (vídeo .mp4 imagem+áudio) | Compartilha a imagem renderizada com filtro (`react-native-view-shot`) |
| `expo-av` | `expo-audio` (sucessor oficial) |

## 🛠️ Stack

`Expo` · `expo-router` · `TypeScript` · `react-native-vision-camera` · `react-native-skia` · `react-native-reanimated` · `react-native-mlkit-image-labeling` · `zustand` · `async-storage` · `@google/generative-ai` (Gemini) · `Deezer` · `Last.fm` · `expo-av` · `@gorhom/bottom-sheet` · `ffmpeg-kit-react-native` · `expo-media-library` · `expo-sharing`

## 🎨 Identidade visual

| Token | Hex | Uso |
|---|---|---|
| Ruby | `#8D1514` | Primária / CTAs |
| Amber | `#F8A20D` | Acento / música |
| Ink | `#090506` | Fundo |
| Parchment | `#F5EEDE` | Texto claro |

Tipografia: **Syne** (display) + **DM Mono** (labels técnicas). Filtros: Vivid 🌟 · Neon 🌈 · Love ❤️ · Eclipse 🌒 · Retro 📼 · Vintage 🧡 · Arctic ❄️ · Honey 🍯.

## 🗂️ Estrutura

```
.
├── app/                          # Rotas (expo-router): permissões, câmera, galeria, ajustes
├── src/
│   ├── components/               # CaptureSheet, MusicSheet, PostSheet, FilterCarousel, player...
│   ├── constants/                # 8 filtros + vibes
│   ├── services/                 # vibeEngine (contexto), music (Gemini/Deezer), mediaStorage
│   ├── stores/                   # zustand: ajustes, galeria, sessão de captura
│   └── theme/                    # Design tokens (ruby/amber/ink/parchment, Syne + DM Mono)
├── CLAUDE.md                     # Guia para agentes de código
├── docs/                         # Documentos-fonte (requisitos + arquitetura)
├── specs/001-synesthesia-mvp/    # Especificação (Spec Kit)
└── .specify/                     # Constituição, templates e workflow do Spec Kit
```

## 🚀 Desenvolvimento (Spec Kit)

O projeto é guiado por **[Spec Kit](https://github.com/github/spec-kit)**:

```
/speckit-constitution   → princípios do projeto (.specify/memory/constitution.md)
/speckit-specify        → especificação (specs/001-synesthesia-mvp/spec.md)
/speckit-plan           → plano técnico de implementação
/speckit-tasks          → tarefas acionáveis
/speckit-implement      → execução
```

## 👥 Equipe SAVAC

Ana Beatriz Da Cruz Silva (RM572278) · Arthur Carvalho Gomes Da Costa (RM570387) · Carolina Kiyomi Hada (RM571664) · Sávio Pessôa Afonso (RM570789) · Victor Paes Pontes (RM572781)

---

<div align="center">
Desenvolvido pela equipe <b>SAVAC</b> para o <b>JOVI Challenge — FIAP 2026</b>
</div>

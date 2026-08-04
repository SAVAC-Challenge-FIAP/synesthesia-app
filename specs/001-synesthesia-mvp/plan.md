# Implementation Plan: Synesthesia — App de Câmera Multimodal

**Branch**: `001-synesthesia-mvp` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification em `specs/001-synesthesia-mvp/spec.md`

## Summary

App mobile de câmera que traduz o contexto visual de uma cena em filtro + trilha sonora harmônicos, entregando um "pacote sensorial" (foto + filtro + trecho de música) pronto para compartilhar. O MVP já está implementado e roda em **Expo Go**; este plano documenta a arquitetura real construída, o mapeamento entre a **stack-alvo** (arquitetura definitiva) e os **fallbacks Expo Go** atualmente em uso, e as frentes de trabalho ainda abertas — com destaque para a geração real de vídeo (imagem+áudio) e a ativação da curadoria via Gemini.

## Technical Context

**Language/Version**: TypeScript (estrito), React 19.1.0, React Native 0.81.5

**Primary Dependencies**: Expo SDK **54** (`expo@~54.0.35`), `expo-router`, `zustand` + `@react-native-async-storage/async-storage`, `expo-camera`, `expo-audio`, `react-native-view-shot`, `expo-sharing`, `expo-media-library`

**Storage**: Local — AsyncStorage (preferências, índice da galeria) + arquivos em `documentDirectory` (fotos persistidas)

**Testing**: `npx tsc --noEmit` (typecheck), `npx expo-doctor` (18/18), `npx expo export` (bundle). Validação funcional manual no dispositivo via Expo Go.

**Target Platform**: Android/iOS via Expo Go (dev); development build / EAS para a stack nativa final. Web fora de escopo.

**Project Type**: Mobile app (Expo/React Native, single-project)

**Performance Goals**: Visor fluido (sem congelar ao recalcular vibe / trocar câmera); curadoria musical fora do caminho crítico do frame (NFR-001/002, Constituição III).

**Constraints**: On-device primeiro; nunca bloquear o visor esperando rede; nunca perder a foto; segredos só em variáveis de ambiente; textos em pt-BR.

**Scale/Scope**: 4 telas (`app/index`, `camera`, `gallery`, `settings`) + 3 modais (Captura, Trocar Música, Postagem); 8 filtros; 8 vibes; 11 User Stories (US01–US11).

## Constitution Check

*GATE: reavaliado contra `.specify/memory/constitution.md` v1.0.0.*

| Princípio | Situação | Observação |
|---|---|---|
| I. Multimodalidade Primeiro | ⚠️ **Parcial (mitigado)** | A unidade foto+filtro+música é preservada em salvar/editar. **Decisão T-01a (2026-07-09):** no Expo Go o compartilhamento sai como **pacote composto** — imagem + arquivo de áudio da prévia (30s, Deezer) + legenda com trilha e trecho (`src/services/sharePackage.ts`); a UI do PostSheet declara o que vai. O `.mp4` único (desejo final do produto) é **impossível no Expo Go** (FFmpeg é módulo nativo) e entra na T-07 preenchendo o campo `videoUri` do mesmo contrato. |
| II. Redução do Atrito | ✅ | Captura padrão sugere filtro (vibe) e música automaticamente; refinamentos são opcionais/reversíveis. |
| III. Contexto em Tempo Real | ⚠️ **Simulado** | Vibe recalcula ao vivo e no flip, mas via `vibeEngine` simulado (hora + câmera + timer 8s), não ML Kit sobre frames reais (ver T-05). |
| IV. Privacidade/LGPD | ✅ | Onboarding explica processamento local; permissão mínima (`photo`); opt-in de metadados persistente; sem chaves commitadas. |
| V. Persistência da Intenção | ✅ | Galeria local persiste; edição reabre; exclusão exige confirmação. |
| VI. Identidade Visual | ✅ | `StyleSheet` com tokens ruby/amber/ink/parchment; Syne + DM Mono; sem Tailwind. |

**Veredito**: MVP demonstrável e conforme, com **duas violações rastreadas** (I e III) decorrentes das limitações do Expo Go, registradas em Complexity Tracking e endereçadas nas tasks.

## Project Structure

### Documentation (this feature)

```text
specs/001-synesthesia-mvp/
├── spec.md              # Especificação (US01–US11, FR/NFR/RN)
├── plan.md              # Este arquivo
└── tasks.md             # Backlog de tasks (dependency-ordered)
```

### Source Code (repository root)

```text
app/                      # Rotas (expo-router)
├── index.tsx             # Permissões / onboarding (US06)
├── camera.tsx            # Visor: vibe ao vivo, carrossel, flip, grade (US01/US02)
├── gallery.tsx           # Galeria persistente: grid, reabrir, excluir (US07)
└── settings.tsx          # Ajustes: toggles persistentes (US09)

src/
├── components/
│   ├── CaptureSheet.tsx  # Modal de captura: pacote sensorial em edição (US03/04/05)
│   ├── MusicSheet.tsx    # Trocar música (US04)
│   ├── PostSheet.tsx     # Confirmação de postagem + share (US08)
│   ├── FilterCarousel.tsx
│   ├── FilteredImage.tsx # Aplica o filtro (overlay + filter do RN)
│   └── MusicPlayer.tsx   # Prévia 0–30s (expo-audio)
├── services/
│   ├── vibeEngine.ts     # Detecção de vibe (SIMULADA — fallback do ML Kit)
│   ├── music.ts          # Curadoria: Gemini → Deezer → catálogo local
│   ├── mediaStorage.ts   # Cópia permanente da foto
│   └── systemGallery.ts  # Wrapper best-effort do expo-media-library
├── stores/               # zustand + persist (captura, galeria, ajustes)
├── constants/            # filtros, vibes
├── theme/                # tokens (cores, fontes, raios, medidas)
└── types/                # Media, Filtro, Vibe, MusicSuggestion...
```

**Structure Decision**: Single-project Expo/RN com `expo-router` (rotas em `app/`) e lógica não-visual isolada em `src/services` + `src/stores`. Estado sensorial (vibe/mídia em edição) vive só nas stores zustand — nenhum componente guarda estado sensorial próprio (regra do CLAUDE.md).

## Stack-alvo × Fallback Expo Go

Cada linha mantém o **contrato** da arquitetura; a troca é só de implementação. Trocar para o development build = substituir a implementação sem mexer no resto do app.

| Capacidade | Stack-alvo (arquitetura) | Hoje (Expo Go) | Onde |
|---|---|---|---|
| Câmera | `react-native-vision-camera` | `expo-camera` | `app/camera.tsx` |
| Detecção de vibe | ML Kit (frames reais) | **Simulada** (hora + câmera + timer) | `src/services/vibeEngine.ts` |
| Render de filtro | Skia + Reanimated (GPU) | Overlay + `filter` do RN | `src/components/FilteredImage.tsx` |
| Curadoria musical | **Gemini** + Deezer + Last.fm | Deezer (ativo) + Gemini (opcional, off) + catálogo local | `src/services/music.ts` |
| Áudio/prévia | `expo-av` | `expo-audio` | `src/components/MusicPlayer.tsx` |
| Vídeo final | `ffmpeg-kit` (imagem+áudio → `.mp4`) | **Pacote composto** — imagem + áudio 30s + legenda via `exportPackage()`; T-07 preenche `videoUri` no mesmo contrato | `src/services/sharePackage.ts`, `src/components/PostSheet.tsx` |
| Saída/galeria | `expo-media-library` | idem, best-effort (limitado no Expo Go) | `src/services/systemGallery.ts` |
| Share | `expo-sharing` | `expo-sharing` (mesmo) | `src/components/PostSheet.tsx` |

## Complexity Tracking

> Violações da constituição decorrentes das limitações do Expo Go, aceitas temporariamente.

| Violação | Por que necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| Vibe simulada (fere III) | ML Kit exige módulo nativo → development build; Expo Go não carrega | Rodar sem detecção deixaria o visor sem o diferencial "contextual"; a simulação preserva a UX e o contrato `detectVibe()` |
| Sem `.mp4` único no share (fere I parcialmente) | FFmpeg exige módulo nativo → development build (T-07). **Decisão T-01a:** até lá, o pacote sai composto (imagem + áudio 30s + legenda) com UI honesta — a trilha aprovada *sai* do aparelho junto com a imagem, só não no mesmo arquivo | (a) montar `.mp4` sem FFmpeg no Expo Go: inviável, não há muxer JS/Expo; (c) compartilhar só a imagem com aviso: descartada por ferir mais o Princípio I quando dá para levar o áudio junto |

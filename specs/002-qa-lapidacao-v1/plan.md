# Implementation Plan: QA e Lapidação do MVP v1

**Feature**: `002-qa-lapidacao-v1` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-qa-lapidacao-v1/spec.md`

## Summary

Rodada de lapidação sobre um fluxo já funcional. Seis frentes, priorizadas por **dano ao usuário**, não por esforço:

1. **P1 — Alcance de toque**: controles primários invadem a área da barra de navegação do sistema. Corrigido com insets reais do dispositivo em vez de espaçamento fixo.
2. **P1 — Integridade do pacote**: a postagem é acionável durante a curadoria e produz pacote sem trilha sem avisar. Corrigido bloqueando a ação enquanto a trilha carrega e exigindo confirmação explícita quando não houver música.
3. **P2 — Latência da curadoria**: 30–45s até a trilha. **Medir antes de otimizar** — a suspeita inicial (buscas do Deezer serializadas) foi *descartada por inspeção*: `resolveWithDeezer` já usa `Promise.all`. O tempo está no encadeamento `foto → base64 → Gemini`.
4. **P2 — Descoberta dos filtros**: 8 filtros, 3 visíveis, 4º cortado ao meio.
5. **P3 — Identidade visual**: ícones de controle em emoji renderizam diferente por fabricante.
6. **P3 — Progresso da exportação**: o Transformer expõe progresso real que hoje é ignorado.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) + Kotlin (módulo nativo), React Native 0.81.5 / Expo SDK 54

**Primary Dependencies**: `expo-router`, `zustand`, `expo-camera`, `expo-image-manipulator`, `@google/generative-ai` (Gemini), Deezer (API pública), `androidx.media3:media3-transformer` 1.11.0

**Storage**: `AsyncStorage` (galeria e ajustes), cache de arquivos do app para mídia intermediária

**Testing**: `npm run typecheck` (tsc --noEmit) + **verificação manual em dispositivo real** com evidência em captura de tela. Não há suíte automatizada de UI no projeto; a evidência visual é o critério de aceite.

**Target Platform**: Android (validação em Redmi Note 8 Pro, Android 10 / SDK 29). Código deve ser independente de aparelho.

**Project Type**: Aplicativo mobile (Expo + React Native), com um módulo nativo local.

**Performance Goals**:
- Tempo até a trilha: redução ≥ 40% sobre a linha de base de 30–45s (SC-Q03)
- Preview da câmera: sem queda perceptível de fluidez com filtro ativo
- Troca de filtro: sem atraso perceptível

**Constraints**:
- **Proibido EAS Build** — cota reservada para a publicação final. Toda verificação usa build local (`./scripts/dev-android.sh`).
- Sem Tailwind; apenas `StyleSheet` com os design tokens de `src/theme`.
- Textos de UI e commits em pt-BR.
- Não alterar o conteúdo do pacote exportado já validado no v1 (FR-Q16).

**Scale/Scope**: ~6 telas/modais, 8 filtros, 1 módulo nativo. Mudanças concentradas em 5–7 arquivos de UI + 1 arquivo de serviço + 1 arquivo Kotlin.

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado após o desenho.*

| Princípio | Situação atual | Efeito desta feature |
|---|---|---|
| **I. Multimodalidade Primeiro** | ❌ **Violado hoje**: pacote sai sem trilha sem aviso quando a postagem é acionada durante a curadoria | ✅ Restaura — bloqueio + confirmação explícita (US2) |
| **II. Redução do Atrito de Decisão** | ❌ **Violado hoje**: botão primário não responde ao toque na metade inferior | ✅ Restaura (US1); reduz espera (US3) |
| **III. Contexto em Tempo Real** | ⚠️ Parcial: "percepção de latência é um bug", e há 30–45s de espera com feedback estático | ✅ Melhora — mede, reduz e comunica progresso (US3, US6) |
| **IV. Privacidade e Transparência** | ✅ Conforme | ↔️ Inalterado — nenhuma mudança em coleta ou envio de dados |
| **V. Persistência da Intenção Criativa** | ✅ Conforme | ✅ Reforça — "Salvar" permanece sempre disponível (FR-Q06) |
| **VI. Fidelidade à Identidade Visual** | ⚠️ Parcial: ícones em emoji variam por fabricante | ✅ Restaura (US5) |

**Resultado do gate**: ✅ **Aprovado sem violações**. Esta feature é inteiramente corretiva — ela move três princípios de violado/parcial para conforme e não introduz nenhuma exceção que precise de justificativa. A seção *Complexity Tracking* fica vazia por isso.

## Project Structure

### Documentation (this feature)

```text
specs/002-qa-lapidacao-v1/
├── plan.md              # Este arquivo
├── spec.md              # Especificação
├── research.md          # Fase 0 — medições e decisões técnicas
├── data-model.md        # Fase 1 — máquina de estados da curadoria
├── quickstart.md        # Fase 1 — como validar cada correção no device
├── contracts/
│   └── video-muxer.md   # Contrato do módulo nativo (progresso da exportação)
└── tasks.md             # Fase 2 — gerado por /speckit-tasks
```

### Source Code (repository root)

```text
app/
└── camera.tsx                     # US1 (insets), US4 (carrossel no visor), US6 (perf)

src/
├── components/
│   ├── CaptureSheet.tsx           # US1 (insets), US2 (bloqueio da postagem), US6
│   ├── PostSheet.tsx              # US1, US2 (texto do resultado), US6 (progresso)
│   ├── MusicSheet.tsx             # US1, US5
│   ├── FilterCarousel.tsx         # US4 (affordance), US5
│   └── ...                        # demais componentes: US5 (ícones)
├── services/
│   ├── music.ts                   # US3 (medição e redução da latência)
│   └── sharePackage.ts            # US2 (contrato do pacote sem trilha)
└── theme/                         # US5 (tokens dos ícones)

modules/video-muxer/
├── android/src/main/.../VideoMuxerModule.kt   # US6 (evento de progresso)
└── src/VideoMuxerModule.ts                    # US6 (tipos do progresso)

scripts/dev-android.sh             # Ferramenta de verificação (build/log/shot/video)
```

**Structure Decision**: Mantida a estrutura existente do app Expo Router. Esta é uma feature corretiva — **nenhum arquivo novo de arquitetura**, nenhuma pasta nova, nenhum realinhamento de módulos. As mudanças são localizadas nos componentes que apresentam os defeitos, no serviço de curadoria e no módulo nativo.

## Phase 0 — Research

Consolidado em [research.md](./research.md). Resumo das decisões:

- **Insets**: usar `react-native-safe-area-context` (já presente na árvore do Expo/expo-router) em vez de `SafeAreaView` do RN core, que não cobre a barra de navegação no Android.
- **Latência**: instrumentar as três etapas separadamente antes de mexer. A paralelização do Deezer **já existe** — otimizar ali seria trabalho perdido.
- **Progresso do Transformer**: o Media3 expõe progresso por polling (`getProgress` + `ProgressHolder`); precisa de um evento do módulo nativo para o JS.
- **Ícones**: `@expo/vector-icons` já vem no Expo — sem dependência nova.

## Phase 1 — Design

- [data-model.md](./data-model.md) — estados da curadoria e do pacote, e as transições que a US2 precisa tornar explícitas.
- [contracts/video-muxer.md](./contracts/video-muxer.md) — contrato do módulo nativo com o evento de progresso.
- [quickstart.md](./quickstart.md) — roteiro de validação de cada correção no dispositivo, com os comandos exatos.

## Complexity Tracking

*Vazio — o Constitution Check passou sem violações. Esta feature remove complexidade acidental (comportamento silencioso, espaçamento fixo, feedback estático) sem adicionar nenhuma.*

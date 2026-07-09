# Tasks: Synesthesia — App de Câmera Multimodal

**Feature**: `001-synesthesia-mvp` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Última atualização**: 2026-07-09

Backlog dependency-ordered do que **falta** para o MVP estar completo e fiel à spec. As telas e fluxos base (US01–US11) já estão implementados e rodando no Expo Go (ver `docs/STATUS.md`); estas tasks cobrem os **gaps reais** e os endurecimentos pendentes. `[P]` = paralelizável com a task anterior.

Legenda de status: ⬜ pendente · 🟡 em andamento · ✅ concluída

---

## 🔥 Fase 0 — vibe dinâmica sem aleatoriedade + modo sem filtro

> **Prioridade máxima definida pelo Sávio (2026-07-09).** A maior dor é a **aleatoriedade na escolha da vibe**. O objetivo desta fase é deixar o fluxo **dinâmico e determinístico** — a sugestão tem que refletir a foto real, não a hora do dia + um timer.

### ✅ T-0A — Eliminar a aleatoriedade da vibe  · P1 · US01/US02 / FR-001, FR-002 · Princípio III — IMPLEMENTADA (2026-07-09)

Implementada pela direção recomendada: **Gemini multimodal** (confirmado que `gemini-3.1-flash-lite` aceita imagem — inputs Text/Image/Video/Audio/PDF).
- ✅ `analyzePhotoAndSuggest()` em `src/services/music.ts`: foto reduzida (~640px, `expo-image-manipulator`) + prompt numa só chamada à Interactions API → Gemini devolve `{vibe, cena, musicas[4]}`; Deezer resolve os previews. Degradação: análise falhou → pipeline por vibe heurística → Deezer → catálogo local.
- ✅ `sceneSeed` e timer de 8s removidos de `vibeEngine.ts`/`camera.tsx`; `detectVibe({facing})` é prévia determinística (badge "VIBE · PRÉVIA").
- ✅ `CaptureSheet` aplica a vibe real na sessão; filtro acompanha a vibe real enquanto `filtroAuto` (não houve escolha manual).
- ✅ LGPD: envio da foto é opt-in via toggle "Leitura da cena (IA)" (ex-`deteccaoTempoReal`); nota de privacidade dos Ajustes reescrita.
- ✅ **Validado no dispositivo (2026-07-09)** — duas cenas reais e distintas (bilhete/mural com corações → "romantica"; futebol na TV → "energetica") produziram vibes diferentes e coerentes com o conteúdo, enquanto a prévia do visor ficou fixa (prova de que a vibe veio da foto, não do timer). Ver `docs/STATUS.md`.

### ✅ T-0B — Modo "sem filtro" (foto normal) com música pelo Gemini  · P1 · US03/US04 — IMPLEMENTADA (2026-07-09)

- ✅ `filtroId: FilterId | null` em `Media`/sessão/componentes; chip **"Original 📷"** como primeiro item do `FilterCarousel` (visor e modal de captura).
- ✅ Sugestão musical independe do filtro: vem da análise da própria foto (T-0A).
- ✅ Salvar/compartilhar sem filtro usa a foto pura como capturada (sem `captureRef`).
- ✅ **Validado no dispositivo (2026-07-09)** — as duas capturas de teste foram feitas com o chip "Original" ativo; salvar/postar funcionaram sem overlay de filtro, com música sugerida pela análise da cena.

> **Meta da fase:** fechar o fluxo sensorial **dinâmico e sem aleatoriedade** — foto (com ou sem filtro) → vibe real da imagem → música coerente. Bugs menores ficam para depois (o Sávio documenta e corrige quando o app estiver 100% funcional).

---

## Fase 1 — Fechar o pacote sensorial (fidelidade da spec)

Estas tasks resolvem as violações de constituição rastreadas no plano (Princípios I e III).

### ⬜ T-01 — Compartilhar o pacote com áudio, não só a foto  · P1 · US08 / FR-013, FR-014, RN-001

**Problema atual**: `postar()` gera só a imagem com filtro (`captureRef`) e o `PostSheet` compartilha essa imagem — a música escolhida **não entra no arquivo**. Fere o Princípio I (multimodalidade) e o FR-013 (gerar vídeo imagem+áudio).

- **T-01a**: Definir a estratégia de vídeo compatível com Expo Go. Opções: (a) baixar o preview de 30s do Deezer + still da imagem e montar `.mp4` — inviável sem FFmpeg no Expo Go; (b) compartilhar a imagem **e** anexar o áudio/link da faixa via `Sharing` (pacote de dois arquivos ou legenda com link); (c) deixar a geração real de `.mp4` explicitamente para o development build (FFmpeg) e, no Expo Go, comunicar honestamente que só a imagem vai. **Decidir e registrar em plan.md.**
- **T-01b**: Implementar a opção escolhida em `PostSheet.tsx` / `CaptureSheet.postar()`, preservando `session.musica` + `trechoInicio/Fim` na exportação.
- **T-01c**: Ajustar o texto do `PostSheet` para não prometer "vídeo com trilha" quando só a imagem for de fato compartilhada (honestidade de UI).
- **Arquivos**: `src/components/PostSheet.tsx`, `src/components/CaptureSheet.tsx`.
- **Aceite**: SC-006 — o que é compartilhado reflete o filtro **e** o áudio aprovados (ou a UI deixa claro o que vai, sem prometer o que não entrega).

### ✅ T-02 — Ativar a curadoria Gemini (curadoria inteligente real)  · P2 · US04 / FR-005  — CONCLUÍDA (2026-07-09)

- ✅ `.env.example` já existia; `.env` no `.gitignore`; guia criado em `docs/GEMINI-SETUP.md`.
- ✅ **Migrado o endpoint** de `v1beta/models/gemini-2.0-flash:generateContent` (legado/deprecado) para `v1beta/interactions` (Interactions API atual), auth via header `x-goog-api-key`.
- ✅ **Modelo trocado** para `gemini-3.1-flash-lite` — os modelos `gemini-3.5-flash` e `gemini-3.1-pro-preview` dão 429 "not enough quota" no free tier; só o *lite* tem cota grátis. Decisão registrada em `docs/ESCOLHA-DO-MODELO-IA.md`.
- ✅ **Testado no dispositivo**: log `[music] ORIGEM=gemini — 4 sugestão(ões) usadas`, justificativas em pt-BR coerentes com a vibe. Degradação Gemini→Deezer→local validada.
- **Pendência menor**: as sugestões só são boas quando a **vibe** de entrada está certa — e a vibe ainda é simulada (ver T-05). Gemini cura bem o que recebe; recebe uma vibe que não olha a imagem.

---

## Fase 2 — Caçar erros de runtime do Expo Go (frente aberta)

Continuação da task registrada em `docs/STATUS.md`. Exercitar os fluxos e tratar cada card vermelho conforme a estratégia dos passos 1–4 do STATUS.

### ⬜ T-03 — Exercitar captura → salvar → compartilhar e catalogar erros  · P1

- Reproduzir cada erro, copiar o texto do card vermelho, anotar em `docs/STATUS.md`.
- Permissão/manifest → restringir ao mínimo ou declarar no `app.json`.
- Módulo nativo ausente/limitado → manter fallback e anotar o que só roda no development build.
- Regra invariável: **nunca perder a foto**.

### ⬜ T-04 — Validar salvar na galeria do sistema no dispositivo  · P2 [P]

`saveToSystemGallery` é best-effort e rejeita no Expo Go (Android 13+). Confirmar que degrada sem quebrar e que num development build salva de fato (permissão granular `photo`, acesso limitado Android 14).

---

## Fase 3 — Rumo à stack nativa (development build)

Só começam quando o alvo deixar de ser exclusivamente Expo Go. Cada uma **substitui um fallback** mantendo o contrato (ver tabela do plano).

### ⬜ T-05 — Detecção de vibe real com ML Kit  · US01/US02 / FR-001, FR-002 · Princípio III

Trocar `vibeEngine` simulado por rotulagem de frames do ML Kit, mantendo a assinatura `detectVibe(contexto) → Vibe`. Remove o `sceneSeed`/timer de 8s.

### ⬜ T-06 — Render de filtro com Skia + Reanimated (GPU)  · NFR-002 [P]

Substituir overlay + `filter` do RN por shaders Skia para fluidez real do visor.

### ⬜ T-07 — Geração de `.mp4` com FFmpeg (imagem + áudio)  · FR-013

Fecha de fato o T-01 na stack final: `ffmpeg-kit-react-native` une still + trecho de áudio em `.mp4` compartilhável.

### ⬜ T-08 — Câmera com Vision Camera  · NFR-001

Migrar de `expo-camera` para `react-native-vision-camera` (frames contínuos, baixa latência) — pré-requisito do T-05.

---

## Fora de escopo do MVP (registrado)

- Last.fm como fonte alternativa de música (a stack cita, mas Deezer + Gemini cobrem o MVP).
- Sincronização em nuvem da galeria (spec: local-only).
- Web (spec: fora de escopo).

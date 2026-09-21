# Tarefas — 006 Foto compartilhada de fora do app

| # | Tarefa | US | Status |
|---|---|---|---|
| T001 | `android.intentFilters` (`SEND` + `image/*`) no `app.json` | US1 | ✅ |
| T002 | Módulo nativo `modules/share-intake` (gradle, manifest, config) | US1 | ✅ |
| T003 | `ShareIntakeModule.kt`: `uriPendente`, `prepararImagem`, evento `onCompartilhamento` | US2/US3 | ✅ |
| T004 | Rotação por EXIF e teto de 24 MP na entrada | US4 | ✅ |
| T005 | Ponte JS `compartilhamentoRecebido.ts` com import dinâmico | US2 | ✅ |
| T006 | `RecepcaoCompartilhamento.tsx` (3 gatilhos + overlay de preparo) | US2/US3 | ✅ |
| T007 | Montagem no `_layout.tsx`, fora do `<Stack>` | US2 | ✅ |
| T008 | `capture.tsx`: sem histórico, cair em `/camera` | US5 | ✅ |
| T009 | `prebuild` + build local do APK debug | — | ✅ |
| T010 | Teste no device real (roteiro e resultado em `ESTADO.md`) | US1–US5 | ✅ |
| T011 | Documentação (`docs/components/*`, ADR 0014, `docs/ESTADO.md`, `CLAUDE.md`) | — | ✅ |

| T012 | Corrigir `?:` sobre `decodeStream` com `inJustDecodeBounds` (achado no device) | US2 | ✅ |

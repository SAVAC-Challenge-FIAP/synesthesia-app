# Status de Implementação — Synesthesia (MVP mobile)

> Checkpoint do progresso. Atualize ao fechar cada fatia de trabalho.
> **Última atualização:** 2026-07-07

## Onde estamos

MVP mobile em **Expo + React Native + TypeScript** com `expo-router`, rodando via **Expo Go**. Todas as telas e os fluxos das User Stories US01–US11 estão implementados e o app **abre e navega** no dispositivo de teste. A curadoria musical usa Deezer (sem chave) com Gemini opcional; a persistência é local (AsyncStorage + arquivos em `documentDirectory`).

### Ambiente / versões

| Item | Valor |
|---|---|
| Expo SDK | **54** (`expo@~54.0.35`) |
| React / React Native | 19.1.0 / 0.81.5 |
| Execução | Expo Go (QR code via `npx expo start`) |

> **Por que SDK 54 e não o mais novo:** o `create-expo-app@latest` instalou o **SDK 57** (prerelease), e depois testamos o **56** — ambos são mais novos do que o app **Expo Go** instalado no celular de teste suporta, o que dava o erro *"Project is incompatible with this version of Expo Go"*. O SDK 54 é o que aquele Expo Go abre. Se trocar de dispositivo/versão do Expo Go, reavaliar o alvo com `npm view expo dist-tags` (usar o maior `sdk-XX` disponível).

### Validação automatizada (verde)

- `npx tsc --noEmit` — sem erros
- `npx expo-doctor` — 18/18
- `npx expo export --platform android` — bundle gerado sem erros

## Telas e fluxos implementados

| Tela / fluxo | Arquivo | US / FR |
|---|---|---|
| Permissões (onboarding LGPD) | `app/index.tsx` | US06 / FR-009, FR-010 |
| Câmera (visor, vibe ao vivo, carrossel, flip, grade) | `app/camera.tsx` | US01, US02 / FR-001..004 |
| Modal de Captura (preview, filtro, música, trecho 0–30s) | `src/components/CaptureSheet.tsx` | US03, US04, US05 / FR-005..008, FR-013 |
| Trocar música | `src/components/MusicSheet.tsx` | US04 / FR-005, FR-007 |
| Confirmação de postagem + share | `src/components/PostSheet.tsx` | US08 / FR-014 |
| Galeria persistente (grid, reabrir, excluir) | `app/gallery.tsx` | US07 / FR-011, FR-012 |
| Ajustes (toggles persistentes) | `app/settings.tsx` | US09 / FR-015, FR-010 |

Serviços: `src/services/vibeEngine.ts` (contexto/vibe), `src/services/music.ts` (Gemini→Deezer→fallback local), `src/services/mediaStorage.ts` (foto permanente). Estado: `src/stores/*` (zustand + persist).

## Adaptações para Expo Go

O Expo Go não carrega módulos nativos fora do SDK. Para validar direto no celular, esta versão troca parte da stack final por equivalentes compatíveis, **mantendo os contratos da arquitetura** (ver `README.md` para a tabela completa): `expo-camera` no lugar do Vision Camera; vibe simulada on-device no lugar do ML Kit; overlays + `filter` do RN no lugar dos shaders Skia; compartilhamento da imagem renderizada no lugar do `.mp4` via FFmpeg; `expo-audio` no lugar do `expo-av`.

## ⚠️ Próxima task — resolver erros de runtime do Expo Go

A próxima frente é **caçar e resolver erros de execução decorrentes das limitações do Expo Go** com módulos nativos. O primeiro já foi tratado; outros do mesmo tipo devem aparecer ao exercitar captura, salvar na galeria e compartilhar.

### Resolvido — permissão de mídia pedindo AUDIO

```
ERROR  Call to function 'ExpoMediaLibrary.getPermissionsAsync' has been rejected.
→ Caused by: You have requested the AUDIO permission, but it is not declared in
  AndroidManifest. Update expo-media-library config plugin to include the permission
  before requesting it.
```

- **Causa:** no SDK 54, o `expo-media-library` checa por padrão todas as permissões granulares (inclui `AUDIO`), mas o manifest só declara imagens.
- **Correção:** em `app/index.tsx`, `usePermissions({ granularPermissions: ['photo'] })` — o app não acessa mídia de áudio/vídeo. Também passamos a aceitar o modo *acesso limitado* do Android 14 (`accessPrivileges === 'limited'`) para não travar o onboarding.

### Aviso conhecido (não é bug) — media library limitada no Expo Go

```
WARN  Due to changes in Androids permission requirements, Expo Go can no longer
provide full access to the media library. [...] create a development build.
```

- É uma **limitação do Expo Go**, não do código. `MediaLibrary.saveToLibraryAsync` (salvar na galeria do sistema) pode falhar — já está em `try/catch` e degrada sem perder a foto (segue salva dentro do app). Some num **development build**.

### Estratégia para os próximos erros

1. Reproduzir cada erro exercitando o fluxo no Expo Go e copiar o texto do card vermelho.
2. Se for **permissão/manifest**: restringir a permissão ao mínimo necessário (como acima) ou declarar no `app.json`.
3. Se for **módulo nativo ausente/limitado no Expo Go** (câmera avançada, FFmpeg, ML Kit, Skia): manter o *fallback* Expo Go e anotar aqui o que só funcionará no **development build** (`npx expo run:android` / EAS) — este é o caminho para a stack nativa final da arquitetura.
4. Manter a regra da spec: **nunca perder a foto** — toda falha de áudio/compartilhamento/galeria degrada graciosamente.

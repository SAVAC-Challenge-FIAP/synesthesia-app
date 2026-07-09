# Status de Implementação — Synesthesia (MVP mobile)

> Checkpoint do progresso. Atualize ao fechar cada fatia de trabalho.
> **Última atualização:** 2026-07-09

## ✅ Fase 0 concluída e validada no dispositivo (2026-07-09): vibe real da foto + modo sem filtro

**T-0A e T-0B implementados juntos** via Gemini multimodal (confirmado: `gemini-3.1-flash-lite` aceita entrada de imagem — inputs Text/Image/Video/Audio/PDF, doc oficial do modelo). Validação estática: `tsc --noEmit` limpo, `expo-doctor` 18/18, `expo export --platform android` ok.

**Validado no dispositivo (Expo Go)** — duas capturas reais, com o chip "Original 📷" (sem filtro) selecionado:
- Foto 1 (bilhete/mural com corações) → Gemini leu `"bilhete escrito à mão com corações em um mural"` → vibe **romantica**.
- Foto 2 (jogo de futebol na TV) → Gemini leu `"partida de futebol profissional vista em uma tela de TV"` → vibe **energetica**.
- A prévia do visor (`detectVibe`, determinística por hora/câmera) ficou fixa em "romantica" nas duas — prova de que a vibe salva veio da análise real da foto, não da prévia. Salvar/postar funcionaram normalmente sem filtro aplicado, com música sugerida.
- Sem erros de runtime; log `ORIGEM=gemini-foto` confirmado nas duas capturas.

O que mudou:
- **`src/services/music.ts`** — nova `analyzePhotoAndSuggest(photoUri, fallbackVibe)`: reduz a foto (~640px JPEG, `expo-image-manipulator`) e envia em base64 numa única chamada multimodal à Interactions API (`input: [{type:'text'},{type:'image'}]`); o Gemini classifica a cena numa das 8 vibes **e** sugere as 4 faixas (com log da cena lida: `[music] Gemini leu a cena: ...`). Degradação: falha na análise → `getSuggestions(vibe heurística)` → Deezer → catálogo local.
- **`src/services/vibeEngine.ts`** — `sceneSeed` e timer de 8s **removidos**; `detectVibe({facing})` virou prévia determinística (hora + câmera → sempre a mesma vibe). Badge do visor mostra "VIBE · PRÉVIA".
- **`filtroId` agora é `FilterId | null`** em `Media`/sessão/componentes; carrossel ganhou o chip **"Original 📷"** (primeiro item). Sem filtro, salvar/compartilhar usa a foto pura (sem `captureRef`).
- **`CaptureSheet`** — na captura, a análise da foto atualiza a vibe da sessão e (se o filtro ainda estava no automático, flag `filtroAuto`) troca o filtro pelo da vibe real; qualquer escolha manual no carrossel derruba a flag. Música auto-selecionada só com "Sugestão automática" ligada.
- **Ajustes/LGPD** — o toggle `deteccaoTempoReal` virou **"Leitura da cena (IA)"**: é o opt-in honesto do envio da foto ao Gemini (desligado = nada sai do aparelho, vibe fica na prévia local). A nota de privacidade foi reescrita — a antiga prometia "nunca com as suas imagens", o que a análise multimodal violaria.

Próximo passo: exercitar no Expo Go (capturar cenas distintas → vibes/músicas coerentes; mesma cena 2× → resultado estável; foto sem filtro → sugestão funciona).

## ✅ Curadoria Gemini funcionando (2026-07-09)

A curadoria musical via **Gemini** (feature-chave do produto) está operacional ponta a ponta. Correções feitas em `src/services/music.ts`:
- Endpoint migrado do legado `v1beta/models/{model}:generateContent` para o atual `v1beta/interactions` (Interactions API); auth via header `x-goog-api-key`.
- Modelo trocado de `gemini-2.0-flash` (deprecado) para **`gemini-3.1-flash-lite`** — os modelos maiores (`3.5-flash`, `3.1-pro`) retornam 429 "not enough quota" no free tier; só o *lite* tem cota grátis. Comparativo em `docs/ESCOLHA-DO-MODELO-IA.md`.
- Validado no dispositivo: `[music] ORIGEM=gemini — 4 sugestão(ões) usadas`, justificativas coerentes em pt-BR.
- **Ainda pendente:** a vibe de entrada é simulada (hora/câmera/timer), então a sugestão só bate com a foto quando o horário coincide com o clima. Detecção real da imagem = T-05 (ver `specs/001-synesthesia-mvp/tasks.md`). Logs de diagnóstico em `music.ts` e `vibeEngine.ts` (`[music]` / `[vibeEngine]`).

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
- **Correção:** pedir só a permissão granular `photo` — o app não acessa mídia de áudio/vídeo. Também aceitamos o modo *acesso limitado* do Android 14 (`accessPrivileges === 'limited'`). Hoje isso vive em `src/services/systemGallery.ts` (ver item seguinte, que substituiu o `usePermissions` do onboarding).

### Resolvido — `ExpoMediaLibrary.getPermissionsAsync` rejeita no Expo Go (Android)

```
ERROR  [Error: Uncaught (in promise, id: 0) Error: Call to function
'ExpoMediaLibrary.getPermissionsAsync' has been rejected.
→ Caused by: Due to changes in Androids permission requirements, Expo Go can no
  longer provide full access to the media library. To test the full functionality
  of this module, you can create a development build]
```

- **Causa:** no Expo Go (Android 13+), **todas** as chamadas do `expo-media-library` rejeitam com `CodedError` — inclusive `getPermissionsAsync`, que o hook `usePermissions` dispara na montagem do onboarding. A rejeição não tratada virava o card vermelho.
- **Correção:** criado `src/services/systemGallery.ts`, wrapper com degradação graciosa: check/request/save em `try/catch`, devolvendo o estado `'unavailable'` quando o módulo rejeita (Expo Go). O onboarding (`app/index.tsx`) deixou de usar `usePermissions` e trata a galeria do sistema como *best-effort* — só a **câmera** bloqueia o fluxo; `'unavailable'` conta como liberado. O `CaptureSheet` exporta via `saveToSystemGallery()` (nunca lança). Num development build o wrapper volta a pedir/usar a permissão real (granular `photo`, aceitando acesso limitado do Android 14).
- O `WARN` correspondente ("Expo Go can no longer provide full access...") continua aparecendo e é inofensivo — some no development build.

### Resolvido — tela vazia ao abrir (loop de redirect index ↔ camera)

- **Sintoma:** app abre numa tela escura sem nenhum botão, sem erro no terminal.
- **Causa:** com a galeria tratada como best-effort, o onboarding passou a redirecionar para `/camera` assim que as permissões resolvem; mas o `useCameraPermissions()` de `app/camera.tsx` retorna `null` no primeiro render (carregamento assíncrono) e o guard `!cameraPerm?.granted` devolvia um `<Redirect href="/">` — as duas telas ficavam se redirecionando mutuamente, renderizando apenas `<Redirect>` (nada na tela).
- **Correção:** distinguir "permissão carregando" de "permissão negada". `camera.tsx` segura um `<View>` escuro enquanto `cameraPerm === null` e só redireciona quando a negação é real; `index.tsx` também segura o splash até `cameraPerm` e o status da galeria carregarem, decidindo uma única vez entre redirect e onboarding.

### Resolvido — "Rendered more hooks than during the previous render" na câmera

- **Sintoma:** card vermelho de Rules of Hooks apontando `CameraScreen` assim que a permissão da câmera termina de carregar.
- **Causa:** bug latente em `app/camera.tsx` — o `useCallback` de `capturar` estava declarado **depois** dos guards de permissão. Com o guard antigo (`<Redirect>`) a tela desmontava e o problema nunca aparecia; com o novo estado "permissão carregando" (que mantém a tela montada), o 1º render retornava cedo com N hooks e o seguinte executava N+1.
- **Correção:** todos os hooks movidos para antes dos early returns; os guards de permissão agora vêm depois do último hook. Padrão conferido nas demais telas/componentes com early return (`index`, `CaptureSheet`, `MusicSheet`) — só a câmera violava.

### Endurecimentos preventivos (mesma classe de erro)

- `MusicPlayer`: `player.seekTo()` do `expo-audio` retorna Promise — todas as chamadas ganharam `.catch(() => {})` para não gerar "Uncaught (in promise)" se o seek na prévia remota rejeitar.
- `CaptureSheet.salvar`: se `persistPhoto()` (cópia para o `documentDirectory`) lançar, a mídia entra na galeria apontando para a URI original do cache — regra "nunca perder a foto".

### Estratégia para os próximos erros

1. Reproduzir cada erro exercitando o fluxo no Expo Go e copiar o texto do card vermelho.
2. Se for **permissão/manifest**: restringir a permissão ao mínimo necessário (como acima) ou declarar no `app.json`.
3. Se for **módulo nativo ausente/limitado no Expo Go** (câmera avançada, FFmpeg, ML Kit, Skia): manter o *fallback* Expo Go e anotar aqui o que só funcionará no **development build** (`npx expo run:android` / EAS) — este é o caminho para a stack nativa final da arquitetura.
4. Manter a regra da spec: **nunca perder a foto** — toda falha de áudio/compartilhamento/galeria degrada graciosamente.

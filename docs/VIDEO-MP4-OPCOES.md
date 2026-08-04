# Como gerar o `.mp4` (imagem + trilha) — levantamento e decisão pendente

> **Data:** 2026-07-09 · **Contexto:** T-01 (Fase 1) implementada como *pacote composto*; o Sávio quer o **vídeo pronto** ao compartilhar. Este doc reúne o que já foi apurado para a **T-07** ser decidida e executada. Ver `specs/001-synesthesia-mvp/tasks.md` e `plan.md`.

## O objetivo

"Postar agora" deve produzir **um arquivo `.mp4`** contendo a imagem capturada (com ou sem filtro) como quadro fixo + o trecho aprovado da trilha (`trechoInicio`–`trechoFim`, prévia de 30s do Deezer), compartilhável via share intent para Instagram / TikTok / WhatsApp.

## Fato 1 — em Expo Go isso é impossível on-device

O Expo Go só carrega os módulos nativos que vêm compilados nele (os do SDK). **Nenhum módulo do SDK Expo codifica vídeo.** Não existe encoder H.264/AAC acessível em JavaScript no Hermes, e não há muxer em JS. Portanto:

> Qualquer caminho para o `.mp4` exige **development build** (`npx expo run:android` / EAS Build) **ou** um **servidor** que faça o encode.

Isso não é limitação do nosso código — é da plataforma. Foi por isso que a T-01 saiu como pacote composto (imagem + mp3 da prévia + legenda) com UI honesta.

## Fato 2 — ⚠️ `ffmpeg-kit-react-native` foi APOSENTADO

A stack no `CLAUDE.md` e no `plan.md` cita `ffmpeg-kit-react-native`. **Essa biblioteca está morta:**

- **06/01/2025** — os mantenedores (arthenica) anunciaram a aposentadoria do FFmpegKit, citando (a) o custo de acompanhar o upstream do FFmpeg e (b) incerteza jurídica após a aquisição da MPEG LA pela Via-LA (patentes de codec).
- **01/04/2025** — os **binários nativos foram removidos** do Maven Central, CocoaPods e npm.

Ou seja: **a T-07 como estava escrita não é mais executável**. Instalar `ffmpeg-kit-react-native` hoje resolve o pacote npm mas não baixa os binários. Existem workarounds (hospedar os `.aar`/`.xcframework` você mesmo, ou usar forks da comunidade), mas é dívida técnica e risco de licença.

**Ação obrigatória:** corrigir a menção ao `ffmpeg-kit` em `CLAUDE.md` (tabela de stack), `plan.md` (tabela de fallbacks) e `tasks.md` (T-07) assim que a decisão abaixo for tomada.

## As quatro opções reais

| # | Caminho | Roda no Expo Go? | Custo | Risco |
|---|---|---|---|---|
| **A** | Dev build + FFmpeg "na mão" (fork da comunidade, ou binários hospedados por nós: `FFmpeg-iOS` do kewlbear + `VideoKit-FFmpeg-Android`) | ❌ | Alto (NDK/Gradle no Android, SPM/XCFramework no iOS) + 30–80 MB no APK | Dependência morta, licença de codec |
| **B** | Dev build + **Expo Module nativo próprio**: Android `MediaCodec` + `MediaMuxer`; iOS `AVAssetWriter` | ❌ | Médio (~100–150 linhas por plataforma) | Baixo — API de sistema, sem binário, sem licença |
| **C** | **Servidor / função serverless** com FFmpeg: app envia imagem + áudio, recebe o `.mp4` | ✅ | Precisa de infra no ar durante a demo | **Fere o Princípio IV/LGPD** (a foto sai do aparelho); latência; falha sem internet |
| **D** | WebView + `ffmpeg.wasm`, ou `canvas.captureStream()` + `MediaRecorder` | ✅ (`react-native-webview` existe no Expo Go) | Baixo em código, alto em fragilidade | WASM de ~25 MB via bridge; `MediaRecorder` no Android Chrome grava **webm**, não mp4, e tem bug conhecido travando o encode com canvas grande (>640×480) |

### Recomendação: **opção B**

Nosso caso é o mais simples que existe em encoding: **um único quadro** (a imagem, repetida) + **uma faixa de áudio**. Não precisa de filtros, nem de transcodificação de vídeo de entrada, nem de FFmpeg inteiro. O `MediaMuxer` do Android faz exatamente isso (aceita 1 trilha de vídeo + 1 de áudio, saída MP4); o `AVAssetWriter` do iOS idem.

Por quê B e não as outras:
- **vs. A** — evita a dependência aposentada e os 30–80 MB no APK, e evita a zona cinzenta de licença de codec que motivou a própria aposentadoria do FFmpegKit.
- **vs. C** — o app é vendido como **processamento local** (Princípio IV / onboarding LGPD). Já abrimos uma exceção *opt-in* para a foto ir ao Gemini; mandar a foto de novo para um servidor de vídeo amplia a superfície e cria dependência de infra viva no dia da apresentação.
- **vs. D** — webm não serve para Instagram/TikTok, e ffmpeg.wasm dentro de WebView é frágil demais para uma demo.

**Ressalvas de B:**
- Exige sair do Expo Go → `npx expo run:android` (precisa de Android Studio/SDK) ou EAS Build. Isso muda o fluxo de testes do Sávio (hoje é QR code no Expo Go, travado no SDK 54 pela versão do app Expo Go no celular — ver `docs/STATUS.md`).
- iOS exige macOS para compilar. **Para o JOVI Challenge, Android basta** — decidir se o módulo iOS fica como stub.
- Um dev build também **desbloqueia de uma vez** as outras tasks da Fase 3: T-05 (ML Kit), T-06 (Skia), T-08 (Vision Camera).

Alternativa pragmática, se o dev build atrasar a entrega: **manter o pacote composto da T-01 na demo** e apresentar o `.mp4` como roadmap. A UI já é honesta a respeito.

## O código já está preparado para receber o vídeo

O encaixe existe e **nenhum consumidor precisa mudar** quando o encoder chegar:

- [`src/services/sharePackage.ts`](../src/services/sharePackage.ts) — `exportPackage()` devolve `{ videoUri, imageUri, audioUri, caption, musica }`. Hoje `videoUri` é sempre `null`. **A T-07 só precisa preenchê-lo.**
- [`src/components/PostSheet.tsx`](../src/components/PostSheet.tsx) — já tem o branch `videoUri !== null` → título "Vídeo gerado!" e a grade de destinos compartilha o arquivo único.
- [`src/components/CaptureSheet.tsx`](../src/components/CaptureSheet.tsx) — `postar()` já passa `musica` + `trechoInicio/Fim` para o `exportPackage()`.

Entrada disponível para o encoder: `imageUri` (jpg do `captureRef` ou a foto pura), `audioUri` (mp3 de 30s já baixado para o cache) e o recorte `trechoInicio`–`trechoFim` em segundos.

## O que a próxima sessão precisa verificar (com o MCP/skills da Expo)

1. Existe hoje um módulo Expo/RN mantido que faça **still + áudio → mp4** sem FFmpeg? (`react-native-video-processing` e `tapioca` aparecem nas buscas mas constam como **inativos/desatualizados**; `react-native-compressor` só comprime, não muxa.)
2. Confirmar a API atual dos **Expo Modules** (`expo-module-scripts`, `createExpoModule`) no **SDK 54** e o caminho de local module (`modules/` no projeto) para não precisar publicar pacote.
3. Confirmar se `npx expo run:android` no ambiente do Sávio (Windows) exige Android Studio completo ou se **EAS Build** (nuvem) é o caminho mais curto para gerar o dev build.
4. Reavaliar o pin do SDK 54: ele existe **só** por causa do app Expo Go do celular. Com dev build, o pin some — decidir se sobe de SDK junto (`npm view expo dist-tags`).

## Fontes

- [FFmpegKit — repositório oficial (aviso de aposentadoria)](https://github.com/arthenica/ffmpeg-kit)
- [No More FFmpegKit? Don't Panic — Here's What's Next](https://www.itpathsolutions.com/ffmpegkit-shutdown-what-to-do-next)
- [FFmpegKit Replacements for React Native, Flutter, Android, iOS…](https://www.itpathsolutions.com/top-ffmpeg-alternatives)
- [Resolved "FFmpegKit" Retirement Issue in React Native](https://medium.com/@nooruddinlakhani/resolved-ffmpegkit-retirement-issue-in-react-native-a-complete-guide-0f54b113b390)
- [MediaMuxer — Android Developers](https://developer.android.com/reference/android/media/MediaMuxer)
- [Mixing Audio Into Video on Android (MediaMuxer + MediaCodec)](https://sisik.eu/blog/android/media/mix-audio-into-video)
- [Create Video From Images — Time-lapse on Android](https://sisik.eu/blog/android/media/images-to-video)
- [Capture a MediaStream from a canvas — Chrome for Developers](https://developer.chrome.com/blog/capture-stream)
- [Chrome bug 897727 — MediaRecorder + canvas.captureStream falha em canvas grande no Android](https://paul.kinlan.me/chrome-bug-897727mediarecorder-using-canvas-capturestreamfails-for-large-canvas-elements-on-android/)

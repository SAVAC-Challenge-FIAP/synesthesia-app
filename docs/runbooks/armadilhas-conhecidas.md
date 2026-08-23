# Armadilhas conhecidas

Bugs de plataforma já resolvidos, que custaram tempo real de investigação e que voltam a acontecer
se o código relacionado for mexido sem saber disso. Cada item existe para nunca precisar ser
redescoberto.

## Skia exige `dispose()` manual

Todo objeto do `@shopify/react-native-skia` (`Data`, `Image`, `Surface`, `Paint`, `ImageSnapshot`)
aloca memória **nativa**, fora do alcance do GC do JS. Sem `dispose()` explícito, ela só volta
quando o processo morre.

Em 2026-08-21 isso causou o defeito mais grave da feature 003: cada captura deixava ~180 MB para
trás; depois de duas capturas o app estava em 875 MB (contra 389 MB recém-aberto) e morria por
SIGSEGV em `mqt_v_js` — sintoma relatado como "o app está muito lento e fecha sozinho". Com
`dispose()` em `finally`, o Native Heap ficou estável em 281 MB por 3 ciclos seguidos.

**Como aplicar**: acumule os objetos numa lista e libere no `finally` (cobrindo os `return null` no
meio e os caminhos de erro), em ordem inversa da criação, cada um no seu próprio `try`. Ver
`src/services/renderLook.ts`. Relacionado: `useImage()` do Skia não faz downsampling — uma foto de
64 MP custa ~256 MB de bitmap por componente, então reduza antes com `expo-image-manipulator`
(`src/services/previaFoto.ts`) e mantenha o Skia só onde há uma imagem visível na tela.

## `LayoutAnimation` derruba `FlatList`

No Android/Fabric, `LayoutAnimation.configureNext` vale para a **próxima atualização da árvore
inteira**, não só para o componente que a agendou. Se qualquer `FlatList`/`ScrollView` na tela
trocar filhos (chaves diferentes) dentro da janela da animação, o `ReactClippingViewManager` tenta
reinserir uma view que a animação ainda segura, e o app morre com `IllegalStateException:
addViewAt: failed to insert view ... already has a parent`.

Aconteceu em 2026-08-22 no `CaptureSheet`: arquivar a trilha animava por 260ms e, se a curadoria
voltasse nesse intervalo, o `TratamentoCarrossel` trocava `esq-i` por `look-<id>-i`. Intermitente,
e o logcat só mostra o stack nativo — nada em `ReactNativeJS`.

**Como aplicar**: em lista cujo conteúdo muda de fase (placeholder → dado real), use chave de
**slot** (`slot-0`), nunca chave derivada do conteúdo. Antes de agendar `LayoutAnimation`,
considere o que mais pode re-renderizar junto.

## `video-muxer` usa Media3 Transformer, não `MediaCodec` na mão

`modules/video-muxer` gera o `.mp4` (imagem + trilha) com **androidx.media3 Transformer 1.11.0**.
Codec fixado em H.264 + AAC via `setVideoMimeType`/`setAudioMimeType`. **Não reintroduzir
`MediaCodec`/`MediaMuxer` manuais** — ver [ADR-0002](../adr/0002-geracao-do-mp4.md).

A versão artesanal com `MediaCodec` falhou em três bugs de nível de device, um depois do outro:
`Surface.lockCanvas()` incompatível com o Surface de `createInputSurface()`;
`BufferOverflowException` ao passar o bloco PCM inteiro para o encoder AAC (que aceita 1024
samples/canal por vez); e "Failed to stop the muxer". Todos variam por fabricante — o app roda no
aparelho dos avaliadores da FIAP, não só no Redmi de teste. H.264 é forçado porque o device
escolhia H.265/HEVC sozinho, com upload menos garantido no Instagram/TikTok.

**Como aplicar**: para imagem estática, `MediaItem.Builder().setImageDurationMs()` é obrigatório; o
áudio entra como `EditedMediaItemSequence.withAudioFrom(...).buildUpon().setIsLooping(true)`. O
Transformer precisa de Looper, então a chamada é despachada para a main thread. Validado no device:
30,00s, trilhas `vide`+`soun`, avc1+mp4a.

## React Native / UI
- **FlatList e LayoutAnimation**: O uso de `LayoutAnimation` (ex. em carrosséis de tratamentos/filtros) junto de `<FlatList>` causa crashes repentinos de `IllegalStateException` no Android ao trocar as chaves (keys) dos filhos iterados rapidamente. A solução provada foi usar uma "chave de slot" rígida e não derivada dos dados.

## Áudio
- **useAudioPlayer e Unmount**: Nunca se deve chamar `pause()` de um hook de audio, como o `useAudioPlayer`, dentro da função de *cleanup* (unmount) do React. O módulo interno já liberou o *Shared Object* nesse ponto, e invocar um método sobre ele causa Crash C++ na ponte.

## Expo Location
- **Import síncrono**: Ao usar `require('expo-location')` de forma síncrona dentro de um try/catch, ele devolve null em vez de estourar o catch se der errado. Usar `await import` pode derrubar o Metro bundler se houver inconsistências do Node.

## Skia e Memória
- **Dispose**: Como a memória do Skia é atrelada nativamente (C++), todos os objetos criados na thread JS *precisam obrigatoriamente* passar por `dispose()` manual, de preferência na ordem inversa da criação, senão haverá vazamento (Leak) e posterior SIGSEGV (Crash do App).
- **Snapshot PNG**: O método `makeImageSnapshot()` do Skia, se exportado como PNG em imagens de alta resolução, vai estrangular a ponte (JS Bridge) ao alocar Strings Base64 gigantescas. É fundamental forçar como formato `JPEG` para evitar instabilidade.

## Vídeo Muxer
- **Concorrência**: Módulos de Muxer no Android têm escopo local restrito. Enviar duas requisições de renderização concorrentemente gera Deadlock nos codecs. Apenas UMA exportação por vez deve estar em voo; ao receber requisição mais nova, a atual deve ser cancelada.

## Galeria do Sistema (Expo Go)
- **expo-media-library**: No Expo Go (Android 13+), TODAS as chamadas deste módulo rejeitam e devolvem "Expo Go can no longer provide full access". Funções que dependem dele para exportar precisam envolver num try-catch que permita a degradação silenciosa e nunca quebre o app principal.
- **READ_MEDIA_VIDEO**: A partir do Android 13, baixar o `mp4` gerado pede permissões restritas em tempo de execução para lidar com Vídeo. Sem pedir a nova `READ_MEDIA_VIDEO` a chamada falha engolindo erro e trava os botões de ação na UI.

## Animações e Reconciliação UI
- **LayoutAnimation e Transições**: `LayoutAnimation.configureNext` afeta a árvore inteira, não só uma aba ou card. Se o backend ou curadoria retornar respostas (criando/destruindo componentes como FlatLists) durante os ~260ms que a transição de Layout domina o React Native, o motor nativo de view colapsa lançando erro (`failed to insert view ... already has a parent`). A solução provada é cortar as animações num swap imediato caso o processo de background seja assíncrono.

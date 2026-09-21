# ADR 0014 — Foto que entra pelo "Compartilhar" do sistema

**Data**: 2026-09-21 · **Feature**: [006-foto-compartilhada](../../specs/006-foto-compartilhada/)
· **Status**: aceito

## Contexto

Até a 1.3.1 havia uma única porta de entrada para foto nova: o disparo do visor.
Tudo o que o app sabe fazer — ler a cena, sugerir looks, curar a trilha, montar
o `.mp4` — só alcançava o que a câmera do próprio app capturou. O gesto natural
de quem vai postar ("estou na galeria, quero mandar esta foto para o
Synesthesia") não existia.

## Decisão

Declarar o app como destino de `ACTION_SEND`/`image/*` e ligar a imagem
recebida **na sessão de captura que já existe**, sem tela nova e sem caminho
paralelo.

### Por que módulo nativo (`modules/share-intake`)

Três coisas impedem resolver isso em JS:

1. **`Linking` não enxerga o intent.** `ACTION_SEND` entrega a imagem em
   `Intent.EXTRA_STREAM`; `Linking.getInitialURL()` lê `getData()`. São campos
   diferentes — do lado do JS, o compartilhamento simplesmente não chega.
2. **A permissão do `content://` é emprestada.** O grant vale enquanto a tarefa
   viver. Guardar a URI e ler depois (no salvar, no export) daria
   `SecurityException` em momentos imprevisíveis, então a imagem é copiada para
   o cache do app **na entrada**, e o resto do app só vê um `file://` seu.
3. **EXIF.** Foto de galeria costuma ser gravada deitada, com a orientação num
   metadado. O `expo-image-manipulator` decodifica com `BitmapFactory`, que
   ignora esse metadado — e o Skia e o `view-shot` idem. A foto apareceria em pé
   na tela (o `<Image>` do RN respeita EXIF) e **deitada** no `.mp4`: divergência
   entre o que se aprova e o que se posta, que é exatamente o que o Princípio I
   proíbe. A rotação é aplicada aos pixels na entrada, de uma vez.

Os dois primeiros pontos valem para qualquer biblioteca de terceiros que se
pegasse no lugar; o terceiro é o que decide, e é ~40 linhas de Kotlin.

### Por que a mesma sessão de captura

A sessão nasce com `mediaId: null` e `filtroAuto: true`, idêntica à de um
disparo. Com isso a curadoria, os três looks, a memória de gosto, o salvar, o
pré-render e o postar funcionam **sem nenhum ramo novo**: o `CaptureSheet` não
sabe (nem precisa saber) de onde a foto veio.

A vibe local (`detectVibe`) entra como piso de degradação, igual à captura — em
segundos ela é substituída pela leitura real do Gemini.

### Teto de 24 MP na entrada

O mesmo `AREA_MAXIMA_FOTO` de `enquadrar.ts`, pelo mesmo motivo: uma foto de
48 MP decodificada inteira em `ARGB_8888` passa de 190 MB de heap e derruba o
processo no aparelho de referência (Redmi Note 8 Pro) antes de o JS ver
qualquer coisa. A redução usa `inSampleSize`, que decodifica já pequeno em vez
de decodificar grande e encolher.

## Consequências

- O acervo inteiro do aparelho vira matéria-prima do app, não só o que a câmera
  do Synesthesia capturou.
- **Android apenas, e isso não é dívida.** O Synesthesia é um app 100% Android
  por decisão de produto (Sávio, 2026-09-21) — não existe versão iOS no
  horizonte. Os três módulos locais (`video-muxer`, `share-target`,
  `share-intake`) assumem isso, e nenhum deles precisa de paridade.
- `app.json` ganhou `android.intentFilters` — e com isso **todo prebuild passa a
  ser obrigatório** para quem for buildar do zero, junto da armadilha conhecida
  do `splashscreen_logo`.
- Uma captura em andamento é substituída sem aviso quando chega uma foto nova
  pelo compartilhamento. É o comportamento esperado do gesto (a pessoa acabou de
  escolher outra foto), mas é uma perda silenciosa — se aparecer reclamação, o
  lugar de tratar é o `receber` do `RecepcaoCompartilhamento`.

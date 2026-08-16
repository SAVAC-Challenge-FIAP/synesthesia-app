# Linha de base — QA e Lapidação do MVP v1

**Feature**: `002-qa-lapidacao-v1` | **Medido em**: 2026-08-15

Números coletados **antes** de qualquer alteração desta rodada, no commit `fcbea95`.
Sem esta linha de base não há como provar melhora (SC-Q03) nem regressão.

---

## T001 — Ambiente e dispositivo

```
$ adb devices -l
List of devices attached
192.168.15.3:5555   device product:begonia model:Redmi_Note_8_Pro device:begonia transport_id:4
```

| Item | Valor |
|---|---|
| Aparelho | Redmi Note 8 Pro (`begonia`) |
| Android | 10 (SDK 29) |
| Resolução | 1080 × 2340 |
| Densidade | 440 dpi (1 dp = 2,75 px) |
| Pacote | `com.savioomiodev.synesthesia` (build local debug) |
| `adb` | `/opt/homebrew/share/android-commandlinetools/platform-tools` — **não está no PATH padrão**; exportar antes de usar |

> EAS Build não foi usado em nenhum momento (cota reservada para a publicação final).

---

## T002 — Screenshots da linha de base

Em [`docs/preview/baseline/`](../../docs/preview/baseline/):

| Arquivo | Tela |
|---|---|
| `02-camera.png` | Visor com carrossel e controles |
| `03-captura.png` | Modal de captura com trilha resolvida |
| `04-musica.png` | Modal "Escolha a vibe sonora" |
| `01-postagem.png` | Confirmação de postagem ("Vídeo gerado!") |
| `05-galeria.png` | Galeria (2 pacotes) |
| `06-ajustes.png` | Ajustes |

Defeitos já visíveis nessas capturas, sem instrumentação:

- **US1** — em `03-captura.png`, "Salvar" e "Postar agora" ocupam y ≈ 2162–2264; a barra de
  navegação começa em y = 2210. **Cerca de 45% da altura de cada botão está sob a barra.**
  O mesmo em `04-musica.png` ("Cancelar" / "Confirmar escolha", y ≈ 2141–2256) e em
  `01-postagem.png` ("Fechar").
- **US4** — em `02-camera.png` e `03-captura.png` o 4º chip aparece cortado como "❤️ L",
  sem nenhuma indicação de que há mais 5 filtros à direita.

---

## T003 — Tempo entre o disparo e a trilha visível

**Método**: `date +%s.%N` no aparelho imediatamente antes do toque no botão de captura;
`adb logcat -v epoch` para o instante das linhas `[music]` já existentes em
[`src/services/music.ts`](../../src/services/music.ts). 5 capturas consecutivas, mesma cena,
mesma rede, `Leitura da cena (IA)` ligada (caminho Gemini + Deezer).

| Execução | Disparo → Gemini leu a cena | Disparo → trilha resolvida |
|---|---|---|
| 1 | 5,87 s | **6,19 s** |
| 2 | 5,27 s | **5,65 s** |
| 3 | 7,01 s | **7,31 s** |
| 4 | 5,72 s | **6,02 s** |
| 5 | 5,72 s | **6,02 s** |

**Mediana: 6,02 s.** Faixa: 5,65 s – 7,31 s.

### ⚠️ A linha de base de 30–45 s da spec não se reproduz

O [research.md](./research.md) R3 e o critério SC-Q03 partem de uma linha de base de
**30–45 s**, observada em testes anteriores. Medida hoje, no mesmo aparelho e na mesma rede,
a mediana é **6,02 s** — cinco a sete vezes menor. Nenhuma alteração de código foi feita
entre as duas medições, então a diferença vem do ambiente (rede e/ou latência do endpoint
do Gemini no momento dos testes originais).

Consequências para a Fase 5 (US3), registradas em "Dúvidas para o Sávio" no
[tasks.md](./tasks.md):

- **A meta de "reduzir ≥ 40% sobre 30–45 s" já está superada por ampla margem** sem tocar em
  nada. Reduzir 40% sobre 6,02 s significaria chegar a 3,6 s — o que exigiria mexer no
  modelo do Gemini, justamente a alternativa que o research classificou como **adiada**
  por afetar a qualidade da leitura de cena, que é o diferencial do produto.
- **A decomposição confirma a hipótese do research**, e só ela: a etapa dominante é a
  chamada ao Gemini. A resolução das faixas no Deezer custa **0,30–0,38 s** nas 5 execuções
  — ou seja, ~5% do total. "Paralelizar o Deezer" continua sendo trabalho perdido.

### Decomposição por etapa (T020)

Instrumentando as três etapas de `analyzePhotoAndSuggest`, com a foto de 640px/q0.6 (~71 KB)
que era o envio original:

| Execução | Reduzir imagem | Gemini | Deezer | Total |
|---|---|---|---|---|
| 1 | 654 ms | **20 942 ms** | 564 ms | 22 165 ms |
| 2 | 483 ms | **3 554 ms** | 397 ms | 4 439 ms |
| 3 | 552 ms | **3 594 ms** | 395 ms | 4 544 ms |
| 4 | 497 ms | **31 676 ms** | 549 ms | 32 725 ms |
| 5 | 522 ms | **122 987 ms** | 361 ms | 123 874 ms |

**O Gemini é 80–99% do tempo.** A redução da imagem custa meio segundo e o Deezer,
0,4 s — ou seja, o research R3 estava certo ao descartar a paralelização do Deezer, e as
duas etapas locais somadas nem chegam a 1 s.

O que os números mostram e a spec não previa: **a variância é o defeito, não a mediana.**
A mesma foto, na mesma rede, no mesmo aparelho, levou de **2,9 s a 123 s**. Os "30–45 s"
da spec não são uma linha de base — são uma amostra tirada de uma janela ruim do serviço.

---

## T021 — O que foi atacado

### Payload cortado pela metade, sem perder leitura de cena

640px/q0.6 → **448px/q0.45**, de ~71 KB para ~35 KB. As cinco leituras seguintes
continuaram descrevendo a cena corretamente e classificando a vibe como `romantica`:

> "Laptop exibindo desenho com corações e declaração de amor." · "laptop com desenho de
> corações e mensagem de amor" · "Laptop com desenho romântico fixado na tela"

Melhor caso do Gemini caiu de 3 554 ms para **2 929 ms**. É ganho real, mas pequeno perto
da variância — metade de 71 KB some no ruído de uma resposta que oscila 40×.

### A correção que importou: a requisição nunca era abandonada

`callGemini` e `searchDeezer` usavam `fetch` sem `AbortController`. A requisição de **123 s**
seguiu viva muito depois de o usuário desistir e ter descartado a captura. Agora há teto de
**22 s no Gemini** e **8 s no Deezer**.

O teto do Gemini é menor que os 30 s da interface **de propósito**: assim a degradação
graciosa ainda roda dentro da janela e o usuário recebe alguma trilha, em vez de a
interface desistir sozinha com a requisição pendurada.

> Efeito colateral que precisou de correção: ao estourar, a degradação chamava
> `askGemini` de novo — outros 22 s no mesmo serviço que acabara de não responder, somando
> 44 s e furando o limite da interface. Quando a falha é `AbortError`, a etapa do Gemini
> agora é pulada e a busca vai direto ao Deezer por keywords.

---

## T023 — Medição depois das mudanças

Cinco capturas com o código final (payload reduzido + tetos de rede + progresso por etapa):

| Execução | Gemini | Total | Saída |
|---|---|---|---|
| 1 | 3 325 ms | 4 101 ms | gemini-foto |
| 2 | 3 949 ms | 4 827 ms | gemini-foto |
| 3 | 14 544 ms | 15 362 ms | gemini-foto |
| 4 | 4 650 ms | 5 469 ms | gemini-foto |
| 5 | estourou 22 s | 23 111 ms | **degradado — e com trilha** |

**Mediana: 5 469 ms**, contra 6 020 ms da linha de base. **Redução de 9% — não os 40% do
SC-Q03.** Não vou marcar essa meta como atingida.

### Por que 40% não era alcançável, e o que melhorou de fato

A meta foi calibrada sobre uma linha de base de 30–45 s que não se reproduz. Sobre a
mediana real de 6 s, ela exigiria chegar a 3,6 s — e o T020 mostra que **95% do tempo está
dentro da chamada ao Gemini**, fora do alcance do cliente. Só a troca de modelo mexeria
nesse número, e o research a classificou como adiada por afetar a leitura de cena, que é o
diferencial do produto.

O que mudou de verdade é o **pior caso**, que é o que o usuário sente:

| | Antes | Depois |
|---|---|---|
| Mediana | 6,02 s | 5,47 s |
| Pior caso observado | **123 s**, interface presa em "carregando" | **23,1 s**, e ainda entrega trilha |
| Requisição após desistência | seguia viva | abortada em 22 s |
| Feedback durante a espera | texto único parado | 3 etapas reais |

A execução 5 é a prova: o Gemini estourou, a degradação assumiu, e o usuário recebeu uma
trilha em 23,1 s — dentro do limite de 30 s da interface. Antes, esse mesmo caso ficaria
pendurado por 1 a 2 minutos com a postagem bloqueada.

---

## T024 — Degradação graciosa, testada por injeção de falha

Não dava para testar cortando a rede: o aparelho está ligado por **adb sobre Wi-Fi**, então
desligar o Wi-Fi derruba a própria ferramenta de verificação. Em vez disso, os dois hosts
foram apontados para domínios inexistentes (`.invalid`), o pipeline foi exercitado, e o
arquivo restaurado do backup em seguida.

Log de uma captura com Gemini **e** Deezer indisponíveis:

```
[music] análise da foto falhou (caiu para pipeline por vibe): [TypeError: Network request failed]
[music] getSuggestions vibe="energetica" geminiKey=presente
[music] Gemini falhou (caiu para Deezer puro): [TypeError: Network request failed]
[music] ORIGEM=local — catálogo offline para vibe="energetica"
[music][tempo] imagem=409ms gemini=0ms deezer=0ms total=792ms saida=degradado
```

Os quatro degraus da spec, na ordem, em **792 ms** — e a tela mostrou "Envolver · Anitta",
a entrada do catálogo local para a vibe `energetica`. Nenhum degrau foi perdido nas
mudanças da Fase 5.

Os dois casos de falha ficaram cobertos, e com tratamentos diferentes de propósito:

| Falha | Comportamento | Por quê |
|---|---|---|
| Rede caiu (`TypeError`) | tenta o Gemini por vibe e só depois cai | falha instantânea, a nova tentativa não custa espera |
| Tempo limite (`AbortError`) | **pula** o Gemini e vai direto ao Deezer | insistir custaria outros 22 s no serviço que já não respondeu |

### Próxima hipótese, se alguém quiser perseguir a mediana (US3)

Trocar `gemini-3.1-flash-lite` por um modelo mais rápido e medir a qualidade da leitura de
cena lado a lado, em 20 fotos variadas — não em 5 da mesma cena. É decisão de produto, não
de implementação: registrada como **D1** em [tasks.md](./tasks.md).

---

## T004 — Limite inferior de toque

**Método**: `dumpsys window | grep mStableFullscreen` — a borda inferior da área estável é,
por definição, o primeiro pixel reservado ao sistema. Confere com a medição registrada na
spec (toque em y=2180 aciona; y=2213 não).

| Modo de navegação | Área estável | Inset inferior | Primeiro y do sistema |
|---|---|---|---|
| **Por botões** (`force_fsg_nav_bar=0`) | `[0,76][1080,2210]` | **130 px = 47,3 dp** | y = 2210 |
| **Por gestos** (`force_fsg_nav_bar=1`) | `[0,76][1080,2296]` | **44 px = 16 dp** | y = 2296 |

**É esta diferença de 3× que torna impossível acertar com espaçamento fixo.** O
`paddingBottom: 20` (55 px) de `CaptureSheet.actions` fica *acima* do necessário em gestos
(sobra 11 px) e *muito abaixo* em botões (faltam 75 px) — que é exatamente o aparelho e o
modo em que o defeito foi observado.

Inset superior (status bar): 76 px = 27,6 dp em ambos os modos.

> Alternar o modo por `settings put global force_fsg_nav_bar` reinicia a SystemUI e tira o
> app do primeiro plano. Ao automatizar a verificação da US1, relançar o app depois de
> trocar de modo.

---

## T013 — Verificação da US1 depois da correção

Medido por análise de pixel sobre a captura de tela (limites reais de cada botão) e por
toque real na **borda inferior** de cada botão primário — a faixa que antes não respondia.
Evidência em [`docs/preview/us1/`](../../docs/preview/us1/).

### Limites dos botões

| Superfície | Antes (y) | Depois (y) | Folga até o sistema |
|---|---|---|---|
| Captura · "Salvar" / "Postar agora" | 2162 – **2266** | 2052 – **2184** | **26 px** |
| Música · "Cancelar" / "Confirmar escolha" | 2141 – **2256** | 2057 – **2187** | **23 px** |
| Postagem · "Fechar" | flush até **2266** | termina em **2183** | **27 px** |
| Visor · obturador (já correto) | — | termina em **2149** | **61 px** |

Antes, 56 px de cada botão (≈45% da altura) ficavam sob a barra de navegação. Agora nenhum
pixel de botão primário cai na área do sistema.

### Toques na borda inferior — os quatro dispararam

| Modo | Botão | Toque | Resultado |
|---|---|---|---|
| Botões | Música · Cancelar | `tap 251 2185` | ✅ fechou o modal |
| Botões | Captura · Postar agora | `tap 790 2180` | ✅ gerou o `.mp4` (29 966 ms) e abriu a postagem |
| Botões | Postagem · Fechar | `tap 540 2180` | ✅ fechou e voltou ao visor |
| **Gestos** | Captura · Salvar | `tap 290 2266` | ✅ salvou e fechou |

### O layout acompanha o modo de navegação

Mesmo botão "Salvar", mesma build, só trocando o modo do sistema:

| Modo | Inset | Botão termina em | Folga |
|---|---|---|---|
| Por botões | 130 px | y = 2184 | 26 px |
| Por gestos | 44 px | y = 2270 | 26 px |

**A folga é idêntica nos dois modos** — é o que prova que o valor vem do aparelho e não de
uma constante. Um `paddingBottom` fixo não conseguiria os dois números ao mesmo tempo.

---

## T019 — Verificação da US2

Os quatro cenários de aceite, no aparelho. Evidência em [`docs/preview/us2/`](../../docs/preview/us2/).

| # | Cenário | O que foi feito | Resultado |
|---|---|---|---|
| 1 | `carregando` | capturar e tocar em "Postar agora" imediatamente | ✅ ação desabilitada, rótulo "Aguarde a trilha" e motivo à vista; **nada foi exportado** (logcat sem linha do VideoMuxer) |
| 2 | `pronta` | esperar a curadoria | ✅ botão volta a "Postar agora" em âmbar, vibe e filtro atualizados para a cena real |
| 3 | `indisponivel` | remover o áudio e tocar em "Postar agora" | ✅ alerta "Postar sem trilha?" com *Postar sem trilha* / *Cancelar* / *Escolher música* |
| 4 | salvar sempre | tocar em "Salvar" durante a curadoria | ✅ pacote na galeria como "SONHADORA · SEM ÁUDIO" — a foto não se perde |

### Achado durante a verificação: `carregando` sem tempo limite prendia o usuário

Em duas execuções a chamada ao Gemini **ficou pendurada e nunca respondeu**. Como
`callGemini` em `src/services/music.ts` não tem timeout, a promessa nunca se resolvia e o
estado ficava em `carregando` indefinidamente — ou seja, **o bloqueio da postagem introduzido
pela US2 virava armadilha**, um comportamento pior do que o defeito original.

O [data-model.md](./data-model.md) já previa a transição
`carregando ──(falha / sem resultado / tempo limite)──> indisponivel`; faltava implementá-la.
Foi adicionado um limite de **30 s** em `CaptureSheet` — 5× o pior caso medido (7,31 s) —
depois do qual a postagem é liberada com confirmação. Se a resposta chegar atrasada, o
`.then` ainda repõe a trilha e o estado volta a `pronta`.

> A causa raiz (requisição HTTP sem timeout) continua em `music.ts` e está anotada como
> candidata da Fase 5, junto da instrumentação do T020.

---

## T027 — Atraso na troca de filtro

Medido com `dumpsys gfxinfo`, que conta os frames que o app de fato desenhou. Dois
controles antes de atribuir qualquer custo à troca de filtro:

| Cenário | Frames | Janky | p50 | p90 | p95 |
|---|---|---|---|---|---|
| Visor parado, 10 s sem tocar | **0** | — | — | — | — |
| 12 toques em área inerte | **0** | — | — | — | — |
| 12 trocas de filtro (antes) | 299 | 39,1% | 14 ms | **113 ms** | 200 ms |
| 12 trocas de filtro (depois) | 367 | 38,2% | 15 ms | **77 ms** | 200 ms |

Os dois controles em zero são o achado que orienta o resto: **o preview da câmera é uma
surface nativa e não passa pelo React Native**, então o app não desenha nada enquanto
ninguém interage. Todo frame contado veio das trocas de filtro — não há custo de fundo a
descontar.

**Correção aplicada**: o chip virou componente memoizado e os dois `onSelect`
(`app/camera.tsx` e `CaptureSheet`) viraram callbacks estáveis. Sem isso, trocar um filtro
redesenhava os nove chips. O p90 caiu **32%**, de 113 ms para 77 ms.

**O que sobrou, e é honesto registrar**: ainda são ~30 frames por troca, quando o esperado
seria 1 ou 2, e o p95 continua em 200 ms. A memoização dos chips não explica esse resto —
ele está no re-render da tela do visor inteira a cada mudança de `manualFiltro`. Investigar
isso é exatamente o **T038** da Fase 9, e é lá que ele foi atacado.

---

## T028 — Verificação da US4 no dispositivo

Evidência em [`docs/preview/us4/`](../../docs/preview/us4/).

| Posição | O que aparece | Contador |
|---|---|---|
| Início | ORIGINAL · VIVID · NEON | **+7** |
| Meio | ECLIPSE · RETRO · VINTAGE | **+2** |
| Fim | VINTAGE · ARCTIC · HONEY | **↺** (volta ao início) |

O contador acerta em cada posição, e no fim da lista vira o controle de voltar ao começo em
vez de sumir — se sumisse, o carrossel inteiro pularia de largura.

| Verificação | Resultado |
|---|---|
| Fonte do sistema em 1.15 e 1.30 | ✅ sem quebra, rótulos inteiros, contador legível |
| Tela de 720×1560 @320dpi | ✅ layout íntegro, contador presente |
| Modal de captura (fundo ink) | ✅ mesmo comportamento do visor |

> A truncagem que aparecia logo após mudar a escala da fonte ("ORIGIN", "+") **não é
> defeito**: é layout obsoleto, porque o React Native não remede o texto já montado quando
> a escala muda pelas configurações do sistema. Depois de recarregar o app, tudo volta ao
> lugar. Vale como nota para quem for testar acessibilidade: reabra o app depois de mexer
> na escala, senão você mede um artefato.

---

## T029 — Mapa dos emojis: o que é controle e o que é linguagem do produto

O critério do [research.md](./research.md) R5: nos filtros e vibes o emoji é **conteúdo**,
parte da identidade; nos controles ele é **interface**, e interface precisa ser previsível e
tingível com a paleta.

### Migrados para `@expo/vector-icons` (Ionicons 15.1.1, já vinha com o Expo)

| Onde | Antes | Depois |
|---|---|---|
| `camera.tsx` · galeria | 🏞️ | `images-outline` |
| `camera.tsx` · virar câmera | 🔄 | `camera-reverse-outline` |
| `camera.tsx` · voltar ao automático | ↺ | `refresh` |
| `gallery.tsx` · voltar | ‹ | `chevron-back` |
| `gallery.tsx` · excluir | 🗑️ | `trash-outline` |
| `gallery.tsx` · trilha do card | 🎵 | `musical-notes` |
| `settings.tsx` · voltar | ‹ | `chevron-back` |
| `CaptureSheet` · fechar | ✕ | `close` |
| `CaptureSheet` · curadoria em curso | ⏳ | `hourglass-outline` |
| `MusicPlayer` · play/pause | ▶ ❚❚ | `play` / `pause` |
| `MusicSheet` · play/pause | ▶ ❚❚ | `play` / `pause` |
| `PostSheet` · baixar / salvo | ⬇️ ✓ | `download-outline` / `checkmark` |
| `PostSheet` · enviar áudio | 🎵 | `musical-notes` |
| `PostSheet` · enviar legenda | ✍️ | `create-outline` |
| `FilterCarousel` · voltar ao início | ↺ | `refresh` |

### Preservados de propósito (T031)

- **Os 8 filtros**: Vivid 🌟 · Neon 🌈 · Love ❤️ · Eclipse 🌒 · Retro 📼 · Vintage 🧡 ·
  Arctic ❄️ · Honey 🍯 — e o chip 📷 ORIGINAL.
- **As vibes**: 💭 sonhadora, 💘 romântica, ⚡ energética, 🌙 noturna e as demais.
- **Ilustrações de onboarding** (📸 câmera, 🏞️ galeria, 🔒 privacidade) e o emoji grande do
  resultado da postagem (🎬 / 📦 / 🖼️): são expressivos, não controles.
- **Destinos de compartilhamento** (Instagram, TikTok, WhatsApp, LinkedIn, X): marcas, fora
  do escopo "ícone de controle".

Confirmado no dispositivo: `docs/preview/us5/depois-camera.png` mostra 🧡 VINTAGE, ❄️ ARCTIC
e 🍯 HONEY intactos ao lado dos controles já vetoriais.

---

## Achado da Fase 7: o `force-dark` do Android reescrevia a paleta

Ao conferir o ícone de play, ele saía **branco** sobre o círculo âmbar, embora o código
pedisse `colors.ink`. A investigação:

| Cor pedida | Cor renderizada |
|---|---|
| `#FF00FF` (clara) | magenta ✅ |
| `colors.ink` (`#090506`) | **branco (255,254,255)** ❌ |
| `'#090506'` literal | **branco** ❌ |

Não era o React Native: `cmd uimode night` respondeu **`Night mode: yes`**, e o tema gerado
é `Theme.AppCompat.DayNight.NoActionBar` sem `forceDarkAllowed`. Com o sistema em modo
noturno, o **force-dark do Android reescrevia sozinho toda cor escura sobre fundo claro** —
o ícone de play e também o texto de "Postar agora".

O `app.json` já declarava `userInterfaceStyle: "dark"`, mas isso não desliga o force-dark.
A correção é no tema:

```xml
<item name="android:forceDarkAllowed" tools:targetApi="29">false</item>
```

Depois do rebuild, medido no mesmo pixel: círculo `(171,112,9)` = âmbar `#F8A20D` exato, e
o triângulo em `ink`. "Postar agora" voltou a ser escuro sobre âmbar.

> Isto é uma violação do Princípio VI **maior que a dos emojis**: os emojis mudavam de
> desenho entre fabricantes; o force-dark mudava a *paleta inteira* conforme uma
> configuração do aparelho, e mudaria na mão do avaliador sem ninguém entender por quê.
> Só apareceu porque a US5 obrigou a conferir cor de ícone pixel a pixel.

---

## T056 — Linha de base da repetição da curadoria (Fase 14)

Medido em 2026-08-16, aparelho `192.168.15.3`, leitura de cena ligada, **antes de
qualquer mudança em `music.ts`**. Dez capturas: cinco por cena, com o aparelho
apoiado e sem mexer no enquadramento — a segunda cena veio de virar para a câmera
frontal, não de mover o aparelho.

Para contar as faixas foi preciso instrumentar: `ORIGEM=` já dizia de qual camada
elas vinham, mas não **quais** eram. Acrescentado `[music][faixas]`, do mesmo tipo
do `[music][tempo]` do T020 — só observa, não muda comportamento.

> Os logs do JS saíram no **`/tmp/metro.log`**, não no logcat. Nesta sessão o
> `adb logcat ReactNativeJS:V '*:S'` voltou **vazio** durante as dez capturas,
> enquanto o `metro.log` tinha tudo. Ou seja: as duas notas anteriores do topo do
> `tasks.md` valem cada uma em seu caso — o que decide é quem subiu o Metro.
> Com o Metro subido por esta sessão redirecionando para arquivo, `metro.log` é a
> fonte confiável.

### Cena A — mousepad estampado (câmera traseira)

O Gemini leu a cena com precisão e estabilidade nas quatro vezes em que respondeu
("mousepad com arte de dragão em mesa com luzes neon"), classificando **`noturna`
em 4/4**. O problema não está na leitura da cena.

| # | Origem | Faixas |
|---|---|---|
| A1 | deezer (Gemini abortou) | Activation Frequency / Chakra Healing Music Academy · Top Hit Dance Song / Fred's Dance Instrumentals · I Wanna Dance Again / Top 40 Pop Hits · funk brasileiro / RVDENT |
| A2 | gemini-foto | Nightcall / Kavinsky · After Dark / Mr. Kitty · Midnight City / M83 · Blinding Lights / The Weeknd |
| A3 | gemini-foto | **idênticas às da A2, na mesma ordem** |
| A4 | gemini-foto | After Hours / The Weeknd · Nightcall / Kavinsky · Midnight City / M83 · Resonance / HOME |
| A5 | gemini-foto | Nightcall / Kavinsky · After Dark / Mr. Kitty · Starboy / The Weeknd · Midnight City / M83 |

- **Faixas distintas: 11 de 20.** Só no caminho do Gemini: **7 em 16**.
- **Artistas distintos: 9 de 20.** Só no Gemini: **5 em 16** — Kavinsky em 4/4,
  M83 em 4/4, The Weeknd em 3/4, Mr. Kitty em 3/4.

### Cena B — desenho de corações na tela do notebook (câmera frontal)

Leitura igualmente boa ("tablet com desenho de corações e mensagem de amor"),
`romantica` em 3/3.

| # | Origem | Faixas |
|---|---|---|
| B1 | gemini-foto | Love Story / Taylor Swift · Just the Way You Are / Bruno Mars · All of Me / John Legend · Perfect / Ed Sheeran |
| B2 | gemini-foto | Love Story · Just the Way You Are · Can't Help Falling in Love / Elvis Presley · Perfect |
| B3 | gemini-foto | **as mesmas quatro da B1, só reordenadas** |
| B4 | deezer (Gemini abortou) | Dream Pop (Club Mix) / Earth Trax · Dream Pop / Earth Trax · Dream Pop / Cafe del Mar Chillout · Synthwave / Rodriguez Jr. |
| B5 | deezer (Gemini abortou) | **idênticas às da B4** |

- **Faixas distintas: 9 de 20.** Só no caminho do Gemini: **5 em 12**.
- **Artistas distintos: 8 de 20.**

### O que os números mostram

1. **A repetição é real e grande.** O alvo do T061 é ≥ 15 faixas distintas em 20;
   a linha de base é **11 (cena A)** e **9 (cena B)**. No caminho principal — o
   Gemini, que é o que o usuário vê na maioria das capturas — a diversidade cai
   para ~43%.
2. **As sugestões do Gemini convergem no catálogo local.** As quatro faixas da A2
   (Nightcall, After Dark, Midnight City, Blinding Lights) estão **todas** no
   `FALLBACK` de `music.ts`. O modelo e o catálogo escrito à mão chegaram
   independentemente nos mesmos hits — que é a definição de "óbvio" e confirma que
   pedir músicas "populares" é a causa direta.
3. **O fallback do Deezer é 100% repetitivo**, como o T060 previa: B4 e B5 saíram
   idênticas. E a qualidade é ruim de um jeito próprio — devolve a *keyword* como
   se fosse faixa ("funk brasileiro / RVDENT", "Dream Pop / Earth Trax" três vezes).
4. **O Gemini falhou em 3 de 10 capturas** (`AbortError` aos 22s), sempre caindo no
   pior caminho. Quando responde, é rápido: 2,5–6,6 s (mediana ~3,8 s), coerente com
   o SC-Q03 recalibrado na D1.

### Armadilha achada ao preparar o T059

`https://api.deezer.com/search/artist?q=<nome>` **não serve** para medir fama: devolve
homônimos obscuros. Consultado assim, "Kavinsky" volta com `nb_fan=108`, "Anitta" com
`177` e "Bon Iver" com `28`. O caminho correto é pegar o `artist.id` do resultado da
busca de **faixa** e consultar `/artist/{id}` — aí os números batem: Kavinsky 491.886,
M83 964.578, The Weeknd 14.622.743.

Evidências em `docs/preview/fase14/t056-*.png`.

---

## T061 — Verificação da Fase 14, mesmo roteiro do T056

Cinco capturas da mesma cena (teclado mecânico no escuro → `noturna` em 5/5),
depois do T057–T060.

| # | Faixas |
|---|---|
| f1 | Midnight City / M83 · Komorebi / Swayzak · Faintly / Lullatone · Águas de Março / Elis Regina e Tom Jobim |
| f2 | Nightcall / Kavinsky · Kimi wa Bara yori Utsukushii / Akira Fuse · Apenas Mais uma de Amor / Lulu Santos · Windowlicker / Aphex Twin |
| f3 | Resonance / Home · Natsu no Hi / Taeko Onuki · L'inverno / Mino Capelli · Blue Monday / New Order |
| f4 | Giorgio by Moroder / Daft Punk · Sigh / Cymande · Kaerukana / Lamp · Canto de Ossanha / Baden Powell e Vinícius |
| f5 | Nightcall / Kavinsky · Samba do Avião / Célia · Sorrowful Rain / H.u.d.a · Merry Christmas Mr. Lawrence / Ryuichi Sakamoto |

### Lado a lado com a linha de base

| Métrica | T056 (cena A) | T056 (cena B) | T061 | Critério |
|---|---|---|---|---|
| Faixas distintas em 20 | 11 | 9 | **19** | ≥ 15 ✅ |
| Artistas distintos em 20 | 9 | 8 | **19** | — |
| Artista mais repetido | Kavinsky 4/5 | Taylor Swift 3/5 | Kavinsky 2/5 | — |

A única repetição em 20 posições foi «Nightcall / Kavinsky», entre f2 e f5.
**Critério de faixas distintas: atingido (19 de 20, contra 11 e 9).**

### O segundo critério **não** foi verificado, e o motivo importa

O T061 também pedia "pelo menos uma `descoberta` por rodada com `nb_fan` abaixo do
limiar". Isso só pôde ser **comprovado numericamente em 1 das 5 rodadas** (Akira
Fuse, `nb_fan=158`). Nas outras a verificação não teve o que medir: consultados um a
um, **6 dos 8 artistas dos slots de descoberta não existem no Deezer** — Swayzak,
Lullatone, Taeko Onuki, Mino Capelli, Lamp, H.u.d.a.

Não é o rótulo mentindo: é o contrário. Um artista que o Deezer sequer cataloga está
bem além do limiar de "menos conhecido". Mas a prova numérica que a task pediu não
existe para eles, e o número real é **1 de 5**, não 5 de 5.

Onde a verificação teve dado, ela funcionou nos dois sentidos: **Lulu Santos foi
rebaixado** para `curinga` (`nb_fan=1.263.164`) e Akira Fuse confirmado.

### O custo escondido da diversidade: som

Medido com o marcador de preview no log, a assinatura típica de uma curadoria do
Gemini agora é **`audio=2/4`**:

```
audio=2/4 ♪«Nightcall — Kavinsky»[certeira] | ·«Sintetizador — Gorduratrans»[descoberta]
        | ·«Friction — Plaid»[descoberta] | ♪«Canto de Ossanha — Baden Powell»[curinga]
```

Quanto mais obscura a faixa, menor a chance de o Deezer tê-la — e é o preview que dá
a **metade sonora** do pacote, que é o Pilar 2 do produto. Diversificar sem olhar isto
seria trocar repetição por silêncio.

O que segura o produto é a própria distribuição de papéis: `certeira` e `curinga`
resolvem quase sempre, e o `CaptureSheet` já escolhe automaticamente
`sugestoes.find(m => m.previewUrl)`. Ou seja, **o pacote nunca sai mudo por causa da
descoberta** — ela ocupa um slot de proposta, não o slot da trilha. Em 5 rodadas,
todas tinham ao menos uma faixa com áudio.

Fica como pendência real, e é do tipo que precisa de decisão de produto: uma
`descoberta` sem preview aparece na lista com o play apagado. Ela cumpre o papel de
sugerir, mas não dá para ouvir antes de escolher. Ver **D8**.

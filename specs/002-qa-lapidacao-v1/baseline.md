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

_A preencher após a instrumentação de `analyzePhotoAndSuggest`._

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

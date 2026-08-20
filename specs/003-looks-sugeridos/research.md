# Research — Looks sugeridos com memória de gosto (F0)

**Feature**: 003-looks-sugeridos · **Data**: 2026-08-19

As três incógnitas que o plano abriu na fase F0, resolvidas antes de qualquer código de produção.

---

## R1 — Formato do trecho de look na resposta do Gemini

**Decisão**: o trecho de look entra como um array `looks` no **mesmo JSON** que já traz `vibe`, `cena` e `musicas`. Nenhuma chamada nova (D1).

```json
{
  "vibe": "dourada",
  "cena": "praia ao entardecer com silhuetas",
  "looks": [
    {
      "base": "honey",
      "nome": "Fim de tarde",
      "papel": "certeira",
      "justificativa": "puxa o dourado do sol baixo",
      "ajustes": { "brilho": 0.04, "saturacao": 0.15, "contraste": 0.05, "sepia": 0.05, "veu": 0.03 }
    },
    { "base": "eclipse", "nome": "Contraluz", "papel": "ousada", "justificativa": "...", "ajustes": { } }
  ],
  "musicas": [ ... ]
}
```

**Por que delta e não valor absoluto**: pedir `{"saturacao": 1.55}` deixa o modelo escolher o ponto de partida, e o ponto de partida é justamente o que dá identidade ao app. Pedir `{"base": "honey", "ajustes": {"saturacao": +0.15}}` faz o modelo pousar sempre num lugar são — o pior caso vira "o preset Honey puro", que é um resultado bom. É a mesma lição do T056 registrada em `src/services/music.ts`: a instrução precisa fixar o formato, senão o modelo governa o resultado.

**Nomes dos campos de ajuste em pt-BR** (`brilho`, `saturacao`, `contraste`, `sepia`, `veu`): o prompt inteiro é em pt-BR e misturar idiomas nos nomes de campo aumenta a chance de o modelo inventar variação. `veu` é o desvio da opacidade do overlay de cor do preset.

**Campos obrigatórios**: `base` e `nome`. Todo o resto é opcional.

**Degradação por campo** (nunca rejeitar a resposta inteira por um campo ruim):

| Situação | Tratamento |
|---|---|
| `base` ausente ou não é um dos 8 ids | descarta **este** look; os demais seguem |
| `ajustes` ausente ou vazio | vira `{}` — o look é o preset base puro, e isso é válido |
| campo de ajuste fora de faixa | clampado em R2, não descartado |
| `nome` ausente | usa o nome do preset base |
| `justificativa` ausente | string vazia; o chip só não mostra a linha |
| `papel` fora de `certeira`/`ousada` | cai para a posição pedida no prompt, como `papelDe()` já faz para faixas |
| menos de 2 looks utilizáveis | `montarLooks()` completa com looks base derivados da vibe |

**`afinidade` nunca é pedido ao modelo.** O prompt oferece só `certeira` e `ousada`. Se o modelo devolver `afinidade` mesmo assim, o valor é rejeitado e vira `certeira` — o rótulo de afinidade é montado no aparelho e mentir nele quebraria FR-013.

---

## R2 — Faixas seguras de clamp

**Decisão**: duas barreiras em série. Primeiro o **delta** é limitado; depois o **valor absoluto resultante** é limitado de novo. Um delta legítimo somado a um preset já extremo ainda pode sair da faixa, então limitar só o delta não basta.

### Barreira 1 — delta aceito do modelo

| Campo | Mín | Máx | Motivo |
|---|---|---|---|
| `brilho` | −0.20 | +0.20 | além disso a foto vira chapa branca ou preta |
| `saturacao` | −0.50 | +0.50 | permite dessaturar bem ou puxar bastante cor sem virar poster |
| `contraste` | −0.25 | +0.25 | acima disso as sombras fecham e estouram as altas |
| `sepia` | −0.30 | +0.30 | sepia é o mais agressivo: pouco já muda muito |
| `veu` | −0.15 | +0.15 | opacidade de overlay; +0.15 sobre 0.35 já é um véu pesado |

### Barreira 2 — valor absoluto final

| Campo | Mín | Máx | Neutro |
|---|---|---|---|
| `brightness` | 0.70 | 1.30 | 1 |
| `saturate` | 0.00 | 2.00 | 1 |
| `contrast` | 0.75 | 1.45 | 1 |
| `sepia` | 0.00 | 0.80 | 0 |
| `overlayOpacity` | 0.00 | 0.50 | 0 |

`saturate` chega a 0 de propósito: preto e branco é um look legítimo, não um erro. `sepia` para em 0.80 porque 1.0 apaga a foto por baixo do tom.

**Valor não numérico** (string, `null`, `NaN`, `Infinity`) → tratado como delta 0. O clamp nunca propaga `NaN`, senão um único campo podre apagaria a imagem inteira.

### Limiar de redundância (D4)

Dois looks são considerados o mesmo quando a distância entre suas receitas fica **abaixo de 0.12**, com a distância definida como a soma dos módulos das diferenças dos cinco campos absolutos, cada um normalizado pela largura da própria faixa da Barreira 2. Looks com `base` diferente partem de identidades visuais distintas e são comparados pelo mesmo cálculo — não há atalho por `base`, porque dois presets diferentes com ajustes opostos podem convergir para a mesma imagem.

Valor escolhido por inspeção dos 8 presets: os dois presets mais próximos entre si — `vivid` e `honey` — ficam em ~0.19 nessa métrica. Um limiar de 0.12 fica abaixo disso, então nunca acusa dois presets base distintos como redundantes, mas ainda pega dois looks que o modelo devolveu praticamente iguais.

---

## R3 — API do Skia para matriz de cor e render offscreen

**Decisão**: `@shopify/react-native-skia`, com **carga opcional em tempo de execução**.

### Por que carga opcional

Skia é módulo nativo: instalar o pacote npm não basta, o dev build precisa ser regerado. Um import estático transformaria "ainda não rebuildei" em "o app não abre" — e US1/US2 não têm nada a ver com Skia. Então `src/services/skiaBridge.ts` carrega o módulo dentro de `try/catch` e exporta `null` quando o nativo não está presente; `FilteredImage` cai no render atual (`style.filter` do RN + overlays) nesse caso.

Custo: uma indireção. Benefício: US1/US2/US4 são testáveis no dev build que já existe, e US3 acende sozinha depois do rebuild.

### Matriz de cor

`Skia.ColorFilter.MakeMatrix(m)` recebe 20 floats (4×5, RGBA + offset). A composição usada:

1. **saturação** — matriz padrão de luminância (0.213 / 0.715 / 0.072)
2. **contraste** — escala em torno de 0.5: `c` na diagonal, offset `0.5 * (1 - c)`
3. **brilho** — escala uniforme na diagonal
4. **sepia** — matriz sepia clássica, interpolada com a identidade pelo fator

As quatro são multiplicadas em série (`multiplicarMatrizes`) numa matriz só, e o overlay de cor do preset vira um `Skia.Paint` com `BlendMode.SrcOver` desenhado por cima. Uma matriz só em vez de quatro filtros encadeados: é um passe de GPU em vez de quatro.

### Render offscreen em resolução cheia

```ts
const surface = Skia.Surface.MakeOffscreen(largura, altura)   // dimensões da foto ORIGINAL
const canvas  = surface.getCanvas()
const paint   = Skia.Paint()
paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matriz))
canvas.drawImageRect(imagem, origem, destino, paint)
// overlays de cor do preset por cima, com o mesmo canvas
const bytes = surface.makeImageSnapshot().encodeToBytes()      // PNG/JPEG
```

O arquivo sai por `expo-file-system` no `cacheDirectory`. É isto que substitui `captureRef(previewRef)` em `CaptureSheet.tsx` — hoje o export é literalmente um print da prévia, então o arquivo nasce na resolução da tela, não da foto (FR-024).

**Alternativa descartada**: `expo-image-manipulator`. Ele redimensiona, corta e gira, mas não tem matriz de cor — não há como aplicar saturação/contraste por ele. Ele continua no projeto para o que já faz (reduzir a foto para envio ao Gemini).

---

## Consequências para as fases seguintes

- **F1** pode escrever `AjustesLook` com os cinco campos de R2 e `LookRecipe` com `base` obrigatório.
- **F2 (US1)** tem o formato de prompt fechado por R1 e a tabela de degradação por campo.
- **F4 (US3)** tem a API de Skia fechada por R3, e a carga opcional garante que ela não bloqueia as demais.

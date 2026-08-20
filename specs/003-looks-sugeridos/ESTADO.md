# ESTADO — onde parei e o que falta (feature 003)

**Atualizado**: 2026-08-20 · **Branch**: `claude/current-filter-system-6gpmbh`

Sessão interrompida a pedido (máquina descartável, sem device conectado — só
dava para mexer em código e verificar por `typecheck`/bundle, nunca rodar o
app). Este arquivo existe para a próxima máquina saber exatamente onde a
implementação parou, o que testar e o que ainda falta. O detalhamento por
tarefa está em [tasks.md](./tasks.md), que é a fonte de verdade — leia-o, não
só este resumo.

## Atualização 2026-08-20 (sessão sem device — só código)

Fechadas nesta rodada, todas por leitura/typecheck/bundle, **nenhuma por
execução no aparelho**: **T032, T033 (parcial), T034, T035, T036, T037, T044,
T045, T046**.

- **T032** — já estava implementado desde a criação do `LookChips.tsx`
  (`papelAfinidade: { color: colors.amber }`); só o checkbox estava
  desatualizado.
- **US3 (T033–T037)** — a fatia inteira do Skia, exceto o rebuild em si e a
  verificação visual (T038, continua em aberto). Resumo técnico:
  - `src/services/skiaBridge.ts` (novo): carrega `@shopify/react-native-skia`
    via `import()` dinâmico, memoizado, nunca lança — devolve `null` quando o
    nativo não está presente. Nenhum outro arquivo do app importa o pacote
    estaticamente; é assim que a carga opcional da R3 se cumpre de verdade
    (ver decisão abaixo sobre por quê isso importa mais do que parece).
  - `src/services/looks.ts` ganhou `matrizDeCor(filtro: FilterDef)`: compõe
    saturação → contraste → brilho → sepia numa matriz 20-floats só, seguindo
    a fórmula da R3 do `research.md`. Testado só por leitura da matemática —
    **nunca visto renderizado**.
  - `src/services/renderLook.ts` (novo): render offscreen em resolução cheia
    (`Skia.Surface.MakeOffscreen`), overlay do preset desenhado por cima, sai
    em PNG (não JPEG — evitar depender do enum `ImageFormat` do módulo
    carregado dinamicamente por um ganho pequeno de tamanho de arquivo).
  - `src/components/FilteredImage.tsx` reescrito: `FilteredImage` tenta
    `carregarSkia()` num `useEffect` e escolhe entre `FilteredImageSkia`
    (Canvas + ColorMatrix, tudo vindo do módulo carregado, zero import
    estático do pacote) e `FilteredImageLegado` (o render RN de sempre,
    idêntico ao que existia antes desta sessão).
  - `src/components/CaptureSheet.tsx`: `renderizarComFiltro()` agora tenta
    `renderLook` (Skia) primeiro e só cai para `captureRef` (view-shot) se o
    Skia devolver `null`.
- **T044** — `npm run typecheck` verde, inclusive depois de instalar o Skia.
- **T045** — `FilterLayer.tsx` mantido (não removido): ainda tem dois
  consumidores reais, o visor ao vivo (`camera.tsx`, FR-021) e o
  `FilteredImageLegado` — comentário do arquivo atualizado para explicar isso.
- **T046** — `CLAUDE.md` e `README.md` atualizados: a nota "Mudou em
  2026-08-19" no `CLAUDE.md` descreve a troca da tabela fixa pelos três
  looks; o `README.md` ganhou a mesma ideia no pilar 1, na tabela de
  adaptações do Expo Go e na lista de stack.

## Por que a máquina não conseguiu ir além disso

Duas coisas que dava para fazer sem device, e que valeram a pena:

1. **`npm install` + `npm run typecheck`** rodaram normalmente (rede
   disponível nesta máquina) — todo o código novo typecheca limpo.
2. **`npx expo export --platform android`** (bundle Metro real, sem instalar
   no aparelho) foi usado para confirmar uma dúvida séria antes de escrever
   qualquer linha: `@shopify/react-native-skia` importa `react-native-reanimated`
   em algum canto do próprio pacote (`src/external/reanimated/interpolators.ts`),
   e esse pacote **não está instalado**. Se essa importação fosse estática de
   verdade, o bundle inteiro quebraria assim que qualquer arquivo do app
   tocasse em Skia — não um degrade elegante, um app que não abre. O teste
   (arquivo temporário importando o pacote a partir de `app/_layout.tsx`,
   removido depois) confirmou que o próprio Skia isola essa dependência atrás
   de um `ReanimatedProxy` interno, e o bundle sai limpo (3.22 MB → 3.71 MB,
   só o peso do JS do Skia) sem precisar instalar `react-native-reanimated`.
   **Isso não estava no `research.md` original** — é a única lacuna real que
   encontrei na pesquisa da R3, e valeu a pena confirmar antes de codar às
   cegas.

O que **não** deu para fazer, e por quê:
- `npm run android` (T033, o rebuild nativo em si) exige um device ou
  emulador conectado — não existe nesta máquina.
- Qualquer verificação visual (T038, T047, T048 parcial) exige o app rodando
  de verdade — sem isso, "typecheca" e "bundla" é tudo que se pode afirmar.
  **Nada do caminho Skia foi visto renderizado nem uma vez.**

## Validação real no device (2026-08-20, sessão anterior — antes desta)

Isto já estava confirmado numa sessão anterior, **com device**, antes desta
rodada sem device começar. Continua valendo, nada aqui mudou:

- **US1 confirmada de ponta a ponta.** Capturei uma foto de mesa com LED
  vermelho; voltaram três looks — "Deep Dark" (papel DA CENA, "Aprofunda as
  sombras, realçando o brilho dos LEDs"), "Red Glitch" (MAIS OUSADA) e um
  terceiro cortado na tela. O primeiro veio aplicado sozinho, sem toque
  (FR-004). A justificativa citou os LEDs de verdade da cena — a leitura do
  Gemini é real, não genérica.
- **FR-005 confirmada**: trocar de chip muda a prévia em bem menos de meio
  segundo, sem qualquer chamada nova (conferido no logcat).
- **T023 confirmada**: tocar em "Original" limpa a receita, a prévia volta às
  cores cruas, nenhum chip fica marcado.
- **FR-006 confirmada**: os 8 presets aparecem no mesmo carrossel, depois das
  sugestões.
- **T039 confirmada de verdade**: salvei com "Deep Dark" escolhido, fechei a
  tela (voltou pro visor, miniatura da galeria atualizou), abri a galeria — o
  card já mostrava o tratamento certo.
- **T043 confirmada por log, não só por leitura**: reabri a mídia salva pela
  galeria (entra como "Lapidar.", `editando` correto) com o look certo
  restaurado — e `adb logcat` limpo antes e lido depois **não mostrou nenhuma
  chamada de rede**. Reabrir não redispara curadoria.
- Música também validada de quebra: a trilha vinda do Gemini ("Nightcall",
  Kavinsky) tinha justificativa coerente com a cena real.

**Ainda não testado em device, nem nesta sessão nem na anterior**: US2 na
prática (repetir 5-6 capturas da mesma vibe pra ver a afinidade aparecer — é
um roteiro longo), T031 na prática (o botão de apagar histórico existe e o
código está certo, mas ninguém tocou nele no aparelho), e **US3 inteira**
(Skia — código completo agora, zero minutos rodado).

**Nota para a próxima sessão**: toques por `adb shell input tap` neste device
só acertam de forma confiável usando a calibração já registrada em
`docs/TESTE-NO-DEVICE.md`/`specs/002-qa-lapidacao-v1/quickstart.md`
(`y=2180` acerta o botão de ação primária do rodapé; `y=2213` erra).

---

## Como retomar

```bash
npm install          # node_modules não vem no repo
npm run typecheck    # tem que sair verde — estava verde no commit
npm run android      # dev build; NÃO é Expo Go — e É ESTE COMANDO QUE FALTA RODAR
```

`npm run android` agora vai **regerar o dev build com o módulo nativo do
Skia dentro** (T033) — é a primeira coisa a fazer, e é o pré-requisito de
tudo mais desta lista. Sem rodar isso, o app funciona exatamente como antes
(cai para `FilteredImageLegado`), então não há risco em tentar; só não dá
para validar US3 antes disso.

Precisa de `EXPO_PUBLIC_GEMINI_API_KEY` no `.env` para ver os looks vindos da
cena. **Sem a chave o app funciona igual** — cai nos três looks base
derivados da vibe, que é justamente o que FR-019/SC-004 exigem.

---

## Situação por fase

| Fase | Tarefas | Situação |
|---|---|---|
| 1 — Setup (F0) | T001–T002 | ✅ completa |
| 2 — Foundational (F1) | T003–T013 | ✅ completa |
| 3 — US1 (MVP) | T014–T025 | ✅ completa |
| 4 — US2 | T026–T032 | ✅ completa (falta validar T031 e a US2 inteira **no device**, não é código) |
| 5 — US3 (Skia) | T033–T038 | 🟡 código completo, **zero rodado**: falta o rebuild (T033) e a verificação visual (T038) |
| 6 — US4 | T039–T043 | ✅ completa |
| 7 — Polish | T044–T048 | 🟡 T044–T046 feitas; T047/T048 bloqueadas por device |

---

## O que falta, em ordem de valor

1. **`npm run android`** (T033) — regerar o dev build com o Skia nativo
   dentro. Sem isso, nada do resto desta lista pode ser verificado.
2. **T038 — paridade visual.** Com o mesmo device de sempre: capturar uma
   foto, conferir que os três looks saem visualmente distintos, e que o
   arquivo salvo/exportado (galeria do sistema, ou o `.png` que
   `renderLook.ts` gera em `cache/synesthesia-looks/`) tem a resolução da
   foto original, não da tela. **Ponto de maior risco desta sessão**: a
   matemática da matriz de cor (`matrizDeCor`) e a composição de overlay em
   `renderLook.ts` nunca foram vistas renderizadas — é onde um erro de sinal
   ou de ordem de composição mais provavelmente apareceria.
3. **Comparar visualmente o antes/depois do Skia na prévia do Modal de
   Captura** — antes desta sessão a prévia usava só `style.filter` do RN;
   agora, com o rebuild feito, ela deve trocar para o Canvas do Skia
   automaticamente (o `useEffect` de `FilteredImage` troca sozinho). Vale
   conferir que a troca acontece sem flash feio e que os três chips de look
   continuam parecendo as mesmas três opções de antes.
4. **US2 na prática** — repetir 5-6 capturas da mesma vibe com o mesmo
   tratamento e ver a sexta vir rotulada "DO SEU JEITO" (amber, T032).
5. **T031 na prática** — apagar o histórico de gosto visual pelos Ajustes.
6. **T047/T048** — rodar o `quickstart.md` inteiro e riscar os SC-001 a
   SC-009 (SC-006/SC-007 são os dois que só o Skia resolve; os outros sete
   já foram confirmados na sessão anterior, ver acima).

---

## O que dá para testar agora, no device, sem rebuild nenhum

Se por algum motivo o rebuild do Skia não rolar logo, tudo isto continua
funcionando exatamente como na sessão anterior — nada regrediu:

1. Capturar uma foto com a chave configurada → o modal abre com **três** chips
   de look, o primeiro já aplicado à prévia, cada um com nome, papel e uma
   linha de justificativa.
2. Tocar no segundo chip → a prévia muda na hora, sem spinner e sem rede.
3. Tocar numa das 8 miniaturas → a receita é zerada e vale o preset puro.
4. Desligar o Wi-Fi e capturar → **ainda saem três looks** (os base da vibe) e
   o botão Salvar continua acionável o tempo todo.
5. Reabrir uma foto salva **antes** desta feature pela galeria → abre normal,
   com o tratamento que tinha, sem erro (FR-023).

---

## Decisões tomadas nesta sessão que não estavam no plano

- **`react-native-reanimated` não precisa ser instalado.** O `research.md`
  (R3) não menciona essa dependência transitiva do Skia. Confirmado por
  bundle real (`npx expo export`) que o próprio pacote isola o uso de
  reanimated atrás de um proxy interno — ver seção acima. Registrado aqui
  para que ninguém perca tempo reinvestigando o mesmo medo.
- **`captureRef`/`react-native-view-shot` foi mantido**, não removido, ao
  contrário do que a T037 sugeria literalmente ("removendo... se não tiver
  outro uso"). Motivo: a carga opcional da R3 existe justamente para que
  US1/US2/US4 funcionem sem o rebuild — se `renderizarComFiltro()` dependesse
  só do Skia, salvar/postar **antes** do `npm run android` sairia sem filtro
  nenhum, enquanto a prévia na tela (que já cai para o render legado nesse
  caso) mostraria um filtro aplicado. Ou seja: sem o `captureRef` como rede
  de segurança, o arquivo salvo pararia de bater com o que a pessoa via na
  tela — exatamente o tipo de regressão que a R3 foi desenhada para evitar.
  Uma vez que o rebuild rodar, os dois caminhos convergem (Skia sempre
  disponível) e o `captureRef` vira código morto — aí sim dá para removê-lo,
  mas só depois de confirmar em device que o Skia nunca falha.
- **`matrizDeCor()` opera sobre `FilterDef` resolvido, não sobre
  `LookRecipe`.** A T034 pedia a conversão "de `LookRecipe`", mas
  `FilterDef` (já resolvido por `resolverReceita()` ou `filterById()`) é o
  denominador comum entre um look com receita e um dos 8 presets escolhido
  puro — os dois passam pela mesma barreira de clamp antes de chegar à
  matriz, e duplicar a função para os dois casos não teria ganho nenhum.
- **`renderLook.ts` exporta PNG, não JPEG.** `encodeToBytes()` do Skia já sai
  em PNG por padrão; pedir JPEG exigiria importar o enum `ImageFormat` do
  módulo carregado dinamicamente, um passo a mais por um ganho pequeno de
  tamanho de arquivo. Se o tamanho do `.png` incomodar no device (fotos a
  cores costumam comprimir pior em PNG que em JPEG), trocar é uma linha só.
- **`FilteredImage` decide Skia-ou-legado por instância, com um flash
  possível no primeiro frame.** Cada instância do componente começa
  renderizando o caminho legado (estado inicial `null`) e só troca para Skia
  depois que `carregarSkia()` resolve, no `useEffect`. Em telas com várias
  miniaturas ao mesmo tempo (`FilterThumbs`: 9 instâncias na mesma foto),
  isso significa até 9 decodificações independentes da mesma imagem via
  `useImage` do Skia — **não tem cache compartilhado entre elas**. Decidi não
  adicionar uma camada de cache nesta sessão: sem device para medir se isso
  realmente pesa (a imagem é decodificada uma vez por miniatura, não por
  frame), uma otimização às cegas arriscava mais bug do que resolvia. Vale
  medir no device antes de decidir se compensa.
- **Anteriores desta feature, mantidas sem mudança**: `FilterThumbs`, não
  `FilterCarousel`; faixas de clamp em `constants/filters.ts`; `chaveDaEscolha`
  na store; limiar de afinidade com dois critérios. Ver histórico de commits
  para o raciocínio de cada uma.

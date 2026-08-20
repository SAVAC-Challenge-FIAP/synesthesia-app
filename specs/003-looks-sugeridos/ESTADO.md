# ESTADO — onde parei e o que falta (feature 003)

**Atualizado**: 2026-08-20 · **Branch**: `claude/current-filter-system-6gpmbh`

Sessão interrompida a pedido (máquina descartável). Este arquivo existe para a
próxima máquina saber exatamente onde a implementação parou, o que testar e o
que ainda falta. O detalhamento por tarefa está em [tasks.md](./tasks.md).

## Atualização 2026-08-20

Fechadas nesta rodada: **T013, T023, T025, T030, T031, T039, T042, T043**.
`npm run typecheck` segue verde.

- **T039/T042** — `CaptureSheet.salvar()` agora grava `looks`/`lookEscolhido`
  no registro, nos dois caminhos (criação e edição/`update()`). Antes disso a
  US4 só funcionava pela reconstrução de mídia antiga; a decisão real nunca
  persistia.
- **T043** — verificado por leitura: o guard `mediaId !== null` no `useEffect`
  de análise já retorna antes de qualquer chamada de rede, então reabrir uma
  mídia com `looks` nunca redisparava curadoria. Não precisou de código novo.
- **T023/T025/T030** — verificados por leitura, não por execução (ver abaixo).
  `analyzePhotoAndSuggest` nunca rejeita: toda saída (cena lida, pipeline por
  vibe, catch interno) passa por `montarLooks()`, sempre três looks. "Original"
  já limpava a receita (`escolherFiltro(null)` já zerava `lookEscolhido`).
  `useLookTasteStore` não é importado em `music.ts` — confirmado por grep.
- **T031** — Ajustes ganhou "Histórico de gosto visual" na seção Privacidade,
  com confirmação explícita antes de `useLookTasteStore.limpar()`.
- **T013** — `quickstart.md` escrito, no molde do da feature 002.

## Validação real no device (2026-08-20, mesma rodada)

O bloqueio inicial de instalação (`INSTALL_FAILED_USER_RESTRICTED`, MIUI) era
um falso alarme: **o app já estava instalado** (`pm list packages` confirmou),
e as mudanças desta rodada são só JS/TSX — bastava subir o Metro
(`docs/TESTE-NO-DEVICE.md`), sem rebuild nativo nenhum. Rodado no Redmi Note 8
Pro real, por Wi-Fi, com captura de tela a cada passo:

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

**Ainda não testado nesta rodada**: US2 (repetir 5-6 capturas da mesma vibe
pra ver a afinidade aparecer — é um roteiro longo, não coube aqui), T031 na
prática (o botão existe e o código está certo, mas ninguém tocou nele no
aparelho), e US3 inteira (Skia nem começou).

**Nota para a próxima sessão**: toques por `adb shell input tap` neste device
só acertam de forma confiável usando a calibração já registrada em
`docs/TESTE-NO-DEVICE.md`/`specs/002-qa-lapidacao-v1/quickstart.md`
(`y=2180` acerta o botão de ação primária do rodapé; `y=2213` erra). Estimar
coordenada a partir do screenshot redimensionado por conta própria errou o
alvo várias vezes nesta sessão antes de eu achar essa referência.

---

## Como retomar

```bash
npm install          # node_modules não vem no repo
npm run typecheck    # tem que sair verde — estava verde no commit
npm run android      # dev build; NÃO é Expo Go
```

Precisa de `EXPO_PUBLIC_GEMINI_API_KEY` no `.env` para ver os looks vindos da
cena. **Sem a chave o app funciona igual** — cai nos três looks base derivados
da vibe, que é justamente o que FR-019/SC-004 exigem. Testar nos dois modos é
uma verificação, não um contorno.

---

## Situação por fase

| Fase | Tarefas | Situação |
|---|---|---|
| 1 — Setup (F0) | T001–T002 | ✅ completa |
| 2 — Foundational (F1) | T003–T013 | ✅ exceto **T013** (quickstart.md não escrito) |
| 3 — US1 (MVP) | T014–T025 | 🟡 parcial — falta T025 e a metade de T023 |
| 4 — US2 | T026–T032 | 🟡 parcial — **T029 não aplicado**, T030/T031 pendentes |
| 5 — US3 (Skia) | T033–T038 | ❌ não começou |
| 6 — US4 | T039–T043 | 🟡 parcial — T040/T041 feitos, T039/T042/T043 pendentes |
| 7 — Polish | T044–T048 | ❌ não começou |

---

## O que já está no código e funciona

**Fundação completa.** `LookRecipe`/`PapelLook`/`AjustesLook` em `src/types.ts`,
`Media.looks`/`Media.lookEscolhido` aditivos, `resolverReceita()` +
as duas barreiras de clamp em `src/constants/filters.ts`, e o serviço
`src/services/looks.ts` inteiro (clamp, distância, dedupe, looks base,
`montarLooks()`, `lookDeAfinidade()`, `looksDeMidiaAntiga()`).

**Curadoria.** `src/services/music.ts` pede os 2 looks na **mesma** chamada
multimodal, com `instrucaoDeLook()`, e devolve `looks` nos **três** caminhos de
retorno (cena lida / pipeline por vibe / degradado). Cache por `photoUri`
implementado (FR-009).

**Estado e interface.** `CaptureSession` ganhou `looks`/`lookEscolhido`/`lookAuto`;
`src/components/LookChips.tsx` criado; o `CaptureSheet` renderiza os chips acima
das miniaturas, aplica a sugestão principal sozinho (FR-004) e troca entre elas
sem rede (FR-005). `chavePacote` já inclui a identidade do look.

**Histórico.** `src/stores/useLookTasteStore.ts` completo, com os dois critérios
de limiar de afinidade, e `montarLooks()` já consome a afinidade no slot 1.

**Galeria.** `app/gallery.tsx` reabre com os looks salvos e reconstrói o conjunto
para mídias antigas via `looksDeMidiaAntiga()`.

---

## ⚠️ Leia antes de testar

O gosto visual **já é gravado** — o T029 entrou no último minuto: `salvar()`
chama `registrarEscolhaVisual` com `auto`/`manual` conforme `lookAuto`.

**Nada disso foi rodado em device.** O caminho compila e está completo, mas
ninguém verificou "salve cinco vezes na mesma vibe e veja a sexta vir rotulada
DO SEU JEITO". É a primeira coisa a conferir.

O que ainda falta para a US2 fechar é o **T031** (apagar o histórico pelos
Ajustes) — sem ele não há como voltar ao estado de aparelho novo pela interface,
e o cenário US2.6 fica sem cobertura.

---

## O que falta, em ordem de valor

1. **T039 — persistir `looks`/`lookEscolhido` na `Media`.** Hoje o registro
   salvo ainda não leva os dois campos; sem isso a US4 só funciona pela
   reconstrução de mídia antiga, e a decisão real não persiste (FR-022).
3. **T043** — impedir que reabrir uma mídia com `looks` redispare curadoria.
4. **T042** — troca de look em mídia reaberta atualizar o registro e o histórico.
5. **T030/T031** — conferir que o gosto visual não entra no prompt (é o
   esperado: nada em `music.ts` lê a store) e pôr o "apagar histórico" nos Ajustes.
6. **T023** — escolher "Original" já limpa a receita; falta conferir no device.
7. **T025** — verificar a degradação nos três cenários (sem chave, sem rede, 22s).
8. **T013** — escrever o `quickstart.md`.
9. **US3 inteira (T033–T038)** — Skia. Nada começou. **Atenção**: instalar
   `@shopify/react-native-skia` exige regerar o dev build; a decisão R3 do
   `research.md` prevê carga opcional justamente para que isso não derrube
   US1/US2 enquanto o rebuild não acontece.

---

## O que dá para testar agora, no device

Vale a pena mesmo com o buraco acima — cobre US1 quase inteira:

1. Capturar uma foto com a chave configurada → o modal abre com **três** chips
   de look, o primeiro já aplicado à prévia, cada um com nome, papel e uma linha
   de justificativa.
2. Tocar no segundo chip → a prévia muda na hora, sem spinner e sem rede.
3. Tocar numa das 8 miniaturas → a receita é zerada e vale o preset puro.
4. Desligar o Wi-Fi e capturar → **ainda saem três looks** (os base da vibe) e
   o botão Salvar continua acionável o tempo todo.
5. Reabrir uma foto salva **antes** desta feature pela galeria → abre normal,
   com o tratamento que tinha, sem erro (FR-023).
6. Nenhum chip deve aparecer rotulado `DO SEU JEITO` — correto por enquanto,
   já que o histórico não está sendo gravado.

---

## Decisões tomadas nesta sessão que não estavam no plano

- **`FilterThumbs`, não `FilterCarousel`.** O plano listava `FilterCarousel.tsx`
  como o carrossel a alterar, mas esse é o do **visor ao vivo**, que FR-021 manda
  deixar em paz. O carrossel do modal de captura é o `FilterThumbs`. Registrado
  também na nota da T022.
- **Faixas de clamp em `constants/filters.ts`**, não em `looks.ts`: `looks.ts` já
  importa `filters.ts`, e pôr as faixas lá criaria import circular.
- **`chaveDaEscolha` mora na store**, e `looks.ts` a importa — mesma razão de
  ciclo. `identidadeDoLook()` delega para ela em vez de duplicar a regra.
- **Limiar de afinidade com dois critérios** (peso ≥ 2.0 **e** ≥ 2 escolhas na
  vibe). Só o peso deixaria uma única troca manual (3.0) passar sozinha, e o
  edge case da spec diz o contrário.

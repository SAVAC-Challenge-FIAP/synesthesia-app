# Tasks: QA e Lapidação do MVP v1

**Feature**: `002-qa-lapidacao-v1` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Criado**: 2026-08-15

Backlog corretivo sobre o fluxo v1 já funcional. **Não adiciona funcionalidades** — remove atritos observados em teste real no dispositivo.

Legenda de status: ⬜ pendente · 🟡 em andamento · ✅ concluída
`[P]` = paralelizável (arquivos distintos, sem dependência pendente)

---

## ⚠️ Regras de execução autônoma

Este backlog é executado **em loop, sem ninguém para responder perguntas no meio**. Portanto:

1. **Nunca use EAS Build.** A cota está reservada para a publicação final. Só build local: `./scripts/dev-android.sh build`.
2. **Toda task exige evidência em dispositivo real.** Screenshot antes/depois via `./scripts/dev-android.sh shot`. Código que compila mas não foi visto rodando **não** conta como concluído.
3. **`npm run typecheck` precisa passar** antes de marcar qualquer task como ✅.
4. **Uma task por commit**, mensagem em pt-BR no imperativo.
5. **Se uma decisão de produto aparecer**, não invente: registre em "Dúvidas para o Sávio" no fim deste arquivo, implemente a alternativa mais conservadora (a que menos altera comportamento) e siga.
6. **Não regressão é obrigatória**: antes de fechar cada fase, confirme que o pacote exportado continua com trilhas `vide`+`soun`, codecs `avc1`+`mp4a` e a duração aprovada (ver [quickstart.md](./quickstart.md)).
7. Marque a task como ✅ **neste arquivo** ao concluir — é assim que o loop sabe o que já foi feito.

---

## Como retomar (ambiente)

Descoberto na marra na rodada de 2026-08-15 — não repita a busca:

```bash
# 1. adb NÃO está no PATH padrão
export PATH="/opt/homebrew/share/android-commandlinetools/platform-tools:$PATH"
adb connect 192.168.15.3:5555      # o modo Wi-Fi cai sozinho; reconecte sempre

# 2. Metro precisa estar de pé — sem ele o app roda o último bundle em memória
#    e suas mudanças de JS não aparecem (isso já enganou a rodada uma vez)
npx expo start --dev-client --host lan > /tmp/metro.log 2>&1 &

# 3. abrir o app apontando para o Metro — CONFIRA o IP do Mac, ele muda
ipconfig getifaddr en0
adb shell am start -a android.intent.action.VIEW \
  -d "synesthesia://expo-development-client/?url=http%3A%2F%2F<IP>%3A8081"
```

**Mudança de JS recarrega sozinha; mudança nativa (Kotlin, `styles.xml`, `app.json`) exige
`./scripts/dev-android.sh build`.** O APK instalado hoje já tem o `forceDarkAllowed=false`
compilado — sem ele o modo noturno do sistema reescreve a paleta inteira (ver Fase 7).

Para ler os logs do JS, use o **logcat com a tag `ReactNativeJS`**:

```bash
adb logcat ReactNativeJS:V '*:S'     # console.log do JS
adb logcat VideoMuxer:V '*:S'        # log do modulo nativo
```

⚠️ **Correção de 2026-08-15**: a versão anterior desta seção afirmava que `console.log` **não**
aparece no logcat e mandava usar o `/tmp/metro.log`. Isso está **errado** — o `console.log`
aparece sim, sob `ReactNativeJS`, e foi assim que o T038 foi medido. Já o `/tmp/metro.log` só
tem conteúdo se **esta** sessão tiver iniciado o Metro redirecionando para lá; se o Metro já
estava de pé de outra sessão, o arquivo fica vazio e engana.

Note também que `adb logcat -d` (dump) às vezes volta vazio neste aparelho; o que funciona de
forma confiável é o modo streaming redirecionado para arquivo, com `&`, e `kill` no fim.

---

## Fase 1 — Setup e linha de base

> Sem medir, otimizar é chute. Esta fase só coleta números e evidências; não altera comportamento.

- [X] T001 Confirmar ambiente e device respondendo, registrando a saída de `adb devices` em `specs/002-qa-lapidacao-v1/baseline.md`
- [X] T002 [P] Capturar screenshots da linha de base de todas as telas afetadas (câmera, captura, música, postagem, galeria) em `docs/preview/baseline/` via `./scripts/dev-android.sh shot`
- [X] T003 [P] Medir e registrar em `specs/002-qa-lapidacao-v1/baseline.md` o tempo entre disparo e trilha visível, em 5 capturas, com mediana — é a linha de base do SC-Q03
- [X] T004 [P] Registrar em `baseline.md` o menor valor de `y` que ainda aciona os botões primários (linha de base medida: y=2180 aciona, y=2213 não), em navegação por botões **e** por gestos

---

## Fase 2 — Fundação

> Bloqueia as fases seguintes: sem o provedor de insets no lugar certo, nenhuma correção de layout se sustenta.

- [X] T005 Confirmar que `react-native-safe-area-context` está disponível na árvore de dependências; se não estiver, instalar com a versão alinhada ao SDK 54 via `npx expo install`
- [X] T006 Garantir que o provider de safe area envolve a árvore de navegação em `app/_layout.tsx`, sem alterar layout existente

---

## Fase 3 — US1: Alcançar os botões de ação (P1) 🔴

**Objetivo**: 100% dos toques dentro da área visível de um botão primário acionam a ação.
**Princípio**: II (Redução do Atrito de Decisão) · **FR**: Q01, Q02, Q03
**Teste independente**: tocar na borda inferior de cada botão primário e confirmar que dispara.

- [X] T007 [US1] Substituir espaçamento inferior fixo por inset real do dispositivo na barra de ações de `src/components/CaptureSheet.tsx` (botões Salvar / Postar agora)
- [X] T008 [P] [US1] Aplicar inset inferior real nos controles de `app/camera.tsx` (captura, galeria, virar câmera)
- [X] T009 [P] [US1] Aplicar inset inferior real em `src/components/PostSheet.tsx` (grade de destinos, Baixar vídeo, Fechar)
- [X] T010 [P] [US1] Aplicar inset inferior real em `src/components/MusicSheet.tsx` (Cancelar / Confirmar escolha)
- [X] T011 [P] [US1] Aplicar inset inferior real em `app/gallery.tsx`
- [X] T012 [US1] Garantir área de toque mínima de 48dp em todos os controles interativos das telas acima, sem alterar o tamanho visual dos elementos
- [X] T013 [US1] Validar no dispositivo: tocar na borda inferior de cada botão primário em navegação por botões **e** por gestos; anexar screenshots do antes/depois em `docs/preview/us1/`

---

## Fase 4 — US2: Nunca perder a trilha em silêncio (P1) 🔴

**Objetivo**: zero pacotes sem trilha sem confirmação explícita do usuário.
**Princípio**: I (Multimodalidade Primeiro) · **FR**: Q04, Q05, Q06, Q07
**Teste independente**: capturar e tentar postar imediatamente, com a curadoria em andamento.

- [X] T014 [US2] Tornar explícito o estado da curadoria (`carregando` / `pronta` / `indisponivel`) no store de sessão em `src/stores/`, conforme [data-model.md](./data-model.md) — hoje `musica === null` significa duas coisas diferentes, e é essa ambiguidade que causa o defeito
- [X] T015 [US2] Consumir o estado em `src/components/CaptureSheet.tsx`: desabilitar a ação de postar enquanto `carregando`, com indicação visível do motivo
- [X] T016 [US2] Manter "Salvar" acionável em **todos** os estados em `src/components/CaptureSheet.tsx` (RV-02 — a foto nunca pode ser perdida nem bloqueada)
- [X] T017 [US2] Exigir confirmação explícita antes de postar quando o estado for `indisponivel`, deixando claro que o pacote sairá sem trilha, em `src/components/CaptureSheet.tsx`
- [X] T018 [US2] Revisar os textos de conclusão em `src/components/PostSheet.tsx` para que nenhuma mensagem declare "pronto" sem dizer o que o pacote contém (FR-Q07)
- [X] T019 [US2] Validar no dispositivo os quatro cenários de aceite da US2 (carregando, pronta, indisponível, salvar sempre); anexar screenshots em `docs/preview/us2/`

---

## Fase 5 — US3: Esperar menos pela trilha (P2) 🟡

**Objetivo**: mediana do tempo até a trilha ≤ 6s em 5 capturas, nenhuma acima de 10s
(SC-Q03 recalibrado em 2026-08-15 pela D1 — a linha de base de 30–45s não se reproduziu).
**Princípio**: II e III · **FR**: Q08, Q10, Q11
**Teste independente**: medir 5 capturas antes e depois e comparar medianas.

> ⚠️ **Não "paralelize o Deezer".** `resolveWithDeezer` em `src/services/music.ts` **já usa `Promise.all`** — verificado por inspeção. O tempo está no encadeamento `foto → base64 → Gemini`. Meça antes de mexer.

- [X] T020 [US3] Instrumentar com marcações de tempo as três etapas de `analyzePhotoAndSuggest` em `src/services/music.ts` (redução da imagem, chamada ao Gemini, resolução das faixas) e registrar os números em `baseline.md`
- [X] T021 [US3] Atacar a etapa dominante identificada em T020 — hipóteses na ordem de [research.md](./research.md) R3: antecipar a redução da imagem para o instante da captura; reduzir o payload enviado; só então considerar troca de modelo
- [X] T022 [P] [US3] Substituir o texto estático da curadoria por progresso por etapa ("lendo a cena" → "buscando faixas") em `src/components/CaptureSheet.tsx` (FR-Q08)
- [X] T023 [US3] Medir novamente 5 capturas e registrar em `baseline.md` a redução obtida; se não atingir 40%, documentar o que foi medido e qual a próxima hipótese — **não** marcar ✅ com número inventado
- [X] T024 [US3] Confirmar que a degradação graciosa (Gemini falhou → pipeline por vibe → Deezer → catálogo local) continua íntegra após as mudanças

---

## Fase 6 — US4: Descobrir que existem oito filtros (P2) 🟡

**Objetivo**: quem olha a tela percebe que há mais de quatro filtros.
**Princípio**: II e VI · **FR**: Q12
**Teste independente**: mostrar a captura de tela a alguém que nunca viu o app e perguntar quantos filtros existem.

- [X] T025 [US4] Dar affordance de rolagem horizontal ao carrossel em `src/components/FilterCarousel.tsx` (peek/fade/indicador), garantindo que nenhum item fique cortado de forma ambígua em repouso
- [X] T026 [P] [US4] Verificar o carrossel em fonte do sistema ampliada (acessibilidade) e em tela estreita, sem quebra de layout
- [X] T027 [US4] Medir o atraso na troca de filtro; se houver atraso perceptível, corrigir e registrar em `baseline.md`
- [X] T028 [US4] Validar no dispositivo; anexar screenshots em `docs/preview/us4/`

---

## Fase 7 — US5: Identidade visual coerente (P3) 🟢

**Objetivo**: ícones de controle idênticos entre fabricantes.
**Princípio**: VI (Fidelidade à Identidade Visual) · **FR**: Q13, Q14, Q15
**Teste independente**: comparar capturas da mesma versão em dois fabricantes.

> Emoji de **filtro** e de **vibe** é linguagem do produto e **permanece**. Só os ícones de **controle** migram.

- [X] T029 [US5] Mapear todos os emojis usados como ícone de controle em `app/camera.tsx`, `app/gallery.tsx`, `app/index.tsx`, `src/components/CaptureSheet.tsx`, `src/components/MusicPlayer.tsx` e `src/components/MusicSheet.tsx`, separando-os dos emojis de filtro/vibe
- [X] T030 [US5] Substituir os ícones de controle mapeados em T029 por `@expo/vector-icons`, tingidos com os tokens de `src/theme` (sem dependência nova — já vem com o Expo)
- [X] T031 [US5] Confirmar que os emojis de filtros (Vivid 🌟, Neon 🌈, Love ❤️, Eclipse 🌒, Retro 📼, Vintage 🧡, Arctic ❄️, Honey 🍯) e das vibes permanecem intactos
- [X] T032 [US5] Validar no dispositivo; anexar screenshots em `docs/preview/us5/`

---

## Fase 8 — US6: Acompanhar a geração do vídeo (P3) 🟢

**Objetivo**: barra de progresso que reflete trabalho real durante os 40–70s.
**Princípio**: III · **FR**: Q09, Q10 · **Contrato**: [contracts/video-muxer.md](./contracts/video-muxer.md)
**Teste independente**: acionar a exportação e observar se o indicador avança proporcionalmente.

- [X] T033 [US6] Emitir evento de progresso do módulo nativo em `modules/video-muxer/android/src/main/java/expo/modules/videomuxer/VideoMuxerModule.kt`, consultando o progresso do Transformer conforme o contrato (C-01 a C-04)
- [X] T034 [US6] Expor o evento e seus tipos em `modules/video-muxer/src/VideoMuxerModule.ts` e `VideoMuxer.types.ts`
- [X] T035 [US6] Consumir o progresso em `src/services/videoMuxer.ts` e apresentá-lo em `src/components/PostSheet.tsx`, mantendo o indicador indefinido como fallback (C-04)
- [X] T036 [US6] Confirmar que a Promise continua sendo a fonte da verdade de sucesso/falha e que ignorar o evento mantém o comportamento do v1 (C-01)
- [X] T037 [US6] Validar no dispositivo com `./scripts/dev-android.sh log`: progresso monotônico, chega a 100, interface responsiva; anexar screenshots em `docs/preview/us6/`

> **Achado da Fase 8 — o `getProgress` do Media3 não é fiel para esta composição.**
> Medido: ele devolve **100% aos 280 ms** de uma exportação de ~10 s, porque reporta o avanço da
> *sequência de entrada* — e a nossa entrada de vídeo é uma **imagem parada**, um frame só,
> consumido de imediato. O tempo real está no encoding dos 30 s de saída, que esse número não vê.
> Uma barra cravada em 100% por 9,5 s mente mais que um indicador indefinido, e o FR-Q09 pede
> progresso proporcional ao trabalho real.
> **Resolução**: o módulo passou a **qualificar a fonte antes de confiar nela** (regra **C-05**,
> acrescentada ao [contrato](./contracts/video-muxer.md)): observa 1 s sem emitir e, se o valor já
> estiver ≥95%, descarta a fonte e não emite nada — a interface fica no indicador indefinido
> (C-04). A regra é genérica: um device com progresso fiel passa na qualificação e ganha a barra
> determinada, sem hard-code de aparelho.
> **Consequência**: neste device a barra determinada **não aparece**, por decisão de honestidade.
> Toda a infraestrutura está pronta e ligada — se o Media3 passar a informar progresso real, a
> barra funciona sem nenhuma mudança de código.
> **Desvio de local do T035**: a task mandava apresentar o progresso no `PostSheet.tsx`, mas o
> `PostSheet` só é montado **depois** da exportação terminar — a espera acontece no
> `CaptureSheet`, que é onde o indicador foi posto (o T045 já tinha antecipado isso).
> Evidências e as duas curvas de log em `docs/preview/us6/`.

---

## Fase 9 — Performance e fechamento

- [X] T038 [P] Investigar re-renders desnecessários em `app/camera.tsx` (a tela recalcula vibe em tempo real) e corrigir os que forem confirmados por medição

> **Medido** (contador de renders instrumentado, lido via `adb logcat ReactNativeJS:V` — e não
> pelo `/tmp/metro.log` como diz a seção "Como retomar": `console.log` **aparece sim** no logcat
> sob a tag `ReactNativeJS`).
>
> | Cenário | Antes | Depois |
> |---|---|---|
> | Abertura + 1 captura | 6 | 5 |
> | 12 trocas de filtro no modal | **12** | **0** |
> | Total do roteiro | **18** | **5** |
>
> **Causa**: a tela assinava os stores inteiros. `useSettingsStore()` sem seletor reagia a
> ajustes que o visor nem lê; `s.session` reagia a **cada** `patch()` da curadoria e de cada
> troca de filtro — redesenhando `CameraView`, `FilterLayer` e o carrossel sem nada ter mudado
> neles; `s.medias` reagia a qualquer mídia quando só a capa é usada.
> **Correção**: seletores fatiados (`s.filtroAutomatico`, `s.gradeComposicao`, `s.medias[0]`,
> `s.session !== null`). Nenhuma mudança de comportamento — só de quantas vezes se redesenha.
- [X] T039 [P] Verificar fluidez do preview com filtro ativo em `src/components/FilterLayer.tsx`; registrar o resultado

> **Medido** com `dumpsys gfxinfo` sob carga de UI (16 varreduras do carrossel). O preview em si
> não passa pelo pipeline da janela — é Surface composta pelo SurfaceFlinger, e por isso um
> visor parado marca `Total frames rendered: 0`. A medição válida é com a UI trabalhando:
>
> | | Frames | Janky | p90 | p95 |
> |---|---|---|---|---|
> | Com filtro (Vivid) | 606 | 2,81% | 14 ms | 15 ms |
> | Sem filtro (Original) | 633 | 1,26% | 13 ms | 14 ms |
>
> O filtro custa **~1 ms por frame** e o p95 fica dentro do orçamento de 16,7 ms (60 fps).
> **Sem queda perceptível** — o `FilterLayer` são duas `View` com `backgroundColor`, sem shader.

- [X] T040 [P] Verificar acúmulo de memória abrindo e fechando `src/components/CaptureSheet.tsx` 20 vezes seguidas

> **Sem vazamento.** Após 20 ciclos de abrir/descartar: `Views` 121 → **121**, `Activities` 1 → 1,
> `AppContexts` 7 → 7, Java Heap 27,8 → 26,2 MB. O Native Heap subiu 415,9 → 491,9 MB, mas um
> `am send-trim-memory RUNNING_CRITICAL` devolveu para **237,5 MB** — era cache recuperável, não
> retenção. O `CaptureSheet` desmonta limpo.
>
> **Achado colateral, e é o mais grave da fase**: o `du` do cache mostrou
> **`cache/synesthesia-video` com 834 MB**, de 1,27 GB de cache total. Cada exportação escrevia
> um `pacote-<timestamp>.mp4` de ~15 MB e **nada nunca apagava** — o app acumulava quase 1 GB no
> aparelho, sem o usuário ter como saber nem como limpar fora das configurações do Android.
> **Corrigido** em `src/services/videoMuxer.ts`: os .mp4 anteriores são apagados **antes** de
> gerar o novo (e não depois de compartilhar — assim o vídeo que o usuário ainda pode estar
> baixando na tela de postagem nunca é o que se apaga). Best-effort: falhar na limpeza não
> atrapalha a exportação. **Medido no device: 834 MB → 15 MB**, restando só o pacote da vez.
> `cache/Camera` (431 MB) fica para uma próxima — é gerenciado pelo `expo-camera` e uma sessão
> em andamento aponta para lá, então limpar exige mais cuidado que esta rodada comporta.

- [X] T041 **Não regressão obrigatória**: gerar um pacote completo e confirmar trilhas `vide`+`soun`, codecs `avc1`+`mp4a` e duração igual ao trecho aprovado, conforme [quickstart.md](./quickstart.md) (FR-Q16, SC-Q07)

> Conferido no pacote gerado após todas as mudanças da rodada: `vide`+`soun`, `avc1`+`mp4a`,
> **30,00 s**, 15,1 MB. SC-Q07 mantido.
- [X] T042 Atualizar `README.md` com os screenshots novos, se as telas mudaram visualmente
- [X] T043 Rodar `npm run typecheck` e revisar o diff completo da rodada antes do commit final

> A revisão do diff **pegou dois defeitos** no Kotlin novo, ambos corrigidos:
> 1. Ao qualificar a fonte como confiável, `ultimoProgresso` não era atualizado antes de emitir —
>    o tick seguinte reemitiria o mesmo número.
> 2. Estado do módulo declarado espalhado depois dos métodos que o usam. Reagrupado, com a nota
>    de que o módulo é singleton e pressupõe **uma exportação por vez** — garantia que vem da
>    guarda de reentrada do T045.
>
> Recompilado e revalidado no device depois da refatoração: qualificação da fonte funcionando
> (descartada em 1066 ms), limpeza de cache ativa (só o pacote da vez, 15 MB) e pacote sem
> regressão (`vide`+`soun`, `avc1`+`mp4a`, 30,00 s).

---

## Dependências

```
Fase 1 (linha de base) ──> Fase 2 (fundação) ──> Fase 3 (US1) ──> Fase 4 (US2)
                                                       │
                                                       ├──> Fase 5 (US3)
                                                       ├──> Fase 6 (US4)
                                                       ├──> Fase 7 (US5)
                                                       └──> Fase 8 (US6)
                                                                 │
                                                                 └──> Fase 9
```

- **Fase 1 é pré-requisito de tudo**: sem linha de base não há como provar melhora (SC-Q03) nem regressão.
- **Fase 2 bloqueia a Fase 3**: os insets precisam do provider no lugar.
- **US1 antes de US2** por prioridade de dano: um botão que não responde impede até de chegar no defeito da US2.
- **US3 a US6 são independentes entre si** — podem ser feitas em qualquer ordem ou em paralelo por chats diferentes, desde que US1 e US2 estejam fechadas.
- **Fase 9 fecha**: só depois que todas as mudanças estiverem no lugar.

## Paralelização

| Momento | Tasks paralelizáveis |
|---|---|
| Fase 1 | T002, T003, T004 |
| Fase 3 | T008, T009, T010, T011 (arquivos distintos) |
| Fase 5–8 | As fases inteiras, entre si, após US1 e US2 |
| Fase 9 | T038, T039, T040 |

## Escopo mínimo (MVP desta rodada)

**Fases 1 a 4** (T001–T019). Elas restauram os dois princípios violados — Multimodalidade Primeiro e Redução do Atrito de Decisão. Se a rodada precisar parar antes do fim, parar aqui já entrega um app que ninguém tropeça ao usar e que nunca perde a trilha em silêncio.

## Fase 10 — QA de uso real (reportado pelo Sávio, 2026-08-15)

> Três achados de **uso real do app**, não de inspeção. Registrados com diagnóstico feito
> por leitura do código, mas **nenhum foi implementado** — o Sávio pediu para passar a bola.
> Nada aqui foi validado no dispositivo pela sessão que os registrou.

- [X] T044 [BUG] **Dois áudios tocam ao mesmo tempo.** Com a prévia principal tocando, dar
  play numa opção do modal de música faz as duas soarem juntas.
  **Diagnóstico**: são dois players independentes de `expo-audio`, e nenhum sabe do outro —
  `useAudioPlayer(musica.previewUrl)` em [`MusicPlayer.tsx`](../../src/components/MusicPlayer.tsx)
  e `useAudioPlayer(null)` em [`MusicSheet.tsx`](../../src/components/MusicSheet.tsx). O
  `MusicPlayer` continua montado por baixo enquanto o modal está aberto, então nada o pausa.
  **Onde atacar**: pausar o player do `MusicPlayer` quando `showMusic` vira `true` em
  `CaptureSheet`, ou — melhor — dar um dono único à reprodução, já que hoje dois componentes
  disputam a mesma saída de áudio.
  **Feito**: `MusicPlayer` ganhou a prop `ativo`, e o `CaptureSheet` passa `ativo={!showMusic}` —
  quem está por baixo cede a saída em vez de disputá-la. O `MusicSheet` pausa no unmount, o que
  cobre também a saída pelo botão físico de voltar.
  **Evidência** (`dumpsys audio`, players em `state:started`): prévia principal tocando → 1;
  modal aberto → **0**; play numa sugestão → 1; após Cancelar → 0. Nunca 2.
  Screenshots em `docs/preview/t044/`.

- [X] T045 [BUG] **"Postar agora" parece travado e mostra o modal errado antes do vídeo.**
  Depois de aplicar a música, tocar em Postar não dá retorno nenhum; o usuário toca várias
  vezes; abre a tela de pacote "em duas partes" (a que diz que o vídeo único chega na versão
  final); e só uns 20 s depois aparece a tela com o vídeo.
  **Diagnóstico**: `postar()` em [`CaptureSheet.tsx`](../../src/components/CaptureSheet.tsx)
  **é reentrante e não tem estado de carregamento**. `salvando` é ligado dentro de `salvar()`
  e já desligado no `finally` dele, *antes* de `exportPackage()` rodar — e é `exportPackage`
  que leva os 20–30 s da geração do `.mp4`. Nesse intervalo o botão fica habilitado e sem
  feedback, então cada toque dispara **uma exportação nova em paralelo**. A tela "em duas
  partes" é o pacote de uma execução que resolveu sem vídeo (`audioUri` nulo →
  `videoUri` nulo em [`sharePackage.ts`](../../src/services/sharePackage.ts)); o `setSharePkg`
  de outra execução, mais lenta e com vídeo, sobrescreve depois.
  **Onde atacar**: guarda de reentrada + estado `postando` desabilitando o botão, e o
  progresso real da Fase 8 (T033–T037) como feedback. As duas coisas juntas: sem a guarda, o
  progresso mostraria várias exportações concorrentes.
  **Nota**: é o mesmo defeito de fundo da US2 — ação de saída disparando sem o usuário saber
  em que pé está —, só que no outro extremo do fluxo.
  **Feito**: estado `postando` + `postandoRef` (espelho síncrono, porque dois toques chegam
  antes do re-render) envolvendo **toda** a `exportar()`, inclusive o `exportPackage`. Botão
  vira "Postando..." desabilitado, com spinner e o motivo à vista; `exportar()` ganhou
  `try/catch` — antes uma falha ficava calada.

  > ⚠️ **Correção de leitura (2026-08-15)**: este registro dizia que "o tempo real medido no
  > logcat foi 29966 ms, o que confirma o diagnóstico dos 20–30 s". **Estava errado.** Os
  > 29966 ms vinham de `exportResult.durationMs`, que é a duração **do vídeo gerado** (os 30 s
  > do trecho), não o tempo gasto exportando. O tempo real só foi medido na Fase 8, pelo `t=`
  > do log de progresso: **~9,8 s**. O defeito do T045 é o mesmo e a correção também — só a
  > grandeza da espera era menor do que o registrado.
  **Evidência**: cinco toques em rajada em "Postar agora" → **1 única** linha
  `VideoMuxer: mp4 pronto (29966ms)` no logcat (antes seriam 5 exportações concorrentes), e a
  tela final foi direto "Vídeo gerado!", sem passar pela de "duas partes".
  Não regressão do pacote: `vide`+`soun`, `avc1`+`mp4a`, duração 30,00 s.
  Screenshots em `docs/preview/t045/`.

- [X] T046 [DESIGN] **Trocar a tipografia para Lato e Nunito.** Hoje são Syne (display) e
  DM Mono (labels técnicas). Envolve `@expo-google-fonts/lato` e `@expo-google-fonts/nunito`,
  o `useFonts` de [`app/_layout.tsx`](../../app/_layout.tsx) e os tokens `fonts` de
  [`src/theme/tokens.ts`](../../src/theme/tokens.ts).
  ⚠️ **Contradiz a fonte da verdade atual**: o `CLAUDE.md` e o guia do Figma fixam Syne +
  DM Mono como identidade. Trocar exige atualizar o `CLAUDE.md` junto, senão o próximo agente
  reverte achando que é engano. Ver **D2**.
  **Feito** (autorizado pelo Sávio em 2026-08-15, no mesmo commit): **Nunito 700** no display e
  **Lato 300/400/700** nas labels. Os tokens foram renomeados para a **função** em vez da fonte
  (`mono*` → `labelLight` / `label` / `labelForte`), porque `fonts.mono` apontando para uma
  fonte proporcional é exatamente o tipo de pista falsa que faz o próximo agente reverter.
  `displayExtra` foi removido: ninguém o referenciava e ele carregava um arquivo de fonte à toa.
  Fonte da verdade atualizada junto: `CLAUDE.md`, `.specify/memory/constitution.md`
  (emenda **1.1.0** — o Princípio VI nomeava as famílias antigas) e o cabeçalho de `tokens.ts`.
  **Ressalva registrada**: Lato não é monoespaçada, então as labels perderam o caráter de
  máquina do DM Mono; o que as mantém "técnicas" agora é a caixa alta com `letterSpacing`.
  Efeito colateral bem-vindo: Lato é mais estreita, e o chip NEON voltou a caber inteiro.
  Screenshots em `docs/preview/t046/`.

---

## Fase 11 — QA de uso real, 2ª rodada (reportado pelo Sávio, 2026-08-15)

> Achados de **uso real**, no mesmo espírito da Fase 10. Todos validados no dispositivo.

- [X] T047 [BUG] **O trecho não se movimenta e não dá para escolher onde termina.**
  O slider parecia uma barra de progresso mas era um seletor de início: ficava parado enquanto
  a música tocava, e a reprodução parava sozinha aos 30 s, onde quer que o usuário estivesse.
  Pior: **não havia como escolher o fim** — `trechoFim` era fixado em `30` no `CaptureSheet`,
  no `MusicSheet` e no `camera.tsx`, então todo vídeo saía com a prévia inteira.
  **Diagnóstico**: o modelo **já suportava** recorte arbitrário — `trechoFim` existe em
  `CaptureSession`, alimenta `durationSeconds` em [`sharePackage.ts`](../../src/services/sharePackage.ts)
  e entra na legenda. Só a interface é que nunca deixava mexer nele.
  **Feito** em [`MusicPlayer.tsx`](../../src/components/MusicPlayer.tsx): a reprodução passou a
  respeitar o fim escolhido e a voltar ao início do trecho, com piso de 5 s (`TRECHO_MIN_S`),
  que já era o implícito no antigo `maximumValue={TRECHO_MAX_S - 5}`.

  > ⚠️ **A primeira solução foi rejeitada pelo Sávio e substituída.** Eu havia posto uma barra
  > de progresso separada **mais dois sliders empilhados** (início e fim). Resolvia a função,
  > mas não é o padrão que o mercado usa nem o que o design pede — "duas barrinhas não é nada
  > ortodoxo". O certo é **um trilho só com duas bolinhas**, conforme o Figma
  > (nó [462-926](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=462-926&m=dev)).
  > Ver **T050**.
  O recorte **sobrevive à troca de faixa** (toda prévia do Deezer tem 30 s, então "quero 10 s
  de vídeo" continua valendo) — antes o `MusicSheet` resetava para 0–30 e jogava a escolha fora.
  **Evidência**: recorte 10 s→20 s exibindo "VÍDEO DE 10s"; barra andando 2s/10s → 8s/10s;
  parada no fim do trecho com retorno a 0s/10s; e o `.mp4` resultante com **10,00 s** e 5,4 MB
  (contra 15 MB dos de 30 s).

- [X] T048 [PERF] **O vídeo só começava a ser gerado no toque de "Postar".**
  O usuário já tinha gasto tempo escolhendo música e conferindo a prévia, e só então esperava
  ~10 s olhando um indicador. Isso contraria a premissa do produto, que é agilizar o post.
  **Feito**: [`src/services/preExport.ts`](../../src/services/preExport.ts) antecipa a geração
  em segundo plano assim que o pacote está definido. Detalhes que fazem a coisa se sustentar:
  - **Chave de identidade** (foto + filtro + faixa + recorte): mudou qualquer um, o vídeo
    anterior não serve, e só é servido quem pedir pela chave vigente.
  - **Quietude de 2,5 s** antes de disparar: arrastar o slider muda a chave a cada passo, e sem
    isso cada passo queimaria uma exportação de ~10 s para jogar fora.
  - **Uma por vez**: o muxer não sabe cancelar (fora do escopo do contrato), então a que estiver
    rodando vai até o fim e é descartada; só a última chave pedida entra na fila.
  - **Não concorre com a postagem**: nada é agendado com a exportação real em curso ou a tela de
    destinos aberta, porque ali o arquivo está em uso e a limpeza de cache o apagaria.
  - Ao postar: pronto → abre na hora; em voo para a mesma chave → aproveita em vez de começar
    outra; nada → gera com o indicador de sempre.
  **Bug pego na revisão, antes de ir ao device**: iniciar uma geração nova apaga os `.mp4`
  anteriores (limpeza do T040), então o pacote "pronto" perdia o arquivo. Se o usuário desfizesse
  a mudança e postasse antes da nova terminar, receberia um caminho inexistente. Corrigido
  zerando o `pronto` quando uma geração começa.
  **Evidência**: `.mp4` de 10 s presente no cache **sem nenhum toque em "Postar"**, e a tela
  "Vídeo gerado!" abrindo em **~2 s**, sem barra de progresso.

- [X] T049 [DIAG] **Os "erros" do `VideoMuxerModule.kt` no editor.**
  São **falsos positivos do índice Kotlin do VSCode**, que não tem o classpath do Gradle. A
  prova está na própria mensagem: `Cannot access built-in declaration 'kotlin.String'` — se o
  stdlib do Kotlin realmente não resolvesse, nada compilaria, nem `String`.
  Verificado com recompilação do zero (`:video-muxer:compileDebugKotlin --rerun-tasks`):
  **BUILD SUCCESSFUL, zero erros**. Os únicos warnings vinham de `node_modules`, exceto um
  nosso, este sim real e já corrigido: `exportResult.durationMs` está deprecado no Media3 →
  trocado por `approximateDurationMs`.
  Esse warning rendeu ainda a **correção de leitura registrada no T045**: `durationMs` é a
  duração do vídeo, não o tempo de exportação.

- [X] T050 [DESIGN] **Trocar as duas barrinhas por um seletor de faixa do Figma.**
  Duas barras empilhadas não são o padrão do mercado para recortar um trecho. O design
  (nó [462-926](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=462-926&m=dev))
  pede **um trilho com duas bolinhas**, marcas `0:00 / 0:15 / 0:30` embaixo e a legenda
  `Trecho · 0:00 → 0:15`, com o play num quadrado arredondado amber e ícone ruby.
  **Feito**: [`RangeSlider.tsx`](../../src/components/RangeSlider.tsx), novo, construído com
  `PanResponder`. O `@react-native-community/slider` só tem um thumb, e trazer uma biblioteca de
  range slider seria desvio da stack do `CLAUDE.md`; como o desenho é dois círculos sobre um
  trilho pintado, fazer à mão custa menos que mais uma dependência.
  Decisões que valem registro:
  - **`onChange` só no release**, não a cada pixel: cada mudança de recorte invalida o vídeo
    pré-gerado (T048), e emitir durante o arraste faria a chave do pacote mudar dezenas de vezes
    por gesto. Durante o arraste o componente se desenha com estado local.
  - **O andamento da reprodução vive dentro da faixa selecionada** (pintado em amber sobre o
    branco), em vez de numa segunda barra. Assim o "movimento" que faltava acontece no próprio
    trilho, sem contrariar o design.
  - Bolinhas de 22 dp com `hitSlop` de 16 em volta, chegando ao alvo de 48 dp da FR-Q02.
  - **Paleta**: o card no Figma está sobre um gradiente laranja claro; aqui ele vive dentro do
    modal de captura, que é `ink`. Mantive a estrutura e as formas do design com os tokens
    escuros do modal — trocar o fundo do card sozinho brigaria com o resto da tela. **Se a
    intenção era o card laranja, é só dizer que eu troco.**
  **Evidência**: recorte `0:10 → 0:20` exibindo "vídeo de 10s", andamento preenchendo dentro da
  faixa, parada no fim do trecho, e `.mp4` de **10,00 s** (4,7 MB) pré-gerado sozinho.

- [X] T051 [BUG] **Trocar de música estourava com tela vermelha.**
  `ERR_USING_RELEASED_SHARED_OBJECT` — *Cannot use shared object that was already released*,
  apontando `MusicSheet.tsx:40`.
  **Foi regressão minha, introduzida no T044**: eu havia acrescentado
  `useEffect(() => () => player.pause(), [player])` como reforço para o caso de o modal fechar
  por um caminho inesperado. No unmount, porém, o `useAudioPlayer` libera o player **antes**
  desse cleanup rodar, e chamar `pause()` num objeto já liberado lança.
  **Feito**: cleanup removido. Ele também era desnecessário — liberar o player já interrompe a
  reprodução, e o silêncio nos caminhos normais vem do `pause()` explícito de `cancelar()` e
  `confirmar()`, com o botão físico de voltar caindo em `cancelar` via `onRequestClose`. O lugar
  ficou comentado para ninguém "reforçar" de novo.
  **Evidência**: ciclo completo de abrir → tocar sugestão → confirmar, com zero erros no logcat.

- [X] T052 [DESIGN] **Arquivar a trilha em vez de removê-la.**
  "Remover áudio" apagava a escolha: mudar de ideia obrigava a curadoria a rodar de novo, com o
  Gemini junto. Agora "Trocar música" ocupa toda a largura que sobra (Figma, nó 303:417) e um
  quadrado ruby de 50×50 com lixeira fica fixo no canto.
  **Feito**: `trilhaArquivada` na sessão — a faixa **continua escolhida**, só não entra no
  pacote. Arquivada, o player e a linha de ações somem, a identidade da faixa esmaece e escorrega
  para o espaço que sobrou, e o botão de reativar (power, amber) fica ao lado dela. Reativar é
  instantâneo, sem rede. A transição usa `LayoutAnimation` (é a altura do card inteiro que muda,
  não uma propriedade só) mais um `Animated` para o esmaecer.
  Cuidados que o estado exigiu:
  - **A chave da pré-geração trata arquivada como "sem música"** — sem isso, o vídeo com trilha
    já pronto seria servido para um pacote de onde o usuário acabou de tirar a música.
  - **Postar não pede confirmação** quando a trilha está arquivada: tirar a música com as
    próprias mãos já é a confirmação explícita que a RV-01 exige.
  - **A mídia salva na galeria reflete o pacote** — arquivada, o registro vai sem trilha.
  - O botão de reativar fica **fora** do bloco que esmaece; era o único controle acionável do
    estado, e apareceria apagado.
  **Evidência**: arquivar → player e "Trocar música" somem, foto ganha a área; reativar → tudo
  volta ao lugar; postar arquivada → "Pacote só com a imagem — sem trilha", instantâneo e sem
  gerar vídeo. Zero erros no logcat nos três caminhos.

- [X] T053 [DESIGN] **Tirar o chip "+N" do carrossel de filtros.**
  A pedido do Sávio: virou peso visual numa faixa já densa. Com ele saiu toda a medição de
  larguras que existia só para calcular o número — o `FilterCarousel` voltou a ser uma
  `FlatList` e perdeu ~60 linhas, incluindo um `noFim` que já era código morto.
  O carrossel segue igual no visor e no modal de captura, com os chips de emoji.

  > ⚠️ **Isto reabre o SC-Q05** ("uma pessoa que nunca usou o app identifica que existem mais de
  > quatro filtros só olhando a tela"), que o T025 tinha fechado justamente com o "+N". A
  > affordance agora é só o chip cortado na borda — que foi o que a US4 classificou como
  > ambíguo. Foi decisão de produto do Sávio, registrada aqui para não ser "corrigida" por
  > engano depois. **O critério fica não atingido de propósito.**
  >
  > Uma ideia de miniatura com o filtro já aplicado chegou a ser desenhada e aprovada
  > (prévia em `docs/preview/fase11/`), mas foi descartada em seguida: **na tela da câmera não
  > existe foto capturada** para miniaturizar, e um carrossel diferente em cada tela seria pior
  > que o problema.

---

## Dúvidas para o Sávio

> Preencher aqui qualquer decisão de produto que aparecer durante a execução autônoma, em vez de inventar. Implementar a alternativa mais conservadora e seguir.

### D1 — A linha de base de 30–45 s da US3 não se reproduz (Fase 1, T003)

Medido hoje no mesmo aparelho e na mesma rede, o tempo entre o disparo e a trilha visível
tem **mediana de 6,02 s** (5 capturas: 5,65 / 6,02 / 6,02 / 6,19 / 7,31), contra os
**30–45 s** que a spec assume. Nenhuma linha de código mudou entre as duas medições — a
diferença é de ambiente. Números completos em [baseline.md](./baseline.md).

Isso esvazia o SC-Q03: reduzir 40% sobre 6,02 s exigiria chegar a 3,6 s, o que só se
alcança trocando o modelo do Gemini — a alternativa que o [research.md](./research.md) R3
classificou como **adiada** por afetar a qualidade da leitura de cena, que é o diferencial
do produto.

**Decidido pelo Sávio em 2026-08-15**: tentar primeiro reduzir o payload, sem trocar o
modelo. Feito no T021 — 71 KB → 35 KB, sem perda de leitura de cena. Resultado medido no
T023: mediana 6,02 s → 5,47 s, **9%**, não os 40%.

**Resolvido pelo Sávio em 2026-08-15**: recalibrar o critério para a faixa real, **sem** trocar
o modelo do Gemini. O SC-Q03 passou a ser **mediana ≤ 6 s em 5 capturas, nenhuma acima de 10 s**
— um alvo absoluto, em vez de uma redução percentual sobre um número que não se reproduz.
Com a mediana medida de **5,47 s**, o critério está **atingido**.

Atualizados junto, para os artefatos não se contradizerem: `spec.md` (SC-Q03 e o texto da US3,
cujo peso se desloca da *duração* para o *feedback estático* durante ela), `plan.md`
(Performance Goals), `quickstart.md` (roteiro de aceite), `data-model.md` (RV-04) e o objetivo
da Fase 5 aqui. O `baseline.md` e o `research.md` **não** foram mexidos: são o registro do que
foi medido na época e devem continuar dizendo o que diziam. **D1 encerrada.**

### D2 — A troca de tipografia contraria a identidade documentada (T046)

O Sávio pediu fontes "mais ortodoxas": **Lato e Nunito**. O `CLAUDE.md` e o guia do Figma
`kite_camera_style_guide.html` fixam **Syne (700) para display** e **DM Mono para labels
técnicas**, e a spec trata a fidelidade à identidade visual como Princípio VI — o mesmo que
justificou a Fase 7 inteira.

Não é conflito de opinião, é de fonte da verdade: enquanto o `CLAUDE.md` disser Syne + DM
Mono, qualquer agente que abrir este repo vai tratar Lato/Nunito como desvio e reverter.

**Para decidir antes de implementar o T046**: se a troca vale, o `CLAUDE.md` e a seção de
identidade visual precisam mudar junto, no mesmo commit. Se for só teste, melhor fazer num
branch e não tocar na documentação.

**Decidido pelo Sávio em 2026-08-15**: a troca vale e é definitiva — feita no T046 com o
`CLAUDE.md`, a constituição (emenda **1.1.0**) e o `tokens.ts` no mesmo commit. O Figma e o
`kite_camera_style_guide.html` seguem mostrando Syne + DM Mono e **estão desatualizados**: a
partir daqui o `CLAUDE.md` é a fonte da verdade da tipografia. **D2 encerrada.**

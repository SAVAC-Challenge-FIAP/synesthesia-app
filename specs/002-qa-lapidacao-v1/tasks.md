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
  >
  > ✅ **Atualização (T054, 2026-08-15): o SC-Q05 voltou a ser atingido.** A ideia da miniatura
  > foi retomada **restrita ao modal de captura**, onde a foto existe; a câmera ficou com os
  > chips. "Um carrossel diferente em cada tela" deixou de ser o problema e virou a solução —
  > as duas telas têm matéria-prima diferente. As duas frases acima descrevem o estado entre o
  > T053 e o T054, e ficam aqui por isso.

---

## Fase 12 — Miniaturas de filtro (passada de bola, 2026-08-15)

> **Passada de bola cumprida em 2026-08-15.** A fase foi especificada por uma sessão que parou
> de propósito antes de implementar; esta sessão assumiu e fechou o T054. O carrossel de chips
> de emoji continua no visor da câmera — só o modal de captura mudou.

- [X] T054 [DESIGN] **Trocar os chips de emoji por miniaturas com o filtro aplicado, no modal de
  captura.**

  **O que o Sávio pediu**, nas palavras dele: os filtros "seria em forma de tubs [thumbs] com o
  filtro já aplicado, o emoji no centro, o nome do filtro aplicado", e **"eles vão ficar em cima
  da parte de escolher música"**.

  ### Onde, exatamente

  Só no **modal de captura** ([`CaptureSheet.tsx`](../../src/components/CaptureSheet.tsx)), na
  posição em que o carrossel já está: abaixo da foto, **acima do bloco `TRILHA SONORA`**. É a
  mesma ordem do Figma — o nó pai `462:926` ("Filtro / Música") contém `276:413`
  ("Filtros disponiveis") em cima e `294:24` ("Música") embaixo.

  ⚠️ **Na tela da câmera ([`camera.tsx`](../../app/camera.tsx)) o carrossel de chips permanece
  como está.** Não existe foto capturada ali para miniaturizar — só o visor ao vivo. Foi
  justamente por isso que a ideia de miniatura foi descartada uma vez; ela volta **restrita à
  captura**, onde a foto existe. Os dois carrosséis passam a ser diferentes de propósito, e isso
  não é inconsistência a ser "corrigida".

  ### Especificação visual

  Fonte: Figma nó
  [462-926](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=462-926&m=dev),
  frames `468:950` a `468:945`.

  - Miniatura de **70×93**, cantos arredondados, **10 px** de intervalo, rolagem horizontal.
  - Conteúdo: a **foto da sessão com aquele filtro aplicado**, o **emoji ao centro** e o **nome
    do filtro** embaixo.
  - Selecionada: borda `amber`; nome em `amber`. As demais sem borda.
  - Continua havendo o item **"Original"** (📷) na frente, como hoje — a foto sem filtro é
    escolha de primeira classe (T-0B).
  - Prévia aprovada pelo Sávio, com a foto real e os oito filtros: `docs/preview/fase11/` e o
    artifact publicado na conversa de 2026-08-15.

  ### O que reusar (não reescrever)

  - [`FilteredImage`](../../src/components/FilteredImage.tsx) **já faz exatamente o render
    necessário**: aplica `imageFilter` (brightness/saturate/contrast/sepia) via style `filter` do
    RN e sobrepõe os `FilterLayer` de identidade. Uma miniatura é
    `<FilteredImage uri={session.photoUri} filtroId={f.id} />` num container de 70×93.
  - [`FILTERS`](../../src/constants/filters.ts) tem nome, emoji e parâmetros dos oito.
  - O `Chip` memoizado de [`FilterCarousel.tsx`](../../src/components/FilterCarousel.tsx) já
    resolve o problema de re-render (ver a nota lá: sem memo, trocar de filtro redesenhava os
    nove). **Mantenha a memoização** na versão em miniatura — com imagem no lugar de texto, o
    custo de redesenhar é maior, não menor.

  ### Armadilhas conhecidas

  1. **Não reintroduza o chip "+N"**. Ele foi removido a pedido do Sávio no T053; voltar com ele
     seria desfazer decisão de produto.
  2. **`FilterCarousel` é compartilhado** entre câmera e captura. Ou se cria um componente novo
     para as miniaturas, ou se adiciona uma variante — mas **sem** mudar o comportamento na
     câmera.
  3. **Nove imagens da mesma URI na tela.** Meça antes de afirmar que está fluido: o roteiro do
     T038 (contador de render lido em `adb logcat ReactNativeJS:V`) e o `dumpsys gfxinfo` do T039
     servem para isto. A foto é a mesma, então o cache do RN deve segurar — mas isso é hipótese
     até ser medida.
  4. **Não confunda com o `previewShot`.** A exportação renderiza a foto grande com filtro via
     `captureRef` sobre um `FilteredImage` separado; as miniaturas são só de seleção e não podem
     interferir nesse caminho.
  5. **Acessibilidade**: em 70 px de largura o nome do filtro cai para ~8 px. Verifique com fonte
     do sistema ampliada (era o pedido do T026). Se quebrar, a alternativa combinada é mostrar o
     nome **só na miniatura selecionada**.

  ### Efeito colateral desejável

  Isto provavelmente **fecha o SC-Q05**, que o T053 deixou em aberto de propósito: com oito
  miniaturas visíveis e recortadas na borda, alguém que nunca viu o app percebe que há muito
  mais que quatro filtros. Vale refazer o teste de aceite da US4 depois de implementar e
  atualizar o registro do T053.

  ### Como validar

  Regras da rodada valem inteiras: `npm run typecheck` passando, evidência em dispositivo real
  (não vale "compila"), screenshots em `docs/preview/`, build local apenas (`./scripts/dev-android.sh build`
  — **nunca** EAS), commit em pt-BR no imperativo. Ambiente e comandos: seção "Como retomar"
  no topo deste arquivo.

> **Implementado e validado no device (2026-08-15).** Redmi Note 8 Pro, build debug + Metro.
> Evidência em [`docs/preview/fase12/`](../../docs/preview/fase12/).
>
> **Como ficou**: componente novo `src/components/FilterThumbs.tsx` — o `FilterCarousel` não
> foi tocado no comportamento, só ganhou um comentário dizendo que agora é exclusivo do visor.
> Miniatura 70×93 (Figma 468:950), intervalo 10, `radii.card`, `FilteredImage` em
> `absoluteFill` com a foto da sessão, véu `rgba(9,5,6,0.28)` para o texto ler sobre qualquer
> cena, emoji 24 ao centro, nome 9px embaixo. Selecionada: borda `amber` + nome `amber`. A
> borda existe sempre, transparente quando não selecionada — senão a seleção empurraria as
> vizinhas 2px a cada troca. `Original 📷` segue na frente.
>
> **Armadilha 3 — as nove imagens medidas, não supostas.** `dumpsys gfxinfo`, mesma tela, mesmo
> roteiro, com e sem a mudança (A/B feito trocando só o import do `CaptureSheet`):
>
> | Roteiro | | Frames | Janky | p90 | p95 |
> |---|---|---|---|---|---|
> | 16 varreduras do carrossel | chips (antes) | 737 | 2,71% | 15 ms | 16 ms |
> | 16 varreduras do carrossel | **miniaturas** | 708 | **8,76%** | 16 ms | **17 ms** |
> | 12 trocas de filtro | chips (antes) | 12 | 100% | 34 ms | 36 ms |
> | 12 trocas de filtro | **miniaturas** | 15 | 93% | 48 ms | **61 ms** |
>
> Leitura honesta: rolar o carrossel **custa mais** — o jank triplica, mas p90/p95 ficam em
> 16–17 ms, na borda do orçamento de 16,7 ms, e a rolagem continua lisa a olho nu. Já a
> **troca de filtro já estourava antes** da mudança (100% de frames janky com chips): o custo
> ali é o `FilteredImage` grande do preview sendo redesenhado, não o carrossel. As miniaturas
> acrescentam ~1 frame perdido por troca (p95 36 → 61 ms). O cache do RN segurou as nove
> imagens da mesma URI, como o T054 supunha — se não segurasse, os números da varredura não
> teriam ficado a 1 ms dos chips.
>
> **Armadilha 5 — acessibilidade verificada de verdade**, com `settings put system font_scale
> 1.45`. Acima de 1.3 o nome sai de todas as miniaturas menos da selecionada (a alternativa
> que o próprio T054 combinou), e nada trunca no carrossel — ver
> `04-fonte-ampliada-nome-so-na-selecionada.png`. Achado colateral registrado em **D6**: com a
> fonte ampliada o **resto** do modal trunca feio ("Cant", "FILT", "Salv"), e isso é anterior a
> esta task.
>
> **Armadilhas 1, 2 e 4 respeitadas**: nenhum chip "+N" voltou; o `FilterCarousel` da câmera
> está intacto; o `previewShot`/`captureRef` não foi tocado. Não regressão do pacote conferida
> pelo roteiro do [quickstart.md](./quickstart.md) com um vídeo exportado depois da mudança —
> `trilhas: ['soun', 'vide']`, `avc1` presente, `mp4a` presente, `duracao: 30.00s`, batendo com
> o trecho aprovado na tela.
>
> **SC-Q05**: fecha, como o T054 previa. Nos screenshots as oito miniaturas mostram a própria
> foto tratada e a nona fica recortada na borda — não há mais como achar que o app tem quatro
> filtros. O registro do T053 fica com a ressalva de que o critério passou a ser atingido aqui.

---

## Fase 13 — Destinos reais no modal de postagem (2026-08-15)

- [X] T055 [DESIGN] **Trocar a grade fixa de emoji por destinos reais do aparelho, no modal de
  postagem** — Figma nó
  [294-163](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=294-163&m=dev).

  **O que o Sávio pediu**: os emoji da barra de compartilhamento estavam "nada a ver"; ele queria
  ver "as redes nativas do celular das pessoas" e, se desse, "instagram stories, whatsapp status,
  essas coisas".

  ### O defeito real, que era maior que o visual

  Os seis destinos eram uma constante no código e **os seis chamavam a mesma função** —
  `Sharing.shareAsync`, a folha genérica do sistema. Tocar em "LinkedIn" e em "Instagram" fazia
  exatamente a mesma coisa. Seis caminhos desenhados, um caminho real; o emoji era só o sintoma
  visível. Ver `docs/preview/fase13/01-antes-...png`.

  ### Como ficou

  Módulo nativo novo [`modules/share-target`](../../modules/share-target/): `listarDestinos(mime)`
  pergunta ao `PackageManager` quem recebe um `ACTION_SEND` daquele tipo e devolve **pacote,
  activity, rótulo e ícone** — o ícone vai como data URI PNG. `compartilharEm(...)` dispara o
  Intent já apontado para (pacote, activity), com a URI do FileProvider e a permissão de leitura
  na própria flag.

  **Os ícones não são assets nossos.** Os logos existem no Figma e foram baixados, mas não
  entraram no repo: quem desenha a grade é o ícone que **o app declara no aparelho da pessoa**.
  Isso não desatualiza quando o Instagram muda de marca, não exige biblioteca de logos
  versionada, e funciona para qualquer app — no device apareceram Bluetooth, Gmail, Quick Share
  e YouTube junto com Instagram e TikTok. O layout continua o do Figma: tile 52×52 arredondado,
  três por linha, nome embaixo, e o tile "Mais" abrindo a folha do sistema para o que não coube.

  **"Instagram Stories" saiu de graça.** Não há hard-code de Stories: o Instagram publica quatro
  activities (Messages, Feed, Stories, Reels) e cada uma vira um tile. Era exatamente o pedido,
  e veio de perguntar ao sistema em vez de fixar pacotes.

  ### Duas correções que só apareceram medindo no device

  1. **Monopólio.** Ordenando só por preferência, as quatro entradas do Instagram tomavam a grade
     inteira e um WhatsApp instalado não apareceria.
  2. **O tiro pela culatra.** Corrigido com "um por app antes de repetir", Stories e Reels
     perderam a vaga para *"Adicionar ao Maps"* e *"Mensagens"* — ver
     `03-rodizio-global-jogou-stories-fora.png`. Um segundo destino do Instagram vale mais que um
     primeiro do Maps. O rodízio passou a ser **por faixa de preferência**, não global.
  3. **Rótulos repetidos.** O Instagram publica **duas** activities chamadas "Feed": dois tiles
     idênticos levando ao mesmo lugar — o defeito desta task renascendo em outra forma. Dedup por
     (pacote, rótulo), ficando a de maior prioridade do sistema.

  ### Evidência em device (Redmi Note 8 Pro, build local)

  Screenshots em [`docs/preview/fase13/`](../../docs/preview/fase13/).

  - Grade final: Messages · TikTok · Feed · Stories · Reels · Mais, sem repetição.
  - Toque em **Stories** → `com.instagram.android/com.instagram.modal.ModalActivity` no topo
    (`dumpsys activity`). O compositor não pôde ser inspecionado porque **não há conta logada** no
    aparelho de teste — o que está provado é a entrega do Intent, não o render dentro do Instagram.
  - **Entrega do arquivo provada pelo Gmail**, que lê o conteúdo: anexo
    `pacote-...mp4`, **14,1 MB**, mais a legenda da trilha chegando no `EXTRA_TEXT`
    (`05-arquivo-chega-14mb-com-legenda.png`). Isso fecha o FileProvider e o
    `FLAG_GRANT_READ_URI_PERMISSION` — sem eles o anexo apareceria vazio ou o app recusaria.
  - Não regressão pelo [quickstart.md](./quickstart.md): `trilhas: ['soun', 'vide']`, `avc1`,
    `mp4a`, `duracao: 30.00s`.
  - `npm run typecheck` passando; build local (`./scripts/dev-android.sh build`), **sem EAS**.

  ### O que ficou de fora, de propósito

  - **WhatsApp Status direto não existe** como intent pública. Compartilhando para o WhatsApp,
    "Status" aparece na lista de destinatários do próprio app — a um toque, não a zero.
  - **Instagram Stories via `com.instagram.share.ADD_TO_STORY`** (que pularia o compositor) exige
    um Facebook App ID registrado. Não foi feito: dependeria de cadastro externo e falharia de
    forma instável sem ele. O tile "Stories" atual usa o `ACTION_SEND` normal, que é estável.
  - **O caminho de lista vazia** (nenhum app compatível → botão "Compartilhar" único) está
    implementado mas **não foi visto rodando**: o aparelho de teste tem apps demais para produzir
    esse estado. É o mesmo caminho do Expo Go, onde o módulo nativo não carrega.

---

# Reta final — Fases 14 a 17 (especificadas em 2026-08-16)

> **Estas quatro fases saem do escopo original do 002.** O cabeçalho deste arquivo diz "não
> adiciona funcionalidades", e a Fase 14 adiciona: histórico de gosto e curadoria personalizada
> não existiam. Ficam aqui mesmo assim, por continuidade com as Fases 12–13 e porque o loop lê
> este arquivo — mas quem for reescrever a spec um dia precisa saber que o 002 cresceu.
>
> **Ordem definida pelo Sávio**: 14 → 15 → 16 → 17. A identidade visual (17) é a última, e só
> começa quando a inteligência musical estiver fechada e o app estiver sem pendência de QA.
>
> **As regras de execução autônoma no topo deste arquivo valem inteiras**: nunca EAS, evidência
> em device real, `npm run typecheck` passando, uma task por commit em pt-BR no imperativo, e
> decisão de produto que aparecer vai para "Dúvidas para o Sávio" em vez de ser inventada.

---

## Fase 14 — Curadoria que não se repete (P1) 🔴

**Objetivo**: capturar cinco vezes na mesma vibe e receber conjuntos de faixas majoritariamente
diferentes, com pelo menos uma sugestão fora do óbvio em cada rodada.
**Princípio**: I (Multimodalidade Primeiro) e II (Redução do Atrito de Decisão).
**Teste independente**: cinco curadorias seguidas na mesma vibe; contar faixas distintas.

**O que o Sávio relatou**, nas palavras dele: o Gemini "indica sempre as mesmas músicas para as
mesmas vibes"; ele quer que o sistema aprenda "de um cantor que aquela pessoa gosta ou já
escolheu", guardando "o histórico das músicas escolhidas, dos artistas", mas que o Gemini seja
"instruído a sair da bolha às vezes" — "uma previsão certa de acordo com o histórico ou uma
aleatoriedade, um chute bom, sabe? um cantor menos conhecido que tem uma música boa".

### A causa está escrita no prompt

Antes de arquitetar qualquer coisa, leia [`src/services/music.ts`](../../src/services/music.ts).
Os dois prompts pedem, literalmente, músicas **"reais e populares"** — `askGemini` na linha do
`Sugira 4 músicas reais e populares` e `askGeminiWithPhoto` no mesmo formato. "Populares" é uma
instrução para convergir nos mesmos hits: o modelo está obedecendo. Some-se a isso que **não há
nenhum estado entre uma curadoria e a seguinte** — nada diz ao Gemini o que ele já sugeriu — e
que o fallback do Deezer busca `searchDeezer(kw, 3)` sempre a partir do índice 0, devolvendo o
mesmo topo. O catálogo local tem duas faixas fixas por vibe.

Ou seja: são quatro fontes de repetição empilhadas, e a mais barata de corrigir é uma palavra.
**Não comece pelo store.** Meça primeiro (T056), senão não há como saber quanto cada camada
contribuiu.

- [X] **T056** [P1] **Medir a repetição antes de mexer em qualquer código.**

  Roteiro: cinco capturas da **mesma cena** (apoie o aparelho, não mude o enquadramento), com a
  leitura de cena ligada. Registre em [`baseline.md`](./baseline.md) as 4 faixas de cada rodada,
  quantas são distintas no total (de 20 possíveis) e quantos artistas distintos aparecem.
  Repita para uma segunda vibe, mudando de cena. Sem esse número, o "melhorou" da Fase 14 é
  impressão.

  Os logs já existentes ajudam: `[music] ORIGEM=...` diz de qual camada as faixas vieram, e
  `[music][tempo]` dá a latência. Leia com `adb logcat ReactNativeJS:V '*:S'`.

- [X] **T057** [P1] **Histórico de gosto no aparelho** — store novo `src/stores/useTasteStore.ts`.

  Guarda o que a pessoa **escolheu**, não o que apareceu para ela:

  ```
  escolhas: { faixaId, titulo, artista, vibeId, origem: 'auto' | 'manual', em: number }[]
  ```

  - `manual` = trocou a música no `MusicSheet`. É o sinal forte: ela rejeitou a sugestão e
    buscou outra coisa.
  - `auto` = aceitou passivamente a faixa que o sistema escolheu e salvou/postou o pacote.
    Vale, mas muito menos — não confunda os dois pesos.
  - Registrar em `MusicSheet` (confirmação da troca) e em `CaptureSheet.salvar()` (a faixa que
    de fato foi no pacote). Se a trilha foi arquivada, **não** registre: arquivar é rejeição.
  - Persistir com `zustand/persist` + AsyncStorage, igual aos outros stores. Teto de ~200
    entradas, descartando as mais antigas — é histórico de gosto, não log de auditoria.
  - Derivados que a Fase 14 vai consumir: `artistasFrequentes(n)` (contagem com peso maior para
    `manual` e para o que é recente) e `faixasRecentes(n)` (para a lista de bloqueio do T058).

  ⚠️ **LGPD — isto não é igual ao toggle que já existe.** O opt-in `deteccaoTempoReal` cobre
  *enviar a foto*. Mandar ao Gemini **os nomes dos artistas que a pessoa escolhe** é outra
  divulgação, sobre gosto pessoal, e não está coberta por aquele consentimento. Ver **D7**.

- [X] **T058** [P1] **Reescrever os prompts: tirar "populares", proibir a repetição, dar papéis.**

  Em [`music.ts`](../../src/services/music.ts), nos dois prompts (`askGemini` e
  `askGeminiWithPhoto`):

  1. **Remover a palavra "populares".** É a causa mais direta e mais barata.
  2. **Lista de bloqueio**: injetar as últimas ~20 faixas já sugeridas para aquela vibe com
     "não repita nenhuma destas". Guardar as sugeridas (não só as escolhidas) — pode ser um
     campo à parte no `useTasteStore`.
  3. **Papéis nos quatro slots**, que é o pedido do "chute bom" virado em estrutura. Peça ao
     Gemini um campo `papel` por faixa:
     - `afinidade` — artista que a pessoa já escolheu, ou vizinho direto dele;
     - `certeira` — combina com a cena, sem risco;
     - `descoberta` — **artista fora do histórico e menos conhecido**, com uma faixa boa;
     - `curinga` — livre.
     No máximo **uma** `afinidade`, para o histórico personalizar sem virar bolha.
  4. Instruir variação explícita de época, idioma e origem entre os quatro.

  O `papel` não é só interno: mostre-o como rótulo pequeno no `MusicSheet` (algo como
  `DESCOBERTA`). Uma sugestão estranha sem explicação parece erro; com o rótulo, vira proposta —
  e isso é Princípio II, não enfeite.

- [X] **T059** [P1] **Qualificar "menos conhecido" com número, não com opinião do modelo.**

  O Gemini não sabe quão conhecido um artista é hoje; ele chuta. O Deezer sabe: o endpoint
  `https://api.deezer.com/artist/{id}` devolve `nb_fan`. Na resolução da faixa de papel
  `descoberta`, confira o `nb_fan` do artista e, se estiver acima de um limiar (comece em
  ~1.000.000 e ajuste **medindo**), peça outra ou promova a próxima candidata. Registre o
  limiar escolhido e por quê.

  Sem isto, `descoberta` vira mais um slot de hit e a Fase 14 não terá mudado nada — só ganho
  um rótulo bonito.

- [X] **T060** [P2] **Tirar a repetição do fallback do Deezer.**

  Em `getSuggestions`, etapa 2: hoje é `searchDeezer(kw, 3)` sobre as duas primeiras keywords,
  sempre do índice 0. Passe a variar o `index` (a busca do Deezer aceita paginação), use mais
  keywords da vibe e descarte o que estiver em `faixasRecentes`. Este é o caminho de degradação
  — ele aparece justamente quando o Gemini falhou, e é hoje o mais repetitivo dos três.

  Amplie também o catálogo local (`FALLBACK`): duas faixas por vibe garantem repetição na
  terceira captura offline. Suba para ~6 por vibe.

- [X] **T061** [P1] **Provar que mudou, com o mesmo roteiro do T056.**

  Cinco capturas da mesma cena, mesma vibe, e a tabela lado a lado com o número do T056.
  Critério de aceite: **≥ 15 faixas distintas em 20** (contra o que o T056 medir) e **pelo menos
  uma `descoberta` por rodada com `nb_fan` abaixo do limiar**. Screenshots em
  `docs/preview/fase14/`. Se o critério não bater, diga o número real — não arredonde a
  conclusão.

---

## Fase 15 — Captura vira tela, não modal (P2) 🟡

**Objetivo**: durante a edição do pacote, a câmera não está mais ligada.
**Princípio**: III (Latência percebida é defeito).

**O que o Sávio pediu**: "acho que não precisa ser um modal a captura, porque a câmera tá ligada
atrás, isso pode perder performance; a captura pode ser uma tela separada, para não ter uma
câmera ligada em segundo plano".

- [X] **T062** [P2] **Medir se a câmera atrás custa mesmo.**

  A premissa é plausível e provavelmente certa, mas é premissa. Hoje
  [`app/camera.tsx`](../../app/camera.tsx) renderiza `<CaptureSheet />` como `<Modal>` **por
  cima da `CameraView` montada** — a `CameraView` continua na árvore o tempo todo. Meça com o
  modal aberto: `dumpsys meminfo com.savioomiodev.synesthesia`, `dumpsys gfxinfo` e o consumo de
  bateria. Registre em `baseline.md`. Se a diferença for irrelevante, **diga isso** — a mudança
  ainda vale por arquitetura, mas o motivo declarado muda.

- [X] **T063** [P2] **Mover a captura para a rota `/capture`.**

  - Nova tela `app/capture.tsx`; `CaptureSheet` deixa de ser `<Modal>` e vira o corpo dela.
  - `capturar()` em `camera.tsx` passa a `router.push('/capture')` depois do `startSession`.
  - `camera.tsx` para de renderizar `<CaptureSheet />`; a `CameraView` sai da árvore quando a
    rota de captura está em cima.

  **Armadilhas**:
  1. O `descartar()` com `Alert` de confirmação estava no `onRequestClose` do Modal. Na tela,
     ele precisa continuar valendo para o **gesto/botão de voltar** do Android — senão a pessoa
     perde a captura sem confirmação, que é regressão direta da US2.
  2. `previewRef` + `captureRef` (o `previewShot`) precisam continuar funcionando fora do Modal.
     Verifique a exportação **com filtro** depois da mudança; é o caminho que gera o .mp4.
  3. `preExport.limpar()` roda hoje no unmount do componente. Confirme que continua rodando ao
     sair da tela, senão o cache de vídeo volta a crescer (foi o T040).
  4. `PostSheet` e `MusicSheet` continuam sendo modais **sobre** a tela de captura — não
     transforme os três de uma vez.

- [X] **T064** [P2] **Confirmar no device que a câmera realmente parou** e repetir a medição do
  T062, lado a lado. `dumpsys media.camera` mostra clientes ativos.

---

## Fase 16 — Enquadramento e flash no visor (P1) 🔴

**Objetivo**: a pessoa escolhe o formato da foto antes de disparar, e consegue luz no escuro.
**Princípio**: II — hoje o app **força** um enquadramento só.

**O que o Sávio pediu**: "colocar na câmera as opções de enquadramento, que o celular 1 por 1,
essas coisas — não podemos forçar o cara a ter isso, por isso temos o Figma; se for possível ter
o flash também".

- [X] **T065** [P1] **Painel "+ Opções" do Figma.**
  Nó [462-889](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=462-889&m=dev)
  — barra horizontal de 382×24 com dois estados (`Propriedade 1=Padrão` e `=Normal`). O estado
  "Padrão" traz, da esquerda para a direita: **fechar (X)**, **flash**, **resolução ("12M")**,
  **ajustes (engrenagem)**; o estado "Normal" traz o ícone de **quatro pontos** à direita, que é
  o seletor de enquadramento/grade.

  Hoje `camera.tsx` tem só um chip de texto `+ OPÇÕES` que empurra direto para `/settings`. Ele
  passa a abrir este painel; a engrenagem é que leva aos Ajustes.

  ⚠️ Puxe o nó você mesmo com o MCP do Figma antes de codar — a leitura acima veio de screenshot
  e não substitui os valores reais de cor, espaçamento e ícone.

- [X] **T066** [P1] **Enquadramento 1:1 / 4:3 / 16:9.**

  Duas metades que precisam bater:
  1. **No visor**: máscara sobre a `CameraView` mostrando a área que será fotografada. Nada de
     mudar o tamanho da `CameraView` — a prévia continua cheia, o que muda é a marcação.
  2. **Na captura**: o recorte tem de ser **real** no arquivo salvo. `expo-image-manipulator` já
     está no projeto e é o que o `photoToBase64` usa — recorte com ele depois do
     `takePictureAsync`.

  **Armadilha**: `sizes.photoAspect` (735/913) está cravado em `CaptureSheet` e na galeria. Com
  enquadramento variável, o aspecto passa a ser propriedade da mídia — provavelmente um campo
  novo em `Media`. Migração de galeria: as mídias já salvas não têm esse campo e não podem
  quebrar.

- [X] **T067** [P2] **Flash.**
  `CameraView` do `expo-camera` aceita `flash` (`'off' | 'on' | 'auto'`) e `enableTorch`. Ligar o
  controle ao ícone do painel do T065, com os três estados visíveis (não um toggle cego). Câmera
  frontal geralmente não tem flash — o controle precisa refletir isso em vez de mentir.

- [X] **T068** [P2] **Fundo base do Figma.**
  Nó [563-52](https://www.figma.com/design/3yJ1nLbHljozr8qqfrQ6yX/JOVI-Challenge---FIAP-2026?node-id=563-52&m=dev):
  gradiente `linear-gradient(180deg, rgba(141,21,20,0.5), rgba(39,6,6,0.25))` sobre `#090506`.

  **Ele nunca foi implementado.** O `CLAUDE.md` descreve esse fundo desde o começo, os tokens
  `rubyGradientTop`/`rubyGradientBottom` existem em [`tokens.ts`](../../src/theme/tokens.ts) — e
  **nenhum componente os usa**. `expo-linear-gradient` **não está instalado**. Instale com
  `npx expo install expo-linear-gradient` (é mudança nativa: exige
  `./scripts/dev-android.sh build`).

---

## Fase 17 — Identidade visual (P3, só depois de 14–16) 🟢

**Objetivo**: o app tem cara de produto, não de protótipo.
**Só começa** quando a Fase 14 estiver fechada e não houver pendência de QA nas 15–16.

- [X] **T069** [P3] **Trocar os ícones do app pelos assets do Sávio.**
  Já estão no repo: `assets/favicon.svg` (40×40), `assets/favicom.png` (160×160),
  `assets/logo-full-name.svg` (170×40), `assets/logo-full-name.png` (680×160). A marca é um
  conjunto de círculos concêntricos em `amber` sobre preto — uma íris/diafragma.
  Faltam entregas do Sávio antes desta task: ver a lista no fim desta fase.

  ⚠️ **Os dois SVGs vêm com `<rect width=... fill="black"/>` embutido como fundo.** Do jeito que
  estão, não dá para pôr a marca sobre o ruby nem sobre o parchment sem um retângulo preto
  aparecer. Precisa da versão sem esse `rect`.

- [ ] **T070** [P3] **Loader animado a partir da marca.**
  O símbolo é feito de círculos e arcos concêntricos — é praticamente um spinner desenhado.
  Animação proposta: o arco externo gira, os anéis internos pulsam em contratempo.

  **Custo real, para decidir com o número na mão**: exige `react-native-svg` **e**
  `react-native-reanimated`, e **nenhum dos dois está instalado**. São duas dependências nativas
  novas e um rebuild. Se não valer o custo, a alternativa honesta é uma animação de opacidade e
  escala sobre o PNG com a `Animated` que já vem no React Native — some some sofisticação, zero
  dependência nova.

- [X] **T071** [P3] **Splash screen com a marca**, usando o `backgroundColor: '#090506'` que já
  está no `app.json`. `expo-splash-screen` também não está instalado.

### O que o Sávio precisa entregar antes da Fase 17

Isto é a lista pedida — o que falta subir em `assets/`:

1. **Ícone do app — 1024×1024 PNG, sem transparência e sem cantos arredondados.** O sistema
   arredonda sozinho; se vier arredondado, arredonda duas vezes.
2. **Adaptive icon do Android — três arquivos 1024×1024**: `foreground` (transparente, com o
   desenho todo dentro dos ~66% centrais, porque o Android corta as bordas em formatos
   diferentes por fabricante), `background` (cor sólida ou imagem) e `monochrome` (silhueta
   branca sobre transparente, para o tema dinâmico do Android 13+).
3. **Splash — 1024×1024 PNG transparente**, só a marca. O fundo vem do `backgroundColor`.
4. **Favicon web — 48×48 e 196×196 PNG.** O de 160×160 quebra o galho, mas os dois tamanhos
   evitam reescala borrada.
5. **Os dois SVGs sem o retângulo preto de fundo** (ver T069). É o item que mais trava trabalho.
6. **Versão monocromática da marca** em `parchment` puro, para usar sobre fundo escuro e sobre
   fundo claro sem depender do amber.
7. *(Opcional, mas ajuda o T070)* **símbolo e wordmark separados** — o círculo sozinho num SVG e
   o texto "Synesthesia" noutro. Assim o loader anima só o símbolo.

---

---

## Fase 18 — QA do Sávio sobre as Fases 14–17 (2026-08-16)

Relatado depois de usar o que as fases anteriores entregaram. Duas frentes: a
curadoria ainda erra, e o enquadramento ficou feio.

### Curadoria

- [X] **T072** [P1] **Nunca entregar faixa sem prévia.** "as músicas frequentemente
  estão vindo desabilitadas isso não pode acontecer... tem que vir sempre 4 músicas
  certinhas". É a **D8 decidida pelo Sávio**: vale a alternativa 3 (exigir preview).
  Pedir ao Gemini mais candidatas do que os 4 slots, resolver todas em paralelo e
  montar o conjunto só com as que têm `previewUrl`.

- [X] **T073** [P1] **Redistribuir os papéis: 2 `certeira` + 1 `curinga` + 1
  `descoberta`.** "vai ser 2 certeiras as mais famosas uma vai ser coringa e outra
  descoberta". Reverte a escolha de duas descobertas do T058 — que era minha, não
  dele. E as certeiras devem ser **as mais famosas**, não só "sem risco".

- [X] **T074** [P1] **Aprender o gosto por gênero, não só por artista.** "eu gosto de
  rock então provavelmente tínhamos que ir entendendo que ele vai ter preferências
  por rock, metal e por uma banda tipo um Skillet". O `useTasteStore` do T057 guarda
  artista; falta o **gênero**. Pegar o gênero sem chamada extra: pedir o campo ao
  Gemini junto de cada sugestão e guardar quando a faixa for escolhida.

  Isto **resolve a D7 pela decisão do Sávio**: ele quer que a curadoria aprenda, o
  que exige o gosto entrar no prompt. Registrar a mudança na nota de privacidade.

- [ ] **T075** [P2] **"as músicas estão nada a ver"** — medir depois de T072–T074 se
  a pertinência melhorou, com o mesmo roteiro do T056.

### Visor e movimento

- [X] **T076** [P1] **Acabar com a borda cinza do enquadramento.** "não gostei de
  quando eu vou mudar a proporção ele fica uma borda cinza pra simbolizar isso não é
  legal, ele tem que ficar com o fundo daquela cor gradiente, é sempre esse o fundo".
  O véu `rgba(9,5,6,0.55)` do T066 sai; o que aparece fora do enquadramento é o
  `FundoBase` do T068.

- [X] **T077** [P1] **A `CameraView` passa a ter o tamanho do enquadramento, com
  animação.** "o visor da câmera se adapta de forma fluida e animada, eu não quero a
  câmera full na tela o tempo todo". Contraria a decisão do T066 (que manteve a
  prévia cheia por instrução da própria task) — **vale o que o Sávio pediu agora**.

- [X] **T078** [P2] **A prévia da captura usa a proporção real da foto.** — feito no **T084**. "a proporção
  da captura tem que ser a mesma da foto tirada, não precisa ser fixa." O T066 já
  gravou `Media.aspecto`; conferir que a prévia usa a dimensão real do arquivo.

- [ ] **T079** [P2] **Animar a abertura do painel "+ Opções".**

- [ ] **T080** [P2] **Levar o movimento do loader para a entrada do app.** "gostei do
  loader de quando está esperando a requisição do Gemini... você não consegue colocar
  esse movimento na entrada do app?" O splash nativo do T071 é estático — a animação
  precisa de uma tela de abertura em JS logo depois dele.

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

### D6 — Com a fonte do sistema ampliada, o modal de captura trunca (achado no T054)

Testando a armadilha 5 do T054 com `settings put system font_scale 1.45`, o carrossel de
miniaturas se comportou (o nome sai de todas menos da selecionada, nada trunca). O **resto**
do modal, não: o título vira "Cant", a label da seção vira "FILT", os botões viram "Salv" e
"Aguarde a", e o aviso de bloqueio corta no meio da segunda linha. Ver
`docs/preview/fase12/04-fonte-ampliada-nome-so-na-selecionada.png`.

Isso é **anterior ao T054** — nada da Fase 12 causou. Mas é o mesmo defeito de fundo que a US1
atacou (controle que não entrega o que promete), agora por tipografia em vez de área de toque.

**Não foi corrigido aqui** porque sairia do escopo da task e mexeria em `CaptureSheet`,
`PostSheet`, `MusicSheet` e `camera.tsx` — decisão de produto sobre até que ampliação o app se
compromete a suportar. **Para o Sávio decidir**: vale uma fase própria de tipografia
responsiva, ou o app declara suporte só até ~1.3?

### D7 — Mandar o gosto musical da pessoa ao Gemini precisa de consentimento próprio (Fase 14, T057)

A Fase 14 só funciona se o prompt levar **os artistas que a pessoa escolhe**. Isso é dado sobre
gosto pessoal saindo do aparelho para um serviço do Google — e **não está coberto** pelo opt-in
que existe hoje. O toggle "Leitura da cena (IA)" (`deteccaoTempoReal`) foi apresentado ao usuário
como autorização para enviar **a foto**; usá-lo também para enviar histórico de gosto seria
ampliar o consentimento sem avisar, que é exatamente o que a nota de privacidade dos Ajustes
promete não fazer.

Três saídas, da mais conservadora para a mais capaz:

1. **Não enviar nada.** O histórico fica só no aparelho e é usado para *filtrar e reordenar* o
   que o Gemini devolveu, sem entrar no prompt. Personaliza menos, não muda consentimento nenhum.
2. **Enviar só a forma, não o nome.** Em vez de "ela gosta de Anitta", mandar gêneros/descritores
   derivados localmente. Menos identificável, ainda útil, mas depende de um mapa artista→gênero
   que hoje não existe.
3. **Toggle próprio nos Ajustes** — algo como "Curadoria personalizada", desligado por padrão,
   com a nota explicando que os nomes dos artistas escolhidos vão junto do pedido ao Gemini.

**Implementada por ora a alternativa 1** (regra 5 das execuções autônomas: a que menos altera
comportamento). Se o Sávio quiser a 3, é um toggle e um parágrafo na nota de privacidade — mas é
decisão dele, não do loop.

**Como ficou, na prática (implementado em 2026-08-16, T057–T059).** A alternativa 1 parecia
esvaziar o slot `afinidade`, já que ele nasceu justamente da ideia de contar ao Gemini quem a
pessoa escuta. Não esvaziou — só mudou de lugar:

- O `useTasteStore` guarda as escolhas **no aparelho** e nada dele entra em prompt nenhum.
- O Gemini devolve as quatro faixas com os papéis `certeira`, `descoberta`, `descoberta` e
  `curinga`, sem saber nada sobre a pessoa.
- Aí sim, **localmente**, `rotularAfinidade` procura entre as quatro devolvidas alguma de artista
  que a pessoa já escolheu; achando, promove ao topo e troca o rótulo para `afinidade`
  ("DO SEU GOSTO" na tela). No máximo uma, como o T058 pede.

O resultado visível é quase o da alternativa 3 — a curadoria reage ao histórico —, e nenhum nome
sai do aparelho. **A diferença que resta**, e que é decisão do Sávio: assim o histórico só pode
*reordenar o que o Gemini já escolheu*, nunca fazer o Gemini **buscar** algo do gosto dela. Se em
5 capturas nenhuma faixa cair perto do histórico, o rótulo `afinidade` simplesmente não aparece.
Para ele aparecer sempre, aí sim seria preciso a alternativa 3 (toggle próprio).

Uma nota separada, porque é outro regime: a **lista de bloqueio** do T058 (as ~20 faixas já
sugeridas) **vai** ao prompt, e isso não amplia consentimento nenhum — são as faixas que o próprio
modelo propôs, não escolhas da pessoa. É o modelo lendo a própria saída anterior.

### D8 — A `descoberta` chega sem áudio, e isso é decisão de produto (Fase 14, T061)

Medido no T061: a curadoria do Gemini entrega tipicamente **`audio=2/4`**. As faixas de
papel `certeira` e `curinga` resolvem no Deezer; as duas `descoberta`, não — 6 dos 8
artistas de descoberta das 5 rodadas **não existem no catálogo do Deezer**.

Isso não quebra o pacote: o `CaptureSheet` escolhe automaticamente a primeira faixa
**com** preview, então a trilha exportada sempre tem som. Mas no `MusicSheet` a
descoberta aparece com o play apagado — ela pode ser escolhida, e não pode ser ouvida
antes. É esquisito justamente na sugestão que mais precisaria convencer.

Três saídas, da mais conservadora para a mais capaz:

1. **Deixar como está** e assumir: a descoberta é uma proposta para procurar depois,
   não uma faixa para ouvir agora. Custo zero. É o que está no ar.
2. **Marcar na tela** que aquela faixa não tem prévia disponível, em vez de só apagar o
   play — hoje o botão apagado parece defeito. Custo baixo, resolve a estranheza sem
   resolver a falta de áudio.
3. **Exigir preview para a descoberta**: quando não resolver, pedir outra ao Gemini ou
   promover uma candidata do Deezer com `nb_fan` baixo. Resolve de verdade, mas custa
   uma chamada a mais no caminho crítico — e o SC-Q03 (mediana ≤ 6 s) foi recalibrado
   na D1 justamente por não haver folga aí.

**Implementada a alternativa 1** por ora (regra 5). A 2 é barata e provavelmente vale;
a 3 troca latência por completude, e essa é escolha do Sávio, não do loop.

### Estado da Fase 17 em 2026-08-16 (para quem retomar)

- **T069 ✅** — os ícones **não** dependiam mais de entrega do Sávio. Como esta
  máquina não tem nenhum rasterizador de SVG (`rsvg-convert`, Inkscape,
  ImageMagick, `cairosvg`, `sharp` — todos ausentes), `scripts/gerar-icones.py`
  desenha os PNGs direto a partir da geometria do símbolo. Verificado no launcher.

- **T070 — implementado, sem evidência.** `src/components/LoaderMarca.tsx` existe,
  o typecheck passa e o app roda com ele no lugar dos `ActivityIndicator` do
  `CaptureSheet` e do `MusicSheet`. **Não marcado como concluído** porque não foi
  visto rodando (regra 2).

  O que atrapalhou, para não repetir a tentativa: a curadoria fechou em ~4 s em
  todas as tentativas (várias caíram no catálogo curado, que é instantâneo), e a
  seção "TRILHA SONORA" fica **abaixo da dobra** — quando o swipe chega, a faixa
  já carregou. Os `input tap` na galeria também rolaram a lista em vez de abrir o
  card.

  **Caminho que deve funcionar**: reabrir uma mídia da galeria (a sessão nasce com
  `sugestoes: []`) e abrir "Trocar música" — o `MusicSheet` dispara
  `getSuggestions` e o loader fica no topo da lista, **acima da dobra**. Alternativa
  mais determinística: pôr o aparelho offline para a busca demorar, ou subir
  temporariamente `ESPERA_QUIETUDE_MS`/o limite da curadoria só para a captura.

- **T071 — não iniciado.** Precisa de `expo-splash-screen` (dependência nativa,
  logo `./scripts/dev-android.sh build`) e do `backgroundColor: '#090506'` que já
  está no `app.json`. O `assets/splash-icon.png` já foi gerado pelo T069:
  1024×1024, transparente, só a marca.

- **Ainda pendente do Sávio** (único item que restou da lista da fase): os SVGs
  `assets/favicon.svg` e `assets/logo-full-name.svg` continuam com
  `<rect ... fill="black"/>` embutido. O `assets/icon.svg` já veio limpo e foi a
  base de tudo; os outros dois só travam usar a marca sobre ruby ou parchment.

---

## Fase 19 — QA do Sávio sobre a captura, a galeria e a postagem (2026-08-16)

Segunda rodada de uso real depois da Fase 18. O tema comum de quase tudo aqui é
**a imagem não é a imagem**: o que o visor mostra, o que o arquivo tem e o que a
prévia desenha são três coisas diferentes hoje. As causas foram lidas no código
antes de escrever estas tasks e estão anotadas em cada uma.

### Decisões do Sávio tomadas junto com este relato

- **D6 encerrada — não se corrige.** Sobre o truncamento com fonte do sistema
  ampliada: *"isso aqui foda-se, é um app de escola, nunca vai ser preciso fazer
  nada em relação a isso, esquece"*. A dúvida fica registrada como **descartada
  por decisão de produto**, não como dívida.
- **Assets liberados.** *"os assets você dá conta, pode tirar, pode fazer o que
  você quiser, editar essas coisas"* — o item "pendente do Sávio" da Fase 17
  (os SVGs com `<rect fill="black">`) deixa de esperar por ele e vira trabalho
  meu. Ver **T086**.
- **O loader aprovado é o da espera do Gemini** (`LoaderMarca`, T070): *"o loader
  ficou bom, se for aquele da aba de música antes dela chegar"*. Isso **valida o
  T070** pela via do uso real e confirma o escopo do **T080**.
- **A grade de destinos morre.** *"esses ícones de compartilhar não prestam, pq
  se eu clicar eles vão abrir o compartilhar nativo do celular de qualquer forma,
  então foda-se, pode tirar"*. Reverte a intenção do T055 — a grade nativa
  resolveu o problema errado.

### Galeria

- [X] **T081** [P1] [BUG] **As prévias sumiram da galeria.** Causa lida no
  código, não é hipótese: `FilteredImage` desenha a foto com
  `StyleSheet.absoluteFill`, o que exige que o container tenha altura própria;
  o `styles.photo` de [gallery.tsx](../../app/gallery.tsx) só declara
  `width: '100%'`, sem altura nenhuma. Altura 0 = card vazio. O card por fora
  tem `aspectRatio`, mas ele não desce para a foto.

- [X] **T082** [P1] [DESIGN] **Cards todos do mesmo tamanho.** Hoje cada card usa
  `aspectRatio: item.aspecto`, então a grade fica serrilhada — 1:1 ao lado de
  16:9. Grade uniforme (quadrada), miniatura em `cover`. A proporção real da
  foto continua guardada em `Media.aspecto` e continua valendo na captura; o que
  padroniza é só a vitrine.

- [X] **T083** [P1] [BUG] **Reabrir uma foto da galeria dispara a curadoria de
  novo.** *"se eu clicar em uma imagem ele aparece falando que tá buscando a
  música de novo, não estamos com essa decisão guardada já no armazenamento?"* —
  está sim, e o bug é a guarda do efeito: em
  [CaptureSheet.tsx](../../src/components/CaptureSheet.tsx) a condição de saída é
  `s.sugestoes.length > 0`, e uma mídia reaberta da galeria nasce com
  `sugestoes: []` porque **as sugestões nunca foram persistidas** — só a faixa
  escolhida. Resultado: chamada nova ao Gemini, vibe recalculada por cima da
  salva e o estado voltando para `carregando` num pacote que já estava pronto.

  Duas metades: (a) mídia reaberta com `musica` não redisparar curadoria
  nenhuma; (b) persistir `sugestoes` na `Media`, para "Trocar música" numa foto
  antiga abrir com as quatro opções já conhecidas, sem rede.

### Captura e proporção

- [X] **T084** [P1] [BUG] **A foto capturada não é a foto que aparece na
  captura.** *"parece que deu um zoom"*. São dois cortes empilhados: o visor
  mostra a prévia em `cover` (corta o que não cabe no aspecto escolhido), o
  arquivo é recortado **de novo** por `recortarNoAspecto`, e a prévia desenha
  esse arquivo em `cover` dentro de um `aspectRatio: session.aspecto` que é a
  razão *pedida*, não a razão *real* do arquivo. Onde as três discordam, aparece
  zoom.

  Regra que o Sávio deu, e que resolve por construção: **a tela de captura monta
  a imagem com largura 100% e altura automática pela proporção real do arquivo**
  — assim nunca distorce e nunca corta. Absorve o **T078**.

- [X] **T085** [P1] [PERF] **Demora entre disparar e ver a foto na captura.**
  `capturar()` em [camera.tsx](../../app/camera.tsx) espera `takePictureAsync` e
  **depois** reescreve o arquivo inteiro em `recortarNoAspecto` (com
  `compress: 1`, ou seja, recodifica o JPEG grande todo) antes de navegar. É
  trabalho síncrono no caminho crítico do toque. Com o T084, o recorte só
  precisa existir quando o enquadramento não for o nativo do sensor.

- [X] **T086** [P1] [DESIGN] **Enquadramento pelo sensor, não por corte.** *"essa
  aspect ratio que você tá fazendo é o quê, um corte na imagem? tem alguma forma
  de fazer isso nativo? olha a câmera nativa pra ver como ela faz de uma forma
  tão natural"*. Resposta honesta: 4:3 e 16:9 **existem no sensor** e podem ser
  pedidos via `pictureSize` (`getAvailablePictureSizesAsync` já é chamado hoje,
  só para rotular a resolução); 1:1 **não existe** em sensor nenhum — a câmera
  nativa também corta. Pedir ao sensor o que ele tem, e cortar só o que ele não
  tem.

- [X] **T087** [P1] [DESIGN] **O visor centralizado na área útil.** *"fica
  desproporcional e descentralizada da área útil da tela; a área útil seria a
  área entre os controles da câmera e as opções"*. Hoje o palco é
  `StyleSheet.absoluteFill` — a prévia se centraliza na **tela inteira** e os
  controles ficam por cima dela. O palco passa a ser a faixa entre a barra
  superior e a barra de controles.

### Postagem

- [X] **T088** [P1] [DESIGN] **Um botão "Postar", e ele abre a folha nativa.**
  Tira a grade de destinos do T055 e o módulo `share-target` do caminho da UI.
  Resolve junto o **erro do Instagram** relatado (*"só consigo mandar por
  mensagem o vídeo gerado"*): a folha do sistema concede a permissão de URI ao
  app escolhido, o que o Intent direto por activity não garante.

- [X] **T089** [P1] [BUG] **"Baixar vídeo" não funciona.**
  `saveToSystemGallery` pede a permissão granular **`['photo']`** e depois manda
  um `.mp4` para a biblioteca — no Android 13+ salvar vídeo exige a permissão de
  vídeo, então a chamada falha e a função devolve `false` em silêncio (o `catch`
  vazio). O botão fica "BAIXAR VÍDEO" para sempre, sem erro nenhum à vista.

### Movimento

- [ ] **T080** [P2] **Loader na entrada do app** — confirmado pelo Sávio como o
  movimento que ele quer na abertura. Continua na fila, agora com o
  `LoaderMarca` validado no uso real.

- [ ] **T090** [P3] **Assets: limpar os SVGs e gerar o que faltar.** Liberado
  pelo Sávio. Tirar o `<rect fill="black">` de `assets/favicon.svg` e
  `assets/logo-full-name.svg` e gerar a variante monocromática em `parchment`.

### Validado no aparelho em 2026-08-16 (Fase 19, T081–T089)

Tudo abaixo foi visto rodando, não só compilado:

- **A foto agora sai em pé.** Antes: `cache/Camera/*.jpg` em 2560×1920 e
  9248×6936 — todas deitadas, todas as capturas do histórico. Depois: 1920×2560,
  e o preparo nem recodifica quando o sensor já entrega no formato certo.
- **A prévia bate com o arquivo.** Enquadramento 16:9 → arquivo 1440×2560 →
  prévia desenhada em 0,5625. Nenhum corte entre o disparo e a tela.
- **Galeria**: miniaturas de volta e grade uniforme.
- **Reabrir da galeria** entra direto com "Postar agora" **habilitado** — sem
  "LENDO A CENA", sem chamada nova ao Gemini.
- **Postagem**: "Vídeo gerado!" com um botão "Postar" só.
- **Baixar vídeo**: "SALVO NA GALERIA", e o arquivo confirmado fora do app em
  `/sdcard/DCIM/pacote-1786912304053.mp4`.

Descoberta que vale registrar para quem mexer na câmera: **este aparelho
devolve a foto deitada quando nenhuma `pictureSize` é pedida** (era o caso de
todas as capturas até aqui) e em pé quando ela é. O `prepararFoto` não depende
disso — ele olha as dimensões que chegaram e gira só se precisar —, mas quem for
mexer em `takePictureAsync` precisa saber que a orientação **não** é garantida
nem vem por EXIF.

---

## Fase 20 — Visor de largura cheia, movimento e vocabulário (2026-08-16)

Terceira rodada do mesmo dia, sobre o que a Fase 19 entregou.

- [X] **T091** [P1] [DESIGN] **Largura cheia sempre, inclusive no 16:9.** *"em
  16:9 ele não tá ocupando 100% da largura, e esse é requisito também; então aí
  temos que crescer, e para crescer tem que passar por baixo, e aí tem que
  passar tudo — mas só da lista de filtros"*.

  A Fase 19 tinha limitado o visor à faixa entre as barras, o que resolvia o
  4:3 e o 1:1 e **estragava** o 16:9: sem altura para 1920px, ele encolhia de
  lado. Agora a largura é a da tela nos três, a altura vem da razão, e o piso é
  o topo dos controles — medido, não chutado. No 16:9 o carrossel de filtros
  passa a flutuar **inteiro** sobre a prévia, com um degradê que o sustenta; nos
  outros dois o visor nem chega perto dele.

  A regra em uma linha: *o visor pode invadir os filtros, nunca os controles.*

- [X] **T079** [P2] **Animar a abertura do painel "+ Opções".** *"e seu
  desgraçado não tem animação para abrir as opções, ela abre seco"*. Estava na
  fila desde a Fase 18. O badge de vibe e a barra agora ficam **sobrepostos** e
  trocam por opacidade, com a barra deslizando de cima; antes um desmontava para
  o outro montar, e troca instantânea não tem o que animar.

  ⚠️ Para quem repetir o padrão: a primeira versão disparava a animação no mesmo
  toque que montava a barra, e com `useNativeDriver` ela **terminava no vazio** —
  o driver nativo não tinha nó para atualizar e a barra aparecia invisível
  (visto no aparelho). A entrada tem de rodar num efeito, depois da montagem.

- [X] **T092** [P3] **"Pacote" vira "momento" na interface.** Decisão do Sávio:
  *"em vez de pacotes vamos chamar de momentos"*. Trocado só no que a pessoa lê
  — galeria, captura, postagem e alertas. O código segue com `SharePackage`,
  `chavePacote` e afins, que são nomes de estrutura, não de produto.

- [X] **T093** [P1] [DESIGN] **Cada enquadramento com a sua âncora, e o FULL de
  volta.** Três correções sobre o T091, todas ditadas pelo Sávio:

  1. *"parece que deu uma mudada no eixo de centralização do 1:1 e 4:3... ficou
     ruim esses dois que estavam bons"* — estavam mesmo. O T091 passou a
     centralizar todo mundo na tela, e os dois que **cabem** na área útil devem
     se centralizar **nela**, entre a barra de opções e os filtros.
  2. *"a de 16:9 ela deve começar nos controladores"* — ancorada embaixo, ela
     cresce para cima e nunca deixa aquela faixa de imagem órfã entre os filtros
     e os botões (que era o "ainda passa por baixo dos controladores" que ele
     viu, e que eu não peguei na validação anterior).
  3. *"deixa a opção full, tá faltando"* — enquadramento novo, com a razão da
     própria tela. A prévia toma tudo e a foto sai recortada nessa razão.

  As âncoras (`util` / `controles` / `tela`) agora são declaradas em
  `ENQUADRAMENTOS`, ao lado da razão: onde o visor vive é decisão de produto,
  não consequência da proporção.

  ⚠️ **Duas armadilhas pagas neste ciclo**, ambas vistas no aparelho:
  - `onLayout` com atualização funcional — `setFaixas((f) => ({ ...f, ui:
    e.nativeEvent.layout.height }))` **quebra**: o updater roda depois, e aí o
    evento já foi reciclado (`Cannot read property 'layout' of null`). Ler a
    medida numa constante antes resolve.
  - `StyleSheet.absoluteFill` dentro de uma `SafeAreaView` **ignora o padding
    dela**. Ancorar "no topo dos controles" sem descontar `insets.bottom` põe o
    visor a uma barra de navegação inteira de distância — foi exatamente por
    isso que a primeira tentativa do 16:9 continuou invadindo os botões.

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

Para ler os logs do JS use o `/tmp/metro.log`: com o Metro conectado, `console.log` **não**
aparece no `adb logcat`. O logcat só serve para o nativo (`VideoMuxer`, `AndroidRuntime`).

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

**Objetivo**: reduzir em ≥40% a mediana do tempo até a trilha (linha de base 30–45s).
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

- [ ] T033 [US6] Emitir evento de progresso do módulo nativo em `modules/video-muxer/android/src/main/java/expo/modules/videomuxer/VideoMuxerModule.kt`, consultando o progresso do Transformer conforme o contrato (C-01 a C-04)
- [ ] T034 [US6] Expor o evento e seus tipos em `modules/video-muxer/src/VideoMuxerModule.ts` e `VideoMuxer.types.ts`
- [ ] T035 [US6] Consumir o progresso em `src/services/videoMuxer.ts` e apresentá-lo em `src/components/PostSheet.tsx`, mantendo o indicador indefinido como fallback (C-04)
- [ ] T036 [US6] Confirmar que a Promise continua sendo a fonte da verdade de sucesso/falha e que ignorar o evento mantém o comportamento do v1 (C-01)
- [ ] T037 [US6] Validar no dispositivo com `./scripts/dev-android.sh log`: progresso monotônico, chega a 100, interface responsiva; anexar screenshots em `docs/preview/us6/`

---

## Fase 9 — Performance e fechamento

- [ ] T038 [P] Investigar re-renders desnecessários em `app/camera.tsx` (a tela recalcula vibe em tempo real) e corrigir os que forem confirmados por medição
- [ ] T039 [P] Verificar fluidez do preview com filtro ativo em `src/components/FilterLayer.tsx`; registrar o resultado
- [ ] T040 [P] Verificar acúmulo de memória abrindo e fechando `src/components/CaptureSheet.tsx` 20 vezes seguidas
- [ ] T041 **Não regressão obrigatória**: gerar um pacote completo e confirmar trilhas `vide`+`soun`, codecs `avc1`+`mp4a` e duração igual ao trecho aprovado, conforme [quickstart.md](./quickstart.md) (FR-Q16, SC-Q07)
- [ ] T042 Atualizar `README.md` com os screenshots novos, se as telas mudaram visualmente
- [ ] T043 Rodar `npm run typecheck` e revisar o diff completo da rodada antes do commit final

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

- [ ] T044 [BUG] **Dois áudios tocam ao mesmo tempo.** Com a prévia principal tocando, dar
  play numa opção do modal de música faz as duas soarem juntas.
  **Diagnóstico**: são dois players independentes de `expo-audio`, e nenhum sabe do outro —
  `useAudioPlayer(musica.previewUrl)` em [`MusicPlayer.tsx`](../../src/components/MusicPlayer.tsx)
  e `useAudioPlayer(null)` em [`MusicSheet.tsx`](../../src/components/MusicSheet.tsx). O
  `MusicPlayer` continua montado por baixo enquanto o modal está aberto, então nada o pausa.
  **Onde atacar**: pausar o player do `MusicPlayer` quando `showMusic` vira `true` em
  `CaptureSheet`, ou — melhor — dar um dono único à reprodução, já que hoje dois componentes
  disputam a mesma saída de áudio.

- [ ] T045 [BUG] **"Postar agora" parece travado e mostra o modal errado antes do vídeo.**
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

- [ ] T046 [DESIGN] **Trocar a tipografia para Lato e Nunito.** Hoje são Syne (display) e
  DM Mono (labels técnicas). Envolve `@expo-google-fonts/lato` e `@expo-google-fonts/nunito`,
  o `useFonts` de [`app/_layout.tsx`](../../app/_layout.tsx) e os tokens `fonts` de
  [`src/theme/tokens.ts`](../../src/theme/tokens.ts).
  ⚠️ **Contradiz a fonte da verdade atual**: o `CLAUDE.md` e o guia do Figma fixam Syne +
  DM Mono como identidade. Trocar exige atualizar o `CLAUDE.md` junto, senão o próximo agente
  reverte achando que é engano. Ver **D2**.

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

**Ainda em aberto**: o SC-Q03 continua escrito no [spec.md](./spec.md) com a linha de base de
30–45 s, que não se reproduz. Alguém precisa decidir se recalibra o critério para a faixa
real (~5,5 s) ou se mantém o alvo e autoriza a troca de modelo. Enquanto isso, o critério
está **não atingido** de propósito, e não marcado como cumprido.

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

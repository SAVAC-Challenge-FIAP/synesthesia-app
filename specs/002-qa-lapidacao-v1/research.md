# Research — QA e Lapidação do MVP v1

**Feature**: `002-qa-lapidacao-v1` | **Date**: 2026-08-15

Todas as observações abaixo vêm de **teste em dispositivo real** (Redmi Note 8 Pro, Android 10, 1080×2340) ou de **inspeção do código-fonte atual** — nenhuma é suposição.

---

## R1 — Área de toque sob a barra de navegação

**Observação medida**: no modal de captura, `adb shell input tap 790 2213` no botão "Postar agora" **não** aciona a ação; `adb shell input tap 790 2180` aciona. O botão é visível em ambas as coordenadas, mas a faixa inferior é interceptada pelo sistema.

**Decision**: aplicar insets reais do dispositivo com `react-native-safe-area-context` nos containers de ação.

**Rationale**: o valor a reservar não é constante — muda entre navegação por botões e por gestos, e entre fabricantes. Qualquer `paddingBottom` fixo acerta um aparelho e erra outro.

**Alternatives considered**:
- `SafeAreaView` do React Native core — **rejeitado**: no Android ele não considera a barra de navegação, só a status bar; resolveria no iOS e manteria o bug aqui.
- `paddingBottom` fixo maior — **rejeitado**: é o que existe hoje; empurra o problema para outro aparelho e desperdiça espaço nos que não precisam.

---

## R2 — Postagem durante a curadoria

**Observação medida**: com a trilha ainda em "LENDO A CENA E CURANDO A TRILHA...", acionar a postagem produz a tela "Pacote pronto! Sua captura vai como imagem, sem trilha." Reproduzido duas vezes de forma independente durante os testes.

**Causa no código**: `exportPackage()` em `src/services/sharePackage.ts` retorna cedo quando `musica` é `null`:

```
if (!musica) {
  return { videoUri: null, imageUri, audioUri: null, caption: null, musica: null };
}
```

Como o muxer só é chamado quando há `audioUri`, **nem o vídeo nem a trilha são gerados** — e nada nesse caminho comunica perda ao usuário.

**Decision**: bloquear a ação de postar enquanto a curadoria estiver em andamento e exigir confirmação explícita quando a curadoria terminar sem trilha. Manter "Salvar" sempre disponível.

**Rationale**: protege o Princípio I sem violar a regra "nunca perder a foto". O usuário nunca é impedido de guardar seu registro; ele só é impedido de *achar* que levou o pacote completo quando não levou.

**Alternatives considered**:
- Enfileirar a intenção e postar sozinho quando a trilha chegar — **rejeitado**: ação de saída disparando sem o usuário presente é surpreendente e pode publicar algo que ele não viu.
- Deixar como está e só melhorar o texto — **rejeitado**: o usuário continuaria perdendo a metade sonora, apenas com aviso melhor. Não restaura o Princípio I.

---

## R3 — Latência da curadoria musical (30–45s)

**Observação medida**: entre o disparo e a trilha visível passaram-se ~30–45s em múltiplas capturas, com rede estável.

**Inspeção do código** (`src/services/music.ts`) — a cadeia é inerentemente serial porque cada etapa depende da anterior:

| Etapa | Função | Pode paralelizar? |
|---|---|---|
| 1. Reduzir a foto e converter | `photoToBase64` (resize 640px, JPEG q0.6) | Não com as seguintes — mas **pode começar antes** |
| 2. Ler a cena | `askGeminiWithPhoto` | Não — depende de (1) |
| 3. Resolver as faixas | `resolveWithDeezer` | **Já é paralelo** (`Promise.all` sobre 4 faixas) |

**Decision**: **medir antes de otimizar.** Instrumentar as três etapas com marcações de tempo e só então atacar a dominante.

**Rationale**: a hipótese intuitiva ("as buscas do Deezer estão em série") **é falsa** — `resolveWithDeezer` já usa `Promise.all`. Otimizar ali seria esforço sem retorno. Sem medição, o próximo palpite tem a mesma chance de errar.

**Hipóteses a testar, na ordem** (só valem depois da medição):
1. **Antecipar a etapa 1**: a redução da imagem pode começar no instante da captura, em paralelo com a animação de abertura do modal, em vez de depois dela.
2. **Reduzir o payload**: 640px a q0.6 pode ser mais do que o necessário para a leitura de cena; menos bytes = upload mais rápido.
3. **Feedback de progresso**: mesmo sem ganho de tempo real, comunicar etapa atual ("lendo a cena" → "buscando faixas") reduz a *percepção* de espera — que é o que o Princípio III chama de bug.

**Alternatives considered**:
- Trocar o modelo do Gemini por um mais rápido — **adiado**: muda a qualidade da leitura de cena, que é o diferencial do produto. Só considerar se a medição mostrar que a etapa 2 domina e as outras opções se esgotarem.
- Cache por vibe — **adiado**: ajuda em repetições, não na primeira captura, que é o caso que dói.

---

## R4 — Carrossel de filtros

**Observação**: nas capturas de tela, o 4º chip aparece cortado ("❤️ L..." de LOVE) sem indicação de continuidade. São 8 filtros; 3 e um fragmento ficam visíveis.

**Decision**: dar affordance explícita de rolagem horizontal, garantindo que nenhum item fique cortado de forma ambígua em repouso.

**Rationale**: um item cortado ao meio lê como defeito de layout, não como "tem mais à direita" — especialmente para quem vê o app pela primeira vez (o caso do avaliador).

**Alternatives considered**:
- Diminuir os chips para caber mais — **rejeitado**: prejudica legibilidade e alvo de toque (que a US1 exige ≥48dp).
- Grade de duas linhas — **rejeitado**: rouba área do visor, que é o coração da tela.

---

## R5 — Ícones de controle

**Observação**: os controles (galeria 🏞️, virar câmera 🔄, fechar ✕, play/pause) usam emoji. Emoji é desenhado pelo fabricante — a mesma versão do app tem aparência diferente em cada aparelho.

**Decision**: migrar apenas os **ícones de controle** para `@expo/vector-icons`; preservar os emojis de **filtros e vibes**.

**Rationale**: nos filtros e vibes o emoji é *conteúdo* — faz parte da identidade do produto (Vivid 🌟, Neon 🌈, vibe sonhadora 💭). Nos controles ele é *interface*, e interface precisa ser previsível e tingível com os tokens da paleta.

**Alternatives considered**:
- Trocar tudo, inclusive filtros — **rejeitado**: apagaria a linguagem visual definida no Figma e no guia do produto.
- Fonte de ícones customizada — **rejeitado**: dependência e peso desnecessários; `@expo/vector-icons` já vem instalado com o Expo.

---

## R6 — Progresso da exportação do vídeo

**Observação medida**: a geração do `.mp4` levou 40–70s nos testes. Hoje `VideoMuxerModule.kt` só resolve a Promise em `onCompleted` — nada é informado durante o processo.

**Decision**: emitir progresso do módulo nativo para o JS durante a exportação.

**Rationale**: o Media3 Transformer expõe progresso (consulta por `getProgress` com um `ProgressHolder`), então a informação **já existe** — só não está sendo aproveitada. É a diferença entre um spinner indefinido e uma barra que anda.

**Alternatives considered**:
- Progresso estimado por tempo decorrido — **rejeitado**: mentira piedosa que quebra quando o aparelho é mais lento ou mais rápido que o palpite.
- Deixar spinner indefinido — **rejeitado**: 40–70s de spinner sem avanço lê como travamento.

---

## Restrição transversal — verificação

Toda correção é verificada **no dispositivo**, com evidência visual antes/depois, usando `./scripts/dev-android.sh` e `adb`. **EAS Build é proibido** nesta rodada — a cota está reservada para a publicação final.

Notas operacionais aprendidas nos testes do v1, válidas aqui:
- `run-as` **não** funciona em APK release (pacote não-debuggable) — para inspecionar mídia gerada, consultar o MediaStore.
- `find /sdcard -iname '*.mp4'` **não** enxerga arquivos criados pelo app no Android 10 (scoped storage), mesmo existindo; o MediaStore é a fonte da verdade.
- Toques abaixo de y≈2200 (em 1080×2340) são interceptados pelo sistema — relevante ao automatizar a verificação da própria US1.

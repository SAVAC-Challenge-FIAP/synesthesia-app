# Quickstart: validar "Vibe definida pela IA"

**Fase 1** · 2026-08-22 · Roteiro de validação. Não é documento de implementação
— o passo a passo do código vive em `tasks.md`.

## Pré-requisitos

- Node 20+, dev build Android instalada (Expo Go **não** serve: `expo-location` adiciona permissão nativa).
- `.env` com `EXPO_PUBLIC_GEMINI_API_KEY` válida. Sem ela, só os cenários de degradação são verificáveis.
- Ajustes → **Detecção em tempo real** ligado (é o opt-in que autoriza a foto ir ao Gemini).
- Aparelho com rede.

```bash
npm install
npm run typecheck        # porta de qualidade: precisa passar limpo
npx expo run:android     # rebuild obrigatório na fatia US4 (permissão nativa nova)
```

> **Metro**: se precisar reiniciar, mate pelo PID da porta — `pkill` não basta,
> ele memoiza a config do Babel por processo.

Os logs são a instrumentação principal:

```bash
adb logcat -s ReactNativeJS | grep -E "\[music\]|\[gosto\]|\[contexto\]"
```

---

## V1 — A vibe descreve a cena (US1) · FR-030, FR-031

**A foto do defeito original**: papel de parede de samurai, sem nada brasileiro.

1. Abra o app, aponte para a imagem do samurai, capture.
2. **No instante em que o modal abre** — antes de o Gemini responder — olhe a linha da vibe.

| Esperado | Falha |
|---|---|
| Esqueleto pulsando no lugar da vibe | Qualquer nome escrito ali (violação direta de FR-031) |
| Vocabulário igual ao dos esqueletos do carrossel logo abaixo | Dois estilos de espera na mesma tela |

3. Aguarde a resposta. A vibe aparece com **até duas palavras**, descrevendo a cena — algo na linha de "Noite Cibernética".

| Esperado | Falha |
|---|---|
| Sentimento ou lugar, ligado ao que está na foto | Um dos oito nomes antigos (Energética, Sonhadora, …) |
| Duas palavras no máximo | Frase longa vazando do layout |

4. No log: `[music] Gemini leu a cena: "…" → vibe="…"`.

**Determinismo** — reabra a mesma foto pela galeria: mesma vibe, sem nova
chamada ao Gemini (`análise reaproveitada do cache`).

---

## V2 — A trilha combina com a foto (US2) · FR-032

Na mesma captura de V1, sem nenhum elemento brasileiro na cena:

| Esperado | Falha |
|---|---|
| As 4 faixas se relacionam com a cena descrita | Funk / Copa do Mundo / pop dance genérico |
| Justificativas citam o que está na foto | Justificativas que serviriam para qualquer imagem |
| Nenhum termo de `musicaKeywords` nos termos de busca do log | `"funk brasileiro"` ou `"pop dance hit"` na busca |

**Hora do dia** (US2, cenário 2): repita a captura após as 22h. A leitura da
cena deve refletir o horário — e o log deve mostrar a linha de contexto
`[contexto] hora=…` compondo o prompt.

---

## V3 — Degradação (US1 cenário 3) · FR-036

Três cortes, um de cada vez:

| Corte | Como | Esperado |
|---|---|---|
| Sem chave | Remova `EXPO_PUBLIC_GEMINI_API_KEY`, reinicie o Metro | Vibe cai no nome do piso local; **esqueleto sai da tela**; foto salva normal |
| Sem rede | Modo avião após enquadrar, antes de capturar | Idem, dentro do teto da interface |
| Tempo esgotado | Rede muito lenta (throttling do emulador) | Após 22s, piso local; nada preso |

**A falha que importa**: esqueleto que nunca vira texto. A spec nomeia isso
explicitamente ("sem esqueleto preso na tela").

Confira também: o **visor ao vivo** continua trocando de vibe e de preset
normalmente em todos os três cortes — ele não pode ter passado a esperar rede
(FR-021).

---

## V4 — Gosto entra no prompt (US3) · FR-033

1. Em três capturas seguidas, **troque a música manualmente** no `MusicSheet`, escolhendo faixas do mesmo gênero (ex.: rock).
2. Em duas delas, troque também o tratamento no carrossel.
3. Log esperado a cada escolha: `[gosto] escolha manual «…»` e `[gosto-visual] escolha manual «…»`.
4. Na quarta captura, inspecione o prompt montado (log de depuração da fatia US3).

| Esperado | Falha |
|---|---|
| Lista de músicas com título, artista e gênero | Agregados ("gosta de rock") — é o formato antigo |
| Lista de tratamentos com base e ajustes | Ausência da lista visual |
| **No máximo 20** de cada | Lista crescendo sem teto |
| As sugestões seguintes conversam com o gosto | Nenhuma relação após 3 escolhas do mesmo gênero |

**Aparelho novo** (cenário 2): limpe os dados do app e capture. O prompt sai sem
nenhuma seção de gosto, e nada quebra.

---

## V5 — Lugar e hora (US4) · FR-034

Requer rebuild (`npx expo run:android`) — permissão nativa nova.

> Regime revisto em 2026-08-22 (decisão do Sávio, emenda 1.2.0 da constituição):
> localização **ligada por padrão**, consentida no **onboarding**.

**Instalação limpa** (apague os dados do app antes):

1. Abra o app. O onboarding mostra **três** cards: 📸 CÂMERA, 🏞️ GALERIA e 📍 LOCALIZAÇÃO · OPCIONAL — este último dizendo que só a cidade é enviada e que dá para recusar.
2. Toque **Permitir tudo**. Os diálogos vêm em ordem, com a localização **por último**.
3. Conceda. Log na primeira captura: `[contexto] hora="…" lugar="Cidade, UF"`.

| Esperado | Falha |
|---|---|
| Texto de cidade/região no log | **Coordenadas** — violação de D5 |
| A vibe reflete o lugar (praia → algo praiano) | Lugar ignorado na leitura |
| Latência sem aumento perceptível | Espera nova antes da curadoria |
| Ajustes → "Usar localização" **ligado** | Desligado: o default não pegou |

**Recusa** (apague os dados de novo):

4. No onboarding, toque **Permitir tudo** e **negue** só a localização. O app **entra normalmente** — recusar localização não pode bloquear nada.
5. Capture: só hora e imagem no prompt, `[contexto] lugar="(ausente)"`, **e nenhum diálogo de permissão aparece durante a captura** (cenário 2 é explícito nisso).

**Revogação**:

6. Com a permissão concedida, desligue Ajustes → **Usar localização** e capture: `lugar="(ausente)"` imediatamente, sem precisar mexer nas configurações do sistema.

| Esperado | Falha |
|---|---|
| Recusar não bloqueia a entrada no app | Gate preso na localização |
| Nenhum pedido durante a captura | Diálogo no meio da foto |
| Toggle desligado corta o envio na hora | Lugar continua indo |

---

## V6 — Nada regrediu · FR-035 e riscos da spec

Checklist final, na ordem dos riscos que a spec listou:

- [ ] **Mídia antiga abre.** Uma foto salva antes desta feature abre da galeria com a vibe que tinha gravada, emoji incluído, e o áudio toca.
- [ ] **Galeria mista.** Cards antigos (`🌅 DOURADA`) e novos (`PRAIANA`) convivem na mesma grade sem quebra de layout.
- [ ] **Visor ao vivo.** Vibe recalculada ao virar a câmera, preset aplicado na hora, sem rede.
- [ ] **Carrossel de tratamentos.** Três looks + presets, inalterados (fora de escopo).
- [ ] **Salvar e postar.** Pacote sensorial completo: foto tratada + trecho de áudio + `.mp4` gerado.
- [ ] **Histórico de gosto sobreviveu à atualização.** Escolhas anteriores continuam contando após a troca de índice por lista (data-model §5).
- [ ] `npm run typecheck` limpo.

---

## Critérios de aceite, resumidos

| # | Fatia | Passa quando |
|---|---|---|
| V1 | US1 | Vibe de 2 palavras descreve a cena; esqueleto durante a espera, nunca palpite |
| V2 | US2 | Faixas ligadas à cena; nenhuma keyword de rótulo na busca |
| V3 | US1/FR-036 | Três cortes degradam para o piso local, sem esqueleto preso, visor intacto |
| V4 | US3 | Até 20 escolhas de cada tipo no prompt; aparelho novo não quebra |
| V5 | US4 | Consentimento no onboarding; cidade em texto; recusa não bloqueia; toggle revoga |
| V6 | FR-035 | Mídias antigas, galeria, visor, salvar e histórico sem regressão |

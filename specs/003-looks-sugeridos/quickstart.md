# Quickstart — Validação no dispositivo

**Feature**: `003-looks-sugeridos` | **Date**: 2026-08-20

Como provar que a feature funciona. **Toda validação é em dispositivo real** — não existe suíte automatizada de UI neste projeto (ver Technical Context do `plan.md`), então o roteiro manual é o critério de aceite.

> ⚠️ **EAS Build é proibido para testes.** A cota está reservada para a publicação final. Use apenas o build local via `dev-android.sh`.

---

## Pré-requisitos

```bash
npm install          # node_modules não vem no repo
npm run typecheck    # tem que sair verde antes de instalar

# Confirmar que o device responde
adb devices                      # deve listar 192.168.15.3:5555

# Se caiu (o modo Wi-Fi não sobrevive a reboot do aparelho):
# conecte o cabo USB e rode:
./scripts/dev-android.sh conectar
```

Precisa de `EXPO_PUBLIC_GEMINI_API_KEY` no `.env` para ver os looks vindos da cena (a leitura da IA). **Sem a chave o app funciona igual** — cai nos três looks base derivados da vibe, que é justamente o piso que FR-019/SC-004 exigem. Testar nos dois modos é verificação, não contorno.

**MIUI/Xiaomi**: a instalação via `adb install` falha com `INSTALL_FAILED_USER_RESTRICTED` até ligar, no aparelho, Ajustes → Opções do desenvolvedor → **"Depuração USB (Configurações de segurança)"**. É um toque físico na tela, sem alternativa por linha de comando.

## Ciclo de trabalho

```bash
./scripts/dev-android.sh build   # compila + instala (~1 min incremental)
./scripts/dev-android.sh log     # logcat nativo do VideoMuxer
./scripts/dev-android.sh shot    # screenshot -> /tmp/synesthesia-tela.png
```

Os tempos de cada etapa da curadoria (imagem/Gemini/Deezer) aparecem no console do Metro — instrumentação do T020, reaproveitada aqui para medir a chamada que agora também carrega os looks.

---

## US1 — Escolher entre três looks sugeridos (P1)

1. Capturar uma foto com a chave do Gemini configurada.
2. No Modal de Captura, sob "LOOKS SUGERIDOS", devem aparecer **três chips**, cada um com nome, papel e uma linha de justificativa.
3. A prévia da foto já deve sair com o **primeiro** look aplicado, sem toque nenhum.
4. Tocar no segundo chip: a prévia muda **na hora**, sem spinner, sem chamada de rede (confirmar no Metro — nenhuma requisição nova).
5. Tocar numa das 8 miniaturas de filtro abaixo: a receita do look zera e vale o preset puro (`filtroId` some do look sugerido, `lookEscolhido: null`).
6. Tocar em "Original" (primeira miniatura): a foto volta a sair exatamente como capturada, sem overlay nem ajuste algum.

✅ **Aceite** (FR-001 a FR-009, SC-001, SC-003):
- Sempre três sugestões, nunca duas nem quatro.
- Cada uma com nome + justificativa de uma linha + papel visível.
- Trocar entre elas é instantâneo — sem espera perceptível (SC-003).
- Os 8 presets continuam alcançáveis depois das sugestões, "Original" incluído.
- De foto capturada a mídia salva, nenhum toque a mais além do disparo e do "Salvar" (SC-001).

---

## US2 — O app aprende o gosto visual (P1)

1. Com o histórico de gosto visual zerado (aparelho novo, ou depois de apagar em Ajustes), capturar uma foto: nenhum chip deve vir rotulado como afinidade — as três sugestões vêm da cena.
2. Capturar e **salvar** cinco fotos seguidas da mesma vibe, sempre escolhendo (tocando) o mesmo tratamento.
3. Capturar uma sexta foto da mesma vibe.

✅ **Aceite** (FR-010 a FR-017, SC-002, SC-008):
- Na sexta captura, a sugestão principal é o tratamento repetido, agora rotulado como afinidade — em 100% das repetições deste teste (SC-002).
- As outras duas sugestões continuam vindo só da cena.
- Trocar manualmente de look antes de salvar deve pesar mais que aceitar em silêncio o que veio aplicado — repetir o teste anterior com aceite passivo (não tocar em nada) deve exigir mais repetições para a afinidade aparecer.
- Inspecionar o corpo da requisição ao Gemini (log do Metro ou proxy) e confirmar que nenhum artista, nome ou id do histórico de gosto **visual** aparece ali — só o histórico **musical** já autorizado (SC-008). `useLookTasteStore` não deve aparecer em nenhum import de `src/services/music.ts`.
- Em Ajustes → Privacidade → "Histórico de gosto visual" → Apagar (com confirmação): a próxima captura da mesma vibe volta a não ter afinidade nenhuma.

---

## US3 — Tratamentos fiéis em qualquer aparelho e no arquivo final (P2)

**Código completo, zero minutos rodado em device** (ver `ESTADO.md` — sessão sem device conectado). `@shopify/react-native-skia` já está no `package.json`; falta o `npm run android` que regera o dev build com o módulo nativo dentro (T033), e só depois disso dá para riscar os itens abaixo.

0. **Antes de mais nada**: `npm run android` (rebuild — sem ele o app continua no render antigo, sem quebrar nada, mas sem testar US3 de verdade).
1. Capturar uma foto e abrir o Modal de Captura: a prévia deve trocar do render antigo para o Skia sem flash perceptível (a troca acontece num `useEffect`, ver `FilteredImage.tsx`).
2. No Android **e** em iOS, os três looks devem ser visivelmente diferentes entre si na prévia — agora por uma matriz de cor no Canvas (`matrizDeCor()` em `looks.ts`), não mais por `style.filter` do RN.
3. Tocar em "Salvar" ou "Postar agora": o arquivo que sai (galeria do sistema, ou o `.png` em `cache/synesthesia-looks/` gerado por `renderLook.ts`) deve ter a resolução da **foto capturada**, não da tela do aparelho — conferir com `adb shell` ou o próprio app de galeria do sistema (Detalhes → resolução).
4. Comparar lado a lado a prévia na tela com o arquivo exportado: as duas devem bater (mesma matriz de cor, mesmo overlay) — é o teste que garante que o `captureRef` (rede de segurança sem Skia) não ficou entalado em algum caminho.

⚠️ **Onde mais provavelmente algo vai estar errado, se estiver**: a matemática de `matrizDeCor()` (ordem de composição saturação→contraste→brilho→sepia, offset do contraste em escala 0–1) e o desenho do overlay em `renderLook.ts` (`Skia.Paint().setAlphaf()`) — nenhum dos dois foi visto renderizado antes desta verificação.

✅ **Aceite** (SC-006, SC-007): arquivo exportado preserva a resolução da foto capturada; três looks distinguíveis em ambos os sistemas. Não marcar como fechado até isto rodar de verdade em device.

---

## US4 — Retomar a decisão pela galeria (P3)

1. Salvar uma mídia com um dos três looks escolhido manualmente.
2. Fechar o app por completo (não só a tela).
3. Reabrir pela galeria a mídia salva.

✅ **Aceite** (FR-022 a FR-025, SC-009):
- As três sugestões da captura original reaparecem, com a escolha marcada — **sem** chamada de rede (conferir no Metro: nenhuma requisição ao abrir).
- Trocar de look ali dentro e sair pelo "Salvar" atualiza o registro — reabrir de novo mostra a nova escolha.
- Reabrir uma foto salva **antes** desta feature (qualquer mídia com `looks: undefined`): abre normal, com o tratamento que já tinha, sem erro, sem sugestão inventada aparecendo como afinidade.

---

## Cadeia de degradação (US1, verificação transversal)

Testar os três cenários — nenhum deles pode travar o "Salvar" nem aparecer como erro de captura:

```bash
# 1. Sem chave: comentar EXPO_PUBLIC_GEMINI_API_KEY no .env, rebuild
# 2. Sem rede: modo avião no aparelho, capturar
# 3. Gemini lento: sem forçar timeout real, conferir que o teto de
#    22s (LIMITE_GEMINI_MS em music.ts) mais o limite de 30s da
#    interface (LIMITE_CURADORIA_MS em CaptureSheet.tsx) não deixam
#    a tela presa em "carregando" indefinidamente.
```

✅ **Aceite** (FR-019, FR-020, SC-004, SC-005): em todos os três cenários, três looks base (derivados da vibe) aparecem mesmo assim, "Salvar" nunca fica desabilitado, e a interface não anuncia a degradação como se a foto tivesse falhado.

---

## Não regressão

```bash
npm run typecheck    # obrigatório antes de commitar
```

- Abrir pelo menos uma mídia salva **antes** desta feature pela galeria: nada quebra, filtro antigo aparece corretamente (FR-023, SC-009).
- Exportar/postar uma mídia com look aplicado: o pacote continua saindo com imagem + trilha + trecho, sem regressão do fluxo herdado da feature 002.

# Estado — 006 Foto compartilhada de fora do app

**Aberta em**: 2026-09-21 · **Base**: `main` no release 1.3.1

## Onde está

**Concluída e validada no device** (Redmi Note 8 Pro, Android 10, 2026-09-21). As cinco user
stories passaram, incluindo o fluxo real pela galeria do MIUI.

## Roteiro de teste no device

Pré-requisitos do [runbook de device](../../docs/runbooks/testar-no-device.md) — **build local,
nunca EAS**. Esta feature mexe em `app.json` e traz um módulo nativo novo, então exige
`npx expo prebuild -p android` + remoção manual do `splashscreen_logo` de `styles.xml`
(armadilha conhecida) antes do `./scripts/dev-android.sh build`.

| # | Passo | Esperado |
|---|---|---|
| 1 | Galeria do sistema → foto → Compartilhar | Synesthesia na lista de destinos (US1) |
| 2 | Escolher Synesthesia com o app **aberto** | app volta na tela de captura com a foto; curadoria roda (US3) |
| 3 | Idem com o app **fechado** | app abre, mostra "ABRINDO A FOTO...", entra na captura (US2) |
| 4 | Usar foto vertical tirada pela câmera nativa | foto em pé na tela **e** no `.mp4` exportado (US4) |
| 5 | Descartar (X) a captura aberta por compartilhamento | cai na câmera do app, não em tela preta (US5) |
| 6 | Salvar a foto recebida | entra na galeria do app como qualquer captura |

Disparo do intent por adb, para não depender da UI da galeria:

```bash
adb -s "$ADB_DEVICE" shell am start -a android.intent.action.SEND -t image/jpeg \
  --eu android.intent.extra.STREAM content://media/external/images/media/<id> \
  -n com.savioomiodev.synesthesia/.MainActivity
```

O `<id>` sai de:

```bash
adb -s "$ADB_DEVICE" shell content query --uri content://media/external/images/media \
  --projection _id:_display_name | tail -5
```

## Armadilha do dev build

No APK debug o `expo-dev-client` intercepta o cold start. O teste foi feito em **APK release
local** (`./gradlew assembleRelease`, chave de `keys/`), que também é a única forma de instalar por
cima do app que já está no aparelho — o debug é rejeitado com `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
porque a assinatura não bate, e desinstalar apagaria a galeria local e o histórico de gosto.

## Resultado — 2026-09-21, Redmi Note 8 Pro

| US | Verificação | Resultado |
|---|---|---|
| US1 | `cmd package query-activities -a SEND -t image/jpeg` e a folha real do MIUI | ✅ o app aparece entre Instagram Stories e Termux |
| US2 | Cold start por `ACTION_SEND` (app morto) | ✅ cai na captura; Gemini leu "Tela de laptop exibindo arte vibrante de um samurai" → vibe **Samurai Digital**, look **Penumbra Digital**, 4 faixas |
| US3 | Novo share com o app já aberto na captura | ✅ troca a foto e reinicia a curadoria |
| US4 | JPEG 4000×3000 marcado `Orientation=6` | ✅ entra 3000×4000; `.mp4` sai 1600×1200 **com matriz de rotação 90°** no `tkhd` → player exibe retrato, igual à tela |
| US5 | X → "Descartar" numa sessão vinda do share | ✅ cai na câmera do app |
| — | Fluxo real: galeria MIUI → Compartilhar → Synesthesia | ✅ foto 3472×3472 da câmera nativa, orientação idêntica à da galeria |
| — | Salvar + Postar a partir de foto recebida | ✅ "Vídeo gerado!", `.mp4` com trilhas `soun`+`vide`, `avc1`+`mp4a`, 30,00s |

### Bug encontrado e corrigido na primeira rodada

`prepararImagem` lançava "Não deu para abrir a imagem compartilhada" **mesmo abrindo o arquivo**:

```kotlin
resolver.openInputStream(origem)?.use { BitmapFactory.decodeStream(it, null, limites) }
  ?: throw ShareIntakeException(...)
```

O elvis se aplica ao resultado do bloco, não ao stream — e com `inJustDecodeBounds = true` o
`decodeStream` devolve `null` **por contrato**. A medição das dimensões agora é feita em duas
linhas, com o `?: throw` no stream. Nenhum typecheck ou build pegaria isso; só o aparelho pegou.

### Observação não relacionada à feature

Nas últimas rodadas o Gemini estourou o `LIMITE_GEMINI_MS` (22s) e o app caiu no piso de
degradação (Deezer por keywords — o funk brasileiro que a feature 005 documenta). **Não é
regressão**: a chave estava presente, a primeira rodada do mesmo APK respondeu em 10,8s, o ping
até o endpoint é de 6ms, e um `curl` direto com um prompt de 6 tokens levou **19,9s para um HTTP
200**. A API estava lenta na janela do teste, e 22s é um limiar apertado para essa condição —
vale considerar se o limite ainda é o número certo.

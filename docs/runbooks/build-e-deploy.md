# Build e deploy

## Regra: EAS é só para o deploy real

**Proibido usar `eas build` para testar, e o processo de release abaixo não usa EAS.** A cota da
conta EAS é limitada; builds de teste e o próprio release são feitos localmente. Mais de 10 builds
já foram gastos em ciclos de tentativa-e-erro em código nativo, porque não havia toolchain local —
cada mudança em Kotlin exigia build na nuvem (~12 min + fila).

Para qualquer teste: build local (`npx expo run:android` ou `scripts/dev-android.sh build`). Se um
build EAS parecer necessário, perguntar antes.

Roteiro completo de conectar, buildar e ler log no device de teste: [testar-no-device.md](./testar-no-device.md).

## Toolchain Android local (sem Android Studio)

Instalado via Homebrew:

- JDK 17 — `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- SDK — `/opt/homebrew/share/android-commandlinetools` (platform android-36, build-tools 36.0.0,
  platform-tools/adb, NDK 27.1.12297006, CMake 3.31.6)
- `JAVA_HOME`/`ANDROID_HOME`/PATH exportados no `~/.zshrc`

Utilitários em [`scripts/dev-android.sh`](../../scripts/dev-android.sh) (`build`, `log`, `shot`,
`video`, `conectar`). Config pessoal (IP do device) em `scripts/dev-android.local.sh`, fora do git
— copie de `scripts/dev-android.local.sh.example` na primeira vez numa máquina nova.
`android/` é gitignored — o prebuild não suja o repo. Build completo: ~4 min a frio.

**`adb logcat` é a única fonte real de erro nativo.** Exceções nativas chegam ao Metro como
`null`, sem mensagem. Emulador não serve para este projeto: câmera falsa e MediaCodec limitado —
sempre testar no device físico.

## Metro não morre com `pkill`

`pkill -f "expo start"` / `pkill -f metro` **não mata** o processo — ele continua escutando na
8081. Matar de verdade:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN -t | xargs kill -9
```

**Por quê**: `@expo/metro-config` memoiza a config do Babel por processo. Um Metro que subiu antes
de `babel.config.js` existir (ou mudar) serve bundles com a config velha para sempre — `--clear`
não resolve, só limpa cache de transformação sem reiniciar o processo. Ao mexer em
`babel.config.js` ou instalar pacote com plugin de Babel, mate pelo PID da porta e confirme que o
PID mudou.

## Processo de release — passo a passo obrigatório

Sempre que for pedido um release, seguir esta sequência inteira, nesta ordem. Nenhum passo é
opcional; nenhum usa EAS.

### 1. Decidir a versão nova

Semver simples: `MAJOR.MINOR.PATCH`. Versão atual em produção: ver
[`docs/ESTADO.md`](../ESTADO.md) ou `app.json` → `expo.version`.

### 2. Atualizar os arquivos de versão

- `app.json` → `expo.version` (ex.: `"1.4.0"`)
- `app.json` → `expo.android.versionCode` (**incrementar em 1**, sempre — é o que o Android usa
  para decidir se uma instalação é "atualização" ou "downgrade recusado")

Não existe terceiro lugar para atualizar — `package.json` não segue a versão do app neste projeto.

### 3. Gerar o APK assinado

```bash
npx expo prebuild --platform android --no-install
python3 scripts/preparar-release.py       # copia a chave de keys/, ajusta gradle, limpa splash
cd android && ./gradlew assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
cd ..
```

APK final: `android/app/build/outputs/apk/release/app-release.apk` (~60MB).

**Se `preparar-release.py` falhar dizendo que a keystore está ausente**: pare. Não existe forma
válida de contornar isso gerando uma chave nova — ver
[chaves-e-segredos.md](../rules/chaves-e-segredos.md). Restaurar `keys/` do backup e só então
continuar.

### 4. Validar no device antes de publicar

Instalar o APK de release gerado no passo 3 (não o debug) no device de teste e confirmar que abre,
captura, salva e compartilha sem erro. Ver [testar-no-device.md](./testar-no-device.md).

### 5. Commit da versão nova

```bash
git add app.json
git commit -m "Preparar o release X.Y.Z"
```

(Padrão do histórico: um commit dedicado, só com o bump de versão — sem misturar com código de
feature.)

### 6. Tag e push

```bash
git tag vX.Y.Z
git push origin main --tags
```

### 7. Publicar o GitHub Release

```bash
gh release create vX.Y.Z android/app/build/outputs/apk/release/app-release.apk \
  --title "Synesthesia X.Y.Z" \
  --notes "..."
```

As notas são em pt-BR, para quem vai instalar — não changelog técnico. Seguir o tom dos releases
anteriores (`gh release view vX.Y.Z-1 --json body`): o que mudou, por que interessa a quem usa, e
qualquer aviso de migração (ex.: troca de chave de assinatura exige desinstalar a versão anterior).

### 8. Atualizar `docs/ESTADO.md`

Versão em produção e, se aplicável, a feature que originou o release.

## Chave de assinatura (keystore)

O keystore de release vive em `keys/` na raiz do projeto — dentro do repositório, mas fora do git
e fora do que o build lê diretamente. `scripts/preparar-release.py` copia de lá para
`android/app/` a cada release; nunca gera uma chave nova sozinho. Detalhe completo, incluindo o
backup externo e por que o cofre fica dentro do repo, em
[chaves-e-segredos.md](../rules/chaves-e-segredos.md).

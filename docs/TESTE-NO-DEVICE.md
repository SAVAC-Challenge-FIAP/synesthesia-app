# Subir e testar no celular

Procedimento validado de ponta a ponta em **2026-08-20**, no Redmi Note 8 Pro (`begonia`) por
Wi-Fi. Substitui e amplia a seção "Como retomar" de `specs/002-qa-lapidacao-v1/tasks.md`, que não
cobria permissões nem os dois erros de leitura de log descritos aqui.

**Nunca use `eas build`.** A cota está reservada para a publicação final. Só build local.

## Fatos do aparelho (medidos, não supostos)

| | |
|---|---|
| Modelo | Redmi Note 8 Pro (`begonia`) |
| **Android** | **10** |
| Endereço adb | `192.168.15.3:5555` (Wi-Fi) |
| Pacote | `com.savioomiodev.synesthesia` |
| IP do Mac | confira sempre — **muda** |

⚠️ **Android 10 muda o que vale de permissão.** `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` e
`READ_MEDIA_AUDIO` só existem a partir do Android 13: neste aparelho o `pm grant` delas falha com
`IllegalArgumentException: Unknown permission`, e isso **não é defeito**. O que vale aqui é o par
legado `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`, junto do
`requestLegacyExternalStorage="true"` que já está no manifesto. As `READ_MEDIA_*` continuam
declaradas no `app.json` porque valem em aparelhos mais novos — só não têm efeito neste.

## 0. PATH — o adb não está no PATH padrão

```bash
export PATH="/opt/homebrew/share/android-commandlinetools/platform-tools:$PATH"
```

Toda sessão de shell precisa disso. Sem ele, `adb: command not found`.

## 1. Conectar

```bash
adb connect 192.168.15.3:5555
adb devices -l
```

Esperado: `192.168.15.3:5555   device   product:begonia`.

O modo Wi-Fi **cai sozinho** e some depois de um reboot do aparelho. Se cair: plugue o cabo e
rode `./scripts/dev-android.sh conectar` (faz `adb tcpip 5555` e reconecta).

## 2. Conferir se o app ainda está instalado

```bash
adb -s 192.168.15.3:5555 shell pm list packages com.savioomiodev.synesthesia
```

**Saída vazia significa desinstalado** — e isso acontece de verdade entre sessões. Foi o que
aconteceu em 2026-08-20: o app tinha sumido do aparelho mesmo com o APK intacto no Mac.
Reinstale sem rebuildar:

```bash
adb -s 192.168.15.3:5555 install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Só rode `./scripts/dev-android.sh build` se houve **mudança nativa** (Kotlin, `styles.xml`,
`app.json`, dependência nativa nova). Mudança só de JS não precisa: o Metro recarrega.

## 3. Conceder as permissões por adb

Instalação nova vem com tudo `granted=false`, e a tela de onboarding do app pede uma a uma. Para
não clicar em nada:

```bash
PKG=com.savioomiodev.synesthesia
for P in CAMERA RECORD_AUDIO READ_EXTERNAL_STORAGE WRITE_EXTERNAL_STORAGE; do
  adb -s 192.168.15.3:5555 shell pm grant "$PKG" "android.permission.$P"
done
```

Conferir:

```bash
adb -s 192.168.15.3:5555 shell dumpsys package com.savioomiodev.synesthesia \
  | grep -E "android\.permission\.(CAMERA|RECORD_AUDIO|READ_EXTERNAL|WRITE_EXTERNAL)[A-Z_]*: granted="
```

As quatro precisam sair `granted=true`. **Force-stop depois de conceder** — o app já rodando não
reavalia sozinho:

```bash
adb -s 192.168.15.3:5555 shell am force-stop com.savioomiodev.synesthesia
```

## 4. Metro de pé

Sem ele o app roda o último bundle em memória e **suas mudanças de JS não aparecem** — isso já
enganou uma rodada inteira.

```bash
nohup npx expo start --dev-client --host lan > /tmp/metro.log 2>&1 &
until curl -s -m 2 http://localhost:8081/status | grep -q packager-status; do sleep 2; done
```

Esperado: `packager-status:running`.

## 5. Abrir o app apontando para o Metro

```bash
ipconfig getifaddr en0     # CONFIRA — o IP do Mac muda
adb -s 192.168.15.3:5555 shell am start -a android.intent.action.VIEW \
  -d "synesthesia://expo-development-client/?url=http%3A%2F%2F<IP>%3A8081"
```

Confirmar que subiu:

```bash
adb -s 192.168.15.3:5555 shell dumpsys activity activities | grep -m1 "ResumedActivity:"
```

## 6. Ver a tela

```bash
./scripts/dev-android.sh shot            # -> /tmp/synesthesia-tela.png
# ou direto:
adb -s 192.168.15.3:5555 exec-out screencap -p > /tmp/tela.png
```

Tocar em coordenadas: as screenshots saem em **1080×2340**. Se você estiver lendo a imagem
redimensionada, multiplique as coordenadas pelo fator antes de mandar o `input tap`.

```bash
adb -s 192.168.15.3:5555 shell input tap <x> <y>
```

## 7. Ler os logs do JS — duas armadilhas reais

```bash
adb -s 192.168.15.3:5555 logcat -c
nohup adb -s 192.168.15.3:5555 logcat ReactNativeJS:V '*:S' > /tmp/js.log 2>&1 &
# ... reproduza o fluxo no app ...
grep "music" /tmp/js.log
pkill -f "logcat ReactNativeJS"
```

⚠️ **Armadilha 1 — não canalize o logcat para `head`/`grep` direto.** `adb logcat ... | head -5`
volta **vazio** neste aparelho: fechar o pipe mata o stream antes de ele entregar qualquer linha.
Foi reproduzido em 2026-08-20. O que funciona é redirecionar para arquivo com `&` e ler o arquivo.

⚠️ **Armadilha 2 — `/tmp/metro.log` engana.** Ele só tem conteúdo se **esta** sessão tiver subido
o Metro redirecionando para lá. Se o Metro já estava de pé de outra sessão, o arquivo fica vazio e
parece que nada aconteceu. Os `console.log` do JS aparecem **sim** no logcat, sob a tag
`ReactNativeJS` — é assim que se lê.

Log do módulo nativo de vídeo:

```bash
./scripts/dev-android.sh log     # VideoMuxer + AndroidRuntime + MediaCodec
```

## 8. Medir desempenho

```bash
PKG=com.savioomiodev.synesthesia
adb -s 192.168.15.3:5555 shell dumpsys gfxinfo $PKG reset
# ... exercite a tela ...
adb -s 192.168.15.3:5555 shell dumpsys gfxinfo $PKG \
  | grep -E "Total frames rendered|Janky frames|percentile"
adb -s 192.168.15.3:5555 shell dumpsys meminfo $PKG
```

**Um punhado de frames não é medição.** Um roteiro de 12 toques rende ~12 frames, e aí "100% de
frames janky" não quer dizer nada. Para comparar A/B use um roteiro que gere **centenas** de
frames (ex.: 16 varreduras de um carrossel → ~700 frames).

## 9. Conferir o pacote exportado (não regressão obrigatória)

```bash
./scripts/dev-android.sh video          # puxa o último .mp4
python3 -c "
import re,struct
d=open('/tmp/ARQUIVO.mp4','rb').read()
print('trilhas:', [d[m.start()+12:m.start()+16].decode('latin1') for m in re.finditer(b'hdlr',d)])
for f in [b'avc1',b'mp4a']: print(f.decode(), 'presente' if d.count(f) else 'AUSENTE')
i=d.find(b'mvhd'); ts,dur=struct.unpack('>II', d[i+16:i+24]); print(f'duracao: {dur/ts:.2f}s')
"
```

Esperado: `trilhas: ['soun', 'vide']`, `avc1` e `mp4a` presentes, duração igual ao trecho aprovado
na tela. Não há `ffprobe` neste Mac — é por isso que a verificação é esse Python.

## 10. Testar com fonte do sistema ampliada (acessibilidade)

```bash
adb -s 192.168.15.3:5555 shell settings put system font_scale 1.45
# ... testar ...
adb -s 192.168.15.3:5555 shell settings put system font_scale 1.0    # SEMPRE restaurar
```

Trocar o `font_scale` **reinicia a activity** e pode abrir um LogBox de aviso preexistente —
dispense e siga.

## Cuidado com dado pessoal nas evidências

Screenshots do fluxo de compartilhamento podem cair em telas com **contatos reais** (o seletor de
destinatários do Mensagens, por exemplo). Essas imagens **não vão** para `docs/preview/` nem para
commit. Escolha um destino que mostre o resultado sem expor terceiros — o Gmail, por exemplo,
mostra o anexo com nome e tamanho sem tocar em contato nenhum.

## 11. Armadilha 3 — `pkill -f "expo start"` NÃO mata o Metro

Descoberto em 2026-08-21, depois de ~1h perdida perseguindo um bug fantasma.

O processo do Metro sobrevive a `pkill -f "expo start"`, a `pkill -f metro` e a
`expo start --clear`. Ele fica escutando a 8081 com o **mesmo PID** de antes, e
`--clear` limpa o cache de transformação **sem** reiniciar o processo.

Isso importa porque `@expo/metro-config` **memoiza a config do Babel por
processo** (`loadBabelConfig`, em `build/loadBabelConfig.js`: `if (babelRC !==
null) return babelRC;`). Se o Metro subiu antes de o `babel.config.js` existir —
ou antes de você editá-lo — ele serve bundles com a config **velha** para
sempre, e nenhum `--clear` conserta.

Sintoma: você edita `babel.config.js`, reinicia "o Metro", e o bundle continua
sem o plugin. Um `babel.config.js` que **lança um erro** ainda produz bundle com
sucesso — essa é a prova de que o arquivo não está sendo lido.

Como matar de verdade:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN -t | xargs kill -9
lsof -nP -iTCP:8081 -sTCP:LISTEN -t || echo "porta livre"
```

Só depois disso suba o Metro de novo. Confira que o PID mudou.

Para verificar se o plugin de worklets está mesmo sendo aplicado, sem depender
de rodar o app:

```bash
curl -s "http://localhost:8081/src/services/renderLook.bundle?platform=android&dev=true&modulesOnly=true&runModule=false" -o /tmp/x.js
grep -c "__workletHash" /tmp/x.js     # 0 = plugin NÃO aplicado
```

#!/bin/bash
# Ciclo de teste local no device (sem EAS).
#
#   ./scripts/dev-android.sh build    compila e instala o APK debug
#   ./scripts/dev-android.sh log      logcat só do VideoMuxer (stacktrace nativa)
#   ./scripts/dev-android.sh shot     screenshot da tela atual -> /tmp/synesthesia-tela.png
#   ./scripts/dev-android.sh video    puxa o último .mp4 gerado pelo app
#   ./scripts/dev-android.sh conectar reconecta por Wi-Fi (após reboot, precisa do cabo)
#
# O device fica em ADB_DEVICE (Wi-Fi). Depois de um reboot do aparelho o modo
# tcpip cai: plugue o cabo e rode `conectar` de novo.

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

ADB_DEVICE="${ADB_DEVICE:-192.168.15.3:5555}"
PKG="com.savioomiodev.synesthesia"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
APK="$RAIZ/android/app/build/outputs/apk/debug/app-debug.apk"

adbd() { adb -s "$ADB_DEVICE" "$@"; }

case "$1" in
  build)
    cd "$RAIZ/android" || exit 1
    ./gradlew assembleDebug --console=plain || exit 1
    # MIUI bloqueia install via adb até ligar "Depuração USB (Configurações de
    # segurança)" nas Opções do desenvolvedor — sem isso dá USER_RESTRICTED.
    adbd install -r "$APK"
    ;;
  log)
    # A exceção nativa chega no Metro sem mensagem ("null"); a causa real só
    # aparece aqui, no log do próprio Android.
    adbd logcat -c
    echo "logcat limpo — reproduza a captura no app. Ctrl+C para sair."
    adbd logcat VideoMuxer:V AndroidRuntime:E MediaCodec:W ExoPlayer:W '*:S'
    ;;
  shot)
    adbd exec-out screencap -p > /tmp/synesthesia-tela.png && \
      echo "salvo em /tmp/synesthesia-tela.png"
    ;;
  video)
    # O muxer escreve em cache/synesthesia-video/ (ver src/services/videoMuxer.ts)
    ULTIMO=$(adbd shell run-as "$PKG" ls -t cache/synesthesia-video/ 2>/dev/null | head -1)
    if [ -z "$ULTIMO" ]; then echo "nenhum .mp4 gerado ainda"; exit 1; fi
    adbd shell run-as "$PKG" cat "cache/synesthesia-video/$ULTIMO" > "/tmp/$ULTIMO"
    echo "puxado: /tmp/$ULTIMO"
    ;;
  conectar)
    adb tcpip 5555 && sleep 3 && adb connect "$ADB_DEVICE"
    ;;
  *)
    grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -14
    ;;
esac

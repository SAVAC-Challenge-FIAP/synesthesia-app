#!/usr/bin/env python3
"""
Prepara o `android/` gerado para virar um APK de release (T098).

Por que existe: `android/` é saída de prebuild e **não** é versionado, então
qualquer ajuste feito à mão no `build.gradle` some no próximo `expo prebuild`.
Este script reaplica o ajuste em segundos, e é ele — não a pasta gerada — que
vai para o git.

O que faz:
  1. gera `android/app/synesthesia-release.keystore` na primeira vez, com uma
     senha aleatória guardada em `android/keystore.properties`;
  2. ensina o `android/app/build.gradle` a ler esse arquivo e assinar o release
     com ele;
  3. tira do tema do splash a referência ao `splashscreen_logo`. O
     `expo-splash-screen` escreve essa linha mesmo quando o `app.json` não
     declara imagem nenhuma — e aí o tema aponta para um drawable que não
     existe. Sem imagem é o que queremos (a marca aparece uma vez só, animada,
     no `AberturaMarca`), então a linha sai.

Os dois arquivos ficam **fora do git** de propósito (ver `.gitignore`). Guarde
uma cópia da chave num lugar seguro: perdê-la impede atualizar um app já
publicado sob a mesma identidade.

Depois dele, o APK sai com:

    cd android && ./gradlew assembleRelease \
        -PreactNativeArchitectures=armeabi-v7a,arm64-v8a

As duas ABIs cobrem todo celular Android real; incluir `x86`/`x86_64`, que só
servem a emuladores, levava o APK de 59 MB para 100 MB.

**A ordem importa**: rode este script *depois* do `expo prebuild`, nunca antes.
O prebuild reescreve `styles.xml` do zero e devolve a linha do
`splashscreen_logo`, então rodar na ordem inversa faz o build de release falhar
com "resource drawable/splashscreen_logo not found" — o script chega a dizer
"splash já estava sem logo", mas o prebuild seguinte desfaz o trabalho.

Sequência completa do release:

    # 1. versão nova no app.json (version + android.versionCode)
    npx expo prebuild --platform android --no-install
    python3 scripts/preparar-release.py
    cd android && ./gradlew assembleRelease \
        -PreactNativeArchitectures=armeabi-v7a,arm64-v8a

Uso:  python3 scripts/preparar-release.py
"""

import base64
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ANDROID = RAIZ / 'android'
KEYSTORE = ANDROID / 'app' / 'synesthesia-release.keystore'
CREDENCIAIS = ANDROID / 'keystore.properties'
BUILD_GRADLE = ANDROID / 'app' / 'build.gradle'
STYLES = ANDROID / 'app' / 'src' / 'main' / 'res' / 'values' / 'styles.xml'

DNAME = 'CN=Synesthesia, OU=SAVAC, O=FIAP JOVI Challenge, L=Sao Paulo, S=SP, C=BR'

BLOCO_CREDENCIAIS = """/**
 * Credenciais de assinatura do release (T098), aplicadas por
 * `scripts/configurar-assinatura.py`.
 *
 * Ficam em `android/keystore.properties`, fora do git — junto com o `.keystore`
 * em si. Sem o arquivo, o release cai na chave de debug e o build continua
 * funcionando, que é o que mantém um `assembleRelease` possível em qualquer
 * clone do repositório.
 */
def credenciais = new Properties()
def arquivoCredenciais = rootProject.file('keystore.properties')
if (arquivoCredenciais.exists()) {
    credenciais.load(new FileInputStream(arquivoCredenciais))
}

android {"""

BLOCO_SIGNING = """    signingConfigs {
        release {
            if (credenciais.getProperty('storeFile')) {
                storeFile file(credenciais.getProperty('storeFile'))
                storePassword credenciais.getProperty('storePassword')
                keyAlias credenciais.getProperty('keyAlias')
                keyPassword credenciais.getProperty('keyPassword')
            }
        }
        debug {"""


def senha_nova() -> str:
    return base64.b64encode(os.urandom(24)).decode().replace('/', '').replace('+', '')[:24]


def garantir_keystore() -> None:
    if KEYSTORE.exists() and CREDENCIAIS.exists():
        print(f'keystore já existe: {KEYSTORE.relative_to(RAIZ)}')
        return
    senha = senha_nova()
    java_home = os.environ.get(
        'JAVA_HOME', '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'
    )
    keytool = Path(java_home) / 'bin' / 'keytool'
    KEYSTORE.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            str(keytool), '-genkeypair', '-keystore', str(KEYSTORE),
            '-alias', 'synesthesia', '-keyalg', 'RSA', '-keysize', '2048',
            '-validity', '10950', '-storepass', senha, '-keypass', senha,
            '-dname', DNAME,
        ],
        check=True,
        capture_output=True,
    )
    CREDENCIAIS.write_text(
        '# Assinatura do APK de release (T098). Gerado por '
        'scripts/configurar-assinatura.py.\n'
        '# NAO versionado: perder esta chave impede atualizar um app ja '
        'publicado sob a mesma identidade.\n'
        'storeFile=synesthesia-release.keystore\n'
        f'storePassword={senha}\n'
        'keyAlias=synesthesia\n'
        f'keyPassword={senha}\n'
    )
    print(f'keystore criada: {KEYSTORE.relative_to(RAIZ)}')


def ajustar_gradle() -> None:
    if not BUILD_GRADLE.exists():
        sys.exit('android/ não existe — rode `npx expo prebuild --platform android` antes.')
    texto = BUILD_GRADLE.read_text()
    if 'keystore.properties' in texto:
        print('build.gradle já está configurado')
        return
    texto = texto.replace('android {', BLOCO_CREDENCIAIS, 1)
    texto = texto.replace('    signingConfigs {\n        debug {', BLOCO_SIGNING, 1)
    texto = texto.replace(
        """        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug""",
        """        release {
            signingConfig credenciais.getProperty('storeFile') ? signingConfigs.release : signingConfigs.debug""",
        1,
    )
    BUILD_GRADLE.write_text(texto)
    print('build.gradle configurado para assinar o release')


def limpar_splash() -> None:
    if not STYLES.exists():
        return
    texto = STYLES.read_text()
    original = texto
    for linha in (
        '    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>\n',
        '    <item name="android:windowSplashScreenBehavior">icon_preferred</item>\n',
    ):
        texto = texto.replace(linha, '')
    if texto != original:
        STYLES.write_text(texto)
        print('splash sem logo: o tema ficou só com a cor de fundo')
    else:
        print('splash já estava sem logo')


if __name__ == '__main__':
    garantir_keystore()
    ajustar_gradle()
    limpar_splash()

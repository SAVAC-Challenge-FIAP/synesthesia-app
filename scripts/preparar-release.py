#!/usr/bin/env python3
"""
Prepara o `android/` gerado para virar um APK de release.

Ver docs/runbooks/build-e-deploy.md para o processo completo e
docs/rules/chaves-e-segredos.md para onde a chave vive.

Uso:  python3 scripts/preparar-release.py
"""

import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ANDROID = RAIZ / 'android'
KEYS = RAIZ / 'keys'
KEYSTORE_COFRE = KEYS / 'synesthesia-release.keystore'
CREDENCIAIS_COFRE = KEYS / 'keystore.properties'
KEYSTORE = ANDROID / 'app' / 'synesthesia-release.keystore'
CREDENCIAIS = ANDROID / 'keystore.properties'
BUILD_GRADLE = ANDROID / 'app' / 'build.gradle'
STYLES = ANDROID / 'app' / 'src' / 'main' / 'res' / 'values' / 'styles.xml'

BLOCO_CREDENCIAIS = """/**
 * Credenciais de assinatura do release, aplicadas por scripts/preparar-release.py.
 * Ver docs/rules/chaves-e-segredos.md.
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


def garantir_keystore() -> None:
    if not KEYSTORE_COFRE.exists() or not CREDENCIAIS_COFRE.exists():
        sys.exit(
            f'keystore ausente em {KEYS.relative_to(RAIZ)}/ — este projeto já tem releases '
            'publicados (ver GitHub Releases). Gerar uma chave nova aqui tornaria impossível '
            'atualizar o app publicado sob a mesma identidade. Restaure keys/ a partir do backup '
            'antes de continuar; NUNCA rode `keytool -genkeypair` para "resolver" isto. '
            'Ver docs/rules/chaves-e-segredos.md.'
        )
    ANDROID.mkdir(parents=True, exist_ok=True)
    (ANDROID / 'app').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(KEYSTORE_COFRE, KEYSTORE)
    shutil.copyfile(CREDENCIAIS_COFRE, CREDENCIAIS)
    print(f'keystore copiada de {KEYS.relative_to(RAIZ)}/ para {KEYSTORE.relative_to(RAIZ)}')


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

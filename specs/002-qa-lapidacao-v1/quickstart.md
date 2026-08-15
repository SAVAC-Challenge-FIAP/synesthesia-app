# Quickstart — Validação no dispositivo

**Feature**: `002-qa-lapidacao-v1` | **Date**: 2026-08-15

Como provar que cada correção funciona. **Toda validação é em dispositivo real** — não existe suíte automatizada de UI neste projeto, então a evidência visual é o critério de aceite.

> ⚠️ **EAS Build é proibido nesta rodada.** A cota está reservada para a publicação final. Use apenas o build local.

---

## Pré-requisitos

Ambiente já montado (JDK 17 + Android SDK, sem Android Studio). Dispositivo conectado por adb Wi-Fi.

```bash
# Confirmar que o device responde
adb devices                      # deve listar 192.168.15.3:5555

# Se caiu (o modo Wi-Fi não sobrevive a reboot do aparelho):
# conecte o cabo USB e rode:
./scripts/dev-android.sh conectar
```

## Ciclo de trabalho

```bash
./scripts/dev-android.sh build   # compila + instala (~1 min incremental)
./scripts/dev-android.sh log     # logcat nativo do VideoMuxer
./scripts/dev-android.sh shot    # screenshot -> /tmp/synesthesia-tela.png
./scripts/dev-android.sh video   # puxa o último .mp4 (só em build debug)

npm run typecheck                # obrigatório antes de commitar
```

Metro para o build de desenvolvimento:

```bash
npx expo start --dev-client --host lan
```

Abrir o app apontando para o Metro:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "synesthesia://expo-development-client/?url=http%3A%2F%2F192.168.15.4%3A8081"
```

---

## US1 — Alcance de toque

**Linha de base medida**: toque em `y=2213` não aciona; `y=2180` aciona.

```bash
# Abrir o modal de captura, então tocar na BORDA INFERIOR do botão primário.
# Antes da correção: nada acontece. Depois: a ação dispara.
adb shell input tap 790 2213
adb exec-out screencap -p > depois.png
```

✅ **Aceite**: todo toque dentro da área visível do botão aciona a ação. Repetir com navegação por gestos **e** por botões (Configurações → Tela inteira), porque a área reservada muda entre os dois.

---

## US2 — Nunca perder a trilha em silêncio

```bash
# 1. Capturar
adb shell input tap 539 2063
# 2. IMEDIATAMENTE tentar postar, com a trilha ainda carregando
adb shell input tap 790 2180
adb exec-out screencap -p > estado.png
```

✅ **Aceite**:
- Durante a curadoria, a ação de postar está visivelmente indisponível **com motivo legível**.
- "Salvar" continua funcionando em qualquer estado.
- Sem trilha disponível, postar exige confirmação explícita antes de prosseguir.
- Nenhuma tela anuncia "pronto" sem dizer o que o pacote contém.

---

## US3 — Latência da curadoria

**Meça antes de mexer.** A linha de base é 30–45s.

```bash
# Os tempos de cada etapa aparecem no Metro; capture 5 execuções antes e 5 depois
npx expo start --dev-client --host lan
```

✅ **Aceite**: redução ≥40% na mediana de 5 capturas (SC-Q03), **com os números registrados**. Durante a espera, a interface comunica progresso real em vez de texto estático.

> Lembrete do research: `resolveWithDeezer` **já é paralelo**. Não "otimize" ali — meça as três etapas e ataque a dominante.

---

## US4 — Descoberta dos filtros

✅ **Aceite**: em repouso, a tela indica que há mais filtros além dos visíveis, e nenhum item fica cortado de forma ambígua. Teste de mesa: mostre a captura de tela a alguém que nunca viu o app e pergunte quantos filtros existem (SC-Q05).

---

## US5 — Identidade dos ícones

✅ **Aceite**: ícones de controle idênticos entre fabricantes, tingidos com a paleta oficial. Emojis de **filtros e vibes preservados** — ali o emoji é linguagem do produto.

---

## US6 — Progresso da exportação

```bash
./scripts/dev-android.sh log     # acompanhe o progresso emitido pelo módulo
```

✅ **Aceite**: a barra avança proporcionalmente ao trabalho, chega a 100 antes de concluir, nunca retrocede, e a interface permanece responsiva durante os 40–70s.

---

## Não regressão (obrigatório antes de fechar a rodada)

O pacote exportado precisa continuar **idêntico** ao validado no v1 (FR-Q16, SC-Q07):

```bash
./scripts/dev-android.sh video   # em build debug

python3 -c "
import re,struct
d=open('ARQUIVO.mp4','rb').read()
print('trilhas:', [d[m.start()+12:m.start()+16].decode('latin1') for m in re.finditer(b'hdlr',d)])
for f in [b'avc1',b'mp4a']:
    print(f.decode(), 'presente' if d.count(f) else 'AUSENTE')
i=d.find(b'mvhd'); ts,dur=struct.unpack('>II', d[i+16:i+24]); print(f'duracao: {dur/ts:.2f}s')
"
```

✅ **Esperado**: `trilhas: ['soun', 'vide']`, `avc1 presente`, `mp4a presente`, duração igual ao trecho aprovado.

### Em APK release, o caminho é outro

Duas armadilhas descobertas testando o v1:

```bash
# run-as NÃO funciona (pacote não-debuggable) e find NÃO enxerga (scoped storage).
# O MediaStore é a fonte da verdade:
adb shell content query --uri content://media/external/video/media \
  --projection _display_name:_size:_data
```

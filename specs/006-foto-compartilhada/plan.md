# Plano técnico — 006 Foto compartilhada de fora do app

**Spec**: [spec.md](./spec.md) · **ADR**: [0014](../../docs/adr/0014-entrada-por-compartilhamento.md)

## Estratégia

A foto recebida **não ganha tela nem fluxo próprio**. Ela vira uma
`CaptureSession` idêntica à de um disparo (`mediaId: null`, `filtroAuto: true`)
e entra na rota `/capture` que já existe. Todo o resto — curadoria do Gemini,
três looks, memória de gosto, salvar, pré-render, postar — roda sem saber de
onde a foto veio.

O trabalho novo se concentra em duas bordas:

1. **Borda do Android** — declarar o app como destino de `ACTION_SEND` e ler o
   intent, que o `Linking` do RN não enxerga (ver ADR 0014).
2. **Borda do router** — decidir *quando* navegar, já que a foto pode chegar
   antes de o `<Stack>` existir.

## Peças

| Peça | Arquivo | Papel |
|---|---|---|
| Intent filter | `app.json` → `android.intentFilters` | põe o app no "Compartilhar" do sistema (`SEND` + `image/*`) |
| Módulo nativo | `modules/share-intake/` | lê o `EXTRA_STREAM`, copia para o cache, aplica EXIF, limita a 24 MP |
| Ponte JS | `src/services/compartilhamentoRecebido.ts` | import dinâmico + degradação para `null` |
| Recepção | `src/components/RecepcaoCompartilhamento.tsx` | três gatilhos, overlay de preparo, cria a sessão e navega |
| Montagem | `app/_layout.tsx` | monta a recepção fora do `<Stack>` |
| Saída | `app/capture.tsx` | sem histórico para voltar, cai em `/camera` |

## Riscos e como foram tratados

| Risco | Tratamento |
|---|---|
| Foto deitada no `.mp4` e em pé na tela | rotação do EXIF aplicada aos pixels na entrada (nativo) |
| `SecurityException` ao reler o `content://` depois | cópia para o cache do app na entrada |
| Foto de 48 MP derrubando o processo | `inSampleSize` até caber em 24 MP, o mesmo teto da captura |
| Mesma foto reaberta em remontagem | `uriPendente()` apaga o `EXTRA_STREAM` ao ler |
| `push` antes de o router montar (foto some) | gatilho inicial espera `useRootNavigationState()?.key` |
| Tela preta ao descartar quem entrou pelo share | `capture.tsx` cai em `/camera` quando não há histórico |

## Verificação

Build local (`./scripts/dev-android.sh build`) — **nunca EAS** — e roteiro de
device em [ESTADO.md](./ESTADO.md). `expo prebuild` é obrigatório nesta feature
(intent filter novo), com a remoção manual do `splashscreen_logo` descrita em
[armadilhas-conhecidas.md](../../docs/runbooks/armadilhas-conhecidas.md).

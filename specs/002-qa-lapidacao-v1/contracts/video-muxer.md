# Contrato — Módulo nativo `video-muxer`

**Feature**: `002-qa-lapidacao-v1` | **Date**: 2026-08-15

Contrato entre o JavaScript e o Expo Module nativo `modules/video-muxer`. Esta feature **adiciona** notificação de progresso; a função existente permanece compatível.

---

## Estado atual (v1) — não pode regredir

```ts
muxImageAndAudio(
  imagePath: string,
  audioPath: string,
  outputPath: string,
  durationSeconds: number
): Promise<string>   // resolve com a URI file:// do .mp4
```

Garantias já validadas em dispositivo que **devem permanecer**:

- Saída `.mp4` com duas trilhas (`vide` + `soun`), codecs `avc1` (H.264) + `mp4a` (AAC).
- Duração igual ao trecho aprovado pelo usuário (validado: 30,00s).
- Qualquer falha rejeita a Promise com mensagem legível — e o chamador degrada o pacote em vez de bloquear a postagem.

---

## Adição desta feature — progresso

### Evento

| Nome | Payload | Quando |
|---|---|---|
| `onProgress` | `{ progresso: number, estado: string }` | Periodicamente durante a exportação |

- `progresso`: 0–100, **proporcional ao trabalho concluído** (nunca estimado por tempo decorrido — ver RV-05).
- `estado`: `"iniciando" | "exportando" | "concluido" | "falhou"`.

### Regras

- **C-01**: O evento é **informativo**. Um consumidor que o ignore continua funcionando exatamente como no v1 — a Promise segue sendo a fonte da verdade para sucesso/falha.
- **C-02**: A emissão do progresso não pode bloquear nem atrasar a exportação.
- **C-03**: O progresso é monotônico (nunca retrocede) e a última emissão antes de `concluido` chega a 100.
- **C-04**: Se a origem do progresso não estiver disponível no dispositivo, o módulo **omite** o evento em vez de inventar valores — a interface cai para o indicador indefinido atual.

### Observação de implementação

O Media3 Transformer expõe progresso por consulta (`getProgress` com um `ProgressHolder`), não por callback. O módulo precisa consultar periodicamente na thread apropriada e traduzir para o evento acima. O intervalo de consulta deve ser suficiente para uma barra fluida sem gerar tráfego desnecessário para o JS.

---

## Fora de escopo

- Cancelar uma exportação em andamento.
- Exportar em outros formatos ou resoluções.
- Alterar codecs — H.264 + AAC são fixados de propósito, para garantir upload nas redes de destino.

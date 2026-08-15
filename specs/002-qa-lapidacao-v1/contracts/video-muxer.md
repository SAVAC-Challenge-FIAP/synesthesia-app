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

O Media3 Transformer expõe progresso por consulta (`getProgress` com um `ProgressHolder`), não por callback. O módulo precisa consultar periodicamente na thread apropriada e traduzir para o evento acima. O intervalo de consulta deve ser suficiente para uma barra fluida sem gerar tráfego desnecessário para o JS. Implementado com polling de 250ms na main thread.

### ⚠️ Medido em 2026-08-15: o `getProgress` **não é fiel** para esta composição

No Redmi Note 8 Pro, `getProgress` devolve `PROGRESS_STATE_AVAILABLE` e **100% aos 280ms** de uma exportação que leva ~10s:

```
progresso=0   estado=iniciando   t=0ms
progresso=100 estado=exportando  t=280ms     ← já no talo
mp4 pronto (14,7 MB)                          ← 9516ms depois
```

A causa é a forma da nossa composição: o Transformer reporta o avanço da **sequência de entrada**, e a nossa entrada de vídeo é uma **imagem parada** — um único frame, consumido de imediato. O tempo real está no *encoding* dos 30s de saída, que esse número não enxerga.

Uma barra cravada em 100% por 9,5s **mente mais que um indicador indefinido**, e o FR-Q09 pede progresso proporcional ao trabalho real. Por isso o módulo **qualifica a fonte antes de confiar nela** (C-04):

- **C-05**: Durante o primeiro segundo o módulo **observa sem emitir**. Se ao fim dessa janela o progresso já estiver ≥95%, a fonte é considerada degenerada: nenhum valor é emitido, e o consumidor permanece no indicador indefinido. Um device onde o progresso seja fiel passa na qualificação e ganha a barra determinada — a regra é genérica, sem hard-code de aparelho.

**Consequência prática**: neste device a barra determinada **não** aparece; a interface usa o indicador indefinido com o motivo à vista. A infraestrutura de progresso está pronta e ligada — se uma versão futura do Media3 (ou outra forma de compor a entrada) devolver progresso fiel, a barra passa a funcionar sem nenhuma mudança de código.

---

## Fora de escopo

- Cancelar uma exportação em andamento.
- Exportar em outros formatos ou resoluções.
- Alterar codecs — H.264 + AAC são fixados de propósito, para garantir upload nas redes de destino.

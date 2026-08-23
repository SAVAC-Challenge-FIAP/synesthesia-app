# Documentação de `sharePackage.ts`

Exportação do pacote sensorial (T-01 / FR-013, RN-001).

Decisão registrada em specs/001-synesthesia-mvp/plan.md (T-01a): no Expo Go
não existe muxer nativo (FFmpeg), então o `.mp4` único imagem+áudio é
impossível ali — é por isso que `videoUri` some no Expo Go e só aparece em
development build, onde `modules/video-muxer` (T-07, MediaMuxer/MediaCodec)
consegue gerá-lo. Sem ele (Expo Go, ou qualquer falha de encoding), o
pacote compartilhável mais fiel ao Princípio I é composto: imagem
renderizada + arquivo de áudio da prévia (30s, Deezer) + legenda com a
trilha e o trecho aprovados.

/** `.mp4` imagem+áudio — só existirá no development build (T-07/FFmpeg) */

/** Imagem com o filtro aplicado (ou a foto pura, sem filtro) */

/** Arquivo local .mp3 da prévia de 30s — null se sem música ou download falhou */

/** Legenda pronta com trilha + trecho, para acompanhar a postagem */

/** Legenda que carrega a metade sonora do pacote na postagem. */

Baixa a prévia de 30s da faixa para o cache e devolve a URI local,
pronta para o share intent. Best-effort: qualquer falha devolve null
(o pacote degrada para imagem + legenda — nunca bloqueia a postagem).

/** Monta o pacote compartilhável a partir da sessão aprovada. */

/** Progresso real da geração do .mp4, 0–100 (FR-Q09). Opcional. */


# Documentação de `VideoMuxerModule.ts`

Codifica `imagePath` como frame de vídeo único (repetido por `durationSeconds`)
e remuxa `audioPath` como trilha AAC, escrevendo um .mp4 em `outputPath`.
Resolve com a URI `file://` do vídeo gerado.

Durante a execução emite `onProgress` (ver `VideoMuxer.types.ts`). Escutar
o evento é opcional — a Promise segue sendo a fonte da verdade (C-01).


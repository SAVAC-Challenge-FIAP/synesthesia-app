# Documentação de `videoMuxer.ts`

Geração do .mp4 real (imagem + trilha) via módulo nativo local (T-07).

`modules/video-muxer` (Android: MediaMuxer/MediaCodec) só carrega em
development build — no Expo Go o `require` do módulo nativo lança na
primeira chamada. Por isso tudo aqui é best-effort: qualquer falha (Expo
Go, plataforma não suportada, erro de encoding) devolve `null` e
`sharePackage.ts` mantém o pacote composto atual (RN "nunca perder a
foto" — o vídeo é um extra, não um requisito para salvar/postar).

Recebe o progresso da exportação, de 0 a 100. Só é chamado quando o device
sabe informar de fato — se nunca for chamado, o indicador deve permanecer
indefinido em vez de fingir avanço (contrato C-04).

Apaga os .mp4 de exportações anteriores (T040).

Medido no device: cada pacote pesa ~15 MB e **nada nunca apagava** —
`cache/synesthesia-video` estava com **834 MB** depois de um dia de uso, de
um cache total de 1,27 GB. O usuário não tem como saber disso nem como
limpar sem ir nas configurações do Android.

Roda **antes** de gerar o novo arquivo, e não depois de compartilhar: assim
o vídeo que o usuário ainda pode estar vendo ou baixando na tela de
postagem nunca é o que se apaga. Best-effort — falhar aqui não pode
atrapalhar a exportação, que é o que o usuário pediu.


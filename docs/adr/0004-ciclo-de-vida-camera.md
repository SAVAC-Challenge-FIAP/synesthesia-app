# ADR-0004 — Ciclo de Vida da Câmera

**Status**: Aceita · **Data**: 2026-08-22

Registro das decisões sobre montagem e enquadramento da CameraView do Expo.

## Desmontagem por Foco

O `CaptureSheet` (modal de captura) e a aba de `/settings` agora são rotas completas do `expo-router`. No Android, quando empilhamos rotas, o cliente de câmera (`CameraView`) da tela anterior continuava produzindo frames ociosamente em background, pois o `expo-router` mantém a tela de baixo montada.
Como a propriedade `active` não funciona no Android, a câmera só existe (é renderizada) enquanto a tela `/camera` está em foco.

## Montagem Atrasada (runAfterInteractions)

Voltar dos Ajustes para o visor deixava a prévia esticada porque a câmera remontava no meio da transição, assumindo proporções provisórias. Para consertar, a câmera só é montada **após** a navegação assentar usando `runAfterInteractions`.

## Resolução Nativa e Recorte
A resolução escolhida (`pictureSize`) já nasce no enquadramento correto, evitando recorte via software na etapa de disparo. Uma resolução menor gera disparos muito mais rápidos e alivia a memória. O giro da imagem, no entanto, é sempre feito, pois o sensor sempre a envia em modo paisagem. O teto absoluto foi fixado em 24 MP, pois sensores maiores (200 MP) gerariam bitmaps de ~800 MB na RAM, derrubando o app no disparo.

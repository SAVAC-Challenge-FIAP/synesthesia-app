# Documentação de `capture.tsx`

Tela de captura (T063) — o pacote sensorial em edição.

Era um `<Modal>` desenhado por cima do visor, e o visor continuava lá,
renderizando frames que ninguém via. O T062 mediu: com o modal aberto, o
cliente de câmera segue ativo.

⚠️ Virar rota **não** basta para desligar a câmera — o mesmo T062 mediu que
`/settings`, que já é rota, também deixa o cliente ativo, porque o
`expo-router` mantém a tela de baixo montada. Quem desliga de fato é o
`camera.tsx`, que deixa de renderizar a `<CameraView>` quando perde o foco.
Esta tela e aquela desmontagem são as duas metades da mesma correção.


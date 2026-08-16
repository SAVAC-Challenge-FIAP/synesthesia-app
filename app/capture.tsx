import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { CaptureSheet } from '@/components/CaptureSheet';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { colors } from '@/theme/tokens';

/**
 * Tela de captura (T063) — o pacote sensorial em edição.
 *
 * Era um `<Modal>` desenhado por cima do visor, e o visor continuava lá,
 * renderizando frames que ninguém via. O T062 mediu: com o modal aberto, o
 * cliente de câmera segue ativo.
 *
 * ⚠️ Virar rota **não** basta para desligar a câmera — o mesmo T062 mediu que
 * `/settings`, que já é rota, também deixa o cliente ativo, porque o
 * `expo-router` mantém a tela de baixo montada. Quem desliga de fato é o
 * `camera.tsx`, que deixa de renderizar a `<CameraView>` quando perde o foco.
 * Esta tela e aquela desmontagem são as duas metades da mesma correção.
 */
export default function CaptureScreen() {
  const router = useRouter();
  const temSessao = useCaptureStore((s) => s.session !== null);

  // `clear()` — de salvar, descartar ou fechar o pacote postado — zera a sessão.
  // É esse o sinal de que a tela cumpriu seu papel e deve sair de cena; assim
  // cada caminho de saída continua sendo um só (`clear`), como era no modal.
  useEffect(() => {
    if (!temSessao && router.canGoBack()) router.back();
  }, [temSessao, router]);

  if (!temSessao) return <View style={{ flex: 1, backgroundColor: colors.ink }} />;

  return <CaptureSheet />;
}

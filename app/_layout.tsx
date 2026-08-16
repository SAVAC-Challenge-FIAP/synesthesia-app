import { Lato_300Light, Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { Nunito_700Bold } from '@expo-google-fonts/nunito';
import { setAudioModeAsync } from 'expo-audio';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { AberturaMarca } from '@/components/AberturaMarca';
import { colors } from '@/theme/tokens';

/**
 * Segura o splash até haver algo no lugar dele (T071/T094).
 *
 * Quem assume agora é a `AberturaMarca`, que entra no **primeiro** render do
 * JS. Antes o splash só saía com as fontes carregadas, e no intervalo a tela
 * ficava no preto do `ink` — medido no aparelho: vários segundos de nada entre
 * a marca e o visor. Chamado no módulo, antes de qualquer render.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Nunito (display) + Lato (labels) — ver `fonts` em src/theme/tokens.ts (T046).
  // Só os pesos que os tokens realmente usam: carregar um a mais é asset morto
  // no bundle (foi o caso do Syne_800ExtraBold, que ninguém referenciava).
  /**
   * A abertura em JS (T094) cobre a troca entre o splash e o app. Ela nasce
   * visível e some sozinha; sem ela, o que aparecia no lugar da marca era o
   * corte seco para o visor.
   */
  const [abrindo, setAbrindo] = useState(true);
  const fecharAbertura = useCallback(() => setAbrindo(false), []);

  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    // Prévia musical audível mesmo com o iPhone no modo silencioso
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // O splash nativo sai assim que o JS desenha o primeiro frame — e o que está
  // desenhado ali é a mesma marca, agora animada. Uma imagem substitui a outra
  // sem intervalo, que é o que mata a piscada.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // O provider precisa envolver TUDO (inclusive o estado de fontes carregando):
  // sem ele, useSafeAreaInsets() lança, e é dele que vêm os insets reais do
  // aparelho que as barras de ação usam no lugar de espaçamento fixo.
  // `initialWindowMetrics` entrega os insets já no primeiro render, evitando o
  // salto de layout enquanto a medição nativa não chega.
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      {fontsLoaded ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ink },
            animation: 'fade',
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.ink }} />
      )}
      {/* Por cima de tudo e desde o primeiro frame: o app monta atrás enquanto
          a marca está na tela, e o fade revela algo já pronto. */}
      {abrindo ? (
        <AberturaMarca pronto={fontsLoaded} mostrarNome={fontsLoaded} onFim={fecharAbertura} />
      ) : null}
    </SafeAreaProvider>
  );
}

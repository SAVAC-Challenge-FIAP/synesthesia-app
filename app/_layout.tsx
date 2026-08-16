import { Lato_300Light, Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { Nunito_700Bold } from '@expo-google-fonts/nunito';
import { setAudioModeAsync } from 'expo-audio';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

/**
 * Segura o splash até a UI estar de fato pronta (T071).
 *
 * Sem isto o splash some quando o JS carrega, e quem aparece no lugar é a tela
 * vazia de `fontsLoaded === false` — um piscar de nada entre a marca e o app.
 * Chamado no módulo, antes de qualquer render.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Nunito (display) + Lato (labels) — ver `fonts` em src/theme/tokens.ts (T046).
  // Só os pesos que os tokens realmente usam: carregar um a mais é asset morto
  // no bundle (foi o caso do Syne_800ExtraBold, que ninguém referenciava).
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

  // A marca sai de cena quando há o que mostrar no lugar dela.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

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
    </SafeAreaProvider>
  );
}

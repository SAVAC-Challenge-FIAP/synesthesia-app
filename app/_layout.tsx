import {
  DMMono_300Light,
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { setAudioModeAsync } from 'expo-audio';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    DMMono_300Light,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    // Prévia musical audível mesmo com o iPhone no modo silencioso
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
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
    </SafeAreaProvider>
  );
}

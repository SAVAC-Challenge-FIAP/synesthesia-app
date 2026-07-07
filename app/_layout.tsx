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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
          animation: 'fade',
        }}
      />
    </>
  );
}

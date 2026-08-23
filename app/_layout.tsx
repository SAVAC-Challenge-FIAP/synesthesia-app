/**
 * @docs docs/components/_layout.md
 */
import {
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
} from "@expo-google-fonts/lato";
import { Nunito_700Bold } from "@expo-google-fonts/nunito";
import { setAudioModeAsync } from "expo-audio";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { AberturaMarca } from "@/components/AberturaMarca";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [abrindo, setAbrindo] = useState(true);
  const fecharAbertura = useCallback(() => setAbrindo(false), []);

  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      {fontsLoaded ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ink },
            animation: "fade",
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.ink }} />
      )}
      {}
      {abrindo ? (
        <AberturaMarca
          pronto={fontsLoaded}
          mostrarNome={fontsLoaded}
          onFim={fecharAbertura}
        />
      ) : null}
    </SafeAreaProvider>
  );
}

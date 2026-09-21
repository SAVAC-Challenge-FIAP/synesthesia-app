/**
 * @docs docs/components/capture.md
 */
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { CaptureSheet } from "@/components/CaptureSheet";
import { useCaptureStore } from "@/stores/useCaptureStore";
import { colors } from "@/theme/tokens";

export default function CaptureScreen() {
  const router = useRouter();
  const temSessao = useCaptureStore((s) => s.session !== null);

  useEffect(() => {
    if (temSessao) return;
    if (router.canGoBack()) router.back();
    else router.replace("/camera");
  }, [temSessao, router]);

  if (!temSessao)
    return <View style={{ flex: 1, backgroundColor: colors.ink }} />;

  return <CaptureSheet />;
}

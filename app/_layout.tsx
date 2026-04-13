import "../global.css";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular_Italic,
} from "@expo-google-fonts/playfair-display";
import { supabase } from "../src/lib/supabase";
import { useAppStore } from "../src/store";
import { View } from "react-native";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
  });

  const setUserId = useAppStore((s) => s.setUserId);

  // Keep the auth listener so userId stays in sync when backend is wired up.
  // Intentionally NOT blocking navigation on auth state — the UI is hardcoded.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Only block on font loading — don't wait for Supabase
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#0f1923" }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="book/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="session/[id]"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

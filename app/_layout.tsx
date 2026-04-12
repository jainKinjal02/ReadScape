import "../global.css";
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
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
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Listen to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const uid = session?.user?.id ?? null;
        setUserId(uid);

        const inTabsGroup = segments[0] === "(tabs)";
        if (!uid && inTabsGroup) {
          router.replace("/");
        }
        setAuthReady(true);
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || !authReady) {
    return <View style={{ flex: 1, backgroundColor: "#F7F4EF" }} />;
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

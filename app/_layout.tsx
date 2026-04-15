import "../global.css";
import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
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

  const router = useRouter();
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);

  useEffect(() => {
    // Check for an existing session on app launch — skip landing if already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        setUserName(session.user.user_metadata?.name ?? "Reader");
        router.replace("/(tabs)/home");
      }
    });

    // Keep store in sync with ongoing auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (session) {
        setUserName(session.user.user_metadata?.name ?? "Reader");
      }
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
      <Stack.Screen name="auth" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="book/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="genre/[name]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="session/[id]"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

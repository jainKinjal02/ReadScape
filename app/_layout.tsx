import "../global.css";
import React, { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_500Medium_Italic,
} from "@expo-google-fonts/fraunces";
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
} from "@expo-google-fonts/archivo";
import {
  Literata_400Regular,
  Literata_500Medium,
  Literata_400Regular_Italic,
} from "@expo-google-fonts/literata";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "../src/lib/supabase";
import { profileFromMeta } from "../src/lib/profile";
import { OpeningAnimation } from "../src/components/OpeningAnimation";
import { IVORY } from "../src/components/brandMark";
import { useAppStore } from "../src/store";
import { Animated, StyleSheet } from "react-native";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

// Keep the native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Display / numerals
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_500Medium_Italic,
    // Interface
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    // Long-form reading: quotes, notes, synopses
    Literata_400Regular,
    Literata_500Medium,
    Literata_400Regular_Italic,
  });

  const router = useRouter();
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);
  const setReadingGoal = useAppStore((s) => s.setReadingGoal);
  const setProfile = useAppStore((s) => s.setProfile);

  const [shouldRedirectHome, setShouldRedirectHome] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showInAppSplash, setShowInAppSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const meta = session.user.user_metadata ?? {};
        setUserId(session.user.id);
        setUserName(meta.name ?? "Reader");
        setReadingGoal(Number(meta.reading_goal) || 0);
        setProfile(profileFromMeta(meta));
        setShouldRedirectHome(true);
      }
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (session) {
        const meta = session.user.user_metadata ?? {};
        setUserName(meta.name ?? "Reader");
        setReadingGoal(Number(meta.reading_goal) || 0);
        setProfile(profileFromMeta(meta));
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Once fonts + auth are ready: hide the native splash (plain ivory, the
  // same colour as the animation's first frame), route the reader, and play
  // the opening. The app is underneath by the time the opening fades away.
  const [playOpening, setPlayOpening] = useState(false);
  useEffect(() => {
    if (fontsLoaded && authChecked) {
      SplashScreen.hideAsync();
      if (shouldRedirectHome) {
        router.replace("/(tabs)/home");
      }
      setPlayOpening(true);
    }
  }, [fontsLoaded, authChecked, shouldRedirectHome]);

  const finishOpening = () => {
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setShowInAppSplash(false));
  };

  return (
    <ErrorBoundary>
      {/* Screens wait for the fonts: on iOS, text drawn before its font has
          loaded stays in the system font, which is how the welcome screen's
          title came out in plain sans. The opening covers the wait. */}
      {fontsLoaded && (
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
            name="session/[id]"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
      )}

      {/* Opening animation, over everything until it has played */}
      {showInAppSplash && (
        <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
          {playOpening && <OpeningAnimation onDone={finishOpening} />}
        </Animated.View>
      )}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IVORY,
  },
});

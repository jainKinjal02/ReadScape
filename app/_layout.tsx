import "../global.css";
import React, { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_700Bold,
  CormorantGaramond_400Regular_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "../src/lib/supabase";
import { useAppStore } from "../src/store";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Keep the native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_700Bold,
    CormorantGaramond_400Regular_Italic,
  });

  const router = useRouter();
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);
  const setReadingGoal = useAppStore((s) => s.setReadingGoal);
  const setUserBio = useAppStore((s) => s.setUserBio);
  const setStreak = useAppStore((s) => s.setStreak);

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
        setStreak(Number(meta.reading_streak) || 0);
        setUserBio(meta.bio ?? "");
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
        setStreak(Number(meta.reading_streak) || 0);
        setUserBio(meta.bio ?? "");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Once fonts + auth are ready: hide native splash, navigate, fade out in-app splash
  useEffect(() => {
    if (fontsLoaded && authChecked) {
      SplashScreen.hideAsync();
      if (shouldRedirectHome) {
        router.replace("/(tabs)/home");
      }
      // Short pause so the screen beneath has a moment to render, then fade out
      setTimeout(() => {
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }).start(() => setShowInAppSplash(false));
      }, 300);
    }
  }, [fontsLoaded, authChecked, shouldRedirectHome]);

  return (
    <>
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

      {/* In-app splash — overlays everything while loading, then fades out */}
      {showInAppSplash && (
        <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.icon}
          />
          <Text style={styles.appName}>ReadScape</Text>
          <Text style={styles.tagline}>Your reading journey</Text>
          <View style={styles.divider} />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D1B2A",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 160,
    height: 160,
    borderRadius: 36,
  },
  appName: {
    color: "#F7F4EF",
    fontSize: 42,
    fontFamily: "Georgia",
    marginTop: 28,
    letterSpacing: 2,
  },
  tagline: {
    color: "#E8C5CF",
    fontSize: 16,
    fontFamily: "Georgia",
    marginTop: 10,
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  divider: {
    marginTop: 24,
    width: 60,
    height: 1.5,
    backgroundColor: "#C4899A",
    opacity: 0.4,
    borderRadius: 1,
  },
});

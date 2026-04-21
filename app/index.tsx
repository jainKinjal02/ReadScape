import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

const BG_IMAGES = [
  "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800",
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800",
];

const FEATURES = [
  { icon: "📚", title: "Your Library", desc: "Track every book you've read, are reading, or want to read." },
  { icon: "🎭", title: "Mood Tracking", desc: "Log how a book makes you feel, chapter by chapter." },
  { icon: "✦", title: "AI Companion", desc: "Ask anything about the book you're reading, get recommendations." },
];

export default function LandingScreen() {
  const router = useRouter();

  // One opacity per image — cross-fade without any source swapping
  const opacities = useRef(
    BG_IMAGES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;
  const currentIdx = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const cur = currentIdx.current;
      const nxt = (cur + 1) % BG_IMAGES.length;
      Animated.parallel([
        Animated.timing(opacities[cur], { toValue: 0, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacities[nxt], { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]).start(() => { currentIdx.current = nxt; });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* All images pre-rendered as layers — only opacity animates, no source swap */}
      {BG_IMAGES.map((uri, i) => (
        <Animated.View key={uri} style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ))}

      {/* Gradient overlay — darker at bottom so text is legible */}
      <LinearGradient
        colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* All content in one centred flex column */}
      <View style={styles.content}>
        {/* App name block */}
        <View style={styles.titleBlock}>
          <Text style={styles.tagline}>Your reading life,</Text>
          <Text style={styles.appName}>
            <Text style={{ color: "#f0eef8" }}>Read</Text>
            <Text style={{ color: "#7F77DD" }}>Scape</Text>
          </Text>
          <Text style={styles.subtitle}>
            Track your journey. Capture your mood.{"\n"}Discover your next read.
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.featureRow}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featurePill}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureTitle}>{f.title}</Text>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={styles.ctaBlock}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push("/auth")}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push("/auth?mode=signin")}
          >
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0A08" },

  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
    paddingBottom: 56,
    gap: 32,
  },

  titleBlock: { alignItems: "flex-start" },
  tagline: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 54,
    fontFamily: "CormorantGaramond_700Bold",
    letterSpacing: 0.5,
    lineHeight: 60,
    marginBottom: 14,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
  },

  featureRow: {
    flexDirection: "row",
    gap: 8,
  },
  featurePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(127,119,221,0.12)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.35)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  featureIcon: { fontSize: 14 },
  featureTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },

  ctaBlock: { gap: 12, alignItems: "center" },
  ctaButton: {
    backgroundColor: "#7F77DD",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
    width: "100%",
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  signInLink: { paddingVertical: 4 },
  signInText: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
});

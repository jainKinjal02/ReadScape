import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../src/design/tokens";



const FEATURES = [
  { icon: "📚", title: "Your Library", desc: "Track every book you've read, are reading, or want to read." },
  { icon: "🎭", title: "Mood Tracking", desc: "Log how a book makes you feel, chapter by chapter." },
  { icon: "✦", title: "AI Companion", desc: "Ask anything about the book you're reading, get recommendations." },
];

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* All content in one centred flex column */}
      <View style={styles.content}>
        {/* App name block */}
        <View style={styles.titleBlock}>
          <Text style={styles.tagline}>Your reading life,</Text>
          <Text style={styles.appName}>
            <Text style={{ color: colors.ink }}>Read</Text>
            <Text style={{ color: colors.blushInk }}>Scape</Text>
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
  container: { flex: 1, backgroundColor: colors.paper },

  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
    paddingBottom: 56,
    gap: 32,
  },

  titleBlock: { alignItems: "flex-start" },
  tagline: {
    color: colors.pencil,
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  appName: {
    color: colors.ink,
    fontSize: 54,
    fontFamily: fonts.display,
    letterSpacing: 0.5,
    lineHeight: 60,
    marginBottom: 14,
  },
  subtitle: {
    color: colors.pencil,
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
    backgroundColor: colors.blushSoft,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  featureIcon: { fontSize: 14 },
  featureTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },

  ctaBlock: { gap: 12, alignItems: "center" },
  ctaButton: {
    backgroundColor: colors.ink,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
    width: "100%",
    alignItems: "center",
  },
  ctaText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  signInLink: { paddingVertical: 4 },
  signInText: { color: colors.pencil, fontSize: 13 },
});

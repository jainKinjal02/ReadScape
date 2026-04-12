import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
const { width, height } = Dimensions.get("window");

// Atmospheric background images (Unsplash — free to use)
const BG_IMAGES = [
  "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800",
  "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800",
];

// Sample book covers for the scrolling shelf
const SHELF_COVERS = [
  "https://covers.openlibrary.org/b/id/8739161-M.jpg",
  "https://covers.openlibrary.org/b/id/7984916-M.jpg",
  "https://covers.openlibrary.org/b/id/9256244-M.jpg",
  "https://covers.openlibrary.org/b/id/8226230-M.jpg",
  "https://covers.openlibrary.org/b/id/8091016-M.jpg",
  "https://covers.openlibrary.org/b/id/10527843-M.jpg",
  "https://covers.openlibrary.org/b/id/8750767-M.jpg",
  "https://covers.openlibrary.org/b/id/12008020-M.jpg",
];

const FEATURES = [
  { icon: "📚", title: "Your Library", desc: "Track every book you've read, are reading, or want to read." },
  { icon: "🎭", title: "Mood Tracking", desc: "Log how a book makes you feel, chapter by chapter." },
  { icon: "🤖", title: "AI Companion", desc: "Ask anything about the book you're reading, get recommendations." },
];

export default function LandingScreen() {
  const router = useRouter();
  const [bgIndex, setBgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;


  // Cycle background images with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setBgIndex((prev) => (prev + 1) % BG_IMAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background image with crossfade */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <Image
          source={{ uri: BG_IMAGES[bgIndex] }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Animated.View>

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.75)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Hero content */}
      <View style={styles.hero}>
        <Text style={styles.tagline}>Your reading life,</Text>
        <Text style={styles.appName}>ReadScape</Text>
        <Text style={styles.subtitle}>
          Track your journey. Capture your mood.{"\n"}Discover your next read.
        </Text>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.replace("/(tabs)/home")}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Start your journey</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Text style={styles.signInText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>

      {/* Scrolling book shelf */}
      <View style={styles.shelfContainer}>
        <FlatList
          data={[...SHELF_COVERS, ...SHELF_COVERS]}
          horizontal
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={styles.shelfCover}
              contentFit="cover"
            />
          )}
        />
      </View>

      {/* Features row */}
      <View style={styles.featuresRow}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0A08" },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  tagline: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 52,
    fontFamily: "PlayfairDisplay_700Bold",
    letterSpacing: 1,
    marginBottom: 16,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  ctaButton: {
    backgroundColor: "#C4899A",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
    marginBottom: 16,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  signInLink: { padding: 8 },
  signInText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  shelfContainer: { height: 100, marginBottom: 8 },
  shelfCover: {
    width: 65,
    height: 96,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  featuresRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 8,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  featureIcon: { fontSize: 24, marginBottom: 6 },
  featureTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  featureDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },
});

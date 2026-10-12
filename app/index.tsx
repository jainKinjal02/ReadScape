import React from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../src/design/tokens";
import { INK, IVORY } from "../src/components/brandMark";

/**
 * The welcome screen: the book opening onto a landscape, the line that says
 * what Readscape is for, and the two ways in.
 *
 * The illustration sits in the top 40% of its image and the rest is paper, so
 * it is drawn to cover the screen anchored at the top; the text goes in the
 * empty lower part, whatever the phone's shape.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Image
        source={require("../assets/welcome-background.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top"
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.name}>Readscape</Text>
        <Text style={styles.tagline}>Your reading life, kept here.</Text>
        <Text style={styles.lead}>
          Track your books. Save your quotes. Remember how they made you feel.
        </Text>

        <View style={styles.ctas}>
          <TouchableOpacity style={styles.primary} onPress={() => router.push("/auth")} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => router.push("/auth?mode=signin")}>
            <Text style={styles.secondaryText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -0.5,
    color: INK,
  },
  tagline: {
    fontFamily: fonts.readingItalic,
    fontSize: 19,
    lineHeight: 26,
    color: INK,
    marginTop: 6,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.pencil,
    marginTop: 14,
    maxWidth: 330,
  },
  ctas: { marginTop: 34, gap: 6, alignItems: "center" },
  primary: {
    alignSelf: "stretch",
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 16, letterSpacing: 0.2, color: IVORY },
  secondary: { paddingVertical: 12 },
  secondaryText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.pencil },
});

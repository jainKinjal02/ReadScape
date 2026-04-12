import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

// Deterministic warm palette — each book gets a consistent color from its title
const PALETTE = ["#4a3728", "#7a6455", "#8b6a4a", "#5a4a3a", "#3d3028"];
function bgFromTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

interface Props {
  uri?: string | null;
  title: string;
  /** Pass the same style you'd put on the wrapping View (width, height, borderRadius, etc.) */
  style?: object;
}

/**
 * Drop-in book cover: renders the image if available, falls back to
 * a warm background with title initials when the URL is missing or broken.
 *
 * Replace:
 *   <View style={s.cover}>
 *     <Image source={{ uri }} style={s.coverImg} contentFit="cover" />
 *   </View>
 * With:
 *   <CoverImage uri={uri} title={title} style={s.cover} />
 */
export function CoverImage({ uri, title, style }: Props) {
  const [error, setError] = useState(false);

  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const bg = bgFromTitle(title);

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg },
        style,
        { overflow: "hidden" }, // must override any caller value
      ]}
    >
      {/* Fallback: initials always rendered underneath */}
      <Text style={styles.initials} numberOfLines={1}>{initials}</Text>

      {/* Image overlaid on top — hides initials when it loads */}
      {uri != null && !error && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          onError={() => setError(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "rgba(250,246,240,0.55)",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1,
  },
});

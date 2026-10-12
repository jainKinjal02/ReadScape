import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { colors, fonts } from "../design/tokens";

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "R"
  );
}

/** The reader's round photo, or their initials in an outlined circle. */
export function Avatar({
  name,
  uri,
  size,
  style,
}: {
  name: string;
  uri: string | null;
  size: number;
  style?: ViewStyle;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <View style={[styles.frame, round, style]}>
        <Image source={{ uri }} style={round} contentFit="cover" transition={200} />
      </View>
    );
  }
  return (
    <View style={[styles.frame, styles.empty, round, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.rule },
  empty: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontFamily: fonts.bodySemi, color: colors.ink },
});

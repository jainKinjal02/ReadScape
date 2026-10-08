import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

/**
 * Five marks, rateable in halves: the left half of a mark sets n - 0.5, the
 * right half sets n. Tapping exactly the current rating clears it.
 *
 * Two looks share the behaviour: the quiet squares on the book screen and the
 * large stars in the "You finished it!" moment.
 */
export function RatingMarks({
  value,
  onChange,
  variant = "squares",
  onColor,
  offColor,
  size,
  gap,
}: {
  value: number;
  onChange: (value: number) => void;
  variant?: "squares" | "stars";
  onColor: string;
  offColor: string;
  size?: number;
  gap?: number;
}) {
  const markSize = size ?? (variant === "stars" ? 34 : 16);
  // Squares are small to look at but need a finger-sized target, and each one
  // is split in two, so the touch area is wider than the mark it holds.
  const cell = variant === "stars" ? markSize + 6 : 24;

  return (
    <View style={[styles.row, { gap: gap ?? 0 }]}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0;
        return (
          <View key={n} style={[styles.cell, { width: cell, height: Math.max(cell, markSize + 8) }]}>
            <Mark variant={variant} size={markSize} fill={fill} onColor={onColor} offColor={offColor} />
            <View style={StyleSheet.absoluteFill}>
              <View style={styles.halves}>
                {[n - 0.5, n].map((v) => (
                  <Pressable
                    key={v}
                    testID={`rate-${v}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${formatRating(v)}`}
                    style={styles.half}
                    onPress={() => onChange(v === value ? 0 : v)}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Mark({
  variant,
  size,
  fill,
  onColor,
  offColor,
}: {
  variant: "squares" | "stars";
  size: number;
  fill: number;
  onColor: string;
  offColor: string;
}) {
  // The filled part is the same shape drawn over the empty one and clipped to
  // the fill, so a half mark is exactly half of a whole one.
  const clip: ViewStyle = { position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, overflow: "hidden" };

  if (variant === "stars") {
    const glyph = (color: string) => (
      <Text style={{ fontSize: size, lineHeight: size * 1.15, color }}>★</Text>
    );
    return (
      <View pointerEvents="none">
        {glyph(offColor)}
        {fill > 0 && <View style={clip}>{glyph(onColor)}</View>}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={{ width: size, height: size, borderRadius: 1, backgroundColor: offColor }}>
      {fill > 0 && (
        <View style={clip}>
          <View style={{ width: size, height: size, backgroundColor: onColor }} />
        </View>
      )}
    </View>
  );
}

const WORDS = ["", "one", "two", "three", "four", "five"];

/** "four", "three and a half", "a half". Ratings read the way you'd say them. */
export function ratingWords(value: number): string {
  const whole = Math.floor(value);
  const half = value - whole >= 0.5;
  if (!half) return WORDS[whole] ?? "";
  return whole === 0 ? "a half" : `${WORDS[whole]} and a half`;
}

/** "4", "3.5". */
export function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "★★★½☆" for compact text, e.g. the year-wrap timeline. */
export function ratingStars(value: number): string {
  const whole = Math.floor(value);
  const half = value - whole >= 0.5;
  return "★".repeat(whole) + (half ? "½" : "") + "☆".repeat(5 - whole - (half ? 1 : 0));
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  cell: { alignItems: "center", justifyContent: "center" },
  halves: { flex: 1, flexDirection: "row" },
  half: { flex: 1 },
});

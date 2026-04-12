// Soft Linen theme — clean, minimal, Muji-like. Books are the visual star.
export const colors = {
  bgPrimary: "#F7F4EF",
  bgCard: "#FFFFFF",
  bgSurface: "#EDEAE4",
  inkPrimary: "#2D2D2D",
  inkMuted: "#7A7A7A",
  roseAccent: "#C4899A",
  roseSoft: "#E8C5CF",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const moodConfig: Record<
  string,
  { emoji: string; label: string; color: string; score: number }
> = {
  loving_it: { emoji: "😍", label: "Loving it", color: "#C4899A", score: 5 },
  getting_into_it: {
    emoji: "🙂",
    label: "Getting into it",
    color: "#9AB8C4",
    score: 4,
  },
  struggling: { emoji: "😤", label: "Struggling", color: "#C4A96A", score: 2 },
  taking_a_break: {
    emoji: "😴",
    label: "Taking a break",
    color: "#A8A8A8",
    score: 1,
  },
  finished: { emoji: "🎉", label: "Finished!", color: "#6AC48A", score: 5 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

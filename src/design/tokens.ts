// Warm Literary theme — espresso, cream, and terracotta. Books are the visual star.
export const colors = {
  // Core palette (from prototype)
  cream: "#f7f2eb",
  cream2: "#f0e9de",
  cream3: "#e8ddd0",
  parchment: "#faf6f0",
  espresso: "#2c1f14",
  espresso2: "#4a3728",
  espresso3: "#6b5244",
  charcoal: "#2c2420",
  char2: "#4a3f3a",
  char3: "#7a6e6a",
  terracotta: "#c97c5a",
  terra2: "#e09070",
  terra3: "#a85e3e",
  sage: "#7a9e7e",
  sage2: "#a8c5aa",

  // Aliases used throughout the existing codebase
  bgPrimary: "#f7f2eb",
  bgCard: "#faf6f0",
  bgSurface: "#e8ddd0",
  inkPrimary: "#2c1f14",
  inkMuted: "#7a6e6a",
  roseAccent: "#c97c5a",
  roseSoft: "rgba(201,124,90,0.12)",
  white: "#ffffff",
  black: "#000000",
} as const;

export const moodConfig: Record<
  string,
  { symbol: string; label: string; color: string; score: number }
> = {
  loving_it:      { symbol: "○",  label: "Loving it",  color: "#c97c5a", score: 5 },
  getting_into_it:{ symbol: "✦",  label: "Hooked",     color: "#a85e3e", score: 4 },
  struggling:     { symbol: "◇",  label: "Slow read",  color: "#c9bdb5", score: 2 },
  taking_a_break: { symbol: "▲",  label: "Tense",      color: "#4a3728", score: 3 },
  finished:       { symbol: "◈",  label: "Moved",      color: "#7a9e7e", score: 5 },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const borderRadius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
} as const;

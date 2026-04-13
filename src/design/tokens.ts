// ── Midnight Bloom theme ───────────────────────────────────────────────────
// Dark navy base, soft lavender-purple accent, cool white text.
// Feels like reading under starlight with a candle nearby.
export const colors = {
  // Backgrounds — deep navy
  cream:     "#0f1923",   // main screen background
  cream2:    "#162030",   // slightly elevated surface
  cream3:    "#2a3548",   // borders & dividers
  parchment: "#131e2c",   // card / header background

  // Text — cool ivory with a lavender hint
  espresso:  "#f0eef8",   // primary text
  espresso2: "#b8b4d4",   // secondary text
  espresso3: "#8a87a8",   // tertiary

  charcoal:  "#f0eef8",
  char2:     "#b8b4d4",
  char3:     "#7a7a9a",   // muted / placeholder

  // Accent — lavender purple
  terracotta: "#7F77DD",  // primary accent
  terra2:     "#9b95e8",  // lighter purple
  terra3:     "#6058c4",  // deeper purple

  sage:  "#5bbfaa",
  sage2: "#89d4c4",

  // Backward-compat aliases
  bgPrimary:  "#0f1923",
  bgCard:     "#131e2c",
  bgSurface:  "#2a3548",
  inkPrimary: "#f0eef8",
  inkMuted:   "#7a7a9a",
  roseAccent: "#7F77DD",
  roseSoft:   "rgba(127,119,221,0.15)",
  white: "#ffffff",
  black: "#000000",
} as const;

export const moodConfig: Record<
  string,
  { symbol: string; label: string; color: string; score: number }
> = {
  loving_it:       { symbol: "○",  label: "Loving it", color: "#7F77DD", score: 5 },
  getting_into_it: { symbol: "✦",  label: "Hooked",    color: "#9b95e8", score: 4 },
  struggling:      { symbol: "◇",  label: "Slow read", color: "#7a7a9a", score: 2 },
  taking_a_break:  { symbol: "▲",  label: "Tense",     color: "#b8b4d4", score: 3 },
  finished:        { symbol: "◈",  label: "Moved",     color: "#5bbfaa", score: 5 },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const borderRadius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
} as const;

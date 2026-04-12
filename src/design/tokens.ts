// ── Candlelight Dark theme ─────────────────────────────────────────────────
// Deep warm espresso backgrounds, ivory text, terracotta accent.
// Feels like reading by lamplight, not cold tech-dark.
export const colors = {
  // Backgrounds — warm dark espresso
  cream:     "#13110f",   // main screen background
  cream2:    "#1e1a16",   // slightly elevated surface
  cream3:    "#3d3028",   // borders & dividers
  parchment: "#1a1714",   // card / header background

  // Text — warm ivory (reversed from light theme)
  espresso:  "#f0e8d8",   // primary text
  espresso2: "#c4b09a",   // secondary text
  espresso3: "#9a8470",   // tertiary

  charcoal:  "#f0e8d8",
  char2:     "#c4b09a",
  char3:     "#8a7a6e",   // muted / placeholder

  // Accent — terracotta (slightly warmer for dark backgrounds)
  terracotta: "#d4845a",
  terra2:     "#e09878",
  terra3:     "#b86040",

  sage:  "#7aaa80",
  sage2: "#a8c5aa",

  // Backward-compat aliases
  bgPrimary: "#13110f",
  bgCard:    "#1a1714",
  bgSurface: "#3d3028",
  inkPrimary: "#f0e8d8",
  inkMuted:   "#8a7a6e",
  roseAccent: "#d4845a",
  roseSoft:   "rgba(212,132,90,0.15)",
  white: "#ffffff",
  black: "#000000",
} as const;

export const moodConfig: Record<
  string,
  { symbol: string; label: string; color: string; score: number }
> = {
  loving_it:       { symbol: "○",  label: "Loving it", color: "#d4845a", score: 5 },
  getting_into_it: { symbol: "✦",  label: "Hooked",    color: "#b86040", score: 4 },
  struggling:      { symbol: "◇",  label: "Slow read", color: "#9a8a78", score: 2 },
  taking_a_break:  { symbol: "▲",  label: "Tense",     color: "#c4b09a", score: 3 },
  finished:        { symbol: "◈",  label: "Moved",     color: "#7aaa80", score: 5 },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const borderRadius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
} as const;

// ── Paper & Ink theme ──────────────────────────────────────────────────────
// Warm paper, near-black ink, one highlighter yellow and a blush pink.
//
// The governing idea: the app contributes paper, ink and an accent — nothing
// more. Every other colour on screen comes from the book covers themselves,
// so the shelf changes colour as the reading does. That is why there is no
// brand hue here competing with the jackets.
export const colors = {
  // ── Surfaces ──
  paper:      "#FBFAF6",  // main screen background
  card:       "#FFFFFF",  // raised surface
  rule:       "#E9E5DB",  // hairline dividers
  ruleStrong: "#CFC9BB",  // dashed borders, empty states

  // ── Text ──
  ink:     "#1B1A22",  // primary
  pencil:  "#7C7986",  // secondary / metadata
  pencil2: "#9B98A4",  // placeholder / disabled

  // ── Accents ──
  mark:      "#FFE83D",  // highlighter yellow — the emphasis colour
  markInk:   "#3D3612",  // readable text on `mark`
  blush:     "#FF9EC4",  // soft pink — warmth, favourites, moods
  blushSoft: "#FFE1EC",  // pink chip background
  blushInk:  "#7A3552",  // readable text on `blushSoft`
  sage:      "#8FB09B",  // quiet green — positive states
  deep:      "#2E2A33",  // charts, filled bars

  // ── Feedback ──
  danger:     "#B3435A",
  dangerSoft: "#FBE9EC",

  // ── Legacy aliases ────────────────────────────────────────────────────────
  // The screens still reference the old dark-theme key names. Repointing them
  // here flips most of the app in one move; the remaining work is the
  // hardcoded rgba() values that only ever made sense on a dark ground.
  cream:      "#FBFAF6",  // was main bg
  cream2:     "#FFFFFF",  // was elevated surface
  cream3:     "#E9E5DB",  // was borders & dividers
  parchment:  "#FFFFFF",  // was card / header bg

  espresso:   "#1B1A22",
  espresso2:  "#7C7986",
  espresso3:  "#9B98A4",

  charcoal:   "#1B1A22",
  char2:      "#7C7986",
  char3:      "#9B98A4",

  // Primary actions are ink-on-paper, as in the reference: a filled black
  // button. Blush is deliberately kept for accents so it stays special.
  terracotta: "#1B1A22",
  terra2:     "#2E2A33",
  terra3:     "#000000",

  sage2: "#B7CDBF",

  bgPrimary:  "#FBFAF6",
  bgCard:     "#FFFFFF",
  bgSurface:  "#E9E5DB",
  inkPrimary: "#1B1A22",
  inkMuted:   "#7C7986",
  roseAccent: "#FF9EC4",
  roseSoft:   "#FFE1EC",
  white: "#ffffff",
  black: "#000000",
} as const;

// ── Type ───────────────────────────────────────────────────────────────────
// Fraunces for display and numerals, Archivo for interface text, Literata for
// anything meant to be *read* — quotes, notes, synopses.
//
// Note: the reference uses Fraunces' SOFT and WONK variable axes. Static
// Google Font builds do not expose variable axes, so we get the upright
// default rather than the slightly wonky cut in the mockup.
export const fonts = {
  display:       "Fraunces_600SemiBold",
  displayMedium: "Fraunces_500Medium",
  displayBold:   "Fraunces_700Bold",
  displayItalic: "Fraunces_500Medium_Italic",

  body:      "Archivo_400Regular",
  bodyMedium:"Archivo_500Medium",
  bodySemi:  "Archivo_600SemiBold",

  reading:       "Literata_400Regular",
  readingMedium: "Literata_500Medium",
  readingItalic: "Literata_400Regular_Italic",
} as const;

export const moodConfig: Record<
  string,
  { symbol: string; label: string; color: string; score: number }
> = {
  loving_it:       { symbol: "○", label: "Loving it", color: "#FF9EC4", score: 5 },
  getting_into_it: { symbol: "✦", label: "Hooked",    color: "#FFE83D", score: 4 },
  struggling:      { symbol: "◇", label: "Slow read", color: "#CFC9BB", score: 2 },
  taking_a_break:  { symbol: "▲", label: "Tense",     color: "#9B98A4", score: 3 },
  finished:        { symbol: "◈", label: "Moved",     color: "#8FB09B", score: 5 },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const borderRadius = {
  // Paper does not have big soft corners. Cards are nearly square; only
  // pills and avatars stay round.
  sm: 2, md: 3, lg: 4, xl: 8, full: 9999,
} as const;

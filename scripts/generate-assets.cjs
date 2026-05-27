// ReadScape — Asset Generator
// Produces icon.png, adaptive-icon.png, splash.png using resvg-js
// Run: node scripts/generate-assets.cjs

const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "assets");

// ─── Palette ─────────────────────────────────────────────────────────────────
const NAVY       = "#0D1B2A";
const NAVY_MID   = "#132030";
const ROSE       = "#C4899A";
const ROSE_SOFT  = "#E8C5CF";
const LINEN      = "#F7F4EF";
const LINEN_DARK = "#E6E1D5";
const LINEN_MID  = "#EDE9E0";
const LINEN_DIM  = "#DDD8CC";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function svgToPng(svgStr) {
  const resvg = new Resvg(svgStr, { shapeRendering: 2, textRendering: 2, imageRendering: 1 });
  return Buffer.from(resvg.render().asPng());
}

function write(filename, buf) {
  const dest = path.join(ASSETS, filename);
  fs.writeFileSync(dest, buf);
  console.log(`  ✓  ${filename}  (${Math.round(buf.length / 1024)} KB)`);
}

// ─── Book Component SVG template ─────────────────────────────────────────────
// cx,cy = center of the book spine-top
// bw = half-width of each page, bh = book height
function bookSvg({ cx, cy, bw, bh, lx, rx, bookmarkW, starScale = 1, moonCx, moonCy, moonR }) {
  // Derived coords
  const spineTop    = cy;
  const spineBot    = cy + bh;
  const topY        = spineTop;
  const botY        = spineBot;
  const leftEdgeX   = cx - bw;
  const rightEdgeX  = cx + bw;
  const topCurveOff = bh * 0.08;  // how far pages bow outward at top
  const botCurveOff = bh * 0.05;

  // Page line spread
  const lineCount = 8;
  const lineStart = topY + bh * 0.15;
  const lineEnd   = botY - bh * 0.12;
  const lineStep  = (lineEnd - lineStart) / (lineCount - 1);

  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    const y    = lineStart + i * lineStep;
    const full = i < lineCount - 2;
    // Left page: from leftEdgeX+pad to just left of spine
    const leftX1 = leftEdgeX + bw * 0.1;
    const leftX2 = full ? cx - bw * 0.04 : leftEdgeX + bw * 0.5;
    // Right page: from just right of spine to rightEdgeX-pad
    const rightX1 = cx + bw * 0.04;
    const rightX2 = full ? rightEdgeX - bw * 0.1 : rightEdgeX - bw * 0.4;

    lines.push(`
      <line x1="${leftX1}" y1="${y}" x2="${leftX2}" y2="${y}"
            stroke="#5C4A32" stroke-width="${Math.max(3, bw * 0.016)}" stroke-linecap="round" opacity="0.18"/>
      <line x1="${rightX1}" y1="${y}" x2="${rightX2}" y2="${y}"
            stroke="#5C4A32" stroke-width="${Math.max(3, bw * 0.016)}" stroke-linecap="round" opacity="0.18"/>`);
  }

  const bkW = bw * 0.08;
  const bkX = rightEdgeX - bw * 0.18;
  const bkH = bh * 0.3;

  const moonPunchR = moonR * 0.85;
  const moonPunchCx = moonCx + moonR * 0.55;
  const moonPunchCy = moonCy - moonR * 0.35;

  return `
    <defs>
      <linearGradient id="bg_g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${NAVY_MID}"/>
        <stop offset="100%" stop-color="${NAVY}"/>
      </linearGradient>
      <linearGradient id="lp_g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${LINEN}"/>
        <stop offset="100%" stop-color="${LINEN_DARK}"/>
      </linearGradient>
      <linearGradient id="rp_g" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${LINEN_MID}"/>
        <stop offset="100%" stop-color="${LINEN_DIM}"/>
      </linearGradient>
      <mask id="moon_mask">
        <rect width="10000" height="10000" fill="white"/>
        <circle cx="${moonPunchCx}" cy="${moonPunchCy}" r="${moonPunchR}" fill="black"/>
      </mask>
    </defs>

    <!-- Soft glow behind book -->
    <ellipse cx="${cx}" cy="${cy + bh * 0.5}" rx="${bw * 1.1}" ry="${bh * 0.55}"
             fill="#1E3050" opacity="0.55"/>

    <!-- Ground shadow -->
    <ellipse cx="${cx + bw * 0.02}" cy="${botY + bh * 0.04}"
             rx="${bw * 0.85}" ry="${bh * 0.05}"
             fill="#000000" opacity="0.20"/>

    <!-- Left page -->
    <path d="M ${cx},${topY}
             C ${cx - bw * 0.25},${topY + topCurveOff}
               ${leftEdgeX - bw * 0.03},${topY + bh * 0.12}
               ${leftEdgeX},${topY + bh * 0.22}
             L ${leftEdgeX},${botY - bh * 0.18}
             C ${leftEdgeX - bw * 0.03},${botY - bh * 0.08}
               ${cx - bw * 0.25},${botY - botCurveOff}
               ${cx},${botY}
             Z"
          fill="url(#lp_g)"/>

    <!-- Right page -->
    <path d="M ${cx},${topY}
             C ${cx + bw * 0.25},${topY + topCurveOff}
               ${rightEdgeX + bw * 0.03},${topY + bh * 0.12}
               ${rightEdgeX},${topY + bh * 0.22}
             L ${rightEdgeX},${botY - bh * 0.18}
             C ${rightEdgeX + bw * 0.03},${botY - bh * 0.08}
               ${cx + bw * 0.25},${botY - botCurveOff}
               ${cx},${botY}
             Z"
          fill="url(#rp_g)"/>

    <!-- Spine -->
    <rect x="${cx - 3}" y="${topY}" width="6" height="${bh}"
          rx="3" fill="${ROSE}" opacity="0.92"/>

    <!-- Text lines -->
    ${lines.join("")}

    <!-- Bookmark ribbon -->
    <path d="M ${bkX},${topY} L ${bkX + bkW},${topY}
             L ${bkX + bkW},${topY + bkH}
             L ${bkX + bkW / 2},${topY + bkH - bkW * 0.6}
             L ${bkX},${topY + bkH} Z"
          fill="${ROSE}" opacity="0.88"/>

    <!-- Crescent moon -->
    <circle cx="${moonCx}" cy="${moonCy}" r="${moonR}"
            fill="${ROSE_SOFT}" opacity="0.80" mask="url(#moon_mask)"/>
  `;
}

// ─── ICON SVG (1024 × 1024) ───────────────────────────────────────────────
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024"
     xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="1024" height="1024" fill="${NAVY}"/>
  <rect width="1024" height="1024" fill="url(#bg_g)"/>

  ${bookSvg({
    cx: 512, cy: 265,
    bw: 250, bh: 500,
    moonCx: 820, moonCy: 165, moonR: 44,
  })}

  <!-- Stars -->
  <circle cx="650" cy="128" r="5"   fill="${ROSE}"      opacity="0.75"/>
  <circle cx="735" cy="100" r="3.5" fill="${ROSE_SOFT}" opacity="0.65"/>
  <circle cx="295" cy="170" r="4"   fill="${ROSE_SOFT}" opacity="0.55"/>
  <circle cx="190" cy="215" r="3"   fill="${ROSE}"      opacity="0.50"/>
  <circle cx="870" cy="290" r="3"   fill="${ROSE_SOFT}" opacity="0.45"/>
  <circle cx="178" cy="310" r="2.5" fill="${ROSE_SOFT}" opacity="0.40"/>
  <circle cx="558" cy="120" r="3"   fill="${ROSE}"      opacity="0.55"/>
  <circle cx="450" cy="148" r="2"   fill="${ROSE_SOFT}" opacity="0.40"/>
</svg>`;

// ─── SPLASH SVG (1284 × 2778) ─────────────────────────────────────────────
// Book centered at ~y=1060, text below at ~y=1530
const splashSvg = `
<svg width="1284" height="2778" viewBox="0 0 1284 2778"
     xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="1284" height="2778" fill="${NAVY}"/>
  <rect width="1284" height="2778" fill="url(#bg_g)"/>

  <!-- Ambient glow low center -->
  <ellipse cx="642" cy="1700" rx="600" ry="800" fill="#0F2240" opacity="0.5"/>

  ${bookSvg({
    cx: 642, cy: 830,
    bw: 310, bh: 600,
    moonCx: 1020, moonCy: 640, moonR: 54,
  })}

  <!-- Stars -->
  <circle cx="820" cy="600"  r="5.5" fill="${ROSE}"      opacity="0.75"/>
  <circle cx="920" cy="555"  r="4"   fill="${ROSE_SOFT}" opacity="0.65"/>
  <circle cx="380" cy="680"  r="5"   fill="${ROSE_SOFT}" opacity="0.55"/>
  <circle cx="240" cy="740"  r="3.5" fill="${ROSE}"      opacity="0.50"/>
  <circle cx="1100" cy="780" r="3"   fill="${ROSE_SOFT}" opacity="0.45"/>
  <circle cx="220"  cy="810" r="3"   fill="${ROSE_SOFT}" opacity="0.38"/>
  <circle cx="700"  cy="590" r="3.5" fill="${ROSE}"      opacity="0.55"/>
  <circle cx="558"  cy="620" r="2.5" fill="${ROSE_SOFT}" opacity="0.40"/>

  <!-- App name -->
  <text x="642" y="1610"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="108" font-weight="normal"
        fill="${LINEN}" text-anchor="middle" letter-spacing="4">ReadScape</text>

  <!-- Tagline -->
  <text x="642" y="1692"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="38" font-weight="normal"
        fill="${ROSE_SOFT}" text-anchor="middle" letter-spacing="3" opacity="0.85">
    Your reading journey
  </text>

  <!-- Subtle divider line -->
  <line x1="442" y1="1720" x2="842" y2="1720"
        stroke="${ROSE}" stroke-width="1.5" opacity="0.35"/>
</svg>`;

// ─── ADAPTIVE ICON (1024 × 1024, transparent bg, more padding) ───────────────
// Android adaptive icons need the subject centered with ~20% safe zone on each side
const adaptiveSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024"
     xmlns="http://www.w3.org/2000/svg">

  <!-- Solid background (adaptive icon bg is set separately in app.json) -->
  <rect width="1024" height="1024" fill="${NAVY}"/>

  ${bookSvg({
    cx: 512, cy: 300,
    bw: 210, bh: 424,
    moonCx: 780, moonCy: 210, moonR: 36,
  })}

  <!-- Stars -->
  <circle cx="620" cy="170" r="4"   fill="${ROSE}"      opacity="0.70"/>
  <circle cx="700" cy="148" r="3"   fill="${ROSE_SOFT}" opacity="0.60"/>
  <circle cx="320" cy="210" r="3.5" fill="${ROSE_SOFT}" opacity="0.50"/>
  <circle cx="830" cy="280" r="2.5" fill="${ROSE_SOFT}" opacity="0.40"/>
</svg>`;

// ─── Generate ─────────────────────────────────────────────────────────────────
console.log("\nGenerating ReadScape assets…\n");

write("icon.png",          svgToPng(iconSvg));
write("splash.png",        svgToPng(splashSvg));
write("adaptive-icon.png", svgToPng(adaptiveSvg));

console.log("\nAll assets written to assets/");

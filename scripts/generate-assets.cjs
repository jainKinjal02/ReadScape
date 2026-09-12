// ReadScape — Asset Generator
// Produces icon.png, adaptive-icon.png, splash.png, favicon.png using resvg-js
// Run: node scripts/generate-assets.cjs

const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "assets");
const FONTS = path.join(__dirname, "..", "node_modules", "@expo-google-fonts");

// ─── Palette ─────────────────────────────────────────────────────────────────
// Mirrors src/design/tokens.ts. The app contributes paper, ink and one
// highlighter; the covers supply every other colour. The artwork follows the
// same rule, which is why there is no scene here — no night sky, no moon.
const PAPER      = "#FBFAF6";
const PAPER_WARM = "#F4F0E8";  // gradient partner, very slightly warmer
const INK        = "#1B1A22";
const PENCIL     = "#7C7986";
const RULE       = "#E9E5DB";
const MARK       = "#FFE83D";  // highlighter yellow
const BLUSH      = "#FF9EC4";
const PAGE       = "#FFFFFF";
const PAGE_DIM   = "#F6F3EC";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fontFiles = [
  path.join(FONTS, "fraunces", "600SemiBold", "Fraunces_600SemiBold.ttf"),
  path.join(FONTS, "archivo", "400Regular", "Archivo_400Regular.ttf"),
].filter((f) => fs.existsSync(f));

function svgToPng(svgStr) {
  const resvg = new Resvg(svgStr, {
    shapeRendering: 2,
    textRendering: 2,
    imageRendering: 1,
    // Use the app's real typefaces so the splash wordmark matches the UI
    // exactly rather than approximating it with a system serif.
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Fraunces" },
  });
  return Buffer.from(resvg.render().asPng());
}

function write(filename, buf) {
  const dest = path.join(ASSETS, filename);
  fs.writeFileSync(dest, buf);
  console.log(`  ✓  ${filename}  (${Math.round(buf.length / 1024)} KB)`);
}

// ─── Book Component SVG template ─────────────────────────────────────────────
// cx,cy = centre of the book spine-top; bw = half-width of a page; bh = height.
//
// On the old navy ground the book read by being pale against dark. On paper it
// has to read by outline instead, so the pages carry a heavy ink stroke — that
// is what keeps the shape legible at 60px on a home screen.
function bookSvg({ cx, cy, bw, bh }) {
  const topY = cy;
  const botY = cy + bh;
  const leftEdgeX = cx - bw;
  const rightEdgeX = cx + bw;
  const topCurveOff = bh * 0.08;
  const botCurveOff = bh * 0.05;
  const stroke = Math.max(4, bw * 0.045);

  // Page rules. One of them is highlighted — the single yellow mark is the
  // whole idea of the app (you keep the lines that moved you), so it is the
  // only accent the icon gets.
  const lineCount = 8;
  const lineStart = topY + bh * 0.15;
  const lineEnd = botY - bh * 0.12;
  const lineStep = (lineEnd - lineStart) / (lineCount - 1);
  const HIGHLIGHT_INDEX = 3;

  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    const y = lineStart + i * lineStep;
    const full = i < lineCount - 2;
    const leftX1 = leftEdgeX + bw * 0.14;
    const leftX2 = full ? cx - bw * 0.1 : leftEdgeX + bw * 0.55;
    const rightX1 = cx + bw * 0.1;
    const rightX2 = full ? rightEdgeX - bw * 0.14 : rightEdgeX - bw * 0.42;
    const w = Math.max(3, bw * 0.022);

    if (i === HIGHLIGHT_INDEX) {
      lines.push(`
      <rect x="${rightX1}" y="${y - bw * 0.055}"
            width="${rightX2 - rightX1}" height="${bw * 0.11}"
            fill="${MARK}" rx="${bw * 0.012}"/>
      <line x1="${leftX1}" y1="${y}" x2="${leftX2}" y2="${y}"
            stroke="${PENCIL}" stroke-width="${w}" stroke-linecap="round" opacity="0.55"/>`);
    } else {
      lines.push(`
      <line x1="${leftX1}" y1="${y}" x2="${leftX2}" y2="${y}"
            stroke="${PENCIL}" stroke-width="${w}" stroke-linecap="round" opacity="0.45"/>
      <line x1="${rightX1}" y1="${y}" x2="${rightX2}" y2="${y}"
            stroke="${PENCIL}" stroke-width="${w}" stroke-linecap="round" opacity="0.45"/>`);
    }
  }

  // Anchor the ribbon nearer the spine and just below the spine top. Placed
  // out by the fore-edge it floated in mid-air, because the page top curves
  // steeply down from cx and is well below topY by the time it gets there.
  const bkW = bw * 0.11;
  const bkX = cx + bw * 0.42;
  const bkTop = topY + bh * 0.055;
  const bkH = bh * 0.3;

  const leftPage = `M ${cx},${topY}
             C ${cx - bw * 0.25},${topY + topCurveOff}
               ${leftEdgeX - bw * 0.03},${topY + bh * 0.12}
               ${leftEdgeX},${topY + bh * 0.22}
             L ${leftEdgeX},${botY - bh * 0.18}
             C ${leftEdgeX - bw * 0.03},${botY - bh * 0.08}
               ${cx - bw * 0.25},${botY - botCurveOff}
               ${cx},${botY} Z`;

  const rightPage = `M ${cx},${topY}
             C ${cx + bw * 0.25},${topY + topCurveOff}
               ${rightEdgeX + bw * 0.03},${topY + bh * 0.12}
               ${rightEdgeX},${topY + bh * 0.22}
             L ${rightEdgeX},${botY - bh * 0.18}
             C ${rightEdgeX + bw * 0.03},${botY - bh * 0.08}
               ${cx + bw * 0.25},${botY - botCurveOff}
               ${cx},${botY} Z`;

  return `
    <defs>
      <linearGradient id="bg_g" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stop-color="${PAPER}"/>
        <stop offset="100%" stop-color="${PAPER_WARM}"/>
      </linearGradient>
      <linearGradient id="lp_g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${PAGE}"/>
        <stop offset="100%" stop-color="${PAGE_DIM}"/>
      </linearGradient>
      <linearGradient id="rp_g" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${PAGE}"/>
        <stop offset="100%" stop-color="${PAGE_DIM}"/>
      </linearGradient>
    </defs>

    <!-- Ground shadow: soft, warm, low. Paper does not throw hard shadows. -->
    <ellipse cx="${cx + bw * 0.02}" cy="${botY + bh * 0.035}"
             rx="${bw * 0.8}" ry="${bh * 0.035}"
             fill="${INK}" opacity="0.10"/>

    <path d="${leftPage}"  fill="url(#lp_g)" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="${rightPage}" fill="url(#rp_g)" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>

    <!-- Text lines -->
    ${lines.join("")}

    <!-- Spine -->
    <line x1="${cx}" y1="${topY}" x2="${cx}" y2="${botY}"
          stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round"/>

    <!-- Bookmark ribbon — the blush accent -->
    <path d="M ${bkX},${bkTop} L ${bkX + bkW},${bkTop}
             L ${bkX + bkW},${bkTop + bkH}
             L ${bkX + bkW / 2},${bkTop + bkH - bkW * 0.6}
             L ${bkX},${bkTop + bkH} Z"
          fill="${BLUSH}" stroke="${INK}" stroke-width="${stroke * 0.55}" stroke-linejoin="round"/>
  `;
}

// ─── ICON (1024 × 1024) ──────────────────────────────────────────────────────
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${PAPER}"/>
  ${bookSvg({ cx: 512, cy: 232, bw: 312, bh: 560 })}
  <rect width="1024" height="1024" fill="url(#bg_g)" opacity="0"/>
</svg>`;

// ─── SPLASH (1284 × 2778) ────────────────────────────────────────────────────
const splashSvg = `
<svg width="1284" height="2778" viewBox="0 0 1284 2778" xmlns="http://www.w3.org/2000/svg">
  <rect width="1284" height="2778" fill="${PAPER}"/>
  <rect width="1284" height="2778" fill="url(#bg_g)"/>

  ${bookSvg({ cx: 642, cy: 900, bw: 300, bh: 570 })}

  <text x="642" y="1660" font-family="Fraunces" font-size="112" font-weight="600"
        fill="${INK}" text-anchor="middle" letter-spacing="-1">ReadScape</text>

  <text x="642" y="1742" font-family="Archivo" font-size="36"
        fill="${PENCIL}" text-anchor="middle" letter-spacing="2">Your reading journey</text>

</svg>`;

// ─── ADAPTIVE ICON (1024 × 1024, ~20% safe zone each side) ───────────────────
const adaptiveSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${PAPER}"/>
  ${bookSvg({ cx: 512, cy: 300, bw: 228, bh: 424 })}
</svg>`;

// ─── FAVICON (64 × 64) ───────────────────────────────────────────────────────
// Detail vanishes at this size, so only the book silhouette and the mark survive.
const faviconSvg = `
<svg width="64" height="64" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${PAPER}"/>
  ${bookSvg({ cx: 512, cy: 300, bw: 270, bh: 480 })}
</svg>`;

// ─── Generate ────────────────────────────────────────────────────────────────
console.log("\nGenerating ReadScape assets…\n");
if (fontFiles.length < 2) {
  console.warn("  !  Fraunces/Archivo not found in node_modules — falling back to system fonts\n");
}

write("icon.png",          svgToPng(iconSvg));
write("splash.png",        svgToPng(splashSvg));
write("adaptive-icon.png", svgToPng(adaptiveSvg));
write("favicon.png",       svgToPng(faviconSvg));

console.log("\nAll assets written to assets/\n");

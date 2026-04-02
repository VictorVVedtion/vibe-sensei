#!/usr/bin/env node

/**
 * generate-icons.js
 *
 * Converts the octopus SVG icon to PNG at multiple sizes using sharp.
 * Outputs:
 *   - icon.png        (512x512)   — standard app icon
 *   - icon-1024.png   (1024x1024) — macOS high-res icon
 *   - tray-icon.png   (32x32)     — system tray icon
 *   - tray-icon@2x.png (64x64)   — Retina tray icon
 */

import sharp from "sharp";
import { readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = __dirname;

// Full icon SVG (with tentacles)
const FULL_SVG = readFileSync(join(ASSETS_DIR, "icon.svg"), "utf-8");

// Simplified tray SVG — head + headband + eyes only, optimized for tiny sizes.
// Thicker strokes, larger features, no subtle filters.
const TRAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bodyGlow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#126E8A" />
      <stop offset="100%" stop-color="#0E4D64" />
    </radialGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="#0A1628" />

  <!-- Octopus mantle — larger, fills more of the circle -->
  <ellipse cx="256" cy="240" rx="175" ry="160" fill="url(#bodyGlow)" />

  <!-- Hachimaki headband — thicker for visibility -->
  <rect x="81" y="190" width="350" height="30" rx="6" fill="#00D4FF" opacity="0.95" />
  <!-- Headband knot tails -->
  <path d="M431,190 Q460,170 470,158" stroke="#00D4FF" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.75" />
  <path d="M431,220 Q465,222 478,208" stroke="#00D4FF" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.55" />

  <!-- Eyes — larger for small size readability -->
  <circle cx="200" cy="280" r="28" fill="#00D4FF" />
  <circle cx="312" cy="280" r="28" fill="#00D4FF" />
  <!-- Pupils -->
  <circle cx="206" cy="276" r="12" fill="#0A1628" />
  <circle cx="318" cy="276" r="12" fill="#0A1628" />
  <!-- Highlights -->
  <circle cx="194" cy="270" r="5" fill="#FFFFFF" opacity="0.8" />
  <circle cx="306" cy="270" r="5" fill="#FFFFFF" opacity="0.8" />

  <!-- Small tentacle hints at bottom -->
  <path d="M150,370 Q130,410 115,440" stroke="#0E4D64" stroke-width="22" fill="none" stroke-linecap="round" />
  <path d="M220,385 Q210,420 200,450" stroke="#0E4D64" stroke-width="20" fill="none" stroke-linecap="round" />
  <path d="M292,385 Q302,420 312,450" stroke="#0E4D64" stroke-width="20" fill="none" stroke-linecap="round" />
  <path d="M362,370 Q382,410 397,440" stroke="#0E4D64" stroke-width="22" fill="none" stroke-linecap="round" />
</svg>`;

async function generateIcons() {
  const targets = [
    { name: "icon-1024.png", size: 1024, svg: FULL_SVG },
    { name: "icon.png", size: 512, svg: FULL_SVG },
    { name: "tray-icon@2x.png", size: 64, svg: TRAY_SVG },
    { name: "tray-icon.png", size: 32, svg: TRAY_SVG },
  ];

  for (const target of targets) {
    const outPath = join(ASSETS_DIR, target.name);
    await sharp(Buffer.from(target.svg))
      .resize(target.size, target.size)
      .png()
      .toFile(outPath);
    const stats = statSync(outPath);
    console.log(
      `  ${target.name.padEnd(20)} ${target.size}x${target.size}  (${(stats.size / 1024).toFixed(1)} KB)`
    );
  }

  console.log("\nAll icons generated successfully.");
}

generateIcons().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});

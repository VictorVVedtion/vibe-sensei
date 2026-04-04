#!/usr/bin/env node

/**
 * generate-icons.js
 *
 * Converts the octopus SVG icon to PNG at multiple sizes using sharp.
 * Matches Claude Code icon format:
 *   - icon-1024.png          (1024x1024) — macOS high-res
 *   - icon.png               (512x512)   — standard app icon
 *   - TrayIconTemplate.png   (24x24)     — system tray
 *   - TrayIconTemplate@2x.png (48x48)   — Retina tray
 *   - TrayIconTemplate@3x.png (72x72)   — 3x tray
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

// Simplified tray SVG — silhouette + headband + eyes + thick tentacle stubs.
// Optimized for 24-72px: bold shapes, no subtle filters, high contrast.
const TRAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bodyG" cx="40%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#1A8FAD" />
      <stop offset="60%" stop-color="#0E5A74" />
      <stop offset="100%" stop-color="#07384A" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <circle cx="256" cy="256" r="248" fill="#0C1018" />

  <!-- Body — organic dome, single path -->
  <path d="M256,88 C330,88 400,125 420,185
           C435,230 432,275 415,305
           C395,340 355,358 310,352
           L256,356 L202,352
           C157,358 117,340 97,305
           C80,275 77,230 92,185
           C112,125 182,88 256,88 Z"
        fill="url(#bodyG)" />

  <!-- Headband — thick, high contrast -->
  <path d="M88,192 C130,210 195,218 256,218
           C317,218 382,210 424,192
           L428,212 C386,232 318,240 256,240
           C194,240 126,232 84,212 Z"
        fill="#00FF41" opacity="0.95" />
  <!-- Knot tail hint -->
  <path d="M432,198 Q452,178 455,162" stroke="#00FF41" stroke-width="16" fill="none"
        stroke-linecap="round" opacity="0.7" />

  <!-- Eyes — large, bold for tiny sizes -->
  <ellipse cx="205" cy="270" rx="26" ry="18" fill="#00FF41" />
  <ellipse cx="307" cy="270" rx="26" ry="18" fill="#00FF41" />
  <!-- Slit pupils -->
  <ellipse cx="208" cy="270" rx="7" ry="16" fill="#0C1018" />
  <ellipse cx="310" cy="270" rx="7" ry="16" fill="#0C1018" />
  <!-- Highlights -->
  <circle cx="198" cy="264" r="5" fill="#FFFFFF" opacity="0.85" />
  <circle cx="300" cy="264" r="5" fill="#FFFFFF" opacity="0.85" />

  <!-- Tentacle stubs — 4 thick, with green tips -->
  <path d="M145,340 C125,385 100,430 90,460
           Q85,475 95,472 Q108,465 125,435 C145,395 158,360 155,345 Z"
        fill="#0A4A5E" />
  <path d="M210,352 C200,395 185,435 178,460
           Q174,475 184,472 Q196,465 205,435 C215,400 222,368 218,354 Z"
        fill="#0A4A5E" />
  <path d="M302,352 C312,395 327,435 334,460
           Q338,475 328,472 Q316,465 307,435 C297,400 290,368 294,354 Z"
        fill="#0A4A5E" />
  <path d="M367,340 C387,385 412,430 422,460
           Q427,475 417,472 Q404,465 387,435 C367,395 354,360 357,345 Z"
        fill="#0A4A5E" />

  <!-- Green tips — bold -->
  <circle cx="92" cy="466" r="12" fill="#00FF41" opacity="0.6" />
  <circle cx="180" cy="468" r="11" fill="#00FF41" opacity="0.55" />
  <circle cx="332" cy="468" r="11" fill="#00FF41" opacity="0.55" />
  <circle cx="420" cy="466" r="12" fill="#00FF41" opacity="0.6" />
</svg>`;

async function generateIcons() {
  const targets = [
    // App icons
    { name: "icon-1024.png", size: 1024, svg: FULL_SVG },
    { name: "icon.png", size: 512, svg: FULL_SVG },
    // Tray icons — Claude Code format: 24/48/72
    { name: "TrayIconTemplate.png", size: 24, svg: TRAY_SVG },
    { name: "TrayIconTemplate@2x.png", size: 48, svg: TRAY_SVG },
    { name: "TrayIconTemplate@3x.png", size: 72, svg: TRAY_SVG },
  ];

  for (const target of targets) {
    const outPath = join(ASSETS_DIR, target.name);
    await sharp(Buffer.from(target.svg))
      .resize(target.size, target.size)
      .png()
      .toFile(outPath);
    const stats = statSync(outPath);
    console.log(
      `  ${target.name.padEnd(28)} ${String(target.size).padStart(4)}x${target.size}  (${(stats.size / 1024).toFixed(1)} KB)`
    );
  }

  console.log("\nAll icons generated successfully.");
}

generateIcons().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});

/**
 * Generates LifeMap achievement badge PNGs (512×512) via SVG → sharp.
 * Run: node scripts/generate-achievement-badges.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../assets/achievements');

const BG = '#F7F3EC';
const TEAL = '#2A9D8F';
const TEAL_DEEP = '#1D6F66';
const WARM = '#E9C46A';
const CORAL = '#E76F51';
const INK = '#2B2A28';
const SKY = '#8ECAE6';
const MOON = '#F4F1DE';

function svg(inner, bg = BG) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${bg}"/>
  <circle cx="256" cy="256" r="200" fill="#fff" opacity="0.55"/>
  ${inner}
</svg>`;
}

function road(scale = 1) {
  const w = 48 * scale;
  return `
  <path d="M256 420 L200 120 L240 120 L280 120 L312 420 Z" fill="${INK}" opacity="0.12"/>
  <path d="M256 400 L220 140 L256 140 L292 140 Z" fill="${TEAL}"/>
  <rect x="${256 - w / 6}" y="160" width="${w / 3}" height="28" rx="4" fill="${WARM}"/>
  <rect x="${256 - w / 6}" y="220" width="${w / 3}" height="28" rx="4" fill="${WARM}"/>
  <rect x="${256 - w / 6}" y="280" width="${w / 3}" height="28" rx="4" fill="${WARM}"/>
  <rect x="${256 - w / 6}" y="340" width="${w / 3}" height="28" rx="4" fill="${WARM}"/>
  `;
}

function pin(cx, cy, color = CORAL, s = 1) {
  return `
  <path d="M${cx} ${cy + 28 * s} C${cx} ${cy + 28 * s} ${cx - 28 * s} ${cy - 8 * s} ${cx - 28 * s} ${cy - 28 * s}
    A${28 * s} ${28 * s} 0 1 1 ${cx + 28 * s} ${cy - 28 * s}
    C${cx + 28 * s} ${cy - 8 * s} ${cx} ${cy + 28 * s} ${cx} ${cy + 28 * s} Z" fill="${color}"/>
  <circle cx="${cx}" cy="${cy - 28 * s}" r="${10 * s}" fill="#fff"/>
  `;
}

function car() {
  return `
  <rect x="190" y="250" width="130" height="48" rx="14" fill="${TEAL_DEEP}"/>
  <rect x="210" y="230" width="90" height="30" rx="10" fill="${TEAL}"/>
  <circle cx="220" cy="300" r="14" fill="${INK}"/>
  <circle cx="290" cy="300" r="14" fill="${INK}"/>
  <circle cx="220" cy="300" r="6" fill="#fff"/>
  <circle cx="290" cy="300" r="6" fill="#fff"/>
  `;
}

const BADGES = {
  travel_10: svg(`${road(0.7)}${car()}`),
  travel_50: svg(`${road(0.85)}
    <circle cx="140" cy="160" r="18" fill="${SKY}"/>
    ${car()}`),
  travel_100: svg(`${road(1)}
    <path d="M80 200 Q160 120 240 180" stroke="${TEAL}" stroke-width="10" fill="none" stroke-linecap="round"/>
    ${car()}`),
  travel_250: svg(`
    <path d="M60 340 H452" stroke="${INK}" stroke-width="18" opacity="0.15"/>
    <path d="M60 340 H452" stroke="${TEAL}" stroke-width="10"/>
    <rect x="120" y="300" width="40" height="20" rx="4" fill="${WARM}"/>
    <rect x="240" y="300" width="40" height="20" rx="4" fill="${WARM}"/>
    <rect x="360" y="300" width="40" height="20" rx="4" fill="${WARM}"/>
    ${pin(400, 250, CORAL, 0.85)}
  `),
  travel_500: svg(`
    <ellipse cx="256" cy="300" rx="160" ry="40" fill="${TEAL}" opacity="0.2"/>
    <path d="M90 280 Q180 200 256 260 Q330 320 420 240" stroke="${TEAL_DEEP}" stroke-width="14" fill="none" stroke-linecap="round"/>
    ${pin(180, 210)}${pin(330, 280, TEAL)}
  `),
  travel_1000: svg(`
    <circle cx="256" cy="250" r="110" fill="none" stroke="${TEAL}" stroke-width="16"/>
    <path d="M160 250 A96 96 0 0 1 352 250" stroke="${CORAL}" stroke-width="10" fill="none"/>
    <text x="256" y="270" text-anchor="middle" font-size="64" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">1K</text>
  `),
  travel_2500: svg(`
    <path d="M80 340 L160 200 L220 280 L300 140 L380 260 L440 180 L440 360 L80 360 Z" fill="${TEAL}" opacity="0.35"/>
    <path d="M80 340 L160 200 L220 280 L300 140 L380 260 L440 180" stroke="${TEAL_DEEP}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  travel_5000: svg(`
    <rect x="96" y="140" width="320" height="220" rx="24" fill="${TEAL}" opacity="0.15"/>
    <path d="M120 300 Q200 180 280 260 Q340 320 400 200" stroke="${CORAL}" stroke-width="10" fill="none"/>
    ${pin(200, 200)}${pin(360, 220, TEAL)}${pin(280, 300, WARM, 0.8)}
  `),
  travel_10000: svg(`
    <circle cx="256" cy="256" r="130" fill="${SKY}" opacity="0.45"/>
    <ellipse cx="256" cy="256" rx="130" ry="48" fill="none" stroke="${TEAL_DEEP}" stroke-width="8"/>
    <ellipse cx="256" cy="256" rx="48" ry="130" fill="none" stroke="${TEAL}" stroke-width="8"/>
    <circle cx="256" cy="256" r="130" fill="none" stroke="${INK}" stroke-width="6" opacity="0.35"/>
    <path d="M140 300 Q220 180 320 240 Q380 280 400 200" stroke="${CORAL}" stroke-width="8" fill="none"/>
  `),
  travel_25000: svg(`
    <circle cx="256" cy="256" r="140" fill="${TEAL}" opacity="0.25"/>
    <circle cx="256" cy="256" r="140" fill="none" stroke="${TEAL_DEEP}" stroke-width="10"/>
    <path d="M130 280 Q200 160 280 220 Q340 260 390 170" stroke="${WARM}" stroke-width="10" fill="none"/>
    <path d="M150 200 Q230 320 340 280 Q400 250 380 330" stroke="${CORAL}" stroke-width="8" fill="none"/>
    <circle cx="256" cy="256" r="18" fill="${CORAL}"/>
  `),

  places_5: svg(`${pin(256, 280)}`),
  places_10: svg(`${pin(210, 270)}${pin(300, 250, TEAL, 0.9)}`),
  places_25: svg(`
    <rect x="140" y="160" width="230" height="180" rx="16" fill="${TEAL}" opacity="0.2"/>
    ${pin(200, 250)}${pin(280, 220, TEAL)}${pin(320, 300, WARM, 0.85)}
  `),
  places_50: svg(`
    <path d="M150 160 L360 160 L340 360 L170 360 Z" fill="${WARM}" opacity="0.35"/>
    <path d="M170 180 L340 180 L325 340 L185 340 Z" fill="#fff" opacity="0.7"/>
    ${pin(220, 260)}${pin(300, 240, TEAL)}${pin(260, 300, CORAL, 0.75)}
  `),
  places_100: svg(`
    ${[0, 1, 2, 3, 4, 5].map((i) => pin(170 + (i % 3) * 70, 210 + Math.floor(i / 3) * 80, i % 2 ? TEAL : CORAL, 0.7)).join('')}
  `),
  places_250: svg(`
    <ellipse cx="256" cy="270" rx="150" ry="100" fill="${TEAL}" opacity="0.15"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2;
      return pin(256 + Math.cos(a) * 90, 270 + Math.sin(a) * 60, i % 2 ? TEAL : CORAL, 0.55);
    }).join('')}
    ${pin(256, 270, WARM, 0.8)}
  `),
  places_500: svg(`
    <rect x="120" y="130" width="272" height="252" rx="12" fill="${TEAL_DEEP}"/>
    <rect x="136" y="146" width="240" height="220" rx="8" fill="${BG}"/>
    <path d="M160 200 H360 M160 250 H360 M160 300 H360" stroke="${TEAL}" stroke-width="4" opacity="0.5"/>
    ${pin(220, 230, CORAL, 0.55)}${pin(300, 280, TEAL, 0.55)}${pin(260, 320, WARM, 0.5)}
  `),

  cat_cafe: svg(`
    <ellipse cx="256" cy="340" rx="70" ry="18" fill="${INK}" opacity="0.12"/>
    <path d="M190 200 h132 a20 20 0 0 1 20 20 v80 h-172 v-80 a20 20 0 0 1 20-20 z" fill="${TEAL}"/>
    <ellipse cx="256" cy="200" rx="66" ry="14" fill="${TEAL_DEEP}"/>
    <path d="M320 240 c40 0 50 40 20 55" stroke="${TEAL_DEEP}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <ellipse cx="256" cy="250" rx="40" ry="12" fill="${WARM}" opacity="0.8"/>
  `),
  cat_restaurant: svg(`
    <circle cx="256" cy="260" r="100" fill="#fff" stroke="${TEAL}" stroke-width="12"/>
    <path d="M200 220 v80 M220 200 v100 M236 220 v80" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <path d="M290 200 c30 20 30 80 0 100" stroke="${CORAL}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <line x1="290" y1="200" x2="290" y2="300" stroke="${CORAL}" stroke-width="10" stroke-linecap="round"/>
  `),
  cat_bakery: svg(`
    <path d="M160 300 Q200 180 256 220 Q312 180 352 300 Z" fill="${WARM}"/>
    <path d="M180 290 Q220 210 256 240 Q292 210 332 290" stroke="${CORAL}" stroke-width="8" fill="none"/>
    <circle cx="220" cy="250" r="8" fill="${CORAL}"/>
    <circle cx="256" cy="235" r="8" fill="${CORAL}"/>
    <circle cx="292" cy="250" r="8" fill="${CORAL}"/>
  `),
  cat_park: svg(`
    <rect x="248" y="280" width="16" height="80" fill="${INK}" opacity="0.45"/>
    <circle cx="220" cy="230" r="50" fill="${TEAL}"/>
    <circle cx="290" cy="210" r="55" fill="${TEAL_DEEP}"/>
    <circle cx="256" cy="250" r="45" fill="${TEAL}" opacity="0.9"/>
  `),
  cat_beach: svg(`
    <ellipse cx="256" cy="360" rx="160" ry="30" fill="${WARM}" opacity="0.6"/>
    <path d="M80 300 Q160 260 240 300 Q320 340 420 280" stroke="${SKY}" stroke-width="28" fill="none" opacity="0.7"/>
    <line x1="300" y1="160" x2="300" y2="300" stroke="${INK}" stroke-width="8"/>
    <path d="M300 160 L380 220 L300 220 Z" fill="${CORAL}"/>
  `),
  cat_airport: svg(`
    <path d="M256 120 L280 240 L400 260 L280 280 L256 400 L232 280 L110 260 L232 240 Z" fill="${TEAL_DEEP}"/>
    <circle cx="256" cy="260" r="16" fill="${WARM}"/>
  `),
  cat_hotel: svg(`
    <rect x="150" y="180" width="212" height="180" rx="16" fill="${TEAL}"/>
    <rect x="170" y="200" width="50" height="40" rx="6" fill="${WARM}"/>
    <rect x="231" y="200" width="50" height="40" rx="6" fill="${WARM}"/>
    <rect x="292" y="200" width="50" height="40" rx="6" fill="${WARM}"/>
    <rect x="170" y="260" width="50" height="40" rx="6" fill="${WARM}"/>
    <rect x="231" y="260" width="50" height="40" rx="6" fill="${WARM}"/>
    <rect x="292" y="260" width="50" height="40" rx="6" fill="${SKY}"/>
    <rect x="230" y="310" width="52" height="50" rx="6" fill="${TEAL_DEEP}"/>
  `),
  cat_gym: svg(`
    <rect x="120" y="230" width="50" height="50" rx="10" fill="${INK}"/>
    <rect x="342" y="230" width="50" height="50" rx="10" fill="${INK}"/>
    <rect x="170" y="245" width="172" height="20" rx="8" fill="${TEAL}"/>
    <rect x="230" y="220" width="52" height="70" rx="12" fill="${TEAL_DEEP}"/>
  `),
  cat_store: svg(`
    <path d="M160 220 L256 150 L352 220 V360 H160 Z" fill="${TEAL}"/>
    <rect x="220" y="280" width="72" height="80" rx="8" fill="${WARM}"/>
    <circle cx="280" cy="320" r="6" fill="${INK}"/>
    <rect x="180" y="240" width="40" height="36" rx="4" fill="${SKY}"/>
    <rect x="292" y="240" width="40" height="36" rx="4" fill="${SKY}"/>
  `),
  cat_gas: svg(`
    <rect x="160" y="160" width="120" height="220" rx="16" fill="${TEAL_DEEP}"/>
    <rect x="180" y="190" width="80" height="60" rx="8" fill="${SKY}"/>
    <rect x="200" y="280" width="40" height="70" rx="6" fill="${WARM}"/>
    <path d="M280 200 H340 V320" stroke="${INK}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="340" cy="330" r="16" fill="${CORAL}"/>
  `),
  cat_hospital: svg(`
    <rect x="150" y="150" width="212" height="212" rx="28" fill="${TEAL}" opacity="0.2"/>
    <rect x="230" y="170" width="52" height="172" rx="12" fill="${CORAL}"/>
    <rect x="170" y="230" width="172" height="52" rx="12" fill="${CORAL}"/>
  `),
  cat_library: svg(`
    <rect x="140" y="180" width="48" height="160" rx="6" fill="${TEAL}"/>
    <rect x="198" y="160" width="48" height="180" rx="6" fill="${TEAL_DEEP}"/>
    <rect x="256" y="190" width="48" height="150" rx="6" fill="${WARM}"/>
    <rect x="314" y="170" width="48" height="170" rx="6" fill="${CORAL}"/>
  `),

  days_7: svg(`
    <rect x="140" y="140" width="232" height="232" rx="28" fill="${TEAL}" opacity="0.2"/>
    <rect x="140" y="140" width="232" height="56" rx="28" fill="${TEAL}"/>
    <text x="256" y="290" text-anchor="middle" font-size="96" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">7</text>
  `),
  days_30: svg(`
    <rect x="140" y="140" width="232" height="232" rx="28" fill="${TEAL}" opacity="0.2"/>
    <rect x="140" y="140" width="232" height="56" rx="28" fill="${TEAL_DEEP}"/>
    <text x="256" y="290" text-anchor="middle" font-size="72" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">30</text>
  `),
  days_100: svg(`
    <circle cx="256" cy="256" r="130" fill="${WARM}" opacity="0.35"/>
    <text x="256" y="280" text-anchor="middle" font-size="72" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">100</text>
  `),
  days_365: svg(`
    <circle cx="256" cy="256" r="130" fill="${TEAL}" opacity="0.25"/>
    <circle cx="256" cy="256" r="90" fill="none" stroke="${CORAL}" stroke-width="12"/>
    <text x="256" y="275" text-anchor="middle" font-size="56" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">365</text>
  `),
  nights_1: svg(`
    <circle cx="300" cy="200" r="70" fill="${MOON}"/>
    <circle cx="330" cy="180" r="55" fill="${BG}"/>
    <rect x="120" y="300" width="80" height="70" fill="${TEAL_DEEP}"/>
    <polygon points="120,300 160,260 200,300" fill="${CORAL}"/>
    <rect x="220" y="280" width="100" height="90" fill="${TEAL}"/>
    <polygon points="220,280 270,230 320,280" fill="${WARM}"/>
  `),

  moments_1: svg(`
    <rect x="170" y="170" width="170" height="190" rx="12" fill="#fff" stroke="${TEAL}" stroke-width="8"/>
    <rect x="190" y="190" width="130" height="110" rx="8" fill="${SKY}"/>
    <circle cx="230" cy="230" r="14" fill="${WARM}"/>
  `),
  moments_10: svg(`
    <rect x="150" y="190" width="140" height="160" rx="10" fill="${TEAL}" opacity="0.35" transform="rotate(-8 220 270)"/>
    <rect x="200" y="170" width="160" height="180" rx="10" fill="#fff" stroke="${TEAL_DEEP}" stroke-width="8"/>
    <rect x="220" y="190" width="120" height="100" rx="6" fill="${CORAL}" opacity="0.5"/>
  `),
  moments_25: svg(`
    <rect x="140" y="200" width="130" height="150" rx="8" fill="${WARM}" opacity="0.5" transform="rotate(-12 205 275)"/>
    <rect x="180" y="180" width="140" height="160" rx="8" fill="${TEAL}" opacity="0.4" transform="rotate(6 250 260)"/>
    <rect x="220" y="160" width="150" height="170" rx="10" fill="#fff" stroke="${CORAL}" stroke-width="8"/>
  `),
  moments_50: svg(`
    <rect x="130" y="160" width="252" height="200" rx="16" fill="${TEAL}" opacity="0.2"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${160 + i * 18}" y="${180 + i * 12}" width="140" height="150" rx="8" fill="#fff" stroke="${i % 2 ? TEAL : CORAL}" stroke-width="6"/>`).join('')}
  `),
  moments_100: svg(`
    <circle cx="256" cy="256" r="120" fill="${TEAL}" opacity="0.2"/>
    <text x="256" y="275" text-anchor="middle" font-size="64" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">100</text>
    <rect x="200" y="140" width="40" height="40" rx="6" fill="${CORAL}" opacity="0.7"/>
    <rect x="280" y="330" width="40" height="40" rx="6" fill="${WARM}" opacity="0.7"/>
  `),
  moments_250: svg(`
    <rect x="120" y="140" width="272" height="232" rx="20" fill="${TEAL_DEEP}"/>
    <rect x="140" y="160" width="100" height="90" rx="8" fill="${SKY}"/>
    <rect x="256" y="160" width="100" height="90" rx="8" fill="${WARM}"/>
    <rect x="140" y="268" width="100" height="90" rx="8" fill="${CORAL}" opacity="0.7"/>
    <rect x="256" y="268" width="100" height="90" rx="8" fill="${TEAL}"/>
  `),

  moment_photo_1: svg(`
    <rect x="140" y="180" width="232" height="170" rx="24" fill="${TEAL_DEEP}"/>
    <circle cx="256" cy="265" r="48" fill="${TEAL}" opacity="0.5"/>
    <circle cx="256" cy="265" r="28" fill="${SKY}"/>
    <rect x="300" y="200" width="40" height="24" rx="6" fill="${WARM}"/>
  `),
  moment_video_1: svg(`
    <rect x="130" y="180" width="200" height="150" rx="16" fill="${TEAL}"/>
    <polygon points="360,200 420,255 360,310" fill="${CORAL}"/>
    <polygon points="200,220 200,290 260,255" fill="#fff"/>
  `),
  moment_note_1: svg(`
    <rect x="160" y="140" width="192" height="240" rx="12" fill="#fff" stroke="${TEAL}" stroke-width="10"/>
    <line x1="190" y1="200" x2="320" y2="200" stroke="${INK}" stroke-width="8" opacity="0.35"/>
    <line x1="190" y1="240" x2="320" y2="240" stroke="${INK}" stroke-width="8" opacity="0.35"/>
    <line x1="190" y1="280" x2="280" y2="280" stroke="${INK}" stroke-width="8" opacity="0.35"/>
  `),
  moment_voice_1: svg(`
    <rect x="230" y="160" width="52" height="120" rx="26" fill="${TEAL}"/>
    <path d="M190 240 a66 66 0 0 0 132 0" stroke="${TEAL_DEEP}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <line x1="256" y1="306" x2="256" y2="360" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    <line x1="220" y1="360" x2="292" y2="360" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  `),
  moment_mood_1: svg(`
    <circle cx="256" cy="256" r="110" fill="${WARM}"/>
    <circle cx="220" cy="230" r="14" fill="${INK}"/>
    <circle cx="292" cy="230" r="14" fill="${INK}"/>
    <path d="M200 290 Q256 340 312 290" stroke="${INK}" stroke-width="12" fill="none" stroke-linecap="round"/>
  `),
  moment_activity_1: svg(`
    <rect x="150" y="150" width="212" height="212" rx="28" fill="${TEAL}" opacity="0.2"/>
    <path d="M190 260 L235 305 L340 200" stroke="${TEAL_DEEP}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  activities_10: svg(`
    <circle cx="256" cy="256" r="110" fill="none" stroke="${TEAL}" stroke-width="18" opacity="0.3"/>
    <circle cx="256" cy="256" r="110" fill="none" stroke="${TEAL_DEEP}" stroke-width="18" stroke-dasharray="200 500" stroke-linecap="round" transform="rotate(-90 256 256)"/>
    <text x="256" y="275" text-anchor="middle" font-size="64" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">10</text>
  `),
  activities_50: svg(`
    <circle cx="256" cy="256" r="110" fill="none" stroke="${TEAL}" stroke-width="18" opacity="0.3"/>
    <circle cx="256" cy="256" r="110" fill="none" stroke="${CORAL}" stroke-width="18" stroke-dasharray="500 200" stroke-linecap="round" transform="rotate(-90 256 256)"/>
    <text x="256" y="275" text-anchor="middle" font-size="64" font-family="system-ui,sans-serif" font-weight="700" fill="${INK}">50</text>
  `),

  home_set: svg(`
    <path d="M256 140 L400 260 H350 V380 H162 V260 H112 Z" fill="${TEAL}"/>
    <rect x="220" y="290" width="72" height="90" rx="8" fill="${WARM}"/>
    <rect x="180" y="250" width="44" height="40" rx="6" fill="${SKY}"/>
    <rect x="288" y="250" width="44" height="40" rx="6" fill="${SKY}"/>
  `),
  work_set: svg(`
    <rect x="150" y="200" width="212" height="160" rx="16" fill="${TEAL_DEEP}"/>
    <rect x="200" y="160" width="112" height="50" rx="12" fill="${TEAL}"/>
    <rect x="190" y="240" width="132" height="20" rx="6" fill="${WARM}"/>
    <circle cx="256" cy="300" r="14" fill="${CORAL}"/>
  `),
  home_fullday_1: svg(`
    <circle cx="360" cy="150" r="40" fill="${WARM}"/>
    <path d="M256 180 L380 280 H340 V380 H172 V280 H132 Z" fill="${TEAL}"/>
    <rect x="230" y="300" width="52" height="80" fill="${WARM}"/>
  `),
  home_fullday_5: svg(`
    <circle cx="360" cy="150" r="36" fill="${WARM}"/>
    <path d="M256 190 L370 280 H335 V370 H177 V280 H142 Z" fill="${TEAL}"/>
    <path d="M200 250 Q256 220 312 250" stroke="${SKY}" stroke-width="10" fill="none"/>
  `),
  home_fullday_10: svg(`
    <path d="M256 170 L390 290 H345 V390 H167 V290 H122 Z" fill="${TEAL_DEEP}"/>
    <rect x="220" y="300" width="72" height="90" fill="${WARM}"/>
    <circle cx="256" cy="230" r="28" fill="${CORAL}" opacity="0.7"/>
  `),
  home_fullday_25: svg(`
    <circle cx="256" cy="256" r="140" fill="${TEAL}" opacity="0.15"/>
    <path d="M256 150 L400 270 H350 V380 H162 V270 H112 Z" fill="${TEAL}"/>
    <path d="M256 190 L360 270 H325 V350 H187 V270 H152 Z" fill="${TEAL_DEEP}"/>
    <rect x="230" y="290" width="52" height="90" fill="${WARM}"/>
  `),
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ids = Object.keys(BADGES);
  for (const id of ids) {
    const buf = await sharp(Buffer.from(BADGES[id]))
      .png()
      .resize(512, 512)
      .toBuffer();
    const dest = path.join(OUT, `${id}.png`);
    fs.writeFileSync(dest, buf);
    console.log('wrote', path.relative(process.cwd(), dest));
  }
  console.log(`Done: ${ids.length} badges`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

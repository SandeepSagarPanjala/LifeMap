/**
 * Apply the canonical LifeMap achievement gold frame to square scene PNGs.
 *
 * Usage:
 *   node scripts/apply-achievement-badge-frame.mjs --in <dir> --out <dir>
 *
 * Input scenes must be full-bleed (no model-drawn frames). See docs/achievement-badges.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 512;
/** Outer frame thickness as fraction of canvas. */
const FRAME_RATIO = 0.078;
/** Absolute tweak applied after ratio (user-tuned). */
const FRAME_PX_ADJUST = -4;
/** Outer corner radius. */
const OUTER_RADIUS = 76;
/** Inner opening corner radius. */
const INNER_RADIUS = 54;

function parseArgs(argv) {
  const args = { in: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  if (!args.in || !args.out) {
    console.error(
      'Usage: node scripts/apply-achievement-badge-frame.mjs --in <dir> --out <dir>',
    );
    process.exit(1);
  }
  return args;
}

function goldPlateSvg(size, outerR) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF1C2"/>
      <stop offset="22%" stop-color="#E8C878"/>
      <stop offset="48%" stop-color="#C9962E"/>
      <stop offset="72%" stop-color="#E6C36A"/>
      <stop offset="100%" stop-color="#8A6718"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="45%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3D2C0A" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${outerR}" ry="${outerR}" fill="url(#gold)"/>
  <rect width="${size}" height="${size}" rx="${outerR}" ry="${outerR}" fill="url(#sheen)"/>
  <rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="${outerR - 3}" ry="${outerR - 3}"
    fill="none" stroke="#FFF8DE" stroke-opacity="0.55" stroke-width="2.5"/>
  <rect x="7" y="7" width="${size - 14}" height="${size - 14}" rx="${outerR - 6}" ry="${outerR - 6}"
    fill="none" stroke="#6B5014" stroke-opacity="0.35" stroke-width="2"/>
</svg>`;
}

function innerLipSvg(inner, radius) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}">
  <rect x="1" y="1" width="${inner - 2}" height="${inner - 2}" rx="${radius}" ry="${radius}"
    fill="none" stroke="#3D2C0A" stroke-opacity="0.5" stroke-width="3"/>
  <rect x="3" y="3" width="${inner - 6}" height="${inner - 6}" rx="${Math.max(0, radius - 2)}" ry="${Math.max(0, radius - 2)}"
    fill="none" stroke="#FFF6D6" stroke-opacity="0.25" stroke-width="2"/>
</svg>`;
}

async function applyFrame(inputPath, outputPath) {
  const framePx = Math.max(8, Math.round(SIZE * FRAME_RATIO) + FRAME_PX_ADJUST);
  const inner = SIZE - framePx * 2;

  const goldPlate = await sharp(Buffer.from(goldPlateSvg(SIZE, OUTER_RADIUS)))
    .png()
    .toBuffer();

  // Fill the opening completely (square badge). Sources may be landscape;
  // cover crops only as needed for aspect — never an extra zoom pass.
  const sceneRaw = await sharp(inputPath)
    .resize(inner, inner, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();

  const roundMask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}">
  <rect width="${inner}" height="${inner}" rx="${INNER_RADIUS}" ry="${INNER_RADIUS}" fill="#fff"/>
</svg>`);

  const roundedScene = await sharp(sceneRaw)
    .composite([{ input: roundMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const lip = await sharp(Buffer.from(innerLipSvg(inner, INNER_RADIUS)))
    .png()
    .toBuffer();

  const sceneWithLip = await sharp(roundedScene)
    .composite([{ input: lip, blend: 'over' }])
    .png()
    .toBuffer();

  await sharp(goldPlate)
    .composite([
      {
        input: sceneWithLip,
        left: framePx,
        top: framePx,
      },
    ])
    .png()
    .toFile(outputPath);
}

async function main() {
  const { in: inDir, out: outDir } = parseArgs(process.argv);
  const absIn = path.resolve(inDir);
  const absOut = path.resolve(outDir);
  fs.mkdirSync(absOut, { recursive: true });

  const files = fs
    .readdirSync(absIn)
    .filter(f => f.endsWith('.png') && !f.startsWith('_') && !f.startsWith('.'));
  if (files.length === 0) {
    console.error('No PNGs in', absIn);
    process.exit(1);
  }

  const tmpDir = path.join(absOut, '.frame-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const file of files) {
    const src = path.join(absIn, file);
    const tmp = path.join(tmpDir, file);
    await applyFrame(src, tmp);
    fs.renameSync(tmp, path.join(absOut, file));
    console.log('framed', file);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`Done ${files.length} badges → ${absOut}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

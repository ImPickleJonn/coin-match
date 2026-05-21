// =============================================================
// gen-tiles.js — Batch-generate the 7 kawaii tile icons for Coin
// Match using Google's Nano Banana Pro (gemini-3-pro-image-preview).
//
// USAGE:
//   node scripts/gen-tiles.js          # all 7 tiles
//   node scripts/gen-tiles.js coin     # just one
//   node scripts/gen-tiles.js coin sack chest   # subset
//
// REQUIREMENTS:
//   - .env.local contains GOOGLE_API_KEY=...
//   - "Merge Plop Splash Screen.png" lives at ../../Merge Plop Splash Screen.png
//     (one dir up from the project, on the Desktop)
//   - Internet access. Node 18+ (uses global fetch).
//
// COST: ~$0.134 per image at 1K/2K. A run of 7 tiles ≈ $1.
// OUTPUT: PNG files written to assets/tiles/ with the existing naming
//   convention so the game picks them up without code changes.
// =============================================================

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

// ----- Load API key from .env.local (no dotenv dep needed) -----
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('ERROR: GOOGLE_API_KEY not found in .env.local');
  process.exit(1);
}

// ----- Model + endpoint -----
const MODEL = 'gemini-3-pro-image-preview';   // Nano Banana Pro
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// ----- Reference image (Merge Plop splash, sets the style anchor) -----
const REFERENCE_IMAGE = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'Desktop',
  'Merge Plop Splash Screen.png'
);

function loadReferenceBase64() {
  if (!fs.existsSync(REFERENCE_IMAGE)) {
    console.error('ERROR: Reference image not found at', REFERENCE_IMAGE);
    process.exit(1);
  }
  const buf = fs.readFileSync(REFERENCE_IMAGE);
  return { mime: 'image/png', data: buf.toString('base64') };
}

// ----- Shared style preamble (the anchor that keeps all 7 tiles consistent) -----
// IMPORTANT: we ask for SOLID PITCH-BLACK background (#000000), not transparent.
// Gemini does transparency poorly — semi-transparent halo around the silhouette,
// fringing on the outline. With a solid black bg we get clean edges, then we
// chroma-key the black out ourselves via flood-fill (see stripBlackBackground).
const STYLE_PREAMBLE = `
Create a SINGLE GAME TILE ICON for a mobile match-3 puzzle game in this EXACT art style (see reference image attached):

ART STYLE (mandatory — match the reference image exactly):
- Chunky 2D cartoon kawaii illustration, like Merge Plop or Best Fiends
- Thick chocolate-brown outline (~6% of canvas width) around every silhouette, color #3a1a05
- Candy-color gradient fill — saturated, bright, glossy
- BIG glossy white highlight smear on the upper-left of the subject (round or crescent shape)
- Soft drop shadow under the subject (small, only directly beneath)
- Cute "alive" feel — slight asymmetry, charming proportions

COMPOSITION (mandatory):
- One subject, dead-centered, filling ~80% of the canvas
- BACKGROUND MUST BE 100% SOLID PITCH BLACK (#000000) — completely flat, no gradient,
  no texture, no scene, no highlight, no soft transparent edges. JUST PURE BLACK.
- The chocolate-brown outline of the subject must be a clearly DIFFERENT shade from
  the black background — keep the outline at #3a1a05 / dark brown, NOT pitch black,
  so there's a visible edge between subject and background.
- Square 1024×1024
- The icon should read clearly even when scaled down to 64×64 — favor bold shapes over fine detail
- NO TEXT anywhere on the icon (no labels, no captions, no watermarks)
- NO UI chrome, no borders, no card frames, no badge holders
- NO additional decorative objects around the subject (no scattered sparkles, no surrounding stars)

SUBJECT:`;

// ----- The 7 tiles -----
const TILES = [
  {
    id: 'coin',
    filename: '01_coin.png',
    subject: `A gold coin, viewed straight-on (circle shape). Bright golden yellow with a darker gold rim. A chunky bold dollar sign "$" embossed in the center in dark brown. The coin has a clear glossy highlight on the upper-left.`,
  },
  {
    id: 'sack',
    filename: '02_purple_sack_of_coins.png',
    subject: `A round purple money sack, tied at the top with a dark brown drawstring band. The sack body is a deep violet/purple gradient. A gold dollar sign "$" embossed on the front of the sack. Two small knot bumps at the top of the tie.`,
  },
  {
    id: 'chest',
    filename: '03_closed_treasure_chest.png',
    subject: `A small closed wooden treasure chest. Warm brown wood body with a curved (domed) lid. A bright gold band where the lid meets the body, gold corner brackets at the bottom corners, and a round gold lock plate in the center with a small dark keyhole.`,
  },
  {
    id: 'bolt',
    filename: '04_blue_energy_bolt.png',
    subject: `A chunky lightning bolt zigzag shape. Bright sky-blue gradient (light blue at the top fading to a deeper blue at the bottom). The bolt has a clear inner white highlight stripe running down the left edge.`,
  },
  {
    id: 'chicken',
    filename: '05_chicken_steal_mascot.png',
    subject: `A cute cartoon chicken head, front-facing, viewed from the front. A red zigzag comb on top, cream/white round head, an orange triangle beak, two big black eyes with white shine highlights, and pink rosy cheek blush. No body, just the head.`,
  },
  {
    id: 'shield',
    filename: '07_shield.png',
    subject: `A heater-shape shield (pointed at the bottom, flat top). Bright sky-blue gradient body with a darker blue inner rim. A bold white 5-point star centered on the shield. Glossy highlight on the upper-left.`,
  },
  {
    id: 'glove',
    filename: '06_cute_attack_glove.png',
    subject: `A red boxing glove, viewed from the front (knuckles facing the viewer). Bright red/pink gradient body, a white wrist cuff at the bottom with two thin dark stripes, and three small knuckle dimples on the front. Glossy highlight on the upper-left.`,
  },
];

// ----- Decode any incoming image to RGBA pixel data + width/height.
// Handles both PNG (89504e47...) and JPEG (ffd8ff...). JPEGs are opaque
// to begin with, so we synthesize an RGBA buffer (alpha=255 everywhere)
// — chroma-key will write the alpha channel below.
function decodeToRGBA(buffer) {
  const sig = buffer.slice(0, 4).toString('hex');
  if (sig.startsWith('89504e47')) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (sig.startsWith('ffd8ff')) {
    const decoded = jpeg.decode(buffer, { useTArray: true });
    // jpeg-js returns RGBA with alpha=255 by default. width/height included.
    return { width: decoded.width, height: decoded.height, data: Buffer.from(decoded.data) };
  }
  throw new Error('Unknown image format, sig=' + sig);
}

// ----- Re-encode RGBA buffer as PNG -----
function encodeRGBAToPNG(width, height, data) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(data);
  return PNG.sync.write(png);
}

// ----- Chroma-key: flood-fill from every edge pixel, mark near-black
// pixels (sum-of-RGB < THRESHOLD) as fully transparent. Robust against
// any dark detail INSIDE the icon because only edge-connected black is
// cleared. Then feather any remaining dim pixels at the boundary so the
// outline doesn't carry a halo of dark fringe. -----
function stripBlackBackground(imgBuffer) {
  const { width: w, height: h, data } = decodeToRGBA(imgBuffer);
  const THRESHOLD = 60;            // sum of R+G+B (out of 765). Pitch black ~ 0; outline brown ~ 105+.
  const visited = new Uint8Array(w * h);
  const stack = [];
  // Seed: every pixel on the four edges
  for (let x = 0; x < w; x++) {
    stack.push(x, 0);
    stack.push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    stack.push(0, y);
    stack.push(w - 1, y);
  }
  while (stack.length) {
    const py = stack.pop();
    const px = stack.pop();
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const idx = py * w + px;
    if (visited[idx]) continue;
    const di = idx * 4;
    if ((data[di] + data[di + 1] + data[di + 2]) >= THRESHOLD) continue;
    visited[idx] = 1;
    data[di + 3] = 0;              // alpha = 0
    stack.push(px + 1, py);
    stack.push(px - 1, py);
    stack.push(px, py + 1);
    stack.push(px, py - 1);
  }
  // Edge feather: for any pixel still opaque but very dim AND adjacent
  // to a now-transparent pixel, scale its alpha by luminance. Smooths
  // the contour without eating into the chocolate-brown outline.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const di = idx * 4;
      if (data[di + 3] === 0) continue;
      const lum = data[di] + data[di + 1] + data[di + 2];
      if (lum >= 140) continue;     // outline pixels (~105+) and brighter stay solid
      // Check 4-neighbors
      let touchesTransparent = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ndi = (ny * w + nx) * 4;
        if (data[ndi + 3] === 0) { touchesTransparent = true; break; }
      }
      if (touchesTransparent) {
        // Scale alpha proportional to brightness (dim → more transparent)
        const t = Math.min(1, lum / 140);
        data[di + 3] = Math.floor(data[di + 3] * t);
      }
    }
  }
  return encodeRGBAToPNG(w, h, data);
}

// ----- Generation request -----
async function generateTile(tile, referenceImg) {
  const prompt = STYLE_PREAMBLE + ' ' + tile.subject;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: referenceImg.mime, data: referenceImg.data } },
      ],
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-goog-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  // Find the image part in the response
  const candidates = json.candidates || [];
  for (const cand of candidates) {
    const parts = (cand.content && cand.content.parts) || [];
    for (const part of parts) {
      const inline = part.inline_data || part.inlineData;
      if (inline && inline.data) {
        const buf = Buffer.from(inline.data, 'base64');
        return { buf, mime: inline.mime_type || inline.mimeType || 'image/png' };
      }
    }
  }
  throw new Error('No image in response: ' + JSON.stringify(json).slice(0, 500));
}

// ----- Main loop -----
async function main() {
  const argv = process.argv.slice(2);
  const filter = argv.length > 0 ? new Set(argv.map(a => a.toLowerCase())) : null;
  const outDir = path.join(__dirname, '..', 'assets', 'tiles');
  fs.mkdirSync(outDir, { recursive: true });

  const referenceImg = loadReferenceBase64();
  console.log(`Reference loaded: ${REFERENCE_IMAGE} (${(referenceImg.data.length / 1024).toFixed(0)} KB base64)`);
  console.log(`Model: ${MODEL}`);
  console.log(`Output: ${outDir}\n`);

  const toRun = TILES.filter(t => !filter || filter.has(t.id));
  if (toRun.length === 0) {
    console.error('No tiles matched the filter:', argv);
    process.exit(1);
  }

  for (const tile of toRun) {
    process.stdout.write(`[${tile.id.padEnd(8)}] generating... `);
    const t0 = Date.now();
    try {
      const { buf: rawImg, mime } = await generateTile(tile, referenceImg);
      const out = path.join(outDir, tile.filename);
      const sig = rawImg.slice(0, 4).toString('hex');
      let saved;
      try {
        // decodeToRGBA handles both PNG and JPEG. stripBlackBackground
        // chroma-keys and returns a fresh PNG with proper alpha.
        saved = stripBlackBackground(rawImg);
      } catch (e) {
        console.log(`  (chroma-key failed sig=${sig} mime=${mime}: ${e.message}; saving raw)`);
        saved = rawImg;
      }
      fs.writeFileSync(out, saved);
      const ms = Date.now() - t0;
      console.log(`ok (raw ${(rawImg.length / 1024).toFixed(0)}KB ${sig} -> clean ${(saved.length / 1024).toFixed(0)}KB, ${ms}ms) -> ${tile.filename}`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
  }
  console.log('\nDone. Refresh the game to see the new tiles.');
}

main().catch(err => { console.error(err); process.exit(1); });

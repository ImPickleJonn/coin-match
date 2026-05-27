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
// Try several locations — the splash file gets renamed / moved sometimes.
const REFERENCE_CANDIDATES = [
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'Merge Plop Splash Screen.png'),
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'plop.png'),
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'merge-blast-project', 'assets', 'splash.jpg'),
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'merge-plop-roguelite-project', 'assets', 'splash.jpg'),
];

function loadReferenceBase64() {
  for (const p of REFERENCE_CANDIDATES) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const mime = p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg' : 'image/png';
      console.log('Using reference: ' + p);
      return { mime, data: buf.toString('base64'), path: p };
    }
  }
  console.error('ERROR: No reference image found. Tried:');
  for (const p of REFERENCE_CANDIDATES) console.error('  ' + p);
  process.exit(1);
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
- Cute "alive" feel — slight asymmetry, charming proportions

ABSOLUTELY NO SHADOW (mandatory — this is the most important rule):
- NO drop shadow under the subject (zero, none, gone)
- NO ground shadow ellipse beneath the subject
- NO cast shadow of any kind on the background
- NO ground plane, NO floor, NO platform under the subject
- The subject must FLOAT against the background with no shadow whatsoever
- The image must contain ONLY two things: (1) the subject silhouette,
  (2) the pure-black background. Nothing else. No third element. No shadow.

COMPOSITION (mandatory):
- ONE subject, dead-centered
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

  // ===== TILE SPECIALS (WILD + STAR) =====
  {
    id: 'wild',
    filename: '08_tile_wild.png',
    subject: `A colorful rainbow swirl gemstone (or 4-color pinwheel star) representing a "wild" / "rainbow" tile in a match-3 game. Round shape, with 4 distinct quadrants in bright candy colors: red, blue, yellow, green. Sparkle highlight in the center. Glossy 3D feel.`,
  },
  {
    id: 'star',
    filename: '09_tile_star.png',
    subject: `A chunky cartoon 5-point star, bright golden yellow gradient (light yellow on top fading to gold-orange at bottom). Round chunky toon proportions (NOT a thin pointed star — fat, friendly, kawaii). Glossy white highlight on upper-left.`,
  },

  // ===== BOOSTERS (right side of grid) =====
  {
    id: 'booster_hammer',
    filename: '11_booster_hammer.png',
    subject: `A cute cartoon hammer tool, head pointing diagonally upper-right, handle pointing diagonally lower-left. Bright steel-gray hammer head with a tiny yellow lightning bolt or "POW" sparkle on top. Warm wooden brown handle with a wrap grip in red. Chunky toon proportions.`,
  },
  {
    id: 'booster_rocket',
    filename: '12_booster_rocket.png',
    subject: `A cute cartoon rocket / firework, pointing straight up. Bright red main body with a white-and-blue striped fin section at the bottom, a yellow nose cone on top, and a tiny window/porthole in the middle. Small orange flame puff at the base.`,
  },
  {
    id: 'booster_bomb',
    filename: '13_booster_bomb.png',
    subject: `A cute cartoon round bomb. Dark gray/black sphere body, a small lit fuse sticking out the top with a single bright orange-yellow spark at the fuse tip. Glossy highlight on the upper-left of the sphere. Chunky and friendly, not scary.`,
  },
  {
    id: 'booster_shuffle',
    filename: '14_booster_shuffle.png',
    subject: `Two circular arrows forming a "refresh" or "shuffle" loop — one arrow curving clockwise on top, another curving counter-clockwise on the bottom, together forming a near-circle with arrow tips. Bright cyan-blue gradient. Friendly chunky cartoon style.`,
  },

  // ===== BOTTOM NAV TABS =====
  {
    id: 'nav_village',
    filename: '21_nav_village.png',
    subject: `A cute cartoon house with a red triangular roof, cream walls, a brown wooden door in the center, and one square window. Tiny puff of smoke from a small chimney. Chunky kawaii proportions.`,
  },
  {
    id: 'nav_play',
    filename: '22_nav_play.png',
    subject: `A cute cartoon arcade slot-machine handle / play button — a yellow gold triangular play arrow (▶) inside a round bright pink button with a darker pink rim. Glossy highlight upper-left. Chunky and bouncy.`,
  },
  {
    id: 'nav_shop',
    filename: '23_nav_shop.png',
    subject: `A cute cartoon shopping bag with two short handles at the top. Bright orange-yellow gradient body, a small pink heart emblem on the front of the bag. Chunky and friendly.`,
  },
  {
    id: 'nav_friends',
    filename: '24_nav_friends.png',
    subject: `Two cute cartoon character heads side-by-side, slightly overlapping (the back one half-hidden by the front one). Front character: round pink head with a smile. Back character: round blue head with a smile. Simple, no facial details beyond a small smile and dot eyes. Chunky kawaii proportions.`,
  },

  // ===== AVATARS — player + 5 master templates =====
  {
    id: 'avatar_player',
    filename: '31_avatar_player.png',
    subject: `A cute generic round cartoon-mascot HEAD only (no body). Cream/peach skin tone, simple smiley face: two dot eyes with shine, a small smile, pink cheek blush. Slight upward tuft of brown hair on top of the head. Chunky kawaii proportions — head fills most of the canvas.`,
  },
  {
    id: 'avatar_master_pirate',
    filename: '32_avatar_master_pirate.png',
    subject: `A cute cartoon PIRATE character head (no body). Cream skin, eye patch on one eye, the other eye is a big black dot with a white shine. Black pirate bandana on top of the head with a small white skull-and-crossbones emblem in the front. Small smile, pink cheek blush.`,
  },
  {
    id: 'avatar_master_witch',
    filename: '33_avatar_master_witch.png',
    subject: `A cute cartoon WITCH character head (no body). Pale lavender skin, two big purple/violet eyes with white shine highlights, a small smirky smile, pink cheek blush. A pointy black-purple witch hat on top of the head with a yellow star band. Wisps of black hair peeking out from under the hat.`,
  },
  {
    id: 'avatar_master_chef',
    filename: '34_avatar_master_chef.png',
    subject: `A cute cartoon CHEF character head (no body). Cream skin, big rosy cheeks, smiley face with two dot eyes and a wide grin showing a tooth. A tall white puffy chef's hat (toque) on top of the head, with a small red kerchief tied around the neck just visible at the bottom edge.`,
  },
  {
    id: 'avatar_master_robot',
    filename: '35_avatar_master_robot.png',
    subject: `A cute cartoon ROBOT character head (no body). Shiny metallic silver-blue rounded square head with thick brown outline, two round bright cyan/blue glowing eyes, a small horizontal mouth slot, and a tiny red antenna with a glowing yellow bulb on top. Friendly not threatening.`,
  },
  {
    id: 'avatar_master_king',
    filename: '36_avatar_master_king.png',
    subject: `A cute cartoon KING character head (no body). Cream skin, large bushy white beard covering the lower half of the face, two big eyes with white shine highlights, pink cheek blush. A bright gold crown on top of the head with three triangular points and a red gem in the center point.`,
  },

  // ===== HERO CHARACTERS for the village tab =====
  {
    id: 'character_pig',
    filename: '41_character_pig.png',
    subject: `Captain Piggy: a cute round chubby cartoon pig wearing a pirate hat with a skull emblem. Pink round body, floppy ears, a darker pink snout with two nostrils, two big dollar-sign "$" eyes (the iris is a $ shape, not a regular pupil), pink rosy cheek blush, and a happy open-mouth smile. A black pirate tricorn hat with a white skull-and-crossbones emblem on top of the head. Body and head merged into one chubby blob.`,
  },
  {
    id: 'character_dragon',
    filename: '42_character_dragon.png',
    subject: `Baby Drake: a cute chubby cartoon baby dragon. Green round body with a lighter green belly patch, small folded wings on the back (not spread), tiny back spikes, a small snout with two nostrils, two big "$" dollar-sign eyes (iris is $ shape), pink rosy cheek blush, a happy open-mouth smile with two tiny white fangs visible. A small gold crown on top of the head with three little points.`,
  },

  // ===== EXTRA UI =====
  {
    id: 'settings_gear',
    filename: '51_settings_gear.png',
    subject: `A cute cartoon settings gear/cog icon. Bright orange-yellow gradient body with 8 chunky teeth around the perimeter, a round center hole. Glossy white highlight on the upper-left tooth area. Chunky friendly toon proportions, not industrial.`,
  },
  {
    id: 'daily_gift',
    filename: '52_daily_gift.png',
    subject: `A cute cartoon wrapped gift box. Bright pink/red square box with a chunky golden-yellow ribbon and a big bow on top. Glossy white highlight on the upper-left face of the box.`,
  },

  // ===== SPLASH SCREEN =====
  {
    id: 'logo',
    filename: '61_logo.png',
    subject: `Game logo text "COIN MATCH" in chunky kawaii bubble lettering. Each letter is a thick rounded balloon-letter shape with thick chocolate-brown outline, glossy white highlight on the upper-left of each letter. "COIN" in bright golden yellow, "MATCH" in candy-pink. The text is on TWO LINES with "COIN" on top and "MATCH" below, slightly tilted/playful arrangement. Small gold coin character decoration peeking from the side. Square 1024x1024 canvas with the logo centered.`,
  },
  {
    id: 'splash_bg',
    filename: '62_splash_bg.png',
    subject: `A bright kawaii background scene: sunshine yellow sky with soft white fluffy clouds, scattered floating gold coins and sparkle stars, a rolling green hill at the bottom with grass and some small candy-colored flowers (pink, blue, purple). NO characters, NO text — just an atmospheric kawaii scene that the game's logo will sit on top of. Bright, cheerful, like the Merge Plop splash screen feel but without the central subject.`,
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

// ----- Auto-crop the opaque subject, scale it so the LONGER dimension
// fills `targetFill` of the canvas, and center it on a fresh transparent
// square. This guarantees every tile occupies the same visual size on
// the game board, regardless of whether the source was tall (chicken
// with comb) or wide (chest) or thin (lightning bolt). Uses bilinear
// sampling for smooth scaling.
function autoCropAndCenter(width, height, data, targetFill, alphaCutoff) {
  if (targetFill == null) targetFill = 0.86;
  if (alphaCutoff == null) alphaCutoff = 12;
  // Find bounding box of opaque pixels
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > alphaCutoff) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return data; // empty image, nothing to do
  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const longer = Math.max(bboxW, bboxH);
  const targetSize = width * targetFill;
  const scale = targetSize / longer;
  const scaledW = Math.round(bboxW * scale);
  const scaledH = Math.round(bboxH * scale);
  const offsetX = Math.round((width - scaledW) / 2);
  const offsetY = Math.round((height - scaledH) / 2);
  // Fresh transparent output buffer (alloc zero-fills)
  const out = Buffer.alloc(width * height * 4);
  // Bilinear sample from src bbox into dst region
  const srcStride = width * 4;
  for (let y = 0; y < scaledH; y++) {
    const srcY = minY + (y + 0.5) / scale - 0.5;
    const sy0 = Math.max(0, Math.min(height - 1, Math.floor(srcY)));
    const sy1 = Math.max(0, Math.min(height - 1, sy0 + 1));
    const ty = srcY - sy0;
    const otY = offsetY + y;
    if (otY < 0 || otY >= height) continue;
    for (let x = 0; x < scaledW; x++) {
      const srcX = minX + (x + 0.5) / scale - 0.5;
      const sx0 = Math.max(0, Math.min(width - 1, Math.floor(srcX)));
      const sx1 = Math.max(0, Math.min(width - 1, sx0 + 1));
      const tx = srcX - sx0;
      const otX = offsetX + x;
      if (otX < 0 || otX >= width) continue;
      const i00 = sy0 * srcStride + sx0 * 4;
      const i01 = sy0 * srcStride + sx1 * 4;
      const i10 = sy1 * srcStride + sx0 * 4;
      const i11 = sy1 * srcStride + sx1 * 4;
      const di = otY * srcStride + otX * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = data[i00 + c];
        const v01 = data[i01 + c];
        const v10 = data[i10 + c];
        const v11 = data[i11 + c];
        const top = v00 * (1 - tx) + v01 * tx;
        const bot = v10 * (1 - tx) + v11 * tx;
        out[di + c] = Math.round(top * (1 - ty) + bot * ty);
      }
    }
  }
  return out;
}

// ----- Chroma-key: flood-fill from every edge pixel, mark near-black
// pixels (sum-of-RGB < THRESHOLD) as fully transparent. Robust against
// any dark detail INSIDE the icon because only edge-connected black is
// cleared. Then feather any remaining dim pixels at the boundary so the
// outline doesn't carry a halo of dark fringe. -----
function stripBlackBackground(imgBuffer) {
  const { width: w, height: h, data } = decodeToRGBA(imgBuffer);
  // Even though the prompt asks for pitch-black bg, Gemini sometimes
  // outputs white or off-white instead. Sample the four corners and
  // use the median color as the actual background reference. Then
  // flood-fill from edges through any pixel within DIST of that color
  // OR any gray-ish pixel at mid luminance (residual drop shadows).
  const cornerSamples = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [10, 10], [w - 11, 10], [10, h - 11], [w - 11, h - 11],
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [x, y] of cornerSamples) {
    const i = (y * w + x) * 4;
    bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2];
  }
  bgR /= cornerSamples.length;
  bgG /= cornerSamples.length;
  bgB /= cornerSamples.length;
  const COLOR_DIST_SQ = 90 * 90;   // squared color distance (R+G+B space)
  function isBackgroundPixel(r, g, b) {
    const dr = r - bgR, dg = g - bgG, db = b - bgB;
    if (dr * dr + dg * dg + db * db < COLOR_DIST_SQ) return true;
    // Also eat gray-ish pixels at mid luminance (drop shadows on light bg).
    // Chocolate-brown outline (R=58,G=26,B=5) has max-min=53, NOT gray — safe.
    // White highlights (~255,255,255) have sum >= 720 — also safe (sum<540 cap).
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC <= 22 && (r + g + b) < 540) return true;
    return false;
  }
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
    if (!isBackgroundPixel(data[di], data[di + 1], data[di + 2])) continue;
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
  // Final pass: auto-crop to the opaque content and re-center so every
  // tile occupies the same visual fraction of the sprite, no matter
  // whether the source subject was tall, wide, or thin.
  const cropped = autoCropAndCenter(w, h, data, 0.86, 12);
  return encodeRGBAToPNG(w, h, cropped);
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
  console.log(`Reference loaded: ${referenceImg.path} (${(referenceImg.data.length / 1024).toFixed(0)} KB base64)`);
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

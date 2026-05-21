// Coin Match — Express server with Telegram Stars IAP, leaderboard, state
// sync, and bot welcome / notifications. Frontend is single-file index.html;
// server only handles money flow, score submission, persistent state, and
// outbound bot messages.
//
// Architecture mirrors Matryoshka v0.3 (no PvP, no WebSocket). Adds liveops
// event-flag endpoint so the client can render holiday tiles (Halloween
// pumpkins, etc.) without redeploy.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

// Purchase notification → shared pickle-notif-bot. No-op unless both env vars
// are set, so this is safe to deploy before the notif bot exists.
const NOTIF_BOT_URL = process.env.NOTIF_BOT_URL || '';
const NOTIF_SECRET  = process.env.NOTIF_SECRET || '';
const NOTIF_GAME_ID = 'coin-match';
function notifyPurchase(info) {
  if (!NOTIF_BOT_URL || !NOTIF_SECRET) return;
  try {
    fetch(NOTIF_BOT_URL.replace(/\/+$/, '') + '/api/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notif-key': NOTIF_SECRET },
      body: JSON.stringify({
        game: NOTIF_GAME_ID,
        sku: info.sku,
        stars: info.stars,
        userId: info.userId,
        username: info.username,
        ts: Date.now(),
      }),
    }).catch(() => {});
  } catch (_e) {}
}

const WEBHOOK_SECRET = BOT_TOKEN
  ? crypto.createHash('sha256').update(BOT_TOKEN).digest('hex').slice(0, 32)
  : null;

app.use(express.json({ limit: '512kb' }));

// ============ Persistent state ============
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

let users = {};
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    const obj = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { console.error('[users] load failed:', e.message); return {}; }
}
function saveUsers() {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users)); }
  catch (e) { console.error('[users] save failed:', e.message); }
}

// Whitelisted state fields. Anything outside this list is dropped server-side
// so a malicious client can't set arbitrary state.
const SYNC_FIELDS = [
  'coins', 'gems', 'energy', 'energyMax', 'energyRegenAt',
  'vaultTier', 'vaultProgress', 'vaultLifetimeCoins',
  'theme', 'village', 'masterDamage', 'myVillageDamage',
  'shieldsStocked',
  'skins', 'activeSkin',
  // v0.3 booster buckets + legacy v0.2 buckets (back-compat for saves)
  'boost', 'meter', 'armed', 'freeSpinsLeft', 'muted',
  'betBoosterTokens', 'wildBoosterTokens', 'bagBoosterTokens',
  'streak', 'lastPlayedYMD',
  'totalCoinsEver', 'totalMatchesEver', 'totalCascadesEver',
  'totalGoldEarnedEver', 'totalSmashEver', 'totalRaidEver',
  'bestCascadeEver', 'bestRoundCoinsEver',
  'dailyChestYMD', 'dailyChestDay',
  'eventTokens', 'gaeContributed',
  'missions', 'achievements',
  'battlePassUntil', 'betIdx',
  'firstSeenAt', 'welcomed',
  'lang',
];

function loadLeaderboard() {
  try {
    if (!fs.existsSync(LEADERBOARD_FILE)) return { regular: [], daily: {} };
    const obj = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
    return {
      regular: Array.isArray(obj.regular) ? obj.regular : [],
      daily:   (obj.daily && typeof obj.daily === 'object') ? obj.daily : {},
    };
  } catch (e) { return { regular: [], daily: {} }; }
}
function saveLeaderboard(lb) {
  try { fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(lb)); }
  catch (e) {}
}
let leaderboard = loadLeaderboard();
users = loadUsers();
console.log('[boot] users=' + Object.keys(users).length + ' lb-regular=' + leaderboard.regular.length);

// ============ Leaderboard seeding ============
// Mixed RU + EN + treasure-themed names. Per Matryoshka pattern: each fake
// has a fixed all-time-best, and today's daily score is a fraction of that
// ceiling, so a fake never appears stronger on the daily than their all-time.
const FAKE_PLAYER_NAMES = [
  'Vladimir', 'Olga', 'Dmitry', 'Tatiana', 'Sergey', 'Anna', 'Pavel',
  'Elena', 'Igor', 'Natasha', 'Maria', 'Andrei', 'Lena', 'Mikhail',
  'Yuri', 'Nikita', 'Kate', 'Boris', 'Sasha', 'Vika', 'Roman', 'Daria',
  'Artyom', 'Polina', 'Liza', 'Kostya', 'Yulia', 'Petr', 'Slava', 'Vova',
  'David', 'Sarah', 'Emma', 'John', 'Sophie', 'Liam', 'Ava', 'Noah',
  'Mia', 'James', 'Olivia', 'Lucas', 'Zoe', 'Felix', 'Nora', 'Henry',
  '💰 Goldfinger', '👑 KingMidas', '💎 Treasure', '🏴‍☠️ Pirate', '🐉 Dragon',
  'CoinHunter', 'VaultLord', 'MegaCascade', 'GoldStreak', 'JackpotJoe',
  'LootKing', 'SilverFox', 'GemMaster', 'ChestBoss', 'CascadeQueen',
  'Vega', 'Orion', 'Nova', 'Atlas', 'Lyra',
  'Spark', 'Quasar', 'Aria', 'Mira', 'Zara',
  'СибирскоеЗолото', 'УральскийСамоцвет', 'КрымскийКлад',
];
let FAKE_PLAYERS = [];
function buildFakePlayers() {
  if (FAKE_PLAYERS.length > 0) return;
  for (let i = 0; i < FAKE_PLAYER_NAMES.length; i++) {
    let allTimeBest;
    if (i < 3)       allTimeBest = 120000 + Math.floor(Math.random() * 80000);   // elites 120k-200k
    else if (i < 10) allTimeBest =  60000 + Math.floor(Math.random() * 60000);   // pros 60k-120k
    else if (i < 30) allTimeBest =  20000 + Math.floor(Math.random() * 35000);   // mid 20k-55k
    else if (i < 60) allTimeBest =   5000 + Math.floor(Math.random() * 15000);   // casual 5k-20k
    else             allTimeBest =    800 + Math.floor(Math.random() * 4000);    // tail 0.8k-4.8k
    FAKE_PLAYERS.push({ uid: -(1000 + i), name: FAKE_PLAYER_NAMES[i], allTimeBest });
  }
  FAKE_PLAYERS.sort((a, b) => b.allTimeBest - a.allTimeBest);
}
function purgeLeaderboardSeeds() {
  leaderboard.regular = leaderboard.regular.filter(e => e.uid >= 0);
  for (const ymd of Object.keys(leaderboard.daily)) {
    leaderboard.daily[ymd] = leaderboard.daily[ymd].filter(e => e.uid >= 0);
    if (leaderboard.daily[ymd].length === 0) delete leaderboard.daily[ymd];
  }
}
function seedLeaderboardIfEmpty() {
  buildFakePlayers();
  const TARGET_REGULAR = 80;
  if (leaderboard.regular.length < TARGET_REGULAR) {
    const existingUids = new Set(leaderboard.regular.map(e => e.uid));
    const entries = leaderboard.regular.slice();
    for (const p of FAKE_PLAYERS) {
      if (entries.length >= TARGET_REGULAR) break;
      if (existingUids.has(p.uid)) continue;
      entries.push({ uid: p.uid, name: p.name, score: p.allTimeBest,
        ts: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000) });
    }
    entries.sort((a, b) => b.score - a.score);
    leaderboard.regular = entries.slice(0, 100);
  }
  const today = ymdUTC();
  const TARGET_DAILY = 40;
  if (!leaderboard.daily[today] || leaderboard.daily[today].length < TARGET_DAILY) {
    const existing = (leaderboard.daily[today] || []).slice();
    const existingUids = new Set(existing.map(e => e.uid));
    const entries = existing;
    const pool = FAKE_PLAYERS.slice().sort(() => Math.random() - 0.5);
    for (const p of pool) {
      if (entries.length >= TARGET_DAILY) break;
      if (existingUids.has(p.uid)) continue;
      const factor = 0.35 + Math.random() * 0.40;
      entries.push({ uid: p.uid, name: p.name,
        score: Math.floor(p.allTimeBest * factor),
        ts: Date.now() - Math.floor(Math.random() * 8 * 60 * 60 * 1000) });
    }
    entries.sort((a, b) => b.score - a.score);
    leaderboard.daily[today] = entries.slice(0, 100);
  }
  saveLeaderboard(leaderboard);
}
function ymdUTC(d) {
  d = d || new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function seedForYMD(ymd) {
  let h = 2166136261;
  for (let i = 0; i < ymd.length; i++) { h ^= ymd.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
purgeLeaderboardSeeds();
seedLeaderboardIfEmpty();

// ============ Liveops events ============
// Server-flagged events let us flip on holiday tile drops (DC) and community
// goals (GAE) without redeploying. Default: no event. Edit data/events.json
// to enable one, or POST /api/admin/event (admin only).
function loadEvents() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return defaultEventsState();
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  } catch (e) { return defaultEventsState(); }
}
function saveEvents(s) {
  try { fs.writeFileSync(EVENTS_FILE, JSON.stringify(s)); } catch (e) {}
}
function defaultEventsState() {
  return {
    // Dynamic Currency event (holiday tiles → exclusive skin).
    dc: { active: false, id: '', emoji: '⭐', name: 'Star Token', target: 50,
          rewardSku: '', endsAt: 0 },
    // General Accumulation Event (community goal).
    gae: { active: false, id: '', emoji: '🎁', name: 'Festival Gift', goal: 1000000,
           pooled: 0, rewardCoins: 5000, endsAt: 0 },
  };
}
let events = loadEvents();

// ============ Admin ============
const DEFAULT_ADMIN_IDS = '23040617';   // Pickle
function isAdmin(userId) {
  const raw = process.env.TELEGRAM_ADMIN_IDS || DEFAULT_ADMIN_IDS;
  return String(raw).split(',').map(s => s.trim()).filter(Boolean).includes(String(userId));
}

// ============ Stars SKUs ============
// All prices in Telegram Stars (XTR). priceUsd is display-only.
const SKUS = {
  energy_refill: {
    id: 'energy_refill', title: 'Energy Refill · +5',
    description: 'Instantly refill 5 energy. Get back to matching.',
    price: 40, priceUsd: '$0.52', grant: { energy: 5 },
  },
  coins_small: {
    id: 'coins_small', title: 'Coin Pile · 5,000 Coins',
    description: '5,000 coins to fuel bigger bets.',
    price: 99, priceUsd: '$1.29', grant: { coins: 5000 },
  },
  coins_medium: {
    id: 'coins_medium', title: 'Coin Stack · 20,000 Coins',
    description: '20,000 coins (+25% bonus over small pack).',
    price: 299, priceUsd: '$3.89', grant: { coins: 20000 },
  },
  coins_large: {
    id: 'coins_large', title: 'Coin Vault · 50,000 Coins',
    description: '50,000 coins (+40% bonus). Best for whales.',
    price: 599, priceUsd: '$7.79', grant: { coins: 50000 },
  },
  coins_mega: {
    id: 'coins_mega', title: 'Coin Mountain · 100,000 Coins',
    description: '100,000 coins (+60% bonus). Maximum value.',
    price: 999, priceUsd: '$12.99', grant: { coins: 100000 },
  },
  starter_pack: {
    id: 'starter_pack', title: 'Starter Pack · Best Value',
    description: '10,000 coins + 5 energy + Hammer ×5.',
    price: 199, priceUsd: '$2.59',
    grant: { coins: 10000, energy: 5, hammer: 5 },
  },
  hammer_pack: {
    id: 'hammer_pack', title: 'Hammer ×5',
    description: '5 hammers — smash 1 tile each, no energy cost.',
    price: 49, priceUsd: '$0.65', grant: { hammer: 5 },
  },
  rocket_pack: {
    id: 'rocket_pack', title: 'Rocket ×5',
    description: '5 rockets — clear the row + column you tap.',
    price: 99, priceUsd: '$1.29', grant: { rocket: 5 },
  },
  bomb_pack: {
    id: 'bomb_pack', title: 'Bomb ×5',
    description: '5 bombs — clear a 3×3 area around your tap.',
    price: 99, priceUsd: '$1.29', grant: { bomb: 5 },
  },
  shuffle_pack: {
    id: 'shuffle_pack', title: 'Shuffle ×5',
    description: '5 shuffles — reshuffle the board, no energy cost.',
    price: 49, priceUsd: '$0.65', grant: { shuffle: 5 },
  },
  free_pack: {
    id: 'free_pack', title: 'Free-Spin ×5',
    description: '5 tokens — each grants 5 matches with no energy cost.',
    price: 99, priceUsd: '$1.29', grant: { free: 5 },
  },
  energy_full: {
    id: 'energy_full', title: 'Energy Full',
    description: 'Instantly refill to maximum energy.',
    price: 199, priceUsd: '$2.59', grant: { energy: 30 },
  },
  shield_24h: {
    id: 'shield_24h', title: '24h Shield',
    description: 'Block all incoming attacks for 24 hours.',
    price: 99, priceUsd: '$1.29', grant: { shieldsStocked: 3 },
  },
  skin_pirate: {
    id: 'skin_pirate', title: 'Pirate Vault Skin',
    description: 'Treasure-chest vault with skull-and-crossbones flag.',
    price: 200, priceUsd: '$2.59', grant: { skins: ['pirate'] },
  },
  skin_dragon: {
    id: 'skin_dragon', title: "Dragon's Hoard Vault Skin",
    description: 'Mythical dragon coiled around a mountain of gold.',
    price: 250, priceUsd: '$3.25', grant: { skins: ['dragon'] },
  },
  skin_royal: {
    id: 'skin_royal', title: 'Royal Treasury Vault Skin',
    description: 'Crowned vault with velvet drapes and gold trim.',
    price: 250, priceUsd: '$3.25', grant: { skins: ['royal'] },
  },
  battle_pass: {
    id: 'battle_pass', title: 'Season Pass · 30 Days',
    description: 'Daily-mission rewards x2, exclusive seasonal skin, gem bonus.',
    price: 500, priceUsd: '$6.49', grant: { battlePass: 30 },
  },
  test_purchase: {
    id: 'test_purchase', title: 'Test Purchase (admin)',
    description: 'Admin-only 1⭐ smoke-test — grants 100 coins.',
    price: 1, priceUsd: '$0.01',
    grant: { coins: 100 }, adminOnly: true,
  },
};

const pendingByUser = new Map();
function pushPending(userId, sku) {
  if (!SKUS[sku]) return;
  if (!pendingByUser.has(userId)) pendingByUser.set(userId, []);
  pendingByUser.get(userId).push({ sku, grant: SKUS[sku].grant, ts: Date.now() });
}
function drainPending(userId) {
  const arr = pendingByUser.get(userId) || [];
  pendingByUser.delete(userId);
  return arr;
}

const userState = new Map();
function rememberUser(userId, patch) {
  if (!userId) return;
  const prev = userState.get(userId) || {};
  userState.set(userId, Object.assign(prev, patch));
}

function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hash !== expectedHash) return null;
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (e) { return null; }
}

let PUBLIC_URL_OBSERVED = '';
app.use((req, res, next) => {
  if (!PUBLIC_URL_OBSERVED) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'https';
    if (host && host.includes('.') && !host.startsWith('localhost')) {
      PUBLIC_URL_OBSERVED = proto + '://' + host;
      console.log('[server] observed public URL:', PUBLIC_URL_OBSERVED);
    }
  }
  next();
});
function getPublicUrl() {
  const d = process.env.PUBLIC_DOMAIN || process.env.RAILWAY_PUBLIC_DOMAIN || '';
  if (d && d.includes('.')) return /^https?:\/\//i.test(d) ? d : 'https://' + d;
  return PUBLIC_URL_OBSERVED;
}
function buildPlayUrl() { return getPublicUrl() || 'http://localhost:' + PORT; }

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.includes(path.sep + 'assets' + path.sep) ||
               /\.(png|jpg|jpeg|gif|webp|mp4|woff2?|otf|ttf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// ============ Bot identity ============
let BOT_USERNAME = '';
async function fetchBotIdentity() {
  if (!BOT_TOKEN) return;
  try {
    const r = await fetch(`${TELEGRAM_API}/getMe`);
    const d = await r.json();
    if (d && d.ok && d.result && d.result.username) {
      BOT_USERNAME = d.result.username;
      console.log('[bot] username @' + BOT_USERNAME);
    }
  } catch (e) { console.error('[bot] getMe failed:', e.message); }
}

// ============ API ============
app.get('/api/flags', (req, res) => {
  res.json({
    iap: !!BOT_TOKEN,
    publicUrl: getPublicUrl(),
    mixpanel_token: process.env.MIXPANEL_TOKEN || '',
    bot_username: BOT_USERNAME,
  });
});

app.get('/api/skus', (req, res) => {
  res.json({
    enabled: !!BOT_TOKEN,
    skus: Object.values(SKUS).map(s => ({
      id: s.id, title: s.title, description: s.description,
      price: s.price, priceUsd: s.priceUsd, grant: s.grant,
    })),
  });
});

app.get('/api/events', (req, res) => {
  // Public — clients fetch on launch to know which special tiles to render.
  res.json({
    dc: events.dc.active ? events.dc : null,
    gae: events.gae.active ? events.gae : null,
    server_ts: Date.now(),
  });
});

app.post('/api/admin/event', (req, res) => {
  const user = validateInitData((req.body && req.body.initData) || '');
  if (!user || !isAdmin(user.id)) return res.status(403).json({ error: 'admin only' });
  const patch = (req.body && req.body.patch) || {};
  if (patch.dc)  events.dc  = Object.assign({}, events.dc,  patch.dc);
  if (patch.gae) events.gae = Object.assign({}, events.gae, patch.gae);
  saveEvents(events);
  res.json({ ok: true, events });
});

app.post('/api/gae/contribute', (req, res) => {
  // Client reports GAE tiles collected in a round; server pools toward goal.
  const user = validateInitData((req.body && req.body.initData) || '');
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  const amount = Math.max(0, Math.min(10000, parseInt((req.body || {}).amount, 10) || 0));
  if (!events.gae.active || amount === 0) return res.json({ ok: true, pooled: events.gae.pooled, goal: events.gae.goal });
  events.gae.pooled = Math.min(events.gae.goal * 10, (events.gae.pooled || 0) + amount);
  saveEvents(events);
  res.json({ ok: true, pooled: events.gae.pooled, goal: events.gae.goal });
});

app.post('/api/create-invoice', async (req, res) => {
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set on server' });
  const { sku, initData } = req.body || {};
  const user = validateInitData(initData);
  if (!user) return res.status(401).json({ error: 'invalid initData' });
  const item = SKUS[sku];
  if (!item) return res.status(400).json({ error: 'unknown sku' });
  if (item.adminOnly && !isAdmin(user.id)) return res.status(403).json({ error: 'sku is admin-only' });
  const payload = JSON.stringify({ uid: user.id, sku, ts: Date.now() });
  try {
    const r = await fetch(`${TELEGRAM_API}/createInvoiceLink`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: item.title, description: item.description, payload,
        provider_token: '', currency: 'XTR',
        prices: [{ label: item.title, amount: item.price }],
      }),
    });
    const data = await r.json();
    if (!data.ok) return res.status(500).json({ error: data.description || 'telegram api failed' });
    res.json({ link: data.result });
  } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
});

app.post('/api/heartbeat', (req, res) => {
  const { initData, lang, streak, streakRiskAt } = req.body || {};
  const user = validateInitData(initData);
  if (!user) return res.status(401).json({ error: 'invalid initData' });
  rememberUser(user.id, {
    chatId: user.id, lang: lang || 'en',
    streak: streak || 0, streakRiskAt: streakRiskAt || null,
    lastActiveAt: Date.now(),
  });
  res.json({ ok: true });
});

app.get('/api/daily-seed', (req, res) => {
  const ymd = ymdUTC();
  res.json({ ymd, seed: seedForYMD(ymd) });
});

app.post('/api/score/submit', (req, res) => {
  const body = req.body || {};
  const user = validateInitData(body.initData || '');
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  // For Coin Match: score = vault lifetime coins (total coins earned ever).
  // This rewards long-term play, not one big round — better matches the
  // genre and feels closer to "richest player" leaderboard.
  const score = Math.max(0, Math.min(9999999999, parseInt(body.score, 10) || 0));
  const mode = body.mode === 'daily' ? 'daily' : 'regular';
  const ymd  = mode === 'daily' ? String(body.ymd || ymdUTC()).slice(0, 10) : null;
  if (mode === 'daily' && ymd !== ymdUTC()) return res.status(400).json({ error: 'wrong daily ymd' });
  const entry = {
    uid: user.id,
    name: (user.first_name || user.username || 'Player').slice(0, 24),
    score, ts: Date.now(),
  };
  if (mode === 'regular') {
    const i = leaderboard.regular.findIndex(e => e.uid === user.id);
    if (i >= 0) { if (score > leaderboard.regular[i].score) leaderboard.regular[i] = entry; }
    else leaderboard.regular.push(entry);
    leaderboard.regular.sort((a, b) => b.score - a.score);
    leaderboard.regular = leaderboard.regular.slice(0, 100);
  } else {
    if (!leaderboard.daily[ymd]) leaderboard.daily[ymd] = [];
    const arr = leaderboard.daily[ymd];
    const i = arr.findIndex(e => e.uid === user.id);
    if (i >= 0) { if (score > arr[i].score) arr[i] = entry; }
    else arr.push(entry);
    arr.sort((a, b) => b.score - a.score);
    leaderboard.daily[ymd] = arr.slice(0, 100);
    const cutoff = ymdUTC(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
    for (const key of Object.keys(leaderboard.daily)) if (key < cutoff) delete leaderboard.daily[key];
  }
  saveLeaderboard(leaderboard);
  const board = mode === 'regular' ? leaderboard.regular : (leaderboard.daily[ymd] || []);
  const myRank = board.findIndex(e => e.uid === user.id) + 1;
  res.json({ ok: true, rank: myRank || null, top: board.slice(0, 100) });
});

app.get('/api/leaderboard', (req, res) => {
  const mode = req.query.mode === 'daily' ? 'daily' : 'regular';
  const ymd  = mode === 'daily' ? String(req.query.ymd || ymdUTC()).slice(0, 10) : null;
  const board = mode === 'regular' ? leaderboard.regular : (leaderboard.daily[ymd] || []);
  res.json({ mode, ymd, top: board.slice(0, 100) });
});

app.post('/api/state/load', (req, res) => {
  const user = validateInitData((req.body && req.body.initData) || '');
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  const u = users[user.id];
  res.json({ ok: true, exists: !!u, state: u || null });
});
app.post('/api/state/save', (req, res) => {
  const { initData, patch } = req.body || {};
  const user = validateInitData(initData || '');
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'expected patch object' });
  const u = users[user.id] || {};
  let writes = 0;
  for (const k of SYNC_FIELDS) {
    if (patch[k] !== undefined) { u[k] = patch[k]; writes++; }
  }
  if (writes === 0) return res.json({ ok: true, writes: 0 });
  users[user.id] = u;
  saveUsers();
  res.json({ ok: true, writes });
});

app.post('/api/admin/whoami', (req, res) => {
  const user = validateInitData((req.body && req.body.initData) || '');
  if (!user) return res.json({ admin: false, user: null });
  res.json({ admin: isAdmin(user.id), user: { id: user.id, name: user.first_name || user.username || '' } });
});

app.post('/api/poll-purchases', (req, res) => {
  const user = validateInitData((req.body && req.body.initData) || '');
  if (!user) return res.status(401).json({ error: 'invalid initData' });
  res.json({ purchases: drainPending(user.id) });
});

app.post('/api/telegram-webhook', async (req, res) => {
  if (WEBHOOK_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
    return res.status(403).end();
  }
  const update = req.body || {};
  try {
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      await fetch(`${TELEGRAM_API}/answerPreCheckoutQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: q.id, ok: true }),
      });
    } else if (update.message && update.message.successful_payment) {
      const sp = update.message.successful_payment;
      try {
        const payload = JSON.parse(sp.invoice_payload);
        if (payload && payload.uid && SKUS[payload.sku]) {
          pushPending(payload.uid, payload.sku);
          notifyPurchase({
            sku: payload.sku,
            stars: sp.total_amount || (SKUS[payload.sku] && SKUS[payload.sku].price) || 0,
            userId: payload.uid,
            username: update.message.from && update.message.from.username,
          });
        }
      } catch (e) {}
    } else if (update.message && update.message.text === '/start') {
      const m = update.message;
      const lang = (m.from && m.from.language_code) || 'en';
      rememberUser(m.from.id, { chatId: m.chat.id, lang, lastActiveAt: Date.now() });
      const first = (m.from && (m.from.first_name || m.from.username)) || 'there';
      await sendWelcome(m.chat.id, first, lang);
    }
  } catch (e) {}
  res.json({ ok: true });
});

async function sendWelcome(chatId, firstName, lang) {
  if (!BOT_TOKEN) return;
  const playUrl = buildPlayUrl();
  const isRu = String(lang || '').startsWith('ru');
  const text = isRu
    ? `Привет, *${firstName}*! 💰\n\n` +
      `Добро пожаловать в *Coin Match* — Match-3 встречает охоту за сокровищами в Telegram.\n\n` +
      `🎯 *Как играть*\n` +
      `• Сделай ставку монетами перед каждым раундом\n` +
      `• Собирай 3+ одинаковых плиток в ряд\n` +
      `• Каскады дают огромные множители!\n` +
      `• Заполняй свой Хранилище — от Деревянного Сундука до Хранилища Дракона\n\n` +
      `🎁 *Что внутри*\n` +
      `• Ежедневный сундук (бесплатно каждый день)\n` +
      `• 8 уровней Хранилища с уникальными наградами\n` +
      `• Глобальная таблица лидеров\n` +
      `• Сезонные ивенты с эксклюзивными скинами\n\n` +
      `💎 Покупки только за Telegram Stars. *Никакой рекламы.*\n\n` +
      `Жми *И Г Р А Т Ь* ниже 👇`
    : `Hey *${firstName}*! 💰\n\n` +
      `Welcome to *Coin Match* — where Match-3 meets treasure hunting on Telegram.\n\n` +
      `🎯 *How to play*\n` +
      `• Bet your coins before each round\n` +
      `• Match 3+ same tiles in a row\n` +
      `• Cascades = massive multipliers!\n` +
      `• Fill your Vault — from Wooden Chest to Dragon's Hoard\n\n` +
      `🎁 *What's inside*\n` +
      `• Free daily login chest\n` +
      `• 8 vault tiers with unique rewards\n` +
      `• Global leaderboard\n` +
      `• Seasonal events with exclusive vault skins\n\n` +
      `💎 Stars-only IAP. *No ads, ever.*\n\n` +
      `Tap *PLAY* below 👇`;
  const replyMarkup = {
    inline_keyboard: [[
      { text: isRu ? '💰  И Г Р А Т Ь' : '💰  P L A Y   L O O T   M A T C H', web_app: { url: playUrl } },
    ]],
  };
  const assetsDir = path.join(__dirname, 'assets');
  const gif = ['welcome.gif', 'welcome.mp4'].map(f => path.join(assetsDir, f)).find(p => fs.existsSync(p));
  const photo = !gif && ['welcome.png', 'welcome.jpg', 'welcome.jpeg'].map(f => path.join(assetsDir, f)).find(p => fs.existsSync(p));
  const baseDomain = process.env.PUBLIC_DOMAIN || process.env.RAILWAY_PUBLIC_DOMAIN;

  if (gif && baseDomain) {
    try {
      const url = `${getPublicUrl()}/assets/${path.basename(gif)}`;
      const r = await fetch(`${TELEGRAM_API}/sendAnimation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, animation: url,
          caption: text, parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }),
      });
      if ((await r.json()).ok) return;
    } catch (e) {}
  }
  if (photo && baseDomain) {
    try {
      const url = `${getPublicUrl()}/assets/${path.basename(photo)}`;
      const r = await fetch(`${TELEGRAM_API}/sendPhoto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, photo: url,
          caption: text, parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }),
      });
      if ((await r.json()).ok) return;
    } catch (e) {}
  }
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: replyMarkup }),
    });
  } catch (e) {}
}

app.get('/api/diag', async (req, res) => {
  const out = {
    version: 'v0.7.0',
    bot_token_configured: !!BOT_TOKEN,
    bot_username: BOT_USERNAME || null,
    public_url: getPublicUrl() || null,
    data_dir: DATA_DIR,
    data_dir_writable: false,
    leaderboard_entries: leaderboard.regular.length,
    user_state_count: userState.size,
    pending_purchase_users: pendingByUser.size,
    events: { dc_active: events.dc.active, gae_active: events.gae.active },
    uptime_sec: Math.round(process.uptime()),
    webhook: null,
  };
  try {
    const probe = path.join(DATA_DIR, '.diag-probe');
    fs.writeFileSync(probe, String(Date.now()));
    fs.unlinkSync(probe);
    out.data_dir_writable = true;
  } catch (e) { out.data_dir_error = String(e && e.message || e); }
  if (BOT_TOKEN) {
    try {
      const r = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
      const d = await r.json();
      if (d && d.ok && d.result) {
        out.webhook = {
          url: d.result.url || '',
          pending_update_count: d.result.pending_update_count,
          last_error_message: d.result.last_error_message,
        };
      }
    } catch (e) {}
  }
  res.json(out);
});

app.post('/api/setup-webhook', async (req, res) => {
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set' });
  if (req.headers['x-setup-key'] !== BOT_TOKEN) return res.status(403).json({ error: 'wrong setup key' });
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const url = `${proto}://${host}/api/telegram-webhook`;
  try {
    const r = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url, secret_token: WEBHOOK_SECRET,
        allowed_updates: ['pre_checkout_query', 'message'],
        drop_pending_updates: true,
      }),
    });
    res.json({ webhook_url: url, telegram: await r.json() });
  } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
});

// ============ Notifications ============
const NOTIF_COPY = {
  energy_full: {
    ru: ['⚡ Энергия полностью восстановлена — пора матчить!',
         '⚡ Энергия на максимуме. Большой джекпот ждёт!'],
    en: ['⚡ Energy is full — time to match!',
         '⚡ Energy maxed. The big jackpot is waiting!'],
  },
  streak_risk: {
    ru: ['🔥 Серия в опасности! Сыграй до полуночи.',
         '🔥 Не теряй серию — одна игра и она в безопасности.'],
    en: ['🔥 Streak in danger! Play before midnight.',
         '🔥 Don\'t lose your streak — one quick game saves it.'],
  },
  comeback: {
    ru: ['👋 Давно не виделись! Бесплатный сундук ждёт тебя.',
         '👋 Скучаем! Бонусные монеты внутри.'],
    en: ['👋 Been a while! A free chest is waiting.',
         '👋 We miss you! Bonus coins inside.'],
  },
};
const NOTIF_CTA = { ru: '💰  И Г Р А Т Ь', en: '💰  P L A Y   N O W' };
function pickCopy(kind, lang) {
  const t = NOTIF_COPY[kind] || {};
  const v = t[lang] || t.en || [];
  return v[Math.floor(Math.random() * v.length)] || '';
}
async function sendNotification(chatId, lang, kind) {
  if (!chatId || !BOT_TOKEN) return false;
  const text = pickCopy(kind, lang);
  if (!text) return false;
  const replyMarkup = {
    inline_keyboard: [[{ text: NOTIF_CTA[lang] || NOTIF_CTA.en, web_app: { url: buildPlayUrl() } }]],
  };
  try {
    const r = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    });
    return !!(await r.json()).ok;
  } catch (e) { return false; }
}
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
function canSendNotif(st, kind, now) {
  const lastKind = (st.notifLast || {})[kind] || 0;
  if (now - lastKind < ONE_DAY) return false;
  const lastAny = st.notifLastAny || 0;
  if (now - lastAny < 6 * ONE_HOUR) return false;
  st.notifTimes = (st.notifTimes || []).filter(t => now - t < ONE_DAY);
  if (st.notifTimes.length >= 3) return false;
  return true;
}
function recordNotifSent(st, kind, now) {
  st.notifLast = st.notifLast || {};
  st.notifLast[kind] = now;
  st.notifLastAny = now;
  st.notifTimes = (st.notifTimes || []).concat(now);
}
async function notifyLoop() {
  const now = Date.now();
  for (const [uid, st] of userState) {
    if (!st.chatId) continue;
    if (st.streak > 0 && st.streakRiskAt && st.streakRiskAt > now && (st.streakRiskAt - now) < 4 * ONE_HOUR
        && (now - (st.lastActiveAt || 0)) > 30 * 60 * 1000
        && canSendNotif(st, 'streak_risk', now)) {
      if (await sendNotification(st.chatId, st.lang || 'en', 'streak_risk')) recordNotifSent(st, 'streak_risk', now);
      continue;
    }
    if (st.lastActiveAt && (now - st.lastActiveAt) > 3 * ONE_DAY && canSendNotif(st, 'comeback', now)) {
      if (await sendNotification(st.chatId, st.lang || 'en', 'comeback')) recordNotifSent(st, 'comeback', now);
      continue;
    }
  }
}

// ============ Boot ============
app.listen(PORT, () => {
  console.log(`Coin Match serving on port ${PORT}`);
  console.log(`IAP: ${BOT_TOKEN ? 'enabled' : 'DISABLED — set BOT_TOKEN env var to turn on'}`);
  console.log(`[events] dc=${events.dc.active ? events.dc.id : 'off'} gae=${events.gae.active ? events.gae.id : 'off'}`);
  if (BOT_TOKEN) {
    fetchBotIdentity();
    setInterval(notifyLoop, FIVE_MIN);
    console.log('[notify] loop armed — every 5 min');
  }
});

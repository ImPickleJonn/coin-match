# Coin Match

**Genre:** Match3 + Coin Looter hybrid Telegram Mini App.
**Premise:** Match tiles → bet your coins → chase cascade multipliers → build your treasure vault.

## Quick start

1. Install Node.js (LTS) from https://nodejs.org
2. Double-click `RUN.bat`
3. Browser opens at http://localhost:3000

## Architecture

- `index.html` — single-file game frontend (HTML + canvas + plain JS, no build step).
- `server.js` — Express server: Telegram Stars IAP, leaderboard, state sync, bot welcome.
- `RUN.bat` — Windows one-click launcher.
- `data/` — local persistence (mirrors Render disk at `/data`).
- `versions/` — manual rollback snapshots of `index.html`.

## Core loop

1. **Bet** coins (1 / 5 / 25 / 100 / 500) before each round
2. Swap tiles to make matches of 3+ on an 8×8 grid
3. Matches pay `tiles × bet × cascade_mult × tile_rarity` coins
4. **Cascade** chains escalate: ×1 → ×1.5 → ×2 → ×3 → ×5 → ×10
5. Round ends after 10 moves; coins fly into the **Vault**
6. Vault visibly tiers up: Wooden Chest → Iron → Bronze → Silver → Gold → Diamond → Royal → Dragon's Hoard
7. **Energy** (5 max, 1/15min) gates session length

## Special tiles

- 💰 Money Bag — 3× cell value (~3% spawn)
- 🎰 Wild — matches any color (~1% spawn)
- ⭐ Event Token — Dynamic Currency for live ops (server-flagged events only)
- 🎁 GAE Tile — General Accumulation Event token (community goal pool)

## Deployment

- **Render** (primary) — push to `main`, auto-deploys via `render.yaml`.
- **Railway** (warm backup) — same repo, auto-deploys via `railway.json`.

Required env vars on Render/Railway:
- `BOT_TOKEN` — your Telegram bot token (sync: false on Render)
- `DATA_DIR=/data` — points at the mounted persistent disk
- `TELEGRAM_ADMIN_IDS=23040617` — comma-separated Telegram user IDs with admin perms
- `PUBLIC_DOMAIN` — auto-populated on Render via `fromService`

After first deploy, hit `POST /api/setup-webhook` with header `x-setup-key: $BOT_TOKEN` to register the Telegram webhook.

## Workflow rules

- Edit `index.html` directly. Refresh `localhost:3000` to test.
- Before substantive edits, snapshot to `versions/loot-match-vN.html` where N is highest existing N + 1. **Use numeric sort**, not alphabetical (v10 sorts before v9 alphabetically).
- After any edit, run the parse-check:
  ```
  node -e "const html=require('fs').readFileSync('index.html','utf8'); const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]; let i=0; for(const s of m){ i++; try { new Function(s[1]); } catch(e) { console.log('FAIL block '+i+': '+e.message); process.exit(1); } } console.log('OK ('+i+' blocks)');"
  ```

## v0.1 scope (this commit)

- 8×8 match3 board, swap-to-match, cascade detection
- Bet ladder + coin payouts + vault meta
- Energy regen
- Daily login chest
- 20-language UI scaffold (EN + RU full at launch)
- Stars IAP: coin packs, energy refills, vault skins
- Leaderboard (global + daily)
- Liveops event-tile scaffolding (DC + GAE)

## What's coming

- Match3 boosters (rocket / bomb / color bomb special tiles)
- Animated coin-rain VFX on cascades
- Vault skin shop (tier-cosmetic unlocks)
- Holiday liveops events (Halloween pumpkins, Christmas presents)
- Achievements + mission system
- Weekly tournament with Stars prizes
- Mascot character + tutorial

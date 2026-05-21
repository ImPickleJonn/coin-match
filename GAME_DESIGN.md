# Coin Match — Game Design Document

**Version:** v1.0 design (pre-build)
**Status:** Active design — replaces v0.2 build at `index.html`
**Target platform:** Telegram Mini App (single-file HTML, Stars IAP)
**Date:** 2026-05-20

---

## 1 · TL;DR

**Coin Match is Coin Master with a Match3 grid replacing the slot machine.**

You match tiles. Every match drops gold and charges one of three meters (Attack / Raid / Shield) — exactly like getting 3 hammers / 3 pigs / 3 shields on Coin Master's slot. When a meter fills, you smash or steal from the **Match Master** (a rotating target above your grid) and use the gold to build an island. Finish the island → new theme, new tile emojis, harder Match Masters.

Energy gates the loop. Stars refill it. No ads, ever.

---

## 2 · The Critical Insight (why this is a $100M opportunity)

Coin Master built a $4M/day business by replacing skill-based Match3 with luck-based slots. **The slot is the dopamine engine, the village is the retention engine, raiding is the social engine.**

Match3 is the most-installed mobile genre on Earth (Candy Crush, Royal Match), and it strips the social-casino stigma — players can install "match-3" guilt-free where they'd hesitate to install "slots."

**Coin Match keeps everything that makes Coin Master a $4M/day game** (the village, raids, social attack, Match Master target, building-upgrade loop) **but replaces the slot with a Match3 grid.** Players get:

- The skill-feel of Match3 (no gambling stigma → mass appeal, App-Store-friendly)
- The bet-escalation dopamine of slots (cascades = jackpot moments)
- Coin Master's village/raid/social retention loop (proven $4M/day)

Tetris Block Party (PlayStudios, 2024+) validates the genre-fusion direction: drag-place Tetris + Heist + Attack friends' parties is already a top-grossing puzzle hybrid. We do the same with Match3, which has 10× the audience.

---

## 3 · Visual Style — Bright Candy Crush

**Override of v0.2's dark-purple Match Icon palette.** v1 design is bright, cheerful, instant-pop. Royal Match / Candy Crush Saga is the reference, not Match Moji.

**Background:**
- Sky gradient: `#7ecbff` (top) → `#ffd86b` (bottom horizon glow) → optional white cloud SVG silhouettes drifting slowly
- Optional: sea-blue gradient for nautical themes, sandy yellow for desert themes — palette can vary by **island theme** while staying bright

**Tile style:**
- Each tile = rounded white/cream rectangle (radius 18% of cell width) with bright emoji on top
- 2px outer dark border for cartoon-outline pop (`#2a1a04` at 30% alpha)
- Glossy specular sheen: white-to-transparent gradient on top half of each tile
- Soft drop shadow: `0 3px 0 rgba(0,0,0,0.18), 0 6px 8px rgba(0,0,0,0.12)`
- Hover/selected ring: thick gold halo (`#ffd864` × 4px) with outer glow

**Typography:**
- Display font for big numbers: heavy rounded sans (`"Lilita One"`, `"Fredoka One"`, fallback `-apple-system` weight 900)
- Body: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui`
- All numbers `font-variant-numeric: tabular-nums`

**VFX library (CSS + canvas):**
- **Coin rain:** 8–16 gold-coin sprites burst up from each cleared tile, fall with gravity, fade
- **Confetti burst:** cascades depth 3+ spray rainbow paper
- **Sparkles:** twinkle-stars on selected tile, on cascade text, on the Match Master target portrait
- **Bouncy spring:** every interactive element uses `cubic-bezier(0.34, 1.56, 0.64, 1)` for that "candy bounce"
- **Number ticker:** gold counter rolls up digit-by-digit on match (not instant)

**Palette tokens (v1 default theme — Pirate Cove):**
```css
--sky-top:        #7ecbff;
--sky-bottom:     #ffd86b;
--cloud:          #ffffff;
--tile-bg:        #fff5e1;
--tile-shadow:    #d4a96b;
--ink:            #2a1a04;
--gold:           #ffc94a;
--gold-deep:      #c9921a;
--gold-glow:      #ffe98a;
--candy-red:      #ff5c7a;
--candy-pink:     #ffafd0;
--candy-blue:     #4fb2ff;
--candy-purple:   #b878ff;
--candy-green:    #6cd47a;
--shield-blue:    #4fb2ff;
--pig-pink:       #ff77a8;
--hammer-orange:  #ff8c3a;
```

**Anti-pattern lock:** No dark purple-black background. No neon-on-dark. We are the OPPOSITE of Match Moji.

---

## 4 · Core Loop

### 30-second loop (a single grid move)
1. Player sees grid + Match Master target above
2. Swaps two adjacent tiles → produces match → costs 1 energy
3. Tiles clear, gold counter rolls up, coin rain VFX
4. Tiles fall, new tiles drop in, **cascade resolves** (1×, 1.5×, 2×, 3×, 5×, 10× multipliers)
5. Matched charge-tiles fill their respective meters (Hammer / Pig / Shield)
6. If a meter just filled → it pulses and shows "TAP TO RAID" / "TAP TO ATTACK" / "ARMED"

### 2-minute loop (a session)
1. Player opens app → sees current Match Master, their village, their estimated gold pile
2. Plays 10–20 matches, fills a meter
3. Taps the meter → launches mini-event:
   - **Hammer full** → "SMASH" mode → see 3 buildings on Master's village → tap one to destroy → gain bonus gold + show Master losing a building
   - **Pig full** → "RAID" mode → see 4 dig spots → tap up to 3 → reveal gold-pile rewards
   - **Shield full** → automatic — armed for next incoming attack
4. Returns to grid, keeps matching
5. Energy drops to 0 → exits

### 10-minute loop (a play arc)
- Player accumulates gold over multiple sessions
- Enough gold → builds/upgrades 1–2 structures in their own village
- Each structure costs more than the last (Coin Master economy)
- Visible progress bar shows island completion

### Daily loop
1. Daily chest claim on first launch (Day 1 → Day 7 cycle)
2. Energy refills overnight (max 30 in 45 min)
3. Notification: "Your village was attacked while you slept! Repair?" or "New Match Master available!"
4. Play one or two sessions

### Weekly loop
- Complete an island (all 4–6 structures maxed) → next island unlocks → new theme, new emojis, harder Masters

### Lifetime
- 8 islands → tier-up unlocks scale 4× each
- Total content: ~200+ structure-build moments

---

## 5 · The Grid & Match Mechanics

### Grid
- **7 columns × 7 rows = 49 tiles** (same as Match Icon, locked)
- Min match length: 3 tiles in a row (horizontal or vertical)
- Diagonal matches: **no**
- L / T-shape matches: detected as overlapping H+V matches, all tiles clear

### Tile roster (v1 — 5 regular + 3 charge + 3 special = 11 types)

**Regular tiles (5 colors — theme-dependent emoji):**

| Slot | Pirate Cove (default) | Desert Oasis | Egyptian Pyramid |
|---|---|---|---|
| 0 | 💎 Gem | 🌵 Cactus | 🐍 Snake |
| 1 | ⚓ Anchor | 🐪 Camel | 🏺 Urn |
| 2 | 🗡️ Cutlass | 🌴 Palm | 👁️ Eye |
| 3 | 🏴‍☠️ Flag | ☀️ Sun | 𓂀 Ankh |
| 4 | 🪙 Coin | 💧 Water | 🪲 Scarab |

**Charge tiles (3 — constant across all themes, system glyphs):**

| Emoji | Name | Match effect |
|---|---|---|
| 🔨 | Hammer | Match 3+ → +N to **Attack meter** (N = match size) |
| 🐷 | Piggy | Match 3+ → +N to **Raid meter** |
| 🛡️ | Shield | Match 3+ → +N to **Shield meter** |

**Special tiles (rare drops):**

| Emoji | Name | Spawn rate | Effect |
|---|---|---|---|
| 💰 | Money Bag | ~3% | Cell value × 5 when matched (huge gold burst) |
| 🎰 | Wild | ~1% | Matches any color when adjacent in a run |
| ⭐ | Master Star | ~0.5% | When matched, immediately fills 5 units across ALL meters + free spin-style bonus |

### Spawn-rate breakdown
- 65% regular fruit/treasure tiles (13% each color)
- 10% Hammer
- 10% Piggy
- 10% Shield
- 4.5% combined specials (Money Bag / Wild / Master Star)

### Match scoring formula
```
match_gold = SUM(tile_value) × bet_multiplier × cascade_multiplier
```

Where:
- `tile_value`: 1.0 (regular) / 5.0 (Money Bag) / 1.0 (Wild) / 1.0 (Master Star) — bonus from specials comes via secondary effects, not base value
- `bet_multiplier`: 1× / 2× / 3× / 5× / 10× (player chooses; tier-locked)
- `cascade_multiplier`: 1, 1.5, 2.0, 3.0, 5.0, 7.0, 10.0, 15.0, 20.0 (depth-indexed)

### Charge accrual formula
```
meter_charge = (matched_charge_tiles) × cascade_multiplier × bet_multiplier
```
This is critical: **higher bets + deeper cascades charge attacks faster.** Big bets are how heavy spenders blitz Match Masters.

### Cascade tiers
| Depth | Multiplier | VFX |
|---|---|---|
| 1 | 1× | basic pop |
| 2 | 1.5× | gold sparkle ring around prize box |
| 3 | 2× | "CASCADE!" text + small confetti |
| 4 | 3× | "BIG CASCADE!" + bigger confetti + low haptic |
| 5 | 5× | "MEGA CASCADE!" full-screen splash + heavy haptic |
| 6 | 7× | "ULTRA CASCADE!" + screen shake |
| 7+ | 10×/15×/20× | "GOD CASCADE!" + rainbow border + sustained 2s celebration |

### Reshuffle
If no possible match exists, the board auto-shuffles with a "Reshuffling..." toast. Shuffle does NOT cost energy.

---

## 6 · Energy & Bet Multiplier

### Energy
- Max default: **30**
- Cost per match: 1 (only successful match-producing swaps; failed swaps free)
- Regen: **1 per 90 seconds** (full refill in 45 minutes)
- Can be refilled via Stars or daily chest
- Below 5: energy bar pulses red

### Bet multiplier
- Inline button next to energy bar, "**BET ×2**" / "**BET ×5**" etc
- Tap once to cycle up; long-press / double-tap to cycle down (or modal selector)
- Multiplies BOTH the energy cost AND the gold/charge rewards proportionally
- Locked by current island:

| Bet | Multi | Energy cost / match | Unlocks at island |
|---|---|---|---|
| Bronze | 1× | 1 | Always |
| Silver | 2× | 2 | Always |
| Gold | 3× | 3 | Pirate Cove complete |
| Diamond | 5× | 5 | Egyptian Pyramid complete |
| Royal | 10× | 10 | Aztec Temple complete |

### Why "bet" makes sense without rounds
Higher bet = burn through your energy faster = bigger gold-per-minute. It's like choosing slot machine stakes in Coin Master. Whales gravitate to max bet for fastest village progression.

---

## 7 · The Charge System (Tetris Block Party × Coin Master)

The grid IS the slot machine. Match3 outcomes map to Coin Master's slot symbols:

### 🔨 Attack Meter — "SMASH"
- **Fills:** match Hammer tiles
- **Capacity:** 20 charge units
- **Trigger:** tap full meter → "SMASH" mini-event
- **Action:** opens a view of current Match Master's village. Camera pans across. Player sees 3 structures of the Master. Tap one → animated hammer slams down → structure shows damage → player gains `BASE_SMASH × bet × tier_factor` gold (typically 500–50,000 depending on island). The smashed structure is **broken** for that Master — they must pay gold to repair it.
- **Coin Master parallel:** 3-Hammer slot outcome
- **Visual:** giant cartoon hammer falls, screen shakes, building bursts into 8 wooden splinters

### 🐷 Raid Meter — "RAID"
- **Fills:** match Piggy tiles
- **Capacity:** 20 charge units
- **Trigger:** tap full meter → "RAID" mini-event
- **Action:** opens a 4-spot dig view of Match Master's pile. Player taps **up to 3 spots**. Each spot reveals a gold amount (random within a range). Total `BASE_RAID × bet` gold (typically 1,000–100,000). Gold is subtracted from Master's pile.
- **Coin Master parallel:** 3-Pig slot outcome (raid 4 dig spots, pick 3)
- **Visual:** piggy mascot digs spots, gold geyser erupts on hits

### 🛡️ Shield Meter — "ARMED"
- **Fills:** match Shield tiles
- **Capacity:** 20 charge units
- **Trigger:** automatic — when full, you get 1 shield charge stockpiled
- **Action:** the next incoming attack on YOUR village (from another player or bot) is blocked. Shield consumed.
- **Stockpile:** up to 3 shields stockable
- **Coin Master parallel:** 3-Shield slot outcome
- **Crucial Coin Master rule we keep:** shields block ATTACKS but NOT RAIDS — gives raid mechanic teeth

### Charge UI (under Match Master block, above grid)
Three horizontal segmented bars stacked:
```
🔨 Attack  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░    9/20
🐷 Raid    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  20/20  TAP!  ← pulses gold
🛡️ Shield  ▓▓▓░░░░░░░░░░░░░░░░░    3/20  (×1 stocked)
```

When any meter fills, a glowing "TAP!" callout pulses on it. Meter resets to 0 after trigger.

---

## 8 · The Match Master (above the grid)

The whole top of the screen, above the grid, shows your **current target**: a rotating "Match Master" whose village you can raid.

### Match Master block layout
```
┌─────────────────────────────────────┐
│  MATCH MASTER  ·  Captain Pegleg     │
│  ┌─────────────────────────┐         │
│  │ 🏴‍☠️ Pirate Cove   Lvl 4 │         │  ← portrait of village
│  │ 💰 12,400  · 🏚️ × 5     │         │  ← stealable + structures
│  └─────────────────────────┘         │
│  Rotates in 14:32                    │
└─────────────────────────────────────┘
```

- **Name + portrait** (auto-generated for bots, real name for real players)
- **Village preview** (compressed graphic of their current build state)
- **Estimated gold pile** (what you can raid)
- **Structure count** (what you can smash)
- **Rotation countdown** — every 30 minutes a new Master is selected

### Selection rules
**v0.3 (launch — no real PvP):**
- Server maintains 100 "bot Master" personalities with persistent village states
- Each bot has: name, portrait emoji, current island theme, gold pile (200–500K), 4–6 structures
- Bots get "attacked"/"raided" by all players → server tracks state → bots "repair" damaged buildings every 30 min on server tick
- Bot gold pile auto-refills to 60% of cap every 30 min so they remain raidable
- Bot's pile cap scales with current Master's "level" — higher-level Masters have bigger piles
- Players see different Masters at different times (rotation)
- Match Master rotation = the 100 bots cycle through, each player sees one for 30 min

**v0.5 (real PvP, async):**
- Match Master pool starts mixing real players from leaderboard
- A real player can be a Match Master target while they're offline
- Async raids: my raid happens to their server-side village state, they see "you were raided by X" on next login
- Shields you have armed auto-defend you when offline

**v0.7 (friends):**
- Invite friends → they appear in a "My Friends" rotation
- Can choose to raid friends vs strangers
- Friend-raid rewards = slightly less gold but no league penalty

### What can be stolen / broken
- **Smash (Attack):** breaks one of 4–6 structures. Master pays gold to repair (gold drained from their pile). Player who smashed earns `0.3 × repair_cost` as bonus.
- **Raid:** takes gold from Master's pile directly. Capped at 10% of their pile per raid so no one gets blanked.

### Anti-grief rules
- A single player can't raid the same Master more than 3 times in a 30-min rotation
- Real PvP raids on real offline players are capped at 1 per 12 hours per pair

---

## 9 · Village & Island Building (the gold sink)

### Your village
A persistent island scene on the "Village" tab. Always your current theme. Has **4–6 buildable structures** + a fixed background (palm trees, ocean, etc.).

### Structures
Each has 5 upgrade levels. Each level costs `base × 2^level` gold. Levels visually upgrade the structure (a tent → cabin → house → tower → mansion).

When all structures are at level 5 → **island complete** → confetti, big modal, next island unlocks.

### The 8 Islands

| # | Theme | Gold range | Tile palette (5 colors) |
|---|---|---|---|
| 1 | **Pirate Cove** | 0–5K | 💎 ⚓ 🗡️ 🏴‍☠️ 🪙 |
| 2 | **Desert Oasis** | 5K–25K | 🌵 🐪 🌴 ☀️ 💧 |
| 3 | **Egyptian Pyramid** | 25K–100K | 🐍 🏺 👁️ 𓂀 🪲 |
| 4 | **Viking Village** | 100K–500K | ⚔️ 🪓 🛡️ ⚒️ ❄️ |
| 5 | **Underwater Atlantis** | 500K–2M | 🐠 🐚 🦑 🧜‍♀️ 🔱 |
| 6 | **Aztec Temple** | 2M–10M | 🦜 🐆 🌽 🌶️ 🗿 |
| 7 | **Dragon's Lair** | 10M–50M | 🐉 🔥 💎 🦴 ⚱️ |
| 8 | **Royal Palace** | 50M+ | 👑 💎 🍷 🎻 🦢 |

### Structures by island (example: Pirate Cove)
1. **Lighthouse** (base 200g)
2. **Tavern** (base 300g)
3. **Dock** (base 500g)
4. **Captain's House** (base 800g)
5. **Treasure Pile** (base 1,200g)
6. **Pirate Flag** (base 2,000g)

Total to fully complete Pirate Cove: ~6,200g × (1+2+4+8+16) sum = ~192K gold per structure × 6 = decision: keep total around ~50K–80K total cost so v1 players see an island finish within 2–5 days of casual play.

(Exact economy tuning happens in the v0.3 build pass — server-side flag-controlled.)

### Why structures matter beyond cosmetics
- **They're what enemies smash.** Without structures, the village has no surface area to raid. So building = retention + risk.
- **They generate passive gold.** Each structure at level 1+ generates `base × level` gold per hour, capped at 4-hour collection (Coin Master's pet/pile timer pattern). Collect when you open the app.
- **They unlock the next island** (must finish current to unlock next).

---

## 10 · Boosters (limited, Stars-purchasable, don't cost energy)

Boosters give the player ability to do **more matches without energy cost** — this is the literal Pickle spec. They live in a row at the bottom or in the booster slot above the bottom nav.

| Booster | Emoji | Effect | Stock cost (Stars) |
|---|---|---|---|
| **Hammer** | 🔨 | Manually destroy any 1 tile (free match doesn't cost energy) | 49⭐ × 5 |
| **Rocket** | 🚀 | Clears the entire row + column you tap (no energy) | 99⭐ × 5 |
| **Bomb** | 💣 | Clears a 3×3 area | 99⭐ × 5 |
| **Color Bomb** | 🌈 | Clears every tile of a chosen color | 149⭐ × 3 |
| **Shuffle** | 🔄 | Re-shuffle the board (no energy) | 49⭐ × 5 |
| **Free Spin** | ⚡ | Next 5 matches cost 0 energy | 99⭐ × 5 |
| **Double Bet** | ⚡⚡ | Next match has 2× bet multiplier (stacks with current bet) | 79⭐ × 5 |
| **Master Strike** | ⭐ | Instantly fills one chosen meter to full | 149⭐ × 3 |

### Booster acquisition
- **Stars purchase** (primary)
- **Daily chest** (day 4 + day 7 give 1–2 random boosters)
- **Island completion bonus** (each island finish grants a booster pack)
- **Match Master takedown bonus** (rare: smashing a final structure on a Master's village → 1 random booster)

### Anti-pay-to-win lock
- Boosters never appear in the booster row by default — you have to BUY or EARN them, then tap to use
- Free-to-play players still complete the loop, just slower
- "Best value" Stars packs are 199⭐ Starter Pack (10K gold + 5 ⚡ + Pirate skin) and 500⭐ Battle Pass (30 days × 2 daily chest rewards)

---

## 11 · Telegram Stars IAP — Full SKU Catalog

All prices in Telegram Stars (XTR). USD shown for reference (1⭐ ≈ $0.013).

### Currency
- **Energy Refill +5** — 40⭐ ($0.52)
- **Energy Refill +30 (full)** — 199⭐ ($2.59)
- **Coin Pile 5K** — 99⭐ ($1.29)
- **Coin Stack 20K** (+25% bonus) — 299⭐ ($3.89)
- **Coin Vault 50K** (+40% bonus) — 599⭐ ($7.79)
- **Coin Mountain 100K** (+60% bonus) — 999⭐ ($12.99)
- **Coin Continent 250K** (+80% bonus) — 1999⭐ ($25.99)

### Boosters
- **Hammer ×5** — 49⭐
- **Shuffle ×5** — 49⭐
- **Rocket ×5** — 99⭐
- **Bomb ×5** — 99⭐
- **Color Bomb ×3** — 149⭐
- **Free Spin ×5** — 99⭐
- **Double Bet ×5** — 79⭐
- **Master Strike ×3** — 149⭐

### Bundles
- **Starter Pack** (10K gold + 5⚡ + Pirate skin + Hammer×5) — 199⭐ ($2.59) — **featured**
- **Booster Bundle** (all 7 booster types × 3 each) — 399⭐
- **Whale Pack** (250K gold + 30⚡ + Dragon skin + Color Bomb×5) — 1999⭐

### Defense
- **24h Shield** (auto-block all incoming attacks for 24h) — 99⭐
- **48h Shield** — 179⭐
- **7-day Shield** — 599⭐

### Cosmetic skins (vault / island)
- **Pirate skin** (alt theme for Pirate Cove buildings) — 200⭐
- **Dragon skin** — 250⭐
- **Royal skin** — 250⭐
- **Neon skin** (cyberpunk recolor of any current island) — 300⭐

### Battle Pass
- **30-Day Battle Pass** — 500⭐ ($6.49)
  - 2× daily chest rewards
  - Exclusive seasonal skin
  - +50% gold from raids
  - Exclusive booster slot (Master Strike ×1/day free)

### Liveops event bundles (rotating)
- **Halloween Pumpkin Pack** (during DC event) — 299⭐
- **Christmas Festive Pack** — 299⭐

### Admin / test
- **1⭐ test purchase** (admin-only, grants 100 gold) — 1⭐

---

## 12 · Social Mechanics — Rollout Roadmap

### v0.3 (launch)
- **Bot-only Match Masters** — 100 bot personalities cycle through everyone's screens
- **Global leaderboard** (already implemented in v0.2) — top 100 by lifetime gold
- **Daily leaderboard** — top 100 today
- **Bot villages** have persistent state — when you smash a building it stays smashed for the rotation window
- **No friend lists yet**

### v0.5 (PvP-lite — async)
- Real players appear in the Match Master pool when they're offline
- Async raid: your raid hits their server-side village state
- They see "You were raided by X for Y gold" notification (in-bot message via Telegram)
- Shield system protects offline players who have shields stocked
- **No real-time PvP — everything is async** (mirrors Coin Master's actual model)

### v0.7 (friends + clans)
- Invite friends via Telegram deep link → they appear in "My Friends" tab
- See friend villages, raid them
- Friend-vs-stranger toggle
- **Clans** (5–20 players): clan chest contributions, clan boss raid (everyone in clan damages one mega-Master together)
- Clan leaderboard

### v0.9 (real-time events)
- **Weekly tournament:** top 50 in your bracket win Stars prizes
- **Boss event:** every Friday 18:00 UTC a "Mega Master" appears for everyone simultaneously — all players smash the same boss village together (community goal)
- **Power Hour:** daily 1-hour window with 2× gold

---

## 13 · Liveops Events (DC + GAE scaffolding)

Already wired in v0.2 server — keep it.

### Dynamic Currency (DC) events
Server flips `events.dc.active = true` with config:
- Token emoji (e.g. 🎃 for Halloween)
- Target token count (e.g. 50)
- Reward SKU (e.g. exclusive Haunted Cove skin)
- End timestamp

While active:
- 4% of new tiles spawn as DC tokens
- Matching them adds to `state.eventTokens`
- UI shows progress bar "🎃 32/50"
- Hit target → reward auto-granted

### General Accumulation Event (GAE)
Community goal — every player's contribution pools toward a shared target.
- E.g. "Collect 100M 🎁 tokens together → everyone gets 5,000 gold"
- 8% spawn rate when active (slightly higher than DC)
- Server tracks pool, broadcasts progress to all clients
- Hits target → all players get the reward

### Event calendar (suggested)
- **Halloween** (Oct 25 – Nov 2): Pumpkin DC + Haunted Cove skin
- **Christmas** (Dec 15 – Jan 5): Snowflake DC + North Pole skin + GAE for community feast
- **Lunar New Year** (date varies): Lantern DC + Forbidden City skin
- **Valentine's** (Feb 12 – Feb 16): Heart DC + Love Castle skin
- **Easter** (date varies): Egg DC + Bunny Burrow skin
- **Summer Festival** (Jun 20 – Jul 5): Sun DC + Tropical Resort skin
- **World Cup** (during tournaments): Soccer ball DC, team-color skins

---

## 14 · UI Layout — Top-to-Bottom Wireframe

```
┌─────────────────────────────────────────────────────┐
│ [💰 12,345]                          [⚙️] [🛒] [👥]│  ← Top bar (small, light)
├─────────────────────────────────────────────────────┤
│                                                      │
│   MATCH MASTER  ·  Captain Pegleg                   │
│   ┌──────────────────────────────────┐              │
│   │ 🏴‍☠️ Pirate Cove   Lvl 4           │              │  ← Match Master block
│   │ 💰 14,200       🏚️ × 5 buildings │              │
│   └──────────────────────────────────┘              │
│   🔨 Attack ▓▓▓▓░░░░░░░░░░ 9/20                    │
│   🐷 Raid   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 20/20  TAP!       │  ← Charge meters
│   🛡️ Shield ▓░░░░░░░░░░░░░░ 3/20  (×1)            │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────────────────────────────┐              │
│   │  LAST MATCH                       │              │  ← Per-match gold display
│   │  +1,234 💰   CASCADE x3.0!        │              │
│   └──────────────────────────────────┘              │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│          ┌─────────────────────────┐                │
│          │ 💎 ⚓ 🗡️ 🏴‍☠️ 🪙 🔨 🐷  │                │
│          │ ⚓ 🗡️ 🏴‍☠️ 🪙 💎 🐷 🛡️  │                │
│          │ 🗡️ 🏴‍☠️ 🪙 💎 ⚓ 🛡️ 🔨  │                │  ← 7×7 grid
│          │ 🏴‍☠️ 🪙 💎 ⚓ 🗡️ 🔨 🐷  │                │     (bright candy tiles)
│          │ 🪙 💎 ⚓ 🗡️ 🏴‍☠️ 🐷 🛡️  │                │
│          │ 💎 ⚓ 🗡️ 🏴‍☠️ 🪙 🛡️ 🔨  │                │
│          │ ⚓ 🗡️ 🏴‍☠️ 🪙 💎 💰 🎰  │                │
│          └─────────────────────────┘                │
│                                                      │
├─────────────────────────────────────────────────────┤
│  ⚡ ▓▓▓▓▓░░░░░░ 18/30   3:42          [BET ×2 ▲]   │  ← Energy + bet
├─────────────────────────────────────────────────────┤
│  [🔨 5] [🚀 0] [💣 2] [🌈 1] [🔄 3]                  │  ← Booster row
├─────────────────────────────────────────────────────┤
│  🏠 Village    🎰 Play    🛒 Shop    👥 Friends     │  ← Bottom nav
└─────────────────────────────────────────────────────┘
```

### Bottom nav tabs
1. **🏠 Village** — your island, structures, build/upgrade UI, daily chest, gold-pile collection
2. **🎰 Play** — DEFAULT — the grid screen above
3. **🛒 Shop** — Stars purchases (currency, boosters, skins, battle pass)
4. **👥 Friends** — invite, friend list, leaderboard, Match Master history

### Pickle's spec compliance check
✅ Bottom nav bar — present, 4 tabs
✅ Energy + bet multiplier button above nav — present
✅ Grid above that — present, 7×7
✅ Per-match gold display above grid — present
✅ Match Master target above gold display — present (with stealable preview)
✅ Charge meters near Match Master block — present (Tetris Block Party pattern: matches charge events)

### Booster row placement
The booster row sits BETWEEN energy/bet and the bottom nav. This makes it always-accessible during a match without crowding the playing field. Empty booster slots show grayed-out icons with "BUY" badges.

### Sizing on a 360px-wide phone
- Top bar: 44px
- Match Master block: ~110px (compact, scrollable if Lvl > 5)
- Charge meters: 60px (3 thin bars × 18px)
- Per-match gold display: 50px (pulses bigger during cascades)
- Grid: ~308px (7 × 44px cells)
- Energy + bet row: 36px
- Booster row: 52px
- Bottom nav: 56px
- **Total: ~716px** — comfortable on phones ≥ 720px viewport, scrolls slightly on smaller

---

## 15 · First-Time UX (FTUE)

5-step onboarding modal sequence on first launch:

### Step 1 — Welcome
"💰 Welcome to Coin Match! Match tiles, steal gold, build your island."
[CTA: NEXT]

### Step 2 — Tutorial match
- Forced grid state with an obvious 3-match available
- Animated hand pointer shows the swap
- Player must execute it → coin rain plays → "+50 GOLD"
[Auto-advance after match]

### Step 3 — Meet the Master
"This is Captain Pegleg — the **Match Master**! Match these 🔨 tiles to charge up an attack on his village."
- Highlights 🔨 tiles on the grid
- Tutorial match charges the Attack meter
[Auto-advance when meter ticks]

### Step 4 — First attack
- Hammer meter pre-filled to 100% in tutorial
- "TAP THE METER!"
- Player taps → SMASH mini-event runs → "+200 BONUS GOLD"
[Auto-advance]

### Step 5 — Your village
"This gold builds YOUR island. Tap a structure to build!"
- Switches to Village tab
- One structure highlighted with "BUILD" button
- Player taps → coin animation → structure level 1 appears
[Tutorial complete — 1-time 500g + 1 hammer booster gift]

### Returning player
- Skip tutorial
- Daily chest auto-opens (if claimable)
- Energy regen catches up
- Returns to Play tab default

---

## 16 · Audio (style notes for v1)

All audio is optional (mute toggle in settings) but defaulted ON.

### Music
- **Bright tropical/marimba** track for default Pirate Cove
- Theme switches per island (desert flute, Egyptian harp, Viking horns, etc.)
- BPM ~100 — gentle, not too excited
- Loop seamlessly, ~90s loops

### SFX
- **Swap success:** soft "plink" + bouncy pop
- **Match clear:** "tink" per tile + brief coin chime
- **Cascade x1.5:** ascending arpeggio
- **Cascade x3+:** rising tension whoosh + impact
- **MEGA cascade:** big slot-machine jackpot bell
- **Charge meter fill:** rising 4-note chime
- **Charge meter full:** "READY!" voice line (TTS, or short SFX)
- **Smash:** cartoon hammer thud + wood crash
- **Raid:** piggy oink + gold geyser
- **Shield activate:** metallic clang
- **Village build:** carpentry hammer × 3 + brief fanfare
- **Daily chest:** sparkle + chime
- **Stars purchase confirm:** royal fanfare

### Voice (optional, v0.5+)
- Single warm narrator voice for tutorial steps
- Match Master taunts ("You'll never get me!") on rotation
- Localized to EN + RU at minimum

---

## 17 · Tech Stack & Constraints

### File layout (single-HTML constraint locked)
```
loot-match-project/
├── index.html              ← entire game (HTML + CSS + JS, no build step)
├── server.js               ← Express + Stars IAP + state sync + bot Masters
├── RUN.bat                 ← local dev launcher
├── package.json
├── render.yaml             ← Render deploy config (primary)
├── railway.json            ← Railway backup
├── data/                   ← persistent JSON (users, leaderboard, events, masters)
│   ├── users.json
│   ├── leaderboard.json
│   ├── events.json
│   └── masters.json        ← NEW: bot Match Master state
├── versions/               ← snapshots before substantive edits (numeric sort)
│   ├── loot-match-v1.html
│   ├── loot-match-v2.html
│   └── ...
├── assets/                 ← welcome GIFs, mascot images (optional)
├── privacy.html
├── terms.html
└── GAME_DESIGN.md          ← this file
```

### What the server needs to add for v0.3+
1. **`/api/master/current`** — returns current Match Master for this user (rotation logic)
2. **`/api/master/smash`** — POST with `{ initData, masterId, structureIdx }` → server validates charge, applies damage, returns gold reward
3. **`/api/master/raid`** — POST → server runs dig RNG, returns gold rewards
4. **`/api/village/build`** — POST `{ structureId, level }` → server validates gold, applies build, returns new state
5. **`/api/village/collect`** — POST → server computes accumulated passive gold since last collect (4h cap)
6. **`/api/shield/active`** — server-side shield state (auto-defends offline)

### Persistence model
- **Local-first**: localStorage holds full state for instant load
- **Server-authoritative for money flows**: gold from smashes/raids only credited after server validation (anti-cheat)
- **Optimistic UI**: local state updates instantly, syncs server-side within 2.5s (debounced)

### "Instant loading" lock
Pickle's spec: **must be instant.** No splash screens, no asset-loading bars.
- All emojis are system fonts (no image atlas needed)
- Background = CSS gradient (no image)
- Mascot = single emoji or inline SVG
- Total page weight target: <120KB gzipped
- First paint: <300ms on 3G
- Time to interactive: <500ms

---

## 18 · Roadmap (v0.3 → v1.0)

| Version | Theme | Scope | ETA |
|---|---|---|---|
| **v0.3** | **Foundation** | Bright candy palette, 7×7 grid w/ Pirate Cove tiles, 3 charge meters, bot Match Masters (50 personalities), Pirate Cove village (6 structures × 5 lvl), Stars IAP catalog, daily chest, leaderboard, EN+RU full i18n, 5-step FTUE | next 1–2 sessions |
| **v0.4** | **Polish** | Coin rain VFX overhaul, confetti, screen shake, sound effects, ticker number animation, smash/raid mini-event animations, 18 stub languages → 10 full | following |
| **v0.5** | **PvP-lite** | Real-player Match Masters from leaderboard, async raids, shield system, Telegram bot raid notifications | |
| **v0.6** | **Expand worlds** | Desert Oasis + Egyptian Pyramid islands (themes 2 + 3), bet ×3 unlocks | |
| **v0.7** | **Social** | Friends invite via Telegram deep links, friend-village raids, clan basics | |
| **v0.8** | **Liveops** | First Halloween DC event live, GAE community goal | |
| **v0.9** | **Tournaments** | Weekly bracket tournaments, daily Power Hour, boss event | |
| **v1.0** | **Launch** | All 8 islands shipped, full booster catalog, complete tutorial, app-store-quality polish | |

---

## 19 · Success Metrics

What we measure to know if this is going to be a $100M game:

### Engagement
- **D1 retention** ≥ 50% (industry benchmark for hit match3: Royal Match ~55%)
- **D7 retention** ≥ 25%
- **D30 retention** ≥ 12%
- **Sessions / DAU / day** ≥ 4
- **Median session length** 4–7 min

### Monetization
- **DAU → buyer conversion** ≥ 5% (Coin Master: ~7%, Royal Match: ~4%)
- **ARPDAU** ≥ $0.40 (Coin Master: $0.58)
- **% revenue from whales** ≤ 40% (avoid over-dependency)
- **Avg session ARPU** trending up after island #2 unlocks

### Social (post v0.5)
- **% players who raid at least once** ≥ 80% within first 3 sessions
- **% players with at least 1 friend** ≥ 30% by D7
- **Avg raids / DAU / day** ≥ 3

### Loss / churn signals
- Players who hit energy=0 and don't return within 24h → bad
- Players who finish Pirate Cove → ≥ 70% should continue to Desert Oasis (gate retention is the #1 risk)

---

## 20 · Anti-Patterns (what we will NOT do)

❌ **Dark moody Match Moji palette** — v1 is bright, period
❌ **Round-based gameplay** — continuous play only; no "you have 10 moves left" structure
❌ **Separate bet screen** — bet is inline, always-visible
❌ **Per-tile colored rectangle backgrounds** — keeps tiles cluttered; we use cream tile bgs with bright emoji on top + glossy sheen
❌ **Ads** — Stars-only IAP, no rewarded video, no banner, ever
❌ **PvP at v0.3** — bot Masters until v0.5; building a matchmaking system is wasted effort pre-validation
❌ **Pay-to-win lock-out** — every island completable F2P; Stars accelerate, never gate
❌ **Forced tutorial scrolling** — 5 steps max, skippable from step 2 onward
❌ **Energy bars in the top bar** — energy goes BELOW the grid (Pickle locked)
❌ **Tetris-style falling pieces** — we are MATCH3, not Tetris; swap-to-match, not place-to-clear
❌ **Asking the player to choose theme/language before playing** — auto-detect TG locale, default Pirate Cove; settings let them change

---

## 21 · Open Questions (resolve before v0.3 build)

1. **Village layout on the Village tab:** isometric 2D scene or pure grid of structure tiles? *Recommendation:* isometric 2D for visual richness, single PNG per structure (or canvas-drawn).
2. **How many bot Match Masters at launch:** 50 vs 100? *Recommendation:* start with 50 for v0.3, easy to expand.
3. **Mascot character?** Friendly pirate, parrot, treasure-hunter fox? *Recommendation:* a smug treasure-hunter raccoon ("Looter the Raccoon") — gender-neutral, instantly cute, has anti-hero personality so raiding feels guilt-free.
4. **Battle Pass at v0.3 launch or v0.5?** *Recommendation:* v0.4 — let the core loop validate first.
5. **In-grid charge tiles vs separate charge-fill mechanic:** we chose in-grid (matches Pickle's spec better). Lock.

---

## 22 · Inspiration Sources

- **Coin Master** (Moon Active) — village/raid/attack/shield model, $4M/day, validated
- **Tetris Block Party** (PlayStudios) — drag-place puzzle with social Heist/Attack mechanics, validates puzzle+raid genre fusion
- **Royal Match** (Dream Games) — bright candy visual style benchmark, $3M/day
- **Candy Crush Saga** (King) — match3 cascade VFX language
- **Match Masters** (Candivore) — PvP match3 reference (but we're solo→async)

---

## 23 · Sign-Off

This document supersedes the v0.2 implementation at `index.html`. The next build (v0.3) targets the spec above. Before substantive edits to `index.html`:

1. Snapshot current `index.html` to `versions/loot-match-vN.html` (N = highest existing N + 1, **numeric sort**)
2. Implement the new design per this doc
3. Run parse-check:
   ```
   node -e "const html=require('fs').readFileSync('index.html','utf8'); const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]; let i=0; for(const s of m){ i++; try { new Function(s[1]); } catch(e) { console.log('FAIL block '+i+': '+e.message); process.exit(1); } } console.log('OK ('+i+' blocks)');"
   ```
4. Test on `localhost:3000`

---

## Sources

- [Coin Master Strategy Guide — Raids, Attacks, Villages (VMOS Cloud, 2024)](https://www.vmoscloud.com/blog/ultimate-coin-master-strategy-guide-mastering-villages-raids-and-progression)
- [Coin Master Guide: Mastering Raids and Attacks (Coin Master Support)](https://support.coinmastergame.com/hc/en-us/articles/29805831626898-How-can-I-strategically-master-Raids-and-Attacks)
- [Coin Master Guide 2024 Update (Level Winner)](https://www.levelwinner.com/coin-master-guide-2020-update-tips-tricks-strategies/)
- [How Coin Master Disrupted Social Casino — $100M (Deconstructor of Fun, 2019)](https://www.deconstructoroffun.com/blog/2019/3/4/is-coin-master-the-new-face-of-social-casino)
- [Tetris® Block Party — Apple App Store](https://apps.apple.com/us/app/tetris-block-party/id6569243702)
- [Tetris® Block Party — Apps on Google Play (Pickle's reference)](https://play.google.com/store/apps/details?id=com.playstudios.tetrisblockparty&hl=en_US)
- [TETRIS Block Party — PlayStudios product page](https://www.playstudios.com/tetris-block-party/)
- [Tetris Block Party — Tetris.com official](https://tetris.com/products/video-game/tetris-block-party)

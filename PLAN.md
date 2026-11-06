# Number Forge — Demo Plan

A small web demo of a card game where colored number cards are combined to make a **pool** value hit a **target** exactly. Long term this may become a roguelike deckbuilder (and maybe a Unity game); this demo only proves the core loop.

> **For Claude Code:** implement milestone by milestone. Keep all game rules in `src/game/` as pure, framework-free TypeScript (no DOM access) so they can later be ported to C#/Unity. Ask before changing any rule in "Core rules".

---

## 1. Tech stack

- **Vite + TypeScript**, no UI framework
- Plain HTML/CSS for cards; drag & drop with **pointer events** (works on mouse and touch)
- **Vitest** for unit tests of `src/game/`
- `localStorage` only for saving the custom deck from the deck editor
- Deployed as a static site on **Vercel**

```
src/
  game/        # pure logic: types, state, actions, rules, target generator
    types.ts
    rules.ts
    state.ts
    targetGen.ts
    decks.ts   # preset starter deck
  ui/          # rendering + drag & drop, reads state, calls game actions
    render.ts
    drag.ts
    deckView.ts
    deckEditor.ts
  main.ts
tests/
  rules.test.ts
  targetGen.test.ts
```

---

## 2. Core rules (locked)

### Cards
Three colors, each color is an operation. **No division.**

| Color | Shows | Stored value | Example |
|---|---|---|---|
| 🟢 Add | `+n` | `+n` | +4 |
| 🔴 Remove | `−n` | `−n` (negative) | −7 |
| ⚙️ Multiply | `×n` | `n` | ×3 |

- Add/remove values: 1–9. Multiply values: 2–4.

```ts
type Op = 'add' | 'remove' | 'multiply';
interface Card { id: string; op: Op; value: number } // remove cards store negative values
```

### Board
- **Pool:** current value. Starts at a random integer **1–10** (adjustable constant).
- **Target:** the number the pool must equal exactly.
- **Slots:** 3 slots ("forges"). Constant so it can be unlocked/changed later.
- **Hand:** 5 cards. **Deck:** draw pile, starts with ~12 cards.

### Actions
1. **Card → pool:** applies the card's own operation.
   - add/remove: `pool = pool + value` (remove value is negative)
   - multiply: `pool = pool * value`
2. **Card → empty slot:** the card becomes the slot's base. Slot keeps that card's **op** and its value.
3. **Card → occupied slot:** the dropped card's color is **ignored**; only its **absolute number** `n = |value|` is used, with the slot's op:
   - add slot: `v = v + n`  (+3, drop 7 → +10)
   - remove slot: `v = v − n` (−7, drop 3 → −10)
   - multiply slot: `v = v × n` (×3, drop 7 → ×21)
   - Slots never close; you can keep stacking.
4. **Slot → pool:** drag a slot onto the pool; it applies like a card with the slot's op and value (×21 multiplies the pool by 21). The slot becomes empty.

Forging always makes a slot stronger. Negative pool values are allowed.

### Drawing
- After **every card played from the hand** (actions 1–3), refill the hand to 5 from the deck (if the deck has cards).
- Moving a slot to the pool (action 4) does not draw.

### Win / lose
- **Win:** pool === target (check after every action).
- **Lose:** the player presses **Give up**, OR hand is empty AND deck is empty AND all slots are empty AND pool ≠ target.

### Target generation (must always be solvable)
`targetGen.ts`: after shuffling the deck and choosing the start pool, simulate a play-through using the **same deck order and draw rule**: randomly play 4–6 cards (random choice between pool and slots, then cash in slots). Use the resulting pool as the target. Accept only if `20 ≤ target ≤ 150` and `target ≠ start`; otherwise retry (cap ~500 tries, then reshuffle). Use a seedable RNG so a round can be replayed.

---

## 3. Starter deck (preset, 12 cards)

- Add: +2, +3, +4, +5, +7
- Remove: −1, −2, −4, −6
- Multiply: ×2, ×2, ×3

---

## 4. Features & milestones

### M1 — Game logic + tests
- Types, state, all 4 actions, draw rule, win/lose check, target generator
- Unit tests for: every action example above, refill rule, lose condition, generated targets are in range and reachable
- **Done when:** `npm test` passes

### M2 — Playable board
- Layout: top = Target and Pool; middle = 3 slots; bottom = hand (5 cards); side buttons: **Deck**, **Give up**, **New round**
- Drag cards to pool/slots, drag slots to pool; valid drop zones highlight while dragging
- Card colors clearly distinct (green / red / gray-steel for multiply) and show `+n`, `−n`, `×n`
- Win / lose overlay with "New round"
- Responsive: playable on a phone in portrait
- **Done when:** a full round can be played start to finish

### M3 — Deck tools
- **Deck view:** shows the remaining draw pile, grouped and sorted (do not reveal draw order), plus count
- **Deck editor:** start from the preset, add/remove cards (choose op + value), save to `localStorage`, "Reset to preset"; next round uses the saved deck
- **Done when:** a custom deck can be built and played

### M4 — Deploy
- See section 5

### Nice to have (only if time)
- Undo last action
- Show the round seed + "Replay seed"

### Out of scope for the demo
Shop, card upgrades (+1/−1), slot unlocking, multiple rounds per run, scoring, alternative win conditions, Unity port.

---

## 5. Deployment (Vercel)

1. Create a GitHub repo and push the project.
2. Sign in at vercel.com with GitHub → **Add New → Project** → import the repo.
3. Vercel detects Vite automatically: build command `npm run build`, output directory `dist`. Click **Deploy**.
4. Every push to `main` redeploys automatically; pushes to other branches get their own preview URLs.

No server, env variables or database needed; it's a static site.

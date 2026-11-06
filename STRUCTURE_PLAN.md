# Number Forge — Implementation Structure (for the implementing agent)

This is the **code skeleton** for `PLAN.md`. `PLAN.md` is the source of truth for rules; this file says
**which files, types and functions to write, what each one returns, and in which order**.

> **Rules for you (implementing agent)**
> - Read `PLAN.md` first. Do NOT change anything in its "Core rules" section without asking.
> - Everything in `src/game/` MUST be pure TypeScript: no DOM, no `window`, no `localStorage`, no `Math.random`.
>   All randomness goes through the seeded `Rng` (see `rng.ts`).
> - Game functions MUST NOT mutate their inputs. They return a **new** `GameState`.
> - Use tabs for indentation.
> - Work milestone by milestone (section 4). After each step, run `npm test` (from M1 on) and `npm run build`.

Additions compared to `PLAN.md` file list (small, intentional): `game/constants.ts`, `game/rng.ts`,
`game/moves.ts`, `ui/storage.ts`, `tests/state.test.ts`, `tests/decks.test.ts`.

---

## 1. File map

```
src/
	game/                 # pure logic, portable to C# later
		constants.ts        # all tunable numbers
		types.ts            # all shared types
		rng.ts              # seedable RNG
		rules.ts            # low-level math: apply op, forge, win/lose checks, formatting
		decks.ts            # starter deck, deck building, validation, summary
		state.ts            # round creation + the 4 actions + give up
		moves.ts            # Move dispatcher + move validation (used by UI drag & drop)
		targetGen.ts        # solvable target generation
	ui/                   # DOM only; reads state, calls game functions
		render.ts           # renders board + overlay
		drag.ts             # pointer-event drag & drop
		deckView.ts         # remaining draw pile modal
		deckEditor.ts       # custom deck editor modal
		storage.ts          # localStorage load/save of custom deck
	main.ts               # app controller: holds current state, wires everything
	style.css
tests/
	rules.test.ts
	state.test.ts
	decks.test.ts
	targetGen.test.ts
index.html
```

Dependency direction (MUST hold): `ui/*` and `main.ts` → `game/*`. Never `game/*` → `ui/*`.

---

## 2. Game layer (`src/game/`)

### 2.1 `constants.ts`

```ts
export const HAND_SIZE = 5;
export const SLOT_COUNT = 3;
export const START_POOL_MIN = 1;
export const START_POOL_MAX = 10;
export const TARGET_MIN = 20;
export const TARGET_MAX = 150;
export const SIM_CARDS_MIN = 4;            // cards played in one target simulation
export const SIM_CARDS_MAX = 6;
export const TARGET_TRIES_PER_SHUFFLE = 500;
export const MAX_RESHUFFLES = 20;          // after this, round creation fails (bad custom deck)
export const ADD_REMOVE_MIN = 1;
export const ADD_REMOVE_MAX = 9;
export const MULTIPLY_MIN = 2;
export const MULTIPLY_MAX = 4;
export const DECK_MIN_SIZE = 5;            // editor validation
export const DECK_MAX_SIZE = 30;
```

### 2.2 `types.ts`

```ts
export type Op = 'add' | 'remove' | 'multiply';

/** Card definition without identity (used by presets, editor, storage). Remove cards store NEGATIVE values. */
export interface CardSpec {
	op: Op;
	value: number;
}

/** A concrete card in a round. `id` is unique within the round. */
export interface Card extends CardSpec {
	id: string;
}

/** A forge slot. `null` = empty. For 'remove' the value is negative. */
export type Slot = CardSpec | null;

export type Status = 'playing' | 'won' | 'lost';

export interface GameState {
	seed: number;      // seed used to create the round (for replay)
	start: number;     // starting pool value
	pool: number;
	target: number;
	slots: Slot[];     // length === SLOT_COUNT
	hand: Card[];      // length <= HAND_SIZE
	deck: Card[];      // draw pile, index 0 = top card
	status: Status;
}

export type ActionError =
	| 'GAME_OVER'          // status !== 'playing'
	| 'CARD_NOT_IN_HAND'
	| 'INVALID_SLOT'       // index out of range
	| 'SLOT_EMPTY';        // slot → pool on an empty slot

/** Every action returns this. On failure, `state` is the unchanged input state. */
export type ActionResult =
	| { ok: true; state: GameState }
	| { ok: false; error: ActionError; state: GameState };

/** A player move — what the UI produces from a drag & drop. */
export type Move =
	| { type: 'cardToPool'; cardId: string }
	| { type: 'cardToSlot'; cardId: string; slotIndex: number }
	| { type: 'slotToPool'; slotIndex: number };

export type RoundError = 'INVALID_DECK' | 'NO_VALID_TARGET';

export type RoundResult =
	| { ok: true; state: GameState }
	| { ok: false; error: RoundError; details?: string[] };

/** Grouped entry for the deck view. */
export interface DeckGroup {
	op: Op;
	value: number;
	count: number;
}

export type DeckValidation =
	| { ok: true }
	| { ok: false; errors: string[] };
```

### 2.3 `rng.ts`

Seeded RNG (e.g. mulberry32). Stateful object, but deterministic for a given seed.

```ts
export interface Rng {
	next(): number;                        // float in [0, 1)
	int(min: number, max: number): number; // integer, inclusive on both ends
	pick<T>(items: readonly T[]): T;       // throws if items is empty
	shuffle<T>(items: readonly T[]): T[];  // returns a NEW shuffled array (Fisher–Yates)
}

export function createRng(seed: number): Rng;
```

### 2.4 `rules.ts` — low-level pure math

| Function | Returns | Behavior |
|---|---|---|
| `applyToPool(pool: number, op: Op, value: number)` | `number` | add/remove → `pool + value`; multiply → `pool * value` |
| `forgeSlot(slot: Slot, card: CardSpec)` | `CardSpec` (never null) | empty slot → `{ op: card.op, value: card.value }`. Occupied → `n = Math.abs(card.value)`; add: `v + n`; remove: `v - n`; multiply: `v * n`. Slot op never changes. |
| `isWin(pool: number, target: number)` | `boolean` | `pool === target` |
| `isAutoLoss(state: GameState)` | `boolean` | hand empty AND deck empty AND all slots null AND `pool !== target` |
| `evaluateStatus(state: GameState)` | `Status` | `'won'` if `isWin`, else `'lost'` if `isAutoLoss`, else `'playing'`. If `state.status` is already not `'playing'`, return it unchanged. |
| `formatValue(op: Op, value: number)` | `string` | `'+4'`, `'−7'` (Unicode minus U+2212, uses `Math.abs`), `'×3'` |

### 2.5 `decks.ts`

```ts
export const STARTER_DECK: readonly CardSpec[]; // 12 cards from PLAN.md §3

/** Builds a CardSpec with correct sign. magnitude is always positive. remove → negative value. */
export function makeCardSpec(op: Op, magnitude: number): CardSpec;

/** Assigns unique ids ('c0', 'c1', ...) in the given order. Does NOT shuffle. */
export function buildDeck(specs: readonly CardSpec[]): Card[];

/** Checks size (DECK_MIN_SIZE..DECK_MAX_SIZE), value ranges per op, sign (remove < 0, others > 0). */
export function validateDeck(specs: readonly CardSpec[]): DeckValidation;

/**
 * Groups cards by (op, value) and sorts: op order add → remove → multiply, then by |value| ascending.
 * Used by the deck view so draw order is NOT revealed.
 */
export function summarizeDeck(cards: readonly CardSpec[]): DeckGroup[];
```

### 2.6 `state.ts` — round + actions

All actions: if `state.status !== 'playing'` → `{ ok: false, error: 'GAME_OVER', state }`.
After a successful action, set `status = evaluateStatus(newState)`.

| Function | Returns | Behavior |
|---|---|---|
| `refillHand(hand: Card[], deck: Card[])` | `{ hand: Card[]; deck: Card[] }` | Moves cards from top of `deck` into `hand` until `hand.length === HAND_SIZE` or deck is empty. New arrays. |
| `createRound(specs: readonly CardSpec[], seed: number)` | `RoundResult` | 1) `validateDeck` → on fail `{ ok:false, error:'INVALID_DECK', details }`. 2) `setupRound(...)` from `targetGen.ts` → on `null` `{ ok:false, error:'NO_VALID_TARGET' }`. 3) Build state: `pool = start`, empty slots, `refillHand([], deck)`, `status: 'playing'`. |
| `playCardToPool(state, cardId: string)` | `ActionResult` | Remove card from hand, `pool = applyToPool(...)`, `refillHand`, evaluate status. |
| `playCardToSlot(state, cardId: string, slotIndex: number)` | `ActionResult` | Validate index, remove card from hand, `slots[i] = forgeSlot(slots[i], card)`, `refillHand`, evaluate status. |
| `playSlotToPool(state, slotIndex: number)` | `ActionResult` | Validate index, error `SLOT_EMPTY` if null. `pool = applyToPool(pool, slot.op, slot.value)`, `slots[i] = null`. **No draw.** Evaluate status. |
| `giveUp(state)` | `GameState` | Returns state with `status: 'lost'` (no-op if already won/lost). |

Helper (internal, not exported): `findCardIndex(hand, cardId): number` (−1 if missing).

### 2.7 `moves.ts` — single entry point for the UI

```ts
/** Dispatches a Move to the matching action in state.ts. */
export function applyMove(state: GameState, move: Move): ActionResult;

/**
 * True if applyMove would succeed. Used to highlight valid drop zones.
 * Implement as `applyMove(state, move).ok` — simple and always consistent.
 */
export function isMoveValid(state: GameState, move: Move): boolean;

/** All valid moves in the current state (used by target simulation and later by a hint/AI feature). */
export function listMoves(state: GameState): Move[];
```

### 2.8 `targetGen.ts`

Must use the **real** action functions (`applyMove`) so a generated target is always reachable by the same rules.

| Function | Returns | Behavior |
|---|---|---|
| `simulatePlaythrough(deck: Card[], start: number, rng: Rng)` | `number` | Build a temporary state (`target: Number.NaN` so it never "wins"; hand via `refillHand`). Play `k = rng.int(SIM_CARDS_MIN, SIM_CARDS_MAX)` cards (capped at total card count): each step pick a random hand card and a random destination among pool + all slots (`rng.pick` over card-moves from `listMoves`). Then cash in every non-empty slot in random order. Return final pool. |
| `generateTarget(deck: Card[], start: number, rng: Rng)` | `number \| null` | Up to `TARGET_TRIES_PER_SHUFFLE` times: `t = simulatePlaythrough(...)`; return `t` if `TARGET_MIN ≤ t ≤ TARGET_MAX` and `t !== start`. Otherwise `null`. |
| `setupRound(specs: readonly CardSpec[], seed: number)` | `{ deck: Card[]; start: number; target: number } \| null` | `rng = createRng(seed)`. Up to `MAX_RESHUFFLES` times: `deck = rng.shuffle(buildDeck(specs))`, `start = rng.int(START_POOL_MIN, START_POOL_MAX)`, `target = generateTarget(...)`; return on success. Otherwise `null`. |

Same seed + same specs MUST give the same `{ deck, start, target }`.

---

## 3. UI layer (`src/ui/` + `main.ts`)

### 3.1 `main.ts` — app controller

Holds the only mutable variable: `let state: GameState`.

```ts
function startNewRound(seed?: number): void;   // seed default: random (Math.random allowed here). Loads deck via loadDeck(); on RoundResult error shows a message and offers "Reset deck to preset".
function handleMove(move: Move): void;          // state = applyMove(state, move).state; then rerender()
function handleGiveUp(): void;                  // state = giveUp(state); rerender()
function rerender(): void;                      // render(root, state, handlers)
```

`handlers` object passed to the UI:

```ts
export interface UiHandlers {
	onMove(move: Move): void;
	onGiveUp(): void;
	onNewRound(): void;
	onOpenDeckView(): void;
	onOpenDeckEditor(): void;
}
```

### 3.2 `render.ts`

| Function | Returns | Notes |
|---|---|---|
| `render(root: HTMLElement, state: GameState, handlers: UiHandlers)` | `void` | Full re-render (simple, fine for this size). Layout per PLAN.md M2. |
| `renderCard(card: CardSpec, id?: string)` | `HTMLElement` | Classes `card card--add/remove/multiply`, text via `formatValue`. `data-card-id` attr when id given. |
| `renderSlot(slot: Slot, index: number)` | `HTMLElement` | `data-drop="slot"`, `data-slot-index`. Draggable only if not null. |
| `renderOverlay(state: GameState, onNewRound: () => void)` | `HTMLElement \| null` | Win/lose overlay; `null` while playing. |

Use `data-*` attributes so `drag.ts` can find sources/targets without knowing the render code:
- sources: `[data-drag="card"][data-card-id]`, `[data-drag="slot"][data-slot-index]`
- targets: `[data-drop="pool"]`, `[data-drop="slot"][data-slot-index]`

### 3.3 `drag.ts`

```ts
export type DragSource = { kind: 'card'; cardId: string } | { kind: 'slot'; slotIndex: number };
export type DropTarget = { kind: 'pool' } | { kind: 'slot'; slotIndex: number };

/** Maps a drag pair to a Move, or null if the combination is never allowed (e.g. slot → slot). */
export function toMove(source: DragSource, target: DropTarget): Move | null;

/**
 * Attaches pointer-event drag & drop to root (event delegation, survives re-renders).
 * getState is read on drag start to highlight targets where isMoveValid(...) is true.
 * Returns a cleanup function that removes all listeners.
 */
export function initDrag(
	root: HTMLElement,
	getState: () => GameState,
	onMove: (move: Move) => void,
): () => void;
```

Use `pointerdown/pointermove/pointerup`, `setPointerCapture`, a floating clone of the dragged element,
`document.elementFromPoint` to find the target, and CSS `touch-action: none` on draggables.

### 3.4 `deckView.ts`

```ts
/** Opens a modal listing summarizeDeck(state.deck) and the total count. Returns a close function. */
export function openDeckView(root: HTMLElement, state: GameState): () => void;
```

### 3.5 `deckEditor.ts`

```ts
export interface DeckEditorOptions {
	initial: CardSpec[];
	onSave(specs: CardSpec[]): void;   // called only when validateDeck(...).ok
	onClose(): void;
}

/** Opens editor modal: list of cards with remove buttons, op + magnitude picker → makeCardSpec, Save, Reset to preset. Returns a close function. */
export function openDeckEditor(root: HTMLElement, options: DeckEditorOptions): () => void;
```

Show `validateDeck` errors inline; disable Save while invalid.

### 3.6 `storage.ts`

```ts
/** Returns the saved deck, or STARTER_DECK if nothing saved / data invalid / storage throws. Never throws. */
export function loadDeck(): CardSpec[];

/** Saves the deck. Returns false if storage is unavailable. */
export function saveDeck(specs: CardSpec[]): boolean;

/** Removes the saved deck (next loadDeck returns STARTER_DECK). */
export function resetDeck(): void;
```

Storage key: `'number-forge.deck.v1'`. Wrap every `localStorage` access in `try/catch`.

---

## 4. Order of work (checklist)

### M1 — Game logic + tests (`npm test` passes)
1. [ ] Scaffold: `npm create vite@latest` (vanilla-ts), add `vitest`, script `"test": "vitest run"`.
2. [ ] `constants.ts`, `types.ts`
3. [ ] `rng.ts` + test: same seed → same sequence; `shuffle` does not mutate input.
4. [ ] `rules.ts` + `tests/rules.test.ts`:
	- applyToPool: `5 + 4 = 9`, `5 + (−7) = −2`, `5 × 3 = 15`
	- forgeSlot: empty + `×3` → `×3`; `+3` + drop `−7` → `+10`; `−7` + drop `+3` → `−10`; `×3` + drop `+7` → `×21`
	- formatValue for all 3 ops
	- evaluateStatus: win, auto-loss, playing, already-finished stays
5. [ ] `decks.ts` + `tests/decks.test.ts`: starter deck has 12 valid cards; `makeCardSpec('remove', 4)` → `−4`; validation errors; `summarizeDeck` order.
6. [ ] `state.ts` + `tests/state.test.ts` (build states by hand, not via random):
	- each action changes pool/slots/hand as expected
	- refill after actions 1–3, no draw after action 4
	- refill stops when deck empty
	- errors: `GAME_OVER`, `CARD_NOT_IN_HAND`, `INVALID_SLOT`, `SLOT_EMPTY` (state unchanged)
	- win detected after an action; auto-loss detected; `giveUp` → `'lost'`
	- inputs are not mutated (deep-freeze input or compare snapshots)
7. [ ] `moves.ts` (+ tests in `state.test.ts`): `applyMove` dispatches correctly; `listMoves` returns no slot→pool for empty slots.
8. [ ] `targetGen.ts` + `tests/targetGen.test.ts`:
	- for ~200 seeds with STARTER_DECK: target in `[20, 150]`, `target !== start`
	- determinism: same seed → same `{ deck, start, target }`
	- reachability: replaying the simulation with the same seed reaches target (or: re-run `simulatePlaythrough` with a cloned rng)
	- deck of only small remove cards → `setupRound` returns `null`, `createRound` returns `NO_VALID_TARGET`

### M2 — Playable board (a full round can be played)
9. [ ] `index.html`, `style.css` (green / red / steel-gray cards, portrait-phone friendly, `touch-action: none`)
10. [ ] `render.ts` (board + overlay)
11. [ ] `drag.ts` (`toMove`, `initDrag`, valid-target highlight)
12. [ ] `main.ts` wiring with STARTER_DECK; buttons Give up / New round
13. [ ] Manual test on desktop + phone-size viewport

### M3 — Deck tools
14. [ ] `storage.ts`; `main.ts` uses `loadDeck()` for new rounds
15. [ ] `deckView.ts` (Deck button)
16. [ ] `deckEditor.ts` (+ button in UI), Save → `saveDeck`, Reset → `resetDeck`

### M4 — Deploy
17. [ ] `npm run build` passes; follow PLAN.md §5. Do NOT push or create repos without the user's approval.

### Nice to have (only after M4)
- Undo: keep `history: GameState[]` in `main.ts`; push before each successful move. Game layer needs no change (states are immutable).
- Seed display + "Replay seed": `startNewRound(state.seed)`.

---

## 5. Quick reference — return values

| Function | Returns |
|---|---|
| `createRng` | `Rng` |
| `applyToPool` | `number` |
| `forgeSlot` | `CardSpec` |
| `isWin` / `isAutoLoss` | `boolean` |
| `evaluateStatus` | `Status` |
| `formatValue` | `string` |
| `makeCardSpec` | `CardSpec` |
| `buildDeck` | `Card[]` |
| `validateDeck` | `DeckValidation` |
| `summarizeDeck` | `DeckGroup[]` |
| `refillHand` | `{ hand: Card[]; deck: Card[] }` |
| `createRound` | `RoundResult` |
| `playCardToPool` / `playCardToSlot` / `playSlotToPool` | `ActionResult` |
| `giveUp` | `GameState` |
| `applyMove` | `ActionResult` |
| `isMoveValid` | `boolean` |
| `listMoves` | `Move[]` |
| `simulatePlaythrough` | `number` |
| `generateTarget` | `number \| null` |
| `setupRound` | `{ deck; start; target } \| null` |
| `render` | `void` |
| `renderCard` / `renderSlot` | `HTMLElement` |
| `renderOverlay` | `HTMLElement \| null` |
| `toMove` | `Move \| null` |
| `initDrag` / `openDeckView` / `openDeckEditor` | `() => void` (cleanup / close) |
| `loadDeck` | `CardSpec[]` |
| `saveDeck` | `boolean` |
| `resetDeck` | `void` |

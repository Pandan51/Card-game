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
	seed: number; // seed used to create the round (for replay)
	start: number; // starting pool value
	pool: number;
	target: number;
	slots: Slot[]; // length === SLOT_COUNT
	hand: Card[]; // length <= HAND_SIZE
	deck: Card[]; // draw pile, index 0 = top card
	status: Status;
}

export type ActionError =
	| 'GAME_OVER' // status !== 'playing'
	| 'CARD_NOT_IN_HAND'
	| 'INVALID_SLOT' // index out of range
	| 'SLOT_EMPTY'; // slot -> pool on an empty slot

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

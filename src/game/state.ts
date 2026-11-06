import { HAND_SIZE, SLOT_COUNT } from './constants';
import { validateDeck } from './decks';
import { applyToPool, evaluateStatus, forgeSlot } from './rules';
import { setupRound } from './targetGen';
import type { ActionResult, Card, CardSpec, GameState, RoundResult } from './types';

function findCardIndex(hand: readonly Card[], cardId: string): number {
	return hand.findIndex((c) => c.id === cardId);
}

/** Moves cards from the top of `deck` into `hand` until the hand is full or the deck is empty. */
export function refillHand(hand: Card[], deck: Card[]): { hand: Card[]; deck: Card[] } {
	const missing = Math.max(0, HAND_SIZE - hand.length);
	const drawn = Math.min(missing, deck.length);
	return {
		hand: [...hand, ...deck.slice(0, drawn)],
		deck: deck.slice(drawn),
	};
}

export function createRound(specs: readonly CardSpec[], seed: number): RoundResult {
	const validation = validateDeck(specs);
	if (!validation.ok) {
		return { ok: false, error: 'INVALID_DECK', details: validation.errors };
	}

	const setup = setupRound(specs, seed);
	if (setup === null) {
		return { ok: false, error: 'NO_VALID_TARGET' };
	}

	const { hand, deck } = refillHand([], setup.deck);
	const state: GameState = {
		seed,
		start: setup.start,
		pool: setup.start,
		target: setup.target,
		slots: Array.from({ length: SLOT_COUNT }, () => null),
		hand,
		deck,
		status: 'playing',
	};
	return { ok: true, state };
}

function fail(state: GameState, error: 'GAME_OVER' | 'CARD_NOT_IN_HAND' | 'INVALID_SLOT' | 'SLOT_EMPTY'): ActionResult {
	return { ok: false, error, state };
}

function isValidSlotIndex(state: GameState, slotIndex: number): boolean {
	return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < state.slots.length;
}

function finish(state: GameState): ActionResult {
	return { ok: true, state: { ...state, status: evaluateStatus(state) } };
}

export function playCardToPool(state: GameState, cardId: string): ActionResult {
	if (state.status !== 'playing') {
		return fail(state, 'GAME_OVER');
	}
	const index = findCardIndex(state.hand, cardId);
	if (index === -1) {
		return fail(state, 'CARD_NOT_IN_HAND');
	}
	const card = state.hand[index];
	const remaining = state.hand.filter((_, i) => i !== index);
	const refilled = refillHand(remaining, state.deck);
	return finish({
		...state,
		pool: applyToPool(state.pool, card.op, card.value),
		hand: refilled.hand,
		deck: refilled.deck,
	});
}

export function playCardToSlot(state: GameState, cardId: string, slotIndex: number): ActionResult {
	if (state.status !== 'playing') {
		return fail(state, 'GAME_OVER');
	}
	if (!isValidSlotIndex(state, slotIndex)) {
		return fail(state, 'INVALID_SLOT');
	}
	const index = findCardIndex(state.hand, cardId);
	if (index === -1) {
		return fail(state, 'CARD_NOT_IN_HAND');
	}
	const card = state.hand[index];
	const remaining = state.hand.filter((_, i) => i !== index);
	const refilled = refillHand(remaining, state.deck);
	const slots = state.slots.map((slot, i) => (i === slotIndex ? forgeSlot(slot, card) : slot));
	return finish({
		...state,
		slots,
		hand: refilled.hand,
		deck: refilled.deck,
	});
}

/** Cashes a slot into the pool. The slot becomes empty. No draw. */
export function playSlotToPool(state: GameState, slotIndex: number): ActionResult {
	if (state.status !== 'playing') {
		return fail(state, 'GAME_OVER');
	}
	if (!isValidSlotIndex(state, slotIndex)) {
		return fail(state, 'INVALID_SLOT');
	}
	const slot = state.slots[slotIndex];
	if (slot === null) {
		return fail(state, 'SLOT_EMPTY');
	}
	const slots = state.slots.map((s, i) => (i === slotIndex ? null : s));
	return finish({
		...state,
		pool: applyToPool(state.pool, slot.op, slot.value),
		slots,
	});
}

export function giveUp(state: GameState): GameState {
	if (state.status !== 'playing') {
		return state;
	}
	return { ...state, status: 'lost' };
}

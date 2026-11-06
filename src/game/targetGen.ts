import {
	MAX_RESHUFFLES,
	SIM_CARDS_MAX,
	SIM_CARDS_MIN,
	SLOT_COUNT,
	START_POOL_MAX,
	START_POOL_MIN,
	TARGET_MAX,
	TARGET_MIN,
	TARGET_TRIES_PER_SHUFFLE,
} from './constants';
import { buildDeck } from './decks';
import { applyMove, listMoves } from './moves';
import { createRng, type Rng } from './rng';
import { refillHand } from './state';
import type { Card, CardSpec, GameState } from './types';

/**
 * Plays a random game on the given deck order using the real actions and returns the final pool.
 * The target is NaN so the simulation never "wins" early.
 */
export function simulatePlaythrough(deck: Card[], start: number, rng: Rng): number {
	const { hand, deck: draw } = refillHand([], deck);
	let state: GameState = {
		seed: 0,
		start,
		pool: start,
		target: Number.NaN,
		slots: Array.from({ length: SLOT_COUNT }, () => null),
		hand,
		deck: draw,
		status: 'playing',
	};

	const k = Math.min(rng.int(SIM_CARDS_MIN, SIM_CARDS_MAX), deck.length);
	for (let i = 0; i < k; i++) {
		const cardMoves = listMoves(state).filter((m) => m.type !== 'slotToPool');
		if (cardMoves.length === 0) {
			break;
		}
		const result = applyMove(state, rng.pick(cardMoves));
		if (!result.ok) {
			break;
		}
		state = result.state;
	}

	const filled: number[] = [];
	state.slots.forEach((slot, index) => {
		if (slot !== null) {
			filled.push(index);
		}
	});
	for (const slotIndex of rng.shuffle(filled)) {
		const result = applyMove(state, { type: 'slotToPool', slotIndex });
		if (result.ok) {
			state = result.state;
		}
	}

	return state.pool;
}

export function generateTarget(deck: Card[], start: number, rng: Rng): number | null {
	for (let i = 0; i < TARGET_TRIES_PER_SHUFFLE; i++) {
		const target = simulatePlaythrough(deck, start, rng);
		if (target >= TARGET_MIN && target <= TARGET_MAX && target !== start) {
			return target;
		}
	}
	return null;
}

export function setupRound(
	specs: readonly CardSpec[],
	seed: number,
): { deck: Card[]; start: number; target: number } | null {
	const rng = createRng(seed);
	for (let i = 0; i < MAX_RESHUFFLES; i++) {
		const deck = rng.shuffle(buildDeck(specs));
		const start = rng.int(START_POOL_MIN, START_POOL_MAX);
		const target = generateTarget(deck, start, rng);
		if (target !== null) {
			return { deck, start, target };
		}
	}
	return null;
}

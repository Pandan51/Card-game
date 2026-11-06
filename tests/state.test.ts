import { describe, expect, it } from 'vitest';
import { applyMove, listMoves } from '../src/game/moves';
import {
	createRound,
	giveUp,
	playCardToPool,
	playCardToSlot,
	playSlotToPool,
	refillHand,
} from '../src/game/state';
import { STARTER_DECK } from '../src/game/decks';
import type { Card, GameState } from '../src/game/types';

function deepFreeze<T>(obj: T): T {
	if (obj && typeof obj === 'object') {
		Object.freeze(obj);
		for (const value of Object.values(obj)) {
			deepFreeze(value);
		}
	}
	return obj;
}

const card = (id: string, op: Card['op'], value: number): Card => ({ id, op, value });

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		seed: 1,
		start: 5,
		pool: 5,
		target: 100,
		slots: [null, null, null],
		hand: [card('h1', 'add', 4), card('h2', 'remove', -7), card('h3', 'multiply', 3)],
		deck: [card('d1', 'add', 1), card('d2', 'add', 2)],
		status: 'playing',
		...overrides,
	};
}

function ok(result: ReturnType<typeof playCardToPool>): GameState {
	if (!result.ok) {
		throw new Error(`Expected ok, got ${result.error}`);
	}
	return result.state;
}

describe('refillHand', () => {
	it('draws from the top of the deck up to HAND_SIZE', () => {
		const deck = Array.from({ length: 10 }, (_, i) => card(`d${i}`, 'add', 1));
		const hand = [card('h', 'add', 1)];
		const result = refillHand(hand, deck);
		expect(result.hand.map((c) => c.id)).toEqual(['h', 'd0', 'd1', 'd2', 'd3']);
		expect(result.deck).toHaveLength(6);
		expect(result.deck[0].id).toBe('d4');
		expect(hand).toHaveLength(1);
		expect(deck).toHaveLength(10);
	});

	it('stops when the deck is empty', () => {
		const result = refillHand([], [card('d0', 'add', 1), card('d1', 'add', 1)]);
		expect(result.hand).toHaveLength(2);
		expect(result.deck).toHaveLength(0);
	});
});

describe('playCardToPool', () => {
	it('applies the card, removes it from hand and draws', () => {
		const state = ok(playCardToPool(makeState(), 'h1'));
		expect(state.pool).toBe(9);
		expect(state.hand.map((c) => c.id)).toEqual(['h2', 'h3', 'd1', 'd2']);
		expect(state.deck).toHaveLength(0);
	});

	it('handles remove and multiply cards', () => {
		expect(ok(playCardToPool(makeState(), 'h2')).pool).toBe(-2);
		expect(ok(playCardToPool(makeState(), 'h3')).pool).toBe(15);
	});

	it('does not draw when the deck is empty', () => {
		const state = ok(playCardToPool(makeState({ deck: [] }), 'h1'));
		expect(state.hand).toHaveLength(2);
	});
});

describe('playCardToSlot', () => {
	it('an empty slot takes the card as its base', () => {
		const state = ok(playCardToSlot(makeState(), 'h3', 1));
		expect(state.slots).toEqual([null, { op: 'multiply', value: 3 }, null]);
		expect(state.pool).toBe(5);
		expect(state.hand).toHaveLength(4);
	});

	it('an occupied slot ignores the card colour and uses |value|', () => {
		const state = makeState({ slots: [{ op: 'add', value: 3 }, null, null] });
		const next = ok(playCardToSlot(state, 'h2', 0));
		expect(next.slots[0]).toEqual({ op: 'add', value: 10 });
	});

	it('refills the hand', () => {
		const state = ok(playCardToSlot(makeState(), 'h1', 0));
		expect(state.hand.map((c) => c.id)).toEqual(['h2', 'h3', 'd1', 'd2']);
	});
});

describe('playSlotToPool', () => {
	it('applies the slot, empties it and does NOT draw', () => {
		const state = makeState({ slots: [null, { op: 'multiply', value: 21 }, null] });
		const next = ok(playSlotToPool(state, 1));
		expect(next.pool).toBe(105);
		expect(next.slots[1]).toBeNull();
		expect(next.hand).toHaveLength(3);
		expect(next.deck).toHaveLength(2);
	});

	it('applies remove slots with their negative value', () => {
		const state = makeState({ slots: [{ op: 'remove', value: -10 }, null, null] });
		expect(ok(playSlotToPool(state, 0)).pool).toBe(-5);
	});
});

describe('errors leave the state unchanged', () => {
	it('CARD_NOT_IN_HAND', () => {
		const state = makeState();
		const r1 = playCardToPool(state, 'nope');
		const r2 = playCardToSlot(state, 'nope', 0);
		expect(r1).toMatchObject({ ok: false, error: 'CARD_NOT_IN_HAND' });
		expect(r2).toMatchObject({ ok: false, error: 'CARD_NOT_IN_HAND' });
		expect(r1.state).toBe(state);
	});

	it('INVALID_SLOT', () => {
		const state = makeState({ slots: [{ op: 'add', value: 1 }, null, null] });
		expect(playCardToSlot(state, 'h1', 3)).toMatchObject({ ok: false, error: 'INVALID_SLOT' });
		expect(playCardToSlot(state, 'h1', -1)).toMatchObject({ ok: false, error: 'INVALID_SLOT' });
		expect(playSlotToPool(state, 7)).toMatchObject({ ok: false, error: 'INVALID_SLOT' });
	});

	it('SLOT_EMPTY', () => {
		const state = makeState();
		const result = playSlotToPool(state, 0);
		expect(result).toMatchObject({ ok: false, error: 'SLOT_EMPTY' });
		expect(result.state).toBe(state);
	});

	it('GAME_OVER on every action', () => {
		const state = makeState({ status: 'won' });
		expect(playCardToPool(state, 'h1')).toMatchObject({ ok: false, error: 'GAME_OVER' });
		expect(playCardToSlot(state, 'h1', 0)).toMatchObject({ ok: false, error: 'GAME_OVER' });
		expect(playSlotToPool(state, 0)).toMatchObject({ ok: false, error: 'GAME_OVER' });
	});
});

describe('win / lose', () => {
	it('detects a win after a card to pool', () => {
		const state = makeState({ target: 9 });
		expect(ok(playCardToPool(state, 'h1')).status).toBe('won');
	});

	it('detects a win after cashing a slot', () => {
		const state = makeState({ target: 20, slots: [{ op: 'add', value: 15 }, null, null] });
		expect(ok(playSlotToPool(state, 0)).status).toBe('won');
	});

	it('detects an auto-loss when everything is exhausted', () => {
		const state = makeState({ hand: [card('h1', 'add', 1)], deck: [], target: 100 });
		expect(ok(playCardToPool(state, 'h1')).status).toBe('lost');
	});

	it('does not lose while a slot still holds value', () => {
		const state = makeState({ hand: [card('h1', 'add', 1)], deck: [], target: 100 });
		expect(ok(playCardToSlot(state, 'h1', 0)).status).toBe('playing');
	});

	it('giveUp sets lost and is a no-op on finished games', () => {
		expect(giveUp(makeState()).status).toBe('lost');
		const won = makeState({ status: 'won' });
		expect(giveUp(won)).toBe(won);
	});
});

describe('immutability', () => {
	it('never mutates the input state', () => {
		const state = deepFreeze(
			makeState({ slots: [{ op: 'add', value: 3 }, null, null] }),
		);
		expect(() => {
			playCardToPool(state, 'h1');
			playCardToSlot(state, 'h2', 0);
			playCardToSlot(state, 'h2', 1);
			playSlotToPool(state, 0);
			giveUp(state);
		}).not.toThrow();
	});
});

describe('moves', () => {
	it('applyMove dispatches to the right action', () => {
		const state = makeState({ slots: [{ op: 'add', value: 3 }, null, null] });
		expect(ok(applyMove(state, { type: 'cardToPool', cardId: 'h1' })).pool).toBe(9);
		expect(ok(applyMove(state, { type: 'cardToSlot', cardId: 'h1', slotIndex: 0 })).slots[0]).toEqual({
			op: 'add',
			value: 7,
		});
		expect(ok(applyMove(state, { type: 'slotToPool', slotIndex: 0 })).pool).toBe(8);
	});

	it('listMoves has no slot->pool for empty slots', () => {
		const state = makeState({ slots: [null, { op: 'add', value: 2 }, null] });
		const moves = listMoves(state);
		const slotMoves = moves.filter((m) => m.type === 'slotToPool');
		expect(slotMoves).toEqual([{ type: 'slotToPool', slotIndex: 1 }]);
		// 3 cards x (pool + 3 slots) + 1 cash-in
		expect(moves).toHaveLength(3 * 4 + 1);
	});

	it('listMoves is empty when the game is over', () => {
		expect(listMoves(makeState({ status: 'lost' }))).toEqual([]);
	});

	it('every listed move is valid', () => {
		const state = makeState({ slots: [{ op: 'add', value: 2 }, null, null] });
		for (const move of listMoves(state)) {
			expect(applyMove(state, move).ok).toBe(true);
		}
	});
});

describe('createRound', () => {
	it('creates a playable round from the starter deck', () => {
		const result = createRound(STARTER_DECK, 123);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const s = result.state;
			expect(s.status).toBe('playing');
			expect(s.hand).toHaveLength(5);
			expect(s.deck).toHaveLength(7);
			expect(s.slots).toEqual([null, null, null]);
			expect(s.pool).toBe(s.start);
			expect(s.seed).toBe(123);
		}
	});

	it('rejects an invalid deck', () => {
		const result = createRound([{ op: 'add', value: 1 }], 1);
		expect(result).toMatchObject({ ok: false, error: 'INVALID_DECK' });
	});
});

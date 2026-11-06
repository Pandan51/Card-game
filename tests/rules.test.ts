import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/rng';
import { applyToPool, evaluateStatus, forgeSlot, formatValue, isAutoLoss, isWin } from '../src/game/rules';
import type { GameState } from '../src/game/types';

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		seed: 1,
		start: 5,
		pool: 5,
		target: 50,
		slots: [null, null, null],
		hand: [{ id: 'a', op: 'add', value: 1 }],
		deck: [],
		status: 'playing',
		...overrides,
	};
}

describe('rng', () => {
	it('gives the same sequence for the same seed', () => {
		const a = createRng(42);
		const b = createRng(42);
		const seqA = Array.from({ length: 10 }, () => a.next());
		const seqB = Array.from({ length: 10 }, () => b.next());
		expect(seqA).toEqual(seqB);
	});

	it('int is inclusive on both ends and stays in range', () => {
		const rng = createRng(7);
		const seen = new Set<number>();
		for (let i = 0; i < 500; i++) {
			const v = rng.int(1, 3);
			expect(v).toBeGreaterThanOrEqual(1);
			expect(v).toBeLessThanOrEqual(3);
			seen.add(v);
		}
		expect([...seen].sort()).toEqual([1, 2, 3]);
	});

	it('shuffle does not mutate its input and keeps all items', () => {
		const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
		const result = createRng(3).shuffle(input);
		expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect([...result].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('pick throws on an empty array', () => {
		expect(() => createRng(1).pick([])).toThrow();
	});
});

describe('applyToPool', () => {
	it('adds, removes and multiplies', () => {
		expect(applyToPool(5, 'add', 4)).toBe(9);
		expect(applyToPool(5, 'remove', -7)).toBe(-2);
		expect(applyToPool(5, 'multiply', 3)).toBe(15);
	});
});

describe('forgeSlot', () => {
	it('empty slot takes the card as its base', () => {
		expect(forgeSlot(null, { op: 'multiply', value: 3 })).toEqual({ op: 'multiply', value: 3 });
		expect(forgeSlot(null, { op: 'remove', value: -4 })).toEqual({ op: 'remove', value: -4 });
	});

	it('add slot: +3 with dropped -7 becomes +10', () => {
		expect(forgeSlot({ op: 'add', value: 3 }, { op: 'remove', value: -7 })).toEqual({ op: 'add', value: 10 });
	});

	it('remove slot: -7 with dropped +3 becomes -10', () => {
		expect(forgeSlot({ op: 'remove', value: -7 }, { op: 'add', value: 3 })).toEqual({ op: 'remove', value: -10 });
	});

	it('multiply slot: x3 with dropped +7 becomes x21', () => {
		expect(forgeSlot({ op: 'multiply', value: 3 }, { op: 'add', value: 7 })).toEqual({ op: 'multiply', value: 21 });
	});

	it('does not mutate the slot', () => {
		const slot = Object.freeze({ op: 'add', value: 3 } as const);
		forgeSlot(slot, { op: 'add', value: 1 });
		expect(slot.value).toBe(3);
	});
});

describe('formatValue', () => {
	it('formats all three ops', () => {
		expect(formatValue('add', 4)).toBe('+4');
		expect(formatValue('remove', -7)).toBe('−7');
		expect(formatValue('multiply', 3)).toBe('×3');
	});
});

describe('status evaluation', () => {
	it('isWin compares exactly', () => {
		expect(isWin(10, 10)).toBe(true);
		expect(isWin(10, 11)).toBe(false);
	});

	it('detects a win', () => {
		expect(evaluateStatus(makeState({ pool: 50 }))).toBe('won');
	});

	it('detects an auto-loss only when everything is exhausted', () => {
		const dead = makeState({ hand: [], deck: [], slots: [null, null, null] });
		expect(isAutoLoss(dead)).toBe(true);
		expect(evaluateStatus(dead)).toBe('lost');
	});

	it('is still playing with cards in hand, deck or slots', () => {
		expect(evaluateStatus(makeState())).toBe('playing');
		expect(evaluateStatus(makeState({ hand: [], deck: [{ id: 'd', op: 'add', value: 1 }] }))).toBe('playing');
		expect(evaluateStatus(makeState({ hand: [], slots: [{ op: 'add', value: 1 }, null, null] }))).toBe('playing');
	});

	it('empty everything but pool equals target is a win, not a loss', () => {
		expect(evaluateStatus(makeState({ hand: [], pool: 50 }))).toBe('won');
	});

	it('a finished game keeps its status', () => {
		expect(evaluateStatus(makeState({ status: 'lost', pool: 50 }))).toBe('lost');
		expect(evaluateStatus(makeState({ status: 'won', pool: 1 }))).toBe('won');
	});
});

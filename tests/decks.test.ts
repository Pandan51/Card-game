import { describe, expect, it } from 'vitest';
import { buildDeck, makeCardSpec, STARTER_DECK, summarizeDeck, validateDeck } from '../src/game/decks';
import type { CardSpec } from '../src/game/types';

describe('STARTER_DECK', () => {
	it('has 12 valid cards', () => {
		expect(STARTER_DECK).toHaveLength(12);
		expect(validateDeck(STARTER_DECK)).toEqual({ ok: true });
	});
});

describe('makeCardSpec', () => {
	it('makes remove cards negative and others positive', () => {
		expect(makeCardSpec('remove', 4)).toEqual({ op: 'remove', value: -4 });
		expect(makeCardSpec('remove', -4)).toEqual({ op: 'remove', value: -4 });
		expect(makeCardSpec('add', 4)).toEqual({ op: 'add', value: 4 });
		expect(makeCardSpec('multiply', 3)).toEqual({ op: 'multiply', value: 3 });
	});
});

describe('buildDeck', () => {
	it('assigns unique ids in order without shuffling', () => {
		const deck = buildDeck(STARTER_DECK);
		expect(deck.map((c) => c.id)).toEqual(STARTER_DECK.map((_, i) => `c${i}`));
		expect(new Set(deck.map((c) => c.id)).size).toBe(12);
		expect(deck[0]).toMatchObject({ op: 'add', value: 2 });
	});
});

describe('validateDeck', () => {
	const base = (n: number): CardSpec[] => Array.from({ length: n }, () => ({ op: 'add', value: 1 }));

	it('rejects too small and too large decks', () => {
		expect(validateDeck(base(4)).ok).toBe(false);
		expect(validateDeck(base(31)).ok).toBe(false);
		expect(validateDeck(base(5)).ok).toBe(true);
		expect(validateDeck(base(30)).ok).toBe(true);
	});

	it('rejects out-of-range values per op', () => {
		expect(validateDeck([...base(5), { op: 'add', value: 10 }]).ok).toBe(false);
		expect(validateDeck([...base(5), { op: 'add', value: 0 }]).ok).toBe(false);
		expect(validateDeck([...base(5), { op: 'multiply', value: 1 }]).ok).toBe(false);
		expect(validateDeck([...base(5), { op: 'multiply', value: 5 }]).ok).toBe(false);
		expect(validateDeck([...base(5), { op: 'remove', value: -10 }]).ok).toBe(false);
	});

	it('rejects wrong signs and non-integers', () => {
		expect(validateDeck([...base(5), { op: 'remove', value: 3 }]).ok).toBe(false);
		expect(validateDeck([...base(5), { op: 'add', value: -3 }]).ok).toBe(false);
		expect(validateDeck([...base(5), { op: 'add', value: 2.5 }]).ok).toBe(false);
	});

	it('reports errors as messages', () => {
		const result = validateDeck(base(2));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});
});

describe('summarizeDeck', () => {
	it('groups and sorts add -> remove -> multiply, then by absolute value', () => {
		const summary = summarizeDeck([
			{ op: 'multiply', value: 3 },
			{ op: 'remove', value: -6 },
			{ op: 'add', value: 5 },
			{ op: 'multiply', value: 2 },
			{ op: 'remove', value: -1 },
			{ op: 'add', value: 5 },
			{ op: 'multiply', value: 2 },
		]);
		expect(summary).toEqual([
			{ op: 'add', value: 5, count: 2 },
			{ op: 'remove', value: -1, count: 1 },
			{ op: 'remove', value: -6, count: 1 },
			{ op: 'multiply', value: 2, count: 2 },
			{ op: 'multiply', value: 3, count: 1 },
		]);
	});
});

import { describe, expect, it } from 'vitest';
import { buildDeck, STARTER_DECK } from '../src/game/decks';
import { START_POOL_MAX, START_POOL_MIN, TARGET_MAX, TARGET_MIN } from '../src/game/constants';
import { createRng } from '../src/game/rng';
import { createRound } from '../src/game/state';
import { generateTarget, setupRound, simulatePlaythrough } from '../src/game/targetGen';
import type { CardSpec } from '../src/game/types';

describe('setupRound', () => {
	it('generates targets in range for many seeds', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const setup = setupRound(STARTER_DECK, seed);
			expect(setup, `seed ${seed}`).not.toBeNull();
			if (setup) {
				expect(setup.target).toBeGreaterThanOrEqual(TARGET_MIN);
				expect(setup.target).toBeLessThanOrEqual(TARGET_MAX);
				expect(setup.target).not.toBe(setup.start);
				expect(setup.start).toBeGreaterThanOrEqual(START_POOL_MIN);
				expect(setup.start).toBeLessThanOrEqual(START_POOL_MAX);
				expect(setup.deck).toHaveLength(STARTER_DECK.length);
			}
		}
	});

	it('is deterministic for the same seed and specs', () => {
		expect(setupRound(STARTER_DECK, 99)).toEqual(setupRound(STARTER_DECK, 99));
	});

	it('differs between seeds', () => {
		const targets = new Set<number>();
		for (let seed = 1; seed <= 30; seed++) {
			targets.add(setupRound(STARTER_DECK, seed)!.target);
		}
		expect(targets.size).toBeGreaterThan(3);
	});

	it('does not mutate the specs', () => {
		const specs = STARTER_DECK.map((s) => ({ ...s }));
		setupRound(specs, 5);
		expect(specs).toEqual(STARTER_DECK);
	});
});

describe('reachability', () => {
	it('the target equals a playthrough of the same shuffled deck (same rules, same rng stream)', () => {
		for (let seed = 1; seed <= 50; seed++) {
			const setup = setupRound(STARTER_DECK, seed)!;
			// Replay the exact rng stream setupRound used until it accepted the target.
			const rng = createRng(seed);
			let found: number | null = null;
			for (let i = 0; i < 20 && found === null; i++) {
				const deck = rng.shuffle(buildDeck(STARTER_DECK));
				const start = rng.int(START_POOL_MIN, START_POOL_MAX);
				found = generateTarget(deck, start, rng);
				if (found !== null) {
					expect(deck).toEqual(setup.deck);
					expect(start).toBe(setup.start);
				}
			}
			expect(found).toBe(setup.target);
		}
	});

	it('simulatePlaythrough is deterministic for a given rng seed', () => {
		const deck = buildDeck(STARTER_DECK);
		expect(simulatePlaythrough(deck, 5, createRng(11))).toBe(simulatePlaythrough(deck, 5, createRng(11)));
	});

	it('simulatePlaythrough does not mutate the deck', () => {
		const deck = Object.freeze(buildDeck(STARTER_DECK).map((c) => Object.freeze(c))) as ReturnType<typeof buildDeck>;
		expect(() => simulatePlaythrough(deck, 5, createRng(2))).not.toThrow();
	});
});

describe('impossible decks', () => {
	const smallRemoves: CardSpec[] = Array.from({ length: 8 }, () => ({ op: 'remove', value: -1 }));

	it('setupRound returns null', () => {
		expect(setupRound(smallRemoves, 1)).toBeNull();
	});

	it('createRound returns NO_VALID_TARGET', () => {
		expect(createRound(smallRemoves, 1)).toMatchObject({ ok: false, error: 'NO_VALID_TARGET' });
	});
});

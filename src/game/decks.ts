import {
	ADD_REMOVE_MAX,
	ADD_REMOVE_MIN,
	DECK_MAX_SIZE,
	DECK_MIN_SIZE,
	MULTIPLY_MAX,
	MULTIPLY_MIN,
} from './constants';
import type { Card, CardSpec, DeckGroup, DeckValidation, Op } from './types';

export const STARTER_DECK: readonly CardSpec[] = [
	{ op: 'add', value: 2 },
	{ op: 'add', value: 3 },
	{ op: 'add', value: 4 },
	{ op: 'add', value: 5 },
	{ op: 'add', value: 7 },
	{ op: 'remove', value: -1 },
	{ op: 'remove', value: -2 },
	{ op: 'remove', value: -4 },
	{ op: 'remove', value: -6 },
	{ op: 'multiply', value: 2 },
	{ op: 'multiply', value: 2 },
	{ op: 'multiply', value: 3 },
];

/** Builds a CardSpec with correct sign. magnitude is always positive; remove -> negative value. */
export function makeCardSpec(op: Op, magnitude: number): CardSpec {
	const m = Math.abs(magnitude);
	return { op, value: op === 'remove' ? -m : m };
}

/** Assigns unique ids ('c0', 'c1', ...) in the given order. Does NOT shuffle. */
export function buildDeck(specs: readonly CardSpec[]): Card[] {
	return specs.map((spec, i) => ({ id: `c${i}`, op: spec.op, value: spec.value }));
}

/** Checks size, value ranges per op and sign (remove < 0, others > 0). */
export function validateDeck(specs: readonly CardSpec[]): DeckValidation {
	const errors: string[] = [];

	if (specs.length < DECK_MIN_SIZE || specs.length > DECK_MAX_SIZE) {
		errors.push(`Deck must have ${DECK_MIN_SIZE}-${DECK_MAX_SIZE} cards (has ${specs.length}).`);
	}

	specs.forEach((spec, i) => {
		const label = `Card ${i + 1}`;
		if (!Number.isInteger(spec.value)) {
			errors.push(`${label}: value must be an integer.`);
			return;
		}
		if (spec.op === 'remove') {
			if (spec.value >= 0) {
				errors.push(`${label}: remove card must have a negative value.`);
			}
			const abs = Math.abs(spec.value);
			if (abs < ADD_REMOVE_MIN || abs > ADD_REMOVE_MAX) {
				errors.push(`${label}: remove value must be ${ADD_REMOVE_MIN}-${ADD_REMOVE_MAX}.`);
			}
		} else if (spec.op === 'add') {
			if (spec.value < ADD_REMOVE_MIN || spec.value > ADD_REMOVE_MAX) {
				errors.push(`${label}: add value must be ${ADD_REMOVE_MIN}-${ADD_REMOVE_MAX}.`);
			}
		} else if (spec.op === 'multiply') {
			if (spec.value < MULTIPLY_MIN || spec.value > MULTIPLY_MAX) {
				errors.push(`${label}: multiply value must be ${MULTIPLY_MIN}-${MULTIPLY_MAX}.`);
			}
		} else {
			errors.push(`${label}: unknown operation.`);
		}
	});

	return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

const OP_ORDER: Record<Op, number> = { add: 0, remove: 1, multiply: 2 };

/** Groups cards by (op, value), sorted add -> remove -> multiply, then by |value|. Does not reveal draw order. */
export function summarizeDeck(cards: readonly CardSpec[]): DeckGroup[] {
	const map = new Map<string, DeckGroup>();
	for (const card of cards) {
		const key = `${card.op}:${card.value}`;
		const group = map.get(key);
		if (group) {
			group.count++;
		} else {
			map.set(key, { op: card.op, value: card.value, count: 1 });
		}
	}
	return [...map.values()].sort(
		(a, b) => OP_ORDER[a.op] - OP_ORDER[b.op] || Math.abs(a.value) - Math.abs(b.value),
	);
}

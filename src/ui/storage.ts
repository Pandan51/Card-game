import { STARTER_DECK, validateDeck } from '../game/decks';
import type { CardSpec, Op } from '../game/types';

const STORAGE_KEY = 'number-forge.deck.v1';

function isOp(value: unknown): value is Op {
	return value === 'add' || value === 'remove' || value === 'multiply';
}

function parseDeck(raw: string): CardSpec[] | null {
	const data: unknown = JSON.parse(raw);
	if (!Array.isArray(data)) {
		return null;
	}
	const specs: CardSpec[] = [];
	for (const item of data) {
		if (typeof item !== 'object' || item === null) {
			return null;
		}
		const { op, value } = item as { op?: unknown; value?: unknown };
		if (!isOp(op) || typeof value !== 'number') {
			return null;
		}
		specs.push({ op, value });
	}
	return validateDeck(specs).ok ? specs : null;
}

/** Returns the saved deck, or STARTER_DECK if nothing saved / data invalid / storage throws. Never throws. */
export function loadDeck(): CardSpec[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw !== null) {
			const specs = parseDeck(raw);
			if (specs) {
				return specs;
			}
		}
	} catch {
		// storage unavailable or corrupt JSON: fall through to the preset
	}
	return STARTER_DECK.map((c) => ({ ...c }));
}

/** Saves the deck. Returns false if storage is unavailable. */
export function saveDeck(specs: CardSpec[]): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(specs));
		return true;
	} catch {
		return false;
	}
}

/** Removes the saved deck (next loadDeck returns STARTER_DECK). */
export function resetDeck(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// nothing to do
	}
}

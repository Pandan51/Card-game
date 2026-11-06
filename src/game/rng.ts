export interface Rng {
	next(): number; // float in [0, 1)
	int(min: number, max: number): number; // integer, inclusive on both ends
	pick<T>(items: readonly T[]): T; // throws if items is empty
	shuffle<T>(items: readonly T[]): T[]; // returns a NEW shuffled array (Fisher-Yates)
}

/** Seeded RNG (mulberry32). Stateful, but deterministic for a given seed. */
export function createRng(seed: number): Rng {
	let a = seed >>> 0;

	const next = (): number => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

	const pick = <T>(items: readonly T[]): T => {
		if (items.length === 0) {
			throw new Error('Cannot pick from an empty array');
		}
		return items[int(0, items.length - 1)];
	};

	const shuffle = <T>(items: readonly T[]): T[] => {
		const result = items.slice();
		for (let i = result.length - 1; i > 0; i--) {
			const j = int(0, i);
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	};

	return { next, int, pick, shuffle };
}

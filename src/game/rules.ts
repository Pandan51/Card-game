import type { CardSpec, GameState, Op, Slot, Status } from './types';

export function applyToPool(pool: number, op: Op, value: number): number {
	return op === 'multiply' ? pool * value : pool + value;
}

/**
 * Empty slot: the card becomes the slot base (keeps its op and value).
 * Occupied slot: the card's colour is ignored; only |value| is used with the slot's op.
 */
export function forgeSlot(slot: Slot, card: CardSpec): CardSpec {
	if (slot === null) {
		return { op: card.op, value: card.value };
	}
	const n = Math.abs(card.value);
	switch (slot.op) {
		case 'add':
			return { op: 'add', value: slot.value + n };
		case 'remove':
			return { op: 'remove', value: slot.value - n };
		case 'multiply':
			return { op: 'multiply', value: slot.value * n };
	}
}

export function isWin(pool: number, target: number): boolean {
	return pool === target;
}

export function isAutoLoss(state: GameState): boolean {
	return (
		state.hand.length === 0 &&
		state.deck.length === 0 &&
		state.slots.every((s) => s === null) &&
		state.pool !== state.target
	);
}

export function evaluateStatus(state: GameState): Status {
	if (state.status !== 'playing') {
		return state.status;
	}
	if (isWin(state.pool, state.target)) {
		return 'won';
	}
	if (isAutoLoss(state)) {
		return 'lost';
	}
	return 'playing';
}

export function formatValue(op: Op, value: number): string {
	switch (op) {
		case 'add':
			return `+${Math.abs(value)}`;
		case 'remove':
			return `−${Math.abs(value)}`;
		case 'multiply':
			return `×${Math.abs(value)}`;
	}
}

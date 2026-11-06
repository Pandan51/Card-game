import { playCardToPool, playCardToSlot, playSlotToPool } from './state';
import type { ActionResult, GameState, Move } from './types';

/** Dispatches a Move to the matching action in state.ts. */
export function applyMove(state: GameState, move: Move): ActionResult {
	switch (move.type) {
		case 'cardToPool':
			return playCardToPool(state, move.cardId);
		case 'cardToSlot':
			return playCardToSlot(state, move.cardId, move.slotIndex);
		case 'slotToPool':
			return playSlotToPool(state, move.slotIndex);
	}
}

/** True if applyMove would succeed. Used to highlight valid drop zones. */
export function isMoveValid(state: GameState, move: Move): boolean {
	return applyMove(state, move).ok;
}

/** All valid moves in the current state. */
export function listMoves(state: GameState): Move[] {
	if (state.status !== 'playing') {
		return [];
	}
	const moves: Move[] = [];
	for (const card of state.hand) {
		moves.push({ type: 'cardToPool', cardId: card.id });
		for (let slotIndex = 0; slotIndex < state.slots.length; slotIndex++) {
			moves.push({ type: 'cardToSlot', cardId: card.id, slotIndex });
		}
	}
	state.slots.forEach((slot, slotIndex) => {
		if (slot !== null) {
			moves.push({ type: 'slotToPool', slotIndex });
		}
	});
	return moves;
}

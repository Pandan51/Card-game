import './style.css';
import { createRound, giveUp } from './game/state';
import { applyMove } from './game/moves';
import type { GameState, Move } from './game/types';
import { openDeckEditor } from './ui/deckEditor';
import { openDeckView } from './ui/deckView';
import { initDrag } from './ui/drag';
import { render, renderError, type UiHandlers } from './ui/render';
import { loadDeck, resetDeck, saveDeck } from './ui/storage';

const root = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
if (!root || !modalRoot) {
	throw new Error('Missing #app or #modal-root in index.html');
}

let state: GameState | null = null;

const handlers: UiHandlers = {
	onMove: handleMove,
	onGiveUp: handleGiveUp,
	onNewRound: () => startNewRound(),
	onOpenDeckView: () => {
		if (state) {
			openDeckView(modalRoot, state);
		}
	},
	onOpenDeckEditor: () => {
		openDeckEditor(modalRoot, {
			initial: loadDeck(),
			onSave: (specs) => {
				if (!saveDeck(specs)) {
					window.alert('Could not save the deck (browser storage is unavailable).');
				}
			},
			onClose: () => undefined,
		});
	},
};

function rerender(): void {
	if (root && state) {
		render(root, state, handlers);
	}
}

function randomSeed(): number {
	return Math.floor(Math.random() * 0x100000000);
}

function showRoundError(message: string, details: string[]): void {
	if (!root) {
		return;
	}
	renderError(root, message, details, [
		{
			label: 'Reset deck to preset',
			onClick: () => {
				resetDeck();
				startNewRound();
			},
		},
		{ label: 'Edit deck', onClick: handlers.onOpenDeckEditor },
	]);
}

function startNewRound(seed: number = randomSeed()): void {
	const result = createRound(loadDeck(), seed);
	if (result.ok) {
		state = result.state;
		rerender();
		return;
	}
	state = null;
	showRoundError(
		result.error === 'NO_VALID_TARGET'
			? 'No solvable target could be generated for this deck. Try adding stronger cards.'
			: 'The saved deck is not valid.',
		result.details ?? [],
	);
}

function handleMove(move: Move): void {
	if (!state) {
		return;
	}
	state = applyMove(state, move).state;
	rerender();
}

function handleGiveUp(): void {
	if (!state) {
		return;
	}
	state = giveUp(state);
	rerender();
}

initDrag(
	root,
	() => {
		if (!state) {
			throw new Error('No active round');
		}
		return state;
	},
	handleMove,
);

startNewRound();

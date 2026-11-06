import { HAND_SIZE } from '../game/constants';
import { formatValue } from '../game/rules';
import type { CardSpec, GameState, Move, Slot } from '../game/types';

export interface UiHandlers {
	onMove(move: Move): void;
	onGiveUp(): void;
	onNewRound(): void;
	onOpenDeckView(): void;
	onOpenDeckEditor(): void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) {
		node.className = className;
	}
	if (text !== undefined) {
		node.textContent = text;
	}
	return node;
}

/** Renders a card face. When `id` is given the card is a drag source (hand card). */
export function renderCard(card: CardSpec, id?: string): HTMLElement {
	const node = el('div', `card card--${card.op}`, formatValue(card.op, card.value));
	if (id !== undefined) {
		node.dataset.drag = 'card';
		node.dataset.cardId = id;
	}
	return node;
}

/** Renders a forge slot. Draggable only when it holds a value. */
export function renderSlot(slot: Slot, index: number): HTMLElement {
	const node = el('div', slot ? `slot slot--${slot.op}` : 'slot slot--empty');
	node.dataset.drop = 'slot';
	node.dataset.slotIndex = String(index);

	if (slot) {
		node.dataset.drag = 'slot';
		node.append(el('span', 'slot__value', formatValue(slot.op, slot.value)));
		node.append(el('span', 'slot__hint', 'drag to pool'));
	} else {
		node.append(el('span', 'slot__label', 'Forge'));
		node.append(el('span', 'slot__hint', 'drop a card'));
	}
	return node;
}

/** Win/lose overlay; null while the round is still being played. */
export function renderOverlay(state: GameState, onNewRound: () => void): HTMLElement | null {
	if (state.status === 'playing') {
		return null;
	}
	const won = state.status === 'won';
	const overlay = el('div', 'overlay');
	const box = el('div', `overlay__box overlay__box--${state.status}`);
	box.append(el('h2', 'overlay__title', won ? 'Target reached!' : 'Round lost'));
	box.append(
		el(
			'p',
			'overlay__text',
			won
				? `The pool is exactly ${state.target}.`
				: `The pool ended at ${state.pool}, the target was ${state.target}.`,
		),
	);
	const button = el('button', 'btn btn--primary', 'New round');
	button.type = 'button';
	button.addEventListener('click', onNewRound);
	box.append(button);
	overlay.append(box);
	return overlay;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
	const b = el('button', `btn ${className}`, label);
	b.type = 'button';
	b.addEventListener('click', onClick);
	return b;
}

/** Full re-render of the board (simple and fast enough for this size). */
export function render(root: HTMLElement, state: GameState, handlers: UiHandlers): void {
	root.replaceChildren();
	const app = el('div', 'board');

	// Top: target + pool
	const scoreboard = el('section', 'scoreboard');
	const target = el('div', 'stat stat--target');
	target.append(el('span', 'stat__label', 'Target'), el('span', 'stat__value', String(state.target)));
	const pool = el('div', 'stat stat--pool');
	pool.dataset.drop = 'pool';
	pool.append(el('span', 'stat__label', 'Pool'), el('span', 'stat__value', String(state.pool)));
	pool.append(el('span', 'stat__hint', 'drop here'));
	scoreboard.append(target, pool);

	// Middle: slots
	const slots = el('section', 'slots');
	state.slots.forEach((slot, i) => slots.append(renderSlot(slot, i)));

	// Bottom: hand
	const hand = el('section', 'hand');
	for (const card of state.hand) {
		hand.append(renderCard(card, card.id));
	}
	for (let i = state.hand.length; i < HAND_SIZE; i++) {
		hand.append(el('div', 'card card--placeholder'));
	}

	// Side buttons
	const side = el('aside', 'side');
	const playing = state.status === 'playing';
	side.append(button(`Deck (${state.deck.length})`, 'btn--secondary', handlers.onOpenDeckView));
	side.append(button('Edit deck', 'btn--secondary', handlers.onOpenDeckEditor));
	const giveUp = button('Give up', 'btn--danger', handlers.onGiveUp);
	giveUp.disabled = !playing;
	side.append(giveUp);
	side.append(button('New round', 'btn--primary', handlers.onNewRound));

	const main = el('main', 'board__main');
	main.append(scoreboard, slots, hand);

	app.append(el('h1', 'title', 'Number Forge'), main, side);

	const overlay = renderOverlay(state, handlers.onNewRound);
	if (overlay) {
		app.append(overlay);
	}
	root.append(app);
}

/** Shows an error message with recovery actions (used when a round cannot be created). */
export function renderError(
	root: HTMLElement,
	message: string,
	details: string[],
	actions: { label: string; onClick: () => void }[],
): void {
	root.replaceChildren();
	const box = el('div', 'board error');
	box.append(el('h1', 'title', 'Number Forge'));
	box.append(el('p', 'error__text', message));
	if (details.length > 0) {
		const list = el('ul', 'error__list');
		for (const d of details) {
			list.append(el('li', undefined, d));
		}
		box.append(list);
	}
	const row = el('div', 'error__actions');
	for (const a of actions) {
		row.append(button(a.label, 'btn--primary', a.onClick));
	}
	box.append(row);
	root.append(box);
}

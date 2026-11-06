import {
	ADD_REMOVE_MAX,
	ADD_REMOVE_MIN,
	DECK_MAX_SIZE,
	DECK_MIN_SIZE,
	MULTIPLY_MAX,
	MULTIPLY_MIN,
} from '../game/constants';
import { makeCardSpec, STARTER_DECK, summarizeDeck, validateDeck } from '../game/decks';
import { formatValue } from '../game/rules';
import type { CardSpec, Op } from '../game/types';
import { openModal } from './modal';
import { el } from './render';

export interface DeckEditorOptions {
	initial: CardSpec[];
	onSave(specs: CardSpec[]): void; // called only when validateDeck(...).ok
	onClose(): void;
}

const OP_LABEL: Record<Op, string> = { add: 'Add (+)', remove: 'Remove (−)', multiply: 'Multiply (×)' };

function rangeFor(op: Op): { min: number; max: number } {
	return op === 'multiply' ? { min: MULTIPLY_MIN, max: MULTIPLY_MAX } : { min: ADD_REMOVE_MIN, max: ADD_REMOVE_MAX };
}

/** Opens the deck editor modal. Returns a close function. */
export function openDeckEditor(root: HTMLElement, options: DeckEditorOptions): () => void {
	let specs: CardSpec[] = options.initial.map((c) => ({ ...c }));
	const modal = openModal(root, 'Deck editor', options.onClose);

	// Controls: persistent, so they keep focus while the list re-renders.
	const controls = el('div', 'editor__controls');
	const opSelect = el('select', 'editor__select');
	(['add', 'remove', 'multiply'] as const).forEach((op) => {
		const option = el('option', undefined, OP_LABEL[op]);
		option.value = op;
		opSelect.append(option);
	});
	const valueSelect = el('select', 'editor__select');
	const fillValues = (): void => {
		const { min, max } = rangeFor(opSelect.value as Op);
		const previous = Number(valueSelect.value);
		valueSelect.replaceChildren();
		for (let n = min; n <= max; n++) {
			const option = el('option', undefined, String(n));
			option.value = String(n);
			valueSelect.append(option);
		}
		valueSelect.value = String(Math.min(Math.max(previous || min, min), max));
	};
	opSelect.addEventListener('change', fillValues);
	fillValues();

	const addButton = el('button', 'btn btn--secondary', 'Add card');
	addButton.type = 'button';
	controls.append(opSelect, valueSelect, addButton);

	const summary = el('p', 'modal__note');
	const list = el('div', 'editor__list');
	const errors = el('ul', 'editor__errors');
	const saved = el('p', 'editor__saved');

	const footer = el('div', 'editor__footer');
	const resetButton = el('button', 'btn btn--secondary', 'Reset to preset');
	resetButton.type = 'button';
	const saveButton = el('button', 'btn btn--primary', 'Save');
	saveButton.type = 'button';
	footer.append(resetButton, saveButton);

	modal.body.append(controls, summary, list, errors, saved, footer);

	const refresh = (): void => {
		summary.textContent = `${specs.length} cards (allowed ${DECK_MIN_SIZE}–${DECK_MAX_SIZE}). Click a card to remove one copy.`;

		list.replaceChildren();
		for (const group of summarizeDeck(specs)) {
			const chip = el('button', `editor__chip card card--${group.op}`);
			chip.type = 'button';
			chip.title = 'Remove one copy';
			chip.append(el('span', 'editor__chip-value', formatValue(group.op, group.value)));
			if (group.count > 1) {
				chip.append(el('span', 'editor__chip-count', `×${group.count}`));
			}
			chip.addEventListener('click', () => {
				const index = specs.findIndex((s) => s.op === group.op && s.value === group.value);
				if (index !== -1) {
					specs = specs.filter((_, i) => i !== index);
					saved.textContent = '';
					refresh();
				}
			});
			list.append(chip);
		}

		errors.replaceChildren();
		const validation = validateDeck(specs);
		if (!validation.ok) {
			for (const message of validation.errors) {
				errors.append(el('li', undefined, message));
			}
		}
		saveButton.disabled = !validation.ok;
	};

	addButton.addEventListener('click', () => {
		specs = [...specs, makeCardSpec(opSelect.value as Op, Number(valueSelect.value))];
		saved.textContent = '';
		refresh();
	});
	resetButton.addEventListener('click', () => {
		specs = STARTER_DECK.map((c) => ({ ...c }));
		saved.textContent = '';
		refresh();
	});
	saveButton.addEventListener('click', () => {
		if (validateDeck(specs).ok) {
			options.onSave(specs.map((c) => ({ ...c })));
			saved.textContent = 'Saved. The deck is used from the next round.';
		}
	});

	refresh();
	return modal.close;
}

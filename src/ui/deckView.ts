import { summarizeDeck } from '../game/decks';
import type { GameState } from '../game/types';
import { openModal } from './modal';
import { el, renderCard } from './render';

/** Opens a modal listing the remaining draw pile (grouped, draw order hidden). Returns a close function. */
export function openDeckView(root: HTMLElement, state: GameState): () => void {
	const modal = openModal(root, `Draw pile (${state.deck.length} cards)`);

	if (state.deck.length === 0) {
		modal.body.append(el('p', 'modal__empty', 'The draw pile is empty.'));
		return modal.close;
	}

	modal.body.append(el('p', 'modal__note', 'Sorted by type. The draw order is hidden.'));
	const list = el('div', 'deck-groups');
	for (const group of summarizeDeck(state.deck)) {
		const item = el('div', 'deck-group');
		item.append(renderCard(group, undefined));
		item.append(el('span', 'deck-group__count', `× ${group.count}`));
		list.append(item);
	}
	modal.body.append(list);
	return modal.close;
}

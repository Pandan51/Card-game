import { el } from './render';

export interface Modal {
	body: HTMLElement;
	close: () => void;
}

/** Generic modal shell shared by the deck view and the deck editor. Closes on backdrop click and Escape. */
export function openModal(root: HTMLElement, title: string, onClose?: () => void): Modal {
	const backdrop = el('div', 'modal');
	const dialog = el('div', 'modal__dialog');
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-label', title);

	const header = el('div', 'modal__header');
	header.append(el('h2', 'modal__title', title));
	const closeButton = el('button', 'btn btn--secondary modal__close', 'Close');
	closeButton.type = 'button';
	header.append(closeButton);

	const body = el('div', 'modal__body');
	dialog.append(header, body);
	backdrop.append(dialog);
	root.append(backdrop);

	let closed = false;
	const close = (): void => {
		if (closed) {
			return;
		}
		closed = true;
		window.removeEventListener('keydown', onKeyDown);
		backdrop.remove();
		onClose?.();
	};
	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') {
			close();
		}
	};

	closeButton.addEventListener('click', close);
	backdrop.addEventListener('pointerdown', (e) => {
		if (e.target === backdrop) {
			close();
		}
	});
	window.addEventListener('keydown', onKeyDown);

	return { body, close };
}

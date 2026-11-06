import { isMoveValid } from '../game/moves';
import type { GameState, Move } from '../game/types';

export type DragSource = { kind: 'card'; cardId: string } | { kind: 'slot'; slotIndex: number };
export type DropTarget = { kind: 'pool' } | { kind: 'slot'; slotIndex: number };

/** Maps a drag pair to a Move, or null if the combination is never allowed (e.g. slot -> slot). */
export function toMove(source: DragSource, target: DropTarget): Move | null {
	if (source.kind === 'card') {
		return target.kind === 'pool'
			? { type: 'cardToPool', cardId: source.cardId }
			: { type: 'cardToSlot', cardId: source.cardId, slotIndex: target.slotIndex };
	}
	return target.kind === 'pool' ? { type: 'slotToPool', slotIndex: source.slotIndex } : null;
}

const DRAG_THRESHOLD_PX = 5;

function readSource(node: HTMLElement): DragSource | null {
	if (node.dataset.drag === 'card' && node.dataset.cardId !== undefined) {
		return { kind: 'card', cardId: node.dataset.cardId };
	}
	if (node.dataset.drag === 'slot' && node.dataset.slotIndex !== undefined) {
		return { kind: 'slot', slotIndex: Number(node.dataset.slotIndex) };
	}
	return null;
}

function readTarget(node: HTMLElement): DropTarget | null {
	if (node.dataset.drop === 'pool') {
		return { kind: 'pool' };
	}
	if (node.dataset.drop === 'slot' && node.dataset.slotIndex !== undefined) {
		return { kind: 'slot', slotIndex: Number(node.dataset.slotIndex) };
	}
	return null;
}

interface ActiveDrag {
	pointerId: number;
	source: DragSource;
	sourceEl: HTMLElement;
	startX: number;
	startY: number;
	offsetX: number;
	offsetY: number;
	ghost: HTMLElement | null;
	hovered: HTMLElement | null;
}

/**
 * Attaches pointer-event drag & drop to root (event delegation, survives re-renders).
 * getState is read on drag start to highlight targets where isMoveValid(...) is true.
 * Returns a cleanup function that removes all listeners.
 */
export function initDrag(
	root: HTMLElement,
	getState: () => GameState,
	onMove: (move: Move) => void,
): () => void {
	let active: ActiveDrag | null = null;

	const dropZones = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-drop]')];

	const moveFor = (target: HTMLElement | null): Move | null => {
		if (!active || !target) {
			return null;
		}
		const dropTarget = readTarget(target);
		return dropTarget ? toMove(active.source, dropTarget) : null;
	};

	const clearHighlights = (): void => {
		for (const zone of dropZones()) {
			zone.classList.remove('drop--valid', 'drop--hover');
		}
	};

	const targetAt = (x: number, y: number): HTMLElement | null => {
		const found = document.elementFromPoint(x, y);
		return found instanceof HTMLElement ? found.closest<HTMLElement>('[data-drop]') : null;
	};

	const beginGhost = (drag: ActiveDrag): void => {
		const rect = drag.sourceEl.getBoundingClientRect();
		const ghost = drag.sourceEl.cloneNode(true) as HTMLElement;
		delete ghost.dataset.drag;
		delete ghost.dataset.drop;
		ghost.classList.add('drag-ghost');
		ghost.style.width = `${rect.width}px`;
		ghost.style.height = `${rect.height}px`;
		document.body.append(ghost);
		drag.ghost = ghost;
		drag.sourceEl.classList.add('dragging');

		const state = getState();
		for (const zone of dropZones()) {
			const move = moveFor(zone);
			if (move && isMoveValid(state, move)) {
				zone.classList.add('drop--valid');
			}
		}
	};

	const endDrag = (): void => {
		if (!active) {
			return;
		}
		active.ghost?.remove();
		active.sourceEl.classList.remove('dragging');
		if (active.sourceEl.hasPointerCapture?.(active.pointerId)) {
			active.sourceEl.releasePointerCapture(active.pointerId);
		}
		clearHighlights();
		active = null;
	};

	const onPointerDown = (e: PointerEvent): void => {
		if (active || (e.pointerType === 'mouse' && e.button !== 0)) {
			return;
		}
		if (!(e.target instanceof HTMLElement)) {
			return;
		}
		const sourceEl = e.target.closest<HTMLElement>('[data-drag]');
		if (!sourceEl || !root.contains(sourceEl)) {
			return;
		}
		const source = readSource(sourceEl);
		if (!source) {
			return;
		}
		const rect = sourceEl.getBoundingClientRect();
		active = {
			pointerId: e.pointerId,
			source,
			sourceEl,
			startX: e.clientX,
			startY: e.clientY,
			offsetX: e.clientX - rect.left,
			offsetY: e.clientY - rect.top,
			ghost: null,
			hovered: null,
		};
		sourceEl.setPointerCapture(e.pointerId);
		e.preventDefault();
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (!active || e.pointerId !== active.pointerId) {
			return;
		}
		if (!active.ghost) {
			const dx = e.clientX - active.startX;
			const dy = e.clientY - active.startY;
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
				return;
			}
			beginGhost(active);
		}
		const ghost = active.ghost;
		if (ghost) {
			ghost.style.transform = `translate(${e.clientX - active.offsetX}px, ${e.clientY - active.offsetY}px)`;
		}

		const hovered = targetAt(e.clientX, e.clientY);
		if (hovered !== active.hovered) {
			active.hovered?.classList.remove('drop--hover');
			active.hovered = hovered;
		}
		if (hovered?.classList.contains('drop--valid')) {
			hovered.classList.add('drop--hover');
		}
	};

	const onPointerUp = (e: PointerEvent): void => {
		if (!active || e.pointerId !== active.pointerId) {
			return;
		}
		const wasDragging = active.ghost !== null;
		const move = wasDragging ? moveFor(targetAt(e.clientX, e.clientY)) : null;
		endDrag();
		if (move && isMoveValid(getState(), move)) {
			onMove(move);
		}
	};

	const onPointerCancel = (e: PointerEvent): void => {
		if (active && e.pointerId === active.pointerId) {
			endDrag();
		}
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') {
			endDrag();
		}
	};

	root.addEventListener('pointerdown', onPointerDown);
	root.addEventListener('pointermove', onPointerMove);
	root.addEventListener('pointerup', onPointerUp);
	root.addEventListener('pointercancel', onPointerCancel);
	window.addEventListener('keydown', onKeyDown);

	return () => {
		endDrag();
		root.removeEventListener('pointerdown', onPointerDown);
		root.removeEventListener('pointermove', onPointerMove);
		root.removeEventListener('pointerup', onPointerUp);
		root.removeEventListener('pointercancel', onPointerCancel);
		window.removeEventListener('keydown', onKeyDown);
	};
}

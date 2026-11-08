import { applyItemMove, moveItemToEdge } from './moveItemCommands';

/**
 * Command: moves the item at the cursor, with anything nested under it, above
 * its first sibling. Only the item's own line used to move, leaving its
 * children under another item, and a nested item jumped out of its parent.
 */
export function onMoveItemToTop(): Promise<void> {
    return applyItemMove((l, i, p) => moveItemToEdge(l, i, true, p), 'CL: Place cursor on a chevron item');
}

/** Command: moves the item at the cursor, with anything nested under it, below its last sibling */
export function onMoveItemToBottom(): Promise<void> {
    return applyItemMove((l, i, p) => moveItemToEdge(l, i, false, p), 'CL: Place cursor on a chevron item');
}

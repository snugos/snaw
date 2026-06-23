// js/TrackReorderHotkeys.js - Reorder Selected Track via Alt+ArrowUp / Alt+ArrowDown
// Move the active track one slot up or down in the track list. Undo-aware
// (delegates to state.js reorderTrackInState which already pushes an undo
// snapshot via captureStateForUndoInternal — do NOT capture again here, or
// every Alt+Arrow press produces two undo entries and the user must press
// Ctrl+Z twice to undo a single move).
//
// Toast feedback uses localAppServices.showSafeNotification (the actual
// method on appServices); a few older code paths in this file referenced
// showNotification which is undefined on appServices, so all three toasts
// were silent no-ops.

import {
    getActiveSequencerTrackIdState,
    setActiveSequencerTrackIdState,
    getTracksState,
    reorderTrackInState,
} from './state.js';

let localAppServices = {};
let isInitialized = false;

/**
 * Surface a short toast to the user, matching the other Snaw features.
 * Prefers appServices.showSafeNotification (the canonical name on
 * appServices) and falls back to showNotification if a future caller
 * wires that name instead.
 */
function notify(message, duration) {
    if (!message) return;
    const svc = localAppServices;
    if (svc && typeof svc.showSafeNotification === 'function') {
        svc.showSafeNotification(message, duration);
    } else if (svc && typeof svc.showNotification === 'function') {
        svc.showNotification(message, duration);
    }
}

/**
 * Initialize the Track Reorder Hotkeys feature
 * @param {object} appServices - The main appServices object from main.js
 */
export function initTrackReorderHotkeys(appServices) {
    localAppServices = appServices || {};

    if (typeof window !== 'undefined' && !isInitialized) {
        window.addEventListener('keydown', handleReorderKeydown);
        isInitialized = true;
        console.log('[TrackReorderHotkeys] Initialized - Alt+ArrowUp / Alt+ArrowDown to move active track');
    }
}

/**
 * Handle Alt+Arrow keydowns for track reordering.
 */
function handleReorderKeydown(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
                   target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveActiveTrackBy(-1);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveActiveTrackBy(+1);
    }
}

/**
 * Move the active sequencer track by `delta` slots (-1 = up, +1 = down).
 */
export function moveActiveTrackBy(delta) {
    const activeId = typeof getActiveSequencerTrackIdState === 'function'
        ? getActiveSequencerTrackIdState() : null;
    if (activeId == null) {
        notify('Select a track first (click track header)', 1500);
        return false;
    }

    const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
    if (!Array.isArray(tracks) || tracks.length < 2) return false;

    const oldIndex = tracks.findIndex(t => t && t.id === activeId);
    if (oldIndex === -1) return false;

    const newIndex = oldIndex + delta;
    if (newIndex < 0 || newIndex >= tracks.length) {
        const at = delta < 0 ? 'top' : 'bottom';
        notify(`Track already at ${at}`, 1200);
        return false;
    }

    const movedTrack = tracks[oldIndex];
    const movedName = movedTrack && movedTrack.name ? movedTrack.name : 'track';

    // reorderTrackInState pushes an undo snapshot via captureStateForUndoInternal;
    // do not call it again here or the user will need two Ctrl+Z presses to undo
    // a single Alt+Arrow move.
    if (typeof reorderTrackInState === 'function') {
        reorderTrackInState(activeId, newIndex);
    }

    // Keep the moved track selected so further Alt+Arrow presses keep moving it.
    if (typeof setActiveSequencerTrackIdState === 'function') {
        setActiveSequencerTrackIdState(activeId);
    }

    const dir = delta < 0 ? 'up' : 'down';
    notify(`Moved "${movedName}" ${dir}`, 1200);
    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();

    return true;
}

export function isTrackReorderHotkeysInitialized() {
    return isInitialized;
}
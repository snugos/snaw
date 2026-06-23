// js/TrackReorderHotkeys.js - Reorder Selected Track via Alt+ArrowUp / Alt+ArrowDown
// Move the active track one slot up or down in the track list. Undo-aware
// (delegates to state.js captureStateForUndo / reorderTrackInState which
// already push an undo snapshot).

import {
    getActiveSequencerTrackIdState,
    setActiveSequencerTrackIdState,
    getTracksState,
    reorderTrackInState,
    captureStateForUndoInternal,
} from './state.js';

let localAppServices = {};
let isInitialized = false;

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
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Select a track first (click track header)', 1500);
        }
        return false;
    }

    const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
    if (!Array.isArray(tracks) || tracks.length < 2) return false;

    const oldIndex = tracks.findIndex(t => t && t.id === activeId);
    if (oldIndex === -1) return false;

    const newIndex = oldIndex + delta;
    if (newIndex < 0 || newIndex >= tracks.length) {
        if (localAppServices.showNotification) {
            const at = delta < 0 ? 'top' : 'bottom';
            localAppServices.showNotification(`Track already at ${at}`, 1200);
        }
        return false;
    }

    const movedTrack = tracks[oldIndex];
    const movedName = movedTrack && movedTrack.name ? movedTrack.name : 'track';

    if (typeof captureStateForUndoInternal === 'function') {
        captureStateForUndoInternal(`Reorder track "${movedName}"`);
    }
    if (typeof reorderTrackInState === 'function') {
        reorderTrackInState(activeId, newIndex);
    }

    // Keep the moved track selected so further Alt+Arrow presses keep moving it.
    if (typeof setActiveSequencerTrackIdState === 'function') {
        setActiveSequencerTrackIdState(activeId);
    }

    if (localAppServices.showNotification) {
        const dir = delta < 0 ? 'up' : 'down';
        localAppServices.showNotification(`Moved "${movedName}" ${dir}`, 1200);
    }
    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();

    return true;
}

export function isTrackReorderHotkeysInitialized() {
    return isInitialized;
}
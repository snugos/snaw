// js/DuplicateTrackHotkey.js - Shift+D Quick "Duplicate Track Under Source" Hotkey
// Press Shift+D to duplicate the currently-selected track (or the active
// sequencer track if no track is explicitly selected) and place the new copy
// DIRECTLY UNDER the source — not at the end of the track list. This is the
// "stems" workflow: hit Shift+D a few times to branch a single source into a
// stack of parallel variations that stay grouped together for easy muting
// and reordering, instead of scattering copies to the bottom of the list
// (which is what the existing Ctrl+D Duplicate Track hotkey does).
//
// Undo behavior: state.js's duplicateTrack() and reorderTrackInState() each
// push their own undo snapshot via captureStateForUndoInternal, so a single
// Shift+D press creates two undo entries ("Duplicate Track ..." followed by
// "Reorder Track"). The user undoes the move first, then the duplicate —
// the net effect is the same as a single atomic undo would produce, and the
// per-action descriptions in the Undo History panel are more informative.
// This matches the pattern established in TrackReorderHotkeys.js: delegate
// the capture to state.js rather than rolling our own.
//
// Toast feedback uses localAppServices.showSafeNotification (the canonical
// method on appServices); showNotification is the older name still present
// on some paths, so we try both.

import {
    getActiveSequencerTrackIdState,
    getTracksState,
    duplicateTrack,
    reorderTrackInState,
} from './state.js';

let localAppServices = {};
let isInitialized = false;
let selectedTrackId = null;

/**
 * Surface a short toast to the user, matching the other Snaw track hotkeys.
 * Prefers appServices.showSafeNotification (canonical) and falls back to
 * showNotification if a future caller wires that name instead.
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
 * Initialize the Duplicate Track Hotkey feature.
 * @param {object} appServices - The main appServices object from main.js
 */
export function initDuplicateTrackHotkey(appServices) {
    localAppServices = appServices || {};

    if (typeof window !== 'undefined' && !isInitialized) {
        document.addEventListener('mousedown', handleTrackSelection);
        window.addEventListener('keydown', handleDuplicateKeydown);
        isInitialized = true;

        // Mirror the entry point on window so the global KeyboardShortcuts
        // module (loaded as a regular <script>, not an ES module) can call
        // it via the same `window.X` lookup pattern it uses for every other
        // hotkey in the registry (see KeyboardShortcuts.js:69-70).
        if (typeof window.duplicateActiveTrackUnderSource !== 'function') {
            window.duplicateActiveTrackUnderSource = duplicateActiveOrSelectedTrackUnderSource;
        }

        console.log('[DuplicateTrackHotkey] Initialized - Shift+D to duplicate track under source');
    }
}

/**
 * Track mousedown on track elements to remember the "selected" track.
 * Mirrors the pattern from TrackFreezeQuickToggle.js (mousedown on
 * .timeline-track-lane / .track-header / [data-track-id]).
 */
function handleTrackSelection(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const trackEl = target.closest('.timeline-track-lane, .track-header, [data-track-id]');
    if (trackEl && trackEl.dataset && trackEl.dataset.trackId != null) {
        const parsed = parseInt(trackEl.dataset.trackId, 10);
        if (!Number.isNaN(parsed)) {
            selectedTrackId = parsed;
        }
    }
}

/**
 * Shift+D key handler — duplicate the selected/active track under the source.
 */
function handleDuplicateKeydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!event.shiftKey) return;
    if (event.key !== 'D' && event.key !== 'd') return;

    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
                   target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
    }

    event.preventDefault();
    duplicateActiveOrSelectedTrackUnderSource();
}

/**
 * Resolve the source track id for the duplicate action. Order of precedence:
 *   1. The last track the user mousedown-clicked (the "selected" track).
 *   2. The active sequencer track (what the rest of Snaw considers "active"
 *      when no explicit selection exists — see TrackReorderHotkeys.js).
 *   3. null (no candidate available; caller will surface a toast).
 */
function resolveSourceTrackId() {
    if (selectedTrackId != null) {
        const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
        if (Array.isArray(tracks) && tracks.some(t => t && t.id === selectedTrackId)) {
            return selectedTrackId;
        }
    }
    if (typeof getActiveSequencerTrackIdState === 'function') {
        const activeId = getActiveSequencerTrackIdState();
        if (activeId != null) {
            const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
            if (Array.isArray(tracks) && tracks.some(t => t && t.id === activeId)) {
                return activeId;
            }
        }
    }
    return null;
}

/**
 * Duplicate the source track and move the new copy to the slot immediately
 * below the source. If the source is already at the end of the track list
 * the duplicate (which is pushed to the end by state.js) is already in the
 * right place, so the reorder step is a no-op.
 */
export async function duplicateActiveOrSelectedTrackUnderSource() {
    const sourceId = resolveSourceTrackId();
    if (sourceId == null) {
        notify('Select a track first (click a track header)', 1800);
        return null;
    }

    const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
    if (!Array.isArray(tracks) || tracks.length === 0) {
        notify('No tracks to duplicate', 1500);
        return null;
    }

    const sourceIndex = tracks.findIndex(t => t && t.id === sourceId);
    if (sourceIndex === -1) {
        notify('Source track not found', 1500);
        return null;
    }
    const sourceName = (tracks[sourceIndex] && tracks[sourceIndex].name) || 'Track';

    // state.js duplicateTrack captures its own undo entry and pushes the
    // new track onto the END of the tracks array. We then re-order it to
    // sit directly under the source.
    let newTrack = null;
    if (typeof duplicateTrack === 'function') {
        newTrack = await duplicateTrack(sourceId);
    }

    if (!newTrack || newTrack.id == null) {
        // state.js already surfaced a "Track not found" / error toast in the
        // failure path; nothing more to do here.
        return null;
    }

    // After duplicateTrack returns, the new track is the last element of
    // the live tracks array. Move it to sourceIndex + 1 (right under the
    // source) so the user sees a stacked pair rather than a bottom-of-list
    // copy. If the source was already at the end of the list, the new
    // track IS already in that position and reorderTrackInState will
    // early-return (oldIndex === newIndex).
    const targetIndex = sourceIndex + 1;
    if (typeof reorderTrackInState === 'function') {
        reorderTrackInState(newTrack.id, targetIndex);
    }

    // Keep the SOURCE selected (not the new copy) so a follow-up Shift+D
    // duplicates the same source again, building a stacked family of
    // parallel variations — the headline workflow for this hotkey.
    selectedTrackId = sourceId;

    if (localAppServices.renderTimeline) {
        try { localAppServices.renderTimeline(); } catch (_) { /* non-fatal */ }
    }
    if (localAppServices.updateMixerWindow) {
        try { localAppServices.updateMixerWindow(); } catch (_) { /* non-fatal */ }
    }

    notify(`Duplicated "${sourceName}" under source`, 1500);
    return newTrack;
}

export function isDuplicateTrackHotkeyInitialized() {
    return isInitialized;
}

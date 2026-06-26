// js/QuickBounce.js - Quick Bounce (one-click, no dialog)
// Skips the bounce confirmation dialog and immediately renders the selected
// clips (or, when nothing is selected, every clip on the first non-empty track)
// to audio in place. Bound to Ctrl/Cmd+Shift+B to coexist with Ctrl/Cmd+B
// which opens the full Bounce dialog.

import {
    bounceSelectedClipsToAudio,
    isBouncingActive
} from './BounceSelectedToAudio.js';

let localAppServices = {};
let keyboardBound = false;

/**
 * Find the track that owns the given clip IDs. Scans all tracks and returns
 * the first track whose `clips` array contains any of the supplied IDs.
 * Returns null if no track matches.
 */
function findTrackForClipIds(clipIds) {
    if (!Array.isArray(clipIds) || clipIds.length === 0) return null;
    const getTracks = localAppServices.getTracks;
    if (typeof getTracks !== 'function') return null;
    const tracks = getTracks() || [];
    const set = new Set(clipIds);
    for (const track of tracks) {
        if (track && Array.isArray(track.clips) && track.clips.some(c => set.has(c.id))) {
            return track;
        }
    }
    return null;
}

/**
 * Find the first track that has at least one clip. Used when no clips are
 * explicitly selected — quick bounce will then bounce that track's full
 * contents.
 */
function findFirstTrackWithClips() {
    const getTracks = localAppServices.getTracks;
    if (typeof getTracks !== 'function') return null;
    const tracks = getTracks() || [];
    for (const track of tracks) {
        if (track && Array.isArray(track.clips) && track.clips.length > 0) {
            return track;
        }
    }
    return null;
}

/**
 * Public: bounce the selected clips right now without opening any dialog.
 * If nothing is selected, falls back to bouncing every clip on the first
 * track that has clips. Returns true on a successful bounce launch, false
 * otherwise (with a notification explaining why).
 *
 * @returns {Promise<boolean>}
 */
export async function quickBounce() {
    if (isBouncingActive && isBouncingActive()) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Bounce already in progress...', 1500);
        }
        return false;
    }

    const sel = typeof localAppServices.getSelectedClipIds === 'function'
        ? (localAppServices.getSelectedClipIds() || null)
        : null;
    // ClipSelectionManager.getSelectedClipIds() returns a Set; convert to Array
    // so .length works (Sets have .size, not .length).
    const selectedClipIds = sel instanceof Set ? Array.from(sel) : (sel || []);

    let track = null;
    let clipIds = null;

    if (selectedClipIds.length > 0) {
        track = findTrackForClipIds(selectedClipIds);
        clipIds = selectedClipIds;
    } else {
        track = findFirstTrackWithClips();
    }

    if (!track) {
        if (localAppServices.showNotification) {
            const msg = selectedClipIds.length > 0
                ? 'Quick Bounce: no track found for selected clips.'
                : 'Quick Bounce: no clips on any track. Add or select clips first.';
            localAppServices.showNotification(msg, 2500);
        }
        return false;
    }

    const targetCount = clipIds ? clipIds.length : (track.clips ? track.clips.length : 0);
    if (targetCount === 0) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Quick Bounce: nothing to bounce.', 2000);
        }
        return false;
    }

    if (localAppServices.showNotification) {
        localAppServices.showNotification(
            `Quick Bounce: rendering ${targetCount} clip(s) on "${track.name || 'Track'}"...`,
            1800
        );
    }

    try {
        const ok = await bounceSelectedClipsToAudio(track.id, clipIds);
        return !!ok;
    } catch (err) {
        console.error('[QuickBounce] failed:', err);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Quick Bounce failed: ' + (err && err.message ? err.message : 'unknown error'), 3000);
        }
        return false;
    }
}

/**
 * Bind the Ctrl/Cmd+Shift+B shortcut. Idempotent.
 */
function bindKeyboardShortcut() {
    if (keyboardBound) return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('keydown', (e) => {
        const key = (e.key || '').toLowerCase();
        const isCtrl = !!(e.ctrlKey || e.metaKey);
        const isShift = !!e.shiftKey;
        if (isCtrl && isShift && key === 'b' && !e.altKey) {
            e.preventDefault();
            quickBounce();
        }
    });
    keyboardBound = true;
}

/**
 * One-time init. Stores the app services bag and binds the keyboard shortcut.
 * Safe to call multiple times.
 *
 * @param {object} appServices - the localAppServices bag from eventHandlers (or main).
 */
export function initQuickBounce(appServices = {}) {
    localAppServices = appServices || {};
    bindKeyboardShortcut();
    console.log('[QuickBounce] Initialized (Ctrl/Cmd+Shift+B)');
}
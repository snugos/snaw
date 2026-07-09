/**
 * js/PerTrackMidiPanic.js - Per-Track MIDI Panic
 * Adds a small ⚠ button to each track's mixer channel strip that
 * silences ONLY that one track and sends All-Notes-Off on the
 * track's specific MIDI channel. The global ⚠ Panic button in the
 * transport bar (v0.3.x, Ctrl+Shift+P) is a heavy hammer that stops
 * the whole transport and clears every channel; the per-track panic
 * is the precision scalpel — one track goes silent, the rest of
 * the arrangement keeps playing. Use case: a single track has a
 * stuck note during a live jam, or you want to mute one track's
 * previews in performance mode without losing the playhead position.
 *
 * Wiring:
 *  - `appServices.panicStopTrackAudio(trackId)` is the single source
 *    of truth for "silence this track" — it does stopPlayback(),
 *    gain ramp-down for synth types, and sends All-Notes-Off on
 *    the track's MIDI channel (Omni = all 16). This module is
 *    only the UI: it renders the button and dispatches to the
 *    service.
 *  - The button is rendered inline in `renderTrackStrip` in
 *    `js/ui.js` and uses event delegation (one document-level
 *    click handler) so we don't have to re-bind on every mixer
 *    re-render.
 *  - Clicking the button triggers a brief red flash on the button
 *    itself for unmistakable visual feedback (matches the global
 *    panic button's flash pattern) and pops a one-line
 *    notification with the track name.
 *
 * Tracks that are skipped (no panic button rendered):
 *  - Master — there's no "one track's stuck note" use case for the
 *    master bus; the global panic is the right tool there.
 *  - Lyrics — no audio path to silence.
 *
 * Undo behavior: panicStopTrackAudio is a transient playback-state
 * fix, not a project-state mutation. We deliberately do NOT
 * capture undo here — pressing ⚠⚠⚠ in quick succession would
 * otherwise pollute the undo stack with empty diffs. The same
 * pattern is used by the global panic.
 *
 * (v0.4.00)
 */

let localAppServices = {};
let isInitialized = false;

/**
 * Build the inline HTML for a single track's per-track panic button.
 * Reused by renderTrackStrip (in ui.js) so the look stays consistent.
 */
export function getPerTrackPanicButtonHTML(track) {
    if (!track) return '';
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Lyrics') return '';
    const trackId = track.id != null ? String(track.id) : '';
    return `<button type="button" class="strip-track-panic-btn w-8 h-6 text-xs rounded bg-[#3a1010] text-[#ff8888] hover:bg-[#a02020] hover:text-white border border-[#7a2020]"
                data-track-id="${trackId}"
                title="MIDI Panic for this track only — stops playback, releases notes, sends All-Notes-Off on this track's MIDI channel. Transport keeps playing.">⚠</button>`;
}

/**
 * Initialize the per-track MIDI panic module. Wires click-to-panic
 * on every `.strip-track-panic-btn` that ever appears in the DOM
 * via event delegation.
 */
export function initPerTrackMidiPanic(appServices) {
    localAppServices = appServices || {};
    if (isInitialized) return;
    if (typeof document === 'undefined') return;

    // Event delegation — one document-level click handler for every
    // .strip-track-panic-btn that ever appears. Cheaper than re-binding
    // on every mixer re-render and works for buttons rendered by any
    // module (mixer panel, future timeline track header rebuild, etc.).
    document.addEventListener('click', handlePanicButtonClick);

    // Mirror the entry point on window so right-click context menus
    // and global hotkey wiring (e.g. Shift+Alt+1..9 for panic track N)
    // can call it without importing the ES module. Kept as
    // openPerTrackPanic (verb-form) to match the per-track MIDI
    // channel display's window.openMidiChannelDropdown convention.
    if (typeof window.panicStopTrackById !== 'function') {
        window.panicStopTrackById = panicStopTrackById;
    }
    if (typeof window.getPerTrackPanicButtonHTML !== 'function') {
        window.getPerTrackPanicButtonHTML = getPerTrackPanicButtonHTML;
    }

    isInitialized = true;
    console.log('[PerTrackMidiPanic] Initialized');
}

/**
 * Click handler for any .strip-track-panic-btn in the document.
 * Reads the trackId from data-track-id, calls
 * appServices.panicStopTrackAudio(trackId), flashes the button,
 * and shows a notification. The actual silencing is done in
 * panicStopTrackAudio so the canonical path is reused and the
 * strip button stays a thin UI shell.
 */
function handlePanicButtonClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const btn = target.closest('.strip-track-panic-btn');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const trackId = parseInt(btn.dataset.trackId, 10);
    if (Number.isNaN(trackId)) return;
    panicStopTrackById(trackId, btn);
}

/**
 * Send a per-track panic. Public so window.panicStopTrackById and
 * future hotkey wiring can call it without going through the click
 * handler. The optional `btn` argument is the DOM button to flash;
 * pass null when triggering from a hotkey.
 */
function panicStopTrackById(trackId, btn) {
    if (trackId == null) return false;
    const track = (typeof localAppServices.getTrackById === 'function')
        ? localAppServices.getTrackById(trackId)
        : null;
    const trackName = track ? (track.name || `Track ${trackId}`) : `Track ${trackId}`;

    // Dispatch through the canonical service so the same code path
    // is used for every caller (mixer button, hotkey, future
    // timeline context menu).
    let ok = false;
    if (typeof localAppServices.panicStopTrackAudio === 'function') {
        try {
            ok = localAppServices.panicStopTrackAudio(trackId);
        } catch (e) {
            console.warn(`[PerTrackMidiPanic] panicStopTrackAudio failed for track ${trackId}:`, e);
        }
    } else {
        console.warn('[PerTrackMidiPanic] appServices.panicStopTrackAudio not available.');
    }

    // Visual feedback on the clicked button. If the button was removed
    // (mixer re-render) btn is null and we skip the flash — the
    // notification is the user-visible confirmation in that case.
    if (btn && typeof btn.classList !== 'undefined') {
        try {
            btn.classList.add('!bg-[#ff3030]', '!text-white');
            setTimeout(() => {
                try {
                    btn.classList.remove('!bg-[#ff3030]', '!text-white');
                } catch (e) { /* element gone, ignore */ }
            }, 220);
        } catch (e) { /* non-fatal */ }
    }

    // One-line notification. Prefer showSafeNotification (the v0.3.x
    // canonical global toast) and fall back to showNotification for
    // any other consumer. Never throw if neither is wired — a
    // missing notification must not abort the panic itself.
    if (ok) {
        const msg = `Per-Track MIDI Panic: ${trackName} silenced (All-Notes-Off sent).`;
        if (typeof localAppServices.showSafeNotification === 'function') {
            try { localAppServices.showSafeNotification(msg, 1800); } catch (e) { /* non-fatal */ }
        } else if (typeof localAppServices.showNotification === 'function') {
            try { localAppServices.showNotification(msg, 1800); } catch (e) { /* non-fatal */ }
        }
    } else {
        if (typeof localAppServices.showSafeNotification === 'function') {
            try { localAppServices.showSafeNotification(`Per-Track Panic: ${trackName} not found.`, 1500); } catch (e) { /* non-fatal */ }
        }
    }

    return ok;
}

export function isPerTrackMidiPanicInitialized() {
    return isInitialized;
}

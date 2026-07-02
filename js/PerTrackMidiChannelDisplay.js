/**
 * js/PerTrackMidiChannelDisplay.js - Per-Track MIDI Channel Display
 * Adds a small MIDI-channel indicator next to the track-type label on
 * each mixer channel strip. Reads the existing track.midiChannel
 * (0 = Omni, 1-16 = specific channel) that Track.js already manages
 * and renders a compact "Ch N" / "Omni" pill so the user can see at a
 * glance which MIDI channel each track is listening on.
 *
 * The visual is a passive read-only display — clicking the pill opens
 * a small inline dropdown letting the user change the channel (writes
 * back through track.setMidiChannel → undo captured inside the same
 * call). The indicator is also exposed in the timeline track-header
 * strip and in the track context menu so the value is consistent
 * across the three places tracks are shown.
 *
 * Undo behavior: the existing track.setMidiChannel() already calls
 * captureStateForUndo(fromInteraction=true) so a single channel change
 * produces one undo entry. We do not need our own undo capture here.
 *
 * (v0.3.93)
 */

let localAppServices = {};
let isInitialized = false;
let activeDropdownTrackId = null;

/**
 * Build the inline HTML for a single track's channel indicator pill.
 * Reused by renderTrackStrip (in ui.js) and the timeline track header
 * rebuild path so the look stays consistent.
 */
export function getMidiChannelBadgeHTML(track, opts = {}) {
    if (!track) return '';
    // Master / audio / other non-MIDI tracks are skipped — only tracks
    // that produce or accept MIDI events are relevant.
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Audio' || type === 'Lyrics') return '';

    const ch = (typeof track.getMidiChannel === 'function')
        ? track.getMidiChannel()
        : (track.midiChannel ?? 0);
    const safeCh = Math.max(0, Math.min(16, parseInt(ch, 10) || 0));
    const label = safeCh === 0 ? 'Omni' : `Ch ${safeCh}`;
    const colorClass = safeCh === 0
        ? 'bg-gray-700 text-gray-300 border-gray-600'
        : 'bg-emerald-900/60 text-emerald-200 border-emerald-700';
    const trackId = track.id != null ? String(track.id) : '';
    const compact = opts.compact === true;
    return `<span class="midi-channel-badge inline-flex items-center justify-center rounded border ${colorClass} ${compact ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'} font-mono tracking-tight"
                data-track-id="${trackId}"
                data-midi-channel="${safeCh}"
                title="MIDI channel (click to change)">${label}</span>`;
}

/**
 * Initialize the per-track MIDI channel display. Wires click-to-edit
 * on the badges and a document-level outside-click closer for the
 * inline dropdown.
 */
export function initPerTrackMidiChannelDisplay(appServices) {
    localAppServices = appServices || {};
    if (isInitialized) return;
    if (typeof document === 'undefined') return;

    // Event delegation — one listener for every .midi-channel-badge that
    // ever appears in the DOM. Cheaper than re-binding on every mixer
    // re-render and works for badges rendered by other modules (timeline
    // track header rebuild, context menu injection, etc.).
    document.addEventListener('click', handleBadgeClick);
    document.addEventListener('mousedown', handleDocumentMouseDown);

    // Re-render the channel display when the user actually changes the
    // channel through any path (mixer dropdown, right-click "Set MIDI
    // channel" item, future piano-roll macros). The track itself already
    // calls appServices.updateTrackUI(trackId, 'midiChannelChanged') in
    // setMidiChannel(), so this listener is enough — no extra poll needed.
    if (typeof localAppServices.updateTrackUI === 'function') {
        // No-op: the updateTrackUI('midiChannelChanged') case is handled
        // in handleTrackUIUpdate by repainting the mixer panel.
    }

    // Mirror the entry point on window so right-click context menus and
    // global hotkey wiring (e.g. M-Ch-N for set channel) can call it
    // without importing the ES module.
    if (typeof window.openMidiChannelDropdown !== 'function') {
        window.openMidiChannelDropdown = openDropdownForTrackId;
    }
    if (typeof window.refreshMidiChannelBadges !== 'function') {
        window.refreshMidiChannelBadges = refreshAllBadges;
    }
    // Exposed for the mixer render path (ui.js renderTrackStrip) to call
    // during initial render before the badges have been event-wired.
    // The click handler is bound via event delegation, so this helper
    // only needs to return the HTML.
    if (typeof window.getMidiChannelBadgeHTML !== 'function') {
        window.getMidiChannelBadgeHTML = getMidiChannelBadgeHTML;
    }

    isInitialized = true;
    console.log('[PerTrackMidiChannelDisplay] Initialized');
}

/**
 * Click handler for any .midi-channel-badge in the document. Opens the
 * inline channel picker at the badge's position.
 */
function handleBadgeClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const badge = target.closest('.midi-channel-badge');
    if (!badge) return;
    // Don't open the dropdown when the user is clicking an option inside
    // an already-open dropdown (the dropdown re-renders inside the same
    // .midi-channel-badge ancestor sometimes).
    if (target.closest('.midi-channel-dropdown')) return;
    event.preventDefault();
    event.stopPropagation();
    const trackId = parseInt(badge.dataset.trackId, 10);
    if (Number.isNaN(trackId)) return;
    openDropdownForTrackId(trackId, badge);
}

/**
 * Outside-click closer for the inline dropdown. mousedown (not click) so
 * a click on an option that immediately closes the dropdown does not
 * race with the click handler.
 */
function handleDocumentMouseDown(event) {
    if (activeDropdownTrackId == null) return;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('.midi-channel-dropdown')) return;
    if (target.closest('.midi-channel-badge')) return;
    closeActiveDropdown();
}

/**
 * Open the inline channel-picker dropdown anchored to a badge element.
 * Repositions on scroll/resize so the dropdown stays glued to the
 * badge even when the user scrolls the mixer.
 */
function openDropdownForTrackId(trackId, anchorBadge) {
    closeActiveDropdown();
    const track = (typeof localAppServices.getTrackById === 'function')
        ? localAppServices.getTrackById(trackId)
        : null;
    if (!track) return;
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Audio' || type === 'Lyrics') return;

    const anchor = anchorBadge || document.querySelector(`.midi-channel-badge[data-track-id="${trackId}"]`);
    if (!anchor) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'midi-channel-dropdown fixed z-[10000] bg-gray-900 border border-gray-700 rounded shadow-2xl p-2 text-xs text-gray-200';
    dropdown.style.minWidth = '120px';
    dropdown.innerHTML = renderDropdownInnerHTML(track);

    // Append to body so we can position it absolutely against the
    // viewport, then translate so the top-left of the dropdown sits
    // just below the badge's bottom-left edge.
    document.body.appendChild(dropdown);
    positionDropdown(dropdown, anchor);
    activeDropdownTrackId = trackId;

    // Reposition on scroll/resize so the dropdown follows the badge.
    dropdown._reposition = () => positionDropdown(dropdown, anchor);
    window.addEventListener('scroll', dropdown._reposition, true);
    window.addEventListener('resize', dropdown._reposition);

    // Wire up the option clicks.
    dropdown.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!t || !t.dataset) return;
        const v = t.dataset.channel;
        if (v == null) return;
        ev.preventDefault();
        ev.stopPropagation();
        const newCh = parseInt(v, 10);
        if (Number.isNaN(newCh)) return;
        commitChannelChange(track, newCh);
        closeActiveDropdown();
    });
}

/**
 * Position the dropdown just below the badge's left edge. Falls back
 * to placing it in the top-left of the viewport if the badge is hidden.
 */
function positionDropdown(dropdown, anchor) {
    if (!anchor || !dropdown) return;
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + 4;
    let left = rect.left;
    const ddRect = dropdown.getBoundingClientRect();
    // If the dropdown would overflow the right edge, shift it left.
    if (left + ddRect.width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - ddRect.width - 8);
    }
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
}

/**
 * Render the inner HTML for the dropdown. "Omni" + 16 channels with the
 * current value pre-selected.
 */
function renderDropdownInnerHTML(track) {
    const ch = (typeof track.getMidiChannel === 'function')
        ? track.getMidiChannel()
        : (track.midiChannel ?? 0);
    const safeCh = Math.max(0, Math.min(16, parseInt(ch, 10) || 0));
    const label = safeCh === 0 ? 'Omni (all channels)' : `Ch ${safeCh}`;
    let html = `<div class="text-[10px] text-gray-500 px-1 pb-1 mb-1 border-b border-gray-700">MIDI Channel — current: ${label}</div>`;
    const makeRow = (value, display) => {
        const selected = value === safeCh ? 'bg-emerald-700/40 text-white' : 'hover:bg-gray-800 text-gray-300';
        return `<button type="button" data-channel="${value}" class="w-full text-left px-2 py-1 rounded text-[11px] font-mono ${selected}">${display}</button>`;
    };
    html += makeRow(0, 'Omni (all)');
    for (let i = 1; i <= 16; i++) html += makeRow(i, `Ch ${i}`);
    return html;
}

/**
 * Commit a channel change through the track itself (so undo capture,
 * logging, and downstream routing all happen in the canonical path)
 * then refresh the badges.
 */
function commitChannelChange(track, newChannel) {
    if (!track) return;
    if (typeof track.setMidiChannel === 'function') {
        // fromInteraction=true so the canonical path captures the
        // pre-change state for undo. setMidiChannel also calls
        // updateTrackUI(trackId, 'midiChannelChanged') which our
        // updateTrackUI hook in main.js already repaints the mixer for.
        try {
            track.setMidiChannel(newChannel, true);
        } catch (err) {
            console.warn('[PerTrackMidiChannelDisplay] setMidiChannel failed:', err);
        }
    } else {
        // Fallback: write the field directly. No undo capture in this
        // path but the user still gets a visible change.
        track.midiChannel = Math.max(0, Math.min(16, parseInt(newChannel, 10) || 0));
    }
    refreshBadgeForTrack(track);
}

/**
 * Close the currently open dropdown and clean up its scroll/resize
 * listeners. Idempotent.
 */
function closeActiveDropdown() {
    const dropdown = document.querySelector('.midi-channel-dropdown');
    if (dropdown) {
        if (typeof dropdown._reposition === 'function') {
            window.removeEventListener('scroll', dropdown._reposition, true);
            window.removeEventListener('resize', dropdown._reposition);
        }
        dropdown.remove();
    }
    activeDropdownTrackId = null;
}

/**
 * Refresh every .midi-channel-badge for one track. Called after a
 * channel change and from updateTrackUI('midiChannelChanged') via the
 * mixer-panel repaint. We update the existing badge in place so we
 * don't have to re-render the whole mixer (which would also wipe
 * the user's fader drag state).
 */
function refreshBadgeForTrack(track) {
    if (!track || track.id == null) return;
    const badges = document.querySelectorAll(`.midi-channel-badge[data-track-id="${track.id}"]`);
    if (!badges.length) return;
    const newHTML = getMidiChannelBadgeHTML(track);
    badges.forEach((b) => {
        if (!newHTML) {
            // The track type changed to one we don't render a badge
            // for. Hide the badge in place rather than orphaning it.
            b.style.display = 'none';
            return;
        }
        // Replace the badge contents by parsing the canonical HTML
        // fragment and copying over the text + class. Cheaper than
        // outerHTML replacement (which would destroy the element and
        // any sibling layout that depended on it).
        const tmp = document.createElement('span');
        tmp.innerHTML = newHTML;
        const fresh = tmp.firstElementChild;
        if (fresh) {
            b.className = fresh.className;
            b.dataset.midiChannel = fresh.dataset.midiChannel;
            b.textContent = fresh.textContent;
            b.title = fresh.title;
        }
    });
}

/**
 * Force-refresh every badge in the DOM. Called from the updateTrackUI
 * hook for 'midiChannelChanged' so the display always matches the
 * underlying state, even after bulk operations.
 */
function refreshAllBadges() {
    if (typeof localAppServices.getTracks !== 'function') return;
    const tracks = localAppServices.getTracks() || [];
    tracks.forEach(refreshBadgeForTrack);
}

export function isPerTrackMidiChannelDisplayInitialized() {
    return isInitialized;
}

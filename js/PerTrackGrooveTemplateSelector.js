/**
 * js/PerTrackGrooveTemplateSelector.js - Per-Track Groove Template Selector
 * Adds a small "Groove" badge next to the track-type label on each
 * mixer channel strip. Reads the existing track.groovePreset
 * ('none' = straight, 'swing_50' = 50% swing, 'swing_66' = triplet swing,
 *  'swing_75' = 75% swing, 'swing_33' = 33% shuffle) that Track.js
 * already manages and renders a compact "None" / "Swing 50%" / "Swing 66%"
 * / "Swing 75%" / "Shuffle 33%" pill so the user can see at a glance
 * which groove template each track is using.
 *
 * The visual is a passive read-only display — clicking the pill opens
 * a small inline dropdown letting the user change the groove (writes
 * back through track.setGroovePreset → undo captured inside the same
 * call). The indicator is exposed in the mixer track-strip header.
 *
 * Undo behavior: track.setGroovePreset() is a thin setter that just
 * assigns `this.groovePreset = grooveId` and does NOT capture undo
 * itself (and does NOT take a fromInteraction flag). We pre-capture
 * the undo state BEFORE calling the setter so a single groove change
 * produces one undo entry that holds the pre-change preset, and we
 * call setGroovePreset afterwards to do the actual mutation. We then
 * fire updateTrackUI(trackId, 'groovePresetChanged') so the mixer
 * repaints and a notification shows the new value (matches the
 * v0.3.93 Per-Track MIDI Channel Display pattern exactly).
 *
 * (v0.3.94)
 */

let localAppServices = {};
let isInitialized = false;
let activeDropdownTrackId = null;

// Built-in fallback list mirrors state.js:GROOVE_PRESETS. Used when
// localAppServices.getGroovePresets is not yet exposed (state.js
// itself is fine — this is a defensive fallback so the badge still
// renders with the right labels during early boot or in stripped
// builds).
const FALLBACK_GROOVE_PRESETS = [
    { id: 'none', name: 'None (Straight)', swingAmount: 0 },
    { id: 'swing_33', name: '33% Shuffle', swingAmount: 0.166 },
    { id: 'swing_50', name: '50% Swing', swingAmount: 0.25 },
    { id: 'swing_66', name: '66% Swing (Triplets)', swingAmount: 0.333 },
    { id: 'swing_75', name: '75% Swing', swingAmount: 0.5 }
];

function getPresetsSafe() {
    if (typeof localAppServices.getGroovePresets === 'function') {
        try {
            const p = localAppServices.getGroovePresets();
            if (Array.isArray(p) && p.length > 0) return p;
        } catch (e) { /* fall through to fallback */ }
    }
    return FALLBACK_GROOVE_PRESETS;
}

/**
 * Compact label for the badge. Trims long names to keep the strip
 * header tidy. We mirror the v0.3.93 badge pattern: short, mono,
 * inline-flex.
 */
function shortLabelFor(presetId, presets) {
    if (!presetId || presetId === 'none') return 'None';
    const p = presets.find(x => x && x.id === presetId);
    if (!p) return presetId;
    // Strip the " Swing" / " Shuffle" suffix for compact display —
    // the pill colour + a hover title convey the rest.
    return p.name
        .replace(/\s*\([^)]*\)\s*$/, '')   // drop "(Triplets)"
        .replace(/\s*\(Straight\)\s*$/i, '')
        .replace(/\s*Swing\s*$/i, '')
        .replace(/\s*Shuffle\s*$/i, '')
        .trim() || p.id;
}

/**
 * Build the inline HTML for a single track's groove badge.
 * Reused by the track-strip render path in ui.js so the look stays
 * consistent with the v0.3.93 MIDI-channel badge right next to it.
 */
export function getGrooveBadgeHTML(track, opts = {}) {
    if (!track) return '';
    // Only instrument-style tracks make sense for groove. Master /
    // Audio / Lyrics tracks are skipped — same gate as v0.3.93.
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Audio' || type === 'Lyrics') return '';

    const presets = getPresetsSafe();
    const grooveId = (typeof track.getGroovePreset === 'function')
        ? track.getGroovePreset()
        : (track.groovePreset || 'none');
    const safeId = (grooveId == null) ? 'none' : String(grooveId);
    const preset = presets.find(p => p && p.id === safeId);
    const swingPct = preset ? Math.round((preset.swingAmount || 0) * 100) : 0;

    // Colour cue: gray for "none" so the eye can scan past it, amber
    // for any swing preset so the swung tracks pop.
    const colorClass = (safeId === 'none' || !preset)
        ? 'bg-gray-700 text-gray-300 border-gray-600'
        : 'bg-amber-900/60 text-amber-200 border-amber-700';

    const trackId = track.id != null ? String(track.id) : '';
    const compact = opts.compact === true;
    const label = shortLabelFor(safeId, presets);
    const titleText = preset
        ? `Groove: ${preset.name} — ${swingPct}% swing (click to change)`
        : `Groove: ${label} (click to change)`;

    return `<span class="groove-badge inline-flex items-center justify-center rounded border ${colorClass} ${compact ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'} font-mono tracking-tight"
                data-track-id="${trackId}"
                data-groove-preset="${safeId}"
                title="${titleText}">${label}</span>`;
}

/**
 * Initialize the per-track groove selector. Wires click-to-edit on
 * the badges and a document-level outside-click closer for the
 * inline dropdown — same pattern as v0.3.93.
 */
export function initPerTrackGrooveTemplateSelector(appServices) {
    localAppServices = appServices || {};
    if (isInitialized) return;
    if (typeof document === 'undefined') return;

    // Event delegation — one listener for every .groove-badge that
    // ever appears in the DOM. Cheaper than re-binding on every
    // mixer re-render.
    document.addEventListener('click', handleBadgeClick);
    document.addEventListener('mousedown', handleDocumentMouseDown);

    // Mirror the entry point on window so other modules (right-click
    // context menu, future hotkey wiring) can call it without
    // importing the ES module.
    if (typeof window.openGroovePresetDropdown !== 'function') {
        window.openGroovePresetDropdown = openDropdownForTrackId;
    }
    if (typeof window.refreshGrooveBadges !== 'function') {
        window.refreshGrooveBadges = refreshAllBadges;
    }
    if (typeof window.getGrooveBadgeHTML !== 'function') {
        window.getGrooveBadgeHTML = getGrooveBadgeHTML;
    }

    isInitialized = true;
    console.log('[PerTrackGrooveTemplateSelector] Initialized');
}

/**
 * Click handler for any .groove-badge in the document. Opens the
 * inline groove-picker dropdown at the badge's position.
 */
function handleBadgeClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const badge = target.closest('.groove-badge');
    if (!badge) return;
    // Don't reopen when the user clicks an option inside an
    // already-open dropdown.
    if (target.closest('.groove-preset-dropdown')) return;
    event.preventDefault();
    event.stopPropagation();
    const trackId = parseInt(badge.dataset.trackId, 10);
    if (Number.isNaN(trackId)) return;
    openDropdownForTrackId(trackId, badge);
}

/**
 * Outside-click closer for the inline dropdown. mousedown (not
 * click) so a click on an option that immediately closes the
 * dropdown does not race with the click handler.
 */
function handleDocumentMouseDown(event) {
    if (activeDropdownTrackId == null) return;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('.groove-preset-dropdown')) return;
    if (target.closest('.groove-badge')) return;
    closeActiveDropdown();
}

/**
 * Open the inline groove-picker dropdown anchored to a badge
 * element. Repositions on scroll/resize so the dropdown stays
 * glued to the badge even when the user scrolls the mixer.
 */
function openDropdownForTrackId(trackId, anchorBadge) {
    closeActiveDropdown();
    const track = (typeof localAppServices.getTrackById === 'function')
        ? localAppServices.getTrackById(trackId)
        : null;
    if (!track) return;
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Audio' || type === 'Lyrics') return;

    const anchor = anchorBadge || document.querySelector(`.groove-badge[data-track-id="${trackId}"]`);
    if (!anchor) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'groove-preset-dropdown fixed z-[10000] bg-gray-900 border border-gray-700 rounded shadow-2xl p-2 text-xs text-gray-200';
    dropdown.style.minWidth = '160px';
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
        const v = t.dataset.preset;
        if (v == null) return;
        ev.preventDefault();
        ev.stopPropagation();
        commitGrooveChange(track, v);
        closeActiveDropdown();
    });
}

/**
 * Position the dropdown just below the badge's left edge. Falls
 * back to placing it in the top-left of the viewport if the badge
 * is hidden.
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
 * Render the inner HTML for the dropdown. Shows each preset with
 * the swing % and marks the current value.
 */
function renderDropdownInnerHTML(track) {
    const presets = getPresetsSafe();
    const grooveId = (typeof track.getGroovePreset === 'function')
        ? track.getGroovePreset()
        : (track.groovePreset || 'none');
    const safeId = (grooveId == null) ? 'none' : String(grooveId);
    const current = presets.find(p => p && p.id === safeId);
    const currentLabel = current ? current.name : safeId;

    let html = `<div class="text-[10px] text-gray-500 px-1 pb-1 mb-1 border-b border-gray-700">Groove Template — current: ${currentLabel}</div>`;
    presets.forEach(p => {
        if (!p) return;
        const selected = p.id === safeId
            ? 'bg-amber-700/40 text-white'
            : 'hover:bg-gray-800 text-gray-300';
        const swingPct = Math.round((p.swingAmount || 0) * 100);
        html += `<button type="button" data-preset="${p.id}" class="w-full text-left px-2 py-1 rounded text-[11px] font-mono ${selected}">${p.name} <span class="text-gray-500">(${swingPct}%)</span></button>`;
    });
    return html;
}

/**
 * Commit a groove change. Pre-captures undo, mutates the track
 * through its own setter (so logging stays canonical), then
 * refreshes the badge and asks the app to repaint the mixer.
 */
function commitGrooveChange(track, newPresetId) {
    if (!track) return;
    if (!newPresetId) return;
    const previousPreset = (typeof track.getGroovePreset === 'function')
        ? track.getGroovePreset()
        : (track.groovePreset || 'none');
    if (previousPreset === newPresetId) return; // no-op

    // Pre-capture the undo state BEFORE the mutation runs. Track.
    // setGroovePreset() does not take a fromInteraction flag and does
    // not call captureStateForUndo itself — so the undo entry has to
    // be pushed by the caller. Same pattern as
    // PerTrackMidiChannelDisplay's pre-capture for the
    // midi-channel-changed bug class.
    const presets = getPresetsSafe();
    const newPreset = presets.find(p => p && p.id === newPresetId);
    const newLabel = newPreset ? newPreset.name : newPresetId;
    if (typeof localAppServices.captureStateForUndo === 'function') {
        try {
            localAppServices.captureStateForUndo(`Set ${track.name} groove to ${newLabel}`);
        } catch (err) {
            console.warn('[PerTrackGrooveTemplateSelector] pre-capture failed:', err);
        }
    }

    // Mutate through the canonical setter so logging + any future
    // side-effects in setGroovePreset land in the right place.
    if (typeof track.setGroovePreset === 'function') {
        try {
            track.setGroovePreset(newPresetId);
        } catch (err) {
            console.warn('[PerTrackGrooveTemplateSelector] setGroovePreset failed:', err);
            return;
        }
    } else {
        // Fallback: write the field directly. No undo in this path
        // but the user still gets a visible change.
        track.groovePreset = newPresetId;
    }

    // Ask the app to repaint. The 'groovePresetChanged' case in
    // main.js's handleTrackUIUpdate re-renders the mixer (so the
    // badge updates in place) and fires a small notification.
    if (typeof localAppServices.updateTrackUI === 'function') {
        try {
            localAppServices.updateTrackUI(track.id, 'groovePresetChanged');
        } catch (err) {
            console.warn('[PerTrackGrooveTemplateSelector] updateTrackUI failed:', err);
        }
    }
    refreshBadgeForTrack(track);
}

/**
 * Close the currently open dropdown and clean up its scroll/resize
 * listeners. Idempotent.
 */
function closeActiveDropdown() {
    const dropdown = document.querySelector('.groove-preset-dropdown');
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
 * Refresh every .groove-badge for one track. Called after a groove
 * change and from updateTrackUI('groovePresetChanged') via the
 * mixer-panel repaint. We update the existing badge in place so we
 * don't have to re-render the whole mixer (which would also wipe
 * the user's fader drag state).
 */
function refreshBadgeForTrack(track) {
    if (!track || track.id == null) return;
    const badges = document.querySelectorAll(`.groove-badge[data-track-id="${track.id}"]`);
    if (!badges.length) return;
    const newHTML = getGrooveBadgeHTML(track);
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
            b.dataset.groovePreset = fresh.dataset.groovePreset;
            b.textContent = fresh.textContent;
            b.title = fresh.title;
        }
    });
}

/**
 * Force-refresh every badge in the DOM. Useful after a project
 * load (where the mixer re-renders fresh) and as a safety net for
 * the 'groovePresetChanged' case in handleTrackUIUpdate.
 */
function refreshAllBadges() {
    if (typeof localAppServices.getTracks !== 'function') return;
    const tracks = localAppServices.getTracks() || [];
    tracks.forEach(refreshBadgeForTrack);
}

export function isPerTrackGrooveTemplateSelectorInitialized() {
    return isInitialized;
}

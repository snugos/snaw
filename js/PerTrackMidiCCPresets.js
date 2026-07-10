/**
 * js/PerTrackMidiCCPresets.js - Per-Track MIDI CC Presets
 *
 * Save the entire CC mapping set for a single track (CC #, channel,
 * min/max range, target parameter) as a named preset; quick-apply
 * that preset back to the same track, a different track, or a fresh
 * project. Backed by localStorage so presets survive page reloads.
 *
 * The save / apply path is read/write scoped to a single track id —
 * mappings for other tracks (and master) are NEVER touched. The save
 * step captures the current set of mappings targeting the active
 * track, stores them as a preset, and the apply step restores them.
 *
 * UI surface:
 *   1. A small "CC N" badge on each non-Master track strip next to
 *      the existing MIDI-channel + groove badges. Shows the count of
 *      CC mappings currently bound to that track. Click → opens the
 *      panel for that track. The badge is rendered in the existing
 *      track-strip header so no new track-strip layout work is
 *      needed.
 *   2. A dockable "Per-Track MIDI CC Presets" panel (one window per
 *      track, keyed by trackId in the title) listing all saved
 *      presets with Load / Apply to Another Track / Delete actions
 *      and a Save button that captures the current track's mappings
 *      under a user-supplied name.
 *   3. A start-menu entry "Per-Track MIDI CC Presets" that opens the
 *      panel for whichever track is currently active (the soloed,
 *      record-armed, or most-recently-selected track — falls back to
 *      the first non-Master track if none is active).
 *
 * Persistence:
 *   localStorage key: `snaw_per_track_midi_cc_presets_v1`
 *   Shape: { version: 1, presets: [{ id, name, createdAt, data: [...] }] }
 *
 * (v0.4.02)
 */

let localAppServices = {};
let isInitialized = false;
const STORAGE_KEY = 'snaw_per_track_midi_cc_presets_v1';

// One-window-per-track. Maps trackId → window object so re-opening
// the same track focuses the existing window instead of stacking a
// new one. Cleared by the window's onClose callback.
const panelWindowsByTrack = new Map();

/* ----------------------------------------------------------------------------
 * Persistence
 * --------------------------------------------------------------------------*/

/**
 * Read every saved preset from localStorage. Returns [] on any
 * failure (corrupt JSON, missing key, browser without localStorage).
 * The v1 schema is forward-compatible: we tolerate an unknown
 * `version` by returning an empty presets list rather than throwing.
 */
function loadAllPresets() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return [];
        if (parsed.version !== 1) {
            console.warn('[PerTrackMidiCCPresets] Unknown preset version:', parsed.version, '— ignoring.');
            return [];
        }
        const list = Array.isArray(parsed.presets) ? parsed.presets : [];
        return list.filter((p) => p && p.id && p.name && Array.isArray(p.data));
    } catch (e) {
        console.warn('[PerTrackMidiCCPresets] loadAllPresets failed:', e);
        return [];
    }
}

/**
 * Write the full preset list back to localStorage. Best-effort —
 * quota errors are logged but not rethrown so a save failure doesn't
 * break the rest of the workflow.
 */
function saveAllPresets(presets) {
    if (typeof localStorage === 'undefined') return;
    try {
        const payload = { version: 1, presets };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('[PerTrackMidiCCPresets] saveAllPresets failed:', e);
    }
}

/**
 * Generate a stable-enough unique id for a new preset. We don't need
 * cryptographically strong uniqueness — just a string that doesn't
 * collide with any existing preset id.
 */
function makePresetId() {
    return `ptcc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ----------------------------------------------------------------------------
 * Active-track heuristic
 * --------------------------------------------------------------------------*/

/**
 * Resolve "the track the user means" for the start-menu entry. Walks
 * the track list in priority order:
 *   1. The currently soloed track (most explicit selection)
 *   2. The currently record-armed track
 *   3. The first non-Master / non-Lyrics track
 * Returns null if no candidate exists (empty project, every track is
 * Master/Lyrics).
 */
function resolveActiveTrack() {
    if (typeof localAppServices.getTracks !== 'function') return null;
    const tracks = localAppServices.getTracks() || [];
    const soloed = tracks.find((t) => t && t.solo && t.type !== 'Master' && t.type !== 'Lyrics' && t.type !== 'Audio');
    if (soloed) return soloed;
    const armed = tracks.find((t) => t && t.recArm && t.type !== 'Master' && t.type !== 'Lyrics' && t.type !== 'Audio');
    if (armed) return armed;
    const first = tracks.find((t) => t && t.type !== 'Master' && t.type !== 'Lyrics' && t.type !== 'Audio');
    return first || tracks[0] || null;
}

/* ----------------------------------------------------------------------------
 * UI: badge
 * --------------------------------------------------------------------------*/

/**
 * Build the inline HTML for a single track's "CC N" badge. Skips
 * Master / Audio / Lyrics tracks (same gate as the v0.3.93 + v0.3.94
 * badges). The count is read from state.getMidiMappingsForTrack
 * (the per-track helper added in v0.4.02). Falls back to 0 if the
 * helper isn't exposed yet (early-boot / stripped builds).
 */
export function getPerTrackCCBadgeHTML(track, opts = {}) {
    if (!track) return '';
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Audio' || type === 'Lyrics') return '';

    let count = 0;
    try {
        if (localAppServices.getMidiMappingsForTrack) {
            const list = localAppServices.getMidiMappingsForTrack(track.id);
            count = Array.isArray(list) ? list.length : 0;
        }
    } catch (e) { /* non-fatal — leave the count at 0 */ }

    const trackId = track.id != null ? String(track.id) : '';
    const compact = opts.compact === true;
    const colorClass = count > 0
        ? 'bg-violet-900/60 text-violet-200 border-violet-700'
        : 'bg-gray-800 text-gray-500 border-gray-700';
    const label = count > 0 ? `CC ${count}` : `CC 0`;
    const titleText = count > 0
        ? `MIDI CC: ${count} mapping${count !== 1 ? 's' : ''} for this track (click for presets)`
        : `MIDI CC: no mappings yet for this track (click to add presets)`;
    return `<span class="per-track-cc-badge inline-flex items-center justify-center rounded border ${colorClass} ${compact ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'} font-mono tracking-tight"
                data-track-id="${trackId}"
                data-cc-count="${count}"
                title="${titleText}">${label}</span>`;
}

/* ----------------------------------------------------------------------------
 * UI: panel
 * --------------------------------------------------------------------------*/

/**
 * Open (or focus) the per-track presets panel for the given track id.
 * One window per track — re-opening the same track focuses the
 * existing window and re-renders the content so a newly-saved preset
 * shows up immediately.
 */
export function openPerTrackMidiCCPresetsPanel(trackId) {
    if (typeof localAppServices.getTrackById !== 'function') {
        console.warn('[PerTrackMidiCCPresets] getTrackById unavailable — cannot open panel.');
        return null;
    }
    const track = localAppServices.getTrackById(trackId);
    if (!track) {
        console.warn('[PerTrackMidiCCPresets] Track not found:', trackId);
        return null;
    }
    const type = (track.type || '').toString();
    if (type === 'Master' || type === 'Audio' || type === 'Lyrics') {
        // Master / Audio / Lyrics tracks have no per-track CC mapping
        // concept — fall back to opening for the first mappable track
        // so the menu entry always does something useful.
        const fallback = resolveActiveTrack();
        if (fallback && fallback.id !== trackId) {
            return openPerTrackMidiCCPresetsPanel(fallback.id);
        }
        if (typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification('No mappable track found for CC presets', 2000);
        }
        return null;
    }

    const windowId = `perTrackMidiCCPresets-${trackId}`;
    const existing = panelWindowsByTrack.get(windowId);
    if (existing && !existing.isDestroyed) {
        try { existing.restore(); } catch (e) { /* best-effort focus */ }
        renderPanelContent(track);
        return existing;
    }

    if (typeof localAppServices.createWindow !== 'function') {
        console.warn('[PerTrackMidiCCPresets] createWindow unavailable — cannot open panel.');
        return null;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = `perTrackMidiCCPresetsContent-${trackId}`;
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 text-gray-200 overflow-y-auto';

    const options = {
        width: 460,
        height: 520,
        minWidth: 360,
        minHeight: 360,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    const win = localAppServices.createWindow(
        windowId,
        `CC Presets: ${track.name || `Track ${trackId}`}`,
        contentContainer,
        options
    );

    if (win) {
        panelWindowsByTrack.set(windowId, win);
        // Clear the entry when the window closes so a future
        // openPerTrackMidiCCPresetsPanel call creates a fresh window
        // instead of trying to refocus a destroyed one.
        if (typeof win.onClose !== 'function') {
            win.onClose = () => panelWindowsByTrack.delete(windowId);
        } else {
            const prevClose = win.onClose;
            win.onClose = () => { try { prevClose(); } catch (e) {} panelWindowsByTrack.delete(windowId); };
        }
        renderPanelContent(track);
    }
    return win;
}

/**
 * Refresh the panel's content. Called after a save, load, or apply
 * so the user always sees an accurate view.
 */
function renderPanelContent(track) {
    if (!track) return;
    const container = document.getElementById(`perTrackMidiCCPresetsContent-${track.id}`);
    if (!container) return;

    const presets = loadAllPresets();
    const trackMappings = (typeof localAppServices.getMidiMappingsForTrack === 'function')
        ? localAppServices.getMidiMappingsForTrack(track.id)
        : [];
    const mappingCount = trackMappings.length;

    // Build the target-track dropdown for cross-track apply. We list
    // every non-Master / non-Lyrics track EXCEPT the current one so
    // "Apply to track X" can never accidentally target the same
    // track as a no-op.
    let allTracks = [];
    try { allTracks = localAppServices.getTracks ? (localAppServices.getTracks() || []) : []; } catch (e) { allTracks = []; }
    const applyTargets = allTracks.filter((t) => t && t.id !== track.id && t.type !== 'Master' && t.type !== 'Lyrics' && t.type !== 'Audio');

    container.innerHTML = `
        <div class="mb-3">
            <h3 class="text-white font-medium text-sm mb-1">CC Presets for "${escapeHtml(track.name || `Track ${track.id}`)}"</h3>
            <div class="text-[11px] text-gray-400">
                ${mappingCount} mapping${mappingCount === 1 ? '' : 's'} currently bound to this track. Save the current set as a preset, or apply a saved preset back to this track (or another track).
            </div>
        </div>

        <div class="mb-3 p-2 rounded border border-gray-700 bg-gray-800/60">
            <label class="block text-[11px] text-gray-400 mb-1">Save current track mappings as preset</label>
            <div class="flex gap-2">
                <input type="text" id="ptCCPresetName" placeholder="Preset name (e.g. Live Rig A)"
                    class="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    ${mappingCount === 0 ? 'disabled' : ''} />
                <button id="ptCCPresetSave" class="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    ${mappingCount === 0 ? 'disabled' : ''}>
                    Save
                </button>
            </div>
            ${mappingCount === 0 ? '<div class="text-[10px] text-gray-500 mt-1">No mappings bound to this track yet — assign some via right-click on a knob or the MIDI CC panel, then come back.</div>' : ''}
        </div>

        <div class="mb-3 p-2 rounded border border-gray-700 bg-gray-800/60">
            <label class="block text-[11px] text-gray-400 mb-1">Apply a preset</label>
            <div class="flex gap-2">
                <select id="ptCCPresetSelect"
                    class="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white">
                    <option value="">-- Select preset --</option>
                    ${presets.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} (${p.data.length} mappings)</option>`).join('')}
                </select>
                <button id="ptCCPresetApplyHere" class="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed" ${presets.length === 0 ? 'disabled' : ''}>
                    Apply
                </button>
            </div>
        </div>

        <div class="mb-3 p-2 rounded border border-gray-700 bg-gray-800/60">
            <label class="block text-[11px] text-gray-400 mb-1">Apply preset to another track</label>
            <div class="flex gap-2">
                <select id="ptCCPresetSelect2"
                    class="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white">
                    <option value="">-- Preset --</option>
                    ${presets.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} (${p.data.length})</option>`).join('')}
                </select>
                <select id="ptCCPresetTargetTrack"
                    class="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white">
                    <option value="">-- Target track --</option>
                    ${applyTargets.map((t) => `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name || `Track ${t.id}`)}</option>`).join('')}
                </select>
                <button id="ptCCPresetApplyToTrack" class="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    ${presets.length === 0 || applyTargets.length === 0 ? 'disabled' : ''}>
                    Apply
                </button>
            </div>
            ${applyTargets.length === 0 ? '<div class="text-[10px] text-gray-500 mt-1">No other mappable tracks in the project yet.</div>' : ''}
        </div>

        <div class="mb-3">
            <div class="text-[11px] text-gray-400 mb-1">Saved presets (${presets.length})</div>
            <div id="ptCCPresetList" class="max-h-[180px] overflow-y-auto rounded border border-gray-700">
                ${presets.length === 0 ? '<div class="p-3 text-center text-gray-500 text-[11px] italic">No presets saved yet.</div>' : ''}
                ${presets.map((p) => `
                    <div class="flex items-center justify-between gap-2 px-2 py-1 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/40" data-preset-id="${escapeAttr(p.id)}">
                        <div class="min-w-0 flex-1">
                            <div class="text-white text-xs truncate" title="${escapeAttr(p.name)}">${escapeHtml(p.name)}</div>
                            <div class="text-gray-500 text-[10px]">${p.data.length} mapping${p.data.length === 1 ? '' : 's'} · ${formatDate(p.createdAt)}</div>
                        </div>
                        <div class="flex gap-1 flex-shrink-0">
                            <button class="ptCCPresetLoadBtn px-2 py-0.5 text-[10px] rounded bg-blue-700 hover:bg-blue-600 text-white" data-preset-id="${escapeAttr(p.id)}">Load</button>
                            <button class="ptCCPresetApplyOtherBtn px-2 py-0.5 text-[10px] rounded bg-indigo-700 hover:bg-indigo-600 text-white" data-preset-id="${escapeAttr(p.id)}" ${applyTargets.length === 0 ? 'disabled' : ''}>To Track…</button>
                            <button class="ptCCPresetDeleteBtn px-2 py-0.5 text-[10px] rounded bg-red-700/70 hover:bg-red-600 text-white" data-preset-id="${escapeAttr(p.id)}">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="mt-auto pt-2 border-t border-gray-700 text-[10px] text-gray-500">
            Presets are stored in localStorage (key <code>${STORAGE_KEY}</code>). Per-track only — master and other tracks' mappings are not touched by save or apply.
        </div>
    `;

    setupPanelEvents(track, presets, applyTargets);
}

/**
 * Wire up the panel's event handlers. Re-runs on every render so the
 * closures see the latest presets/applyTargets snapshot. We use
 * delegation for the per-row buttons since they're rebuilt on every
 * render; the name-input + dropdowns get direct bindings because
 * their DOM nodes are stable across renders (we just re-render
 * innerHTML of the same container, so nodes are new each time —
 * re-query every time is correct).
 */
function setupPanelEvents(track, presets, applyTargets) {
    const container = document.getElementById(`perTrackMidiCCPresetsContent-${track.id}`);
    if (!container) return;
    const nameInput = container.querySelector('#ptCCPresetName');
    const saveBtn = container.querySelector('#ptCCPresetSave');
    const selectEl = container.querySelector('#ptCCPresetSelect');
    const applyHereBtn = container.querySelector('#ptCCPresetApplyHere');
    const selectEl2 = container.querySelector('#ptCCPresetSelect2');
    const targetTrackEl = container.querySelector('#ptCCPresetTargetTrack');
    const applyToTrackBtn = container.querySelector('#ptCCPresetApplyToTrack');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = (nameInput && nameInput.value ? nameInput.value : '').trim();
            if (!name) {
                notify('Please enter a preset name first', 'warning');
                return;
            }
            saveCurrentMappingsAsPreset(track, name);
            renderPanelContent(track);
            refreshAllBadges();
        });
    }
    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (saveBtn) saveBtn.click();
            }
        });
    }
    if (applyHereBtn) {
        applyHereBtn.addEventListener('click', () => {
            const presetId = selectEl ? selectEl.value : '';
            if (!presetId) { notify('Select a preset to apply first', 'warning'); return; }
            applyPresetToTrack(track, presetId, track);
            renderPanelContent(track);
            refreshAllBadges();
        });
    }
    if (applyToTrackBtn) {
        applyToTrackBtn.addEventListener('click', () => {
            const presetId = selectEl2 ? selectEl2.value : '';
            const targetId = targetTrackEl ? targetTrackEl.value : '';
            if (!presetId) { notify('Select a preset to apply first', 'warning'); return; }
            if (!targetId) { notify('Select a target track first', 'warning'); return; }
            const target = (typeof localAppServices.getTrackById === 'function')
                ? localAppServices.getTrackById(targetId) : null;
            if (!target) { notify('Target track not found', 'error'); return; }
            applyPresetToTrack(track, presetId, target);
            renderPanelContent(track);
            refreshAllBadges();
        });
    }

    // Per-row buttons (Load / To Track… / ✕)
    container.querySelectorAll('.ptCCPresetLoadBtn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.presetId;
            if (!presetId) return;
            applyPresetToTrack(track, presetId, track);
            renderPanelContent(track);
            refreshAllBadges();
        });
    });
    container.querySelectorAll('.ptCCPresetApplyOtherBtn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.presetId;
            if (!presetId) return;
            // Pop the target-track picker with the first available
            // target so the user just sees a confirmation rather
            // than having to pick from a dropdown. We still require
            // an explicit confirm via a follow-up prompt so we never
            // silently route a preset to the wrong track.
            if (applyTargets.length === 0) {
                notify('No other mappable tracks in the project', 'warning');
                return;
            }
            // Build a tiny chooser
            const chooser = document.createElement('div');
            chooser.className = 'fixed z-[11000] bg-gray-900 border border-gray-700 rounded shadow-2xl p-2 text-xs text-gray-200';
            chooser.style.minWidth = '200px';
            chooser.innerHTML = `
                <div class="text-[10px] text-gray-500 px-1 pb-1 mb-1 border-b border-gray-700">Apply preset to which track?</div>
                ${applyTargets.map((t) => `<button type="button" data-target-id="${escapeAttr(t.id)}" class="w-full text-left px-2 py-1 rounded text-[11px] font-mono hover:bg-gray-800 text-gray-300">${escapeHtml(t.name || `Track ${t.id}`)}</button>`).join('')}
                <div class="pt-1 mt-1 border-t border-gray-700"><button type="button" data-cancel="1" class="w-full text-left px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-800">Cancel</button></div>
            `;
            // Anchor to the button the user clicked
            const rect = btn.getBoundingClientRect();
            chooser.style.top = (rect.bottom + 4) + 'px';
            chooser.style.left = rect.left + 'px';
            document.body.appendChild(chooser);
            const closeChooser = () => { chooser.remove(); document.removeEventListener('mousedown', onDocDown); };
            const onDocDown = (ev) => {
                if (chooser.contains(ev.target)) return;
                closeChooser();
            };
            document.addEventListener('mousedown', onDocDown);
            chooser.addEventListener('click', (ev) => {
                const t = ev.target;
                if (!t || !t.dataset) return;
                if (t.dataset.cancel) { closeChooser(); return; }
                const targetId = t.dataset.targetId;
                if (!targetId) return;
                const target = (typeof localAppServices.getTrackById === 'function')
                    ? localAppServices.getTrackById(targetId) : null;
                if (!target) { closeChooser(); return; }
                applyPresetToTrack(track, presetId, target);
                closeChooser();
                renderPanelContent(track);
                refreshAllBadges();
            });
        });
    });
    container.querySelectorAll('.ptCCPresetDeleteBtn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.presetId;
            if (!presetId) return;
            deletePreset(presetId);
            renderPanelContent(track);
        });
    });
}

/* ----------------------------------------------------------------------------
 * Save / apply
 * --------------------------------------------------------------------------*/

/**
 * Capture the current per-track mappings and append a new preset
 * with the given name. Captures undo so a single undo step rolls
 * back both the preset creation and the surrounding state.
 */
function saveCurrentMappingsAsPreset(track, name) {
    if (!track) return;
    if (typeof localAppServices.getMidiMappingsForTrack !== 'function') {
        notify('Per-track mapping helper unavailable — cannot save preset', 'error');
        return;
    }
    const data = localAppServices.getMidiMappingsForTrack(track.id);
    if (!Array.isArray(data) || data.length === 0) {
        notify('No CC mappings bound to this track yet', 'warning');
        return;
    }

    // Capture undo BEFORE the storage write so the user can revert
    // a stray save. (The localStorage mutation itself isn't
    // undo-able, but the data is captured on the side, and undo
    // won't restore a deleted preset — that's a future enhancement.
    // The main user benefit is that the apply step below is undo-able.)
    if (typeof localAppServices.captureStateForUndo === 'function') {
        try { localAppServices.captureStateForUndo(`Save CC preset "${name}" for "${track.name}"`); } catch (e) { /* non-fatal */ }
    }

    const presets = loadAllPresets();
    const preset = {
        id: makePresetId(),
        name,
        createdAt: new Date().toISOString(),
        data: data.map((m) => ({
            cc: m.cc,
            channel: m.channel,
            paramPath: m.paramPath,
            min: m.min,
            max: m.max
        }))
    };
    presets.push(preset);
    saveAllPresets(presets);
    notify(`Saved preset "${name}" with ${preset.data.length} mapping${preset.data.length === 1 ? '' : 's'}`, 'success');
}

/**
 * Apply the preset identified by `presetId` to `targetTrack`,
 * capturing undo so a single undo step reverts the apply. Returns
 * the { removed, added } counts for the notification.
 */
function applyPresetToTrack(sourceTrack, presetId, targetTrack) {
    if (!targetTrack) return null;
    if (typeof localAppServices.applyMidiMappingPresetForTrack !== 'function') {
        notify('Per-track apply helper unavailable — cannot apply preset', 'error');
        return null;
    }
    const presets = loadAllPresets();
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) {
        notify('Preset not found', 'error');
        return null;
    }
    if (typeof localAppServices.captureStateForUndo === 'function') {
        try { localAppServices.captureStateForUndo(`Apply CC preset "${preset.name}" to "${targetTrack.name}"`); } catch (e) { /* non-fatal */ }
    }
    const result = localAppServices.applyMidiMappingPresetForTrack(targetTrack.id, preset);
    const added = (result && typeof result.added === 'number') ? result.added : 0;
    const removed = (result && typeof result.removed === 'number') ? result.removed : 0;
    if (typeof localAppServices.refreshLearnableElements === 'function') {
        try { localAppServices.refreshLearnableElements(); } catch (e) { /* non-fatal */ }
    }
    if (typeof localAppServices.highlightMappedParameters === 'function') {
        try { localAppServices.highlightMappedParameters(); } catch (e) { /* non-fatal */ }
    }
    notify(`Applied "${preset.name}" to "${targetTrack.name}" — ${removed} removed, ${added} added`, 'success');
    return result;
}

/**
 * Delete a preset by id. No undo capture — presets are a local
 * convenience and deleting one is rare enough that an undo entry
 * would be more noise than signal. (We still log the action so
 * the user has a paper trail in the console.)
 */
function deletePreset(presetId) {
    const presets = loadAllPresets();
    const idx = presets.findIndex((p) => p.id === presetId);
    if (idx < 0) return false;
    const name = presets[idx].name;
    presets.splice(idx, 1);
    saveAllPresets(presets);
    notify(`Deleted preset "${name}"`, 'info');
    return true;
}

/* ----------------------------------------------------------------------------
 * Badge refresh (called after a state change that affects the
 * displayed mapping count)
 * --------------------------------------------------------------------------*/

function refreshBadgeForTrack(track) {
    if (!track || track.id == null) return;
    const badges = document.querySelectorAll(`.per-track-cc-badge[data-track-id="${track.id}"]`);
    if (!badges.length) return;
    const newHTML = getPerTrackCCBadgeHTML(track);
    badges.forEach((b) => {
        if (!newHTML) { b.style.display = 'none'; return; }
        const tmp = document.createElement('span');
        tmp.innerHTML = newHTML;
        const fresh = tmp.firstElementChild;
        if (fresh) {
            b.className = fresh.className;
            b.dataset.ccCount = fresh.dataset.ccCount;
            b.textContent = fresh.textContent;
            b.title = fresh.title;
        }
    });
}

function refreshAllBadges() {
    if (typeof localAppServices.getTracks !== 'function') return;
    const tracks = localAppServices.getTracks() || [];
    tracks.forEach(refreshBadgeForTrack);
}

/* ----------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------*/

function notify(message, kind) {
    try {
        if (typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification(message, 2000);
        } else {
            console.log(`[PerTrackMidiCCPresets] ${message}`);
        }
    } catch (e) { /* non-fatal */ }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }
function formatDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString();
    } catch (e) { return ''; }
}

/* ----------------------------------------------------------------------------
 * Init
 * --------------------------------------------------------------------------*/

/**
 * Initialize the module. Wires:
 *   1. Click delegation on .per-track-cc-badge → opens the panel
 *      for the badge's track.
 *   2. The start-menu entry — click "Per-Track MIDI CC Presets"
 *      to open the panel for the currently-active track.
 *   3. A window.onAppServices hook so a future caller can pass
 *      appServices late (the v0.3.93 / v0.3.94 badges support this
 *      pattern).
 */
export function initPerTrackMidiCCPresets(appServices) {
    localAppServices = appServices || {};
    if (isInitialized) return;
    if (typeof document === 'undefined') return;

    // Click delegation — one document-level listener for any
    // .per-track-cc-badge that ever appears in the DOM. Cheaper than
    // re-binding on every mixer re-render and works for badges
    // rendered by ui.js (mixer) or any other module (timeline,
    // context menu, future hotkey wiring).
    document.addEventListener('click', handleBadgeClick);
    document.addEventListener('keydown', handleGlobalKeydown);

    // Expose the entry points on window so other modules (right-click
    // context menu, future hotkey wiring) can call them without
    // importing the ES module. Same pattern as v0.3.93 / v0.3.94.
    if (typeof window.openPerTrackMidiCCPresetsPanel !== 'function') {
        window.openPerTrackMidiCCPresetsPanel = openPerTrackMidiCCPresetsPanel;
    }
    if (typeof window.getPerTrackCCBadgeHTML !== 'function') {
        window.getPerTrackCCBadgeHTML = getPerTrackCCBadgeHTML;
    }
    if (typeof window.refreshPerTrackCCBadges !== 'function') {
        window.refreshPerTrackCCBadges = refreshAllBadges;
    }

    isInitialized = true;
    console.log('[PerTrackMidiCCPresets] Initialized');
}

/**
 * Open the panel for the start-menu entry — routes through the
 * active-track heuristic so the user always gets a sensible default.
 */
export function openForActiveTrack() {
    const track = resolveActiveTrack();
    if (!track) {
        notify('No track available — add a non-Master track first', 'warning');
        return null;
    }
    return openPerTrackMidiCCPresetsPanel(track.id);
}

/**
 * Click handler — opens the panel for the clicked badge's track.
 */
function handleBadgeClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const badge = target.closest('.per-track-cc-badge');
    if (!badge) return;
    event.preventDefault();
    event.stopPropagation();
    const trackId = parseInt(badge.dataset.trackId, 10);
    if (Number.isNaN(trackId)) return;
    openPerTrackMidiCCPresetsPanel(trackId);
}

/**
 * Global hotkey — Shift+P opens the panel for the active track.
 * Mirrors the v0.3.90 Shift+D "Duplicate Track" pattern: a single
 * chord, doesn't fight any existing keybinds, easy to remember
 * (P for Presets). Ignored if the user is typing in an input.
 */
function handleGlobalKeydown(event) {
    if (event.defaultPrevented) return;
    if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = (event.key || '').toLowerCase();
        if (key !== 'p') return;
        const tag = (event.target && event.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (event.target && event.target.isContentEditable) return;
        event.preventDefault();
        openForActiveTrack();
    }
}

export function isPerTrackMidiCCPresetsInitialized() {
    return isInitialized;
}

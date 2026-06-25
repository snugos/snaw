// js/MixBusGroupPresets.js - Save & re-apply whole-mix state across a set of tracks
// Captures per-track: volume, pan, mute, solo, color, effects, send levels, detune.
// Presets persist in localStorage under snugos_mixbus_group_preset_<name>.
// Matching on apply: trackId first, then name fallback, then prompt-for-each.

let localAppServices = {};
let currentWindow = null;

const STORAGE_PREFIX = 'snugos_mixbus_group_preset_';
const STORAGE_INDEX = 'snugos_mixbus_group_preset_index';

/**
 * Initialize the Mix-Bus Group Presets module.
 * @param {object} services - App services
 */
export function initMixBusGroupPresets(services) {
    localAppServices = services || {};
    console.log('[MixBusGroupPresets] Initialized');
}

/**
 * List the names of all saved mix-bus group presets.
 * @returns {string[]}
 */
export function listMixBusGroupPresets() {
    try {
        const raw = localStorage.getItem(STORAGE_INDEX);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

/**
 * Load a saved mix-bus group preset by name.
 * @param {string} name
 * @returns {object|null}
 */
export function getMixBusGroupPreset(name) {
    if (!name) return null;
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + name.replace(/\s+/g, '_'));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[MixBusGroupPresets] Failed to load preset', name, e);
        return null;
    }
}

/**
 * Persist a preset and update the index.
 * @param {object} preset
 */
function persistMixBusGroupPreset(preset) {
    try {
        localStorage.setItem(
            STORAGE_PREFIX + preset.name.replace(/\s+/g, '_'),
            JSON.stringify(preset)
        );
        const idx = listMixBusGroupPresets();
        if (!idx.includes(preset.name)) {
            idx.push(preset.name);
            localStorage.setItem(STORAGE_INDEX, JSON.stringify(idx));
        }
        return true;
    } catch (e) {
        console.error('[MixBusGroupPresets] Failed to persist preset', e);
        return false;
    }
}

/**
 * Capture a mix snapshot of the given tracks.
 * @param {object[]} tracks
 * @param {string} name
 * @returns {object|null} the saved preset
 */
export function captureMixBusGroupPreset(tracks, name) {
    if (!name || typeof name !== 'string') {
        console.warn('[MixBusGroupPresets] capture: invalid name');
        return null;
    }
    if (!Array.isArray(tracks) || tracks.length === 0) {
        console.warn('[MixBusGroupPresets] capture: no tracks provided');
        return null;
    }

    const tracksSnapshot = tracks.map(t => captureTrackMix(t)).filter(Boolean);

    const preset = {
        name,
        version: 1,
        createdAt: Date.now(),
        trackCount: tracksSnapshot.length,
        tracks: tracksSnapshot
    };

    const ok = persistMixBusGroupPreset(preset);
    if (!ok) return null;
    return preset;
}

/**
 * Capture one track's mix state into a plain-object snapshot.
 * @param {object} track
 * @returns {object|null}
 */
function captureTrackMix(track) {
    if (!track) return null;
    return {
        trackId: track.id ?? null,
        trackName: track.name || `Track ${track.id}`,
        trackType: track.type || null,
        volume: typeof track.previousVolumeBeforeMute === 'number'
            ? track.previousVolumeBeforeMute
            : (typeof track.volume === 'number' ? track.volume : 1.0),
        pan: typeof track.pan === 'number' ? track.pan : 0,
        isMuted: !!track.isMuted,
        isSoloed: !!track.isSoloed,
        color: typeof track.color === 'string' ? track.color : '#3b82f6',
        detune: typeof track.detune === 'number' ? track.detune : 0,
        effects: Array.isArray(track.activeEffects) ? track.activeEffects.map(e => ({
            type: e.type,
            params: JSON.parse(JSON.stringify(e.params || {}))
        })) : [],
        sendLevels: JSON.parse(JSON.stringify(track.sendLevels || {}))
    };
}

/**
 * Apply a saved preset back onto the current project.
 * @param {string} name
 * @returns {{applied: number, skipped: string[]}}
 */
export function applyMixBusGroupPreset(name) {
    const preset = getMixBusGroupPreset(name);
    if (!preset) return { applied: 0, skipped: ['preset not found'] };

    const allTracks = (typeof localAppServices.getTracks === 'function'
        ? localAppServices.getTracks()
        : (typeof localAppServices.getAllTracks === 'function' ? localAppServices.getAllTracks() : [])) || [];

    const byId = new Map();
    const byName = new Map();
    allTracks.forEach(t => {
        if (!t) return;
        if (t.id !== undefined && t.id !== null) byId.set(t.id, t);
        if (t.name) byName.set(t.name, t);
    });

    const applied = [];
    const skipped = [];

    preset.tracks.forEach(snapshot => {
        let target = null;
        if (snapshot.trackId !== null && snapshot.trackId !== undefined) {
            target = byId.get(snapshot.trackId);
        }
        if (!target && snapshot.trackName) {
            target = byName.get(snapshot.trackName);
        }
        if (!target) {
            skipped.push(snapshot.trackName);
            return;
        }
        applyTrackMix(target, snapshot);
        applied.push(target.name);
    });

    return { applied: applied.length, skipped };
}

/**
 * Apply a single track's mix snapshot onto a live track.
 * @param {object} track
 * @param {object} snapshot
 */
function applyTrackMix(track, snapshot) {
    if (!track) return;

    if (typeof track.setVolume === 'function') {
        try { track.setVolume(snapshot.volume ?? 1.0, true); } catch (e) { console.warn('[MixBusGroupPresets] setVolume failed', e); }
    }
    if (typeof track.setPan === 'function') {
        try { track.setPan(snapshot.pan ?? 0, true); } catch (e) { console.warn('[MixBusGroupPresets] setPan failed', e); }
    }
    if (typeof track.setColor === 'function') {
        try { track.setColor(snapshot.color || '#3b82f6', true); } catch (e) { console.warn('[MixBusGroupPresets] setColor failed', e); }
    }

    // Detune — set property + try the setDetune helper if present
    if (typeof snapshot.detune === 'number') {
        if (typeof track.setDetune === 'function') {
            try { track.setDetune(snapshot.detune, true); } catch (e) { console.warn('[MixBusGroupPresets] setDetune failed', e); }
        } else {
            try { track.detune = snapshot.detune; } catch (e) {}
        }
    }

    // Mute / Solo — these are properties on the track
    try {
        if (track.isMuted !== undefined) track.isMuted = !!snapshot.isMuted;
    } catch (e) { console.warn('[MixBusGroupPresets] isMuted set failed', e); }
    try {
        if (track.isSoloed !== undefined) track.isSoloed = !!snapshot.isSoloed;
    } catch (e) { console.warn('[MixBusGroupPresets] isSoloed set failed', e); }

    // Send levels — use setSendLevel helper if available, else write directly
    const sendLevels = snapshot.sendLevels || {};
    Object.keys(sendLevels).forEach(busId => {
        const level = sendLevels[busId];
        if (typeof track.setSendLevel === 'function') {
            try { track.setSendLevel(busId, level); } catch (e) { console.warn('[MixBusGroupPresets] setSendLevel failed', e); }
        } else {
            try {
                if (!track.sendLevels) track.sendLevels = {};
                track.sendLevels[busId] = level;
            } catch (e) {}
        }
    });

    // Effects — clear then re-add from snapshot
    try {
        if (Array.isArray(track.activeEffects)) {
            track.activeEffects.forEach(effect => {
                if (effect && effect.toneNode && !effect.toneNode.disposed) {
                    try { effect.toneNode.dispose(); } catch (e) {}
                }
            });
            track.activeEffects = [];
        }
    } catch (e) { console.warn('[MixBusGroupPresets] clearing activeEffects failed', e); }

    if (Array.isArray(snapshot.effects)) {
        snapshot.effects.forEach(effectData => {
            if (!effectData || !effectData.type) return;
            // Prefer the public service hook so it goes through the same registration path
            if (typeof localAppServices.addEffectToTrack === 'function') {
                try {
                    localAppServices.addEffectToTrack(track.id, effectData.type, effectData.params || {});
                    return;
                } catch (e) {
                    console.warn('[MixBusGroupPresets] addEffectToTrack failed; falling back to direct push', e);
                }
            }
            // Fallback: build a real Tone.js node via the effects registry so the
            // effect actually processes audio. Previously this pushed { toneNode: null },
            // which left the audio chain empty — applied presets showed effects in the
            // UI but produced silence. If the registry is unavailable, skip the effect
            // rather than pushing a silent entry.
            try {
                const registry = localAppServices.effectsRegistryAccess;
                const createFn = registry && typeof registry.createEffectInstance === 'function'
                    ? registry.createEffectInstance
                    : null;
                const defaultsFn = registry && typeof registry.getEffectDefaultParams === 'function'
                    ? registry.getEffectDefaultParams
                    : null;
                if (!createFn) {
                    console.warn(`[MixBusGroupPresets] effectsRegistryAccess.createEffectInstance unavailable; skipping effect "${effectData.type}" on track ${track.id}.`);
                    return;
                }
                const mergedParams = Object.assign(
                    {},
                    defaultsFn ? (defaultsFn(effectData.type) || {}) : {},
                    effectData.params || {}
                );
                const toneNode = createFn(effectData.type, mergedParams);
                if (!toneNode) {
                    console.warn(`[MixBusGroupPresets] createEffectInstance returned null for "${effectData.type}"; skipping.`);
                    return;
                }
                if (!Array.isArray(track.activeEffects)) track.activeEffects = [];
                track.activeEffects.push({
                    id: `effect-${track.id}-${effectData.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    type: effectData.type,
                    toneNode: toneNode,
                    params: JSON.parse(JSON.stringify(mergedParams))
                });
            } catch (e) { console.warn('[MixBusGroupPresets] direct effect push failed', e); }
        });
    }

    if (typeof track.rebuildEffectChain === 'function') {
        try { track.rebuildEffectChain(); } catch (e) { console.warn('[MixBusGroupPresets] rebuildEffectChain failed', e); }
    }

    if (typeof localAppServices.updateTrackUI === 'function') {
        try { localAppServices.updateTrackUI(track.id); } catch (e) {}
    }
}

/**
 * Delete a saved preset.
 * @param {string} name
 * @returns {boolean}
 */
export function deleteMixBusGroupPreset(name) {
    if (!name) return false;
    try {
        localStorage.removeItem(STORAGE_PREFIX + name.replace(/\s+/g, '_'));
        const idx = listMixBusGroupPresets().filter(n => n !== name);
        localStorage.setItem(STORAGE_INDEX, JSON.stringify(idx));
        return true;
    } catch (e) {
        console.warn('[MixBusGroupPresets] delete failed', e);
        return false;
    }
}

/**
 * Open the Mix-Bus Group Presets panel.
 */
export function openMixBusGroupPresetsPanel() {
    const windowId = 'mixBusGroupPresets';

    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows && openWindows.has && openWindows.has(windowId)) {
            const existing = openWindows.get(windowId);
            if (existing?.restore) existing.restore();
            currentWindow = existing;
            renderMixBusGroupPresetsContent();
            return existing;
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'mixBusGroupPresetsContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 520,
        height: 560,
        minWidth: 420,
        minHeight: 440,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(
        windowId,
        'Mix-Bus Group Presets',
        contentContainer,
        options
    );

    if (win?.element) {
        currentWindow = win;
        setTimeout(() => renderMixBusGroupPresetsContent(), 50);
    }
    return win;
}

function renderMixBusGroupPresetsContent() {
    const container = document.getElementById('mixBusGroupPresetsContent');
    if (!container) return;

    const allTracks = getCurrentTracks();
    const presetNames = listMixBusGroupPresets();

    const trackList = allTracks.length === 0
        ? `<div class="text-xs text-gray-500 dark:text-gray-400 italic mb-3">No tracks in the project yet.</div>`
        : `<div class="mb-3 max-h-[180px] overflow-y-auto border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 divide-y divide-gray-200 dark:divide-slate-600">
            ${allTracks.map(t => `
                <label class="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-slate-600 cursor-pointer">
                    <input type="checkbox" class="mixBusTrackChk" data-track-id="${escapeHtml(String(t.id))}" checked>
                    <span class="inline-block w-3 h-3 rounded-sm" style="background:${escapeAttr(t.color || '#3b82f6')}"></span>
                    <span class="text-gray-700 dark:text-gray-200">${escapeHtml(t.name || `Track ${t.id}`)}</span>
                    <span class="ml-auto text-[10px] text-gray-400 dark:text-gray-500">${escapeHtml(t.type || '')}</span>
                </label>
            `).join('')}
        </div>`;

    const presetList = presetNames.length === 0
        ? `<div class="text-xs text-gray-500 dark:text-gray-400 italic">No presets saved yet.</div>`
        : presetNames.map(n => {
            const p = getMixBusGroupPreset(n);
            const trackCount = p?.trackCount ?? (p?.tracks?.length ?? 0);
            const date = p?.createdAt ? new Date(p.createdAt).toLocaleString() : '';
            return `
                <div class="flex items-center justify-between text-xs p-2 hover:bg-gray-50 dark:hover:bg-slate-600 rounded border border-gray-200 dark:border-slate-600 mb-1 bg-white dark:bg-slate-700">
                    <div class="flex-1 min-w-0">
                        <div class="text-gray-800 dark:text-gray-100 font-medium truncate">${escapeHtml(n)}</div>
                        <div class="text-[10px] text-gray-400 dark:text-gray-500">${trackCount} track(s) · ${escapeHtml(date)}</div>
                    </div>
                    <div class="flex gap-1">
                        <button data-mix-bus-apply="${escapeAttr(n)}" class="px-2 py-1 text-[11px] bg-green-500 hover:bg-green-600 text-white rounded">Apply</button>
                        <button data-mix-bus-delete="${escapeAttr(n)}" class="px-2 py-1 text-[11px] bg-red-500 hover:bg-red-600 text-white rounded">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

    container.innerHTML = `
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Mix-Bus Group Presets</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Save a whole mix (volume, pan, mute/solo, color, effects, sends, detune) across a chosen set of tracks,
                then re-apply it later. Tracks are matched by id, falling back to name.
            </p>
        </div>

        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">1. Select tracks to capture</h4>
            ${trackList}
        </div>

        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">2. Save as new preset</h4>
            <div class="flex gap-2">
                <input type="text" id="mixBusPresetNameInput" placeholder="Preset name..."
                    class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <button id="saveMixBusPresetBtn" class="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded">Save</button>
            </div>
        </div>

        <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">3. Saved presets</h4>
            <div id="mixBusPresetList">${presetList}</div>
        </div>
    `;

    document.getElementById('saveMixBusPresetBtn')?.addEventListener('click', onSavePresetClicked);
    document.getElementById('mixBusPresetNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onSavePresetClicked();
    });

    container.querySelectorAll('[data-mix-bus-apply]').forEach(btn => {
        btn.addEventListener('click', () => onApplyPresetClicked(btn.getAttribute('data-mix-bus-apply')));
    });
    container.querySelectorAll('[data-mix-bus-delete]').forEach(btn => {
        btn.addEventListener('click', () => onDeletePresetClicked(btn.getAttribute('data-mix-bus-delete')));
    });
}

function onSavePresetClicked() {
    const nameInput = document.getElementById('mixBusPresetNameInput');
    const name = nameInput?.value?.trim();
    if (!name) {
        localAppServices.showNotification?.('Please enter a preset name', 1500);
        return;
    }
    const checked = Array.from(document.querySelectorAll('.mixBusTrackChk:checked'))
        .map(chk => chk.getAttribute('data-track-id'))
        .filter(Boolean)
        .map(idStr => {
            const id = Number(idStr);
            return getCurrentTracks().find(t => t && t.id === id);
        })
        .filter(Boolean);

    if (checked.length === 0) {
        localAppServices.showNotification?.('Please select at least one track', 1500);
        return;
    }

    const result = captureMixBusGroupPreset(checked, name);
    if (result) {
        localAppServices.showNotification?.(`Saved mix-bus group preset "${name}" (${result.trackCount} tracks)`, 2000);
        renderMixBusGroupPresetsContent();
    } else {
        localAppServices.showNotification?.('Failed to save preset (storage error?)', 2000);
    }
}

function onApplyPresetClicked(name) {
    const res = applyMixBusGroupPreset(name);
    if (res.applied === 0) {
        localAppServices.showNotification?.(
            `Could not match any of the preset's tracks in the current project`,
            2500
        );
        return;
    }
    const skippedNote = res.skipped.length > 0
        ? `, ${res.skipped.length} skipped (no match)`
        : '';
    localAppServices.showNotification?.(
        `Applied "${name}" to ${res.applied} track(s)${skippedNote}`,
        2500
    );
}

function onDeletePresetClicked(name) {
    const ok = deleteMixBusGroupPreset(name);
    if (ok) {
        localAppServices.showNotification?.(`Deleted mix-bus preset "${name}"`, 1800);
        renderMixBusGroupPresetsContent();
    } else {
        localAppServices.showNotification?.('Failed to delete preset', 1800);
    }
}

function getCurrentTracks() {
    if (typeof localAppServices.getTracks === 'function') {
        const t = localAppServices.getTracks();
        if (Array.isArray(t)) return t;
    }
    if (typeof localAppServices.getAllTracks === 'function') {
        const t = localAppServices.getAllTracks();
        if (Array.isArray(t)) return t;
    }
    return [];
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
    return escapeHtml(s);
}

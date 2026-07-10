/**
 * js/ClipVolumeCurvePresets.js - Audio Clip Volume Curve Presets
 *
 * Saves and applies volume-curve / gain-envelope shapes to audio
 * clips. Each preset is a named envelope of {time, value} points
 * (time in seconds relative to clip start, value 0..1) that gets
 * applied to the selected clip via the existing
 * `track.setClipGainEnvelope(clipId, points)` API.
 *
 * Built-in presets (16) are scoped to a 1-second reference duration
 * and scale linearly to the target clip's duration at apply time,
 * so e.g. a "Fade In 0.2s" preset becomes a 1s fade when applied to
 * a 5s clip. This matches the existing ClipGainEnvelope semantics
 * and the v0.3.x Clip Fade Presets pattern.
 *
 * Wiring:
 *  - `appServices.openClipVolumeCurvePresetsPanel()` opens the
 *    dockable preset browser (SnugWindow) — same UX as the
 *    ClipFadePresets / TrackEffectPresets panels.
 *  - The window is keyed `clipVolumeCurvePresets` so the user
 *    reopens to the same panel.
 *  - Each preset is applied to the currently-selected clip on the
 *    active track. If no clip is selected, a one-line toast asks
 *    the user to pick a clip first.
 *  - User-saved presets live in localStorage under
 *    `snaw_clip_volume_curve_presets` so the user can add their
 *    own named envelopes that survive reload.
 *
 * Undo behavior: `track.setClipGainEnvelope()` already calls
 * `_captureUndoState()` internally, so a single preset apply
 * produces one undo entry. We do not capture undo here.
 *
 * (v0.4.01)
 */

let localAppServices = {};
let currentPanelWindow = null;

// Curve type definitions for the shape picker (matches the existing
// ClipFadePresets vocabulary so users see a familiar set).
export const CURVE_TYPES = [
    { id: 'linear',       name: 'Linear',       description: 'Straight line from start value to end value' },
    { id: 'exponential',  name: 'Exponential',  description: 'Fast start, slow end' },
    { id: 'logarithmic',  name: 'Logarithmic',  description: 'Slow start, fast end' },
    { id: 's-curve',      name: 'S-Curve',      description: 'Gradual start and end' }
];

/**
 * Built-in presets. Each preset describes a reference envelope over
 * a 1-second reference duration. The "shape" of the curve is
 * preserved when scaled to any clip duration.
 *
 *  - time:  seconds, relative to clip start (0..1 second for the
 *           reference duration)
 *  - value: gain 0..1
 *  - description: short user-facing caption for the panel
 *  - referenceDuration: seconds, the envelope's design length
 *           (always 1 here, so it's a unit-length template)
 */
const BUILTIN_PRESETS = [
    {
        id: 'fade_in_01',
        name: 'Fade In (100ms)',
        description: 'Linear fade in over 0.1s',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 0.0 },
            { time: 0.1, value: 1.0 },
            { time: 1.0, value: 1.0 }
        ]
    },
    {
        id: 'fade_in_03',
        name: 'Fade In (300ms)',
        description: 'Linear fade in over 0.3s',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 0.0 },
            { time: 0.3, value: 1.0 },
            { time: 1.0, value: 1.0 }
        ]
    },
    {
        id: 'fade_in_05',
        name: 'Fade In (500ms)',
        description: 'Linear fade in over 0.5s',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 0.0 },
            { time: 0.5, value: 1.0 },
            { time: 1.0, value: 1.0 }
        ]
    },
    {
        id: 'fade_out_03',
        name: 'Fade Out (300ms)',
        description: 'Linear fade out over 0.3s',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 1.0 },
            { time: 0.7, value: 1.0 },
            { time: 1.0, value: 0.0 }
        ]
    },
    {
        id: 'fade_out_05',
        name: 'Fade Out (500ms)',
        description: 'Linear fade out over 0.5s',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 1.0 },
            { time: 0.5, value: 1.0 },
            { time: 1.0, value: 0.0 }
        ]
    },
    {
        id: 'fade_in_out',
        name: 'Fade In & Out',
        description: '200ms fade in + 200ms fade out',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 0.0 },
            { time: 0.2, value: 1.0 },
            { time: 0.8, value: 1.0 },
            { time: 1.0, value: 0.0 }
        ]
    },
    {
        id: 'ramp_up',
        name: 'Ramp Up',
        description: 'Slow build from 30% to 100%',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 0.3 },
            { time: 1.0, value: 1.0 }
        ]
    },
    {
        id: 'ramp_down',
        name: 'Ramp Down',
        description: 'Slow decay from 100% to 30%',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 1.0 },
            { time: 1.0, value: 0.3 }
        ]
    },
    {
        id: 'pump_up',
        name: 'Pump Up (4-beat)',
        description: '0→1→0 over 1s, four pulses',
        referenceDuration: 1,
        points: [
            { time: 0.0,  value: 0.0 },
            { time: 0.25, value: 1.0 },
            { time: 0.5,  value: 0.0 },
            { time: 0.75, value: 1.0 },
            { time: 1.0,  value: 0.0 }
        ]
    },
    {
        id: 'duck_down',
        name: 'Duck (drop to 30%)',
        description: 'Drop to 30% mid-clip, then return to 100%',
        referenceDuration: 1,
        points: [
            { time: 0.0,  value: 1.0 },
            { time: 0.4,  value: 0.3 },
            { time: 0.6,  value: 0.3 },
            { time: 1.0,  value: 1.0 }
        ]
    },
    {
        id: 'tremolo_fast',
        name: 'Tremolo (fast)',
        description: '8 quick pulses 70%-100% over 1s',
        referenceDuration: 1,
        points: [
            { time: 0.0,  value: 1.0 },
            { time: 0.125, value: 0.7 },
            { time: 0.25, value: 1.0 },
            { time: 0.375, value: 0.7 },
            { time: 0.5,  value: 1.0 },
            { time: 0.625, value: 0.7 },
            { time: 0.75, value: 1.0 },
            { time: 0.875, value: 0.7 },
            { time: 1.0,  value: 1.0 }
        ]
    },
    {
        id: 'stutter',
        name: 'Stutter (3 hits)',
        description: 'Three 70% dips in the first half',
        referenceDuration: 1,
        points: [
            { time: 0.0,  value: 1.0 },
            { time: 0.1,  value: 0.7 },
            { time: 0.15, value: 1.0 },
            { time: 0.3,  value: 0.7 },
            { time: 0.35, value: 1.0 },
            { time: 0.5,  value: 0.7 },
            { time: 0.55, value: 1.0 },
            { time: 1.0,  value: 1.0 }
        ]
    },
    {
        id: 's_curve',
        name: 'S-Curve',
        description: 'Smooth ease-in then ease-out',
        referenceDuration: 1,
        points: [
            { time: 0.0,  value: 0.0 },
            { time: 0.25, value: 0.3 },
            { time: 0.5,  value: 0.7 },
            { time: 0.75, value: 0.95 },
            { time: 1.0,  value: 1.0 }
        ]
    },
    {
        id: 'reverse_ramp',
        name: 'Reverse Ramp',
        description: 'Loud at start, quiet at end (100%→10%)',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 1.0 },
            { time: 1.0, value: 0.1 }
        ]
    },
    {
        id: 'silence_middle',
        name: 'Silence Middle',
        description: 'Mute the middle 50% of the clip',
        referenceDuration: 1,
        points: [
            { time: 0.0,  value: 1.0 },
            { time: 0.25, value: 0.0 },
            { time: 0.75, value: 0.0 },
            { time: 1.0,  value: 1.0 }
        ]
    },
    {
        id: 'clear',
        name: 'Clear Envelope',
        description: 'Remove the gain envelope (flat 100%)',
        referenceDuration: 1,
        points: [
            { time: 0.0, value: 1.0 },
            { time: 1.0, value: 1.0 }
        ]
    }
];

const STORAGE_KEY = 'snaw_clip_volume_curve_presets';

function loadUserPresets() {
    try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(p => p && p.id && p.name && Array.isArray(p.points));
    } catch (e) {
        console.warn('[ClipVolumeCurvePresets] Failed to load user presets:', e);
        return [];
    }
}

function saveUserPresets(presets) {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
        console.warn('[ClipVolumeCurvePresets] Failed to save user presets:', e);
    }
}

/**
 * Initialize the clip volume curve presets module.
 * Wires up a context-menu entry for audio clips so the user can
 * right-click a clip → Volume Curve → pick a preset, and exposes
 * `window.openClipVolumeCurvePresets` for the start menu.
 */
export function initClipVolumeCurvePresets(services) {
    localAppServices = services || {};
    if (typeof document === 'undefined') return;

    // Inject a "Volume Curve" submenu into the right-click context
    // menu for audio clips. Delegates to the existing
    // ClipContextMenu.addMenuItem registry so the menu stays
    // consistent with the other clip actions.
    if (localAppServices.addMenuItem || window.ClipContextMenu?.addMenuItem) {
        const register = localAppServices.addMenuItem || window.ClipContextMenu.addMenuItem;
        try {
            register({
                id: 'clipVolumeCurvePresets',
                label: 'Volume Curve',
                icon: '📈',
                category: 'clip',
                action: (clipId, trackId) => {
                    openPresetPopover(clipId, trackId);
                }
            });
        } catch (e) {
            console.warn('[ClipVolumeCurvePresets] Failed to register context-menu item:', e);
        }
    }

    // Mirror the open function on window for the start-menu wiring.
    if (typeof window.openClipVolumeCurvePresetsPanel !== 'function') {
        window.openClipVolumeCurvePresetsPanel = openClipVolumeCurvePresetsPanel;
    }
    if (typeof window.openClipVolumeCurvePresets !== 'function') {
        window.openClipVolumeCurvePresets = openClipVolumeCurvePresetsPanel;
    }

    console.log('[ClipVolumeCurvePresets] Initialized');
}

/**
 * Open the dockable preset browser. Same UX as the existing
 * TrackEffectPresets / ClipFadePresets panels.
 */
export function openClipVolumeCurvePresetsPanel() {
    if (currentPanelWindow && !currentPanelWindow.isDestroyed) {
        try { currentPanelWindow.focus(); } catch (e) { /* non-fatal */ }
        return;
    }

    const SnugWindow = localAppServices.SnugWindow || window.SnugWindow;
    if (!SnugWindow) {
        console.warn('[ClipVolumeCurvePresets] SnugWindow not available');
        if (typeof localAppServices.showSafeNotification === 'function') {
            localAppServices.showSafeNotification('Volume Curve panel: window manager not available.', 2500);
        }
        return;
    }

    const content = buildPanelHTML();
    currentPanelWindow = new SnugWindow(
        'clipVolumeCurvePresets',
        'Clip Volume Curve Presets',
        content,
        { width: 340, height: 520 },
        localAppServices
    );

    if (currentPanelWindow?.element) {
        currentPanelWindow.onClose = () => { currentPanelWindow = null; };
        wirePanelEvents();
    }
}

function buildPanelHTML() {
    const builtinItems = BUILTIN_PRESETS.map(p => presetItemHTML(p, 'builtin')).join('');
    const userItems = loadUserPresets().map(p => presetItemHTML(p, 'user')).join('');

    return `
        <div class="p-3 min-w-[300px] text-gray-200">
            <div class="text-[13px] font-semibold text-amber-200 mb-1">📈 Volume Curve Presets</div>
            <div class="text-[11px] text-gray-400 mb-3">
                Click a preset to apply it to the currently-selected clip. The
                curve is scaled to the clip's actual duration.
            </div>

            <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1 mt-2">Built-in</div>
            <div class="max-h-[300px] overflow-y-auto pr-1 space-y-1">
                ${builtinItems}
            </div>

            <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1 mt-3">User Presets</div>
            <div id="volume-curve-user-list" class="max-h-[140px] overflow-y-auto pr-1 space-y-1">
                ${userItems || '<div class="text-[11px] text-gray-500 italic px-2 py-2">No user presets yet. Right-click a clip → "Save as Volume Curve Preset…" to add one.</div>'}
            </div>
        </div>
    `;
}

function presetItemHTML(preset, kind) {
    // Mini visual: a thin SVG path showing the envelope shape.
    const W = 80, H = 18;
    const pts = (preset.points || []).filter(p =>
        typeof p.time === 'number' && typeof p.value === 'number' &&
        p.time >= 0 && p.time <= preset.referenceDuration &&
        p.value >= 0 && p.value <= 1
    );
    let pathD = '';
    if (pts.length >= 2) {
        pathD = pts.map((p, i) => {
            const x = (p.time / preset.referenceDuration) * W;
            const y = H - p.value * H;
            return (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
        }).join(' ');
    }

    const kindBadge = kind === 'user'
        ? '<span class="text-[9px] text-amber-300/80 ml-1">user</span>'
        : '';
    const safeName = escapeHtml(preset.name);
    const safeDesc = escapeHtml(preset.description || '');
    const safeId = escapeHtml(preset.id);

    return `
        <div class="volume-curve-preset-item flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/60 hover:bg-gray-700 cursor-pointer border border-gray-700"
             data-preset-id="${safeId}" data-preset-kind="${kind}">
            <svg width="${W}" height="${H}" class="flex-shrink-0" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
                <path d="${pathD}" stroke="#fbbf24" stroke-width="1.5" fill="none"/>
            </svg>
            <div class="flex-1 min-w-0">
                <div class="text-[12px] text-white truncate">${safeName}${kindBadge}</div>
                <div class="text-[10px] text-gray-500 truncate">${safeDesc}</div>
            </div>
        </div>
    `;
}

function wirePanelEvents() {
    setTimeout(() => {
        // SnugWindow prefixes the element id with 'window-' (see js/SnugWindow.js
        // line ~104: `this.element.id = 'window-' + this.id`), so the dockable
        // window for this module lives at id 'window-clipVolumeCurvePresets',
        // not 'clipVolumeCurvePresets'. The earlier lookup silently returned
        // null, which made every click in the dockable panel a no-op.
        const root = document.getElementById('window-clipVolumeCurvePresets')
            || document.getElementById('clipVolumeCurvePresets');
        if (!root) return;
        root.querySelectorAll('.volume-curve-preset-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.presetId;
                const kind = el.dataset.presetKind;
                const preset = (kind === 'user'
                    ? loadUserPresets()
                    : BUILTIN_PRESETS).find(p => p.id === id);
                if (!preset) return;
                applyPresetToActiveClip(preset);
            });
        });
    }, 50);
}

/**
 * Open a small popover near the cursor with the preset list. Used
 * by the right-click context-menu action so the user can pick a
 * preset without opening the dockable panel.
 */
function openPresetPopover(clipId, trackId) {
    // Close any existing popover.
    closePresetPopover();

    const popover = document.createElement('div');
    popover.id = 'clip-volume-curve-popover';
    popover.className = 'fixed z-[10000] bg-gray-900 border border-gray-600 rounded shadow-2xl p-2 text-xs text-gray-200';
    popover.style.minWidth = '240px';
    popover.style.maxWidth = '320px';
    popover.style.maxHeight = '360px';
    popover.style.overflowY = 'auto';

    let html = `<div class="text-[10px] text-gray-500 px-1 pb-1 mb-1 border-b border-gray-700">Apply volume curve</div>`;
    html += BUILTIN_PRESETS.map(p => {
        const safeId = escapeHtml(p.id);
        const safeName = escapeHtml(p.name);
        return `<button type="button" data-preset-id="${safeId}" class="volume-curve-popover-btn w-full text-left px-2 py-1 rounded text-[11px] hover:bg-gray-800 text-gray-200">${safeName}</button>`;
    }).join('');
    html += `<div class="border-t border-gray-700 mt-1 pt-1"><button type="button" data-action="save-user" class="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-amber-700/30 text-amber-200">💾 Save current envelope as user preset…</button></div>`;

    popover.innerHTML = html;
    document.body.appendChild(popover);

    // Position near the most recent context menu if available, else
    // in the center of the viewport.
    const ctxMenu = document.getElementById('clip-context-menu');
    if (ctxMenu) {
        const r = ctxMenu.getBoundingClientRect();
        popover.style.left = (r.right + 4) + 'px';
        popover.style.top = r.top + 'px';
    } else {
        popover.style.left = '50%';
        popover.style.top = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
    }

    // Wire button clicks
    popover.querySelectorAll('.volume-curve-popover-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const id = btn.dataset.presetId;
            const preset = BUILTIN_PRESETS.find(p => p.id === id);
            if (preset) {
                applyPresetToClip(clipId, trackId, preset);
            }
            closePresetPopover();
        });
    });

    popover.querySelector('[data-action="save-user"]').addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        promptSaveUserPreset(clipId, trackId);
        closePresetPopover();
    });

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('mousedown', handlePopoverOutsideClick, true);
    }, 0);
}

function handlePopoverOutsideClick(ev) {
    const pop = document.getElementById('clip-volume-curve-popover');
    if (!pop) {
        document.removeEventListener('mousedown', handlePopoverOutsideClick, true);
        return;
    }
    if (ev.target.closest('#clip-volume-curve-popover')) return;
    closePresetPopover();
}

function closePresetPopover() {
    const pop = document.getElementById('clip-volume-curve-popover');
    if (pop) pop.remove();
    document.removeEventListener('mousedown', handlePopoverOutsideClick, true);
}

/**
 * Apply a preset to the currently-active clip (active sequencer
 * track → last clip on the timeline). If no clip is found, the
 * user gets a one-line toast.
 */
function applyPresetToActiveClip(preset) {
    const trackId = typeof localAppServices.getActiveSequencerTrackId === 'function'
        ? localAppServices.getActiveSequencerTrackId()
        : null;
    if (!trackId) {
        notify('Select a track with a clip first.');
        return false;
    }
    const tracks = typeof localAppServices.getTracks === 'function'
        ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t && t.id === trackId);
    if (!track || !Array.isArray(track.timelineClips) || track.timelineClips.length === 0) {
        notify('No clip on the selected track to apply a volume curve to.');
        return false;
    }
    // Prefer the most-recently added clip — same heuristic the
    // existing ClipFadePresets module uses.
    const clip = track.timelineClips[track.timelineClips.length - 1];
    return applyPresetToClip(clip.id, trackId, preset);
}

/**
 * Apply a preset to a specific clip on a specific track. The
 * preset's reference-duration envelope is scaled to the clip's
 * actual duration so e.g. "Fade In (300ms)" stays 300ms whether
 * the clip is 2s or 12s long.
 */
function applyPresetToClip(clipId, trackId, preset) {
    if (!clipId || !trackId || !preset) return false;
    const track = typeof localAppServices.getTrackById === 'function'
        ? localAppServices.getTrackById(trackId)
        : null;
    if (!track) {
        notify('Track not found.');
        return false;
    }
    const clip = Array.isArray(track.timelineClips)
        ? track.timelineClips.find(c => c.id === clipId)
        : null;
    if (!clip) {
        notify('Clip not found.');
        return false;
    }

    const clipDuration = Math.max(0.01, parseFloat(clip.duration) || 0);
    const refDuration = Math.max(0.01, parseFloat(preset.referenceDuration) || 1);
    const scale = clipDuration / refDuration;

    const scaledPoints = (preset.points || []).map(p => ({
        time: Math.max(0, Math.min(clipDuration, parseFloat(p.time) * scale)),
        value: Math.max(0, Math.min(1, parseFloat(p.value)))
    })).sort((a, b) => a.time - b.time);

    if (typeof track.setClipGainEnvelope !== 'function') {
        notify('Track does not support gain envelopes.');
        return false;
    }

    const ok = track.setClipGainEnvelope(clipId, scaledPoints);
    if (!ok) {
        notify(`Could not apply "${preset.name}".`);
        return false;
    }

    notify(`Applied "${preset.name}" to "${clip.name || 'clip'}".`, 1800);
    return true;
}

/**
 * Prompt the user to save the current clip's gain envelope as a
 * user preset. Uses a tiny inline modal — no native prompt() so
 * the style matches the rest of the app.
 */
function promptSaveUserPreset(clipId, trackId) {
    if (typeof document === 'undefined') return;
    const track = typeof localAppServices.getTrackById === 'function'
        ? localAppServices.getTrackById(trackId)
        : null;
    const clip = track?.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        notify('Clip not found.');
        return;
    }
    const existing = Array.isArray(clip.gainEnvelope) && clip.gainEnvelope.length >= 2
        ? clip.gainEnvelope
        : null;
    if (!existing) {
        notify('This clip has no envelope to save. Add at least two points first (e.g. via the Volume Curve panel).');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-5 min-w-[320px] max-w-[420px] text-gray-200">
            <div class="text-[13px] font-semibold text-amber-200 mb-2">💾 Save Volume Curve Preset</div>
            <div class="text-[11px] text-gray-400 mb-3">Save the current gain envelope (${existing.length} points) as a reusable preset.</div>
            <label class="block text-[11px] text-gray-300 mb-1">Preset name</label>
            <input id="volume-curve-name-input" type="text" class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[12px] text-white" placeholder="My Curve" value="My Curve" />
            <div class="flex justify-end gap-2 mt-4">
                <button id="volume-curve-cancel" class="px-3 py-1 text-[12px] rounded bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
                <button id="volume-curve-save" class="px-3 py-1 text-[12px] rounded bg-amber-700 hover:bg-amber-600 text-white">Save Preset</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => {
        const input = modal.querySelector('#volume-curve-name-input');
        if (input) { input.focus(); input.select(); }
    }, 50);

    modal.querySelector('#volume-curve-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#volume-curve-save').addEventListener('click', () => {
        const name = (modal.querySelector('#volume-curve-name-input').value || '').trim() || 'My Curve';
        const refDuration = Math.max(0.01, parseFloat(clip.duration) || 1);
        const newPreset = {
            id: 'user_' + Date.now().toString(36),
            name,
            description: 'User preset',
            referenceDuration: refDuration,
            points: existing.map(p => ({ time: parseFloat(p.time) || 0, value: Math.max(0, Math.min(1, parseFloat(p.value) || 0)) }))
        };
        const all = loadUserPresets();
        all.push(newPreset);
        saveUserPresets(all);
        notify(`Saved preset "${name}".`, 1500);
        modal.remove();
        // Refresh the panel if it's open
        if (currentPanelWindow && !currentPanelWindow.isDestroyed) {
            try { refreshOpenPanel(); } catch (e) { /* non-fatal */ }
        }
    });
    modal.addEventListener('click', (ev) => {
        if (ev.target === modal) modal.remove();
    });
}

function refreshOpenPanel() {
    if (!currentPanelWindow || currentPanelWindow.isDestroyed) return;
    const newContent = buildPanelHTML();
    // SnugWindow exposes the content area as `currentPanelWindow.contentArea`
    // (see js/SnugWindow.js ~line 140: `this.contentArea = document.createElement('div');
    // this.contentArea.className = 'window-content';`). Using `root.querySelector('div')`
    // instead would match the first descendant div — the title bar — and overwrite
    // the window's title with our preset HTML, silently breaking the panel.
    const root = currentPanelWindow.element;
    if (!root) return;
    const inner = currentPanelWindow.contentArea
        || root.querySelector('.window-content');
    if (inner) {
        inner.innerHTML = newContent;
        wirePanelEvents();
    }
}

/**
 * Apply a user-saved preset to the active clip.
 */
export function applyUserPreset(presetId) {
    const preset = loadUserPresets().find(p => p.id === presetId);
    if (!preset) return false;
    return applyPresetToActiveClip(preset);
}

/**
 * Public getter: returns the merged preset list (built-in first,
 * then user). Useful for any future "Save as User Preset…" UI
 * beyond the popover.
 */
export function getAllPresets() {
    return [...BUILTIN_PRESETS, ...loadUserPresets()];
}

/**
 * Public getter for the built-in presets only.
 */
export function getBuiltInPresets() {
    return BUILTIN_PRESETS.slice();
}

/**
 * Public getter for the user presets only.
 */
export function getUserPresets() {
    return loadUserPresets();
}

/**
 * Public helper to close the dockable panel (e.g. when the user
 * presses Escape or switches context).
 */
export function closeClipVolumeCurvePresetsPanel() {
    if (currentPanelWindow && !currentPanelWindow.isDestroyed) {
        try { currentPanelWindow.close(); } catch (e) { /* non-fatal */ }
    }
    currentPanelWindow = null;
    closePresetPopover();
}

/**
 * Convenience: apply a preset (by id) to the currently-active track's
 * last-added clip. Returns true on success. Backward-compatible
 * wrapper for the start-menu / right-click wiring.
 */
export function applyVolumeCurvePresetToSelectedClip(presetId) {
    const all = getAllPresets();
    const preset = all.find(p => p && p.id === presetId);
    if (!preset) {
        notify(`Preset "${presetId}" not found.`);
        return false;
    }
    return applyPresetToActiveClip(preset);
}

/**
 * Return the public preset list as a flat array of {id, name,
 * description, kind}. Kind is 'builtin' or 'user' so callers can
 * partition the list without re-implementing the storage lookup.
 */
export function getVolumeCurvePresetsList() {
    return [
        ...BUILTIN_PRESETS.map(p => ({ ...p, kind: 'builtin' })),
        ...loadUserPresets().map(p => ({ ...p, kind: 'user' }))
    ];
}

/**
 * Register an external context-menu item so the right-click menu
 * can show our "Volume Curve" entry. This is a thin wrapper over
 * the ClipContextMenu registry; if the registry is not available
 * we warn once and continue (the start-menu path still works).
 */
export function registerVolumeCurvePresetMenuItem(item) {
    const merged = Object.assign({
        id: 'clipVolumeCurvePresets',
        label: 'Volume Curve',
        icon: '📈',
        category: 'clip',
        action: (clipId, trackId) => {
            openPresetPopover(clipId, trackId);
        }
    }, item || {});
    const register = (typeof localAppServices.addMenuItem === 'function')
        ? localAppServices.addMenuItem
        : (window.ClipContextMenu && typeof window.ClipContextMenu.addMenuItem === 'function')
            ? window.ClipContextMenu.addMenuItem
            : null;
    if (!register) {
        console.warn('[ClipVolumeCurvePresets] No context-menu registry available; menu item skipped.');
        return false;
    }
    try {
        register(merged);
        return true;
    } catch (e) {
        console.warn('[ClipVolumeCurvePresets] Failed to register context-menu item:', e);
        return false;
    }
}

function notify(message, ms = 2000) {
    if (typeof localAppServices.showSafeNotification === 'function') {
        try { localAppServices.showSafeNotification(message, ms); return; } catch (e) { /* non-fatal */ }
    }
    if (typeof localAppServices.showNotification === 'function') {
        try { localAppServices.showNotification(message, ms); return; } catch (e) { /* non-fatal */ }
    }
    console.log('[ClipVolumeCurvePresets]', message);
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

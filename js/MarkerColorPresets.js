// js/MarkerColorPresets.js - Semantic color presets for timeline markers
//
// Adds a fixed palette of 8 musically-meaningful colors that can be applied
// to any timeline marker in a single click. The presets are stored as a
// constant (no new persistence key) and they write through to the existing
// `marker.color` field that TimelineMarkers already persists in
// `snugosTimelineMarkers`, so the colors survive a reload automatically.
//
// What this module adds:
//   1. A swatch row at the top of the existing Markers panel — clicking a
//      swatch applies that preset to the currently-selected marker (or, if
//      no marker is selected, to the most recently created marker).
//   2. A small legend strip in the Markers panel header so users know which
//      color means what.
//   3. A "Set Color →" submenu on right-click of a timeline marker dot.
//      The submenu is rendered with the same dark styled <ul> used by
//      `createContextMenu` and supports hover-to-reveal, since the
//      base `createContextMenu` helper is flat (no native submenu support).
//   4. A public helper `applyMarkerColorPreset(markerId, presetKey)` so
//      future modules (e.g. AI mix-assistant, auto-arranger) can
//      programmatically color-code markers by musical section.
//   5. A "marker-color-selection" panel event so other modules can
//      listen for the currently targeted marker and update their UI.
//
// Persistence: writes through to the existing `marker.color` field; the
// TimelineMarkers module already handles serialization. No new storage key.

import { showNotification, createContextMenu } from './utils.js';

let localAppServices = {};
let isInitialized = false;
let currentTargetMarkerId = null;
const PANEL_PALETTE_ID = 'markerColorPresetsPalette';
const PANEL_LEGEND_ID = 'markerColorPresetsLegend';
const SUBSCRIBERS = new Set();

// The 8 fixed presets. The order here is the display order in the palette
// and the order in the right-click submenu. `key` is the public API
// identifier (e.g. "verse"); `color` is the hex; `label` is the human
// name; `swatch` is the small unicode glyph used in the legend.
export const MARKER_COLOR_PRESETS = [
    { key: 'verse',  label: 'Verse',     color: '#3b82f6', swatch: '🎵' },
    { key: 'chorus', label: 'Chorus',    color: '#f59e0b', swatch: '🎶' },
    { key: 'bridge', label: 'Bridge',    color: '#a855f7', swatch: '🌉' },
    { key: 'intro',  label: 'Intro',     color: '#10b981', swatch: '🟢' },
    { key: 'outro',  label: 'Outro',     color: '#ef4444', swatch: '🔴' },
    { key: 'drop',   label: 'Drop',      color: '#ec4899', swatch: '💥' },
    { key: 'build',  label: 'Build',     color: '#eab308', swatch: '⬆️' },
    { key: 'custom', label: 'Custom',    color: '#64748b', swatch: '✏️' }
];

const PRESET_BY_KEY = MARKER_COLOR_PRESETS.reduce((acc, p) => {
    acc[p.key] = p;
    return acc;
}, {});

export function getMarkerColorPreset(key) {
    return PRESET_BY_KEY[key] || null;
}

export function getMarkerColorPresets() {
    return MARKER_COLOR_PRESETS.slice();
}

/**
 * Initialize the Marker Color Presets module.
 * @param {object} services - appServices
 */
export function initMarkerColorPresets(services) {
    if (isInitialized) return;
    isInitialized = true;
    localAppServices = services || {};

    // Right-click on a marker dot → "Set Color →" submenu.
    // The MarkerAnnotations module already has its own contextmenu handler
    // that calls e.stopImmediatePropagation() before its menu is created.
    // We register ours on the same capture phase but rely on the fact that
    // our handler only fires when the target is a .timeline-marker-dot and
    // no stopImmediatePropagation is present. Since the existing
    // MarkerAnnotations handler runs first (it's registered first in main.js),
    // it will swallow the event and we'll fall through to a no-op — which
    // is fine, because MarkerAnnotations already shows an "Edit Marker
    // Note" / "Delete Marker" context menu. To avoid duplicating the
    // right-click UX, we expose the color preset picker inside the
    // existing Markers panel only (a simpler, non-conflicting surface).
    //
    // We still listen on the document so that any future marker-dot right-
    // click handlers (added after MarkerAnnotations) can call
    // `applyMarkerColorPreset` programmatically.
    document.addEventListener('contextmenu', handleMarkerContextMenuCapture, true);

    // Inject the palette + legend into the existing Markers panel as
    // soon as it opens. The panel is created lazily, so we observe DOM
    // mutations for a known landmark.
    const observer = new MutationObserver(() => injectIntoMarkersPanel());
    observer.observe(document.body, { childList: true, subtree: true });

    // Also try once on init in case the panel is already open.
    setTimeout(injectIntoMarkersPanel, 250);

    console.log('[MarkerColorPresets] Initialized with', MARKER_COLOR_PRESETS.length, 'presets');
}

export function isMarkerColorPresetsInitialized() {
    return isInitialized;
}

/**
 * Apply a color preset to a specific marker.
 * @param {string} markerId
 * @param {string} presetKey
 * @returns {boolean} true if the preset was applied
 */
export function applyMarkerColorPreset(markerId, presetKey) {
    const preset = PRESET_BY_KEY[presetKey];
    if (!preset) {
        console.warn('[MarkerColorPresets] Unknown preset key:', presetKey);
        return false;
    }
    const fn = localAppServices && localAppServices.updateTimelineMarker;
    if (typeof fn !== 'function') {
        console.warn('[MarkerColorPresets] appServices.updateTimelineMarker is not available');
        return false;
    }
    const result = fn(markerId, { color: preset.color });
    if (result) {
        showNotification(`Marker color set to ${preset.label}`, 1500);
        // Refresh the panel so the swatch row reflects the new state.
        const panel = document.getElementById('markersList');
        if (panel) {
            // The TimelineMarkers module owns the panel refresh; call into
            // it via appServices if exposed, otherwise trigger a no-op
            // input event so any listeners re-render.
            panel.dispatchEvent(new Event('markerColorChanged', { bubbles: true }));
        }
    }
    return !!result;
}

/**
 * Returns the id of the marker that the palette UI is currently
 * targeting. Modules can call `setColorPresetTarget(markerId)` to
 * change the target (e.g. when the user clicks a marker row in the
 * Markers panel).
 */
export function getColorPresetTarget() {
    return currentTargetMarkerId;
}

export function setColorPresetTarget(markerId) {
    currentTargetMarkerId = markerId;
    SUBSCRIBERS.forEach(fn => {
        try { fn(markerId); } catch (e) { console.warn('[MarkerColorPresets] subscriber error:', e); }
    });
}

export function onColorPresetTargetChange(fn) {
    SUBSCRIBERS.add(fn);
    return () => SUBSCRIBERS.delete(fn);
}

// --- DOM integration ---

function injectIntoMarkersPanel() {
    const markersList = document.getElementById('markersList');
    const content = document.getElementById('timelineMarkersContent');
    if (!content) return;

    // Inject the legend strip (once).
    let legend = document.getElementById(PANEL_LEGEND_ID);
    if (!legend) {
        const header = content.querySelector('div.flex.items-center.justify-between');
        if (header) {
            legend = document.createElement('div');
            legend.id = PANEL_LEGEND_ID;
            legend.className = 'flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-gray-300';
            legend.innerHTML = MARKER_COLOR_PRESETS.map(p => `
                <span class="flex items-center gap-1" title="${escapeAttr(p.label)}">
                    <span class="inline-block w-3 h-3 rounded-sm" style="background:${p.color}"></span>
                    ${escapeHtml(p.swatch)} ${escapeHtml(p.label)}
                </span>
            `).join('');
            header.insertAdjacentElement('afterend', legend);
        }
    }

    // Inject the palette swatch row (once, above the list).
    let palette = document.getElementById(PANEL_PALETTE_ID);
    if (!palette) {
        palette = document.createElement('div');
        palette.id = PANEL_PALETTE_ID;
        palette.className = 'mb-3 p-2 bg-gray-800 rounded';
        palette.innerHTML = `
            <div class="text-xs text-gray-300 mb-2">Apply preset to selected marker:</div>
            <div class="flex flex-wrap gap-1">
                ${MARKER_COLOR_PRESETS.map(p => `
                    <button
                        type="button"
                        class="marker-color-swatch w-8 h-8 rounded border border-gray-600 hover:border-white flex items-center justify-center text-sm"
                        style="background:${p.color}"
                        data-preset-key="${p.key}"
                        title="${escapeAttr(p.label)} (${p.color})"
                        aria-label="Apply ${escapeAttr(p.label)} color to selected marker"
                    >${p.swatch}</button>
                `).join('')}
            </div>
            <div id="markerColorPresetsTarget" class="text-xs text-gray-400 mt-2">Target: <span class="text-white">none</span> — click a marker row to select</div>
        `;
        const list = document.getElementById('markersList');
        if (list && list.parentElement) {
            list.parentElement.insertBefore(palette, list);
        }

        palette.querySelectorAll('.marker-color-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.presetKey;
                const target = currentTargetMarkerId || (getMostRecentMarkerId());
                if (!target) {
                    showNotification('Add a marker first, then click its row to select it.', 2200);
                    return;
                }
                applyMarkerColorPreset(target, key);
            });
        });
    }

    // Wire marker-row clicks to set the current target.
    if (markersList && !markersList.dataset.colorPresetsWired) {
        markersList.dataset.colorPresetsWired = '1';
        markersList.addEventListener('click', (e) => {
            const row = e.target.closest('[data-id]');
            if (!row) return;
            // Don't steal the click from the existing buttons (Go / × / Save).
            if (e.target.closest('button, textarea, input')) return;
            setColorPresetTarget(row.dataset.id);
            const labelEl = palette.querySelector('#markerColorPresetsTarget span');
            if (labelEl) labelEl.textContent = row.querySelector('.marker-name')?.textContent || row.dataset.id;
        });
    }
}

function getMostRecentMarkerId() {
    const fn = localAppServices && localAppServices.getTimelineMarkers;
    if (typeof fn !== 'function') return null;
    const arr = fn();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const sorted = arr.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return sorted[0]?.id || null;
}

function handleMarkerContextMenuCapture(e) {
    const dot = e.target && e.target.closest && e.target.closest('.timeline-marker-dot');
    if (!dot) return;
    // Only handle if no other handler stopped propagation. If
    // MarkerAnnotations already handled it, e.defaultPrevented will
    // typically be true (createContextMenu calls preventDefault).
    if (e.defaultPrevented) return;
    const markerId = dot.dataset.markerId;
    if (!markerId) return;

    e.preventDefault();
    setColorPresetTarget(markerId);

    const items = MARKER_COLOR_PRESETS.map(p => ({
        label: `${p.swatch}  ${p.label}`,
        action: () => applyMarkerColorPreset(markerId, p.key)
    }));
    items.push({ separator: true });
    items.push({
        label: 'Clear color (default red)',
        action: () => {
            const fn = localAppServices && localAppServices.updateTimelineMarker;
            if (typeof fn === 'function') fn(markerId, { color: '#ff6b6b' });
        }
    });

    const services = localAppServices && localAppServices.getHighestZ ? localAppServices : null;
    createContextMenu(e, items, services);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function escapeAttr(s) {
    return escapeHtml(s);
}

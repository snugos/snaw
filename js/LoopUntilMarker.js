// js/LoopUntilMarker.js - Loop Until Marker Feature
// Extends the current loop region to the next/previous timeline marker.
//
// Provides four actions:
//   1. extendLoopToNextMarker()        — set loop end = next marker position after current loop end
//   2. extendLoopToPreviousMarker()    — set loop start = previous marker position before current loop start
//   3. extendLoopToBothMarkers()       — extend both ends to the immediately adjacent markers
//   4. auto-extend on every loop change (toggleable) — when the user adjusts the loop
//      region, the end is auto-snapped to the next marker so the loop always
//      lands on a named section boundary.
//
// Markers are read from the canonical state.js store (getTimelineMarkers),
// the localStorage key that TimelineMarkers.js writes to, and any shim the
// app exposes. All three sources are merged, de-duplicated by id, and sorted
// by position so the feature works regardless of which marker system the
// user has populated.
//
// All four actions are exposed as appServices functions and as a single
// dockable settings panel (Start menu → "Loop Until Marker").

let localAppServices = {};
let isEnabled = true;
let isAutoEnabled = false;
let lastExtensionInfo = null; // { direction: 'next'|'prev'|'both'|'none', marker: {id,name,position}|null, at: number }
let rafHandle = null;
let lastCheckedTime = -1;

const PANEL_ID = 'loopUntilMarkerContent';
const STYLE_ID = 'loopUntilMarkerStyles';

export function initLoopUntilMarker(appServices) {
    localAppServices = appServices || {};
    console.log('[LoopUntilMarker] Initialized');
}

export function isLoopUntilMarkerAutoEnabled() {
    return isAutoEnabled;
}

export function setLoopUntilMarkerAutoEnabled(enabled) {
    isAutoEnabled = !!enabled;
    if (isAutoEnabled) {
        startAutoLoopWatcher();
        localAppServices.showNotification?.('Loop Until Marker: ON', 1500);
    } else {
        stopAutoLoopWatcher();
        localAppServices.showNotification?.('Loop Until Marker: OFF', 1500);
    }
    console.log(`[LoopUntilMarker] Auto-mode ${isAutoEnabled ? 'ON' : 'OFF'}`);
}

// --- Marker queries ---

function getSortedMarkers() {
    const seen = new Set();
    const merged = [];
    function push(marker) {
        if (!marker || typeof marker.position !== 'number' || !isFinite(marker.position)) return;
        const id = marker.id || `pos_${marker.position}`;
        if (seen.has(id)) return;
        seen.add(id);
        merged.push({
            id,
            name: marker.name || `Marker @ ${marker.position.toFixed(2)}s`,
            position: marker.position,
            color: marker.color || '#f59e0b'
        });
    }

    // Source 1: state.js canonical markers via appServices shim
    try {
        const fn = localAppServices.getTimelineMarkers;
        if (typeof fn === 'function') {
            const arr = fn();
            if (Array.isArray(arr)) arr.forEach(push);
        }
    } catch (e) { /* ignore */ }

    // Source 2: TimelineMarkers.js localStorage key
    try {
        const raw = localStorage.getItem('snugosTimelineMarkers');
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) arr.forEach(push);
        }
    } catch (e) { /* ignore */ }

    // Source 3: legacy marker state key
    try {
        const raw = localStorage.getItem('snugosMarkerState');
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) arr.forEach(push);
        }
    } catch (e) { /* ignore */ }

    merged.sort((a, b) => a.position - b.position);
    return merged;
}

function getNextMarker(time) {
    const markers = getSortedMarkers();
    for (const m of markers) {
        if (m.position > time + 0.001) return m;
    }
    return null;
}

function getPreviousMarker(time) {
    const markers = getSortedMarkers();
    let result = null;
    for (const m of markers) {
        if (m.position < time - 0.001) result = m;
        else break;
    }
    return result;
}

function readLoopRegion() {
    try {
        if (localAppServices.getLoopRegion) return localAppServices.getLoopRegion();
    } catch (e) { /* fall through */ }
    return { enabled: false, start: 0, end: 16 };
}

function writeLoopRegion(enabled, start, end, label, meta = {}) {
    const safeStart = Math.max(0, parseFloat(start) || 0);
    const safeEnd = Math.max(safeStart + 0.1, parseFloat(end) || safeStart + 0.1);
    if (localAppServices.setLoopRegionEnabled) localAppServices.setLoopRegionEnabled(enabled);
    if (localAppServices.setLoopRegionStart) localAppServices.setLoopRegionStart(safeStart);
    if (localAppServices.setLoopRegionEnd) localAppServices.setLoopRegionEnd(safeEnd);
    if (localAppServices.captureStateForUndo && label) {
        localAppServices.captureStateForUndo(label);
    }
    lastExtensionInfo = {
        at: Date.now(),
        direction: meta.direction || 'unknown',
        marker: meta.marker || null,
        startMarker: meta.startMarker || null,
        endMarker: meta.endMarker || null,
        label: label || ''
    };
    return {
        success: true,
        enabled: !!enabled,
        start: safeStart,
        end: safeEnd,
        direction: meta.direction || 'unknown',
        marker: meta.marker || null,
        startMarker: meta.startMarker || null,
        endMarker: meta.endMarker || null
    };
}

export function getLastExtensionInfo() {
    return lastExtensionInfo ? { ...lastExtensionInfo } : null;
}

export function getMarkerCount() {
    return getSortedMarkers().length;
}

function markerLabel(m) {
    if (!m) return 'none';
    const name = m.name || 'marker';
    return `${name} @ ${m.position.toFixed(2)}s`;
}

// --- Actions ---

export function extendLoopToNextMarker() {
    const region = readLoopRegion();
    const next = getNextMarker(region.end);
    if (!next) {
        localAppServices.showNotification?.('No timeline marker after current loop end', 1800);
        return { success: false, message: 'No timeline marker after current loop end' };
    }
    const result = writeLoopRegion(true, region.start, next.position, `Loop → next marker (${markerLabel(next)})`, { direction: 'next', marker: next });
    localAppServices.showNotification?.(`Loop end extended to marker "${next.name}" at ${next.position.toFixed(2)}s`, 2200);
    console.log(`[LoopUntilMarker] Loop end → next marker "${next.name}" at ${next.position}s`);
    return result;
}

export function extendLoopToPreviousMarker() {
    const region = readLoopRegion();
    const prev = getPreviousMarker(region.start);
    if (!prev) {
        localAppServices.showNotification?.('No timeline marker before current loop start', 1800);
        return { success: false, message: 'No timeline marker before current loop start' };
    }
    const result = writeLoopRegion(true, prev.position, region.end, `Loop ← previous marker (${markerLabel(prev)})`, { direction: 'previous', marker: prev });
    localAppServices.showNotification?.(`Loop start extended to marker "${prev.name}" at ${prev.position.toFixed(2)}s`, 2200);
    console.log(`[LoopUntilMarker] Loop start ← previous marker "${prev.name}" at ${prev.position}s`);
    return result;
}

export function extendLoopToBothMarkers() {
    const region = readLoopRegion();
    const prev = getPreviousMarker(region.start);
    const next = getNextMarker(region.end);
    if (!prev && !next) {
        localAppServices.showNotification?.('No surrounding markers to extend to', 1800);
        return { success: false, message: 'No markers surround the current loop region' };
    }
    const start = prev ? prev.position : region.start;
    const end = next ? next.position : region.end;
    const labelParts = [];
    if (prev) labelParts.push(`← ${markerLabel(prev)}`);
    if (next) labelParts.push(`→ ${markerLabel(next)}`);
    const result = writeLoopRegion(true, start, end, `Loop both markers ${labelParts.join(' ')}`, { direction: 'both', startMarker: prev || null, endMarker: next || null });
    localAppServices.showNotification?.(`Loop: ${start.toFixed(2)}s – ${end.toFixed(2)}s (${labelParts.join(' ')})`, 2400);
    console.log(`[LoopUntilMarker] Loop both markers: ${start}s – ${end}s`);
    return result;
}

// --- Auto-mode watcher ---

function getCurrentPlayheadTime() {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.seconds !== undefined) {
            return Tone.Transport.seconds;
        }
    } catch (e) { /* fall through */ }
    if (localAppServices.getCurrentTime) {
        try { return localAppServices.getCurrentTime(); } catch (e) { /* fall through */ }
    }
    return 0;
}

function isPlaying() {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.state) {
            return Tone.Transport.state === 'started';
        }
    } catch (e) { /* fall through */ }
    return false;
}

function startAutoLoopWatcher() {
    if (rafHandle !== null) return;
    const tick = () => {
        if (!isAutoEnabled) { rafHandle = null; return; }
        try { autoTick(); } catch (e) { console.warn('[LoopUntilMarker] autoTick error:', e); }
        rafHandle = requestAnimationFrame(tick);
    };
    rafHandle = requestAnimationFrame(tick);
}

function stopAutoLoopWatcher() {
    if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
    }
    lastCheckedTime = -1;
}

function autoTick() {
    const region = readLoopRegion();
    if (!region.enabled) { lastCheckedTime = -1; return; }
    if (!isPlaying()) { lastCheckedTime = -1; return; }
    const now = getCurrentPlayheadTime();
    // Edge-trigger: only react when the playhead has just crossed past the loop end.
    if (lastCheckedTime >= 0 && lastCheckedTime <= region.end && now > region.end + 0.05) {
        const next = getNextMarker(region.end);
        if (next) {
            writeLoopRegion(true, region.start, next.position, `Auto loop → marker (${markerLabel(next)})`, { direction: 'next', marker: next });
            console.log(`[LoopUntilMarker] Auto-extended loop end to marker "${next.name}" at ${next.position}s`);
        }
    }
    lastCheckedTime = now;
}

// --- Panel ---

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .lum-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(15,23,42,0.6); }
        .lum-row + .lum-row { margin-top: 6px; }
        .lum-btn { padding: 6px 10px; background: #1d4ed8; color: white; font-size: 12px; font-weight: 600; border-radius: 4px; cursor: pointer; border: none; }
        .lum-btn:hover { background: #2563eb; }
        .lum-btn-secondary { background: #475569; }
        .lum-btn-secondary:hover { background: #64748b; }
        .lum-btn-toggle.on { background: #16a34a; }
        .lum-btn-toggle.off { background: #475569; }
        .lum-stat { font-size: 11px; color: #94a3b8; }
        .lum-marker-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 6px; font-size: 11px; border-radius: 3px; background: rgba(30,41,59,0.7); }
        .lum-marker-row + .lum-marker-row { margin-top: 3px; }
        .lum-marker-name { color: #fbbf24; font-weight: 600; }
    `;
    document.head.appendChild(style);
}

function renderPanel(container) {
    ensureStyles();
    const region = readLoopRegion();
    const markers = getSortedMarkers();
    const next = getNextMarker(region.end);
    const prev = getPreviousMarker(region.start);

    container.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900 text-white overflow-hidden';
    container.innerHTML = `
        <div class="mb-3">
            <h3 class="text-lg font-bold mb-1">Loop Until Marker</h3>
            <p class="text-xs text-gray-400">Extend the loop region to the next / previous timeline marker. Markers come from the canonical Timeline Markers state store.</p>
        </div>

        <div class="lum-row">
            <button id="lumBtnNext" class="lum-btn">Next Marker →</button>
            <span class="lum-stat" id="lumStatNext">${next ? markerLabel(next) : 'no marker after loop end'}</span>
        </div>
        <div class="lum-row">
            <button id="lumBtnPrev" class="lum-btn lum-btn-secondary">← Previous Marker</button>
            <span class="lum-stat" id="lumStatPrev">${prev ? markerLabel(prev) : 'no marker before loop start'}</span>
        </div>
        <div class="lum-row">
            <button id="lumBtnBoth" class="lum-btn lum-btn-secondary">Both Sides</button>
            <span class="lum-stat">${prev || next ? `${prev ? '← ' + markerLabel(prev) : ''}${prev && next ? ' / ' : ''}${next ? '→ ' + markerLabel(next) : ''}` : 'no surrounding markers'}</span>
        </div>
        <div class="lum-row">
            <button id="lumBtnAuto" class="lum-btn lum-btn-toggle ${isAutoEnabled ? 'on' : 'off'}">Auto: ${isAutoEnabled ? 'ON' : 'OFF'}</button>
            <span class="lum-stat">When playing and the playhead exits the loop, auto-extend the end to the next marker.</span>
        </div>

        <div class="mt-3 mb-1 flex items-center justify-between">
            <div class="text-xs text-gray-300 font-semibold">Timeline Markers (${markers.length})</div>
            <div class="lum-stat">Current loop: ${region.start.toFixed(2)}s – ${region.end.toFixed(2)}s${region.enabled ? '' : ' (off)'}</div>
        </div>
        <div id="lumMarkerList" class="flex-1 overflow-y-auto pr-1">
            ${markers.length === 0 ? '<p class="text-xs text-gray-500 italic">No timeline markers. Add some via Timeline Markers panel.</p>' : markers.map(m => `
                <div class="lum-marker-row">
                    <span class="lum-marker-name">${escapeHtml(m.name || 'marker')}</span>
                    <span class="lum-stat">${m.position.toFixed(2)}s</span>
                </div>
            `).join('')}
        </div>
    `;

    container.querySelector('#lumBtnNext').onclick = () => { extendLoopToNextMarker(); renderPanel(container); };
    container.querySelector('#lumBtnPrev').onclick = () => { extendLoopToPreviousMarker(); renderPanel(container); };
    container.querySelector('#lumBtnBoth').onclick = () => { extendLoopToBothMarkers(); renderPanel(container); };
    container.querySelector('#lumBtnAuto').onclick = () => { setLoopUntilMarkerAutoEnabled(!isAutoEnabled); renderPanel(container); };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

export function openLoopUntilMarkerPanel() {
    if (!localAppServices.createWindow) {
        console.warn('[LoopUntilMarker] createWindow not available');
        return null;
    }
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(PANEL_ID)) {
        const existing = openWindows.get(PANEL_ID);
        if (existing.restore) existing.restore();
        return existing;
    }
    const content = document.createElement('div');
    content.id = 'loopUntilMarkerContent';
    const win = localAppServices.createWindow(PANEL_ID, 'Loop Until Marker', content, {
        width: 380,
        height: 480,
        minWidth: 320,
        minHeight: 360,
        closable: true,
        minimizable: true,
        resizable: true
    });
    if (!win) return null;
    setTimeout(() => renderPanel(content), 50);
    // Auto-restore handler: re-render content if window is restored from minimized.
    if (win && win.onRestore) {
        const prev = win.onRestore;
        win.onRestore = () => { try { if (prev) prev(); } catch (e) {} renderPanel(content); };
    }
    return win;
}

if (typeof window !== 'undefined') {
    window.openLoopUntilMarkerPanel = openLoopUntilMarkerPanel;
    window.setLoopUntilMarkerAutoEnabled = setLoopUntilMarkerAutoEnabled;
    window.extendLoopToNextMarker = extendLoopToNextMarker;
    window.extendLoopToPreviousMarker = extendLoopToPreviousMarker;
    window.extendLoopToBothMarkers = extendLoopToBothMarkers;
}
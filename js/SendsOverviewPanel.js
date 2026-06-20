// js/SendsOverviewPanel.js - Visual matrix of send levels from every track to every send bus
//
// Renders a dockable panel containing a grid where rows are tracks and columns are
// send buses (Reverb, Delay, …). Each cell shows the current send level (0..1) as a
// horizontal bar plus an editable numeric input (0..100%). Edits call
// setTrackSendLevel(trackId, busId, level) and immediately re-render the affected
// cell. A "Zero All" button clears all sends; "Set All to 50%" and "Set All to 25%"
// presets provide a uniform starting point. A "return %" subheader above each
// column shows the current bus return level for context. Re-renders cheaply when
// the user clicks "Refresh" or after any edit.

import { getTracksState } from './state.js';

const SENDS_OVERVIEW_VERSION = '0.1.0';

let localAppServices = {};
let isPanelOpen = false;
let _panelWindow = null;
let _refreshTimer = null;

const PANEL_ID = 'sendsOverview';
const PANEL_TITLE = 'Sends Overview';
const REFRESH_DEBOUNCE_MS = 200;

export function initSendsOverviewPanel(services) {
    localAppServices = services || {};
    console.log(`[SendsOverview v${SENDS_OVERVIEW_VERSION}] Initialized`);
}

export function isSendsOverviewPanelActive() {
    return isPanelOpen;
}

export function getSendsOverviewVersion() {
    return SENDS_OVERVIEW_VERSION;
}

function safeGet(fnName) {
    const fn = localAppServices && localAppServices[fnName];
    return typeof fn === 'function' ? fn : null;
}

function getBusesSafe() {
    const fn = safeGet('getSendBusesInfo');
    if (fn) {
        try {
            const info = fn();
            if (Array.isArray(info) && info.length) return info;
        } catch (e) { /* fall through */ }
    }
    return [
        { id: 'reverb', name: 'Reverb', hasEffect: true },
        { id: 'delay', name: 'Delay', hasEffect: true }
    ];
}

function getSendLevelSafe(trackId, busId) {
    const fn = safeGet('getTrackSendLevel');
    if (fn) {
        try {
            const v = fn(trackId, busId);
            if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(1, v));
        } catch (e) { /* fall through */ }
    }
    return 0;
}

function setSendLevelSafe(trackId, busId, level) {
    const fn = safeGet('setTrackSendLevel');
    if (fn) {
        try { fn(trackId, busId, level); return true; } catch (e) { /* fall through */ }
    }
    return false;
}

function getReturnLevelSafe(busId) {
    const fn = safeGet('getSendBusReturnLevel');
    if (fn) {
        try {
            const v = fn(busId);
            if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(1, v));
        } catch (e) { /* fall through */ }
    }
    return 0.5;
}

function getTracksSafe() {
    try {
        const tracks = getTracksState() || [];
        return tracks.filter(t => t && typeof t === 'object' && t.id != null);
    } catch (e) {
        return [];
    }
}

function levelToPercent(level) {
    return Math.round(Math.max(0, Math.min(1, level)) * 100);
}

function percentToLevel(percent) {
    const p = Number(percent);
    if (!isFinite(p)) return 0;
    return Math.max(0, Math.min(1, p / 100));
}

function levelColorClass(level) {
    if (level <= 0) return 'bg-slate-700';
    if (level < 0.25) return 'bg-sky-700';
    if (level < 0.5) return 'bg-cyan-600';
    if (level < 0.75) return 'bg-teal-500';
    return 'bg-emerald-400';
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateCellVisual(cellEl, level) {
    const bar = cellEl.querySelector('.sends-bar > div');
    if (bar) {
        bar.style.width = `${levelToPercent(level)}%`;
        // Swap color class based on new level
        bar.className = bar.className.replace(/bg-(slate|sky|cyan|teal|emerald)-?\d*0?/g, '').trim() + ' ' + levelColorClass(level);
    }
    const input = cellEl.querySelector('.sends-input');
    if (input && document.activeElement !== input) {
        input.value = String(levelToPercent(level));
    }
    const barWrap = cellEl.querySelector('.sends-bar');
    if (barWrap) barWrap.title = `Drag to set send level (${levelToPercent(level)}%)`;
}

function renderPanelBody(container) {
    const tracks = getTracksSafe();
    const buses = getBusesSafe();
    const showEmpty = tracks.length === 0;

    const headerCells = buses.map(bus => {
        const retPct = levelToPercent(getReturnLevelSafe(bus.id));
        const retTitle = `Bus return: ${retPct}%`;
        return `
            <th class="px-2 py-1 text-left border-b border-slate-700 align-bottom">
                <div class="text-[11px] font-semibold text-slate-200">${escapeHtml(bus.name)}</div>
                <div class="text-[9px] text-slate-500 mt-0.5" title="${retTitle}">return ${retPct}%</div>
            </th>`;
    }).join('');

    const bodyRows = showEmpty
        ? `<tr><td colspan="${Math.max(1, buses.length) + 1}" class="px-2 py-6 text-center text-slate-500 text-xs">No tracks yet. Add a track to see its send levels here.</td></tr>`
        : tracks.map(track => {
            const name = (track && track.name) ? String(track.name) : `Track ${track.id}`;
            const cells = buses.map(bus => {
                const level = getSendLevelSafe(track.id, bus.id);
                const pct = levelToPercent(level);
                const barColor = levelColorClass(level);
                return `
                    <td class="px-2 py-1 align-middle">
                        <div class="flex items-center gap-1.5 sends-cell" data-track-id="${track.id}" data-bus-id="${bus.id}">
                            <div class="flex-1 h-3 bg-slate-900 rounded overflow-hidden border border-slate-700 cursor-pointer sends-bar" title="Drag to set send level (${pct}%)">
                                <div class="h-full ${barColor} transition-all" style="width: ${pct}%"></div>
                            </div>
                            <input type="number" min="0" max="100" step="1" value="${pct}"
                                class="w-12 text-[10px] text-right bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-200 font-mono sends-input"
                                data-track-id="${track.id}" data-bus-id="${bus.id}" />
                        </div>
                    </td>`;
            }).join('');
            return `
                <tr class="hover:bg-slate-900/40">
                    <td class="px-2 py-1 text-slate-300 text-[11px] border-b border-slate-800 sticky left-0 bg-gray-950">
                        <div class="font-medium truncate max-w-[140px]" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                        <div class="text-[9px] text-slate-600">id ${track.id}</div>
                    </td>
                    ${cells}
                </tr>`;
        }).join('');

    container.innerHTML = `
        <div class="p-3 bg-gray-950 text-white h-full flex flex-col gap-2 overflow-hidden">
            <div class="flex items-center justify-between flex-shrink-0">
                <h3 class="text-sm font-semibold">Sends Overview</h3>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-slate-500">${tracks.length} track${tracks.length === 1 ? '' : 's'} × ${buses.length} bus${buses.length === 1 ? '' : 'es'}</span>
                    <span class="text-[10px] text-slate-500">v${SENDS_OVERVIEW_VERSION}</span>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                <button id="sends-zero-all" class="px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Set all send levels to 0%">Zero All</button>
                <button id="sends-half-all" class="px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Set all send levels to 50%">Set All 50%</button>
                <button id="sends-quarter-all" class="px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Set all send levels to 25%">Set All 25%</button>
                <button id="sends-refresh" class="px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Re-read all send levels">Refresh</button>
            </div>
            <div class="flex-1 overflow-auto border border-slate-800 rounded">
                <table class="w-full text-left border-collapse sends-matrix">
                    <thead class="bg-slate-900 sticky top-0 z-10">
                        <tr>
                            <th class="px-2 py-1 text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-700 sticky left-0 bg-slate-900">Track</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
            <p class="text-[10px] text-slate-500 leading-relaxed flex-shrink-0">
                Click a bar to scrub the level (left=0%, right=100%). Type a value 0–100 into the numeric input
                to set the send level for that track → bus. "return" above each column shows the bus's master return level.
            </p>
        </div>`;

    wirePanelEvents(container, tracks, buses);
}

function applyBulkLevel(targetPercent, container) {
    const tracks = getTracksSafe();
    const buses = getBusesSafe();
    const level = percentToLevel(targetPercent);
    let changed = 0;
    for (const track of tracks) {
        for (const bus of buses) {
            if (setSendLevelSafe(track.id, bus.id, level)) changed += 1;
        }
    }
    // Update the visible cells without a full re-render
    const cells = container.querySelectorAll('.sends-cell');
    cells.forEach(cell => {
        const newLevel = percentToLevel(targetPercent);
        updateCellVisual(cell, newLevel);
    });
    const showNote = localAppServices && typeof localAppServices.showNotification === 'function';
    if (showNote) {
        localAppServices.showNotification(
            `Sends: set ${changed} cell${changed === 1 ? '' : 's'} to ${targetPercent}%`,
            1500
        );
    }
}

function setLevelFromBarDrag(barWrap, cellEl, clientX) {
    const rect = barWrap.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    const level = percentToLevel(pct);
    const trackId = cellEl.getAttribute('data-track-id');
    const busId = cellEl.getAttribute('data-bus-id');
    const trackIdNum = Number(trackId);
    if (setSendLevelSafe(trackIdNum, busId, level)) {
        updateCellVisual(cellEl, level);
    }
}

function wirePanelEvents(container, tracks, buses) {
    // Numeric input change
    container.querySelectorAll('.sends-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const tEl = e.target;
            const trackId = Number(tEl.getAttribute('data-track-id'));
            const busId = tEl.getAttribute('data-bus-id');
            const level = percentToLevel(tEl.value);
            if (setSendLevelSafe(trackId, busId, level)) {
                const cell = tEl.closest('.sends-cell');
                if (cell) updateCellVisual(cell, level);
            }
        });
        input.addEventListener('input', (e) => {
            // Live update on input (without commit) so the bar follows the typing
            const tEl = e.target;
            const level = percentToLevel(tEl.value);
            const cell = tEl.closest('.sends-cell');
            if (cell) {
                const bar = cell.querySelector('.sends-bar > div');
                if (bar) {
                    bar.style.width = `${levelToPercent(level)}%`;
                    bar.className = bar.className.replace(/bg-(slate|sky|cyan|teal|emerald)-?\d*0?/g, '').trim() + ' ' + levelColorClass(level);
                }
            }
        });
    });

    // Bar drag-to-set
    let dragging = false;
    container.querySelectorAll('.sends-bar').forEach(bar => {
        const handlePointer = (clientX) => {
            const cell = bar.closest('.sends-cell');
            if (cell) setLevelFromBarDrag(bar, cell, clientX);
        };
        bar.addEventListener('pointerdown', (e) => {
            dragging = true;
            bar.setPointerCapture && bar.setPointerCapture(e.pointerId);
            handlePointer(e.clientX);
        });
        bar.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            handlePointer(e.clientX);
        });
        bar.addEventListener('pointerup', (e) => {
            dragging = false;
            try { bar.releasePointerCapture && bar.releasePointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
        });
        bar.addEventListener('pointercancel', () => { dragging = false; });
        bar.addEventListener('click', (e) => {
            if (dragging) return;
            handlePointer(e.clientX);
        });
    });

    // Bulk action buttons
    const zeroBtn = container.querySelector('#sends-zero-all');
    if (zeroBtn) zeroBtn.addEventListener('click', () => applyBulkLevel(0, container));
    const halfBtn = container.querySelector('#sends-half-all');
    if (halfBtn) halfBtn.addEventListener('click', () => applyBulkLevel(50, container));
    const quarterBtn = container.querySelector('#sends-quarter-all');
    if (quarterBtn) quarterBtn.addEventListener('click', () => applyBulkLevel(25, container));
    const refreshBtn = container.querySelector('#sends-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => renderPanelBody(container));
}

export function openSendsOverviewPanel() {
    if (!localAppServices || typeof localAppServices.createWindow !== 'function') {
        console.warn('[SendsOverview] appServices.createWindow is not available');
        return null;
    }

    // If already open, restore + re-render and exit
    if (typeof localAppServices.getOpenWindows === 'function') {
        const openWindows = localAppServices.getOpenWindows();
        const existing = openWindows && openWindows.get && openWindows.get(PANEL_ID);
        if (existing) {
            if (existing.restore) existing.restore();
            const container = existing.element && existing.element.querySelector('#sendsOverviewContent');
            if (container) renderPanelBody(container);
            _panelWindow = existing;
            isPanelOpen = true;
            return existing;
        }
    }

    const container = document.createElement('div');
    container.id = 'sendsOverviewContent';
    container.className = 'h-full';
    renderPanelBody(container);

    const win = localAppServices.createWindow(
        PANEL_ID,
        PANEL_TITLE,
        container,
        {
            width: 560,
            height: 420,
            minWidth: 360,
            minHeight: 280,
            closable: true,
            minimizable: true,
            resizable: true,
            initialContentKey: PANEL_ID
        }
    );

    if (win) {
        _panelWindow = win;
        isPanelOpen = true;

        // Wrap close so isPanelOpen flips to false
        const origClose = win.close;
        win.close = function () {
            isPanelOpen = false;
            if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
            _panelWindow = null;
            return origClose ? origClose.apply(this, arguments) : undefined;
        };
    }
    return win;
}

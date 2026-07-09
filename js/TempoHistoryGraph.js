// js/TempoHistoryGraph.js - Project Tempo History Graph (v0.3.95)
//
// Tracks every tempo change (mutations of Tone.Transport.bpm.value) the user
// makes during a session and renders a small SVG sparkline of the last
// changes in the status bar. Click the sparkline to open a popover with a
// text-list view of the last 16 tempo changes (newest first, with relative
// age labels and a "Restore" button that rewinds the project's tempo to
// that point — useful when the user accidentally tapped-tempo into a
// wrong BPM and wants to go back to what they had a minute ago).
//
// Tone.js does not emit a tempo-change event, so we poll the live
// Tone.Transport.bpm.value once per POLL_INTERVAL_MS (the same cadence
// AutoSaveCounter uses). We only push to history when the value actually
// changes (filtered by EPSILON_BPM to suppress sub-cent float noise),
// and we de-duplicate consecutive identical values.
//
// History is in-memory only — it intentionally does NOT persist across
// reloads. The project's current tempo persists via state.js, but the
// running list of "where did this BPM come from?" is a per-session
// concern. This matches the user mental model: "show me the tempo
// changes I made this session".

let localAppServices = {};
let pollHandle = null;
let lastSeenBpm = null;

// History buffer. Each entry: { bpm: number, time: number (epoch ms), source: string }
const MAX_HISTORY = 64;
const DISPLAY_HISTORY = 16;
const POLL_INTERVAL_MS = 1000;
const EPSILON_BPM = 0.05;          // ignore sub-cent rounding noise

// DOM refs (filled in createStatusElement / createPopoverElement).
let statusEl = null;
let sparkEl = null;
let summaryEl = null;
let popoverEl = null;
let popoverListEl = null;
let popoverEmptyEl = null;
let popoverClearBtn = null;
let isPopoverOpen = false;
let popoverCountEl = null;
let popoverCountCapEl = null;

// Newest-first snapshot of the history slice that the popover is
// currently rendering. We need this so `refreshAges()` (called every
// poll tick while the popover is open) can walk the rendered rows in
// the same order they appear in the DOM and update only the per-row
// age span — without re-running `renderPopoverList()` (which would
// throw away the user's hover state and any in-progress button focus).
// Same pattern as `MIDIActivityLog.js:refreshAges` (Day 759 Run 3 fix
// for the same bug class — see that module for the full rationale).
let lastRenderedPopover = [];

const history = [];   // newest at the end of the array

function readCurrentBpm() {
    try {
        if (typeof window === 'undefined') return null;
        if (!window.Tone || !window.Tone.Transport || !window.Tone.Transport.bpm) return null;
        const v = window.Tone.Transport.bpm.value;
        if (typeof v === 'number' && isFinite(v) && v > 0) return v;
    } catch (_) { /* fall through */ }
    return null;
}

function pushHistory(bpm, source) {
    // De-dupe: if the most recent entry is within EPSILON of bpm, skip.
    // (Shouldn't happen because we already gate on `!floatsEqual`, but
    // belt-and-suspenders against any future caller passing the same
    // value twice.)
    if (history.length > 0) {
        const last = history[history.length - 1];
        if (Math.abs(last.bpm - bpm) < EPSILON_BPM) return;
    }
    history.push({ bpm, time: Date.now(), source: source || 'change' });
    // Cap the buffer.
    while (history.length > MAX_HISTORY) {
        history.shift();
    }
    renderSummary();
    renderSparkline();
    renderPopoverList();
}

function popHistory() {
    if (history.length === 0) return null;
    return history.pop();
}

function clearHistory() {
    history.length = 0;
    renderSummary();
    renderSparkline();
    renderPopoverList();
}

function restoreAt(idx) {
    // idx is 0-based, where 0 = most recent change, length-1 = oldest.
    if (idx < 0 || idx >= history.length) return;
    // Newest-first index → history[length-1-idx]
    const arrIdx = history.length - 1 - idx;
    const entry = history[arrIdx];
    if (!entry) return;
    const bpm = entry.bpm;
    if (typeof localAppServices.captureStateForUndo === 'function') {
        try {
            localAppServices.captureStateForUndo(`Restore tempo to ${bpm.toFixed(1)} BPM (from history)`);
        } catch (_) { /* non-fatal */ }
    }
    try {
        if (window.Tone && window.Tone.Transport && window.Tone.Transport.bpm) {
            window.Tone.Transport.bpm.value = bpm;
        }
    } catch (e) {
        console.warn('[TempoHistoryGraph] restore failed:', e);
        return;
    }
    if (typeof localAppServices.updateTaskbarTempoDisplay === 'function') {
        try { localAppServices.updateTaskbarTempoDisplay(bpm); } catch (_) { /* non-fatal */ }
    }
    // Push a new history entry marked as 'restore' so the user can see what happened.
    pushHistory(bpm, 'restore');
    notify(`Tempo restored to ${bpm.toFixed(1)} BPM`);
}

function notify(msg) {
    const fn = (typeof localAppServices.showSafeNotification === 'function')
        ? localAppServices.showSafeNotification
        : localAppServices.showNotification;
    if (typeof fn === 'function') {
        try { fn(msg, 1800); } catch (_) { /* non-fatal */ }
    }
}

function formatAge(ts) {
    const ageSec = Math.max(0, (Date.now() - ts) / 1000);
    if (ageSec < 1) return 'now';
    if (ageSec < 60) return `${ageSec.toFixed(0)}s`;
    if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m`;
    return `${Math.floor(ageSec / 3600)}h`;
}

function formatSource(source) {
    switch (source) {
        case 'restore': return 'restore';
        case 'tap':     return 'tap';
        case 'nudge':   return 'nudge';
        case 'preset':  return 'preset';
        case 'project': return 'load';
        case 'change':
        default:        return 'change';
    }
}

/* ----------------- rendering ----------------- */

function renderSummary() {
    if (!summaryEl) return;
    if (history.length === 0) {
        summaryEl.textContent = '0';
        summaryEl.title = 'Tempo change history (this session) — click to expand';
    } else {
        summaryEl.textContent = String(history.length);
        summaryEl.title = `Tempo change history: ${history.length} change${history.length !== 1 ? 's' : ''} this session — click to expand`;
    }
    // Mirror count into the popover header so it stays in sync even when
    // the popover is closed and a renderPopoverList wouldn't be triggered.
    if (popoverCountEl) {
        popoverCountEl.textContent = String(Math.min(history.length, DISPLAY_HISTORY));
    }
    if (popoverCountCapEl) {
        popoverCountCapEl.textContent = history.length > DISPLAY_HISTORY ? `/${MAX_HISTORY}` : '';
    }
}

function renderSparkline() {
    if (!sparkEl) return;
    // Use the last DISPLAY_HISTORY samples (matches the popover length so
    // the sparkline and the popover are visually correlated).
    const samples = history.slice(-DISPLAY_HISTORY);
    if (samples.length === 0) {
        // Empty state: a single dim baseline bar so the slot has some
        // visible affordance. Otherwise the user wouldn't see a clickable
        // target at all and would assume the feature wasn't there.
        sparkEl.innerHTML = `<svg width="80" height="14" viewBox="0 0 80 14" preserveAspectRatio="none" class="block">
            <line x1="0" y1="13" x2="80" y2="13" stroke="#3a3a3a" stroke-width="1"/>
        </svg>`;
        return;
    }
    // Compute y-range with a small pad.
    let minBpm = Infinity, maxBpm = -Infinity;
    for (const s of samples) {
        if (s.bpm < minBpm) minBpm = s.bpm;
        if (s.bpm > maxBpm) maxBpm = s.bpm;
    }
    if (!isFinite(minBpm) || !isFinite(maxBpm)) return;
    if (maxBpm - minBpm < 1) {
        // Flat-line: show a centered line.
        const midY = 7;
        sparkEl.innerHTML = `<svg width="80" height="14" viewBox="0 0 80 14" preserveAspectRatio="none" class="block">
            <line x1="0" y1="${midY}" x2="80" y2="${midY}" stroke="#10b981" stroke-width="1.5"/>
        </svg>`;
        return;
    }
    const padY = 2;
    const usableH = 14 - padY * 2;
    const W = 80, H = 14;
    const stepX = samples.length > 1 ? W / (samples.length - 1) : 0;
    const points = samples.map((s, i) => {
        const x = samples.length > 1 ? (i * stepX) : (W / 2);
        const yNorm = (s.bpm - minBpm) / (maxBpm - minBpm);
        const y = H - padY - yNorm * usableH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const polyline = points.join(' ');
    // Polyline: tempo curve. A subtle baseline at the bottom for context.
    sparkEl.innerHTML = `<svg width="80" height="14" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="block">
        <line x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}" stroke="#2a2a2a" stroke-width="0.5"/>
        <polyline points="${polyline}" fill="none" stroke="#10b981" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
    // Also update the tooltip to show the BPM range we just rendered.
    if (statusEl) {
        const first = samples[0].bpm;
        const last = samples[samples.length - 1].bpm;
        const delta = last - first;
        const arrow = delta > 0 ? '↑' : (delta < 0 ? '↓' : '→');
        const deltaAbs = Math.abs(delta).toFixed(1);
        statusEl.title = `Tempo history: ${minBpm.toFixed(1)}–${maxBpm.toFixed(1)} BPM (last ${samples.length}) — net ${arrow}${deltaAbs} BPM`;
    }
}

function renderPopoverList() {
    if (!popoverListEl || !popoverEmptyEl) return;
    // Newest first; cap at DISPLAY_HISTORY for the popover.
    const recent = history.slice(-DISPLAY_HISTORY).slice().reverse();
    if (recent.length === 0) {
        popoverListEl.innerHTML = '';
        popoverEmptyEl.style.display = '';
        return;
    }
    popoverEmptyEl.style.display = 'none';
    const rows = recent.map((entry, i) => {
        const age = formatAge(entry.time);
        const bpmStr = entry.bpm.toFixed(1);
        const source = formatSource(entry.source);
        // i=0 is the most recent. Use the same idx that restoreAt() expects.
        // Escape any user-derived content (defensive).
        const safeSource = source.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
        return `<div class="thg-row flex items-center justify-between gap-2 px-2 py-1 border-b border-[#1f1f2a] text-[10px]">
            <span class="text-gray-500 w-8 text-right font-mono">${age}</span>
            <span class="text-emerald-400 w-14 text-right font-mono">${bpmStr}</span>
            <span class="text-gray-500 flex-1 text-[9px] uppercase tracking-wider">${safeSource}</span>
            <button class="thg-restore-btn text-[9px] uppercase tracking-wider text-gray-400 hover:text-amber-300 px-1" data-idx="${i}">Restore</button>
        </div>`;
    }).join('');
    popoverListEl.innerHTML = rows;
    // Remember the slice we just rendered so refreshAges() can walk
    // the rendered rows in the same order on every tick.
    lastRenderedPopover = recent.slice();
    // Wire up the restore buttons (idempotent — we re-render the whole list
    // each time, so old listeners die with their rows).
    popoverListEl.querySelectorAll('.thg-restore-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const idx = parseInt(btn.dataset.idx, 10);
            if (Number.isFinite(idx)) {
                restoreAt(idx);
                setPopoverOpen(false);
            }
        });
    });
}

function setPopoverOpen(open) {
    isPopoverOpen = !!open;
    if (popoverEl) {
        if (isPopoverOpen) {
            popoverEl.classList.remove('hidden');
            popoverEl.style.display = 'flex';
        } else {
            popoverEl.style.display = 'none';
        }
    }
    if (statusEl) {
        statusEl.classList.toggle('thg-active', isPopoverOpen);
    }
    if (isPopoverOpen) {
        // Force a re-render so the age labels are fresh.
        renderPopoverList();
    }
}

function togglePopover() {
    setPopoverOpen(!isPopoverOpen);
}

function createStatusElement() {
    if (statusEl) return;
    const statusBar = document.getElementById('statusBar');
    if (!statusBar) {
        // Status bar not in DOM yet — retry shortly.
        setTimeout(createStatusElement, 100);
        return;
    }
    // Build the status-bar element: a small "Tempo:" label + summary
    // count + the sparkline. Sits just before the flex-1 spacer, next
    // to #statusMasterPeak. Mirrors the styling of the other status
    // cells (cursor: pointer, hover:text-gray-300, gap-1, text-xs).
    statusEl = document.createElement('div');
    statusEl.id = 'statusTempoHistory';
    statusEl.className = 'flex items-center gap-1 cursor-pointer hover:text-gray-300';
    statusEl.title = 'Tempo change history (this session) — click to expand';
    statusEl.innerHTML = `
        <span class="text-gray-500">Tempo:</span>
        <span id="statusTempoHistorySpark" class="inline-flex"></span>
        <span id="statusTempoHistorySummary" class="text-emerald-400">0</span>
    `;
    sparkEl = document.getElementById('statusTempoHistorySpark');
    summaryEl = document.getElementById('statusTempoHistorySummary');

    // Insert before the flex-1 spacer so the sparkline floats to the
    // right of the other status cells but the MIDI toggle and CPU
    // sparkline stay on the far right.
    const flexSpacer = Array.from(statusBar.children).find(el => el.classList && el.classList.contains('flex-1'));
    if (flexSpacer) {
        statusBar.insertBefore(statusEl, flexSpacer);
    } else {
        statusBar.appendChild(statusEl);
    }
    // Click toggles the popover. Use a closure to keep setPopoverOpen bound.
    statusEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePopover();
    });
}

function createPopoverElement() {
    if (popoverEl) return;
    // Build the popover. Positioned in the bottom-right area, above the
    // status bar. Width 220px, max-height ~280px. Same look-and-feel as
    // #midiActivityLogPanel so the new popover feels like a sibling.
    popoverEl = document.createElement('div');
    popoverEl.id = 'tempoHistoryPopover';
    popoverEl.className = 'hidden fixed right-2 bottom-8 w-[220px] bg-[#0d0d1a] border border-[#2a2a3a] rounded shadow-lg z-[9997] flex-col font-mono text-[10px] text-gray-300';
    popoverEl.style.display = 'none';
    popoverEl.innerHTML = `
        <div class="flex items-center justify-between px-2 py-1 border-b border-[#2a2a3a] bg-[#15151f]">
            <span class="text-emerald-400 uppercase tracking-widest text-[9px]">Tempo History</span>
            <div class="flex items-center gap-2">
                <span class="text-gray-500">last <span id="tempoHistoryCount" class="text-emerald-400">0</span><span id="tempoHistoryCountCap" class="text-gray-600"></span></span>
                <button id="tempoHistoryClear" class="text-gray-500 hover:text-red-400 text-[9px] uppercase">Clear</button>
            </div>
        </div>
        <div id="tempoHistoryList" class="overflow-y-auto max-h-[240px] py-1">
            <!-- Rows injected by renderPopoverList -->
        </div>
        <div id="tempoHistoryEmpty" class="px-3 py-4 text-center text-gray-500 italic">No tempo changes this session — set the BPM to start logging</div>
    `;
    document.body.appendChild(popoverEl);
    popoverListEl = document.getElementById('tempoHistoryList');
    popoverEmptyEl = document.getElementById('tempoHistoryEmpty');
    popoverClearBtn = document.getElementById('tempoHistoryClear');
    popoverCountEl = document.getElementById('tempoHistoryCount');
    popoverCountCapEl = document.getElementById('tempoHistoryCountCap');

    // Wire the clear button.
    if (popoverClearBtn) {
        popoverClearBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            clearHistory();
        });
    }

    // Outside-click closes the popover. Use mousedown so the click on a
    // Restore button inside the popover is captured before this fires.
    document.addEventListener('mousedown', (ev) => {
        if (!isPopoverOpen) return;
        const t = ev.target;
        if (popoverEl && popoverEl.contains(t)) return;
        if (statusEl && statusEl.contains(t)) return;
        setPopoverOpen(false);
    });
}

/**
 * Update only the per-row age spans in the popover without re-rendering
 * the rows. Called from the poll tick so age labels stay fresh ("now" →
 * "1s" → "2s" → ...) even when no new history entries arrive.
 *
 * Without this, the popover's age labels only update on the next
 * pushHistory() / clearHistory() / setPopoverOpen(true) call — so if
 * the user opens the popover, sits there for 30 seconds, and the tempo
 * doesn't change, the labels stay frozen at "now" / "5s" / "12s" and
 * look like a bug. This mirrors MIDIActivityLog.refreshAges (the
 * v0.3.88 stale-timestamp fix for the same bug class).
 */
function refreshAges() {
    if (!popoverListEl || !isPopoverOpen) return;
    if (lastRenderedPopover.length === 0) return;
    const rows = popoverListEl.querySelectorAll('.thg-row');
    if (rows.length === 0) return;
    rows.forEach((row, idx) => {
        const entry = lastRenderedPopover[idx];
        if (!entry) return;
        // First <span> in the row is the age label (matches the order
        // we emit in renderPopoverList: age, bpm, source, button).
        const ageEl = row.children[0];
        if (ageEl) ageEl.textContent = formatAge(entry.time);
    });
}

function poll() {
    if (pollHandle === null) return;
    try {
        const cur = readCurrentBpm();
        if (cur !== null && (lastSeenBpm === null || Math.abs(cur - lastSeenBpm) >= EPSILON_BPM)) {
            // First reading or change. If it's the first reading, treat
            // it as the "project load" entry so the user can see the
            // baseline in the history. If it's a subsequent change, treat
            // it as a regular user-driven change.
            const source = (lastSeenBpm === null) ? 'project' : 'change';
            lastSeenBpm = cur;
            pushHistory(cur, source);
        }
    } catch (e) {
        console.warn('[TempoHistoryGraph] poll error:', e);
    }
    if (isPopoverOpen) refreshAges();
    pollHandle = setTimeout(poll, POLL_INTERVAL_MS);
}

function startPolling() {
    if (pollHandle !== null) return;
    pollHandle = setTimeout(poll, POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollHandle !== null) {
        clearTimeout(pollHandle);
        pollHandle = null;
    }
}

/**
 * Init: wires the status-bar element, the popover, and starts polling
 * Tone.Transport.bpm.value. Safe to call once at startup.
 *
 * @param {object} appServices - the shared services bag
 */
export function initTempoHistoryGraph(appServices) {
    localAppServices = appServices || {};
    createStatusElement();
    createPopoverElement();
    startPolling();
    console.log('[TempoHistoryGraph] Initialized');
}

/**
 * Public: force a history snapshot of the current tempo. Mostly useful
 * for tests, but a no-op safety net if the polling missed a change (e.g.
 * the user changed BPM via a path that bypasses the polling cadence).
 */
export function recordCurrentTempo(source = 'manual') {
    const cur = readCurrentBpm();
    if (cur === null) return;
    if (lastSeenBpm !== null && Math.abs(cur - lastSeenBpm) < EPSILON_BPM) return;
    lastSeenBpm = cur;
    pushHistory(cur, source);
}

/**
 * Public: get a copy of the current history (newest at the end).
 * Mostly useful for tests.
 */
export function getTempoHistory() {
    return history.slice();
}

/**
 * Public: pop the most recent history entry. Mostly useful for tests
 * and for a future "undo" integration.
 */
export function popLastTempoHistoryEntry() {
    return popHistory();
}

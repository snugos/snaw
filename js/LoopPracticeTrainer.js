// js/LoopPracticeTrainer.js - Loop Practice Trainer feature
// Track loop iterations, time each loop, and keep best/avg time-to-nail stats
// for the currently active loop region. Persists per-region bests in localStorage.

let localAppServices = {};
let isEnabled = false;
let isPanelOpen = false;
let isRunning = false;

// State function references (injected by main.js)
let getLoopRegionEnabledState = null;
let getLoopRegionStartState = null;
let getLoopRegionEndState = null;

// Per-session stats
let session = {
    startedAt: 0,
    loopCount: 0,
    lastLoopStartTime: 0,
    bestMs: Infinity,
    sumMs: 0,
    times: [],          // all loop completion times in ms
    history: [],        // {iteration, ms} entries
};

// Per-region bests: { "<start>-<end>": { bestMs, count, updatedAt } }
const STORAGE_KEY = 'snaw_practice_bests_v1';
let regionBests = loadRegionBests();

const PANEL_ID = 'loopPracticeTrainerContent';
const WINDOW_ID = 'loopPracticeTrainer';
const MAX_TIMES = 50;        // keep last N times in memory
const MAX_HISTORY = 100;     // max history rows in panel

function loadRegionBests() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.warn('[LoopPracticeTrainer] Failed to load bests:', e);
        return {};
    }
}

function saveRegionBests() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(regionBests));
    } catch (e) {
        console.warn('[LoopPracticeTrainer] Failed to save bests:', e);
    }
}

function regionKey(start, end) {
    return `${start.toFixed(3)}-${end.toFixed(3)}`;
}

export function initLoopPracticeTrainer(services) {
    localAppServices = services || {};
    console.log('[LoopPracticeTrainer] Initialized');
}

export function initLoopPracticeTrainerStateReferences(getEnabledFn, getStartFn, getEndFn) {
    getLoopRegionEnabledState = getEnabledFn;
    getLoopRegionStartState = getStartFn;
    getLoopRegionEndState = getEndFn;
    console.log('[LoopPracticeTrainer] State references initialized');
}

export function setLoopPracticeTrainerEnabled(enabled) {
    isEnabled = !!enabled;
    if (!isEnabled) {
        stopSession(false);
    } else {
        // If transport is already playing and loop region is set, start tracking immediately
        tryStartSession();
    }
    updatePanelUI();
    console.log(`[LoopPracticeTrainer] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

export function isLoopPracticeTrainerEnabled() {
    return isEnabled;
}

export function startSession() {
    isRunning = true;
    session.startedAt = Date.now();
    session.loopCount = 0;
    session.bestMs = Infinity;
    session.sumMs = 0;
    session.times = [];
    session.history = [];
    session.lastLoopStartTime = Date.now();
    updatePanelUI();
    localAppServices.showNotification?.('Practice trainer started', 1500);
}

export function stopSession(notify = true) {
    if (!isRunning) return;
    isRunning = false;
    const regionK = currentRegionKey();
    if (regionK && session.bestMs !== Infinity) {
        // Persist best for this region
        const existing = regionBests[regionK];
        if (!existing || session.bestMs < existing.bestMs) {
            regionBests[regionK] = {
                bestMs: session.bestMs,
                count: (existing?.count || 0) + session.loopCount,
                updatedAt: Date.now(),
            };
            saveRegionBests();
        } else {
            regionBests[regionK] = {
                bestMs: existing.bestMs,
                count: (existing.count || 0) + session.loopCount,
                updatedAt: existing.updatedAt,
            };
            saveRegionBests();
        }
    }
    updatePanelUI();
    if (notify) {
        localAppServices.showNotification?.(
            `Practice session ended (${session.loopCount} loops, best ${formatMs(session.bestMs === Infinity ? 0 : session.bestMs)})`,
            2000
        );
    }
}

export function resetSession() {
    const hadSession = isRunning;
    isRunning = false;
    session = {
        startedAt: 0,
        loopCount: 0,
        lastLoopStartTime: 0,
        bestMs: Infinity,
        sumMs: 0,
        times: [],
        history: [],
    };
    updatePanelUI();
    if (hadSession) {
        localAppServices.showNotification?.('Practice stats reset', 1500);
    }
}

function tryStartSession() {
    if (isRunning) return;
    if (typeof Tone === 'undefined' || !Tone.Transport) return;
    if (Tone.Transport.state !== 'started') return;
    const loopEnabled = typeof getLoopRegionEnabledState === 'function' ? getLoopRegionEnabledState() : false;
    if (!loopEnabled) return;
    startSession();
}

function currentRegionKey() {
    const start = typeof getLoopRegionStartState === 'function' ? getLoopRegionStartState() : 0;
    const end = typeof getLoopRegionEndState === 'function' ? getLoopRegionEndState() : 0;
    if (!start && !end) return null;
    return regionKey(start, end);
}

function formatMs(ms) {
    if (!isFinite(ms) || ms <= 0) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const totalSec = ms / 1000;
    if (totalSec < 60) return `${totalSec.toFixed(2)} s`;
    const m = Math.floor(totalSec / 60);
    const s = (totalSec - m * 60).toFixed(1);
    return `${m}m ${s}s`;
}

function avgMs() {
    if (session.times.length === 0) return 0;
    return session.sumMs / session.times.length;
}

function stdevMs() {
    if (session.times.length < 2) return 0;
    const m = avgMs();
    const sq = session.times.reduce((acc, t) => acc + Math.pow(t - m, 2), 0) / session.times.length;
    return Math.sqrt(sq);
}

let lastWrapPosition = -1;
let lastWrapTime = 0;

/**
 * Called from the UI update loop. Detects loop wraparound and records a completed loop time.
 */
export function checkLoopPracticeTrainer() {
    if (!isEnabled) return;
    if (typeof Tone === 'undefined' || !Tone.Transport) return;

    const isPlaying = Tone.Transport.state === 'started';
    if (!isPlaying) {
        if (isRunning) stopSession(false);
        return;
    }

    const loopEnabled = typeof getLoopRegionEnabledState === 'function' ? getLoopRegionEnabledState() : false;
    if (!loopEnabled) {
        if (isRunning) stopSession(false);
        return;
    }

    const loopStart = typeof getLoopRegionStartState === 'function' ? getLoopRegionStartState() : 0;
    const currentPosition = Tone.Transport.seconds;

    if (!isRunning) {
        startSession();
    }

    // Initialize baseline
    if (lastWrapPosition < 0) {
        lastWrapPosition = currentPosition;
        lastWrapTime = Date.now();
        return;
    }

    // Detect wraparound: position crossed loopStart going forward
    // (e.g., was at end of region, now back at start of region)
    if (currentPosition >= loopStart && lastWrapPosition < loopStart) {
        // A new loop iteration just began; record time since last wrap
        const now = Date.now();
        const elapsed = now - lastWrapTime;
        if (elapsed > 50 && elapsed < 600000) { // ignore 0 or absurd values
            session.times.push(elapsed);
            session.sumMs += elapsed;
            if (session.times.length > MAX_TIMES) {
                const removed = session.times.shift();
                session.sumMs -= removed;
            }
            if (elapsed < session.bestMs) session.bestMs = elapsed;
            session.loopCount++;
            session.history.unshift({ iteration: session.loopCount, ms: elapsed, at: now });
            if (session.history.length > MAX_HISTORY) session.history.length = MAX_HISTORY;

            const regionK = currentRegionKey();
            if (regionK) {
                const existing = regionBests[regionK];
                if (!existing || elapsed < existing.bestMs) {
                    regionBests[regionK] = {
                        bestMs: elapsed,
                        count: (existing?.count || 0) + 1,
                        updatedAt: now,
                    };
                    saveRegionBests();
                }
            }

            lastWrapTime = now;
            updatePanelUI();
        } else {
            lastWrapTime = now;
        }
    }

    lastWrapPosition = currentPosition;
}

export function openLoopPracticeTrainerPanel() {
    if (!localAppServices.createWindow) {
        console.warn('[LoopPracticeTrainer] createWindow not available');
        return null;
    }
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(WINDOW_ID)) {
        const win = openWindows.get(WINDOW_ID);
        if (win.restore) win.restore();
        return win;
    }
    const content = document.createElement('div');
    content.id = PANEL_ID;
    content.className = 'p-4 h-full overflow-y-auto bg-gray-900 text-white';
    const options = {
        width: 360,
        height: 520,
        minWidth: 300,
        minHeight: 400,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };
    const win = localAppServices.createWindow(WINDOW_ID, 'Loop Practice Trainer', content, options);
    if (win?.element) {
        isPanelOpen = true;
        setTimeout(() => renderPanelContent(), 30);
    }
    return win;
}

function renderPanelContent() {
    const c = document.getElementById(PANEL_ID);
    if (!c) return;

    const loopEnabled = typeof getLoopRegionEnabledState === 'function' ? getLoopRegionEnabledState() : false;
    const loopStart = typeof getLoopRegionStartState === 'function' ? getLoopRegionStartState() : 0;
    const loopEnd = typeof getLoopRegionEndState === 'function' ? getLoopRegionEndState() : 0;
    const regionK = regionKey(loopStart, loopEnd);
    const savedBest = regionBests[regionK] || null;
    const bestStr = isFinite(session.bestMs) ? formatMs(session.bestMs) : '—';
    const avg = avgMs();
    const sd = stdevMs();
    const isPlaying = typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.state === 'started';

    const statusLabel = isRunning ? (isPlaying ? 'Running' : 'Paused') : 'Idle';
    const statusColor = isRunning ? (isPlaying ? 'text-green-400' : 'text-yellow-400') : 'text-gray-400';

    c.innerHTML = `
        <div class="mb-3 text-sm text-gray-400">
            Track loop iterations, time each loop, and keep best/avg "time-to-nail" stats.
        </div>

        <div class="mb-3 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Status:</span>
                <span class="text-base font-bold ${statusColor}">${statusLabel}</span>
            </div>
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Loop Region:</span>
                <span class="text-sm ${loopEnabled ? 'text-green-400' : 'text-gray-500'}">${loopEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-400">Bounds:</span>
                <span class="text-sm text-white">${loopStart.toFixed(2)}s → ${loopEnd.toFixed(2)}s</span>
            </div>
        </div>

        <div class="mb-3 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <div class="text-xs text-gray-400">Loops</div>
                    <div class="text-2xl font-bold text-white">${session.loopCount}</div>
                </div>
                <div>
                    <div class="text-xs text-gray-400">Best (this session)</div>
                    <div class="text-2xl font-bold text-yellow-400">${bestStr}</div>
                </div>
                <div>
                    <div class="text-xs text-gray-400">Avg</div>
                    <div class="text-lg font-semibold text-blue-400">${session.times.length ? formatMs(avg) : '—'}</div>
                </div>
                <div>
                    <div class="text-xs text-gray-400">Std Dev</div>
                    <div class="text-lg font-semibold text-purple-400">${session.times.length > 1 ? formatMs(sd) : '—'}</div>
                </div>
            </div>
        </div>

        <div class="mb-3 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-1">All-time best for this region</div>
            <div class="text-lg font-semibold ${savedBest ? 'text-green-400' : 'text-gray-500'}">
                ${savedBest ? formatMs(savedBest.bestMs) : '—'}
            </div>
            ${savedBest ? `<div class="text-xs text-gray-500 mt-1">across ${savedBest.count} loops</div>` : ''}
        </div>

        <div class="mb-3 flex items-center gap-2 flex-wrap">
            <button id="lptStartBtn" class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                ${isRunning ? 'Restart' : 'Start'}
            </button>
            <button id="lptStopBtn" class="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700" ${isRunning ? '' : 'disabled'}>
                Stop
            </button>
            <button id="lptResetBtn" class="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-500">
                Reset Stats
            </button>
            <button id="lptClearBestsBtn" class="px-3 py-1.5 text-sm bg-red-700 text-white rounded hover:bg-red-600" title="Clear all saved region bests">
                Clear Bests
            </button>
        </div>

        <div class="mb-2 text-sm text-gray-400 font-semibold">Recent Loops (${session.history.length})</div>
        <div class="bg-gray-800 rounded border border-gray-700 max-h-40 overflow-y-auto">
            ${session.history.length === 0
                ? '<div class="p-3 text-sm text-gray-500 text-center">No loops recorded yet</div>'
                : session.history.slice(0, 15).map(h => `
                    <div class="flex items-center justify-between px-3 py-1 text-sm border-b border-gray-700">
                        <span class="text-gray-400">#${h.iteration}</span>
                        <span class="text-white">${formatMs(h.ms)}</span>
                    </div>
                `).join('')
            }
        </div>
    `;

    c.querySelector('#lptStartBtn')?.addEventListener('click', () => {
        if (!loopEnabled) {
            localAppServices.showNotification?.('Enable a loop region first', 2000);
            return;
        }
        startSession();
        renderPanelContent();
    });

    c.querySelector('#lptStopBtn')?.addEventListener('click', () => {
        stopSession();
        renderPanelContent();
    });

    c.querySelector('#lptResetBtn')?.addEventListener('click', () => {
        resetSession();
        renderPanelContent();
    });

    c.querySelector('#lptClearBestsBtn')?.addEventListener('click', () => {
        if (confirm('Clear all saved region bests? This cannot be undone.')) {
            regionBests = {};
            saveRegionBests();
            renderPanelContent();
            localAppServices.showNotification?.('Region bests cleared', 1500);
        }
    });
}

function updatePanelUI() {
    if (!isPanelOpen) return;
    const c = document.getElementById(PANEL_ID);
    if (!c) return;
    renderPanelContent();
}

export function getLoopPracticeStats() {
    return {
        isRunning,
        loopCount: session.loopCount,
        bestMs: isFinite(session.bestMs) ? session.bestMs : 0,
        avgMs: avgMs(),
        stdevMs: stdevMs(),
        times: [...session.times],
    };
}

export function getRegionBests() {
    return JSON.parse(JSON.stringify(regionBests));
}

console.log('[LoopPracticeTrainer] Module loaded');

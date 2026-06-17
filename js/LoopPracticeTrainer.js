// js/LoopPracticeTrainer.js - Loop Practice Trainer feature
// Track loop iterations, time each loop completion (time-to-nail),
// and report best/avg/total times. Per-region bests persist in localStorage.

let localAppServices = {};
let isEnabled = false;
let isPanelOpen = false;
let isRunning = false;

// State function references (injected by main.js)
let getLoopRegionEnabledState = null;
let getLoopRegionStartState = null;
let getLoopRegionEndState = null;
let lastCheckPosition = 0;
let lastCheckTime = 0;

// Session state
let sessionStartTime = 0;
let currentLoopStartTime = 0;
let currentLoopRegion = null; // { start, end, key }
let iterationCount = 0;
let currentLoopTimes = []; // seconds for each completed loop in this session
let bestThisSession = Infinity;

// Persisted per-region best times
const STORAGE_KEY = 'snaw_loop_practice_bests';
let regionBests = {}; // { regionKey: bestSeconds }

// Window/panel tracking
const WINDOW_ID = 'loopPracticeTrainer';
const PANEL_CONTENT_ID = 'loopPracticeTrainerContent';

export function initLoopPracticeTrainer(services) {
    localAppServices = services || {};
    loadRegionBests();
    console.log('[LoopPracticeTrainer] Initialized');
}

export function initLoopPracticeTrainerStateReferences(getEnabledFn, getStartFn, getEndFn) {
    getLoopRegionEnabledState = getEnabledFn;
    getLoopRegionStartState = getStartFn;
    getLoopRegionEndState = getEndFn;
    console.log('[LoopPracticeTrainer] State references initialized');
}

export function isLoopPracticeTrainerEnabled() {
    return isEnabled;
}

export function setLoopPracticeTrainerEnabled(enabled) {
    const wasEnabled = isEnabled;
    isEnabled = !!enabled;
    if (isEnabled && !wasEnabled) {
        startSession();
    } else if (!isEnabled && wasEnabled) {
        stopSession();
    }
    console.log(`[LoopPracticeTrainer] ${isEnabled ? 'enabled' : 'disabled'}`);
}

export function startSession() {
    isRunning = true;
    sessionStartTime = performance.now();
    currentLoopTimes = [];
    iterationCount = 0;
    bestThisSession = Infinity;
    currentLoopStartTime = performance.now();
    const region = getCurrentRegion();
    if (region) {
        currentLoopRegion = region;
    }
    lastCheckPosition = 0;
    lastCheckTime = 0;
    refreshPanel();
}

export function stopSession() {
    isRunning = false;
    isEnabled = false;
    if (isPanelOpen) refreshPanel();
}

export function resetLoopPracticeTrainer() {
    currentLoopTimes = [];
    iterationCount = 0;
    bestThisSession = Infinity;
    if (isEnabled) {
        currentLoopStartTime = performance.now();
        sessionStartTime = performance.now();
    }
    refreshPanel();
}

export function getLoopPracticeTrainerStats() {
    const avg = currentLoopTimes.length > 0
        ? currentLoopTimes.reduce((a, b) => a + b, 0) / currentLoopTimes.length
        : 0;
    const regionKey = currentLoopRegion ? getRegionKey(currentLoopRegion) : null;
    const personalBest = regionKey && regionBests[regionKey] != null
        ? regionBests[regionKey]
        : null;
    return {
        enabled: isEnabled,
        running: isRunning,
        iterationCount,
        bestThisSession: bestThisSession === Infinity ? null : bestThisSession,
        averageTime: avg,
        lastTime: currentLoopTimes.length > 0 ? currentLoopTimes[currentLoopTimes.length - 1] : null,
        allTimes: currentLoopTimes.slice(),
        sessionDurationSec: isRunning ? (performance.now() - sessionStartTime) / 1000 : 0,
        currentRegion: currentLoopRegion,
        personalBest,
        personalBestKey: regionKey
    };
}

/**
 * Check whether the transport has wrapped around the loop region.
 * Called from main.js updateMetersLoop.
 */
export function checkLoopPracticeTrainer() {
    if (!isEnabled || !isRunning) return;

    const loopRegionEnabled = typeof getLoopRegionEnabledState === 'function'
        ? getLoopRegionEnabledState() : false;
    if (!loopRegionEnabled) {
        if (isPanelOpen) refreshPanel();
        return;
    }

    if (typeof Tone === 'undefined' || !Tone.Transport) return;
    if (Tone.Transport.state !== 'started') return;

    const loopStart = typeof getLoopRegionStartState === 'function'
        ? getLoopRegionStartState() : 0;
    const loopEnd = typeof getLoopRegionEndState === 'function'
        ? getLoopRegionEndState() : 16;
    const currentPosition = Tone.Transport.seconds;

    // Update tracked region in case user moved it
    if (!currentLoopRegion ||
        currentLoopRegion.start !== loopStart ||
        currentLoopRegion.end !== loopEnd) {
        // Region changed; treat the current loop as a new region
        currentLoopRegion = { start: loopStart, end: loopEnd };
        currentLoopStartTime = performance.now();
        lastCheckPosition = currentPosition;
        lastCheckTime = currentPosition;
        if (isPanelOpen) refreshPanel();
        return;
    }

    // Detect wraparound
    if (lastCheckPosition > loopStart + 0.1 && currentPosition <= loopStart + 0.1) {
        // Just wrapped - record elapsed time
        const now = performance.now();
        const elapsed = (now - currentLoopStartTime) / 1000;
        if (elapsed > 0.05) {
            currentLoopTimes.push(elapsed);
            iterationCount++;
            if (elapsed < bestThisSession) {
                bestThisSession = elapsed;
            }
            const regionKey = getRegionKey(currentLoopRegion);
            if (!regionBests[regionKey] || elapsed < regionBests[regionKey]) {
                regionBests[regionKey] = elapsed;
                saveRegionBests();
            }
        }
        currentLoopStartTime = now;
        if (isPanelOpen) refreshPanel();
    }

    lastCheckPosition = currentPosition;
}

export function openLoopPracticeTrainerPanel() {
    if (isPanelOpen && localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(WINDOW_ID)) {
            openWindows.get(WINDOW_ID).restore?.();
            refreshPanel();
            return openWindows.get(WINDOW_ID);
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = PANEL_CONTENT_ID;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white overflow-y-auto';

    const options = {
        width: 380,
        height: 460,
        minWidth: 320,
        minHeight: 400,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(WINDOW_ID, 'Loop Practice Trainer', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;

    const stats = getLoopPracticeTrainerStats();
    const region = stats.currentRegion;
    const regionLabel = region
        ? `${region.start.toFixed(2)}s → ${region.end.toFixed(2)}s (${(region.end - region.start).toFixed(2)}s)`
        : 'No loop region set';

    const fmtTime = (sec) => sec == null ? '—' : `${sec.toFixed(2)}s`;

    container.innerHTML = `
        <div class="mb-3 text-sm text-gray-300">
            Track loop iterations and your best time-to-nail per region.
        </div>

        <div class="mb-3 p-2 bg-gray-800 rounded border border-gray-700 text-sm">
            <div class="text-gray-400 text-xs mb-1">Current Loop Region</div>
            <div class="text-white">${regionLabel}</div>
        </div>

        <div class="mb-3">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="lptEnabled" ${stats.enabled ? 'checked' : ''} class="w-4 h-4 accent-green-500">
                <span class="font-medium">Enable Practice Tracking</span>
            </label>
            <div class="text-xs text-gray-400 mt-1">
                Requires Loop Region to be enabled in transport. Times are recorded each time the transport wraps back to the loop start.
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-3">
            <div class="p-2 bg-gray-800 rounded border border-gray-700">
                <div class="text-xs text-gray-400">Loops Completed</div>
                <div class="text-2xl font-bold text-blue-400">${stats.iterationCount}</div>
            </div>
            <div class="p-2 bg-gray-800 rounded border border-gray-700">
                <div class="text-xs text-gray-400">Avg Time</div>
                <div class="text-2xl font-bold text-cyan-400">${fmtTime(stats.averageTime)}</div>
            </div>
            <div class="p-2 bg-gray-800 rounded border border-gray-700">
                <div class="text-xs text-gray-400">Best (Session)</div>
                <div class="text-2xl font-bold text-yellow-400">${fmtTime(stats.bestThisSession)}</div>
            </div>
            <div class="p-2 bg-gray-800 rounded border border-gray-700">
                <div class="text-xs text-gray-400">Best (All-Time)</div>
                <div class="text-2xl font-bold text-green-400">${fmtTime(stats.personalBest)}</div>
            </div>
        </div>

        <div class="mb-3 p-2 bg-gray-800 rounded border border-gray-700 text-sm">
            <div class="flex justify-between">
                <span class="text-gray-400">Last Loop:</span>
                <span class="text-white">${fmtTime(stats.lastTime)}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-400">Session Duration:</span>
                <span class="text-white">${stats.sessionDurationSec.toFixed(1)}s</span>
            </div>
        </div>

        <div class="mb-3">
            <div class="text-xs text-gray-400 mb-1">Recent Loop Times</div>
            <div id="lptTimesList" class="max-h-32 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-2 text-xs font-mono">
                ${renderTimesList(stats.allTimes)}
            </div>
        </div>

        <div class="flex gap-2">
            <button id="lptResetBtn" class="flex-1 px-3 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600">
                Reset Session
            </button>
            <button id="lptClearBestsBtn" class="px-3 py-2 text-sm bg-red-700 text-white rounded hover:bg-red-600" title="Clear saved per-region bests">
                Clear Bests
            </button>
        </div>
    `;

    container.querySelector('#lptEnabled')?.addEventListener('change', (e) => {
        setLoopPracticeTrainerEnabled(e.target.checked);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(
                e.target.checked ? 'Loop Practice Trainer started' : 'Loop Practice Trainer stopped',
                1500
            );
        }
        renderPanelContent();
    });

    container.querySelector('#lptResetBtn')?.addEventListener('click', () => {
        resetLoopPracticeTrainer();
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Session reset', 1200);
        }
    });

    container.querySelector('#lptClearBestsBtn')?.addEventListener('click', () => {
        if (confirm('Clear all saved per-region best times?')) {
            regionBests = {};
            saveRegionBests();
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Cleared all per-region bests', 1500);
            }
            renderPanelContent();
        }
    });
}

function renderTimesList(times) {
    if (!times || times.length === 0) {
        return '<div class="text-gray-500">No loops completed yet — enable tracking and let the transport loop.</div>';
    }
    const recent = times.slice(-15).reverse();
    return recent.map((t, idx) => {
        const isBest = t === bestThisSession;
        return `<div class="${isBest ? 'text-yellow-400' : 'text-gray-200'}">#${times.length - idx}: ${t.toFixed(2)}s</div>`;
    }).join('');
}

function refreshPanel() {
    if (!isPanelOpen) return;
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) {
        isPanelOpen = false;
        return;
    }
    renderPanelContent();
}

function getCurrentRegion() {
    if (typeof getLoopRegionStartState !== 'function') return null;
    const start = getLoopRegionStartState();
    const end = getLoopRegionEndState();
    if (start == null || end == null) return null;
    return { start, end };
}

function getRegionKey(region) {
    return `${region.start.toFixed(3)}_${region.end.toFixed(3)}`;
}

function loadRegionBests() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                regionBests = parsed;
            }
        }
    } catch (e) {
        console.warn('[LoopPracticeTrainer] Failed to load bests:', e);
    }
}

function saveRegionBests() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(regionBests));
    } catch (e) {
        console.warn('[LoopPracticeTrainer] Failed to save bests:', e);
    }
}

console.log('[LoopPracticeTrainer] Module loaded');

/**
 * js/ProjectSessionTimer.js - Project Session Timer
 * Shows a small "MM:SS" elapsed-since-load timer in the status bar (#statusSessionTimer
 * block, which already exists in index.html) and updates it on every frame.
 * Click the timer to reset it back to 00:00.
 *
 * Why a dedicated module:
 *   - The previous inline update in main.js formatted the timer as HH:MM:SS and used
 *     performance.now() as the baseline, so it could not be reset.
 *   - Resetting with Date.now() is simpler (wall-clock arithmetic) and aligns with
 *     the rest of the project (which also uses Date.now() for session boundaries).
 *   - Keeps the change isolated, mirror-exported to window for back-compat with any
 *     code that pokes at it (e.g. tests, automation, status-bar clicks via
 *     dispatchEvent).
 *
 * Format:
 *   - Caps at 99:59 by design (the spec says MM:SS, not HH:MM:SS). After 100 minutes
 *     elapsed, the timer still ticks but the minutes field stays pinned at "99".
 *     This keeps the status bar element narrow and visually consistent with the
 *     other compact indicators.
 *
 * (v0.4.12)
 */

const TIMER_ELEMENT_ID = 'statusSessionTimer';
const TIMER_VALUE_ID = 'statusSessionTimerValue';
const RESET_FLASH_MS = 400;

let resetListenerBound = false;
let flashResetTimeoutId = null;

function formatMMSS(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds) || 0);
    const minutes = Math.min(99, Math.floor(safeSeconds / 60));
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getSessionStartMs() {
    if (typeof window === 'undefined') return Date.now();
    if (typeof window.__snawSessionResetAt !== 'number') {
        window.__snawSessionResetAt = Date.now();
    }
    return window.__snawSessionResetAt;
}

export function resetProjectSessionTimer() {
    if (typeof window === 'undefined') return;
    window.__snawSessionResetAt = Date.now();
    const valueEl = document.getElementById(TIMER_VALUE_ID);
    if (valueEl) {
        valueEl.textContent = '00:00';
        try {
            valueEl.classList.add('text-emerald-300');
            if (flashResetTimeoutId) {
                clearTimeout(flashResetTimeoutId);
                flashResetTimeoutId = null;
            }
            flashResetTimeoutId = setTimeout(() => {
                valueEl.classList.remove('text-emerald-300');
                flashResetTimeoutId = null;
            }, RESET_FLASH_MS);
        } catch (_) { /* classList may be unavailable in some hosts */ }
    }
}

function refreshDisplay() {
    const valueEl = document.getElementById(TIMER_VALUE_ID);
    if (!valueEl) return;
    const startMs = getSessionStartMs();
    const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
    valueEl.textContent = formatMMSS(elapsedSec);
}

export function refreshProjectSessionTimer() {
    refreshDisplay();
}

export function getProjectSessionTimerStatus() {
    const startMs = getSessionStartMs();
    const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    return {
        startMs,
        elapsedSeconds: elapsedSec,
        formatted: formatMMSS(elapsedSec),
    };
}

function handleTimerClick() {
    resetProjectSessionTimer();
}

function bindClickToReset() {
    if (typeof document === 'undefined') return;
    if (resetListenerBound) return;
    const container = document.getElementById(TIMER_ELEMENT_ID);
    if (!container) return;
    if (typeof container.addEventListener === 'function') {
        container.addEventListener('click', handleTimerClick);
        resetListenerBound = true;
    }
}

export function initProjectSessionTimer(appServices) {
    // appServices is accepted for parity with other modules but not currently needed.
    void appServices;
    bindClickToReset();
    refreshDisplay();
    console.log('[ProjectSessionTimer] Initialized (MM:SS, click to reset)');
}

// Mirror to window for back-compat / inspection.
if (typeof window !== 'undefined') {
    window.resetProjectSessionTimer = resetProjectSessionTimer;
    window.getProjectSessionTimerStatus = getProjectSessionTimerStatus;
}

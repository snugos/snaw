/**
 * js/AutoSaveCounter.js - Project Auto-Save Counter
 * Shows a small counter in the status bar so the user knows the auto-save
 * system is working. Displays "AutoSave: N today (M total)" — N is today's
 * count (resets at local midnight), M is the cumulative total across the
 * browser's localStorage-backed history.
 *
 * The counter values come from state.js via appServices.stateModule:
 *   - getAutoSaveCount()      → cumulative total (persisted)
 *   - getAutoSaveCountToday() → today's count (resets at midnight)
 *
 * The DOM element is injected into the existing #statusBar (between
 * #statusSessionTimer and #statusTrackCount) so it sits naturally with the
 * other status indicators. The element flashes briefly on each new save so
 * the user gets visual confirmation that the background save fired.
 *
 * (v0.3.92)
 */

let localAppServices = {};
let counterElement = null;
let valueElement = null;
let lastSeenTotal = -1;
let lastSeenToday = -1;
let pollIntervalId = null;
let flashTimeoutId = null;
const POLL_INTERVAL_MS = 1000;     // refresh display every 1s (catches day rollover)
const FLASH_DURATION_MS = 800;     // brief green flash on each new save

export function initAutoSaveCounter(appServices) {
    localAppServices = appServices || {};
    console.log('[AutoSaveCounter] Initialized');
    createCounterElement();
    startPolling();
}

/**
 * Create the counter DOM element inside the status bar.
 * Idempotent — safe to call multiple times.
 */
function createCounterElement() {
    if (counterElement) return;

    const statusBar = document.getElementById('statusBar');
    if (!statusBar) {
        // Status bar not in DOM yet — retry shortly. The main app calls
        // init from a point where DOMContentLoaded has fired, but be defensive.
        setTimeout(createCounterElement, 100);
        return;
    }

    // Wrapper matches the styling of neighboring status cells (cursor, hover,
    // text size, color) so the counter blends in seamlessly.
    counterElement = document.createElement('div');
    counterElement.id = 'statusAutoSaveCounter';
    counterElement.className = 'flex items-center gap-1 cursor-pointer hover:text-gray-300';
    counterElement.title = 'Auto-save counter (today / cumulative total)';
    counterElement.innerHTML = `
        <span class="text-gray-500">AutoSave:</span>
        <span id="statusAutoSaveCounterValue" class="text-emerald-400">0 today (0 total)</span>
    `;

    // Insert right after the #statusSessionTimer block (which sits just before
    // the #statusTrackCount block in index.html). Use the existing
    // pipe-separator pattern: find the | between Session and Tracks, and
    // place ourselves between the Session block and that pipe.
    const sessionTimer = document.getElementById('statusSessionTimer');
    if (sessionTimer && sessionTimer.parentNode === statusBar) {
        // Find the next sibling — if it's the pipe separator, insert before
        // the pipe; otherwise insert right after the Session block.
        const nextSibling = sessionTimer.nextElementSibling;
        if (nextSibling && nextSibling.textContent && nextSibling.textContent.trim() === '|') {
            // Insert the counter + a fresh pipe separator BEFORE the existing
            // pipe (so the order stays: Session | AutoSave | Tracks).
            statusBar.insertBefore(counterElement, nextSibling);
            // Clone the pipe separator and insert it AFTER the counter to
            // preserve the alternation pattern.
            const newPipe = nextSibling.cloneNode(true);
            statusBar.insertBefore(newPipe, nextSibling);
        } else {
            statusBar.insertBefore(counterElement, nextSibling);
        }
    } else {
        // Fallback — append to end of status bar.
        statusBar.appendChild(counterElement);
    }

    valueElement = document.getElementById('statusAutoSaveCounterValue');
    // Click → tooltip-style notification with full save info
    counterElement.addEventListener('click', () => {
        const total = safeGetCount('getAutoSaveCount');
        const today = safeGetCount('getAutoSaveCountToday');
        // Prefer the safe notification shim, fall back to the raw one if present
        const notifier = (typeof localAppServices.showSafeNotification === 'function')
            ? localAppServices.showSafeNotification
            : localAppServices.showNotification;
        if (typeof notifier === 'function') {
            notifier(
                `Auto-save: ${today} today • ${total} total (this browser)`,
                2400
            );
        }
    });
}

/**
 * Read a counter via appServices.stateModule, returning 0 on any failure.
 */
function safeGetCount(fnName) {
    try {
        const sm = localAppServices.stateModule || {};
        if (typeof sm[fnName] === 'function') {
            const v = sm[fnName]();
            if (typeof v === 'number' && isFinite(v) && v >= 0) return v;
        }
    } catch (_) { /* fall through */ }
    return 0;
}

function startPolling() {
    if (pollIntervalId) return;
    pollIntervalId = setInterval(refreshDisplay, POLL_INTERVAL_MS);
    refreshDisplay();
}

function refreshDisplay() {
    if (!valueElement) return;
    const total = safeGetCount('getAutoSaveCount');
    const today = safeGetCount('getAutoSaveCountToday');

    // Detect a new save (total grew) and flash the value
    if (lastSeenTotal >= 0 && total > lastSeenTotal) {
        flashValue();
    }
    lastSeenTotal = total;
    lastSeenToday = today;

    // Color coding based on activity level today
    let colorClass = 'text-emerald-400';
    if (today === 0) colorClass = 'text-gray-500';
    else if (today < 3) colorClass = 'text-yellow-400';
    valueElement.className = colorClass;
    valueElement.textContent = `${today} today (${total} total)`;
}

function flashValue() {
    if (!valueElement) return;
    valueElement.classList.add('text-green-300');
    if (flashTimeoutId) clearTimeout(flashTimeoutId);
    flashTimeoutId = setTimeout(() => {
        // refreshDisplay() will re-apply the proper color next tick;
        // this just removes the flash override.
        if (valueElement) valueElement.classList.remove('text-green-300');
        flashTimeoutId = null;
    }, FLASH_DURATION_MS);
}

export function getAutoSaveCounterStatus() {
    return {
        total: safeGetCount('getAutoSaveCount'),
        today: safeGetCount('getAutoSaveCountToday')
    };
}


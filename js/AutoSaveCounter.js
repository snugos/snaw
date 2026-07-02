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
let pollIntervalId = null;
let flashTimeoutId = null;
const POLL_INTERVAL_MS = 1000;     // refresh display every 1s (catches day rollover)
const FLASH_DURATION_MS = 800;     // brief green flash on each new save
// Activity-level color tokens (gray / yellow / emerald) are managed by
// refreshDisplay() via classList.add/remove. The flash token (text-green-300)
// is managed separately by flashValue() so a poll during the 800ms flash
// window does not wipe the flash — the old code reassigned
// `valueElement.className = colorClass` on every poll, which replaced all
// classes (including the flash class) whenever a poll ran during the flash
// window, making the flash only visible during the variable gap between
// flash start and the next poll. Keeping the tokens split fixes that.
const ACTIVITY_COLOR_TOKENS = ['text-emerald-400', 'text-gray-500', 'text-yellow-400'];

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
    // the #statusTrackCount block in index.html). The status bar already has
    // pipe separators between every adjacent cell ("|" divs interleaved in
    // index.html), so all we need to do is insert the counter BEFORE the
    // existing pipe that sits between Session and Tracks. No new pipe clone
    // needed — cloning would leave a double-pipe "||" between the counter
    // and the next cell, which is a visible cosmetic bug.
    const sessionTimer = document.getElementById('statusSessionTimer');
    if (sessionTimer && sessionTimer.parentNode === statusBar) {
        const nextSibling = sessionTimer.nextElementSibling;
        if (nextSibling && nextSibling.textContent && nextSibling.textContent.trim() === '|') {
            // Insert the counter BEFORE the existing pipe. Resulting order:
            // Session | counter | Tracks | Clips | … (no duplicate pipe).
            statusBar.insertBefore(counterElement, nextSibling);
        } else if (nextSibling) {
            statusBar.insertBefore(counterElement, nextSibling);
        } else {
            statusBar.appendChild(counterElement);
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

    // Color coding based on activity level today. Use classList (not
    // className reassignment) so the brief text-green-300 flash added by
    // flashValue() survives this poll — the old code did
    // `valueElement.className = colorClass` which replaced all classes and
    // wiped the flash class whenever a poll ran during the 800ms flash
    // window. Result: the flash was only visible during the variable gap
    // between flash start and the next poll, which felt inconsistent.
    //
    // We split the color tokens from the flash token: the activity-level
    // color is in ACTIVITY_COLOR_TOKENS and the flash is its own token
    // managed by flashValue() / clearFlash(). refreshDisplay() only
    // touches the activity token so a poll during a flash leaves the
    // flash class intact. The flash timeout still removes the flash
    // class as before — if a poll happened to land right at the 800ms
    // mark, the flash is gone anyway.
    let colorClass = 'text-emerald-400';
    if (today === 0) colorClass = 'text-gray-500';
    else if (today < 3) colorClass = 'text-yellow-400';
    for (const t of ACTIVITY_COLOR_TOKENS) valueElement.classList.remove(t);
    valueElement.classList.add(colorClass);
    valueElement.textContent = `${today} today (${total} total)`;
}

function flashValue() {
    if (!valueElement) return;
    valueElement.classList.add('text-green-300');
    if (flashTimeoutId) clearTimeout(flashTimeoutId);
    flashTimeoutId = setTimeout(() => {
        // Remove only the flash override; the activity-level color class
        // is managed by refreshDisplay() and stays applied.
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


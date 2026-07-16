// js/CountInAudio.js - Audio Count-In Feature
// Plays metronome count-in before recording starts

let localAppServices = {};
let countInBars = 1; // Number of bars for count-in (0 = disabled)
let countInActive = false;
let countInCallback = null;
let countInRunToken = 0;
const countInTimers = new Set();

function scheduleCountInTimer(callback, delay) {
    const timerId = setTimeout(() => {
        countInTimers.delete(timerId);
        callback();
    }, delay);
    countInTimers.add(timerId);
    return timerId;
}

function finishCountIn(token) {
    if (token !== countInRunToken || !countInActive) return;
    countInActive = false;
    clearCountInDisplay();
    countInCallback?.();
    countInCallback = null;
}

export function initCountInAudio(services) {
    localAppServices = services;
    console.log('[CountInAudio] Initialized');
}

export function setCountInBars(bars) {
    countInBars = Math.max(0, Math.min(4, parseInt(bars) || 0));
    console.log(`[CountInAudio] Count-in set to ${countInBars} bars`);
}

export function playFixedCountIn(callback, bpm, bars = 1) {
    if (countInActive) return false;
    countInActive = true;
    countInCallback = callback;
    const token = ++countInRunToken;
    const beatDuration = 60 / Math.max(1, Number(bpm) || 120);
    const totalBeats = Math.max(1, Math.round(Number(bars) || 1) * 4);
    import('./audio.js').then(({ playMetronomeClick }) => {
        if (token !== countInRunToken || !countInActive) return;
        for (let beat = 0; beat < totalBeats; beat++) {
            scheduleCountInTimer(() => {
                if (token !== countInRunToken || !countInActive) return;
                playMetronomeClick?.(beat % 4 === 0);
                updateCountInDisplay(beat + 1, totalBeats);
                if (beat === totalBeats - 1) scheduleCountInTimer(() => finishCountIn(token), 200);
            }, beat * beatDuration * 1000);
        }
    }).catch(() => {
        if (token === countInRunToken && countInActive) finishCountIn(token);
    });
    return true;
}

export function getCountInBars() {
    return countInBars;
}

export function isCountInEnabled() {
    return countInBars > 0;
}

/**
 * Play count-in before recording
 * @param {Function} callback - Called when count-in is complete
 * @param {number} bpm - Current BPM
 */
export async function playCountIn(callback, bpm) {
    if (countInBars <= 0 || countInActive) {
        callback?.();
        return;
    }

    countInActive = true;
    countInCallback = callback;
    const token = ++countInRunToken;
    let playMetronomeClick;
    try {
        ({ playMetronomeClick } = await import('./audio.js'));
    } catch (_) {
        finishCountIn(token);
        return;
    }
    if (token !== countInRunToken || !countInActive) return;
    const beatsPerBar = 4;
    const totalBeats = countInBars * beatsPerBar;
    const beatDuration = 60 / Math.max(1, Number(bpm) || 120);
    for (let beat = 0; beat < totalBeats; beat++) {
        const isDownbeat = beat % beatsPerBar === 0;
        scheduleCountInTimer(() => {
            if (token !== countInRunToken || !countInActive) return;
            playMetronomeClick?.(isDownbeat);
            updateCountInDisplay(beat + 1, totalBeats);
            if (beat === totalBeats - 1) scheduleCountInTimer(() => finishCountIn(token), 200);
        }, beat * beatDuration * 1000);
    }
}

function updateCountInDisplay(current, total) {
    const existing = document.getElementById('countInDisplay');
    if (existing) {
        existing.textContent = `Count: ${current}/${total}`;
    } else {
        const indicator = document.createElement('span');
        indicator.id = 'countInDisplay';
        indicator.className = 'text-xs text-yellow-400 px-2 py-1 bg-[#282828] rounded border border-[#4a4a4a] font-mono ml-2';
        indicator.textContent = `Count: ${current}/${total}`;
        
        const recordBtn = document.getElementById('recordBtnGlobal');
        if (recordBtn && recordBtn.parentNode) {
            recordBtn.parentNode.insertBefore(indicator, recordBtn.nextSibling);
        }
    }
}

function clearCountInDisplay() {
    const existing = document.getElementById('countInDisplay');
    if (existing) {
        existing.remove();
    }
}

/**
 * Cancel ongoing count-in
 */
export function cancelCountIn() {
    countInRunToken++;
    countInTimers.forEach(timerId => clearTimeout(timerId));
    countInTimers.clear();
    countInActive = false;
    countInCallback = null;
    clearCountInDisplay();
}

// Wire up count-in settings UI
export function setupCountInUI() {
    const container = document.getElementById('globalControlsBar');
    if (!container) return;

    // Check if already added
    if (document.getElementById('countInSelect')) return;

    // Create count-in control
    const countInLabel = document.createElement('span');
    countInLabel.className = 'text-xs text-gray-400';
    countInLabel.textContent = 'Count:';
    
    const countInSelect = document.createElement('select');
    countInSelect.id = 'countInSelect';
    countInSelect.className = 'bg-[#282828] border border-[#4a4a4a] rounded text-[#e0e0e0] text-xs px-1 py-1';
    countInSelect.innerHTML = `
        <option value="0">Off</option>
        <option value="1">1 Bar</option>
        <option value="2">2 Bars</option>
        <option value="4">4 Bars</option>
    `;
    countInSelect.value = countInBars;
    
    countInSelect.addEventListener('change', (e) => {
        setCountInBars(parseInt(e.target.value));
        if (localAppServices.saveProjectState) {
            localAppServices.saveProjectState();
        }
    });

    // Find a good insertion point (after loop controls)
    const loopBtn = document.getElementById('loopToggleBtnGlobal');
    if (loopBtn && loopBtn.parentNode) {
        loopBtn.parentNode.insertBefore(countInLabel, loopBtn.nextSibling);
        loopBtn.parentNode.insertBefore(countInSelect, countInLabel.nextSibling);
    }

    console.log('[CountInAudio] UI wired up');
}

// Export for use by recording system
export { countInActive };
export function isCountInActive() {
    return countInActive;
}
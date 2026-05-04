// js/TimeSignaturePerTrack.js - Time Signature Per Track
// Allow different time signatures per track for polyrhythmic compositions

let localAppServices = {};
const TIME_SIG_PANEL_ID = 'timeSigPerTrackContent';

// Common time signatures
const COMMON_TIME_SIGNATURES = [
    { label: '4/4', numerator: 4, denominator: 4 },
    { label: '3/4', numerator: 3, denominator: 4 },
    { label: '2/4', numerator: 2, denominator: 4 },
    { label: '6/8', numerator: 6, denominator: 8 },
    { label: '5/4', numerator: 5, denominator: 4 },
    { label: '7/8', numerator: 7, denominator: 8 },
    { label: '9/8', numerator: 9, denominator: 8 },
    { label: '12/8', numerator: 12, denominator: 8 },
    { label: '6/4', numerator: 6, denominator: 4 },
    { label: '5/8', numerator: 5, denominator: 8 },
];

// Track time signatures: { trackId: { numerator, denominator } }
let trackTimeSignatures = {};

/**
 * Initialize Time Signature Per Track module
 * @param {Object} appServices 
 */
export function initTimeSignaturePerTrack(appServices) {
    localAppServices = appServices || {};
    console.log('[TimeSignaturePerTrack] Module initialized');
}

/**
 * Get time signature for a track
 * @param {string} trackId
 * @returns {{ numerator: number, denominator: number }}
 */
export function getTrackTimeSignature(trackId) {
    if (trackTimeSignatures[trackId]) {
        return { ...trackTimeSignatures[trackId] };
    }
    return { numerator: 4, denominator: 4 }; // Default
}

/**
 * Set time signature for a track
 * @param {string} trackId
 * @param {number} numerator
 * @param {number} denominator
 */
export function setTrackTimeSignature(trackId, numerator, denominator) {
    trackTimeSignatures[trackId] = {
        numerator: Math.max(1, Math.min(32, parseInt(numerator) || 4)),
        denominator: Math.max(1, Math.min(32, parseInt(denominator) || 4))
    };
    console.log(`[TimeSignaturePerTrack] Track ${trackId} time signature set to ${numerator}/${denominator}`);
    updateTrackTimeSignatureDisplay(trackId);
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Change track time signature');
    }
}

/**
 * Remove custom time signature from track (revert to default)
 * @param {string} trackId
 */
export function clearTrackTimeSignature(trackId) {
    if (trackTimeSignatures[trackId]) {
        delete trackTimeSignatures[trackId];
        console.log(`[TimeSignaturePerTrack] Track ${trackId} reverted to default time signature`);
        updateTrackTimeSignatureDisplay(trackId);
    }
}

/**
 * Get duration of one bar in seconds for a track
 * @param {string} trackId
 * @param {number} bpm
 * @returns {number}
 */
export function getBarDurationSeconds(trackId, bpm) {
    const ts = getTrackTimeSignature(trackId);
    const beatsPerBar = ts.numerator;
    const beatUnit = ts.denominator;
    // Duration of one beat in seconds
    const secondsPerBeat = 60.0 / bpm;
    // Duration of one bar (measure)
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    // Account for note value (e.g., 8th notes = 0.5 beats)
    const beatDuration = 4.0 / beatUnit; // 4/4 = 1, 8/8 = 1, 4/8 = 0.5, 8/4 = 2
    return secondsPerBar * beatDuration;
}

/**
 * Get number of beats per bar for a track
 * @param {string} trackId
 * @returns {number}
 */
export function getBeatsPerBar(trackId) {
    return getTrackTimeSignature(trackId).numerator;
}

/**
 * Open time signature settings panel
 * @param {string} trackId
 */
export function openTimeSignaturePanel(trackId) {
    const windowId = 'timeSigPerTrackPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = TIME_SIG_PANEL_ID;
    contentContainer.className = 'p-0 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';
    
    const ts = getTrackTimeSignature(trackId);
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    contentContainer.innerHTML = getTimeSignaturePanelHTML(trackId, ts, track?.name);
    
    const options = {
        width: 400,
        height: 350,
        minWidth: 300,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Time Signature', contentContainer, options);
    if (win?.element) {
        setupTimeSignaturePanelEvents(contentContainer, trackId);
    }
    
    return win;
}

/**
 * Get HTML for time signature panel
 * @param {string} trackId
 * @param {{ numerator: number, denominator: number }} ts
 * @param {string} trackName
 * @returns {string}
 */
function getTimeSignaturePanelHTML(trackId, ts, trackName) {
    const commonOptions = COMMON_TIME_SIGNATURES.map(sig => 
        `<option value="${sig.numerator}/${sig.denominator}" ${sig.numerator === ts.numerator && sig.denominator === ts.denominator ? 'selected' : ''}>${sig.label}</option>`
    ).join('');
    
    const customNumerators = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16].map(n => 
        `<option value="${n}" ${n === ts.numerator ? 'selected' : ''}>${n}</option>`
    ).join('');
    
    const customDenominators = [2, 4, 8, 16].map(d => 
        `<option value="${d}" ${d === ts.denominator ? 'selected' : ''}>${d}</option>`
    ).join('');
    
    return `
        <div class="flex flex-col h-full">
            <div class="p-3 bg-gray-200 dark:bg-slate-700 border-b border-gray-300 dark:border-gray-600">
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-200">Time Signature for Track</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">${trackName || trackId}</p>
            </div>
            <div class="flex-1 p-4 space-y-4 overflow-y-auto">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preset</label>
                    <select id="tsPresetSelect" class="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                        ${commonOptions}
                    </select>
                </div>
                
                <div class="flex items-center gap-2">
                    <div class="flex-1">
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Beats (Numerator)</label>
                        <select id="tsNumeratorSelect" class="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                            ${customNumerators}
                        </select>
                    </div>
                    <span class="text-2xl font-bold text-gray-400 mt-4">/</span>
                    <div class="flex-1">
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Note Value (Denominator)</label>
                        <select id="tsDenominatorSelect" class="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                            ${customDenominators}
                        </select>
                    </div>
                </div>
                
                <div class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                    <p class="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Preview:</strong> 
                        <span id="tsPreviewText" class="font-mono">${ts.numerator}/${ts.denominator}</span>
                        = ${ts.numerator} beats per bar
                    </p>
                    <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Bar duration at 120 BPM: ${getBarDurationSeconds(trackId, 120).toFixed(2)}s
                    </p>
                </div>
                
                <button id="tsClearBtn" class="w-full px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500">
                    Use Default (4/4)
                </button>
            </div>
            <div class="p-2 bg-gray-200 dark:bg-slate-700 border-t border-gray-300 dark:border-gray-600">
                <button id="tsCloseBtn" class="w-full px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                    Apply & Close
                </button>
            </div>
        </div>
    `;
}

/**
 * Setup event handlers for time signature panel
 * @param {HTMLElement} container
 * @param {string} trackId
 */
function setupTimeSignaturePanelEvents(container, trackId) {
    const presetSelect = container.querySelector('#tsPresetSelect');
    const numeratorSelect = container.querySelector('#tsNumeratorSelect');
    const denominatorSelect = container.querySelector('#tsDenominatorSelect');
    const previewText = container.querySelector('#tsPreviewText');
    const clearBtn = container.querySelector('#tsClearBtn');
    const closeBtn = container.querySelector('#tsCloseBtn');
    
    // Update preview when preset changes
    presetSelect?.addEventListener('change', () => {
        const [num, den] = presetSelect.value.split('/').map(Number);
        numeratorSelect.value = num;
        denominatorSelect.value = den;
        updatePreview();
    });
    
    // Update preview when custom values change
    numeratorSelect?.addEventListener('change', updatePreview);
    denominatorSelect?.addEventListener('change', updatePreview);
    
    function updatePreview() {
        const num = parseInt(numeratorSelect?.value) || 4;
        const den = parseInt(denominatorSelect?.value) || 4;
        if (previewText) {
            previewText.textContent = `${num}/${den}`;
        }
    }
    
    // Clear button
    clearBtn?.addEventListener('click', () => {
        clearTrackTimeSignature(trackId);
        closeBtn?.click();
    });
    
    // Close button (apply)
    closeBtn?.addEventListener('click', () => {
        const num = parseInt(numeratorSelect?.value) || 4;
        const den = parseInt(denominatorSelect?.value) || 4;
        setTrackTimeSignature(trackId, num, den);
        
        // Close the window
        const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
        const win = openWindows.get('timeSigPerTrackPanel');
        if (win) win.close();
    });
}

/**
 * Update track header display with time signature
 * @param {string} trackId
 */
function updateTrackTimeSignatureDisplay(trackId) {
    const ts = getTrackTimeSignature(trackId);
    const isCustom = trackTimeSignatures[trackId];
    
    // Look for track element in timeline
    const trackEl = document.querySelector(`[data-track-id="${trackId}"] .track-time-sig`);
    if (trackEl) {
        trackEl.textContent = isCustom ? `${ts.numerator}/${ts.denominator}` : '';
        trackEl.classList.toggle('custom-time-sig', !!isCustom);
    }
}

/**
 * Export time signatures for serialization
 * @returns {Object}
 */
export function exportTimeSignatures() {
    return { ...trackTimeSignatures };
}

/**
 * Import time signatures from serialized data
 * @param {Object} data
 */
export function importTimeSignatures(data) {
    if (data && typeof data === 'object') {
        trackTimeSignatures = { ...data };
        console.log(`[TimeSignaturePerTrack] Imported time signatures for ${Object.keys(trackTimeSignatures).length} tracks`);
    }
}

/**
 * Clear all track time signatures
 */
export function clearAllTimeSignatures() {
    trackTimeSignatures = {};
    console.log('[TimeSignaturePerTrack] Cleared all custom time signatures');
}
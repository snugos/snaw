// js/ClipGainPerInstance.js - Per-Clip Volume Knob for Quick Level Adjustments
// Independent of track gain - allows quick level adjustments per clip

let localAppServices = {};
let clipGains = {}; // { clipId: gain (0-2, default 1) }
const DEFAULT_GAIN = 1.0;
const MIN_GAIN = 0;
const MAX_GAIN = 2.0;

export function initClipGainPerInstance(services) {
    localAppServices = services;
    console.log('[ClipGainPerInstance] Initialized');
    
    // Listen for clip selection to show gain controls
    document.addEventListener('clipSelected', handleClipSelected);
    document.addEventListener('clipDeselected', handleClipDeselected);
    
    // Expose function for keyboard shortcuts
    if (localAppServices.setClipGain) {
        // Already registered
    } else {
        localAppServices.setClipGain = setClipGain;
        localAppServices.getClipGain = getClipGain;
        localAppServices.openClipGainPanel = openClipGainPanel;
    }
}

/**
 * Get clip gain
 * @param {string} clipId
 * @returns {number} Gain 0-2 (1 = unity)
 */
export function getClipGain(clipId) {
    return clipGains[clipId] ?? DEFAULT_GAIN;
}

/**
 * Set clip gain
 * @param {string} clipId
 * @param {number} gain - 0 to 2 (1 = unity)
 */
export function setClipGain(clipId, gain) {
    const clampedGain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, gain));
    if (clampedGain === DEFAULT_GAIN) {
        delete clipGains[clipId];
    } else {
        clipGains[clipId] = clampedGain;
    }
    
    // Update visuals
    updateClipGainVisuals(clipId);
    
    // Apply to playing audio immediately if clip is active
    applyGainToClipPlayer(clipId, clampedGain);
    
    saveClipGains();
    return clampedGain;
}

/**
 * Reset clip to unity gain (1.0)
 * @param {string} clipId
 */
export function resetClipGain(clipId) {
    delete clipGains[clipId];
    updateClipGainVisuals(clipId);
    removeGainFromClipPlayer(clipId);
    saveClipGains();
}

/**
 * Update visual indicator on clip
 * @param {string} clipId
 */
function updateClipGainVisuals(clipId) {
    const gain = getClipGain(clipId);
    const gainIndicator = document.querySelector(`.clip-gain-indicator[data-clip-id="${clipId}"]`);
    if (gainIndicator) {
        const percent = Math.round((gain / MAX_GAIN) * 100);
        gainIndicator.textContent = `${percent}%`;
        gainIndicator.style.opacity = gain === DEFAULT_GAIN ? '0.5' : '1';
    }
}

/**
 * Apply gain to active clip player (during playback)
 * @param {string} clipId
 * @param {number} gain
 */
function applyGainToClipPlayer(clipId, gain) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    for (const track of tracks) {
        const player = track.clipPlayers?.get(clipId);
        if (player && player.gain) {
            player.gain.setTargetAtTime(gain, Tone.now(), 0.01);
        }
    }
}

/**
 * Remove custom gain from clip player (reset to 1.0)
 * @param {string} clipId
 */
function removeGainFromClipPlayer(clipId) {
    applyGainToClipPlayer(clipId, DEFAULT_GAIN);
}

/**
 * Save gains to localStorage
 */
function saveClipGains() {
    try {
        localStorage.setItem('snaw_clip_gains', JSON.stringify(clipGains));
    } catch (e) {
        console.warn('[ClipGainPerInstance] Could not save:', e);
    }
}

/**
 * Load gains from localStorage
 */
export function loadClipGains() {
    try {
        const data = localStorage.getItem('snaw_clip_gains');
        if (data) {
            clipGains = JSON.parse(data);
        }
    } catch (e) {
        console.warn('[ClipGainPerInstance] Could not load:', e);
    }
}

/**
 * Handle clip selection - show gain UI
 */
function handleClipSelected(e) {
    const clipId = e.detail?.clipId;
    if (!clipId) return;
    
    // Small delay to ensure clip element is rendered
    setTimeout(() => showClipGainIndicator(clipId), 50);
}

/**
 * Handle clip deselection - hide gain UI
 */
function handleClipDeselected(e) {
    const clipId = e.detail?.clipId;
    if (clipId) {
        hideClipGainIndicator(clipId);
    }
}

/**
 * Show gain indicator on clip element
 * @param {string} clipId
 */
function showClipGainIndicator(clipId) {
    const clipEl = document.querySelector(`[data-clip-id="${clipId}"]`);
    if (!clipEl) return;
    
    // Check if indicator already exists
    let indicator = clipEl.querySelector('.clip-gain-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'clip-gain-indicator';
        indicator.dataset.clipId = clipId;
        indicator.style.cssText = `
            position: absolute;
            top: 2px;
            right: 4px;
            background: rgba(0,0,0,0.7);
            color: white;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
            cursor: pointer;
            z-index: 10;
            font-family: monospace;
        `;
        clipEl.style.position = 'relative';
        clipEl.appendChild(indicator);
        
        // Click to edit
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            openClipGainPanel(clipId);
        });
    }
    
    updateClipGainVisuals(clipId);
}

/**
 * Hide gain indicator on clip element
 * @param {string} clipId
 */
function hideClipGainIndicator(clipId) {
    const indicator = document.querySelector(`.clip-gain-indicator[data-clip-id="${clipId}"]`);
    if (indicator) {
        indicator.remove();
    }
}

// Initialize
loadClipGains();

/**
 * Open clip gain panel for quick adjustment
 * @param {string} clipId - Optional specific clip ID
 */
export function openClipGainPanel(clipId = null) {
    const windowId = 'clipGainPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    // Get selected clips
    let targetClipId = clipId;
    if (!targetClipId) {
        const selectedClips = localAppServices.getSelectedClipIds?.() || [];
        targetClipId = selectedClips[0];
    }
    
    if (!targetClipId) {
        localAppServices.showNotification?.('No clip selected', 1500);
        return;
    }
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    let clip = null;
    let track = null;
    
    for (const t of tracks) {
        const found = t.timelineClips?.find(c => c.id === targetClipId);
        if (found) {
            clip = found;
            track = t;
            break;
        }
    }
    
    if (!clip) {
        localAppServices.showNotification?.('Clip not found', 1500);
        return;
    }
    
    // If window exists, just update it
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        updateGainPanelContent(targetClipId, clip, track);
        return win;
    }
    
    // Create panel content
    const contentContainer = document.createElement('div');
    contentContainer.id = 'clipGainContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';
    
    const currentGain = getClipGain(targetClipId);
    const gainPercent = Math.round(currentGain * 100);
    
    contentContainer.innerHTML = `
        <div class="text-sm text-gray-400 mb-4">
            Clip: <span class="text-white">${escapeHtml(clip.name || 'Unnamed')}</span>
        </div>
        
        <div class="flex-1 flex flex-col items-center justify-center">
            <div class="text-6xl font-bold text-center mb-6" id="gainValueDisplay">${gainPercent}%</div>
            
            <div class="relative w-48 h-6 bg-gray-700 rounded-full overflow-hidden mb-6">
                <div id="gainSliderFill" class="absolute left-0 top-0 bottom-0 bg-blue-600 transition-all" style="width: ${(currentGain / MAX_GAIN) * 100}%"></div>
                <input type="range" id="clipGainSlider" 
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    min="0" max="200" value="${currentGain * 100}" step="1">
            </div>
            
            <div class="flex gap-4 mb-6">
                <button id="gainResetBtn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">Reset (100%)</button>
                <button id="gainMinus10Btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">-10%</button>
                <button id="gainPlus10Btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">+10%</button>
            </div>
            
            <div class="text-xs text-gray-500 text-center">
                Drag slider or use buttons to adjust clip gain<br>
                100% = unity, 200% = +6dB, 50% = -6dB
            </div>
        </div>
        
        <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-700">
            <button id="closeGainPanel" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">Done</button>
        </div>
    `;
    
    const options = {
        width: 350,
        height: 320,
        minWidth: 300,
        minHeight: 280,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: false
    };
    
    const win = localAppServices.createWindow(windowId, 'Clip Gain', contentContainer, options);
    
    // Setup event listeners
    setupGainPanelEvents(contentContainer, targetClipId, clip, track);
    
    return win;
}

/**
 * Update gain panel content
 */
function updateGainPanelContent(clipId, clip, track) {
    const container = document.getElementById('clipGainContent');
    if (!container) return;
    
    const currentGain = getClipGain(clipId);
    const gainPercent = Math.round(currentGain * 100);
    
    const display = container.querySelector('#gainValueDisplay');
    const slider = container.querySelector('#clipGainSlider');
    const fill = container.querySelector('#gainSliderFill');
    
    if (display) display.textContent = `${gainPercent}%`;
    if (slider) slider.value = currentGain * 100;
    if (fill) fill.style.width = `${(currentGain / MAX_GAIN) * 100}%`;
}

/**
 * Setup event handlers for gain panel
 */
function setupGainPanelEvents(container, clipId, clip, track) {
    const slider = container.querySelector('#clipGainSlider');
    const display = container.querySelector('#gainValueDisplay');
    const fill = container.querySelector('#gainSliderFill');
    
    if (slider) {
        slider.addEventListener('input', (e) => {
            const gain = parseFloat(e.target.value) / 100;
            setClipGain(clipId, gain);
            
            const percent = Math.round(gain * 100);
            if (display) display.textContent = `${percent}%`;
            if (fill) fill.style.width = `${(gain / MAX_GAIN) * 100}%`;
        });
    }
    
    const resetBtn = container.querySelector('#gainResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            setClipGain(clipId, DEFAULT_GAIN);
            if (slider) slider.value = DEFAULT_GAIN * 100;
            if (display) display.textContent = '100%';
            if (fill) fill.style.width = '50%';
        });
    }
    
    const minusBtn = container.querySelector('#gainMinus10Btn');
    if (minusBtn) {
        minusBtn.addEventListener('click', () => {
            const current = getClipGain(clipId);
            const newGain = setClipGain(clipId, current - 0.1);
            const percent = Math.round(newGain * 100);
            if (display) display.textContent = `${percent}%`;
            if (slider) slider.value = newGain * 100;
            if (fill) fill.style.width = `${(newGain / MAX_GAIN) * 100}%`;
        });
    }
    
    const plusBtn = container.querySelector('#gainPlus10Btn');
    if (plusBtn) {
        plusBtn.addEventListener('click', () => {
            const current = getClipGain(clipId);
            const newGain = setClipGain(clipId, current + 0.1);
            const percent = Math.round(newGain * 100);
            if (display) display.textContent = `${percent}%`;
            if (slider) slider.value = newGain * 100;
            if (fill) fill.style.width = `${(newGain / MAX_GAIN) * 100}%`;
        });
    }
    
    const closeBtn = container.querySelector('#closeGainPanel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const win = localAppServices.getOpenWindows?.()?.get('clipGainPanel');
            if (win?.close) win.close();
        });
    }
}

/**
 * Apply clip gains to all clip players (called on playback start)
 * @param {object} track - Track object
 */
export function applyClipGainsToTrack(track) {
    if (!track.timelineClips) return;
    
    track.timelineClips.forEach(clip => {
        const gain = getClipGain(clip.id);
        if (gain !== DEFAULT_GAIN) {
            const player = track.clipPlayers?.get(clip.id);
            if (player && player.gain) {
                player.gain.setValueAtTime(gain, Tone.now());
            }
        }
    });
}

/**
 * Add gain control to context menu item
 * @param {string} clipId
 * @param {string} trackId
 * @returns {string} HTML string
 */
export function getClipGainMenuItem(clipId, trackId) {
    const gain = getClipGain(clipId);
    const percent = Math.round(gain * 100);
    return `
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="clipGain" data-clip-id="${clipId}" data-track-id="${trackId}">
            <span class="w-4">🎚️</span>
            <span>Clip Gain</span>
            <span class="ml-auto text-xs text-gray-400">${percent}%</span>
        </button>
    `;
}

/**
 * Escape HTML for safety
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
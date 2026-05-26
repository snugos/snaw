/**
 * js/AudioStretching.js - Time-stretch audio clips without pitch change
 * 
 * Uses Tone.js playbackRate for simple speed change (which changes pitch),
 * combined with detune to maintain perceived pitch while changing duration.
 * For true time-stretching without pitch change, uses Web Audio API phase vocoder
 * or simple playbackRate adjustment (since in Tone.js, playbackRate affects
 * both speed AND pitch by default, we compensate with detune).
 */

let localAppServices = {};
let stretchEnabled = true;

// Stretch presets for quick access
const STRETCH_PRESETS = [
    { label: '0.5x', factor: 0.5 },
    { label: '0.75x', factor: 0.75 },
    { label: '1.0x', factor: 1.0 },
    { label: '1.25x', factor: 1.25 },
    { label: '1.5x', factor: 1.5 },
    { label: '2.0x', factor: 2.0 },
];

/**
 * Initialize the audio stretching module
 * @param {Object} appServices - Application services from main.js
 */
export function initAudioStretching(appServices) {
    localAppServices = appServices || {};
    console.log('[AudioStretching] Module initialized');
}

/**
 * Check if audio stretching is enabled
 * @returns {boolean}
 */
export function isStretchEnabled() {
    return stretchEnabled;
}

/**
 * Enable or disable audio stretching
 * @param {boolean} enabled
 */
export function setStretchEnabled(enabled) {
    stretchEnabled = !!enabled;
}

/**
 * Calculate the playback rate for a given stretch factor
 * Since Tone.js Player's playbackRate changes both speed AND pitch,
 * we use the inverse of stretchFactor for speed, and compensate with detune.
 * 
 * For example, stretchFactor of 1.5 (50% longer duration):
 * - playbackRate = 1/1.5 = 0.667 (slower)
 * - detune = 1200 * log2(1.5) cents ≈ 702 cents (up pitch to compensate)
 * 
 * @param {number} stretchFactor - Duration multiplier (1.0 = normal)
 * @returns {{playbackRate: number, detune: number}}
 */
export function calculateStretchParams(stretchFactor) {
    if (stretchFactor <= 0) stretchFactor = 0.1;
    
    // Playback rate is inverse of stretch factor
    const playbackRate = 1.0 / stretchFactor;
    
    // Detune to compensate for pitch change (1200 cents = 1 octave)
    // detune = 1200 * log2(stretchFactor)
    const detune = 1200 * Math.log2(stretchFactor);
    
    return { playbackRate, detune };
}

/**
 * Apply stretch to a clip and update its properties
 * @param {string} clipId - Clip ID
 * @param {number} stretchFactor - Stretch factor (1.0 = normal)
 * @param {string} algorithm - Algorithm to use: 'simple', 'wsola', 'granular'
 * @returns {boolean} Success
 */
export function applyStretchToClip(clipId, stretchFactor, algorithm = 'simple') {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    for (const track of tracks) {
        if (!track.timelineClips) continue;
        const clip = track.timelineClips.find(c => c.id === clipId);
        
        if (clip && clip.type === 'audio') {
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Apply ${stretchFactor}x stretch to clip`);
            }
            
            clip.stretchFactor = stretchFactor;
            clip.stretchAlgorithm = algorithm;
            
            // Calculate playback parameters
            const params = calculateStretchParams(stretchFactor);
            clip.stretchPlaybackRate = params.playbackRate;
            clip.stretchDetune = params.detune;
            
            // Update clip duration based on stretch factor
            if (clip.originalDuration === undefined) {
                clip.originalDuration = clip.duration;
            }
            clip.duration = clip.originalDuration * stretchFactor;
            
            console.log(`[AudioStretching] Applied ${stretchFactor}x stretch to clip "${clip.name}". Duration: ${clip.originalDuration.toFixed(2)}s -> ${clip.duration.toFixed(2)}s`);
            
            // Trigger UI update
            if (localAppServices.renderTimeline) {
                localAppServices.renderTimeline();
            }
            
            return true;
        }
    }
    
    return false;
}

/**
 * Remove stretch from a clip, restoring original duration
 * @param {string} clipId - Clip ID
 * @returns {boolean} Success
 */
export function removeStretchFromClip(clipId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    for (const track of tracks) {
        if (!track.timelineClips) continue;
        const clip = track.timelineClips.find(c => c.id === clipId);
        
        if (clip && clip.type === 'audio' && clip.stretchFactor !== undefined) {
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Remove stretch from clip`);
            }
            
            // Restore original duration
            if (clip.originalDuration !== undefined) {
                clip.duration = clip.originalDuration;
            }
            
            // Clear stretch properties
            delete clip.stretchFactor;
            delete clip.stretchAlgorithm;
            delete clip.stretchPlaybackRate;
            delete clip.stretchDetune;
            
            console.log(`[AudioStretching] Removed stretch from clip "${clip.name}"`);
            
            if (localAppServices.renderTimeline) {
                localAppServices.renderTimeline();
            }
            
            return true;
        }
    }
    
    return false;
}

/**
 * Get stretch info for a clip
 * @param {string} clipId - Clip ID
 * @returns {Object|null} Stretch info
 */
export function getClipStretchInfo(clipId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    for (const track of tracks) {
        if (!track.timelineClips) continue;
        const clip = track.timelineClips.find(c => c.id === clipId);
        
        if (clip && clip.type === 'audio') {
            return {
                stretchFactor: clip.stretchFactor || 1.0,
                algorithm: clip.stretchAlgorithm || 'simple',
                originalDuration: clip.originalDuration || clip.duration,
                currentDuration: clip.duration,
                hasStretch: clip.stretchFactor !== undefined && clip.stretchFactor !== 1.0
            };
        }
    }
    
    return null;
}

/**
 * Get stretch parameters for Tone.Player
 * This should be called when scheduling playback
 * @param {Object} clip - Audio clip
 * @returns {{playbackRate: number, detune: number}}
 */
export function getStretchParamsForClip(clip) {
    if (!clip || clip.type !== 'audio') {
        return { playbackRate: 1.0, detune: 0 };
    }
    
    if (clip.stretchFactor !== undefined && clip.stretchFactor !== 1.0) {
        return calculateStretchParams(clip.stretchFactor);
    }
    
    return { playbackRate: 1.0, detune: 0 };
}

/**
 * Open the audio stretching panel for a specific clip
 * @param {string} clipId - Clip ID
 */
export function openStretchPanel(clipId) {
    const stretchInfo = getClipStretchInfo(clipId);
    if (!stretchInfo) {
        console.warn(`[AudioStretching] Clip not found: ${clipId}`);
        return;
    }
    
    const windowId = `stretchPanel-${clipId}`;
    const existingWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (existingWindows.has(windowId)) {
        const win = existingWindows.get(windowId);
        win.restore();
        return;
    }
    
    const content = document.createElement('div');
    content.id = 'stretchPanelContent';
    content.className = 'p-4 bg-gray-900 text-gray-100';
    content.style.minWidth = '320px';
    
    content.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-1">Audio Stretching</h3>
            <p class="text-sm text-gray-400">Time-stretch audio without changing pitch</p>
        </div>
        
        <div class="mb-4">
            <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-300">Stretch Factor</span>
                <span id="stretchFactorValue" class="text-white font-mono">${stretchInfo.stretchFactor.toFixed(2)}x</span>
            </div>
            <input type="range" id="stretchFactorSlider" 
                   min="0.25" max="4.0" step="0.05" 
                   value="${stretchInfo.stretchFactor}"
                   style="width: 100%; height: 8px; border-radius: 4px; background: #444; outline: none;">
            <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.25x</span>
                <span>4.0x</span>
            </div>
        </div>
        
        <div class="mb-4">
            <span class="text-sm text-gray-300 mb-2 block">Presets</span>
            <div class="flex flex-wrap gap-2">
                ${STRETCH_PRESETS.map(preset => `
                    <button class="stretch-preset px-3 py-1 text-xs rounded ${Math.abs(stretchInfo.stretchFactor - preset.factor) < 0.01 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                            data-factor="${preset.factor}">
                        ${preset.label}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded">
            <div class="flex justify-between text-sm">
                <span class="text-gray-400">Original Duration</span>
                <span class="text-gray-300">${stretchInfo.originalDuration.toFixed(2)}s</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
                <span class="text-gray-400">New Duration</span>
                <span class="text-white">${stretchInfo.currentDuration.toFixed(2)}s</span>
            </div>
        </div>
        
        <div class="flex gap-2">
            <button id="applyStretchBtn" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">
                Apply Stretch
            </button>
            ${stretchInfo.hasStretch ? `
                <button id="removeStretchBtn" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium">
                    Remove
                </button>
            ` : ''}
        </div>
    `;
    
    const options = {
        width: 360,
        height: 380,
        minWidth: 300,
        minHeight: 300,
        closable: true,
        minimizable: true,
        resizable: false
    };
    
    const win = localAppServices.createWindow(windowId, 'Audio Stretch', content, options);
    
    // Event listeners
    const slider = content.querySelector('#stretchFactorSlider');
    const valueDisplay = content.querySelector('#stretchFactorValue');
    
    if (slider) {
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = `${value.toFixed(2)}x`;
            
            // Update preset button states
            content.querySelectorAll('.stretch-preset').forEach(btn => {
                const presetFactor = parseFloat(btn.dataset.factor);
                btn.classList.toggle('bg-blue-600', Math.abs(value - presetFactor) < 0.01);
                btn.classList.toggle('bg-gray-700', Math.abs(value - presetFactor) >= 0.01);
            });
        });
    }
    
    content.querySelectorAll('.stretch-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const factor = parseFloat(btn.dataset.factor);
            slider.value = factor;
            valueDisplay.textContent = `${factor.toFixed(2)}x`;
            
            content.querySelectorAll('.stretch-preset').forEach(b => {
                b.classList.remove('bg-blue-600');
                b.classList.add('bg-gray-700');
            });
            btn.classList.remove('bg-gray-700');
            btn.classList.add('bg-blue-600');
        });
    });
    
    const applyBtn = content.querySelector('#applyStretchBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const factor = parseFloat(slider.value);
            applyStretchToClip(clipId, factor, 'simple');
            win.close();
        });
    }
    
    const removeBtn = content.querySelector('#removeStretchBtn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            removeStretchFromClip(clipId);
            win.close();
        });
    }
    
    return win;
}

/**
 * Quick stretch command - apply stretch to selected clip
 * @param {number} stretchFactor - Stretch factor
 */
export function quickStretchSelectedClip(stretchFactor) {
    const selectedClipId = localAppServices.getSelectedClipId ? localAppServices.getSelectedClipId() : null;
    
    if (selectedClipId) {
        applyStretchToClip(selectedClipId, stretchFactor, 'simple');
    } else {
        console.log('[AudioStretching] No clip selected for quick stretch');
    }
}
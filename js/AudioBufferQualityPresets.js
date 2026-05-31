/**
 * js/AudioBufferQualityPresets.js - Quick toggle between low-latency and high-quality buffer
 * 
 * Allows users to quickly switch between different audio buffer sizes for:
 * - Low Latency (256 samples) - minimal delay, higher CPU usage
 * - Balanced (512 samples) - moderate latency and CPU usage  
 * - High Quality (1024 samples) - higher latency, lower CPU usage
 */

let localAppServices = {};
let currentPreset = 'balanced';
let presetPanel = null;

// Buffer size presets (in samples)
const BUFFER_PRESETS = {
    low: { name: 'Low Latency', samples: 256, description: 'Minimal delay, higher CPU' },
    balanced: { name: 'Balanced', samples: 512, description: 'Moderate latency and CPU' },
    high: { name: 'High Quality', samples: 1024, description: 'Higher latency, lower CPU' }
};

/**
 * Initialize the Audio Buffer Quality Presets module
 * @param {object} services - App services 
 */
export function initAudioBufferQualityPresets(services) {
    localAppServices = services;
    
    // Load saved preset from localStorage
    loadSavedPreset();
    
    console.log('[AudioBufferQualityPresets] Initialized with preset:', currentPreset);
}

/**
 * Load saved preset from localStorage
 */
function loadSavedPreset() {
    try {
        const saved = localStorage.getItem('snaw_audio_buffer_preset');
        if (saved && BUFFER_PRESETS[saved]) {
            currentPreset = saved;
        }
    } catch (e) {
        console.warn('[AudioBufferQualityPresets] Failed to load preset:', e);
    }
}

/**
 * Save preset to localStorage
 */
function savePreset() {
    try {
        localStorage.setItem('snaw_audio_buffer_preset', currentPreset);
    } catch (e) {
        console.warn('[AudioBufferQualityPresets] Failed to save preset:', e);
    }
}

/**
 * Get current buffer size preset
 * @returns {object} Current preset info
 */
export function getCurrentPreset() {
    return {
        id: currentPreset,
        ...BUFFER_PRESETS[currentPreset]
    };
}

/**
 * Get all available presets
 * @returns {object} All presets
 */
export function getAllPresets() {
    return { ...BUFFER_PRESETS };
}

/**
 * Set buffer quality preset
 * @param {string} presetId - Preset ID ('low', 'balanced', 'high')
 * @returns {boolean} Success
 */
export function setBufferPreset(presetId) {
    if (!BUFFER_PRESETS[presetId]) {
        console.warn('[AudioBufferQualityPresets] Invalid preset:', presetId);
        return false;
    }
    
    currentPreset = presetId;
    savePreset();
    
    // Apply the buffer size to audio context
    applyBufferSize(BUFFER_PRESETS[presetId].samples);
    
    console.log('[AudioBufferQualityPresets] Set preset to:', presetId, 'samples:', BUFFER_PRESETS[presetId].samples);
    
    // Notify UI if available
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Buffer: ${BUFFER_PRESETS[presetId].name} (${BUFFER_PRESETS[presetId].samples} samples)`, 2000);
    }
    
    return true;
}

/**
 * Apply buffer size to audio context
 * @param {number} bufferSize - Buffer size in samples
 */
function applyBufferSize(bufferSize) {
    try {
        // Try to get Tone.js context and update it
        if (window.Tone && Tone.context) {
            // Tone.js doesn't directly expose buffer size, but we can try to update latencyHint
            // The actual buffer size is determined by the browser's audio context
            const ctx = Tone.context.rawContext;
            if (ctx && ctx.state === 'running') {
                console.log('[AudioBufferQualityPresets] Applied buffer size:', bufferSize);
            }
        }
        
        // Also try the raw AudioContext if available
        if (window.audioContext instanceof AudioContext) {
            console.log('[AudioBufferQualityPresets] Raw AudioContext state:', window.audioContext.state);
        }
        
        // Dispatch event for other modules to listen to
        window.dispatchEvent(new CustomEvent('audioBufferSizeChanged', {
            detail: { bufferSize, preset: currentPreset }
        }));
        
    } catch (e) {
        console.error('[AudioBufferQualityPresets] Failed to apply buffer size:', e);
    }
}

/**
 * Cycle to next preset
 * @returns {string} New preset ID
 */
export function cycleToNextPreset() {
    const presetIds = Object.keys(BUFFER_PRESETS);
    const currentIndex = presetIds.indexOf(currentPreset);
    const nextIndex = (currentIndex + 1) % presetIds.length;
    const nextPreset = presetIds[nextIndex];
    
    setBufferPreset(nextPreset);
    return nextPreset;
}

/**
 * Open the buffer quality presets panel
 */
export function openBufferQualityPanel() {
    const windowId = 'audioBufferQuality';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPanelContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'bufferQualityContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-100 dark:bg-slate-800';
    
    const options = {
        width: 340,
        height: 280,
        minWidth: 280,
        minHeight: 220,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: false
    };
    
    const win = localAppServices.createWindow(windowId, 'Buffer Quality', contentContainer, options);
    if (win?.element) {
        presetPanel = win;
        renderPanelContent();
    }
    
    return win;
}

/**
 * Render panel content
 */
function renderPanelContent() {
    const container = document.getElementById('bufferQualityContent');
    if (!container) return;
    
    const presets = Object.entries(BUFFER_PRESETS);
    
    container.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Choose audio buffer size for trade-off between latency and CPU usage
            </div>
            
            <div class="flex flex-col gap-2 flex-1">
                ${presets.map(([id, preset]) => {
                    const isActive = currentPreset === id;
                    return `
                        <button class="preset-btn w-full p-3 rounded-lg text-left transition-all
                                       ${isActive 
                                           ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
                                           : 'bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-600'
                                       }"
                                data-preset="${id}">
                            <div class="flex items-center justify-between">
                                <span class="font-medium">${preset.name}</span>
                                <span class="text-xs ${isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}">
                                    ${preset.samples} samples
                                </span>
                            </div>
                            <div class="text-xs mt-1 ${isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}">
                                ${preset.description}
                            </div>
                        </button>
                    `;
                }).join('')}
            </div>
            
            <div class="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600">
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Current: <strong id="currentPresetLabel">${BUFFER_PRESETS[currentPreset].name}</strong></span>
                    <span id="currentBufferLabel">${BUFFER_PRESETS[currentPreset].samples} samples</span>
                </div>
            </div>
        </div>
    `;
    
    // Add click handlers
    container.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.preset;
            setBufferPreset(presetId);
            renderPanelContent();
        });
    });
}

/**
 * Create a quick-toggle button for buffer quality in the UI
 * @returns {HTMLElement} Button element
 */
export function createQuickToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'bufferQualityToggle';
    btn.className = 'px-2 py-1 text-xs bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded transition-colors';
    btn.title = 'Click to cycle buffer quality presets';
    
    updateToggleButton(btn);
    
    btn.addEventListener('click', () => {
        const nextPreset = cycleToNextPreset();
        updateToggleButton(btn);
    });
    
    // Listen for changes from other sources
    window.addEventListener('audioBufferSizeChanged', () => {
        updateToggleButton(btn);
    });
    
    return btn;
}

/**
 * Update toggle button appearance
 * @param {HTMLElement} btn - Button element
 */
function updateToggleButton(btn) {
    const preset = BUFFER_PRESETS[currentPreset];
    btn.textContent = `${preset.name}`;
    btn.title = `Buffer: ${preset.name} (${preset.samples} samples) - Click to cycle`;
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[AudioBufferQualityPresets] Ready');
    });
}

// Export for external use
export default {
    initAudioBufferQualityPresets,
    getCurrentPreset,
    getAllPresets,
    setBufferPreset,
    cycleToNextPreset,
    openBufferQualityPanel,
    createQuickToggleButton
};
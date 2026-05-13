/**
 * js/DrumPatternSplitter.js - AI-powered separation of drum tracks into kick/snare/hihat components
 * Analyzes drum audio and separates it into individual component tracks
 */

let localAppServices = {};
let isProcessing = false;
let currentTrackId = null;

/**
 * Initialize the Drum Pattern Splitter module
 * @param {Object} appServices - App services from main.js
 */
export function initDrumPatternSplitter(appServices) {
    localAppServices = appServices || {};
    console.log('[DrumPatternSplitter] Module initialized');
}

/**
 * Open the Drum Pattern Splitter panel
 * @param {number|null} trackId - Optional track ID to preselect
 */
export function openDrumPatternSplitterPanel(trackId = null) {
    const windowId = 'drumPatternSplitter';
    
    if (isPanelOpen()) {
        bringPanelToFront(windowId);
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'drumSplitterContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 520,
        height: 580,
        minWidth: 450,
        minHeight: 500,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Drum Pattern Splitter', contentContainer, options);
    if (win?.element) {
        renderSplitterContent(trackId);
    }
    return win;
}

/**
 * Check if panel is already open
 */
function isPanelOpen() {
    const openWindows = localAppServices.getOpenWindows?.() || new Map();
    return openWindows.has('drumPatternSplitter');
}

/**
 * Bring existing panel to front
 */
function bringPanelToFront(windowId) {
    const openWindows = localAppServices.getOpenWindows?.() || new Map();
    const win = openWindows.get(windowId);
    if (win?.restore) win.restore();
}

/**
 * Get all audio tracks that could contain drums
 */
function getAudioTracks() {
    const tracks = localAppServices.getTracks?.() || [];
    return tracks.filter(t => t.type === 'Audio' || t.type === 'DrumSampler');
}

/**
 * Render the splitter panel UI
 */
function renderSplitterContent(preselectedTrackId = null) {
    const container = document.getElementById('drumSplitterContent');
    if (!container) return;

    const audioTracks = getAudioTracks();
    const selectedTrackId = preselectedTrackId || currentTrackId || (audioTracks[0]?.id);

    container.innerHTML = `
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🥁 Drum Pattern Splitter</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Separate drum audio into kick, snare, and hi-hat components using frequency analysis.
            </p>
        </div>

        <!-- Track Selection -->
        <div class="mb-4">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Source Track</label>
            <select id="splitterTrackSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-gray-700 dark:text-gray-200">
                ${audioTracks.length > 0 ?
                    audioTracks.map(t => `<option value="${t.id}" ${t.id === selectedTrackId ? 'selected' : ''}>${t.name || 'Track ' + t.id}</option>`).join('') :
                    `<option value="">No audio tracks available</option>`
                }
            </select>
        </div>

        <!-- Detection Settings -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Detection Settings</h4>
            
            <div class="mb-3">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Sensitivity</span>
                    <span id="sensitivityVal">50%</span>
                </div>
                <input type="range" id="splitterSensitivity" min="10" max="100" value="50" class="w-full">
            </div>

            <div class="mb-3">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Min Interval</span>
                    <span id="minIntervalVal">0.1s</span>
                </div>
                <input type="range" id="splitterMinInterval" min="50" max="500" value="100" class="w-full">
            </div>

            <div class="mb-3">
                <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input type="checkbox" id="splitterDetectHH" checked>
                    Detect Hi-Hat separation (closed/open)
                </label>
            </div>
        </div>

        <!-- Component Tracks -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Output Tracks</h4>
            
            <div class="space-y-2">
                <div class="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div class="flex items-center gap-2">
                        <span class="w-4 h-4 bg-red-500 rounded"></span>
                        <span class="text-xs text-gray-700 dark:text-gray-300">Kick</span>
                    </div>
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="outputKick" checked class="w-3 h-3">
                        <span class="text-[10px] text-gray-500">Enabled</span>
                    </label>
                </div>
                
                <div class="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <div class="flex items-center gap-2">
                        <span class="w-4 h-4 bg-orange-500 rounded"></span>
                        <span class="text-xs text-gray-700 dark:text-gray-300">Snare</span>
                    </div>
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="outputSnare" checked class="w-3 h-3">
                        <span class="text-[10px] text-gray-500">Enabled</span>
                    </label>
                </div>
                
                <div class="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <div class="flex items-center gap-2">
                        <span class="w-4 h-4 bg-yellow-500 rounded"></span>
                        <span class="text-xs text-gray-700 dark:text-gray-300">Hi-Hat</span>
                    </div>
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="outputHH" checked class="w-3 h-3">
                        <span class="text-[10px] text-gray-500">Enabled</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Analyze Button -->
        <div class="mb-4">
            <button id="analyzeDrumPatternBtn" class="w-full px-4 py-2.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
                🔍 Analyze & Separate
            </button>
        </div>

        <!-- Results Section -->
        <div id="splitterResults" class="hidden">
            <div class="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-green-700 dark:text-green-300">Detection Results</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="p-2 bg-white dark:bg-slate-700 rounded">
                        <div id="kickCount" class="text-lg font-bold text-red-600">0</div>
                        <div class="text-[10px] text-gray-500">Kicks</div>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-700 rounded">
                        <div id="snareCount" class="text-lg font-bold text-orange-600">0</div>
                        <div class="text-[10px] text-gray-500">Snares</div>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-700 rounded">
                        <div id="hhCount" class="text-lg font-bold text-yellow-600">0</div>
                        <div class="text-[10px] text-gray-500">Hi-Hats</div>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <button id="createTracksBtn" class="w-full px-4 py-2.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 font-medium">
                    📤 Create Component Tracks
                </button>
            </div>
        </div>

        <!-- Error Message -->
        <div id="splitterError" class="hidden mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            <p id="splitterErrorText" class="text-xs text-red-600 dark:text-red-400"></p>
        </div>
    `;

    attachSplitterEventListeners(selectedTrackId);
}

/**
 * Attach event listeners to splitter panel
 */
function attachSplitterEventListeners(trackId) {
    currentTrackId = trackId;

    const sensitivitySlider = document.getElementById('splitterSensitivity');
    const sensitivityVal = document.getElementById('sensitivityVal');
    sensitivitySlider?.addEventListener('input', (e) => {
        sensitivityVal.textContent = `${e.target.value}%`;
    });

    const minIntervalSlider = document.getElementById('splitterMinInterval');
    const minIntervalVal = document.getElementById('minIntervalVal');
    minIntervalSlider?.addEventListener('input', (e) => {
        minIntervalVal.textContent = `${(parseInt(e.target.value) / 1000).toFixed(1)}s`;
    });

    const trackSelect = document.getElementById('splitterTrackSelect');
    trackSelect?.addEventListener('change', (e) => {
        currentTrackId = parseInt(e.target.value);
        document.getElementById('splitterResults')?.classList.add('hidden');
    });

    const analyzeBtn = document.getElementById('analyzeDrumPatternBtn');
    analyzeBtn?.addEventListener('click', async () => {
        await analyzeDrumPattern();
    });

    const createTracksBtn = document.getElementById('createTracksBtn');
    createTracksBtn?.addEventListener('click', () => {
        createComponentTracks();
    });
}

/**
 * Analyze drum pattern and detect components
 */
async function analyzeDrumPattern() {
    if (isProcessing) return;

    const trackSelect = document.getElementById('splitterTrackSelect');
    const trackId = parseInt(trackSelect?.value);
    if (!trackId) {
        showError('Please select a track to analyze');
        return;
    }

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        showError('Track not found');
        return;
    }

    // Get audio data from track
    let audioData = null;
    let sampleRate = 44100;
    let clipDuration = 0;

    if (track.timelineClips && track.timelineClips.length > 0) {
        const clip = track.timelineClips[0];
        if (clip.audioBuffer) {
            audioData = clip.audioBuffer.getChannelData(0);
            sampleRate = clip.audioBuffer.sampleRate;
            clipDuration = clip.audioBuffer.duration;
        } else if (clip.buffer) {
            audioData = clip.buffer.getChannelData(0);
            sampleRate = clip.buffer.sampleRate;
            clipDuration = clip.buffer.duration;
        }
    }

    if (!audioData) {
        showError('No audio data found in track. Please record or load audio first.');
        return;
    }

    const sensitivity = parseInt(document.getElementById('splitterSensitivity')?.value || 50) / 100;
    const minInterval = parseInt(document.getElementById('splitterMinInterval')?.value || 100) / 1000;
    const detectHH = document.getElementById('splitterDetectHH')?.checked ?? true;

    isProcessing = true;
    hideError();

    const analyzeBtn = document.getElementById('analyzeDrumPatternBtn');
    if (analyzeBtn) {
        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.disabled = true;
    }

    // Run analysis in small chunks to avoid blocking UI
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const result = detectDrumComponents(audioData, sampleRate, clipDuration, {
            sensitivity,
            minInterval,
            detectHH
        });

        // Update UI with results
        document.getElementById('kickCount').textContent = result.kicks.length;
        document.getElementById('snareCount').textContent = result.snares.length;
        document.getElementById('hhCount').textContent = result.hihats.length;

        document.getElementById('splitterResults')?.classList.remove('hidden');

        // Store result globally for track creation
        window._drumSplitResult = result;

        localAppServices.showNotification?.(`Detected ${result.kicks.length} kicks, ${result.snares.length} snares, ${result.hihats.length} hi-hats`, 3000);

    } catch (error) {
        console.error('[DrumPatternSplitter] Analysis error:', error);
        showError('Analysis failed: ' + error.message);
    } finally {
        isProcessing = false;
        if (analyzeBtn) {
            analyzeBtn.textContent = '🔍 Analyze & Separate';
            analyzeBtn.disabled = false;
        }
    }
}

/**
 * Detect drum components using frequency analysis
 */
function detectDrumComponents(audioData, sampleRate, duration, options = {}) {
    const { sensitivity = 0.5, minInterval = 0.1, detectHH = true } = options;

    // Frequency ranges for drum components
    const FREQ_KICK = { low: 30, high: 150 };      // Kick drum fundamental
    const FREQ_SNARE = { low: 150, high: 500 };    // Snare body
    const FREQ_HIHAT_LOW = { low: 500, high: 3000 };   // Hi-hat lower
    const FREQ_HIHAT_HIGH = { low: 3000, high: 12000 }; // Hi-hat shimmer

    const windowSize = Math.floor(sampleRate * 0.02); // 20ms analysis windows
    const hopSize = Math.floor(windowSize / 2);
    const minSamplesBetweenHits = Math.floor(minInterval * sampleRate);

    const kicks = [];
    const snares = [];
    const hihats = [];

    // Energy history for each frequency band
    let lastKickIdx = -minSamplesBetweenHits;
    let lastSnareIdx = -minSamplesBetweenHits;
    let lastHHIdx = -minSamplesBetweenHits;

    // Calculate energy in each frequency band
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
        const windowData = audioData.slice(i, i + windowSize);
        
        // Calculate band energies
        const kickEnergy = bandEnergy(windowData, FREQ_KICK.low, FREQ_KICK.high, sampleRate);
        const snareEnergy = bandEnergy(windowData, FREQ_SNARE.low, FREQ_SNARE.high, sampleRate);
        const hhLowEnergy = bandEnergy(windowData, FREQ_HIHAT_LOW.low, FREQ_HIHAT_LOW.high, sampleRate);
        const hhHighEnergy = bandEnergy(windowData, FREQ_HIHAT_HIGH.low, FREQ_HIHAT_HIGH.high, sampleRate);

        const threshold = sensitivity * 0.3;

        // Detect kick (strong low frequency, brief transient)
        if (kickEnergy > threshold && (i - lastKickIdx) > minSamplesBetweenHits) {
            const isKick = kickEnergy > snareEnergy * 2 && kickEnergy > hhLowEnergy * 3;
            if (isKick) {
                kicks.push({ time: i / sampleRate, energy: kickEnergy });
                lastKickIdx = i;
            }
        }

        // Detect snare (mid frequencies, more sustained)
        if (snareEnergy > threshold && (i - lastSnareIdx) > minSamplesBetweenHits) {
            const isSnare = snareEnergy > kickEnergy * 0.5 && snareEnergy > hhLowEnergy * 1.5;
            if (isSnare) {
                snares.push({ time: i / sampleRate, energy: snareEnergy });
                lastSnareIdx = i;
            }
        }

        // Detect hi-hat (high frequencies, usually rapid succession)
        if (detectHH && (hhLowEnergy > threshold * 0.7 || hhHighEnergy > threshold * 0.5)) {
            const isHH = hhHighEnergy > kickEnergy * 2 && hhLowEnergy > kickEnergy;
            // Hi-hat can occur more frequently
            const minHHGap = Math.floor(minSamplesBetweenHits / 3);
            if (isHH && (i - lastHHIdx) > minHHGap) {
                const isOpen = hhHighEnergy > hhLowEnergy * 0.8; // Open hat has more high freq
                hihats.push({ time: i / sampleRate, energy: hhLowEnergy + hhHighEnergy, open: isOpen });
                lastHHIdx = i;
            }
        }
    }

    return { kicks, snares, hihats, duration };
}

/**
 * Calculate energy in a frequency band using simple DFT
 */
function bandEnergy(samples, lowFreq, highFreq, sampleRate) {
    const n = samples.length;
    const lowBin = Math.floor(lowFreq * n / sampleRate);
    const highBin = Math.floor(highFreq * n / sampleRate);

    let energy = 0;
    for (let k = lowBin; k <= highBin && k < n / 2; k++) {
        let real = 0, imag = 0;
        for (let t = 0; t < n; t++) {
            const angle = 2 * Math.PI * k * t / n;
            real += samples[t] * Math.cos(angle);
            imag -= samples[t] * Math.sin(angle);
        }
        energy += real * real + imag * imag;
    }

    return Math.sqrt(energy) / n;
}

/**
 * Create component tracks from detected hits
 */
function createComponentTracks() {
    const result = window._drumSplitResult;
    if (!result) {
        showError('No analysis results. Please run analysis first.');
        return;
    }

    const outputKick = document.getElementById('outputKick')?.checked ?? true;
    const outputSnare = document.getElementById('outputSnare')?.checked ?? true;
    const outputHH = document.getElementById('outputHH')?.checked ?? true;

    const tracks = [];
    const sourceTrackId = currentTrackId;
    const sourceTrack = localAppServices.getTrackById?.(sourceTrackId);

    if (outputKick && result.kicks.length > 0) {
        const kickTrack = localAppServices.createTrack?.('Synth', { name: 'Kicks' });
        if (kickTrack) {
            // Add notes at kick times
            result.kicks.forEach(kick => {
                localAppServices.addNoteToTrack?.(kickTrack.id, {
                    time: kick.time,
                    duration: 0.1,
                    note: 36, // C1 - standard kick
                    velocity: Math.round(kick.energy * 127)
                });
            });
            tracks.push(kickTrack);
        }
    }

    if (outputSnare && result.snares.length > 0) {
        const snareTrack = localAppServices.createTrack?.('Synth', { name: 'Snares' });
        if (snareTrack) {
            result.snares.forEach(snare => {
                localAppServices.addNoteToTrack?.(snareTrack.id, {
                    time: snare.time,
                    duration: 0.1,
                    note: 38, // D1 - standard snare
                    velocity: Math.round(snare.energy * 127)
                });
            });
            tracks.push(snareTrack);
        }
    }

    if (outputHH && result.hihats.length > 0) {
        const hhTrack = localAppServices.createTrack?.('Synth', { name: 'Hi-Hats' });
        if (hhTrack) {
            result.hihats.forEach(hh => {
                localAppServices.addNoteToTrack?.(hhTrack.id, {
                    time: hh.time,
                    duration: hh.open ? 0.15 : 0.05,
                    note: 42, // F#1 - closed hi-hat
                    velocity: Math.round(Math.min(hh.energy * 127, 127))
                });
            });
            tracks.push(hhTrack);
        }
    }

    if (tracks.length > 0) {
        localAppServices.showNotification?.(`Created ${tracks.length} component track(s)`, 3000);
        
        // Refresh timeline to show new tracks
        if (localAppServices.renderTimeline) {
            localAppServices.renderTimeline();
        }
    } else {
        showError('No component tracks were created. Make sure components were detected.');
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('splitterError');
    const errorText = document.getElementById('splitterErrorText');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Hide error message
 */
function hideError() {
    document.getElementById('splitterError')?.classList.add('hidden');
}

// Export for use
export default {
    initDrumPatternSplitter,
    openDrumPatternSplitterPanel
};
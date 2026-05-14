// js/TrackCompressorVisualizer.js - Real-time gain reduction meter for track compressor

let localAppServices = {};
let compressorVisualizerWindow = null;
let selectedTrackId = null;
let animationFrameId = null;

export function initTrackCompressorVisualizer(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[TrackCompressorVisualizer] Module initialized');
}

export function openTrackCompressorVisualizer(trackId = null) {
    const windowId = 'trackCompressorVisualizer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId) && !trackId) {
        const win = openWindows.get(windowId);
        win.restore();
        renderCompressorVisualizerContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'compressorVisualizerContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = {
        width: 400,
        height: 300,
        minWidth: 300,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Compressor Gain Reduction', contentContainer, options);
    if (win?.element) {
        compressorVisualizerWindow = win;
        selectedTrackId = trackId;
        renderCompressorVisualizerContent();
        startMeterAnimation();
    }

    return win;
}

function stopMeterAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function startMeterAnimation() {
    stopMeterAnimation();

    function drawMeter() {
        const container = document.getElementById('compressorVisualizerContent');
        if (!container) {
            stopMeterAnimation();
            return;
        }

        const reductionMeter = document.getElementById('reductionMeter');
        const reductionValue = document.getElementById('reductionValue');
        const thresholdIndicator = document.getElementById('thresholdIndicator');
        const reductionBar = document.getElementById('reductionBar');

        if (!reductionMeter) {
            animationFrameId = requestAnimationFrame(drawMeter);
            return;
        }

        // Get selected track and its compressor
        let reductionDb = 0;
        let threshold = -24;
        let ratio = 4;
        let isActive = false;

        if (selectedTrackId) {
            const track = localAppServices.getTrackById ? localAppServices.getTrackById(selectedTrackId) : null;
            if (track && track.activeEffects) {
                const compressorEffect = track.activeEffects.find(e => e.type === 'Compressor' || e.type === 'SidechainCompressor' || e.type === 'MultibandCompressor');
                if (compressorEffect && compressorEffect.toneNode && !compressorEffect.toneNode.disposed) {
                    isActive = true;
                    // Get reduction value from Tone.Compressor
                    if (compressorEffect.toneNode.reduction !== undefined) {
                        reductionDb = compressorEffect.toneNode.reduction || 0;
                    }
                    // Get threshold from params if available
                    if (compressorEffect.params) {
                        threshold = compressorEffect.params.threshold ?? -24;
                        ratio = compressorEffect.params.ratio ?? 4;
                    }
                }
            }
        }

        // Update meter display (0 to -30 dB range, shown as 0 to 100% width)
        const maxReduction = 30;
        const normalizedReduction = Math.max(0, Math.min(1, Math.abs(reductionDb) / maxReduction));
        reductionMeter.style.width = `${normalizedReduction * 100}%`;

        // Update value text
        if (reductionValue) {
            reductionValue.textContent = `${reductionDb.toFixed(1)} dB`;
        }

        // Update bar color based on reduction amount
        if (reductionBar) {
            if (reductionDb > 20) {
                reductionBar.style.backgroundColor = '#ef4444'; // red for heavy
            } else if (reductionDb > 10) {
                reductionBar.style.backgroundColor = '#f97316'; // orange for medium
            } else if (reductionDb > 3) {
                reductionBar.style.backgroundColor = '#22c55e'; // green for light
            } else {
                reductionBar.style.backgroundColor = '#14b8a6'; // teal for minimal
            }
        }

        animationFrameId = requestAnimationFrame(drawMeter);
    }

    animationFrameId = requestAnimationFrame(drawMeter);
}

function renderCompressorVisualizerContent() {
    const container = document.getElementById('compressorVisualizerContent');
    if (!container) return;

    // Get track list for selector
    let trackOptionsHtml = '<option value="">Select a track...</option>';
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    tracks.forEach(track => {
        const hasCompressor = track.activeEffects && track.activeEffects.some(e => 
            e.type === 'Compressor' || e.type === 'SidechainCompressor' || e.type === 'MultibandCompressor'
        );
        const displayName = hasCompressor ? `${track.name} ✓` : track.name;
        const selected = selectedTrackId === track.id ? 'selected' : '';
        trackOptionsHtml += `<option value="${track.id}" ${selected}>${displayName}</option>`;
    });

    container.innerHTML = `
        <div class="mb-3 flex items-center justify-between">
            <label class="text-sm text-gray-300">Track:</label>
            <select id="compressorTrackSelect" class="p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white flex-1 ml-2">
                ${trackOptionsHtml}
            </select>
        </div>

        <div class="mb-4 p-4 bg-gray-800 rounded-lg">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Gain Reduction</span>
                <span id="reductionValue" class="text-lg font-bold text-cyan-400">0.0 dB</span>
            </div>
            
            <!-- Meter bar -->
            <div class="relative h-8 bg-gray-700 rounded overflow-hidden">
                <div id="reductionBar" class="absolute top-0 left-0 h-full bg-teal-500 transition-all duration-75" style="width: 0%"></div>
                <div class="absolute inset-0 flex items-center justify-between px-2">
                    <span class="text-xs text-gray-400">0dB</span>
                    <span class="text-xs text-gray-400">-6dB</span>
                    <span class="text-xs text-gray-400">-12dB</span>
                    <span class="text-xs text-gray-400">-24dB</span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-2 bg-gray-800 rounded">
                <div class="text-xs text-gray-500 mb-1">Threshold</div>
                <div id="thresholdDisplay" class="text-sm font-bold text-gray-300">-24 dB</div>
            </div>
            <div class="p-2 bg-gray-800 rounded">
                <div class="text-xs text-gray-500 mb-1">Ratio</div>
                <div id="ratioDisplay" class="text-sm font-bold text-gray-300">4:1</div>
            </div>
            <div class="p-2 bg-gray-800 rounded">
                <div class="text-xs text-gray-500 mb-1">Status</div>
                <div id="statusDisplay" class="text-sm font-bold text-green-400">Active</div>
            </div>
        </div>

        <div class="mt-4 text-xs text-gray-500 text-center">
            Click track selector to switch between tracks with compressors
        </div>
    `;

    // Setup track selector event
    const trackSelect = document.getElementById('compressorTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            selectedTrackId = e.target.value || null;
            updateStaticInfo();
        });
    }

    updateStaticInfo();
}

function updateStaticInfo() {
    const thresholdDisplay = document.getElementById('thresholdDisplay');
    const ratioDisplay = document.getElementById('ratioDisplay');
    const statusDisplay = document.getElementById('statusDisplay');

    if (!selectedTrackId) {
        if (thresholdDisplay) thresholdDisplay.textContent = '-- dB';
        if (ratioDisplay) ratioDisplay.textContent = '--:1';
        if (statusDisplay) {
            statusDisplay.textContent = 'None';
            statusDisplay.className = 'text-sm font-bold text-gray-500';
        }
        return;
    }

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(selectedTrackId) : null;
    if (!track || !track.activeEffects) {
        if (thresholdDisplay) thresholdDisplay.textContent = '-- dB';
        if (ratioDisplay) ratioDisplay.textContent = '--:1';
        if (statusDisplay) {
            statusDisplay.textContent = 'No Compressor';
            statusDisplay.className = 'text-sm font-bold text-yellow-500';
        }
        return;
    }

    const compressorEffect = track.activeEffects.find(e => 
        e.type === 'Compressor' || e.type === 'SidechainCompressor' || e.type === 'MultibandCompressor'
    );

    if (compressorEffect && compressorEffect.params) {
        if (thresholdDisplay) thresholdDisplay.textContent = `${compressorEffect.params.threshold ?? -24} dB`;
        if (ratioDisplay) ratioDisplay.textContent = `${compressorEffect.params.ratio ?? 4}:1`;
    }

    if (statusDisplay) {
        statusDisplay.textContent = compressorEffect ? 'Active' : 'None';
        statusDisplay.className = compressorEffect ? 'text-sm font-bold text-green-400' : 'text-sm font-bold text-gray-500';
    }
}

// Cleanup when window closes
export function closeTrackCompressorVisualizer() {
    stopMeterAnimation();
    compressorVisualizerWindow = null;
    selectedTrackId = null;
}
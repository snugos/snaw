// js/SamplerLoopTrim.js - Visual waveform editor for sampler loop start/end points
// Allows dragging loop markers on a waveform to set exact loop boundaries

let localAppServices = {};
let currentTrimTrackId = null;
let waveformCanvas = null;
let loopStartPos = 0; // 0-1 normalized
let loopEndPos = 1;   // 0-1 normalized
let isDragging = null; // 'start' | 'end' | null
let audioBuffer = null;

const MARKER_HANDLE_WIDTH = 12;
const MIN_LOOP_FRACTION = 0.01; // Minimum 1% of sample

export function initSamplerLoopTrim(services) {
    localAppServices = services;
    console.log('[SamplerLoopTrim] Initialized');
}

export function openSamplerLoopTrimPanel(trackId = null) {
    const windowId = 'samplerLoopTrim';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        loadTrackForTrim(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'samplerLoopTrimContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 overflow-hidden';

    const options = {
        width: 650,
        height: 280,
        minWidth: 450,
        minHeight: 200,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Sampler Loop Trim', contentContainer, options);
    if (win?.element) {
        loadTrackForTrim(trackId);
    }
    return win;
}

function loadTrackForTrim(trackId = null) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const activeTrackId = trackId || currentTrimTrackId || (tracks.length > 0 ? tracks[0].id : null);
    const track = tracks.find(t => t.id === activeTrackId);

    if (!track) {
        showNoTrackMessage();
        return;
    }

    currentTrimTrackId = track.id;

    // Check if track is a sampler
    if (track.type !== 'Sampler' && track.type !== 'InstrumentSampler') {
        showWrongTrackType(track);
        return;
    }

    // Get the audio buffer
    const settings = track.instrumentSamplerSettings;
    if (!settings || (!settings.dbKey && !settings.audioBufferDataURL)) {
        showNoSampleMessage(track);
        return;
    }

    // Load the buffer and render
    loadAudioBufferForTrack(track);
}

async function loadAudioBufferForTrack(track) {
    try {
        // Try to get the buffer from the track's Tone.Sampler
        let buf = null;
        if (track.toneSampler && track.toneSampler.buffer && track.toneSampler.buffer.loaded) {
            buf = track.toneSampler.buffer.get();
        } else if (track.toneSampler && track.toneSampler._buffers) {
            // Check Tone.Sampler buffer cache
            for (const key in track.toneSampler._buffers) {
                const b = track.toneSampler._buffers[key];
                if (b && b.loaded) {
                    buf = b.get();
                    break;
                }
            }
        }

        if (!buf) {
            // Try loading from URL
            const url = track.instrumentSamplerSettings.audioBufferDataURL ||
                       track.instrumentSamplerSettings.sampleUrl;
            if (url) {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                buf = await Tone.context.decodeAudioData(arrayBuffer);
            }
        }

        if (!buf) {
            showNoSampleMessage(track);
            return;
        }

        audioBuffer = buf;
        loopStartPos = track.instrumentSamplerSettings.loopStart / buf.duration || 0;
        loopEndPos = track.instrumentSamplerSettings.loopEnd / buf.duration || 1;

        // Clamp values
        loopStartPos = Math.max(0, Math.min(loopStartPos, 1 - MIN_LOOP_FRACTION));
        loopEndPos = Math.max(loopStartPos + MIN_LOOP_FRACTION, Math.min(loopEndPos, 1));

        renderTrimUI(track);
    } catch (err) {
        console.error('[SamplerLoopTrim] Error loading audio:', err);
        showErrorMessage(`Could not load audio: ${err.message}`);
    }
}

function showNoTrackMessage() {
    const container = document.getElementById('samplerLoopTrimContent');
    if (!container) return;
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <p class="text-lg mb-2">No track selected</p>
                <p class="text-sm">Select a Sampler track to trim its loop points.</p>
            </div>
        </div>
    `;
}

function showWrongTrackType(track) {
    const container = document.getElementById('samplerLoopTrimContent');
    if (!container) return;
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <p class="text-lg mb-2">Track "${track.name}" is not a Sampler</p>
                <p class="text-sm">Loop trimming only works on Sampler tracks.</p>
            </div>
        </div>
    `;
}

function showNoSampleMessage(track) {
    const container = document.getElementById('samplerLoopTrimContent');
    if (!container) return;
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <p class="text-lg mb-2">No sample loaded</p>
                <p class="text-sm">Load a sample into track "${track.name}" first.</p>
            </div>
        </div>
    `;
}

function showErrorMessage(msg) {
    const container = document.getElementById('samplerLoopTrimContent');
    if (!container) return;
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-red-400">
            <div class="text-center">
                <p class="text-lg mb-2">Error</p>
                <p class="text-sm">${msg}</p>
            </div>
        </div>
    `;
}

function renderTrimUI(track) {
    const container = document.getElementById('samplerLoopTrimContent');
    if (!container) return;

    const duration = audioBuffer ? audioBuffer.duration : 0;
    const startTime = (loopStartPos * duration).toFixed(3);
    const endTime = (loopEndPos * duration).toFixed(3);
    const loopDuration = ((loopEndPos - loopStartPos) * duration).toFixed(3);

    container.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-white">${track.name}</span>
                <span class="text-xs text-gray-400">${duration.toFixed(2)}s</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="trimPlayStart" class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white" title="Play from start">&#9654; From ${startTime}s</button>
                <button id="trimPlayLoop" class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white" title="Play loop">&#9994; Loop</button>
                <button id="trimReset" class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white">Reset</button>
            </div>
        </div>

        <div id="waveformContainer" class="relative flex-1 bg-black rounded border border-gray-700 overflow-hidden" style="min-height: 140px; cursor: crosshair;">
            <canvas id="loopWaveformCanvas" class="w-full h-full"></canvas>
            <!-- Loop region highlight -->
            <div id="loopRegionOverlay" class="absolute top-0 bottom-0 bg-blue-500 bg-opacity-20 pointer-events-none" style="left: 0%; width: 100%;"></div>
            <!-- Start marker -->
            <div id="loopStartMarker" class="absolute top-0 bottom-0 w-1 bg-green-400 cursor ew-resize pointer-events-auto" style="left: 0%;"></div>
            <!-- End marker -->
            <div id="loopEndMarker" class="absolute top-0 bottom-0 w-1 bg-red-400 cursor ew-resize pointer-events-auto" style="left: 100%;"></div>
            <!-- Center handle for start -->
            <div id="loopStartHandle" class="absolute top-1 bottom-1 flex items-center justify-center pointer-events-none" style="left: 0%; width: ${MARKER_HANDLE_WIDTH}px; margin-left: -6px;">
                <div class="w-3 h-6 bg-green-400 rounded-sm opacity-80"></div>
            </div>
            <!-- Center handle for end -->
            <div id="loopEndHandle" class="absolute top-1 bottom-1 flex items-center justify-center pointer-events-none" style="left: 100%; width: ${MARKER_HANDLE_WIDTH}px; margin-left: -6px;">
                <div class="w-3 h-6 bg-red-400 rounded-sm opacity-80"></div>
            </div>
        </div>

        <div class="flex items-center justify-between mt-2 px-1">
            <div class="flex items-center gap-4 text-xs">
                <div>
                    <span class="text-gray-500">Start:</span>
                    <input type="number" id="trimStartInput" value="${startTime}" step="0.001" min="0" max="${duration}"
                        class="w-20 p-1 bg-gray-800 border border-gray-600 rounded text-white text-center text-xs">
                    <span class="text-gray-500 ml-1">s</span>
                </div>
                <div>
                    <span class="text-gray-500">End:</span>
                    <input type="number" id="trimEndInput" value="${endTime}" step="0.001" min="0" max="${duration}"
                        class="w-20 p-1 bg-gray-800 border border-gray-600 rounded text-white text-center text-xs">
                    <span class="text-gray-500 ml-1">s</span>
                </div>
                <div>
                    <span class="text-gray-500">Loop:</span>
                    <span id="trimDurationDisplay" class="text-green-400 font-mono">${loopDuration}</span>
                    <span class="text-gray-500">s</span>
                </div>
            </div>
            <button id="trimApplyBtn" class="px-4 py-1 text-sm bg-green-600 hover:bg-green-500 rounded text-white font-medium">Apply</button>
        </div>

        <div class="mt-2 text-xs text-gray-500 text-center">
            Drag the colored markers on the waveform to set loop start/end points
        </div>
    `;

    // Draw waveform after container is rendered
    setTimeout(() => {
        drawWaveform();
        updateMarkerPositions();
        setupTrimEvents();
    }, 20);
}

function drawWaveform() {
    const canvas = document.getElementById('loopWaveformCanvas');
    if (!canvas || !audioBuffer) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    const data = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(data.length / width);
    const centerY = height / 2;
    const maxAmp = height / 2 - 4;

    ctx.fillStyle = '#4a90d9';
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x++) {
        const startSample = x * samplesPerPixel;
        let minVal = 0, maxVal = 0;

        for (let s = 0; s < samplesPerPixel; s++) {
            const val = data[startSample + s] || 0;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
        }

        const yTop = centerY - maxVal * maxAmp;
        const yBottom = centerY - minVal * maxAmp;
        ctx.fillRect(x, yTop, 1, Math.max(1, yBottom - yTop));
    }

    // Draw center line
    ctx.strokeStyle = '#2a5080';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
}

function updateMarkerPositions() {
    const overlay = document.getElementById('loopRegionOverlay');
    const startMarker = document.getElementById('loopStartMarker');
    const endMarker = document.getElementById('loopEndMarker');
    const startHandle = document.getElementById('loopStartHandle');
    const endHandle = document.getElementById('loopEndHandle');

    if (overlay) {
        overlay.style.left = (loopStartPos * 100) + '%';
        overlay.style.width = ((loopEndPos - loopStartPos) * 100) + '%';
    }
    if (startMarker) startMarker.style.left = (loopStartPos * 100) + '%';
    if (endMarker) endMarker.style.left = (loopEndPos * 100) + '%';
    if (startHandle) startHandle.style.left = (loopStartPos * 100) + '%';
    if (endHandle) endHandle.style.left = (loopEndPos * 100) + '%';
}

function setupTrimEvents() {
    const container = document.getElementById('waveformContainer');
    if (!container) return;

    let startMarker = document.getElementById('loopStartMarker');
    let endMarker = document.getElementById('loopEndMarker');

    // Mouse events on markers
    startMarker.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = 'start';
        document.body.style.cursor = 'ew-resize';
    });

    endMarker.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = 'end';
        document.body.style.cursor = 'ew-resize';
    });

    // Click on waveform to set position (snaps to nearest marker if close)
    container.addEventListener('click', (e) => {
        if (isDragging) return;
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const distToStart = Math.abs(x - loopStartPos);
        const distToEnd = Math.abs(x - loopEndPos);

        if (distToStart < 0.02) {
            isDragging = 'start';
            document.body.style.cursor = 'ew-resize';
            setTimeout(() => { isDragging = null; document.body.style.cursor = ''; }, 20);
        } else if (distToEnd < 0.02) {
            isDragging = 'end';
            document.body.style.cursor = 'ew-resize';
            setTimeout(() => { isDragging = null; document.body.style.cursor = ''; }, 20);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        x = Math.max(0, Math.min(1, x));

        if (isDragging === 'start') {
            loopStartPos = Math.min(x, loopEndPos - MIN_LOOP_FRACTION);
            loopStartPos = Math.max(0, loopStartPos);
        } else if (isDragging === 'end') {
            loopEndPos = Math.max(x, loopStartPos + MIN_LOOP_FRACTION);
            loopEndPos = Math.min(1, loopEndPos);
        }

        updateMarkerPositions();
        updateNumericInputs();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = null;
            document.body.style.cursor = '';
            applyToTrack();
        }
    });

    // Numeric inputs
    const startInput = document.getElementById('trimStartInput');
    const endInput = document.getElementById('trimEndInput');
    if (startInput) {
        startInput.addEventListener('change', () => {
            const val = parseFloat(startInput.value) || 0;
            const dur = audioBuffer ? audioBuffer.duration : 1;
            loopStartPos = Math.max(0, Math.min(val / dur, loopEndPos - MIN_LOOP_FRACTION));
            updateMarkerPositions();
            applyToTrack();
        });
    }
    if (endInput) {
        endInput.addEventListener('change', () => {
            const val = parseFloat(endInput.value) || 0;
            const dur = audioBuffer ? audioBuffer.duration : 1;
            loopEndPos = Math.min(1, Math.max(val / dur, loopStartPos + MIN_LOOP_FRACTION));
            updateMarkerPositions();
            applyToTrack();
        });
    }

    // Buttons
    document.getElementById('trimReset')?.addEventListener('click', () => {
        loopStartPos = 0;
        loopEndPos = 1;
        updateMarkerPositions();
        updateNumericInputs();
        applyToTrack();
    });

    document.getElementById('trimApplyBtn')?.addEventListener('click', () => {
        applyToTrack();
        localAppServices.showNotification?.('Loop points applied', 1500);
    });

    document.getElementById('trimPlayStart')?.addEventListener('click', () => {
        if (audioBuffer && localAppServices.getTrackById) {
            const track = localAppServices.getTrackById(currentTrimTrackId);
            if (track?.toneSampler && !track.toneSampler.disposed) {
                const startTime = loopStartPos * audioBuffer.duration;
                track.toneSampler.stop();
                track.toneSampler.start(Tone.now(), startTime);
                setTimeout(() => {
                    if (track.toneSampler && !track.toneSampler.disposed) {
                        track.toneSampler.stop();
                    }
                }, 2000);
            }
        }
    });

    document.getElementById('trimPlayLoop')?.addEventListener('click', () => {
        if (audioBuffer && localAppServices.getTrackById) {
            const track = localAppServices.getTrackById(currentTrimTrackId);
            if (track?.toneSampler && !track.toneSampler.disposed) {
                track.toneSampler.loop = true;
                track.toneSampler.loopStart = loopStartPos * audioBuffer.duration;
                track.toneSampler.loopEnd = loopEndPos * audioBuffer.duration;
                track.toneSampler.start();
            }
        }
    });
}

function updateNumericInputs() {
    const duration = audioBuffer ? audioBuffer.duration : 1;
    const startInput = document.getElementById('trimStartInput');
    const endInput = document.getElementById('trimEndInput');
    const durDisplay = document.getElementById('trimDurationDisplay');

    if (startInput) startInput.value = (loopStartPos * duration).toFixed(3);
    if (endInput) endInput.value = (loopEndPos * duration).toFixed(3);
    if (durDisplay) durDisplay.textContent = ((loopEndPos - loopStartPos) * duration).toFixed(3);
}

function applyToTrack() {
    if (!currentTrimTrackId || !audioBuffer) return;
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(currentTrimTrackId) : null;
    if (!track) return;

    const duration = audioBuffer.duration;
    const newStart = loopStartPos * duration;
    const newEnd = loopEndPos * duration;

    // Update track settings
    track.instrumentSamplerSettings.loopStart = newStart;
    track.instrumentSamplerSettings.loopEnd = newEnd;
    track.instrumentSamplerSettings.loop = true;

    // Apply to Tone.Sampler if exists
    if (track.toneSampler && !track.toneSampler.disposed) {
        track.toneSampler.loopStart = newStart;
        track.toneSampler.loopEnd = newEnd;
        track.toneSampler.loop = true;
    }

    console.log(`[SamplerLoopTrim] Applied loop: ${newStart.toFixed(3)}s - ${newEnd.toFixed(3)}s`);
}
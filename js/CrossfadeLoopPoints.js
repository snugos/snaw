// js/CrossfadeLoopPoints.js - Set loop start/end within an audio clip with crossfade preview
// Adds a panel and clip-context menu item to edit a clip's loop points (start, end) and a
// crossfade length that smooths the loop boundary to prevent clicks on retrigger.

let localAppServices = {};
let currentClipId = null;
let currentTrackId = null;
let waveformCanvas = null;
let audioBuffer = null;
let isDragging = null; // 'start' | 'end' | 'xfade'
let loopStartPos = 0; // 0..1 normalized within clip duration
let loopEndPos = 1;
let crossfadePos = 0; // 0..0.5 (fraction of loop length that becomes the crossfade region)

const MARKER_HANDLE_WIDTH = 14;
const MIN_LOOP_FRACTION = 0.01;
const MIN_CROSSFADE_FRACTION = 0.0;

export function initCrossfadeLoopPoints(services) {
    localAppServices = services || {};
    console.log('[CrossfadeLoopPoints] Initialized');

    // Add clip context menu item for audio clips
    if (typeof addMenuItem === 'function') {
        addMenuItem({
            id: 'crossfade_loop_points',
            label: 'Loop Points & Crossfade…',
            icon: '🔁',
            action: 'openCrossfadeLoopPointsForClip',
            category: 'clip'
        });
    } else if (localAppServices && typeof localAppServices.addMenuItem === 'function') {
        localAppServices.addMenuItem({
            id: 'crossfade_loop_points',
            label: 'Loop Points & Crossfade…',
            icon: '🔁',
            action: 'openCrossfadeLoopPointsForClip',
            category: 'clip'
        });
    }
    // Expose entrypoint globally for the context menu dispatcher
    window.openCrossfadeLoopPointsForClip = (clipId, trackId) => {
        openCrossfadeLoopPointsPanel(trackId, clipId);
    };
}

/**
 * Open the crossfade loop points panel for a given audio clip.
 * @param {number|string} trackId
 * @param {string} clipId
 */
export function openCrossfadeLoopPointsPanel(trackId, clipId) {
    const windowId = 'crossfadeLoopPoints';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        try { win.restore(); } catch (e) { /* ignore */ }
    }

    currentTrackId = trackId != null ? parseInt(trackId) : null;
    currentClipId = clipId || null;

    const contentContainer = document.createElement('div');
    contentContainer.id = 'crossfadeLoopPointsContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 overflow-hidden';

    const options = {
        width: 720,
        height: 320,
        minWidth: 520,
        minHeight: 240,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Loop Points & Crossfade', contentContainer, options);
    if (win?.element) {
        loadClipForEditing();
    }
    return win;
}

function loadClipForEditing() {
    const container = document.getElementById('crossfadeLoopPointsContent');
    if (!container) return;

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(currentTrackId) : null;
    if (!track) {
        renderNoTrack(container);
        return;
    }
    const clip = track.timelineClips?.find(c => c.id === currentClipId);
    if (!clip) {
        renderNoClip(container, track);
        return;
    }
    if (clip.type !== 'audio') {
        renderWrongType(container, track, clip);
        return;
    }

    // Load existing loop settings (default to full clip)
    const dur = Math.max(0.001, clip.duration || 0);
    const storedStart = (clip.loopStart != null) ? clip.loopStart : 0;
    const storedEnd = (clip.loopEnd != null) ? clip.loopEnd : dur;
    loopStartPos = Math.max(0, Math.min(storedStart / dur, 1 - MIN_LOOP_FRACTION));
    loopEndPos = Math.max(loopStartPos + MIN_LOOP_FRACTION, Math.min(storedEnd / dur, 1));
    const loopLen = loopEndPos - loopStartPos;
    const storedCrossfade = clip.loopCrossfade || 0;
    crossfadePos = Math.max(0, Math.min(storedCrossfade / dur, loopLen / 2));

    renderPanel(container, track, clip);
    // Best-effort async load of the clip's audio buffer for waveform display
    loadAudioBufferForClip(track, clip).catch(err => {
        console.warn('[CrossfadeLoopPoints] Could not load audio buffer for waveform:', err);
    });
}

async function loadAudioBufferForClip(track, clip) {
    if (!clip.sourceId) return;
    try {
        const getAudio = localAppServices.getAudio || (window.db && window.db.getAudio);
        if (typeof getAudio !== 'function') return;
        const blob = await getAudio(clip.sourceId);
        if (!blob) return;
        const arrayBuffer = await blob.arrayBuffer();
        if (window.Tone && Tone.context && Tone.context.decodeAudioData) {
            audioBuffer = await Tone.context.decodeAudioData(arrayBuffer.slice(0));
            drawWaveform();
        }
    } catch (err) {
        // Soft fail - panel still works without waveform
    }
}

function renderNoTrack(container) {
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <p class="text-lg mb-2">No track selected</p>
                <p class="text-sm">Right-click an audio clip to open its loop points.</p>
            </div>
        </div>
    `;
}

function renderNoClip(container, track) {
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <p class="text-lg mb-2">Clip not found on "${track.name}"</p>
                <p class="text-sm">This clip may have been deleted.</p>
            </div>
        </div>
    `;
}

function renderWrongType(container, track, clip) {
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <p class="text-lg mb-2">"${clip.name}" is not an audio clip</p>
                <p class="text-sm">Loop points only apply to audio clips on track "${track.name}".</p>
            </div>
        </div>
    `;
}

function renderPanel(container, track, clip) {
    const dur = Math.max(0.001, clip.duration || 0);
    const startTime = (loopStartPos * dur).toFixed(3);
    const endTime = (loopEndPos * dur).toFixed(3);
    const xfadeTime = (crossfadePos * dur).toFixed(3);
    const loopDuration = ((loopEndPos - loopStartPos) * dur).toFixed(3);

    container.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
                <span class="text-sm font-medium text-white">${escapeHtml(track.name)} / ${escapeHtml(clip.name || 'Clip')}</span>
                <span class="text-xs text-gray-400">Clip: ${dur.toFixed(2)}s</span>
            </div>
            <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-xs text-gray-300">
                    <input id="xfpEnable" type="checkbox" ${clip.loopEnabled ? 'checked' : ''} class="accent-blue-500">
                    Enable Loop
                </label>
                <button id="xfpReset" class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white">Reset</button>
            </div>
        </div>
        <div class="relative flex-1 bg-gray-800 rounded overflow-hidden" id="xfpCanvasWrap" style="min-height: 100px;">
            <canvas id="xfpCanvas" class="absolute inset-0 w-full h-full"></canvas>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-300">
            <label class="flex flex-col">
                <span class="text-gray-400">Loop Start (s)</span>
                <input id="xfpStartInput" type="number" min="0" max="${dur.toFixed(2)}" step="0.01" value="${startTime}" class="bg-gray-800 text-white rounded px-1 py-0.5">
            </label>
            <label class="flex flex-col">
                <span class="text-gray-400">Loop End (s)</span>
                <input id="xfpEndInput" type="number" min="0" max="${dur.toFixed(2)}" step="0.01" value="${endTime}" class="bg-gray-800 text-white rounded px-1 py-0.5">
            </label>
            <label class="flex flex-col">
                <span class="text-gray-400">Crossfade (s)</span>
                <input id="xfpCrossfadeInput" type="number" min="0" max="${(loopDuration/2).toFixed(2)}" step="0.01" value="${xfadeTime}" class="bg-gray-800 text-white rounded px-1 py-0.5">
            </label>
        </div>
        <div class="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>Loop length: <span id="xfpLoopLength" class="text-white">${loopDuration}s</span></span>
            <div class="flex items-center gap-2">
                <button id="xfpPreview" class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white" title="Audition looped section">▶ Preview Loop</button>
                <button id="xfpStop" class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white">■ Stop</button>
                <button id="xfpApply" class="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded text-white">Apply</button>
            </div>
        </div>
        <p class="text-[10px] text-gray-500 mt-1">Drag the green start handle, red end handle, or yellow crossfade handle on the waveform. Crossfade is applied at the loop boundary so playback doesn't click when looping.</p>
    `;

    waveformCanvas = container.querySelector('#xfpCanvas');
    sizeCanvas();

    // Wire up events
    container.querySelector('#xfpEnable').addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (clip.loopEnabled !== checked) {
            clip.loopEnabled = checked;
        }
    });

    container.querySelector('#xfpReset').addEventListener('click', () => {
        loopStartPos = 0;
        loopEndPos = 1;
        crossfadePos = 0;
        renderPanel(container, track, clip);
        drawWaveform();
    });

    container.querySelector('#xfpStartInput').addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) {
            loopStartPos = Math.max(0, Math.min(v / dur, loopEndPos - MIN_LOOP_FRACTION));
            drawWaveform();
            updateLoopLengthDisplay();
        }
    });
    container.querySelector('#xfpEndInput').addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) {
            loopEndPos = Math.max(loopStartPos + MIN_LOOP_FRACTION, Math.min(v / dur, 1));
            drawWaveform();
            updateLoopLengthDisplay();
        }
    });
    container.querySelector('#xfpCrossfadeInput').addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) {
            const loopLen = Math.max(0.001, loopEndPos - loopStartPos);
            crossfadePos = Math.max(0, Math.min(v / dur, loopLen / 2));
            drawWaveform();
        }
    });

    container.querySelector('#xfpApply').addEventListener('click', () => {
        applyChanges(track, clip);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Loop points applied', 1500);
        }
    });

    container.querySelector('#xfpPreview').addEventListener('click', () => {
        previewLoop(track, clip);
    });
    container.querySelector('#xfpStop').addEventListener('click', () => {
        stopPreview();
    });

    if (waveformCanvas) {
        attachCanvasEvents();
    }
    drawWaveform();
}

function updateLoopLengthDisplay() {
    const el = document.getElementById('xfpLoopLength');
    if (el) {
        const dur = getClipDurationSafe();
        el.textContent = ((loopEndPos - loopStartPos) * dur).toFixed(2) + 's';
    }
}

function getClipDurationSafe() {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(currentTrackId) : null;
    if (!track) return 1;
    const clip = track.timelineClips?.find(c => c.id === currentClipId);
    return Math.max(0.001, clip?.duration || 1);
}

function sizeCanvas() {
    if (!waveformCanvas) return;
    const wrap = waveformCanvas.parentElement;
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    waveformCanvas.width = wrap.clientWidth * dpr;
    waveformCanvas.height = wrap.clientHeight * dpr;
    waveformCanvas.style.width = wrap.clientWidth + 'px';
    waveformCanvas.style.height = wrap.clientHeight + 'px';
}

function drawWaveform() {
    if (!waveformCanvas) return;
    sizeCanvas();
    const ctx = waveformCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = waveformCanvas.width;
    const h = waveformCanvas.height;

    ctx.clearRect(0, 0, w, h);
    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, w, h);

    // Shaded regions: outside the loop dimmed
    const startX = loopStartPos * w;
    const endX = loopEndPos * w;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Loop region background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(startX, 0, endX - startX, h);

    // Draw waveform if we have one
    if (audioBuffer) {
        const data = audioBuffer.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / w));
        ctx.fillStyle = '#4ade80';
        for (let x = 0; x < w; x++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[x * step + j] || 0;
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            const y1 = (1 + min) * h / 2;
            const y2 = (1 + max) * h / 2;
            ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
    } else {
        ctx.fillStyle = '#9ca3af';
        ctx.font = `${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('(no waveform available)', w / 2, h / 2);
    }

    // Crossfade regions (highlighted at loop boundary)
    if (crossfadePos > 0) {
        const loopLen = Math.max(0.001, loopEndPos - loopStartPos);
        const xfadeFrac = Math.min(crossfadePos / loopLen, 0.5);
        const xfadeW = xfadeFrac * (endX - startX);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.18)'; // yellow tint
        ctx.fillRect(endX - xfadeW, 0, xfadeW, h);
        ctx.fillRect(startX, 0, xfadeW, h);
    }

    // Markers
    drawHandle(ctx, startX, h, '#10b981', 'S');
    drawHandle(ctx, endX, h, '#ef4444', 'E');
    if (crossfadePos > 0) {
        const loopLen = Math.max(0.001, loopEndPos - loopStartPos);
        const xfadeFrac = Math.min(crossfadePos / loopLen, 0.5);
        const xfadeW = xfadeFrac * (endX - startX);
        drawHandle(ctx, endX - xfadeW, h, '#eab308', 'X');
        drawHandle(ctx, startX + xfadeW, h, '#eab308', 'X');
    }

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
}

function drawHandle(ctx, x, h, color, label) {
    const dpr = window.devicePixelRatio || 1;
    const handleW = MARKER_HANDLE_WIDTH * dpr;
    const handleH = h;
    ctx.fillStyle = color;
    ctx.fillRect(x - handleW / 2, 0, handleW, handleH);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.font = `bold ${11 * dpr}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, h / 2);
}

function attachCanvasEvents() {
    if (!waveformCanvas) return;
    waveformCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function onMouseDown(e) {
    if (!waveformCanvas) return;
    const rect = waveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const startX = loopStartPos * w;
    const endX = loopEndPos * w;
    const tol = MARKER_HANDLE_WIDTH;
    const loopLen = Math.max(0.001, loopEndPos - loopStartPos);
    const xfadeFrac = Math.min(crossfadePos / loopLen, 0.5);
    const xfadeW = xfadeFrac * (endX - startX);

    if (Math.abs(x - startX) <= tol) {
        isDragging = 'start';
    } else if (Math.abs(x - endX) <= tol) {
        isDragging = 'end';
    } else if (crossfadePos > 0 && Math.abs(x - (endX - xfadeW)) <= tol) {
        isDragging = 'xfade-end';
    } else if (crossfadePos > 0 && Math.abs(x - (startX + xfadeW)) <= tol) {
        isDragging = 'xfade-start';
    } else {
        isDragging = null;
    }
    if (isDragging) {
        e.preventDefault();
    }
}

function onMouseMove(e) {
    if (!isDragging || !waveformCanvas) return;
    const rect = waveformCanvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    const w = rect.width;
    x = Math.max(0, Math.min(w, x));
    const frac = x / w;

    if (isDragging === 'start') {
        loopStartPos = Math.max(0, Math.min(frac, loopEndPos - MIN_LOOP_FRACTION));
    } else if (isDragging === 'end') {
        loopEndPos = Math.max(loopStartPos + MIN_LOOP_FRACTION, Math.min(frac, 1));
    } else if (isDragging === 'xfade-start' || isDragging === 'xfade-end') {
        const loopLen = Math.max(0.001, loopEndPos - loopStartPos);
        const handleFrac = Math.max(0, Math.min(isDragging === 'xfade-start' ? frac - loopStartPos : loopEndPos - frac, loopLen / 2));
        crossfadePos = handleFrac;
    }
    drawWaveform();
    syncInputsFromDrag();
}

function onMouseUp() {
    isDragging = null;
}

function syncInputsFromDrag() {
    const dur = getClipDurationSafe();
    const s = document.getElementById('xfpStartInput');
    const en = document.getElementById('xfpEndInput');
    const xf = document.getElementById('xfpCrossfadeInput');
    if (s) s.value = (loopStartPos * dur).toFixed(2);
    if (en) en.value = (loopEndPos * dur).toFixed(2);
    if (xf) xf.value = (crossfadePos * dur).toFixed(2);
    updateLoopLengthDisplay();
}

function applyChanges(track, clip) {
    if (!track || !clip) return;
    const dur = Math.max(0.001, clip.duration || 0);
    const startSec = loopStartPos * dur;
    const endSec = loopEndPos * dur;
    const xfadeSec = crossfadePos * dur;
    if (typeof track.setClipLoopMode === 'function') {
        const enabled = document.getElementById('xfpEnable')?.checked ?? clip.loopEnabled;
        track.setClipLoopMode(clip.id, enabled, startSec, endSec, xfadeSec);
    } else {
        clip.loopEnabled = document.getElementById('xfpEnable')?.checked ?? clip.loopEnabled ?? false;
        clip.loopStart = startSec;
        clip.loopEnd = endSec;
        clip.loopCrossfade = xfadeSec;
    }
}

let previewPlayer = null;
function previewLoop(track, clip) {
    stopPreview();
    if (!clip.sourceId || !window.Tone) return;
    const getAudio = localAppServices.getAudio || (window.db && window.db.getAudio);
    if (typeof getAudio !== 'function') return;
    getAudio(clip.sourceId).then(async (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const ab = await blob.arrayBuffer();
        const buffer = await Tone.context.decodeAudioData(ab.slice(0));
        const startSec = loopStartPos * buffer.duration;
        const endSec = loopEndPos * buffer.duration;
        const xfade = crossfadePos * buffer.duration;

        try {
            // Create a Tone.Player pointed at the buffer
            previewPlayer = new Tone.Player(buffer);
            previewPlayer.loop = true;
            previewPlayer.loopStart = startSec;
            previewPlayer.loopEnd = endSec;
            const dest = localAppServices.getPreviewDestination ? localAppServices.getPreviewDestination() : Tone.Destination;
            previewPlayer.connect(dest);
            if (xfade > 0) {
                // Apply crossfade via a fadeIn/fadeOut envelope around the loop boundary
                previewPlayer.fadeIn = xfade;
                previewPlayer.fadeOut = xfade;
            }
            previewPlayer.start();
        } catch (e) {
            console.warn('[CrossfadeLoopPoints] Preview failed:', e);
        }
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }).catch(err => {
        console.warn('[CrossfadeLoopPoints] Could not preview:', err);
    });
}

function stopPreview() {
    try {
        if (previewPlayer) {
            previewPlayer.stop();
            previewPlayer.dispose();
        }
    } catch (e) { /* ignore */ }
    previewPlayer = null;
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

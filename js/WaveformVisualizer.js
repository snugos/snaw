// js/WaveformVisualizer.js - Draw waveform thumbnails for audio clips + zoomable waveform for selected clip

let localAppServices = {};
let isPanelOpen = false;

const WINDOW_ID = 'waveformVisualizerPanel';
const PANEL_CONTENT_ID = 'waveformVisualizerContent';

const settings = {
    mode: 'peak',         // 'peak' | 'rms'
    channelMode: 'mono',  // 'mono' | 'split'
    colorByTrack: true,
    selectedClipId: null,
    zoom: 1.0,
    pan: 0.0
};

const MAX_THUMBNAIL_WIDTH = 360;
const MAX_THUMBNAIL_HEIGHT = 56;
const FULL_WAVEFORM_HEIGHT = 220;

export function initWaveformVisualizer(services) {
    localAppServices = services || {};
    console.log('[WaveformVisualizer] Initialized');
}

export function isWaveformVisualizerActive() {
    return isPanelOpen;
}

function getTracks() {
    return typeof localAppServices.getTracksState === 'function'
        ? (localAppServices.getTracksState() || [])
        : [];
}

function listAudioClips() {
    const tracks = getTracks();
    const items = [];
    for (const track of tracks) {
        if (!track) continue;
        const clips = Array.isArray(track.clips) ? track.clips : [];
        for (const clip of clips) {
            if (!clip) continue;
            const buf = clip.audioBuffer || clip.buffer || clip.toneBuffer || null;
            if (!buf || typeof buf.getChannelData !== 'function') continue;
            items.push({
                track,
                trackId: track.id,
                trackName: track.name || ('Track ' + track.id),
                trackType: track.type || 'Audio',
                clipId: clip.id,
                clipName: clip.name || ('Clip ' + clip.id),
                startTime: clip.startTime || 0,
                duration: clip.duration || buf.duration || 0,
                gain: typeof clip.gain === 'number' ? clip.gain : 1,
                buffer: buf
            });
        }
    }
    return items;
}

function getClipById(clipId) {
    return listAudioClips().find(c => String(c.clipId) === String(clipId)) || null;
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function colorWithAlpha(hex, alpha) {
    if (typeof hex !== 'string') return 'rgba(96,165,250,' + alpha + ')';
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return 'rgba(96,165,250,' + alpha + ')';
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if ([r, g, b].some(v => Number.isNaN(v))) return 'rgba(96,165,250,' + alpha + ')';
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function notify(message, duration) {
    if (typeof localAppServices.showNotification === 'function') localAppServices.showNotification(message, duration);
    else if (typeof localAppServices.showSafeNotification === 'function') localAppServices.showSafeNotification(message, duration);
    else console.log('[WaveformVisualizer]', message);
}

function ampMono(data, start, end, mode) {
    if (end <= start) return 0;
    if (mode === 'rms') {
        let sum = 0;
        for (let i = start; i < end; i++) {
            const v = data[i] || 0;
            sum += v * v;
        }
        return Math.sqrt(sum / (end - start));
    }
    let peak = 0;
    for (let i = start; i < end; i++) {
        const a = Math.abs(data[i] || 0);
        if (a > peak) peak = a;
    }
    return peak;
}

function ampMixed(left, right, start, end, mode) {
    if (!right) return ampMono(left, start, end, mode);
    if (end <= start) return 0;
    if (mode === 'rms') {
        let sum = 0;
        for (let i = start; i < end; i++) {
            const l = left[i] || 0;
            const r = right[i] || 0;
            sum += ((l * l) + (r * r)) * 0.5;
        }
        return Math.sqrt(sum / (end - start));
    }
    let peak = 0;
    for (let i = start; i < end; i++) {
        const l = Math.abs(left[i] || 0);
        const r = Math.abs(right[i] || 0);
        const m = Math.max(l, r);
        if (m > peak) peak = m;
    }
    return peak;
}

function clearCanvas(canvas, bg) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width || 1;
    const height = canvas.height || 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}

function drawChannelBlock(ctx, data, yOffset, width, height, samplesPerCol, mode) {
    const length = data.length;
    for (let x = 0; x < width; x++) {
        const start = x * samplesPerCol;
        const end = Math.min(length, start + samplesPerCol);
        const amp = Math.max(0.005, Math.min(1, ampMono(data, start, end, mode)));
        const h = amp * (height / 2) * 0.95;
        ctx.fillRect(x, (yOffset + height / 2) - h, 1, h * 2);
    }
}

function drawThumbnail(canvas, audioBuffer, options) {
    const mode = options.mode || 'peak';
    const channelMode = options.channelMode || 'mono';
    const baseColor = options.color || '#60a5fa';

    clearCanvas(canvas, '#0f172a');

    if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function') return;
    const numChannels = Math.max(1, audioBuffer.numberOfChannels || 1);
    const length = audioBuffer.length || 0;
    if (length <= 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width || 1;
    const height = canvas.height || 1;
    ctx.fillStyle = colorWithAlpha(baseColor, 0.85);

    if (channelMode === 'split' && numChannels > 1) {
        const half = Math.floor(height / 2) - 1;
        const samplesPerCol = Math.max(1, Math.floor(length / width));
        drawChannelBlock(ctx, audioBuffer.getChannelData(0), 0, width, half, samplesPerCol, mode);
        drawChannelBlock(ctx, audioBuffer.getChannelData(1), half + 2, width, half, samplesPerCol, mode);
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.font = '9px sans-serif';
        ctx.fillText('L', 2, half * 0.5 + 4);
        ctx.fillText('R', 2, half + 2 + half * 0.5 + 4);
    } else {
        const left = audioBuffer.getChannelData(0);
        const right = numChannels > 1 ? audioBuffer.getChannelData(1) : null;
        const samplesPerCol = Math.max(1, Math.floor(length / width));
        for (let x = 0; x < width; x++) {
            const start = x * samplesPerCol;
            const end = Math.min(length, start + samplesPerCol);
            const amp = Math.max(0.005, Math.min(1, ampMixed(left, right, start, end, mode)));
            const h = amp * (height / 2) * 0.95;
            ctx.fillRect(x, (height / 2) - h, 1, h * 2);
        }
    }
}

function pickTickInterval(seconds) {
    if (seconds <= 1) return 0.1;
    if (seconds <= 5) return 0.5;
    if (seconds <= 20) return 1;
    if (seconds <= 60) return 5;
    return 10;
}

function drawTimeRuler(canvas, duration) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width || 1;
    const height = canvas.height || 1;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 1;
    const interval = pickTickInterval(duration);
    const totalTicks = Math.max(1, Math.floor(duration / interval));
    const stepPx = Math.max(20, width / Math.max(1, totalTicks));
    for (let i = 0; i <= totalTicks; i++) {
        const t = i * interval;
        const x = Math.floor((t / duration) * width);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, height * 0.55);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
        ctx.fillText(t.toFixed(interval < 1 ? 1 : 0) + 's', x + 3, height * 0.3);
    }
}

function drawFullWaveform(canvas, audioBuffer, options) {
    const mode = options.mode || 'peak';
    const channelMode = options.channelMode || 'mono';
    const baseColor = options.color || '#60a5fa';
    const zoom = options.zoom || 1;
    const pan = options.pan || 0;

    drawTimeRuler(canvas, audioBuffer.duration);

    const ctx = canvas.getContext('2d');
    const width = canvas.width || 1;
    const height = canvas.height || 1;

    const totalLen = audioBuffer.length || 0;
    const numChannels = Math.max(1, audioBuffer.numberOfChannels || 1);
    const visibleFraction = 1 / Math.max(0.01, zoom);
    const startFraction = Math.max(0, Math.min(1 - visibleFraction, pan));
    const startSample = Math.floor(startFraction * totalLen);
    const endSample = Math.max(startSample + 1, Math.min(totalLen, Math.floor((startFraction + visibleFraction) * totalLen)));
    const visibleLen = Math.max(1, endSample - startSample);
    const samplesPerCol = Math.max(1, Math.floor(visibleLen / width));
    ctx.fillStyle = colorWithAlpha(baseColor, 0.85);

    const drawY = 18;
    const drawH = Math.max(10, height - drawY);

    if (channelMode === 'split' && numChannels > 1) {
        const half = Math.floor(drawH / 2) - 1;
        drawChannelBlockRange(ctx, audioBuffer.getChannelData(0), startSample, endSample, samplesPerCol, drawY, width, half, mode);
        drawChannelBlockRange(ctx, audioBuffer.getChannelData(1), startSample, endSample, samplesPerCol, drawY + half + 2, width, half, mode);
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.font = '10px sans-serif';
        ctx.fillText('L', 4, drawY + half * 0.5 + 4);
        ctx.fillText('R', 4, drawY + half + 2 + half * 0.5 + 4);
    } else {
        const left = audioBuffer.getChannelData(0);
        const right = numChannels > 1 ? audioBuffer.getChannelData(1) : null;
        for (let x = 0; x < width; x++) {
            const s = startSample + x * samplesPerCol;
            const e = Math.min(endSample, s + samplesPerCol);
            const amp = Math.max(0.005, Math.min(1, ampMixed(left, right, s, e, mode)));
            const h = amp * (drawH / 2) * 0.95;
            ctx.fillRect(x, (drawY + drawH / 2) - h, 1, h * 2);
        }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(width - 150, 2, 148, 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    const startSec = startSample / Math.max(1, audioBuffer.sampleRate || 44100);
    const endSec = endSample / Math.max(1, audioBuffer.sampleRate || 44100);
    ctx.fillText(startSec.toFixed(2) + 's - ' + endSec.toFixed(2) + 's', width - 144, 9);
}

function drawChannelBlockRange(ctx, data, startSample, endSample, samplesPerCol, yOffset, width, height, mode) {
    if (endSample <= startSample) return;
    for (let x = 0; x < width; x++) {
        const s = startSample + x * samplesPerCol;
        const e = Math.min(endSample, s + samplesPerCol);
        const amp = Math.max(0.005, Math.min(1, ampMono(data, s, e, mode)));
        const h = amp * (height / 2) * 0.95;
        ctx.fillRect(x, (yOffset + height / 2) - h, 1, h * 2);
    }
}

function renderPanelContent() {
    const c = document.getElementById(PANEL_CONTENT_ID);
    if (!c) return;
    const clips = listAudioClips();
    const selectedClip = settings.selectedClipId ? getClipById(settings.selectedClipId) : null;

    const modeLabel = settings.mode === 'rms' ? 'RMS' : 'Peak';
    const channelLabel = settings.channelMode === 'split' ? 'Split (L/R)' : 'Mono mix';
    const colorLabel = settings.colorByTrack ? 'By track' : 'Single';

    c.innerHTML = ''
        + '<div class="text-sm text-gray-300">Visualize audio clip waveforms. Click a clip to inspect a zoomable waveform. Mouse-wheel to zoom, drag to pan.</div>'
        + '<div class="flex flex-wrap gap-3 items-center text-xs p-2 rounded bg-gray-900 border border-gray-800">'
        + '<label class="flex items-center gap-1"><span class="text-gray-400">Mode:</span>'
        + '<select id="wfMode" class="bg-gray-800 text-white px-2 py-1 rounded border border-gray-700">'
        + '<option value="peak"' + (settings.mode === 'peak' ? ' selected' : '') + '>Peak</option>'
        + '<option value="rms"' + (settings.mode === 'rms' ? ' selected' : '') + '>RMS</option>'
        + '</select></label>'
        + '<label class="flex items-center gap-1"><span class="text-gray-400">Channels:</span>'
        + '<select id="wfChannel" class="bg-gray-800 text-white px-2 py-1 rounded border border-gray-700">'
        + '<option value="mono"' + (settings.channelMode === 'mono' ? ' selected' : '') + '>Mono mix</option>'
        + '<option value="split"' + (settings.channelMode === 'split' ? ' selected' : '') + '>Split L/R</option>'
        + '</select></label>'
        + '<label class="flex items-center gap-1"><input type="checkbox" id="wfColorByTrack"' + (settings.colorByTrack ? ' checked' : '') + ' class="accent-blue-500"> <span class="text-gray-400">Color by track</span></label>'
        + '<span class="text-gray-500 ml-auto">' + clips.length + ' clip(s) | ' + modeLabel + ' | ' + channelLabel + ' | ' + colorLabel + '</span>'
        + '</div>'
        + '<div id="wfClipList" class="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1"></div>'
        + '<div id="wfDetail" class="border-t border-gray-800 pt-3"></div>'
        + '<div class="flex gap-2 pt-1">'
        + '<button id="wfExport" class="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium">Export Selected Waveform (PNG)</button>'
        + '<button id="wfReset" class="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">Reset Zoom</button>'
        + '</div>';

    const listEl = c.querySelector('#wfClipList');
    if (clips.length === 0) {
        listEl.innerHTML = '<div class="text-gray-500 text-sm italic p-4">No audio clips with audio buffer found. Add an audio clip to a track first.</div>';
    } else {
        for (const clip of clips) {
            const item = document.createElement('div');
            const isSelected = String(clip.clipId) === String(settings.selectedClipId);
            item.className = 'rounded p-2 border ' + (isSelected ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-900');
            item.dataset.clipId = clip.clipId;
            const trackColor = clip.track && clip.track.color ? clip.track.color : '#60a5fa';
            const color = settings.colorByTrack ? trackColor : '#60a5fa';
            item.innerHTML = ''
                + '<div class="flex justify-between items-baseline mb-1">'
                + '<div class="flex items-center gap-2 min-w-0">'
                + '<span class="inline-block w-3 h-3 rounded-sm flex-shrink-0" style="background:' + escapeHtml(color) + '"></span>'
                + '<span class="font-medium text-white truncate">' + escapeHtml(clip.clipName) + '</span>'
                + '<span class="text-xs text-gray-500">on ' + escapeHtml(clip.trackName) + '</span>'
                + '</div>'
                + '<div class="text-xs text-gray-400 flex-shrink-0">'
                + clip.duration.toFixed(2) + 's | ' + Math.round((clip.buffer.sampleRate || 44100) / 1000) + ' kHz | ' + Math.max(1, clip.buffer.numberOfChannels || 1) + 'ch'
                + '</div>'
                + '</div>'
                + '<canvas class="wf-thumb w-full rounded bg-slate-900" width="' + MAX_THUMBNAIL_WIDTH + '" height="' + MAX_THUMBNAIL_HEIGHT + '"></canvas>';
            listEl.appendChild(item);
            const canvas = item.querySelector('canvas');
            // size canvas to actual rendered width for accurate drawing
            requestAnimationFrame(() => {
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0) {
                    canvas.width = Math.floor(rect.width);
                    canvas.height = MAX_THUMBNAIL_HEIGHT;
                }
                drawThumbnail(canvas, clip.buffer, {
                    mode: settings.mode,
                    channelMode: settings.channelMode,
                    color: color
                });
            });
            item.addEventListener('click', () => {
                settings.selectedClipId = clip.clipId;
                settings.zoom = 1.0;
                settings.pan = 0.0;
                renderPanelContent();
            });
        }
    }

    const detailEl = c.querySelector('#wfDetail');
    if (selectedClip) {
        const trackColor = selectedClip.track && selectedClip.track.color ? selectedClip.track.color : '#60a5fa';
        const color = settings.colorByTrack ? trackColor : '#60a5fa';
        detailEl.innerHTML = ''
            + '<div class="text-sm text-gray-300 mb-2">Detail: <span class="text-white font-medium">' + escapeHtml(selectedClip.clipName) + '</span> (start ' + selectedClip.startTime.toFixed(2) + 's, gain ' + selectedClip.gain.toFixed(2) + ')</div>'
            + '<canvas id="wfFullCanvas" width="800" height="' + FULL_WAVEFORM_HEIGHT + '" class="w-full rounded bg-slate-900"></canvas>'
            + '<div class="text-xs text-gray-500 mt-1">Wheel = zoom | Drag = pan | Click "Reset Zoom" to fit</div>';
        const fullCanvas = detailEl.querySelector('#wfFullCanvas');
        requestAnimationFrame(() => {
            const rect = fullCanvas.getBoundingClientRect();
            if (rect.width > 0) {
                fullCanvas.width = Math.floor(rect.width);
                fullCanvas.height = FULL_WAVEFORM_HEIGHT;
            }
            redrawFullWaveform(selectedClip, color);
            attachWaveformInteractions(fullCanvas, selectedClip, color);
        });
    } else {
        detailEl.innerHTML = '<div class="text-sm text-gray-500 italic py-4 text-center">Select a clip above to see its full waveform.</div>';
    }

    c.querySelector('#wfMode').addEventListener('change', (e) => {
        settings.mode = e.target.value === 'rms' ? 'rms' : 'peak';
        renderPanelContent();
    });
    c.querySelector('#wfChannel').addEventListener('change', (e) => {
        settings.channelMode = e.target.value === 'split' ? 'split' : 'mono';
        renderPanelContent();
    });
    c.querySelector('#wfColorByTrack').addEventListener('change', (e) => {
        settings.colorByTrack = !!e.target.checked;
        renderPanelContent();
    });
    c.querySelector('#wfReset').addEventListener('click', () => {
        settings.zoom = 1.0;
        settings.pan = 0.0;
        renderPanelContent();
    });
    c.querySelector('#wfExport').addEventListener('click', () => {
        if (!selectedClip) {
            notify('Select a clip first', 1800);
            return;
        }
        const fullCanvas = c.querySelector('#wfFullCanvas');
        if (!fullCanvas) return;
        try {
            const dataUrl = fullCanvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'waveform-' + (selectedClip.clipName || selectedClip.clipId) + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            notify('Exported waveform PNG', 2000);
        } catch (e) {
            console.warn('[WaveformVisualizer] Export failed:', e);
            notify('Export failed (CORS?)', 2000);
        }
    });
}

function redrawFullWaveform(selectedClip, color) {
    const c = document.getElementById(PANEL_CONTENT_ID);
    if (!c) return;
    const canvas = c.querySelector('#wfFullCanvas');
    if (!canvas) return;
    drawFullWaveform(canvas, selectedClip.buffer, {
        mode: settings.mode,
        channelMode: settings.channelMode,
        color: color,
        zoom: settings.zoom,
        pan: settings.pan
    });
}

function attachWaveformInteractions(canvas, selectedClip, color) {
    let dragging = false;
    let dragStartX = 0;
    let dragStartPan = 0;

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartPan = settings.pan;
        canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => {
        dragging = false;
        canvas.style.cursor = 'crosshair';
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const deltaPx = e.clientX - dragStartX;
        const widthPx = rect.width || 1;
        const visibleFraction = 1 / Math.max(0.01, settings.zoom);
        const newPan = dragStartPan - (deltaPx / widthPx) * visibleFraction;
        settings.pan = Math.max(0, Math.min(1 - visibleFraction, newPan));
        redrawFullWaveform(selectedClip, color);
    });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
        const visibleFraction = 1 / Math.max(0.01, settings.zoom);
        const focusFrac = settings.pan + xRatio * visibleFraction;
        const direction = e.deltaY < 0 ? 1 : -1;
        const factor = direction > 0 ? 1.25 : 0.8;
        const newZoom = Math.max(1, Math.min(64, settings.zoom * factor));
        const newVisibleFraction = 1 / newZoom;
        let newPan = focusFrac - xRatio * newVisibleFraction;
        newPan = Math.max(0, Math.min(1 - newVisibleFraction, newPan));
        settings.zoom = newZoom;
        settings.pan = newPan;
        redrawFullWaveform(selectedClip, color);
    }, { passive: false });
    canvas.style.cursor = 'crosshair';
}

export function openWaveformVisualizerPanel() {
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        const existing = openWindows && openWindows.get && openWindows.get(WINDOW_ID);
        if (existing) {
            if (existing.restore) existing.restore();
            renderPanelContent();
            isPanelOpen = true;
            return existing;
        }
    }

    const container = document.createElement('div');
    container.id = PANEL_CONTENT_ID;
    container.className = 'p-4 bg-gray-950 text-white h-full flex flex-col gap-3 overflow-y-auto';

    const win = localAppServices.createWindow ? localAppServices.createWindow(
        WINDOW_ID,
        'Waveform Visualizer',
        container,
        {
            width: 720,
            height: 640,
            minWidth: 480,
            minHeight: 400,
            closable: true,
            minimizable: true,
            resizable: true,
            initialContentKey: WINDOW_ID
        }
    ) : null;

    if (win) {
        isPanelOpen = true;
        const origClose = win.close;
        win.close = function () {
            isPanelOpen = false;
            return origClose ? origClose.apply(this, arguments) : undefined;
        };
        renderPanelContent();
    }
    return win;
}

if (typeof window !== 'undefined') {
    window.initWaveformVisualizer = initWaveformVisualizer;
    window.isWaveformVisualizerActive = isWaveformVisualizerActive;
    window.openWaveformVisualizerPanel = openWaveformVisualizerPanel;
    window.WaveformVisualizer = {
        init: initWaveformVisualizer,
        open: openWaveformVisualizerPanel,
        isActive: isWaveformVisualizerActive,
        drawThumbnail,
        drawFullWaveform
    };
}

console.log('[WaveformVisualizer] Module loaded');

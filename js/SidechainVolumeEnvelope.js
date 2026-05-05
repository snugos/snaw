// js/SidechainVolumeEnvelope.js - Draw sidechain ducking volume curves directly on clips
// Feature: Sidechain Volume Envelope - Draw ducking curves on clips for sidechain effects

let localAppServices = {};
let envelopeWindow = null;
let currentTrackId = null;
let currentClipId = null;
let envelopeCanvas = null;
let envelopeCtx = null;
let envelopePoints = []; // { time: 0-1 normalized, value: 0-1 (1 = full volume, 0 = silent) }
let isDraggingPoint = false;
let dragPointIndex = -1;
let originalPointValue = 0;

const ENVELOPE_COLOR = '#ff6b6b';
const GRID_COLOR = '#2a2a2a';
const POINT_RADIUS = 6;
const CANVAS_HEIGHT = 150;

export function initSidechainVolumeEnvelope(appServices) {
    localAppServices = appServices || {};
    console.log('[SidechainVolumeEnvelope] Initialized');
}

export function openSidechainVolumeEnvelopePanel(trackId, clipId) {
    if (!trackId || !clipId) {
        console.warn('[SidechainVolumeEnvelope] Track ID and Clip ID required');
        return null;
    }

    currentTrackId = trackId;
    currentClipId = clipId;

    const windowId = 'sidechainVolumeEnvelope';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        loadEnvelopeData();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'sidechainVolumeEnvelopeContent';
    contentContainer.className = 'p-4 bg-gray-900 text-white h-full flex flex-col select-none';

    const options = {
        width: 600,
        height: 320,
        minWidth: 400,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Sidechain Volume Envelope', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderEnvelopeContent(), 50);
    }

    return win;
}

function renderEnvelopeContent() {
    const container = document.getElementById('sidechainVolumeEnvelopeContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === currentTrackId);
    const clip = track?.timelineClips?.find(c => c.id === currentClipId);
    const clipName = clip?.name || 'Unknown Clip';
    const trackName = track?.name || 'Unknown Track';

    let html = `
        <div class="flex items-center justify-between mb-3">
            <div class="text-sm">
                <span class="text-gray-400">Track:</span>
                <span class="text-white font-medium ml-1">${trackName}</span>
                <span class="text-gray-500 mx-2">|</span>
                <span class="text-gray-400">Clip:</span>
                <span class="text-white font-medium ml-1">${clipName}</span>
            </div>
            <div class="text-xs text-gray-500">
                Value: <span id="envPointValue" class="text-green-400">-</span>
            </div>
        </div>

        <div class="flex-1 bg-black rounded border border-gray-700 relative mb-3" style="height: ${CANVAS_HEIGHT}px;">
            <canvas id="sidechainEnvelopeCanvas" class="w-full h-full cursor-crosshair"></canvas>
        </div>

        <div class="flex items-center gap-4 mb-3 text-xs">
            <div class="flex items-center gap-2">
                <span class="text-gray-400">Curve:</span>
                <select id="envCurveType" class="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white">
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                    <option value="scurve">S-Curve</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-gray-400">Snap:</span>
                <select id="envSnapGrid" class="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white">
                    <option value="0">Off</option>
                    <option value="4">1/4</option>
                    <option value="8" selected>1/8</option>
                    <option value="16">1/16</option>
                </select>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <button id="envAddPoint" class="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white">Add Point</button>
            <button id="envClearAll" class="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white">Clear All</button>
            <button id="envReset" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white">Reset</button>
            <div class="flex-1"></div>
            <div class="text-xs text-gray-500">
                <span class="text-yellow-400">Yellow</span> = Trigger zone (sidechain source above threshold)
            </div>
        </div>

        <div id="envHelpText" class="mt-2 text-xs text-gray-500">
            Click to add points. Drag points to adjust. Right-click point to delete.
        </div>
    `;

    container.innerHTML = html;

    // Initialize canvas
    envelopeCanvas = container.querySelector('#sidechainEnvelopeCanvas');
    if (envelopeCanvas) {
        envelopeCtx = envelopeCanvas.getContext('2d');
        resizeCanvas();
        loadEnvelopeData();

        envelopeCanvas.addEventListener('mousedown', handleMouseDown);
        envelopeCanvas.addEventListener('mousemove', handleMouseMove);
        envelopeCanvas.addEventListener('mouseup', handleMouseUp);
        envelopeCanvas.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('resize', resizeCanvas);
    }

    // Button handlers
    container.querySelector('#envAddPoint')?.addEventListener('click', () => {
        addPointAtCenter();
    });

    container.querySelector('#envClearAll')?.addEventListener('click', () => {
        envelopePoints = [{ time: 0, value: 1 }, { time: 1, value: 1 }];
        saveEnvelopeData();
        drawEnvelope();
    });

    container.querySelector('#envReset')?.addEventListener('click', () => {
        envelopePoints = [{ time: 0, value: 1 }, { time: 0.5, value: 0.2 }, { time: 1, value: 1 }];
        saveEnvelopeData();
        drawEnvelope();
    });

    container.querySelector('#envCurveType')?.addEventListener('change', (e) => {
        saveCurveType(e.target.value);
    });

    container.querySelector('#envSnapGrid')?.addEventListener('change', (e) => {
        saveSnapGrid(parseInt(e.target.value, 10));
    });
}

function resizeCanvas() {
    if (!envelopeCanvas) return;
    const rect = envelopeCanvas.parentElement.getBoundingClientRect();
    envelopeCanvas.width = rect.width;
    envelopeCanvas.height = rect.height;
    drawEnvelope();
}

function loadEnvelopeData() {
    const track = localAppServices.getTrackById?.(currentTrackId);
    const clip = track?.timelineClips?.find(c => c.id === currentClipId);

    if (clip?.sidechainEnvelope) {
        envelopePoints = JSON.parse(JSON.stringify(clip.sidechainEnvelope.points || [{ time: 0, value: 1 }, { time: 1, value: 1 }]));
    } else {
        envelopePoints = [{ time: 0, value: 1 }, { time: 0.5, value: 0.2 }, { time: 1, value: 1 }];
    }

    // Update curve type dropdown
    const curveSelect = document.getElementById('envCurveType');
    if (curveSelect && clip?.sidechainEnvelope?.curve) {
        curveSelect.value = clip.sidechainEnvelope.curve;
    }

    drawEnvelope();
}

function saveEnvelopeData() {
    const track = localAppServices.getTrackById?.(currentTrackId);
    if (!track) return;

    const clip = track.timelineClips?.find(c => c.id === currentClipId);
    if (!clip) return;

    const snapGrid = parseInt(document.getElementById('envSnapGrid')?.value || '8', 10);
    if (snapGrid > 0) {
        envelopePoints.forEach(p => {
            p.time = Math.round(p.time * snapGrid) / snapGrid;
        });
    }

    clip.sidechainEnvelope = {
        points: JSON.parse(JSON.stringify(envelopePoints)),
        curve: document.getElementById('envCurveType')?.value || 'linear'
    };

    // Trigger UI update
    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }

    console.log('[SidechainVolumeEnvelope] Saved envelope with', envelopePoints.length, 'points');
}

function saveCurveType(curveType) {
    const track = localAppServices.getTrackById?.(currentTrackId);
    const clip = track?.timelineClips?.find(c => c.id === currentClipId);
    if (clip?.sidechainEnvelope) {
        clip.sidechainEnvelope.curve = curveType;
        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    }
}

function saveSnapGrid(grid) {
    // Grid value saved locally, applied on save
}

function drawEnvelope() {
    if (!envelopeCtx || !envelopeCanvas) return;

    const ctx = envelopeCtx;
    const width = envelopeCanvas.width;
    const height = envelopeCanvas.height;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    // Vertical lines (time)
    for (let i = 0; i <= 8; i++) {
        const x = (i / 8) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Horizontal lines (levels)
    for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw trigger zone highlight (yellow tint for first half - typical trigger area)
    ctx.fillStyle = 'rgba(255, 200, 50, 0.05)';
    ctx.fillRect(0, 0, width / 2, height);

    // Draw envelope line
    const curveType = document.getElementById('envCurveType')?.value || 'linear';

    ctx.strokeStyle = ENVELOPE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();

    envelopePoints.sort((a, b) => a.time - b.time);

    envelopePoints.forEach((point, i) => {
        const x = point.time * width;
        const y = height - (point.value * height);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            const prevPoint = envelopePoints[i - 1];
            const prevX = prevPoint.time * width;
            const prevY = height - (prevPoint.value * height);

            if (curveType === 'linear') {
                ctx.lineTo(x, y);
            } else if (curveType === 'exponential') {
                const cpX = prevX + (x - prevX) * 0.5;
                ctx.quadraticCurveTo(cpX, prevY, x, y);
            } else if (curveType === 'scurve') {
                const midX = (prevX + x) / 2;
                const midY1 = prevY;
                const midY2 = y;
                ctx.bezierCurveTo(midX, midY1, midX, midY2, x, y);
            }
        }
    });
    ctx.stroke();

    // Draw fill
    ctx.fillStyle = 'rgba(255, 107, 107, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    envelopePoints.forEach((point, i) => {
        const x = point.time * width;
        const y = height - (point.value * height);
        ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Draw points
    envelopePoints.forEach((point, i) => {
        const x = point.time * width;
        const y = height - (point.value * height);

        ctx.beginPath();
        ctx.arc(x, y, i === dragPointIndex ? POINT_RADIUS + 2 : POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = i === dragPointIndex ? '#ff9900' : ENVELOPE_COLOR;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Draw level labels
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.fillText('1.0', 3, 12);
    ctx.fillText('0.5', 3, height / 2 + 4);
    ctx.fillText('0', 3, height - 3);
}

function getCanvasPoint(e) {
    const rect = envelopeCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - ((e.clientY - rect.top) / rect.height);
    return {
        time: Math.max(0, Math.min(1, x)),
        value: Math.max(0, Math.min(1, y))
    };
}

function findPointAt(p) {
    const threshold = 15 / envelopeCanvas.width;
    return envelopePoints.findIndex(pt =>
        Math.abs(pt.time - p.time) < threshold &&
        Math.abs(pt.value - p.value) < 0.15
    );
}

function handleMouseDown(e) {
    if (e.button !== 0) return;

    const p = getCanvasPoint(e);
    const idx = findPointAt(p);

    if (idx !== -1) {
        isDraggingPoint = true;
        dragPointIndex = idx;
        originalPointValue = envelopePoints[idx].value;
    } else {
        // Add new point
        envelopePoints.push({ time: p.time, value: p.value });
        dragPointIndex = envelopePoints.length - 1;
        isDraggingPoint = true;
    }

    drawEnvelope();
}

function handleMouseMove(e) {
    const p = getCanvasPoint(e);

    if (isDraggingPoint && dragPointIndex !== -1) {
        envelopePoints[dragPointIndex].time = p.time;
        envelopePoints[dragPointIndex].value = p.value;

        // Update value display
        const valDisplay = document.getElementById('envPointValue');
        if (valDisplay) {
            valDisplay.textContent = p.value.toFixed(2);
        }

        drawEnvelope();
    } else {
        // Update cursor based on hover
        const idx = findPointAt(p);
        envelopeCanvas.style.cursor = idx !== -1 ? 'grab' : 'crosshair';
    }
}

function handleMouseUp(e) {
    if (isDraggingPoint) {
        isDraggingPoint = false;

        // Ensure we don't have duplicate time values
        envelopePoints.sort((a, b) => a.time - b.time);
        const idx = envelopePoints.findIndex(p =>
            Math.abs(p.time - envelopePoints[dragPointIndex].time) < 0.001 &&
            Math.abs(p.value - envelopePoints[dragPointIndex].value) < 0.001
        );
        dragPointIndex = idx;

        saveEnvelopeData();
        drawEnvelope();
    }
}

function handleContextMenu(e) {
    e.preventDefault();
    const p = getCanvasPoint(e);
    const idx = findPointAt(p);

    if (idx !== -1 && envelopePoints.length > 2) {
        envelopePoints.splice(idx, 1);
        saveEnvelopeData();
        drawEnvelope();
    }
}

function addPointAtCenter() {
    envelopePoints.push({ time: 0.5, value: 0.3 });
    saveEnvelopeData();
    drawEnvelope();
}

// Export for external access
export function getSidechainEnvelope(trackId, clipId) {
    const track = localAppServices.getTrackById?.(trackId);
    const clip = track?.timelineClips?.find(c => c.id === clipId);
    return clip?.sidechainEnvelope || null;
}
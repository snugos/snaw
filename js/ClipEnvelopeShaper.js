/**
 * js/ClipEnvelopeShaper.js - Draw custom amplitude envelopes on clips
 * Provides visual envelope editing for precise dynamics control
 */

let localAppServices = {};
let activeEnvelope = null;
let envelopeCanvas = null;
let envelopeCtx = null;
let isDragging = false;
let dragPointIndex = -1;
let envelopePoints = []; // { time: 0-1, gain: 0-1 }

const ENVELOPE_HEIGHT = 80;
const MIN_POINT_DISTANCE = 0.05;

/**
 * Initialize the Clip Envelope Shaper module
 * @param {Object} appServices - App services from main.js
 */
export function initClipEnvelopeShaper(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipEnvelopeShaper] Module initialized');
}

/**
 * Open the envelope editor for a specific clip
 * @param {string} trackId - Track ID
 * @param {string} clipId - Clip ID
 */
export function openEnvelopeEditor(trackId, clipId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.warn('[ClipEnvelopeShaper] Track not found:', trackId);
        return;
    }

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        console.warn('[ClipEnvelopeShaper] Clip not found:', clipId);
        return;
    }

    // Initialize envelope points from clip's envelope or defaults
    if (clip.envelopePoints && clip.envelopePoints.length > 0) {
        envelopePoints = [...clip.envelopePoints];
    } else {
        // Default envelope: linear from start to end
        envelopePoints = [
            { time: 0, gain: 1 },
            { time: 1, gain: 1 }
        ];
    }

    activeEnvelope = { trackId, clipId, track, clip };
    showEnvelopePanel();
    renderEnvelope();
}

/**
 * Close the envelope editor
 */
export function closeEnvelopeEditor() {
    if (activeEnvelope) {
        // Save envelope to clip before closing
        saveEnvelopeToClip();
    }
    activeEnvelope = null;
    hideEnvelopePanel();
}

/**
 * Show the envelope panel UI
 */
function showEnvelopePanel() {
    let panel = document.getElementById('clipEnvelopePanel');
    if (!panel) {
        panel = createEnvelopePanel();
        document.body.appendChild(panel);
    }
    panel.style.display = 'flex';
    updatePanelPosition();
}

/**
 * Hide the envelope panel UI
 */
function hideEnvelopePanel() {
    const panel = document.getElementById('clipEnvelopePanel');
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * Create the envelope panel DOM element
 */
function createEnvelopePanel() {
    const panel = document.createElement('div');
    panel.id = 'clipEnvelopePanel';
    panel.innerHTML = `
        <div class="env-panel-header">
            <span class="env-title">Clip Envelope</span>
            <div class="env-header-btns">
                <button id="envResetBtn" class="env-btn">Reset</button>
                <button id="envCloseBtn" class="env-btn env-close">×</button>
            </div>
        </div>
        <div class="env-info" id="envInfo">No clip selected</div>
        <div class="env-canvas-container">
            <canvas id="envelopeCanvas" width="400" height="${ENVELOPE_HEIGHT}"></canvas>
        </div>
        <div class="env-presets">
            <button class="env-preset-btn" data-preset="linear">Linear</button>
            <button class="env-preset-btn" data-preset="fadeIn">Fade In</button>
            <button class="env-preset-btn" data-preset="fadeOut">Fade Out</button>
            <button class="env-preset-btn" data-preset="fadeInOut">Fade In/Out</button>
            <button class="env-preset-btn" data-preset="exponential">Exp</button>
            <button class="env-preset-btn" data-preset="sCurve">S-Curve</button>
        </div>
        <div class="env-actions">
            <button id="envApplyBtn" class="env-btn env-apply">Apply</button>
            <button id="envCancelBtn" class="env-btn">Cancel</button>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #clipEnvelopePanel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 420px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px;
            display: none;
            flex-direction: column;
            gap: 10px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .env-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .env-title { color: #fff; font-weight: 600; font-size: 14px; }
        .env-header-btns { display: flex; gap: 8px; }
        .env-btn {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #ccc;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .env-btn:hover { background: #3a3a3a; color: #fff; }
        .env-close { font-size: 18px; padding: 2px 8px; }
        .env-info { color: #888; font-size: 12px; }
        .env-canvas-container { background: #0a0a0a; border-radius: 4px; padding: 4px; }
        #envelopeCanvas { width: 100%; cursor: crosshair; }
        .env-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .env-preset-btn {
            background: #252525;
            border: 1px solid #3a3a3a;
            color: #aaa;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }
        .env-preset-btn:hover { background: #333; color: #fff; }
        .env-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .env-apply { background: #4a4a6a; border-color: #5a5a7a; }
        .env-apply:hover { background: #5a5a7a; }
    `;
    document.head.appendChild(style);

    // Bind events
    panel.querySelector('#envCloseBtn').onclick = closeEnvelopeEditor;
    panel.querySelector('#envResetBtn').onclick = resetEnvelope;
    panel.querySelector('#envApplyBtn').onclick = applyEnvelope;
    panel.querySelector('#envCancelBtn').onclick = closeEnvelopeEditor;

    // Preset buttons
    panel.querySelectorAll('.env-preset-btn').forEach(btn => {
        btn.onclick = () => applyPreset(btn.dataset.preset);
    });

    // Canvas interaction
    envelopeCanvas = panel.querySelector('#envelopeCanvas');
    envelopeCtx = envelopeCanvas.getContext('2d');

    envelopeCanvas.addEventListener('mousedown', onCanvasMouseDown);
    envelopeCanvas.addEventListener('mousemove', onCanvasMouseMove);
    envelopeCanvas.addEventListener('mouseup', onCanvasMouseUp);
    envelopeCanvas.addEventListener('mouseleave', onCanvasMouseUp);

    return panel;
}

/**
 * Update panel position based on active clip
 */
function updatePanelPosition() {
    const info = document.getElementById('envInfo');
    if (activeEnvelope && info) {
        info.textContent = `${activeEnvelope.track.name} - Clip`;
    }
}

/**
 * Render the envelope on canvas
 */
function renderEnvelope() {
    if (!envelopeCtx || !envelopeCanvas) return;

    const width = envelopeCanvas.width;
    const height = envelopeCanvas.height;
    const ctx = envelopeCtx;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw envelope line
    ctx.strokeStyle = '#6a6aaa';
    ctx.lineWidth = 2;
    ctx.beginPath();

    envelopePoints.forEach((pt, i) => {
        const x = pt.time * width;
        const y = (1 - pt.gain) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill area under envelope
    ctx.fillStyle = 'rgba(106, 106, 170, 0.2)';
    ctx.beginPath();
    ctx.moveTo(envelopePoints[0].time * width, height);
    envelopePoints.forEach(pt => {
        ctx.lineTo(pt.time * width, (1 - pt.gain) * height);
    });
    ctx.lineTo(envelopePoints[envelopePoints.length - 1].time * width, height);
    ctx.closePath();
    ctx.fill();

    // Draw points
    envelopePoints.forEach((pt, i) => {
        const x = pt.time * width;
        const y = (1 - pt.gain) * height;
        ctx.fillStyle = isDragging && dragPointIndex === i ? '#aaa' : '#888';
        ctx.beginPath();
        ctx.arc(x, y, i === 0 || i === envelopePoints.length - 1 ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

/**
 * Get point at canvas coordinates
 */
function getPointAt(x, y) {
    const width = envelopeCanvas.width;
    const height = envelopeCanvas.height;
    const time = Math.max(0, Math.min(1, x / width));
    const gain = Math.max(0, Math.min(1, 1 - y / height));

    // Find closest existing point
    for (let i = 0; i < envelopePoints.length; i++) {
        const pt = envelopePoints[i];
        const px = pt.time * width;
        const py = (1 - pt.gain) * height;
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist < 10) return { index: i, time: pt.time, gain: pt.gain };
    }

    return null;
}

/**
 * Add a new point at position
 */
function addPointAt(x, y) {
    const width = envelopeCanvas.width;
    const time = Math.max(0, Math.min(1, x / width));
    const gain = Math.max(0, Math.min(1, 1 - y / height));

    // Check minimum distance from existing points
    for (const pt of envelopePoints) {
        if (Math.abs(pt.time - time) < MIN_POINT_DISTANCE) return;
    }

    // Insert in sorted order
    const index = envelopePoints.findIndex(pt => pt.time > time);
    const newPt = { time, gain };
    if (index === -1) envelopePoints.push(newPt);
    else envelopePoints.splice(index, 0, newPt);

    renderEnvelope();
}

/**
 * Canvas mouse handlers
 */
function onCanvasMouseDown(e) {
    const rect = envelopeCanvas.getBoundingClientRect();
    const scaleX = envelopeCanvas.width / rect.width;
    const scaleY = envelopeCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hit = getPointAt(x, y);
    if (hit) {
        isDragging = true;
        dragPointIndex = hit.index;
    } else {
        addPointAt(x, y);
    }
}

function onCanvasMouseMove(e) {
    if (!isDragging || dragPointIndex < 0) return;

    const rect = envelopeCanvas.getBoundingClientRect();
    const scaleX = envelopeCanvas.width / rect.width;
    const scaleY = envelopeCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const width = envelopeCanvas.width;
    const height = envelopeCanvas.height;
    const time = Math.max(0, Math.min(1, x / width));
    const gain = Math.max(0, Math.min(1, 1 - y / height));

    // Don't allow moving first or last point horizontally
    if (dragPointIndex > 0 && dragPointIndex < envelopePoints.length - 1) {
        envelopePoints[dragPointIndex].time = time;
    }
    envelopePoints[dragPointIndex].gain = gain;

    // Sort by time (keep first and last positions)
    envelopePoints.sort((a, b) => a.time - b.time);

    // Find our point again after sort
    dragPointIndex = envelopePoints.findIndex(pt => pt.time === time);

    renderEnvelope();
}

function onCanvasMouseUp() {
    isDragging = false;
    dragPointIndex = -1;
}

/**
 * Apply a preset envelope shape
 */
function applyPreset(preset) {
    switch (preset) {
        case 'linear':
            envelopePoints = [{ time: 0, gain: 1 }, { time: 1, gain: 1 }];
            break;
        case 'fadeIn':
            envelopePoints = [
                { time: 0, gain: 0 },
                { time: 0.3, gain: 0.5 },
                { time: 0.7, gain: 0.9 },
                { time: 1, gain: 1 }
            ];
            break;
        case 'fadeOut':
            envelopePoints = [
                { time: 0, gain: 1 },
                { time: 0.3, gain: 0.9 },
                { time: 0.7, gain: 0.5 },
                { time: 1, gain: 0 }
            ];
            break;
        case 'fadeInOut':
            envelopePoints = [
                { time: 0, gain: 0 },
                { time: 0.25, gain: 0.8 },
                { time: 0.5, gain: 1 },
                { time: 0.75, gain: 0.8 },
                { time: 1, gain: 0 }
            ];
            break;
        case 'exponential':
            envelopePoints = [
                { time: 0, gain: 0.1 },
                { time: 0.25, gain: 0.4 },
                { time: 0.5, gain: 0.7 },
                { time: 0.75, gain: 0.9 },
                { time: 1, gain: 1 }
            ];
            break;
        case 'sCurve':
            envelopePoints = [
                { time: 0, gain: 0.2 },
                { time: 0.25, gain: 0.45 },
                { time: 0.5, gain: 0.5 },
                { time: 0.75, gain: 0.55 },
                { time: 1, gain: 0.8 }
            ];
            break;
    }
    renderEnvelope();
}

/**
 * Reset envelope to default
 */
function resetEnvelope() {
    envelopePoints = [{ time: 0, gain: 1 }, { time: 1, gain: 1 }];
    renderEnvelope();
}

/**
 * Save envelope to clip
 */
function saveEnvelopeToClip() {
    if (!activeEnvelope) return;
    const { clip } = activeEnvelope;
    clip.envelopePoints = [...envelopePoints];
    console.log('[ClipEnvelopeShaper] Saved envelope to clip:', envelopePoints.length, 'points');
}

/**
 * Apply envelope (close and confirm)
 */
function applyEnvelope() {
    saveEnvelopeToClip();
    closeEnvelopeEditor();
    showNotification?.('Envelope applied', 'success');
}

/**
 * Toggle envelope for a clip (open if closed, close if open)
 */
export function toggleClipEnvelope(trackId, clipId) {
    if (activeEnvelope && activeEnvelope.clipId === clipId) {
        closeEnvelopeEditor();
    } else {
        openEnvelopeEditor(trackId, clipId);
    }
}
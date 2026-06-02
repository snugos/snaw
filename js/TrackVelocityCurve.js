// js/TrackVelocityCurve.js - Per-track velocity response curve
// Allows customizing how MIDI input velocity maps to output dynamics per track

let localAppServices = {};
let currentTrackId = null;
let currentCurve = []; // Array of 16 values (0-1) representing velocity response
const CURVE_STEPS = 16; // 16 velocity zones

// Default linear curve
function createDefaultCurve() {
    currentCurve = [];
    for (let i = 0; i < CURVE_STEPS; i++) {
        currentCurve.push(0.7); // 70% output for all inputs
    }
}

/**
 * Initialize the track velocity curve module
 * @param {object} services - App services
 */
export function initTrackVelocityCurve(services) {
    localAppServices = services;
    console.log('[TrackVelocityCurve] Initialized');
    createDefaultCurve();
}

/**
 * Open the velocity curve panel for a specific track
 * @param {number} trackId - Track ID
 */
export function openTrackVelocityCurvePanel(trackId) {
    currentTrackId = trackId;
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[TrackVelocityCurve] Track not found:', trackId);
        return;
    }

    // Load existing curve from track or use default
    if (track.velocityCurve && Array.isArray(track.velocityCurve) && track.velocityCurve.length === CURVE_STEPS) {
        currentCurve = [...track.velocityCurve];
    } else {
        createDefaultCurve();
    }

    const windowId = `trackVelocityCurve-${trackId}`;
    const existingWin = localAppServices.getOpenWindows?.()?.get(windowId);
    if (existingWin) {
        existingWin.restore();
        renderVelocityCurveContent(track);
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = `trackVelocityCurveContent-${trackId}`;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

    const options = {
        width: 480,
        height: 380,
        minWidth: 400,
        minHeight: 320,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, `Velocity Response: ${track.name || 'Track'}`, contentContainer, options);

    if (win?.element) {
        renderVelocityCurveContent(track);
    }
}

/**
 * Render the velocity curve content
 * @param {object} track - Track object
 */
function renderVelocityCurveContent(track) {
    const container = document.getElementById(`trackVelocityCurveContent-${track.id}`);
    if (!container) return;

    container.innerHTML = `
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Velocity Response Curve</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
                Customize how MIDI velocity maps to output dynamics for "${track.name || 'this track'}".
            </p>
        </div>

        <!-- Canvas area -->
        <div class="flex-1 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 relative mb-3">
            <canvas id="velocityCurveCanvas" class="w-full h-full cursor-crosshair"></canvas>
            <div id="velocityCurveHint" class="absolute bottom-2 right-2 text-xs text-gray-400">
                Click & drag to draw
            </div>
        </div>

        <!-- Value display -->
        <div class="text-xs text-center text-gray-500 dark:text-gray-400 mb-2" id="velocityValueDisplay">
            Zone 0: 70%
        </div>

        <!-- Presets -->
        <div class="flex items-center gap-2 mb-3">
            <span class="text-xs text-gray-600 dark:text-gray-400">Presets:</span>
            <select id="velocityCurvePresetSelect" class="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <option value="linear">Linear (70%)</option>
                <option value="soft">Soft (Gentle rise)</option>
                <option value="hard">Hard (Fast rise)</option>
                <option value="peak">Peak (Bell curve)</option>
                <option value="dynamic">Dynamic (Wide range)</option>
            </select>
            <button id="applyVelocityCurvePreset" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                Apply
            </button>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
            <button id="resetVelocityCurveBtn" class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">
                Reset
            </button>
            <button id="invertVelocityCurveBtn" class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">
                Invert
            </button>
            <div class="flex-1"></div>
            <button id="saveVelocityCurveBtn" class="px-4 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                Save to Track
            </button>
        </div>
    `;

    // Setup canvas after HTML is added
    setTimeout(() => {
        setupVelocityCurveCanvas(track);
        drawVelocityCurve();
    }, 50);

    // Preset selector
    const presetSelect = document.getElementById('velocityCurvePresetSelect');
    const applyPresetBtn = document.getElementById('applyVelocityCurvePreset');
    if (applyPresetBtn) {
        applyPresetBtn.addEventListener('click', () => {
            const preset = presetSelect?.value;
            applyCurvePreset(preset);
            drawVelocityCurve();
        });
    }

    // Reset button
    const resetBtn = document.getElementById('resetVelocityCurveBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            createDefaultCurve();
            drawVelocityCurve();
        });
    }

    // Invert button
    const invertBtn = document.getElementById('invertVelocityCurveBtn');
    if (invertBtn) {
        invertBtn.addEventListener('click', () => {
            for (let i = 0; i < currentCurve.length; i++) {
                currentCurve[i] = 1 - currentCurve[i];
            }
            drawVelocityCurve();
        });
    }

    // Save button
    const saveBtn = document.getElementById('saveVelocityCurveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveVelocityCurveToTrack(track);
        });
    }
}

/**
 * Setup canvas for velocity curve drawing
 */
function setupVelocityCurveCanvas(track) {
    const canvas = document.getElementById('velocityCurveCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawVelocityCurve();
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function getZoneFromX(x) {
        const zoneWidth = canvas.width / CURVE_STEPS;
        return Math.max(0, Math.min(CURVE_STEPS - 1, Math.floor(x / zoneWidth)));
    }

    function getValueFromY(y) {
        return Math.max(0, Math.min(1, 1 - (y / canvas.height)));
    }

    function updateDisplay(zone, value) {
        const display = document.getElementById('velocityValueDisplay');
        if (display) {
            display.textContent = `Zone ${zone}: ${Math.round(value * 100)}%`;
        }
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const zone = getZoneFromX(x);
        const value = getValueFromY(y);
        currentCurve[zone] = value;
        updateDisplay(zone, value);
        drawVelocityCurve();
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const zone = getZoneFromX(x);

        if (zone >= 0 && zone < CURVE_STEPS) {
            updateDisplay(zone, currentCurve[zone]);
        }

        if (isDrawing) {
            const value = getValueFromY(y);
            currentCurve[zone] = value;
            updateDisplay(zone, value);
            drawVelocityCurve();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });
}

/**
 * Draw the velocity curve on canvas
 */
function drawVelocityCurve() {
    const canvas = document.getElementById('velocityCurveCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;

    // Horizontal lines (5 divisions)
    for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Vertical lines (zones)
    const zoneWidth = w / CURVE_STEPS;
    for (let i = 0; i <= CURVE_STEPS; i++) {
        const x = i * zoneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    // Draw zone backgrounds (red to green gradient based on value)
    for (let i = 0; i < CURVE_STEPS; i++) {
        const value = currentCurve[i];
        const x = i * zoneWidth;
        const y = h - (value * h);

        // Color based on value: low=blue, mid=green, high=red
        let r = Math.round(255 * (1 - value));
        let g = Math.round(255 * value);
        ctx.fillStyle = `rgba(${r}, ${g}, 80, 0.3)`;
        ctx.fillRect(x, y, zoneWidth, h - y);
    }

    // Draw curve line
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < CURVE_STEPS; i++) {
        const x = (i + 0.5) * zoneWidth;
        const y = h - (currentCurve[i] * h);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Draw points
    for (let i = 0; i < CURVE_STEPS; i++) {
        const x = (i + 0.5) * zoneWidth;
        const y = h - (currentCurve[i] * h);

        const value = currentCurve[i];
        const r = Math.round(255 * (1 - value));
        const g = Math.round(255 * value);

        ctx.fillStyle = `rgb(${r}, ${g}, 100)`;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Zone number
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${i}`, x, h - 4);
    }
}

/**
 * Apply a preset curve
 */
function applyCurvePreset(preset) {
    createDefaultCurve();

    switch (preset) {
        case 'soft':
            // Gentle rise - low velocities amplified, high compressed
            for (let i = 0; i < CURVE_STEPS; i++) {
                const input = i / (CURVE_STEPS - 1);
                const output = Math.pow(input, 0.5); // Soft curve
                currentCurve[i] = 0.2 + (output * 0.6); // Range 0.2 to 0.8
            }
            break;
        case 'hard':
            // Fast rise - needs more velocity to get loud
            for (let i = 0; i < CURVE_STEPS; i++) {
                const input = i / (CURVE_STEPS - 1);
                const output = Math.pow(input, 2); // Hard curve
                currentCurve[i] = 0.1 + (output * 0.85); // Range 0.1 to 0.95
            }
            break;
        case 'peak':
            // Bell curve - peak in middle
            for (let i = 0; i < CURVE_STEPS; i++) {
                const input = i / (CURVE_STEPS - 1);
                const dist = Math.abs(input - 0.5) * 2;
                currentCurve[i] = Math.max(0.15, 1 - (dist * dist * 0.85));
            }
            break;
        case 'dynamic':
            // Wide dynamic range - very soft to very loud
            for (let i = 0; i < CURVE_STEPS; i++) {
                const input = i / (CURVE_STEPS - 1);
                currentCurve[i] = 0.1 + (input * 0.8); // 10% to 90%
            }
            break;
        case 'linear':
        default:
            // Already set to 0.7 by createDefaultCurve()
            break;
    }
}

/**
 * Save velocity curve to track
 */
function saveVelocityCurveToTrack(track) {
    if (!track) return;

    // Store curve on track
    track.velocityCurve = [...currentCurve];

    // Save to localStorage for persistence
    const storageKey = `snugos_velocity_curve_${track.id}`;
    try {
        localStorage.setItem(storageKey, JSON.stringify(currentCurve));
    } catch (e) {
        console.warn('[TrackVelocityCurve] Failed to save to localStorage:', e);
    }

    localAppServices.showNotification?.(`Velocity curve saved to "${track.name}"`, 2000);
    localAppServices.updateTrackUI?.(track.id, 'velocityCurveChanged');
}

/**
 * Load velocity curve from track or storage
 */
export function loadVelocityCurveForTrack(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return null;

    // Try track property first
    if (track.velocityCurve && Array.isArray(track.velocityCurve) && track.velocityCurve.length === CURVE_STEPS) {
        return [...track.velocityCurve];
    }

    // Try localStorage
    const storageKey = `snugos_velocity_curve_${trackId}`;
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === CURVE_STEPS) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('[TrackVelocityCurve] Failed to load from localStorage:', e);
    }

    return null; // Return null to use default
}

/**
 * Apply velocity curve to a normalized input velocity (0-1)
 * Returns the modified velocity after curve application
 */
export function applyVelocityCurveToInput(trackId, normalizedVelocity) {
    const curve = loadVelocityCurveForTrack(trackId);
    if (!curve) return normalizedVelocity; // No curve, return input unchanged

    // Map normalized velocity (0-1) to zone index
    const zoneIndex = Math.min(CURVE_STEPS - 1, Math.floor(normalizedVelocity * CURVE_STEPS));
    const zoneValue = curve[zoneIndex] || 0.7;

    // Apply curve: output = input * curve[zone]
    // This scales the input velocity by the curve value for that zone
    return Math.min(1, normalizedVelocity * zoneValue * 1.5); // 1.5 multiplier to boost effect
}

console.log('[TrackVelocityCurve] Module loaded');
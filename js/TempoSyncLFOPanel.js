// js/TempoSyncLFOPanel.js - Tempo-Synced LFO Panel UI
// Provides a visual panel for creating and configuring tempo-synced LFO modulations

import { TempoSyncLFO } from './TempoSyncLFO.js';

let localAppServices = {};
let lfoInstances = []; // Multiple LFOs can be created
let activeLFOIndex = -1;
let pendingConnection = null; // For selecting which param to modulate

export function initTempoSyncLFOPanel(services) {
    localAppServices = services || {};
    console.log('[TempoSyncLFOPanel] Initialized');
}

/**
 * Open the Tempo Sync LFO panel
 */
export function openTempoSyncLFOPanel(savedState = null) {
    const windowId = 'tempoSyncLFO';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const openWindows = getOpenWindows();

    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoSyncLFOContent';
    contentContainer.className = 'flex flex-col h-full bg-gray-100 dark:bg-slate-800 overflow-y-auto';

    const options = {
        width: 500,
        height: 550,
        minWidth: 400,
        minHeight: 450,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    if (savedState) {
        Object.assign(options, {
            x: parseInt(savedState.left, 10),
            y: parseInt(savedState.top, 10),
            width: parseInt(savedState.width, 10),
            height: parseInt(savedState.height, 10),
            zIndex: savedState.zIndex,
            isMinimized: savedState.isMinimized
        });
    }

    const createWindowFn = localAppServices.createWindow || window.createWindow;
    if (!createWindowFn) {
        console.error('[TempoSyncLFOPanel] createWindow not available');
        return null;
    }

    const win = createWindowFn(windowId, 'Tempo Sync LFO', contentContainer, options);
    if (win?.element) {
        renderPanelContent();
    }

    return win;
}

/**
 * Get current tempo from app services
 */
function getCurrentTempo() {
    if (localAppServices.getTempoState) {
        return localAppServices.getTempoState();
    }
    return 120;
}

/**
 * Get audio context
 */
function getAudioContext() {
    if (typeof Tone !== 'undefined' && Tone.getContext) {
        return Tone.getContext().rawContext;
    }
    if (window.audioContext) return window.audioContext;
    return null;
}

/**
 * Render the panel content
 */
function renderPanelContent() {
    const container = document.getElementById('tempoSyncLFOContent');
    if (!container) return;

    const ctx = getAudioContext();
    const tempo = getCurrentTempo();

    // Create LFO instance if none exists
    if (lfoInstances.length === 0 && ctx) {
        createNewLFO(tempo);
    }

    const activeLFO = lfoInstances[activeLFOIndex];
    const settings = activeLFO ? activeLFO.getSettings() : null;

    const divisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '2/1', '4/1'];
    const waveforms = ['sine', 'triangle', 'square', 'sawtooth'];

    container.innerHTML = `
        <div class="p-4 space-y-4">
            <!-- Header -->
            <div class="text-sm text-gray-600 dark:text-gray-400">
                Create tempo-synced LFO modulation for effect parameters. 
                The LFO rate is locked to your BPM.
            </div>

            <!-- LFO Selector -->
            <div class="flex items-center gap-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">LFO:</label>
                <select id="lfoSelector" class="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    ${lfoInstances.map((_, i) => `<option value="${i}" ${i === activeLFOIndex ? 'selected' : ''}>LFO ${i + 1}</option>`).join('')}
                </select>
                <button id="addLFOBtn" class="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 rounded text-white">+ Add</button>
                ${lfoInstances.length > 1 ? '<button id="removeLFOBtn" class="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 rounded text-white">Remove</button>' : ''}
            </div>

            ${settings ? `
            <!-- Rate Division -->
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Rate Division</label>
                <div class="grid grid-cols-4 gap-2">
                    ${divisions.map(d => `
                        <button class="lfo-division-btn px-2 py-2 text-xs rounded border ${settings.rateDivision === d ? 'bg-blue-500 text-white border-blue-600' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600'}" data-division="${d}">
                            ${d}
                        </button>
                    `).join('')}
                </div>
                <div class="text-xs text-gray-500">Current: ${settings.frequency?.toFixed(2) || '0'} Hz</div>
            </div>

            <!-- Waveform -->
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Waveform</label>
                <div class="flex gap-2">
                    ${waveforms.map(w => `
                        <button class="lfo-waveform-btn flex-1 px-2 py-2 text-xs rounded border ${settings.waveform === w ? 'bg-blue-500 text-white border-blue-600' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600'}" data-waveform="${w}">
                            ${w.charAt(0).toUpperCase() + w.slice(1)}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Depth -->
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Depth: <span id="depthValue">${Math.round(settings.depth * 100)}%</span></label>
                <input type="range" id="lfoDepthSlider" min="0" max="100" value="${Math.round(settings.depth * 100)}" class="w-full">
            </div>

            <!-- Phase -->
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Phase Offset: <span id="phaseValue">${settings.phase}°</span></label>
                <input type="range" id="lfoPhaseSlider" min="0" max="360" step="15" value="${settings.phase}" class="w-full">
            </div>

            <!-- Tempo Display -->
            <div class="flex items-center justify-between p-3 bg-gray-200 dark:bg-slate-700 rounded">
                <span class="text-sm text-gray-600 dark:text-gray-400">Tempo:</span>
                <span class="text-lg font-bold text-blue-600 dark:text-blue-400">${tempo} BPM</span>
            </div>

            <!-- Connection Section -->
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Connect To Parameter</label>
                <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600">
                    <p class="text-xs text-gray-500 mb-2">Click a parameter in an effect's UI while this panel is open to connect the LFO.</p>
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-700 dark:text-gray-300">Connected: <span id="connectedCount" class="font-bold">${settings.connectedParamsCount}</span> param(s)</span>
                        <button id="clearConnectionsBtn" class="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 rounded text-white">Clear All</button>
                    </div>
                </div>
            </div>

            <!-- Visual Preview -->
            <div class="p-3 bg-black rounded">
                <canvas id="lfoPreviewCanvas" width="460" height="80" class="w-full rounded"></canvas>
            </div>

            <!-- Start/Stop -->
            <div class="flex gap-2">
                <button id="lfoStartStopBtn" class="flex-1 px-4 py-2 text-sm font-medium rounded ${settings.isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white">
                    ${settings.isRunning ? 'Stop LFO' : 'Start LFO'}
                </button>
            </div>
            ` : '<p class="text-center text-gray-500">Click "Add" to create an LFO</p>'}
        </div>
    `;

    attachPanelEvents();
    drawLFOPreview();
}

/**
 * Create a new LFO instance
 */
function createNewLFO(tempo) {
    const ctx = getAudioContext();
    if (!ctx) {
        localAppServices.showNotification?.('Audio context not available', 2000);
        return;
    }

    const lfo = new TempoSyncLFO(ctx, { tempo });
    lfo.start();
    lfoInstances.push(lfo);
    activeLFOIndex = lfoInstances.length - 1;
    
    localAppServices.showNotification?.(`LFO ${lfoInstances.length} created`, 1500);
    renderPanelContent();
}

/**
 * Remove the active LFO
 */
function removeActiveLFO() {
    if (activeLFOIndex < 0 || lfoInstances.length <= 1) return;
    
    lfoInstances[activeLFOIndex].dispose();
    lfoInstances.splice(activeLFOIndex, 1);
    activeLFOIndex = Math.min(activeLFOIndex, lfoInstances.length - 1);
    
    localAppServices.showNotification?.('LFO removed', 1500);
    renderPanelContent();
}

/**
 * Attach event handlers to panel elements
 */
function attachPanelEvents() {
    const container = document.getElementById('tempoSyncLFOContent');
    if (!container) return;

    // LFO selector
    const selector = container.querySelector('#lfoSelector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            activeLFOIndex = parseInt(e.target.value);
            renderPanelContent();
        });
    }

    // Add LFO button
    const addBtn = container.querySelector('#addLFOBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => createNewLFO(getCurrentTempo()));
    }

    // Remove LFO button
    const removeBtn = container.querySelector('#removeLFOBtn');
    if (removeBtn) {
        removeBtn.addEventListener('click', removeActiveLFO);
    }

    // Division buttons
    container.querySelectorAll('.lfo-division-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lfo = lfoInstances[activeLFOIndex];
            if (lfo) {
                lfo.setRateDivision(btn.dataset.division);
                renderPanelContent();
            }
        });
    });

    // Waveform buttons
    container.querySelectorAll('.lfo-waveform-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lfo = lfoInstances[activeLFOIndex];
            if (lfo) {
                lfo.setWaveform(btn.dataset.waveform);
                renderPanelContent();
            }
        });
    });

    // Depth slider
    const depthSlider = container.querySelector('#lfoDepthSlider');
    const depthValue = container.querySelector('#depthValue');
    if (depthSlider && depthValue) {
        depthSlider.addEventListener('input', (e) => {
            const lfo = lfoInstances[activeLFOIndex];
            if (lfo) {
                lfo.setDepth(parseInt(e.target.value) / 100);
                depthValue.textContent = `${e.target.value}%`;
                drawLFOPreview();
            }
        });
    }

    // Phase slider
    const phaseSlider = container.querySelector('#lfoPhaseSlider');
    const phaseValue = container.querySelector('#phaseValue');
    if (phaseSlider && phaseValue) {
        phaseSlider.addEventListener('input', (e) => {
            const lfo = lfoInstances[activeLFOIndex];
            if (lfo) {
                lfo.setPhase(parseInt(e.target.value));
                phaseValue.textContent = `${e.target.value}°`;
                drawLFOPreview();
            }
        });
    }

    // Clear connections button
    const clearBtn = container.querySelector('#clearConnectionsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const lfo = lfoInstances[activeLFOIndex];
            if (lfo) {
                lfo.disconnectAll();
                renderPanelContent();
            }
        });
    }

    // Start/Stop button
    const startStopBtn = container.querySelector('#lfoStartStopBtn');
    if (startStopBtn) {
        startStopBtn.addEventListener('click', () => {
            const lfo = lfoInstances[activeLFOIndex];
            if (lfo) {
                if (lfo._isRunning) {
                    lfo.stop();
                } else {
                    lfo.start();
                }
                renderPanelContent();
            }
        });
    }
}

/**
 * Draw the LFO preview waveform
 */
function drawLFOPreview() {
    const canvas = document.getElementById('lfoPreviewCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const lfo = lfoInstances[activeLFOIndex];
    if (!lfo) return;

    const settings = lfo.getSettings();
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const amplitude = height / 2 - 10;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw waveform based on type
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const waveform = settings.waveform;
    const phase = settings.phase * Math.PI / 180;
    const depth = settings.depth;

    for (let x = 0; x < width; x++) {
        const t = (x / width) * 4 * Math.PI + phase; // 2 cycles
        let y;

        switch (waveform) {
            case 'sine':
                y = Math.sin(t);
                break;
            case 'triangle':
                y = Math.asin(Math.sin(t)) * (2 / Math.PI);
                break;
            case 'square':
                y = Math.sin(t) >= 0 ? 1 : -1;
                break;
            case 'sawtooth':
                y = 2 * ((t / (2 * Math.PI)) % 1) - 1;
                break;
            case 'sawtooth reverse':
                y = 1 - 2 * ((t / (2 * Math.PI)) % 1);
                break;
            default:
                y = Math.sin(t);
        }

        const yPos = centerY - y * amplitude * depth;
        if (x === 0) {
            ctx.moveTo(x, yPos);
        } else {
            ctx.lineTo(x, yPos);
        }
    }

    ctx.stroke();

    // Draw frequency text
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(`${settings.frequency?.toFixed(2) || 0} Hz`, 5, 15);
    ctx.fillText(`${settings.rateDivision}`, width - 30, 15);
}

/**
 * Handle parameter connection request from effect UI
 * Called when user clicks a modulation target in an effect
 */
export function requestLFOConnection(param, paramName) {
    if (activeLFOIndex < 0 || lfoInstances.length === 0) {
        localAppServices.showNotification?.('Create an LFO first in the Tempo Sync LFO panel', 2000);
        return;
    }
    
    const lfo = lfoInstances[activeLFOIndex];
    
    // Show connection dialog
    showConnectionDialog(lfo, param, paramName);
}

/**
 * Show connection intensity dialog
 */
function showConnectionDialog(lfo, param, paramName) {
    const container = document.createElement('div');
    container.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]';
    container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-80">
            <h3 class="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Connect LFO to ${paramName}</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-sm text-gray-600 dark:text-gray-400">Intensity: <span id="intensityValue">50%</span></label>
                    <input type="range" id="connectionIntensity" min="0" max="100" value="50" class="w-full">
                </div>
                <div class="flex gap-2">
                    <button id="confirmConnect" class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded text-white">Connect</button>
                    <button id="cancelConnect" class="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded text-white">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    const intensitySlider = container.querySelector('#connectionIntensity');
    const intensityValue = container.querySelector('#intensityValue');

    intensitySlider.addEventListener('input', (e) => {
        intensityValue.textContent = `${e.target.value}%`;
    });

    container.querySelector('#confirmConnect').addEventListener('click', () => {
        const intensity = parseInt(intensitySlider.value) / 100;
        lfo.connectToParam(param, intensity);
        localAppServices.showNotification?.(`LFO connected to ${paramName}`, 2000);
        document.body.removeChild(container);
        renderPanelContent();
    });

    container.querySelector('#cancelConnect').addEventListener('click', () => {
        document.body.removeChild(container);
    });
}

/**
 * Update tempo for all LFOs
 */
export function updateAllLFOsTempo(tempo) {
    lfoInstances.forEach(lfo => {
        lfo.setTempo(tempo);
    });
}

/**
 * Get the active LFO instance
 */
export function getActiveLFO() {
    return lfoInstances[activeLFOIndex] || null;
}

/**
 * Get all LFO instances
 */
export function getAllLFOs() {
    return lfoInstances;
}
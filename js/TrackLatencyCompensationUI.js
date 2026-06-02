// TrackLatencyCompensationUI.js - UI Panel for per-track latency compensation

let latencyCompensationModule = {};

export function initTrackLatencyCompensationUI(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    
    latencyCompensationModule = {
        openLatencyCompensationPanel: openLatencyCompensationPanel,
        getTrackLatencyInfo: getTrackLatencyInfo,
        setTrackDelayCompensation: setTrackDelayCompensation,
        setTrackAutoDelayCompensation: setTrackAutoDelayCompensation
    };
    
    // Wire up to appServices so ui.js can access via localAppServices.latencyCompensation
    localAppServices.latencyCompensation = latencyCompensationModule;
    console.log('[UI] Track Latency Compensation UI module initialized and wired to appServices');
    
    return latencyCompensationModule;
}

function getTrackLatencyInfo(trackId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (!track || typeof track.getDelayCompensationInfo !== 'function') {
        return { manual: 0, calculated: 0, auto: true, total: 0 };
    }
    return track.getDelayCompensationInfo();
}

function setTrackDelayCompensation(trackId, delayMs) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (track && typeof track.setDelayCompensation === 'function') {
        track.setDelayCompensation(delayMs);
        return true;
    }
    return false;
}

function setTrackAutoDelayCompensation(trackId, enabled) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (track && typeof track.setAutoDelayCompensation === 'function') {
        track.setAutoDelayCompensation(enabled);
        return true;
    }
    return false;
}

/**
 * Opens the Track Latency Compensation panel for viewing and adjusting per-track delay.
 */
export function openLatencyCompensationPanel(savedState = null) {
    const windowId = 'trackLatencyCompensation';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderLatencyCompensationContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'latencyCompensationContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-900 dark:bg-slate-900';

    const options = { width: 500, height: 550, minWidth: 400, minHeight: 400, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Track Latency Compensation', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderLatencyCompensationContent(), 50);
    }
    return win;
}

/**
 * Renders the latency compensation panel content.
 */
function renderLatencyCompensationContent() {
    const container = document.getElementById('latencyCompensationContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];

    // Build tracks list
    let tracksHtml = '';
    
    if (tracks.length === 0) {
        tracksHtml = '<div class="text-gray-500 text-sm text-center py-4">No tracks available</div>';
    } else {
        tracks.forEach(track => {
            const info = getTrackLatencyInfo(track.id);
            
            tracksHtml += `
                <div class="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700" data-track-id="${track.id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded" style="background-color: ${track.color || '#666'}"></div>
                            <span class="text-white font-medium text-sm">${track.name}</span>
                            <span class="text-xs text-gray-500">(${track.type})</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">Auto:</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" class="sr-only peer auto-delay-toggle" data-track-id="${track.id}" ${info.auto ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div class="text-center p-2 bg-slate-900 rounded">
                            <div class="text-gray-500 mb-1">Manual</div>
                            <div class="text-white font-mono">${info.manual.toFixed(1)} ms</div>
                        </div>
                        <div class="text-center p-2 bg-slate-900 rounded">
                            <div class="text-gray-500 mb-1">Effect-based</div>
                            <div class="text-green-400 font-mono">${info.calculated.toFixed(1)} ms</div>
                        </div>
                        <div class="text-center p-2 bg-purple-900/30 rounded border border-purple-500/30">
                            <div class="text-gray-500 mb-1">Total</div>
                            <div class="text-purple-400 font-mono font-bold">${info.total.toFixed(1)} ms</div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400 w-16">Offset:</span>
                        <input type="range" class="latency-slider flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                               data-track-id="${track.id}" 
                               min="0" max="200" 
                               value="${info.auto ? info.calculated : info.manual}" 
                               ${info.auto ? 'disabled' : ''}>
                        <span class="latency-value text-xs text-white font-mono w-16 text-right">${info.auto ? info.calculated.toFixed(1) : info.manual.toFixed(1)} ms</span>
                    </div>
                    ${info.auto ? '<div class="mt-2 text-xs text-gray-500 text-center">Manual offset disabled while Auto is on</div>' : ''}
                </div>
            `;
        });
    }

    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-white font-medium text-sm">Track Latency Compensation</h3>
            <div class="flex gap-2">
                <button id="resetAllLatencyBtn" class="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white">
                    Reset All
                </button>
                <button id="refreshLatencyBtn" class="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white">
                    ↻
                </button>
            </div>
        </div>
        
        <div class="text-xs text-gray-500 mb-3">
            Adjust per-track delay to compensate for plugin processing latency. Auto mode calculates latency from active effects.
        </div>
        
        <div id="latencyTracksList" class="space-y-2">
            ${tracksHtml}
        </div>
        
        <div class="mt-4 p-3 bg-slate-800 rounded border border-slate-700">
            <div class="text-xs text-gray-500 mb-2">Info</div>
            <ul class="text-xs text-gray-400 space-y-1">
                <li>• <span class="text-white">Manual</span>: Your custom delay offset</li>
                <li>• <span class="text-green-400">Effect-based</span>: Auto-calculated from effect types (PitchShift adds ~5.8ms)</li>
                <li>• <span class="text-purple-400">Total</span>: Active compensation value</li>
                <li>• Toggle <span class="text-purple-400">Auto</span> to use calculated or manual value</li>
            </ul>
        </div>
    `;

    // Attach event listeners
    container.querySelectorAll('.auto-delay-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const enabled = e.target.checked;
            setTrackAutoDelayCompensation(trackId, enabled);
            renderLatencyCompensationContent();
        });
    });

    container.querySelectorAll('.latency-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const value = parseFloat(e.target.value);
            const label = e.target.nextElementSibling;
            if (label) label.textContent = `${value.toFixed(1)} ms`;
        });
        
        slider.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId, 10);
            const value = parseFloat(e.target.value);
            setTrackDelayCompensation(trackId, value);
            renderLatencyCompensationContent();
        });
    });

    const resetAllBtn = container.querySelector('#resetAllLatencyBtn');
    resetAllBtn?.addEventListener('click', () => {
        tracks.forEach(track => {
            setTrackAutoDelayCompensation(track.id, true);
        });
        renderLatencyCompensationContent();
    });

    const refreshBtn = container.querySelector('#refreshLatencyBtn');
    refreshBtn?.addEventListener('click', () => {
        renderLatencyCompensationContent();
    });
}

/**
 * Updates the latency compensation panel with current data.
 */
export function updateLatencyCompensationPanel() {
    const container = document.getElementById('latencyCompensationContent');
    if (container) renderLatencyCompensationContent();
}
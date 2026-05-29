// js/TrackSnapResolutionPanel.js - Track Snap Resolution Panel
// Assign per-track snap resolution for grid sensitivity settings

let localAppServices = {};
let currentTrackId = null;

const SNAP_RESOLUTIONS = [
    { value: null, label: 'Global', description: 'Use application-wide snap resolution' },
    { value: 4, label: '1/4 Bar', description: 'Whole bar (4 beats)' },
    { value: 2, label: '1/2 Bar', description: 'Half bar (2 beats)' },
    { value: 1, label: '1/4 Note', description: 'Quarter note' },
    { value: 0.5, label: '1/8 Note', description: 'Eighth note' },
    { value: 0.25, label: '1/16 Note', description: 'Sixteenth note' },
    { value: 0.125, label: '1/32 Note', description: 'Thirty-second note' },
    { value: 0.0625, label: '1/64 Note', description: 'Sixty-fourth note' }
];

/**
 * Initialize the track snap resolution panel module
 * @param {object} services - App services
 */
export function initTrackSnapResolutionPanel(services) {
    localAppServices = services;
    console.log('[TrackSnapResolutionPanel] Initialized');
}

/**
 * Opens the Track Snap Resolution Panel for a specific track
 * @param {number} trackId - Track ID to assign snap resolution to
 */
export function openTrackSnapResolutionPanel(trackId) {
    currentTrackId = trackId;
    const windowId = 'trackSnapResolution';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackSnapResolutionContent(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackSnapResolutionContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    const options = { 
        width: 380, 
        height: 480, 
        minWidth: 300, 
        minHeight: 400,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Track Snap Settings', contentContainer, options);
    
    if (win?.element) {
        renderTrackSnapResolutionContent(trackId);
    }
    
    return win;
}

/**
 * Renders the track snap resolution panel content
 * @param {number} trackId - Track ID
 */
function renderTrackSnapResolutionContent(trackId) {
    const container = document.getElementById('trackSnapResolutionContent');
    if (!container) return;
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        container.innerHTML = '<div class="p-4 text-red-500">Track not found</div>';
        return;
    }
    
    const currentResolution = track.snapResolution; // null = global, number = beats
    const globalResolution = localAppServices.getSnapResolution ? localAppServices.getSnapResolution() : 0.25;
    
    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                    ⌗
                </div>
                <div>
                    <div class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(track.name || 'Unnamed Track')}</div>
                    <div class="text-xs text-gray-500">Current: <span class="font-mono">${currentResolution === null ? 'Global (' + formatResolution(globalResolution) + ')' : formatResolution(currentResolution)}</span></div>
                </div>
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Snap Resolution</div>
            <div class="flex flex-col gap-2">
    `;
    
    SNAP_RESOLUTIONS.forEach(res => {
        const isSelected = res.value === currentResolution;
        const displayValue = res.label;
        html += `
            <button class="snap-res-option w-full px-3 py-2 text-sm rounded text-left flex items-center gap-2 transition-colors ${
                isSelected 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-500'
            }" data-resolution="${res.value === null ? 'null' : res.value}">
                <span class="font-bold w-20">${displayValue}</span>
                <span class="text-xs opacity-75">${res.description}</span>
            </button>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-700">
            <div class="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>Tip:</strong> Per-track snap resolution overrides the global snap setting when set to a specific value.
                This allows different tracks to have different grid sensitivities.
            </div>
        </div>
        
        <div class="p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Actions</div>
            <div class="flex flex-wrap gap-2">
                <button id="useGlobalSnapBtn" class="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">
                    Use Global
                </button>
                <button id="resetSnapBtn" class="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">
                    Reset
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    wireTrackSnapResolutionEvents(trackId);
}

/**
 * Wire up event handlers for the track snap resolution panel
 */
function wireTrackSnapResolutionEvents(trackId) {
    const container = document.getElementById('trackSnapResolutionContent');
    if (!container) return;
    
    const showNotification = localAppServices.showNotification || ((msg, dur) => console.log(msg));
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    // Snap resolution option buttons
    container.querySelectorAll('.snap-res-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const resValue = btn.dataset.resolution;
            const resolution = resValue === 'null' ? null : parseFloat(resValue);
            track.setSnapResolution(resolution, true);
            showNotification(`Snap resolution: ${resolution === null ? 'Global' : formatResolution(resolution)}`, 1500);
            renderTrackSnapResolutionContent(trackId);
        });
    });
    
    // Use global button
    const useGlobalBtn = container.querySelector('#useGlobalSnapBtn');
    useGlobalBtn?.addEventListener('click', () => {
        track.setSnapResolution(null, true);
        showNotification('Using global snap resolution', 1500);
        renderTrackSnapResolutionContent(trackId);
    });
    
    // Reset button
    const resetBtn = container.querySelector('#resetSnapBtn');
    resetBtn?.addEventListener('click', () => {
        track.setSnapResolution(null, true);
        showNotification('Snap resolution reset to global', 1500);
        renderTrackSnapResolutionContent(trackId);
    });
}

/**
 * Format resolution value for display
 * @param {number} res - Resolution in beats
 * @returns {string} Human-readable label
 */
function formatResolution(res) {
    if (res === null || res === undefined) return 'Global';
    if (res >= 4) return '1/4 Bar';
    if (res >= 2) return '1/2 Bar';
    if (res >= 1) return 'Quarter';
    if (res >= 0.5) return '8th';
    if (res >= 0.25) return '16th';
    if (res >= 0.125) return '32nd';
    return '64th+';
}

/**
 * Escape HTML for safe display
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

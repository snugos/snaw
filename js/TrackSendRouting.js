// js/TrackSendRouting.js - Track Send Routing UI
// Feature: Visual send pre/post fader with wet/dry amount to buses

let localAppServices = {};
let sendRoutingWindow = null;

const AVAILABLE_BUSES = ['reverb', 'delay', 'chorus', 'flanger'];

/**
 * Initialize the Track Send Routing module
 * @param {object} services - App services
 */
export function initTrackSendRouting(services) {
    localAppServices = services;
    console.log('[TrackSendRouting] Initialized');
    
    // Register keyboard shortcut
    if (localAppServices.registerKeyBinding) {
        localAppServices.registerKeyBinding('Alt+S', toggleSendRoutingPanel, 'Track Send Routing');
    }
}

/**
 * Toggle the send routing panel visibility
 */
export function toggleSendRoutingPanel() {
    if (sendRoutingWindow && sendRoutingWindow.element && !sendRoutingWindow.isMinimized) {
        sendRoutingWindow.close();
        sendRoutingWindow = null;
        return;
    }
    openTrackSendRoutingPanel();
}

/**
 * Open the Track Send Routing panel
 * @param {number} trackId - Optional track ID to focus on
 */
export function openTrackSendRoutingPanel(trackId = null) {
    const windowId = 'trackSendRouting';
    
    // Check if window already exists
    const existingWin = localAppServices.getWindowByIdState?.(windowId);
    if (existingWin) {
        existingWin.restore();
        return existingWin;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackSendRoutingContent';
    contentContainer.className = 'flex flex-col h-full bg-gray-900 text-white p-3';
    
    const options = {
        width: 500,
        height: 450,
        minWidth: 400,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow?.(windowId, 'Track Send Routing', contentContainer, options);
    if (win?.element) {
        sendRoutingWindow = win;
        setTimeout(() => renderSendRoutingContent(trackId), 50);
    }
    
    return win;
}

/**
 * Render the send routing panel content
 * @param {number} initialTrackId - Optional initial track to select
 */
function renderSendRoutingContent(initialTrackId = null) {
    const container = document.getElementById('trackSendRoutingContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    const buses = AVAILABLE_BUSES;
    
    // Get selected track or use initial
    let selectedTrackId = initialTrackId;
    if (!selectedTrackId && tracks.length > 0) {
        selectedTrackId = tracks[0].id;
    }
    
    let html = `
        <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-300">Track Send Routing</h3>
            <select id="trackSelect" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs">
                ${tracks.map(t => `<option value="${t.id}" ${t.id === selectedTrackId ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select>
        </div>
        
        <div class="flex-1 overflow-y-auto">
    `;
    
    // Header row for buses
    html += `
        <div class="flex items-center mb-2 text-xs text-gray-400 border-b border-gray-700 pb-1">
            <div class="w-24 flex-shrink-0">Track</div>
            ${buses.map(b => `<div class="flex-1 text-center">${b.toUpperCase()}</div>`).join('')}
        </div>
    `;
    
    // Track rows
    for (const track of tracks) {
        const sendLevels = track.sendLevels || {};
        
        html += `
            <div class="flex items-center mb-2 p-2 bg-gray-800 rounded ${track.id === selectedTrackId ? 'border border-blue-500' : 'border border-gray-700'}" data-track-id="${track.id}">
                <div class="w-24 flex-shrink-0 text-xs text-gray-300 truncate" title="${track.name}">${track.name}</div>
                ${buses.map(bus => {
                    const level = sendLevels[bus] || 0;
                    return `
                        <div class="flex-1 flex items-center justify-center gap-1">
                            <input type="range" 
                                   min="0" max="100" 
                                   value="${Math.round(level * 100)}"
                                   class="w-16 h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                                   data-track-id="${track.id}"
                                   data-bus="${bus}"
                                   onchange="window.handleSendLevelChange(this)"
                            />
                            <span class="text-xs text-gray-400 w-6">${Math.round(level * 100)}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    html += `
        </div>
        
        <div class="mt-3 pt-2 border-t border-gray-700">
            <div class="flex items-center justify-between text-xs">
                <span class="text-gray-400">Pre/Post Fader</span>
                <div class="flex gap-2">
                    <button id="preFaderBtn" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">Pre</button>
                    <button id="postFaderBtn" class="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs">Post</button>
                </div>
            </div>
            <div class="flex items-center justify-between mt-2 text-xs">
                <span class="text-gray-400">Wet/Dry Mix</span>
                <input type="range" id="wetDrySlider" min="0" max="100" value="50" class="w-24 h-1 bg-gray-600 rounded appearance-none cursor-pointer" />
                <span class="text-xs text-gray-400 w-6">50%</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Setup event handlers
    const trackSelect = document.getElementById('trackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            renderSendRoutingContent(parseInt(e.target.value));
        });
    }
    
    const preBtn = document.getElementById('preFaderBtn');
    const postBtn = document.getElementById('postFaderBtn');
    if (preBtn) {
        preBtn.addEventListener('click', () => {
            preBtn.classList.add('bg-blue-600');
            preBtn.classList.remove('bg-gray-600');
            postBtn.classList.remove('bg-blue-600');
            postBtn.classList.add('bg-gray-600');
            showNotification?.('Send mode: Pre-fader');
        });
    }
    if (postBtn) {
        postBtn.addEventListener('click', () => {
            postBtn.classList.add('bg-blue-600');
            postBtn.classList.remove('bg-gray-600');
            preBtn.classList.remove('bg-blue-600');
            preBtn.classList.add('bg-gray-600');
            showNotification?.('Send mode: Post-fader');
        });
    }
    
    // Setup global handler for send level changes
    window.handleSendLevelChange = (input) => {
        const trackId = parseInt(input.dataset.trackId);
        const bus = input.dataset.bus;
        const level = input.value / 100;
        
        const tracks = localAppServices.getTracks?.() || [];
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setSendLevel) {
            track.setSendLevel(bus, level, true);
        }
        
        // Update the level display
        const levelDisplay = input.parentElement.querySelector('span');
        if (levelDisplay) {
            levelDisplay.textContent = `${Math.round(level * 100)}%`;
        }
    };
}

/**
 * Get send level for a track and bus
 * @param {number} trackId - Track ID
 * @param {string} busId - Bus ID
 * @returns {number} Send level (0-1)
 */
export function getTrackSendLevel(trackId, busId) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return 0;
    return track.getSendLevel?.(busId) || 0;
}

/**
 * Set send level for a track and bus
 * @param {number} trackId - Track ID
 * @param {string} busId - Bus ID
 * @param {number} level - Send level (0-1)
 */
export function setTrackSendLevelById(trackId, busId, level) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    if (track.setSendLevel) {
        track.setSendLevel(busId, level, true);
    }
}

/**
 * Get available send buses
 * @returns {string[]} Array of bus IDs
 */
export function getAvailableBuses() {
    return [...AVAILABLE_BUSES];
}

console.log('[TrackSendRouting] Module loaded');
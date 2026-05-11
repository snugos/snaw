// js/LoopRegionSnap.js - Loop Region Snapping to Clip Boundaries
// Feature: Add snap options for loop region to clip boundaries

let localAppServices = {};
let isLoopSnapEnabled = false;
let snapToClipEdges = true;
let snapToClipCenters = false;

/**
 * Initialize the Loop Region Snap module
 * @param {Object} services - App services
 */
export function initLoopRegionSnap(services) {
    localAppServices = services || {};
    console.log('[LoopRegionSnap] Initialized');
}

/**
 * Check if loop snap is enabled
 * @returns {boolean}
 */
export function isLoopSnapEnabled() {
    return isLoopSnapEnabled;
}

/**
 * Toggle loop snap enabled state
 */
export function toggleLoopSnap() {
    isLoopSnapEnabled = !isLoopSnapEnabled;
    localAppServices.showNotification?.(
        isLoopSnapEnabled ? 'Loop Snap: On' : 'Loop Snap: Off', 
        1500
    );
    return isLoopSnapEnabled;
}

/**
 * Set loop snap enabled state
 * @param {boolean} enabled 
 */
export function setLoopSnapEnabled(enabled) {
    isLoopSnapEnabled = !!enabled;
}

/**
 * Check if snapping to clip edges is enabled
 * @returns {boolean}
 */
export function isSnapToClipEdges() {
    return snapToClipEdges;
}

/**
 * Set snap to clip edges
 * @param {boolean} enabled 
 */
export function setSnapToClipEdges(enabled) {
    snapToClipEdges = !!enabled;
}

/**
 * Check if snapping to clip centers is enabled
 * @returns {boolean}
 */
export function isSnapToClipCenters() {
    return snapToClipCenters;
}

/**
 * Set snap to clip centers
 * @param {boolean} enabled 
 */
export function setSnapToClipCenters(enabled) {
    snapToClipCenters = !!enabled;
}

/**
 * Get all snap points (edges and optionally centers of clips)
 * @returns {Array} Array of snap point times in seconds
 */
export function getSnapPoints() {
    const snapPoints = [];
    const tracks = localAppServices.getTracks?.() || [];
    
    tracks.forEach(track => {
        if (!track.timelineClips) return;
        
        track.timelineClips.forEach(clip => {
            const start = clip.startTime || 0;
            const duration = clip.duration || 0;
            const end = start + duration;
            
            // Add edge snap points
            if (snapToClipEdges) {
                snapPoints.push({ time: start, type: 'edge', clipId: clip.id });
                snapPoints.push({ time: end, type: 'edge', clipId: clip.id });
            }
            
            // Add center snap points
            if (snapToClipCenters && duration > 0) {
                const center = start + duration / 2;
                snapPoints.push({ time: center, type: 'center', clipId: clip.id });
            }
        });
    });
    
    return snapPoints.sort((a, b) => a.time - b.time);
}

/**
 * Snap a value to the nearest snap point
 * @param {number} time - Time to snap in seconds
 * @param {number} threshold - Maximum snap distance in seconds (default 0.5s)
 * @returns {number} Snapped time
 */
export function snapToNearestPoint(time, threshold = 0.5) {
    if (!isLoopSnapEnabled) return time;
    
    const snapPoints = getSnapPoints();
    let nearestPoint = null;
    let nearestDistance = threshold;
    
    for (const point of snapPoints) {
        const distance = Math.abs(point.time - time);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPoint = point;
        }
    }
    
    if (nearestPoint) {
        localAppServices.showNotification?.(
            `Snapped to ${nearestPoint.type}: ${nearestPoint.time.toFixed(2)}s`,
            1000
        );
        return nearestPoint.time;
    }
    
    return time;
}

/**
 * Snap loop region start to nearest clip boundary
 * @param {number} startTime - Proposed start time
 * @returns {number} Snapped start time
 */
export function snapLoopStart(startTime) {
    return snapToNearestPoint(startTime, 0.5);
}

/**
 * Snap loop region end to nearest clip boundary
 * @param {number} endTime - Proposed end time
 * @returns {number} Snapped end time
 */
export function snapLoopEnd(endTime) {
    return snapToNearestPoint(endTime, 0.5);
}

/**
 * Get snap status info
 * @returns {Object} Current snap configuration
 */
export function getSnapConfig() {
    return {
        enabled: isLoopSnapEnabled,
        snapToEdges: snapToClipEdges,
        snapToCenters: snapToClipCenters,
        snapPointCount: getSnapPoints().length
    };
}

/**
 * Open loop region snap settings panel
 */
export function openLoopSnapPanel() {
    const existingPanel = document.getElementById('loopSnapPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'loopSnapPanel';
    panel.className = 'fixed bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg shadow-2xl z-[9999]';
    panel.style.cssText = 'width:280px;left:50%;top:50%;transform:translate(-50%,-50%);';

    panel.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-[#3a3a3a] cursor-move" data-drag-handle>
            <span class="text-sm font-semibold text-[#e0e0e0]">📍 Loop Region Snap</span>
            <button id="loopSnapClose" class="w-5 h-5 flex items-center justify-center text-[#888] hover:text-[#fff] text-lg">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <!-- Enable Toggle -->
            <div class="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                <span class="text-sm text-[#ccc]">Enable Loop Snap</span>
                <button id="loopSnapToggleBtn" class="w-12 h-6 rounded-full transition-colors ${isLoopSnapEnabled ? 'bg-[#ff7700]' : 'bg-[#444]'} relative">
                    <span class="absolute top-1 ${isLoopSnapEnabled ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>
                </button>
            </div>
            
            <!-- Snap to Edges -->
            <div class="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                <span class="text-sm text-[#ccc]">Snap to Clip Edges</span>
                <button id="snapEdgesToggle" class="w-12 h-6 rounded-full transition-colors ${snapToClipEdges ? 'bg-[#4a9eff]' : 'bg-[#444]'} relative">
                    <span class="absolute top-1 ${snapToClipEdges ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>
                </button>
            </div>
            
            <!-- Snap to Centers -->
            <div class="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                <span class="text-sm text-[#ccc]">Snap to Clip Centers</span>
                <button id="snapCentersToggle" class="w-12 h-6 rounded-full transition-colors ${snapToClipCenters ? 'bg-[#4a9eff]' : 'bg-[#444]'} relative">
                    <span class="absolute top-1 ${snapToClipCenters ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>
                </button>
            </div>
            
            <!-- Snap Points Count -->
            <div class="text-center p-3 bg-[#1a1a1a] rounded">
                <div class="text-xs text-[#888]">Available Snap Points</div>
                <div id="snapPointCount" class="text-xl font-bold text-[#4a9eff]">${getSnapPoints().length}</div>
            </div>
            
            <!-- Info -->
            <div class="text-xs text-[#666] text-center">
                Loop region will snap to clip boundaries within 0.5s
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Close button
    document.getElementById('loopSnapClose').addEventListener('click', () => {
        panel.remove();
    });

    // Enable toggle
    document.getElementById('loopSnapToggleBtn').addEventListener('click', () => {
        toggleLoopSnap();
        updatePanelUI();
    });

    // Edges toggle
    document.getElementById('snapEdgesToggle').addEventListener('click', () => {
        setSnapToClipEdges(!snapToClipEdges);
        updatePanelUI();
    });

    // Centers toggle
    document.getElementById('snapCentersToggle').addEventListener('click', () => {
        setSnapToClipCenters(!snapToClipCenters);
        updatePanelUI();
    });

    // Make panel draggable
    makeDraggable(panel);
}

/**
 * Update panel UI to reflect current state
 */
function updatePanelUI() {
    const snapToggleBtn = document.getElementById('loopSnapToggleBtn');
    if (snapToggleBtn) {
        snapToggleBtn.className = `w-12 h-6 rounded-full transition-colors ${isLoopSnapEnabled ? 'bg-[#ff7700]' : 'bg-[#444]'} relative`;
        snapToggleBtn.querySelector('span').className = `absolute top-1 ${isLoopSnapEnabled ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all`;
    }

    const edgesToggle = document.getElementById('snapEdgesToggle');
    if (edgesToggle) {
        edgesToggle.className = `w-12 h-6 rounded-full transition-colors ${snapToClipEdges ? 'bg-[#4a9eff]' : 'bg-[#444]'} relative`;
        edgesToggle.querySelector('span').className = `absolute top-1 ${snapToClipEdges ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all`;
    }

    const centersToggle = document.getElementById('snapCentersToggle');
    if (centersToggle) {
        centersToggle.className = `w-12 h-6 rounded-full transition-colors ${snapToClipCenters ? 'bg-[#4a9eff]' : 'bg-[#444]'} relative`;
        centersToggle.querySelector('span').className = `absolute top-1 ${snapToClipCenters ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all`;
    }

    const snapPointCount = document.getElementById('snapPointCount');
    if (snapPointCount) {
        snapPointCount.textContent = getSnapPoints().length;
    }
}

/**
 * Make element draggable
 * @param {HTMLElement} element 
 */
function makeDraggable(element) {
    const dragHandle = element.querySelector('[data-drag-handle]');
    if (!dragHandle) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = `${startLeft + dx}px`;
        element.style.top = `${startTop + dy}px`;
        element.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

console.log('[LoopRegionSnap] Module loaded');
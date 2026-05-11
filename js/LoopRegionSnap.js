// js/LoopRegionSnap.js - Loop Region Snap to Clip Boundaries
// Snap loop region start/end to nearest clip boundaries for precise editing

let localAppServices = {};
let isSnapEnabled = true;
let snapThreshold = 0.5; // seconds - distance within which to snap

/**
 * Initialize the Loop Region Snap module
 * @param {Object} appServices - Application services from main.js
 */
export function initLoopRegionSnap(appServices) {
    localAppServices = appServices || {};
    console.log('[LoopRegionSnap] Initialized');
}

/**
 * Enable/disable snap functionality
 * @param {boolean} enabled
 */
export function setLoopRegionSnapEnabled(enabled) {
    isSnapEnabled = !!enabled;
    console.log(`[LoopRegionSnap] Snap ${isSnapEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if snap is enabled
 * @returns {boolean}
 */
export function isLoopRegionSnapEnabled() {
    return isSnapEnabled;
}

/**
 * Toggle snap enabled/disabled
 * @returns {boolean} New enabled state
 */
export function toggleLoopSnap() {
    isSnapEnabled = !isSnapEnabled;
    console.log(`[LoopRegionSnap] Snap ${isSnapEnabled ? 'enabled' : 'disabled'}`);
    return isSnapEnabled;
}

/**
 * Get all clip boundaries across all tracks
 * @returns {Array} Array of {time, type: 'start'|'end', trackId, clipId}
 */
function getAllClipBoundaries() {
    const boundaries = [];
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    tracks.forEach(track => {
        if (!track.timelineClips) return;
        track.timelineClips.forEach(clip => {
            if (clip.start !== undefined) {
                boundaries.push({
                    time: clip.start,
                    type: 'start',
                    trackId: track.id,
                    clipId: clip.id
                });
            }
            if (clip.start !== undefined && clip.duration !== undefined) {
                boundaries.push({
                    time: clip.start + clip.duration,
                    type: 'end',
                    trackId: track.id,
                    clipId: clip.id
                });
            }
        });
    });
    
    return boundaries.sort((a, b) => a.time - b.time);
}

/**
 * Find nearest clip boundary within threshold
 * @param {number} time - Time to snap from
 * @param {number} threshold - Max distance to snap
 * @returns {number|null} Snapped time or null if no snap
 */
function findNearestBoundary(time, threshold = snapThreshold) {
    const boundaries = getAllClipBoundaries();
    
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const boundary of boundaries) {
        const dist = Math.abs(boundary.time - time);
        if (dist < threshold && dist < nearestDist) {
            nearest = boundary;
            nearestDist = dist;
        }
    }
    
    return nearest ? nearest.time : null;
}

/**
 * Snap loop region start to nearest clip boundary
 * @param {number} proposedStart - Proposed start time
 * @returns {number} Snapped start time
 */
export function snapLoopRegionStart(proposedStart) {
    if (!isSnapEnabled) return proposedStart;
    
    const snapped = findNearestBoundary(proposedStart, snapThreshold);
    if (snapped !== null) {
        console.log(`[LoopRegionSnap] Loop start snapped: ${proposedStart.toFixed(2)}s → ${snapped.toFixed(2)}s`);
        return snapped;
    }
    return proposedStart;
}

/**
 * Snap loop region end to nearest clip boundary
 * @param {number} proposedEnd - Proposed end time
 * @returns {number} Snapped end time
 */
export function snapLoopRegionEnd(proposedEnd) {
    if (!isSnapEnabled) return proposedEnd;
    
    const snapped = findNearestBoundary(proposedEnd, snapThreshold);
    if (snapped !== null) {
        console.log(`[LoopRegionSnap] Loop end snapped: ${proposedEnd.toFixed(2)}s → ${snapped.toFixed(2)}s`);
        return snapped;
    }
    return proposedEnd;
}

/**
 * Snap both loop region start and end
 * @param {number} start - Proposed start time
 * @param {number} end - Proposed end time  
 * @returns {{start: number, end: number}} Snapped values
 */
export function snapLoopRegion(start, end) {
    return {
        start: snapLoopRegionStart(start),
        end: snapLoopRegionEnd(end)
    };
}

/**
 * Get snap settings for UI
 * @returns {Object} Current snap settings
 */
export function getLoopRegionSnapSettings() {
    return {
        enabled: isSnapEnabled,
        threshold: snapThreshold
    };
}

/**
 * Set snap threshold
 * @param {number} threshold - New threshold in seconds
 */
export function setSnapThreshold(threshold) {
    snapThreshold = Math.max(0.1, Math.min(10, threshold));
    console.log(`[LoopRegionSnap] Threshold set to ${snapThreshold}s`);
}

/**
 * Open Loop Region Snap settings panel
 */
export function openLoopRegionSnapSettings() {
    const windowId = 'loopRegionSnapSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'loopRegionSnapContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-100 dark:bg-slate-800';
    
    const settings = getLoopRegionSnapSettings();
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">Loop Region Snap</h3>
            <p class="text-sm text-gray-600 dark:text-slate-400">Snap loop region boundaries to clip edges for precise editing.</p>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="loopSnapEnabled" ${settings.enabled ? 'checked' : ''} 
                    class="w-5 h-5 rounded accent-blue-500">
                <span class="text-gray-800 dark:text-white font-medium">Enable Snap to Clip Boundaries</span>
            </label>
        </div>
        
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600">
            <label class="block text-sm text-gray-700 dark:text-slate-300 mb-2">
                Snap Threshold: <span id="snapThresholdValue">${settings.threshold}</span>s
            </label>
            <input type="range" id="snapThresholdSlider" 
                min="0.1" max="5" step="0.1" 
                value="${settings.threshold}"
                class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded appearance-none cursor-pointer">
            <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1s</span>
                <span>5s</span>
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
            <div class="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">How it works:</div>
            <ul class="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• When setting loop region start/end, snaps to nearest clip boundary within threshold</li>
                <li>• Works with drag handles, input fields, and quick-set operations</li>
                <li>• Hold <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-slate-600 rounded">Alt</kbd> while dragging to temporarily disable snap</li>
            </ul>
        </div>
        
        <div class="flex-1"></div>
        
        <div class="text-xs text-gray-500 border-t border-gray-300 dark:border-slate-600 pt-3">
            <div class="font-medium mb-1">Current clip boundaries: ${getAllClipBoundaries().length}</div>
            <div class="text-gray-400">Found across all tracks</div>
        </div>
    `;
    
    const options = {
        width: 380,
        height: 420,
        minWidth: 320,
        minHeight: 380,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Loop Region Snap', contentContainer, options) : null;
    
    // Add event listeners
    setTimeout(() => {
        const enabledCb = document.getElementById('loopSnapEnabled');
        const thresholdSlider = document.getElementById('snapThresholdSlider');
        const thresholdValue = document.getElementById('snapThresholdValue');
        
        enabledCb?.addEventListener('change', (e) => {
            setLoopRegionSnapEnabled(e.target.checked);
            localAppServices.showNotification?.(`Loop Region Snap ${e.target.checked ? 'enabled' : 'disabled'}`, 1500);
        });
        
        thresholdSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            thresholdValue.textContent = val.toFixed(1);
            setSnapThreshold(val);
        });
    }, 50);
    
    return win;
}

// Alias for main.js compatibility
export const openLoopSnapPanel = openLoopRegionSnapSettings;

// Get snap config alias
export function getSnapConfig() {
    return getLoopRegionSnapSettings();
}

// Expose functions globally for integration
window.loopRegionSnap = {
    snapLoopRegionStart,
    snapLoopRegionEnd,
    snapLoopRegion,
    setEnabled: setLoopRegionSnapEnabled,
    isEnabled: isLoopRegionSnapEnabled,
    getSettings: getLoopRegionSnapSettings
};
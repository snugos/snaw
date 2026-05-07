/**
 * js/AudioClipStretchMarkers.js - Visual markers for time-stretched audio clips
 * 
 * Shows markers on audio clips indicating where time-stretching was applied,
 * helping users see which parts of the audio were modified by the stretch algorithm.
 */

let localAppServices = {};
let stretchMarkersEnabled = true;

// Marker cache: clipId -> array of {position: 0-1 normalized, type: ' transient'|'grain'|'loop'|'crossfade'}
const markerCache = new Map();

/**
 * Initialize the stretch markers module
 * @param {Object} appServices - Application services from main.js
 */
export function initAudioClipStretchMarkers(appServices) {
    localAppServices = appServices || {};
    console.log('[AudioClipStretchMarkers] Module initialized');
}

/**
 * Check if stretch markers are enabled
 * @returns {boolean}
 */
export function isStretchMarkersEnabled() {
    return stretchMarkersEnabled;
}

/**
 * Enable or disable stretch markers
 * @param {boolean} enabled
 */
export function setStretchMarkersEnabled(enabled) {
    stretchMarkersEnabled = !!enabled;
}

/**
 * Generate stretch markers for a clip based on its stretch properties
 * @param {Object} clip - The audio clip
 * @returns {Array} Array of marker objects {position, type, intensity}
 */
export function generateStretchMarkers(clip) {
    if (!clip) return [];
    
    const markers = [];
    const stretchFactor = clip.stretchFactor || 1.0;
    
    // No markers needed if not stretched
    if (Math.abs(stretchFactor - 1.0) < 0.01) {
        return [];
    }
    
    const algorithm = clip.stretchAlgorithm || 'wsola';
    const duration = clip.duration || 1.0;
    const originalDuration = clip.originalDuration || duration;
    
    // Calculate number of markers based on stretch amount
    const stretchRatio = stretchFactor;
    const markerCount = Math.min(20, Math.max(3, Math.floor(stretchRatio * 5)));
    
    if (algorithm === 'granular') {
        // Granular: markers at grain boundaries
        for (let i = 1; i < markerCount; i++) {
            const position = i / markerCount;
            // Add slight random jitter for granular look
            const jitter = (Math.random() - 0.5) * 0.02;
            markers.push({
                position: Math.max(0, Math.min(1, position + jitter)),
                type: 'grain',
                intensity: 0.3 + Math.random() * 0.4
            });
        }
    } else if (algorithm === 'phasevocoder') {
        // Phasevocoder: markers at window boundaries (more regular)
        const windowSize = clip.windowSize || 2048;
        const hopSize = windowSize / 4;
        const samplesPerMarker = (originalDuration * 44100) / markerCount;
        const markersPerWindow = Math.max(1, Math.floor(samplesPerMarker / (windowSize - hopSize)));
        
        for (let i = 1; i < markerCount; i++) {
            const position = i / markerCount;
            markers.push({
                position,
                type: 'window',
                intensity: 0.5 + Math.random() * 0.3
            });
        }
    } else {
        // WSOLA or default: markers at splice points
        const splicePoints = Math.floor(stretchRatio * 3);
        for (let i = 1; i <= splicePoints; i++) {
            const position = i / (splicePoints + 1);
            markers.push({
                position,
                type: 'splice',
                intensity: 0.6
            });
        }
        
        // Add loop region markers if looped
        if (clip.loopCount > 1) {
            for (let loop = 1; loop < clip.loopCount; loop++) {
                const position = loop / clip.loopCount;
                markers.push({
                    position,
                    type: 'loop',
                    intensity: 0.8
                });
            }
        }
    }
    
    // Add transient markers at beat-aligned positions
    if (clip.beatMarkers && clip.beatMarkers.length > 0) {
        clip.beatMarkers.forEach(beat => {
            if (beat.position >= 0 && beat.position <= 1) {
                markers.push({
                    position: beat.position,
                    type: 'transient',
                    intensity: 0.9
                });
            }
        });
    }
    
    return markers;
}

/**
 * Get or create stretch markers for a clip
 * @param {Object} clip - The audio clip
 * @returns {Array} Array of marker objects
 */
export function getStretchMarkers(clip) {
    if (!clip?.id) return [];
    
    if (!markerCache.has(clip.id)) {
        markerCache.set(clip.id, generateStretchMarkers(clip));
    }
    
    return markerCache.get(clip.id);
}

/**
 * Clear marker cache for a specific clip or all clips
 * @param {string} clipId - Optional clip ID to clear
 */
export function clearStretchMarkerCache(clipId = null) {
    if (clipId) {
        markerCache.delete(clipId);
    } else {
        markerCache.clear();
    }
}

/**
 * Draw stretch markers on a clip rectangle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} clip - The audio clip
 * @param {number} x - Clip X position on canvas
 * @param {number} y - Clip Y position on canvas
 * @param {number} width - Clip width on canvas
 * @param {number} height - Clip height on canvas
 * @param {boolean} isSelected - Whether clip is selected
 */
export function drawStretchMarkers(ctx, clip, x, y, width, height, isSelected = false) {
    if (!stretchMarkersEnabled || !clip) return;
    
    const markers = getStretchMarkers(clip);
    if (markers.length === 0) return;
    
    const stretchFactor = clip.stretchFactor || 1.0;
    
    // Draw stretch indicator badge if significantly stretched
    if (Math.abs(stretchFactor - 1.0) > 0.05) {
        const badgeWidth = 24;
        const badgeHeight = 12;
        const badgeX = x + width - badgeWidth - 2;
        const badgeY = y + 2;
        
        // Badge background
        ctx.fillStyle = isSelected ? '#fbbf24' : '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 2);
        ctx.fill();
        
        // Badge text
        ctx.fillStyle = '#000';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${stretchFactor.toFixed(1)}x`, badgeX + badgeWidth / 2, badgeY + 9);
    }
    
    // Draw individual stretch markers along the clip top edge
    const markerY = y + height - 3; // Near bottom of clip
    
    markers.forEach(marker => {
        const markerX = x + marker.position * width;
        
        if (marker.type === 'grain') {
            // Small diamond for granular
            ctx.fillStyle = `rgba(168, 85, 247, ${marker.intensity})`;
            ctx.beginPath();
            ctx.moveTo(markerX, markerY - 4);
            ctx.lineTo(markerX + 3, markerY);
            ctx.lineTo(markerX, markerY + 4);
            ctx.lineTo(markerX - 3, markerY);
            ctx.closePath();
            ctx.fill();
        } else if (marker.type === 'window') {
            // Vertical line for phasevocoder windows
            ctx.strokeStyle = `rgba(59, 130, 246, ${marker.intensity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(markerX, y + 2);
            ctx.lineTo(markerX, y + height - 2);
            ctx.stroke();
        } else if (marker.type === 'splice') {
            // Triangle for splice points
            ctx.fillStyle = `rgba(239, 68, 68, ${marker.intensity})`;
            ctx.beginPath();
            ctx.moveTo(markerX, y + 2);
            ctx.lineTo(markerX + 4, y + 8);
            ctx.lineTo(markerX - 4, y + 8);
            ctx.closePath();
            ctx.fill();
        } else if (marker.type === 'loop') {
            // Circle for loop boundaries
            ctx.fillStyle = `rgba(16, 185, 129, ${marker.intensity})`;
            ctx.beginPath();
            ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (marker.type === 'transient') {
            // Star/diamond for transients
            ctx.fillStyle = `rgba(250, 204, 21, ${marker.intensity})`;
            ctx.beginPath();
            ctx.moveTo(markerX, y + 2);
            ctx.lineTo(markerX + 3, y + 6);
            ctx.lineTo(markerX, y + height - 2);
            ctx.lineTo(markerX - 3, y + 6);
            ctx.closePath();
            ctx.fill();
        }
    });
}

/**
 * Get tooltip text for stretch markers on a clip
 * @param {Object} clip - The audio clip
 * @returns {string} Tooltip text
 */
export function getStretchMarkerTooltip(clip) {
    if (!clip) return '';
    
    const stretchFactor = clip.stretchFactor || 1.0;
    const algorithm = clip.stretchAlgorithm || 'wsola';
    const markers = getStretchMarkers(clip);
    
    if (Math.abs(stretchFactor - 1.0) < 0.01) {
        return 'Audio not stretched';
    }
    
    return `Time-stretched: ${stretchFactor.toFixed(2)}x\nAlgorithm: ${algorithm}\nMarkers: ${markers.length}`;
}

/**
 * Open stretch markers info panel
 */
export function openStretchMarkersPanel() {
    const windowId = 'stretchMarkersPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const content = document.createElement('div');
    content.id = 'stretchMarkersContent';
    content.className = 'p-4 bg-gray-900 text-gray-100';
    content.style.minWidth = '350px';
    content.style.maxWidth = '450px';
    
    content.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-2">Audio Clip Stretch Markers</h3>
            <p class="text-sm text-gray-400">Visual indicators showing where audio time-stretching was applied.</p>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="stretchMarkersEnabled" ${stretchMarkersEnabled ? 'checked' : ''} 
                       class="w-4 h-4 rounded accent-blue-500">
                <span class="text-sm">Show stretch markers on clips</span>
            </label>
        </div>
        
        <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">Marker Types</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                    <div class="w-4 h-4 bg-purple-500 rounded-sm"></div>
                    <span>Grain boundaries</span>
                </div>
                <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                    <div class="w-4 h-4 bg-blue-500 rounded-sm"></div>
                    <span>Window boundaries</span>
                </div>
                <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                    <div class="w-4 h-4 bg-red-500 rounded-sm"></div>
                    <span>Splice points</span>
                </div>
                <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                    <div class="w-4 h-4 bg-green-500 rounded-sm"></div>
                    <span>Loop boundaries</span>
                </div>
                <div class="flex items-center gap-2 p-2 bg-gray-800 rounded col-span-2">
                    <div class="w-4 h-4 bg-yellow-500 rounded-sm"></div>
                    <span>Transient markers</span>
                </div>
            </div>
        </div>
        
        <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">Stretch Badge</h4>
            <p class="text-xs text-gray-400">A badge showing the stretch ratio (e.g., "1.5x") appears on clips that are time-stretched by more than 5%.</p>
        </div>
        
        <div class="flex justify-end">
            <button id="stretchMarkersClose" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Close</button>
        </div>
    `;
    
    const options = {
        width: 400,
        height: 420,
        minWidth: 350,
        minHeight: 300,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Stretch Markers', content, options);
    
    // Add event listeners
    const enabledCheckbox = content.querySelector('#stretchMarkersEnabled');
    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            setStretchMarkersEnabled(e.target.checked);
            // Trigger redraw of timeline/clips
            if (localAppServices.renderTimeline) {
                localAppServices.renderTimeline();
            }
        });
    }
    
    const closeBtn = content.querySelector('#stretchMarkersClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (win?.close) win.close();
        });
    }
    
    return win;
}
/**
 * js/MetronomeVisual.js - Enhanced Visual Beat Indicator
 * Provides a visible beat indicator that flashes on the transport bar
 * Features:
 * - Large beat dot in transport bar that flashes on each beat
 * - Special flash on downbeat (beat 1)
 * - Visual pulse animation synced to transport position
 */

let beatDotEl = null;
let animationFrameId = null;
let isActive = false;
let lastBeatIndex = -1;
let currentBeatCount = 0;
let transportStarted = false;

// Beat colors
const DOWNBEAT_COLOR = '#ff4444';
const REGULAR_BEAT_COLOR = '#ff7700';
const INACTIVE_COLOR = '#333333';

/**
 * Initialize the beat indicator element in the transport bar
 * @param {Object} appServices - Application services
 */
export function initMetronomeVisual(appServices) {
    // Find the transport bar and metronome button
    const transportBar = document.getElementById('globalControlsBar');
    const metronomeBtn = document.getElementById('metronomeToggleBtnGlobal');
    
    if (!transportBar) {
        console.warn('[MetronomeVisual] Transport bar not found');
        return;
    }
    
    // Create the beat indicator dot
    beatDotEl = document.createElement('div');
    beatDotEl.id = 'beatIndicatorDot';
    beatDotEl.title = 'Beat Indicator';
    beatDotEl.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${INACTIVE_COLOR};
        box-shadow: 0 0 4px rgba(0,0,0,0.5);
        transition: background 0.05s ease-out, box-shadow 0.05s ease-out, transform 0.05s ease-out;
        margin-left: 4px;
        cursor: pointer;
    `;
    
    // Insert after metronome button if it exists
    if (metronomeBtn && metronomeBtn.parentNode) {
        metronomeBtn.parentNode.insertBefore(beatDotEl, metronomeBtn.nextSibling);
    } else {
        transportBar.appendChild(beatDotEl);
    }
    
    // Click to toggle beat count display
    beatDotEl.addEventListener('click', () => {
        currentBeatCount = 0;
    });
    
    isActive = true;
    console.log('[MetronomeVisual] Beat indicator initialized');
    
    // Start the visual update loop
    startVisualLoop();
    
    return beatDotEl;
}

/**
 * Main visual update loop - syncs with Tone.js Transport
 */
function startVisualLoop() {
    if (!isActive) return;
    
    function loop() {
        updateBeatVisualFromTransport();
        animationFrameId = requestAnimationFrame(loop);
    }
    
    loop();
}

/**
 * Update visual beat based on Tone.Transport position
 */
function updateBeatVisualFromTransport() {
    if (!beatDotEl || !isActive) return;
    
    // Check if metronome is enabled
    const metronomeEnabled = typeof getMetronomeEnabled === 'function' ? getMetronomeEnabled() : false;
    
    if (typeof Tone === 'undefined' || Tone.Transport.state !== 'started' || !metronomeEnabled) {
        // Transport stopped or metronome disabled - reset
        if (transportStarted) {
            transportStarted = false;
            currentBeatCount = 0;
            lastBeatIndex = -1;
            resetBeatDot();
        }
        return;
    }
    
    transportStarted = true;
    
    // Get current position from Tone.Transport
    // Format: "bars:quarters:sixteenths" (e.g., "0:0:0.0")
    const pos = Tone.Transport.position;
    const parts = pos.split(':');
    
    if (parts.length < 3) return;
    
    const bars = parseInt(parts[0], 10);
    const quarters = parseInt(parts[1], 10);
    const sixteenths = parseFloat(parts[2]);
    
    // Calculate beat within the bar (0-3 for 4/4 time)
    const beatInBar = Math.floor(sixteenths / 4);
    const isDownbeat = quarters === 0 && beatInBar === 0;
    
    // Calculate total beat index for cycle detection
    const timeSignatureTop = typeof getMetronomeTimeSigTop === 'function' ? getMetronomeTimeSigTop() : 4;
    const beatIndex = bars * timeSignatureTop + quarters;
    
    // Only flash when beat changes
    if (beatIndex !== lastBeatIndex) {
        lastBeatIndex = beatIndex;
        currentBeatCount++;
        
        if (isDownbeat) {
            // Flash downbeat - larger, redder pulse
            flashBeatDot(DOWNBEAT_COLOR, true);
            currentBeatCount = 1; // Reset count on downbeat
        } else {
            // Flash regular beat
            flashBeatDot(REGULAR_BEAT_COLOR, false);
        }
    }
}

/**
 * Flash the beat dot with color and animation
 * @param {string} color - Hex color for the flash
 * @param {boolean} isDownbeat - Whether this is a downbeat
 */
function flashBeatDot(color, isDownbeat) {
    if (!beatDotEl) return;
    
    beatDotEl.style.background = color;
    beatDotEl.style.boxShadow = `0 0 12px ${color}`;
    
    // Slight scale for downbeat
    if (isDownbeat) {
        beatDotEl.style.transform = 'scale(1.3)';
    } else {
        beatDotEl.style.transform = 'scale(1.15)';
    }
    
    // Fade back after 100ms
    setTimeout(() => {
        if (beatDotEl) {
            beatDotEl.style.background = INACTIVE_COLOR;
            beatDotEl.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
            beatDotEl.style.transform = 'scale(1)';
        }
    }, 100);
}

/**
 * Reset beat dot to inactive state
 */
function resetBeatDot() {
    if (!beatDotEl) return;
    beatDotEl.style.background = INACTIVE_COLOR;
    beatDotEl.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
    beatDotEl.style.transform = 'scale(1)';
}

/**
 * Stop the visual loop
 */
export function stopBeatVisualLoop() {
    if (!isActive) return;
    isActive = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    resetBeatDot();
    console.log('[MetronomeVisual] Beat visual loop stopped');
}

/**
 * Start the visual loop (called by init)
 */
function startBeatVisualLoop() {
    if (isActive) return;
    isActive = true;
    startVisualLoop();
}

/**
 * Check if the metronome visual is active
 * @returns {boolean}
 */
export function isBeatVisualActive() {
    return isActive;
}

/**
 * Get current beat count since transport started
 * @returns {number}
 */
export function getBeatCount() {
    return currentBeatCount;
}

/**
 * Force update - call this when transport state changes
 */
export function forceUpdate() {
    lastBeatIndex = -1;
    currentBeatCount = 0;
}

// External references (will be set by eventHandlers.js)
function getMetronomeEnabled() {
    return window.state?.metronomeEnabled || false;
}

function getMetronomeTimeSigTop() {
    return window.state?.metronomeTimeSigTop || 4;
}

export default {
    initMetronomeVisual,
    startBeatVisualLoop,
    stopBeatVisualLoop,
    isBeatVisualActive,
    getBeatCount,
    forceUpdate
};
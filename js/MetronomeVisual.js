/**
 * MetronomeVisual.js
 * Provides a visual beat indicator that flashes in sync with the metronome audio clicks.
 */

let beatIndicatorEl = null;
let animationFrameId = null;
let isActive = false;
let lastBeatIndex = -1;

// Beat colors
const DOWNBEAT_COLOR = '#ff7700';
const REGULAR_BEAT_COLOR = '#ffaa00';
const INACTIVE_COLOR = '#333333';

/**
 * Initialize the beat indicator element and start the visual loop.
 * @param {Object} appServices - Application services (optional, for compatibility with main.js pattern)
 */
export function initMetronomeVisual(appServices) {
    // Create or get the beat indicator element
    beatIndicatorEl = document.getElementById('beatIndicatorGlobal');
    if (!beatIndicatorEl) {
        beatIndicatorEl = document.createElement('div');
        beatIndicatorEl.id = 'beatIndicatorGlobal';
        beatIndicatorEl.title = 'Beat Indicator';
        beatIndicatorEl.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: ${INACTIVE_COLOR};
            transition: background 0.05s ease-out;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
        `;
        
        // Try to find a good place in the transport bar
        const transportBar = document.getElementById('globalControlsBar');
        if (transportBar) {
            // Insert after the metronome toggle button
            const metronomeBtn = document.getElementById('metronomeToggleBtnGlobal');
            if (metronomeBtn) {
                metronomeBtn.parentNode.insertBefore(beatIndicatorEl, metronomeBtn.nextSibling);
            } else {
                transportBar.appendChild(beatIndicatorEl);
            }
        }
    }
    
    console.log('[MetronomeVisual] Beat indicator initialized');
    return beatIndicatorEl;
}

/**
 * Update the visual indicator based on the current transport position and beat.
 */
export function updateBeatVisual() {
    if (!beatIndicatorEl || !isActive) return;
    
    if (typeof Tone === 'undefined') return;
    
    const state = Tone.Transport.state;
    if (state !== 'started') {
        beatIndicatorEl.style.background = INACTIVE_COLOR;
        return;
    }
    
    // Get current position
    const pos = Tone.Transport.position;
    const parts = pos.split(':');
    const beatsInBar = parseInt(parts[1], 10);
    const ticks = parseInt(parts[2], 10);
    
    // Calculate current beat within bar (0-3 for 4/4)
    const currentBeat = Math.floor(ticks / (Tone.Transport.resolution / 4));
    const isDownbeat = beatsInBar === 0 && currentBeat === 0;
    
    // Flash on the beat (every quarter note)
    const beatIndex = beatsInBar * 4 + currentBeat;
    
    if (beatIndex !== lastBeatIndex) {
        lastBeatIndex = beatIndex;
        
        // Flash the indicator
        const color = isDownbeat ? DOWNBEAT_COLOR : REGULAR_BEAT_COLOR;
        beatIndicatorEl.style.background = color;
        beatIndicatorEl.style.boxShadow = `0 0 8px ${color}`;
        
        // Fade back to inactive after a short duration
        setTimeout(() => {
            if (beatIndicatorEl) {
                beatIndicatorEl.style.background = INACTIVE_COLOR;
                beatIndicatorEl.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
            }
        }, 100);
    }
}

/**
 * Start the visual beat loop.
 */
export function startBeatVisualLoop() {
    if (isActive) return;
    isActive = true;
    lastBeatIndex = -1;
    
    function loop() {
        updateBeatVisual();
        animationFrameId = requestAnimationFrame(loop);
    }
    loop();
    console.log('[MetronomeVisual] Beat visual loop started');
}

/**
 * Stop the visual beat loop.
 */
export function stopBeatVisualLoop() {
    if (!isActive) return;
    isActive = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (beatIndicatorEl) {
        beatIndicatorEl.style.background = INACTIVE_COLOR;
    }
    console.log('[MetronomeVisual] Beat visual loop stopped');
}

/**
 * Check if the metronome visual is active.
 * @returns {boolean}
 */
export function isBeatVisualActive() {
    return isActive;
}

// Auto-start when transport plays and stop when it stops
// The actual sync happens in eventHandlers.js where startMetronomeScheduling is called

export default {
    initMetronomeVisual,
    updateBeatVisual,
    startBeatVisualLoop,
    stopBeatVisualLoop,
    isBeatVisualActive
};
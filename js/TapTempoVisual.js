// js/TapTempoVisual.js - Tap Tempo Visual Indicator
// Animated visual showing tap tempo rhythm for visual metronome feedback

let localAppServices = {};

// Visual state
let tapIntervals = []; // Array of intervals between taps in ms
const MAX_VISUAL_TAPS = 8;
let visualPanel = null;
let isVisible = false;

// Animation state
let pulseAnimationFrame = null;
let lastPulseTime = 0;
let expectedInterval = 0; // Expected interval based on tapped BPM

/**
 * Initialize Tap Tempo Visual module
 * @param {Object} services - App services from main.js
 */
export function initTapTempoVisual(services) {
    localAppServices = services || {};
    console.log('[TapTempoVisual] Initialized');
}

/**
 * Record a tap for visualization
 * @param {number} bpm - The detected BPM
 * @param {number} interval - The interval since last tap (ms)
 */
export function recordVisualTap(bpm, interval) {
    if (interval > 0 && interval < 5000) { // Sanity check: tap interval should be < 5 seconds
        tapIntervals.push(interval);
        if (tapIntervals.length > MAX_VISUAL_TAPS) {
            tapIntervals.shift();
        }
        
        // Calculate expected interval for the detected BPM
        expectedInterval = 60000 / bpm;
    }
    
    updateVisualDisplay();
    triggerPulseAnimation();
}

/**
 * Trigger the pulse animation on tap
 */
function triggerPulseAnimation() {
    if (!visualPanel) return;
    
    const pulseRing = visualPanel.querySelector('.tap-visual-pulse');
    if (pulseRing) {
        // Reset animation
        pulseRing.style.animation = 'none';
        pulseRing.offsetHeight; // Trigger reflow
        pulseRing.style.animation = 'tapPulse 0.3s ease-out';
    }
    
    const centerDot = visualPanel.querySelector('.tap-visual-center');
    if (centerDot) {
        centerDot.style.transform = 'scale(1.3)';
        centerDot.style.backgroundColor = '#00ffcc';
        setTimeout(() => {
            centerDot.style.transform = 'scale(1)';
            centerDot.style.backgroundColor = '#7c3aed';
        }, 100);
    }
}

/**
 * Update the visual display
 */
function updateVisualDisplay() {
    if (!visualPanel) return;
    
    const bpmDisplay = visualPanel.querySelector('.tap-visual-bpm');
    const consistencyDisplay = visualPanel.querySelector('.tap-visual-consistency');
    const intervalBars = visualPanel.querySelector('.tap-visual-intervals');
    
    // Calculate current BPM from intervals
    let currentBpm = null;
    if (tapIntervals.length >= 2) {
        const avgInterval = tapIntervals.reduce((a, b) => a + b, 0) / tapIntervals.length;
        currentBpm = Math.round(60000 / avgInterval);
    }
    
    // Update BPM display
    if (bpmDisplay) {
        bpmDisplay.textContent = currentBpm ? `${currentBpm} BPM` : '-- BPM';
        bpmDisplay.style.color = currentBpm ? '#00ffcc' : '#444';
    }
    
    // Calculate and display consistency
    if (consistencyDisplay && tapIntervals.length >= 3) {
        const consistency = calculateConsistency();
        consistencyDisplay.textContent = `${Math.round(consistency * 100)}%`;
        
        if (consistency > 0.9) {
            consistencyDisplay.style.color = '#00ff00';
        } else if (consistency > 0.7) {
            consistencyDisplay.style.color = '#ffcc00';
        } else {
            consistencyDisplay.style.color = '#ff6666';
        }
    } else if (consistencyDisplay) {
        consistencyDisplay.textContent = '--';
        consistencyDisplay.style.color = '#444';
    }
    
    // Draw interval bars (visual representation of tap rhythm)
    if (intervalBars) {
        intervalBars.innerHTML = '';
        
        // Calculate max interval for scaling
        const maxInterval = Math.max(...tapIntervals, 1);
        
        tapIntervals.forEach((interval, index) => {
            const bar = document.createElement('div');
            bar.style.cssText = `
                width: ${(interval / maxInterval) * 100}%;
                height: 100%;
                background: linear-gradient(90deg, #7c3aed, #00ffcc);
                border-radius: 2px;
                margin: 0 1px;
                transition: width 0.15s ease;
                opacity: ${0.4 + (index / tapIntervals.length) * 0.6};
            `;
            intervalBars.appendChild(bar);
        });
    }
}

/**
 * Calculate tap consistency (1 = perfect, 0 = all over the place)
 * @returns {number} Consistency score 0-1
 */
function calculateConsistency() {
    if (tapIntervals.length < 3) return 0;
    
    const avg = tapIntervals.reduce((a, b) => a + b, 0) / tapIntervals.length;
    const variance = tapIntervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / tapIntervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Coefficient of variation - lower is more consistent
    const cv = stdDev / avg;
    
    // Convert to 0-1 scale (cv of 0 = 1, cv of 0.5+ = 0)
    return Math.max(0, Math.min(1, 1 - (cv * 2)));
}

/**
 * Get current tap intervals
 * @returns {Array} Array of tap intervals in ms
 */
export function getTapIntervals() {
    return [...tapIntervals];
}

/**
 * Get detected BPM from visual taps
 * @returns {number|null}
 */
export function getVisualBpm() {
    if (tapIntervals.length < 2) return null;
    const avgInterval = tapIntervals.reduce((a, b) => a + b, 0) / tapIntervals.length;
    return Math.round(60000 / avgInterval);
}

/**
 * Clear tap history
 */
export function clearVisualTaps() {
    tapIntervals = [];
    updateVisualDisplay();
}

/**
 * Toggle the visual panel
 */
export function toggleVisualPanel() {
    if (isVisible) {
        hideVisualPanel();
    } else {
        showVisualPanel();
    }
}

/**
 * Show the visual panel
 */
export function showVisualPanel() {
    if (visualPanel) {
        visualPanel.style.display = 'flex';
        isVisible = true;
        return;
    }
    
    // Create the panel
    visualPanel = document.createElement('div');
    visualPanel.className = 'tap-tempo-visual-panel';
    visualPanel.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(20, 20, 25, 0.95);
        border: 1px solid #3a3a4a;
        border-radius: 12px;
        padding: 16px 24px;
        z-index: 9990;
        font-family: 'Inter', sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        min-width: 280px;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes tapPulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(2); opacity: 0; }
        }
        @keyframes beatPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(style);
    
    visualPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;">
            <span style="font-size: 11px; color: #666; font-weight: 500;">TAP VISUAL</span>
            <button class="tap-visual-close" style="background: none; border: none; color: #555; cursor: pointer; font-size: 16px; padding: 0; line-height: 1;">&times;</button>
        </div>
        
        <!-- Visual Beat Indicator -->
        <div style="position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;">
            <div class="tap-visual-pulse" style="
                position: absolute;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                border: 2px solid #7c3aed;
                opacity: 0;
            "></div>
            <div class="tap-visual-center" style="
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
                border: 2px solid #7c3aed;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.1s ease;
            ">
                <div style="
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #7c3aed;
                    box-shadow: 0 0 10px #7c3aed;
                "></div>
            </div>
        </div>
        
        <!-- BPM Display -->
        <div class="tap-visual-bpm" style="font-size: 28px; font-weight: 700; color: #444; letter-spacing: -1px;">
            -- BPM
        </div>
        
        <!-- Consistency Indicator -->
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: #666;">Consistency:</span>
            <span class="tap-visual-consistency" style="font-size: 13px; font-weight: 600; color: #444;">--</span>
        </div>
        
        <!-- Interval Bars (visual rhythm display) -->
        <div style="width: 100%;">
            <div style="font-size: 10px; color: #555; margin-bottom: 4px;">TAP RHYTHM</div>
            <div class="tap-visual-intervals" style="
                display: flex;
                align-items: center;
                height: 16px;
                background: #1a1a1a;
                border-radius: 4px;
                padding: 2px;
                overflow: hidden;
            ">
                <span style="font-size: 10px; color: #333; width: 100%; text-align: center;">Tap to see rhythm</span>
            </div>
        </div>
        
        <!-- Beat Prediction Line -->
        <div style="width: 100%;">
            <div style="font-size: 10px; color: #555; margin-bottom: 4px;">PREDICTED BEATS</div>
            <div class="tap-visual-beats" style="
                display: flex;
                gap: 4px;
                height: 24px;
                align-items: center;
            ">
                ${Array(8).fill(0).map((_, i) => `<div style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    transition: all 0.1s ease;
                " data-beat="${i}"></div>`).join('')}
            </div>
        </div>
        
        <!-- Instructions -->
        <div style="font-size: 10px; color: #444; text-align: center;">
            Tap the button or press Spacebar rhythmically
        </div>
    `;
    
    // Attach close button
    visualPanel.querySelector('.tap-visual-close').addEventListener('click', () => hideVisualPanel());
    
    document.body.appendChild(visualPanel);
    isVisible = true;
    
    // Start beat prediction animation if we have a BPM
    startBeatPrediction();
}

/**
 * Hide the visual panel
 */
export function hideVisualPanel() {
    if (visualPanel) {
        visualPanel.style.display = 'none';
        isVisible = false;
        stopBeatPrediction();
    }
}

/**
 * Start the beat prediction animation
 */
function startBeatPrediction() {
    if (pulseAnimationFrame) return;
    
    const animate = () => {
        if (!isVisible || !visualPanel) {
            stopBeatPrediction();
            return;
        }
        
        const bpm = getVisualBpm();
        if (bpm) {
            const now = performance.now();
            const beatInterval = 60000 / bpm;
            const timeSinceLastTap = now - lastPulseTime;
            const beatPosition = (timeSinceLastTap % beatInterval) / beatInterval;
            
            // Update beat prediction indicators
            const beatDots = visualPanel.querySelectorAll('[data-beat]');
            beatDots.forEach((dot, i) => {
                const dotPosition = i / beatDots.length;
                const distance = Math.abs(beatPosition - dotPosition);
                const isNext = distance < 0.15 || distance > 0.85;
                
                if (isNext && beatPosition < 0.5) {
                    dot.style.background = '#00ffcc';
                    dot.style.transform = 'scale(1.3)';
                    dot.style.boxShadow = '0 0 8px #00ffcc';
                } else {
                    dot.style.background = '#2a2a2a';
                    dot.style.transform = 'scale(1)';
                    dot.style.boxShadow = 'none';
                }
            });
        }
        
        pulseAnimationFrame = requestAnimationFrame(animate);
    };
    
    pulseAnimationFrame = requestAnimationFrame(animate);
}

/**
 * Stop beat prediction animation
 */
function stopBeatPrediction() {
    if (pulseAnimationFrame) {
        cancelAnimationFrame(pulseAnimationFrame);
        pulseAnimationFrame = null;
    }
}

/**
 * Update last tap time (called when a tap is registered)
 */
export function markTapTime() {
    lastPulseTime = performance.now();
}

// Connect to global TapTempo if available
if (typeof window.TapTempo !== 'undefined') {
    const originalAddTap = window.TapTempo.addTap.bind(window.TapTempo);
    window.TapTempo.addTap = function(bpm) {
        const result = originalAddTap(bpm);
        const now = performance.now();
        const interval = tapIntervals.length > 0 ? now - lastPulseTime : 0;
        recordVisualTap(result || bpm, interval);
        markTapTime();
        return result;
    };
}

// Export for external use
window.TapTempoVisual = {
    initTapTempoVisual,
    recordVisualTap,
    getTapIntervals,
    getVisualBpm,
    clearVisualTaps,
    toggleVisualPanel,
    showVisualPanel,
    hideVisualPanel,
    markTapTime
};
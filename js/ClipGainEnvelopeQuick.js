// js/ClipGainEnvelopeQuick.js - Quick gain envelope editing on clips
// Feature: Double-click clip top to add gain envelope points without opening full editor

let localAppServices = {};

/**
 * Initialize the Clip Gain Envelope Quick module
 * @param {object} services - App services from main.js
 */
export function initClipGainEnvelopeQuick(services) {
    localAppServices = services;
    console.log('[ClipGainEnvelopeQuick] Initialized');
    
    // Set up double-click handler on the timeline area
    setupQuickEnvelopeHandler();
}

/**
 * Set up double-click handler for quick envelope editing
 */
function setupQuickEnvelopeHandler() {
    // Use a delegate approach - listen for double-clicks on the main container
    // and check if they target a clip top area
    document.addEventListener('dblclick', handleDoubleClick);
    
    // Also listen for clicks on envelope indicator to open full editor
    document.addEventListener('click', handleIndicatorClick);
}

/**
 * Handle double-click to add envelope point
 */
function handleDoubleClick(e) {
    // Check if double-click is on a clip's top area (where gain envelope shows)
    const target = e.target;
    
    // Look for clip envelope indicator elements
    const envelopeIndicator = target.closest('.clip-envelope-indicator, .clip-gain-indicator, [data-envelope-clip]');
    
    if (envelopeIndicator) {
        const clipId = envelopeIndicator.dataset.clipId || envelopeIndicator.dataset.envelopeClip;
        const trackId = envelopeIndicator.dataset.trackId;
        
        if (clipId && trackId) {
            addEnvelopePointAtPosition(clipId, trackId, e);
        }
        return;
    }
    
    // Check if double-click is on a clip waveform top area
    const clipCanvas = target.closest('canvas[data-clip-id]');
    if (clipCanvas) {
        const clipId = clipCanvas.dataset.clipId;
        const trackId = clipCanvas.dataset.trackId;
        
        // Check if click is in the top 25% of the clip (gain envelope area)
        const rect = clipCanvas.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;
        
        if (relativeY < 0.3) { // Top 30% of clip = envelope area
            addEnvelopePointAtPosition(clipId, trackId, e);
        }
        return;
    }
    
    // Check for clip container elements
    const clipContainer = target.closest('[data-clip-id]');
    if (clipContainer) {
        const clipId = clipContainer.dataset.clipId;
        const trackId = clipContainer.dataset.trackId;
        const rect = clipContainer.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;
        
        if (relativeY < 0.3) {
            addEnvelopePointAtPosition(clipId, trackId, e);
        }
    }
}

/**
 * Handle click on envelope indicator to open full editor
 */
function handleIndicatorClick(e) {
    const indicator = e.target.closest('.clip-envelope-indicator, .clip-gain-indicator');
    
    if (indicator) {
        const clipId = indicator.dataset.clipId;
        const trackId = indicator.dataset.trackId;
        
        if (clipId && trackId && localAppServices.openClipGainEnvelopeEditorPanel) {
            // Open the full envelope editor
            const { openClipGainEnvelopeEditorPanel } = localAppServices;
            if (typeof openClipGainEnvelopeEditorPanel === 'function') {
                openClipGainEnvelopeEditorPanel();
            }
        }
    }
}

/**
 * Add an envelope point at the click position
 */
function addEnvelopePointAtPosition(clipId, trackId, event) {
    if (!clipId || !trackId) return;
    
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(parseInt(trackId, 10)) : null;
    if (!track) return;
    
    // Get clip data
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        console.warn('[ClipGainEnvelopeQuick] Clip not found:', clipId);
        return;
    }
    
    // Calculate normalized position from click
    let normalizedTime = 0.5; // Default to middle
    let normalizedValue = 0.7; // Default to 70%
    
    // Try to get position from the event
    const target = event.target;
    const rect = target.getBoundingClientRect ? target.getBoundingClientRect() : target.parentElement?.getBoundingClientRect();
    
    if (rect) {
        // Calculate normalized time from click X position within clip
        normalizedTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        
        // Calculate gain value from Y position (inverted - top = higher)
        normalizedValue = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    }
    
    // Use existing gain envelope infrastructure
    const existingEnvelope = track.getClipGainEnvelope?.(clipId);
    
    if (track.addClipGainEnvelopePoint) {
        // Track has the method - use it directly
        // Convert normalized time to actual time in seconds
        const actualTime = normalizedTime * (clip.duration || 4);
        
        track.addClipGainEnvelopePoint(clipId, actualTime, normalizedValue);
        
        // Show feedback
        showEnvelopePointAddedFeedback(event.clientX, event.clientY, normalizedValue);
        
        // Trigger re-render if available
        if (localAppServices.renderTimeline) {
            localAppServices.renderTimeline();
        }
        
        console.log(`[ClipGainEnvelopeQuick] Added envelope point at ${(normalizedTime * 100).toFixed(0)}%, value ${(normalizedValue * 100).toFixed(0)}%`);
    } else {
        // Fallback - modify clip.gainEnvelope directly
        if (!clip.gainEnvelope) {
            clip.gainEnvelope = [
                { time: 0, value: 1.0 },
                { time: 1, value: 1.0 }
            ];
        }
        
        // Add point
        const newPoint = { time: normalizedTime, value: normalizedValue };
        
        // Insert sorted by time
        let inserted = false;
        for (let i = 0; i < clip.gainEnvelope.length; i++) {
            if (normalizedTime < clip.gainEnvelope[i].time) {
                clip.gainEnvelope.splice(i, 0, newPoint);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            clip.gainEnvelope.push(newPoint);
        }
        
        showEnvelopePointAddedFeedback(event.clientX, event.clientY, normalizedValue);
        
        if (localAppServices.renderTimeline) {
            localAppServices.renderTimeline();
        }
    }
}

/**
 * Show visual feedback when an envelope point is added
 */
function showEnvelopePointAddedFeedback(x, y, value) {
    // Create a floating indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        transform: translate(-50%, -50%);
        background: rgba(255, 170, 0, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        pointer-events: none;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: opacity 0.5s ease;
    `;
    indicator.textContent = `${(value * 100).toFixed(0)}%`;
    document.body.appendChild(indicator);
    
    // Fade out and remove
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 500);
    }, 800);
}

/**
 * Create envelope indicator element for clip top
 * Call this when rendering clips to add the clickable envelope area
 */
export function createEnvelopeIndicator(clipId, trackId) {
    const indicator = document.createElement('div');
    indicator.className = 'clip-envelope-indicator';
    indicator.dataset.clipId = clipId;
    indicator.dataset.trackId = trackId;
    indicator.dataset.envelopeClip = clipId;
    indicator.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 30%;
        cursor: pointer;
        z-index: 5;
    `;
    indicator.title = 'Double-click to add gain envelope point';
    return indicator;
}

/**
 * Update clip envelope display
 * This is called during clip render to update visual feedback
 */
export function updateClipEnvelopeDisplay(clipId, trackId, canvasCtx, canvasWidth, canvasHeight) {
    if (!canvasCtx || !canvasWidth || !canvasHeight) return;
    
    const track = localAppServices.getTrackById?.(parseInt(trackId, 10));
    if (!track) return;
    
    const envelope = track.getClipGainEnvelope?.(clipId) || [];
    if (!envelope || envelope.length < 2) return;
    
    // Draw subtle envelope line on clip top
    canvasCtx.strokeStyle = 'rgba(255, 200, 50, 0.3)';
    canvasCtx.lineWidth = 1;
    canvasCtx.beginPath();
    
    for (let i = 0; i < envelope.length; i++) {
        const x = envelope[i].time * canvasWidth;
        const y = (1 - envelope[i].value) * canvasHeight * 0.3; // Scale to top 30%
        
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
    }
    canvasCtx.stroke();
}

// Export for integration with other modules
export function getClipGainEnvelopeQuick() {
    return {
        addEnvelopePoint: addEnvelopePointAtPosition,
        createIndicator: createEnvelopeIndicator,
        updateDisplay: updateClipEnvelopeDisplay
    };
}
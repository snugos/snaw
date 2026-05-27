// js/TimelineRulerClick.js - Timeline Ruler Click Feature
// Click on the timeline ruler to jump playhead to that position

let localAppServices = {};
let isEnabled = true;

/**
 * Initialize Timeline Ruler Click module
 * @param {Object} appServices - Application services from main.js
 */
export function initTimelineRulerClick(appServices) {
    localAppServices = appServices || {};
    
    // Wait for timeline to be ready
    setTimeout(() => {
        setupRulerClickHandler();
        setupRulerHoverTooltip();
    }, 500);
    
    console.log('[TimelineRulerClick] Initialized');
}

/**
 * Enable/disable the feature
 * @param {boolean} enabled
 */
export function setTimelineRulerClickEnabled(enabled) {
    isEnabled = !!enabled;
    console.log(`[TimelineRulerClick] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Check if feature is enabled
 * @returns {boolean}
 */
export function isTimelineRulerClickEnabled() {
    return isEnabled;
}

/**
 * Setup click handler on timeline ruler
 */
function setupRulerClickHandler() {
    const timelineRuler = findTimelineRuler();
    
    if (!timelineRuler) {
        console.warn('[TimelineRulerClick] Timeline ruler not found, retrying...');
        setTimeout(setupRulerClickHandler, 1000);
        return;
    }
    
    // Remove any existing handler to avoid duplicates
    timelineRuler.removeEventListener('click', handleRulerClick);
    
    // Add single click handler (different from dblclick used by PlayheadMarkerDrop)
    timelineRuler.addEventListener('click', handleRulerClick);
    
    // Make sure we don't conflict with double-click handlers
    // by stopping event propagation after our click
    timelineRuler.addEventListener('dblclick', (e) => {
        e.stopPropagation();
    });
    
    console.log('[TimelineRulerClick] Click handler attached to timeline ruler');
}

/**
 * Find the timeline ruler element
 * @returns {Element|null}
 */
function findTimelineRuler() {
    return document.getElementById('timelineRuler') || 
           document.querySelector('.timeline-ruler') ||
           document.querySelector('.timeline-ruler-track') ||
           document.getElementById('timeline') ||
           document.querySelector('[id*="ruler"]') ||
           document.querySelector('[class*="ruler"]');
}

/**
 * Handle click on timeline ruler
 * @param {MouseEvent} event
 */
function handleRulerClick(event) {
    if (!isEnabled) return;
    
    // Ignore if this was part of a double-click
    if (event.detail && event.detail > 0) {
        // Single click has detail=0, double-click has detail=1
        return;
    }
    
    const time = getTimeFromEvent(event);
    if (time === null) return;
    
    // Jump playhead to the clicked position
    jumpToTime(time);
    
    console.log(`[TimelineRulerClick] Jumped to ${time.toFixed(2)}s`);
}

/**
 * Convert mouse event to time position
 * @param {MouseEvent} event
 * @returns {number|null}
 */
function getTimeFromEvent(event) {
    try {
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        // Get pixels per second (default to 50 if not available)
        const pixelsPerSecond = localAppServices.getPixelsPerSecond ? 
            localAppServices.getPixelsPerSecond() : 50;
        
        // Convert pixel position to time
        const time = x / pixelsPerSecond;
        
        // Ensure time is non-negative
        return Math.max(0, time);
    } catch (e) {
        console.warn('[TimelineRulerClick] Error calculating time from event:', e);
        return null;
    }
}

/**
 * Jump playhead to specific time
 * @param {number} time - Time in seconds
 */
function jumpToTime(time) {
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        // Set transport position
        Tone.Transport.seconds = time;
        
        // Update UI if available
        if (localAppServices.updatePlayheadPosition) {
            localAppServices.updatePlayheadPosition(time);
        }
        
        // Trigger UI refresh if available
        if (localAppServices.renderTimeline) {
            localAppServices.renderTimeline();
        }
        
        // Show feedback
        showJumpFeedback(time);
    }
}

/**
 * Show visual feedback when jumping
 * @param {number} time
 */
function showJumpFeedback(time) {
    // Create or update feedback element
    let feedback = document.getElementById('timeline-ruler-click-feedback');
    
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'timeline-ruler-click-feedback';
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #00ff88;
            padding: 8px 16px;
            border-radius: 4px;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            font-weight: bold;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(feedback);
    }
    
    feedback.textContent = `${time.toFixed(2)}s`;
    feedback.style.opacity = '1';
    
    // Hide after brief display
    clearTimeout(feedback.hideTimeout);
    feedback.hideTimeout = setTimeout(() => {
        feedback.style.opacity = '0';
    }, 800);
}

// --- Enhancement: Timeline Ruler Hover Time Tooltip ---
// Shows time position tooltip when hovering over the timeline ruler

let rulerHoverTooltip = null;
let lastRulerHoverX = 0;
let rulerHoverThrottle = null;

/**
 * Get or create the ruler hover tooltip element
 * @returns {HTMLElement}
 */
function getRulerHoverTooltip() {
    if (rulerHoverTooltip) return rulerHoverTooltip;
    
    rulerHoverTooltip = document.createElement('div');
    rulerHoverTooltip.id = 'timeline-ruler-hover-tooltip';
    rulerHoverTooltip.style.cssText = `
        position: fixed;
        background: rgba(20, 20, 30, 0.95);
        color: #00ff88;
        padding: 4px 10px;
        border-radius: 4px;
        font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
        font-size: 12px;
        font-weight: 600;
        pointer-events: none;
        z-index: 10001;
        opacity: 0;
        transition: opacity 0.15s ease;
        border: 1px solid rgba(0, 255, 136, 0.3);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    `;
    document.body.appendChild(rulerHoverTooltip);
    return rulerHoverTooltip;
}

/**
 * Handle mouse move over timeline ruler - show time tooltip
 * @param {MouseEvent} event
 */
function handleRulerMouseMove(event) {
    if (!isEnabled) return;
    
    // Throttle updates to 60fps
    if (rulerHoverThrottle) return;
    rulerHoverThrottle = setTimeout(() => { rulerHoverThrottle = null; }, 16);
    
    const time = getTimeFromEvent(event);
    if (time === null) return;
    
    lastRulerHoverX = event.clientX;
    const tooltip = getRulerHoverTooltip();
    
    tooltip.textContent = `${time.toFixed(2)}s`;
    tooltip.style.left = (event.clientX + 12) + 'px';
    tooltip.style.top = (event.clientY + 12) + 'px';
    tooltip.style.opacity = '1';
}

/**
 * Handle mouse leave from timeline ruler - hide tooltip
 */
function handleRulerMouseLeave() {
    if (rulerHoverTooltip) {
        rulerHoverTooltip.style.opacity = '0';
    }
}

/**
 * Setup hover tooltip handlers on timeline ruler
 */
function setupRulerHoverTooltip() {
    const timelineRuler = findTimelineRuler();
    if (!timelineRuler) return;
    
    timelineRuler.addEventListener('mousemove', handleRulerMouseMove);
    timelineRuler.addEventListener('mouseleave', handleRulerMouseLeave);
    
    console.log('[TimelineRulerClick] Hover tooltip enabled');
}

/**
 * Open settings panel (for future customization options)
 */
export function openTimelineRulerClickSettings() {
    const panelId = 'timeline-ruler-click-settings';
    let panel = document.getElementById(panelId);
    
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        return;
    }
    
    panel = document.createElement('div');
    panel.id = panelId;
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        width: 250px;
        background: rgba(30, 30, 40, 0.95);
        border: 1px solid #555;
        border-radius: 8px;
        padding: 16px;
        color: #eee;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 12px; font-size: 15px;">
            Timeline Ruler Click
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="trc-enabled" ${isEnabled ? 'checked' : ''}>
                <span>Enable click-to-seek</span>
            </label>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; color: #aaa;">
                Default pixels/second:
            </label>
            <input type="number" id="trc-pps" value="50" min="10" max="200" step="10"
                   style="width: 100%; padding: 4px; border-radius: 4px; border: 1px solid #555; background: #222; color: #eee;">
        </div>
        <div style="font-size: 11px; color: #888; margin-top: 8px;">
            Click on the timeline ruler to jump playhead to that position.
        </div>
        <button id="trc-close" style="
            margin-top: 12px;
            width: 100%;
            padding: 6px;
            background: #444;
            border: 1px solid #555;
            border-radius: 4px;
            color: #ccc;
            cursor: pointer;
        ">Close</button>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('trc-enabled').addEventListener('change', (e) => {
        setTimelineRulerClickEnabled(e.target.checked);
    });
    
    document.getElementById('trc-close').addEventListener('click', () => {
        panel.style.display = 'none';
    });
}
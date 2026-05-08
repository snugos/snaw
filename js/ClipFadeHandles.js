/**
 * Clip Fade Handles - Drag handles on clip edges to adjust fade in/out
 * Visual curve preview while dragging
 */

let fadeHandleState = {
    active: false,
    type: null, // 'fadeIn' | 'fadeOut'
    clipId: null,
    originalValue: 0,
    currentValue: 0,
    startX: 0,
    canvas: null,
    overlayCanvas: null,
    animationFrame: null
};

const HANDLE_WIDTH = 12; // pixels
const HANDLE_DETECT_THRESHOLD = 15; // pixels from edge

/**
 * Initialize clip fade handles system
 */
export function initClipFadeHandles() {
    // Create overlay canvas for fade handle visualization
    createFadeOverlayCanvas();
    
    // Attach event listeners to timeline/container
    attachFadeHandleEvents();
    
    console.log('[ClipFadeHandles] Initialized');
}

/**
 * Create overlay canvas for drawing fade handles
 */
function createFadeOverlayCanvas() {
    if (fadeHandleState.overlayCanvas) return;
    
    // Find the main timeline/arrangement container
    const container = document.querySelector('.timeline-container') || 
                     document.querySelector('.arrangement-view') ||
                     document.querySelector('#mainContent') ||
                     document.body;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'fadeHandleOverlay';
    canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 1000;
    `;
    
    container.style.position = container.style.position || 'relative';
    container.appendChild(canvas);
    
    fadeHandleState.overlayCanvas = canvas;
    
    // Set canvas size to match container
    resizeOverlayCanvas();
    window.addEventListener('resize', resizeOverlayCanvas);
}

/**
 * Resize overlay canvas to match parent
 */
function resizeOverlayCanvas() {
    const canvas = fadeHandleState.overlayCanvas;
    if (!canvas) return;
    
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
    }
}

/**
 * Attach mouse events for fade handle interaction
 */
function attachFadeHandleEvents() {
    const container = document.querySelector('.timeline-container') || 
                     document.querySelector('.arrangement-view') ||
                     document.querySelector('#mainContent') ||
                     document;
    
    if (container instanceof Element) {
        container.addEventListener('mousedown', handleFadeMouseDown);
        container.addEventListener('mousemove', handleFadeMouseMove);
        container.addEventListener('mouseup', handleFadeMouseUp);
        container.addEventListener('mouseleave', handleFadeMouseUp);
    }
    
    // Listen for clip selection changes to redraw handles
    document.addEventListener('clipSelectionChanged', onClipSelectionChanged);
    document.addEventListener('timelineRendered', onTimelineRendered);
}

/**
 * Handle mouse down on fade area
 */
function handleFadeMouseDown(e) {
    const result = detectFadeHandle(e);
    if (!result) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const { clipId, type, value } = result;
    
    fadeHandleState.active = true;
    fadeHandleState.type = type;
    fadeHandleState.clipId = clipId;
    fadeHandleState.originalValue = value;
    fadeHandleState.currentValue = value;
    fadeHandleState.startX = e.clientX;
    
    // Show the overlay with active handle
    const canvas = fadeHandleState.overlayCanvas;
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'ew-resize';
    }
    
    // Start render loop
    renderActiveFadeHandle();
    
    console.log(`[ClipFadeHandles] Started adjusting ${type} on clip ${clipId}`);
}

/**
 * Handle mouse move for drag
 */
function handleFadeMouseMove(e) {
    // Update cursor when hovering near edge
    if (!fadeHandleState.active) {
        const result = detectFadeHandle(e);
        updateCursorForFadeHover(result);
        return;
    }
    
    if (!fadeHandleState.active) return;
    
    // Calculate new fade value based on drag distance
    const deltaX = e.clientX - fadeHandleState.startX;
    const pixelsPerSecond = getPixelsPerSecond();
    const deltaSeconds = deltaX / pixelsPerSecond;
    
    let newValue = fadeHandleState.originalValue;
    if (fadeHandleState.type === 'fadeIn') {
        newValue = Math.max(0, fadeHandleState.originalValue + deltaSeconds);
    } else {
        newValue = Math.max(0, fadeHandleState.originalValue - deltaSeconds);
    }
    
    fadeHandleState.currentValue = newValue;
    
    // Apply to clip
    applyFadeToClip(fadeHandleState.clipId, fadeHandleState.type, newValue);
    
    // Continue render loop
    renderActiveFadeHandle();
}

/**
 * Handle mouse up to end drag
 */
function handleFadeMouseUp(e) {
    if (!fadeHandleState.active) return;
    
    const finalValue = fadeHandleState.currentValue;
    const type = fadeHandleState.type;
    const clipId = fadeHandleState.clipId;
    
    // Apply final value
    applyFadeToClip(clipId, type, finalValue);
    
    // Notify about change
    document.dispatchEvent(new CustomEvent('clipFadeChanged', {
        detail: { clipId, type, value: finalValue }
    }));
    
    // Reset state
    fadeHandleState.active = false;
    fadeHandleState.type = null;
    fadeHandleState.clipId = null;
    
    const canvas = fadeHandleState.overlayCanvas;
    if (canvas) {
        canvas.style.pointerEvents = 'none';
        canvas.style.cursor = 'default';
    }
    
    // Cancel animation frame
    if (fadeHandleState.animationFrame) {
        cancelAnimationFrame(fadeHandleState.animationFrame);
        fadeHandleState.animationFrame = null;
    }
    
    // Redraw to clean up
    renderActiveFadeHandle();
    
    console.log(`[ClipFadeHandles] Applied ${type} = ${finalValue.toFixed(2)}s to clip ${clipId}`);
}

/**
 * Detect if mouse is near a fade handle
 */
function detectFadeHandle(e) {
    // Get all clip elements (assuming clips are rendered as divs)
    const clips = document.querySelectorAll('.clip, .audio-clip, [data-clip-id]');
    
    for (const clipEl of clips) {
        const rect = clipEl.getBoundingClientRect();
        const clipId = clipEl.dataset.clipId || clipEl.id;
        const fadeIn = parseFloat(clipEl.dataset.fadeIn) || 0;
        const fadeOut = parseFloat(clipEl.dataset.fadeOut) || 0;
        
        // Check fade in handle (left edge)
        if (fadeIn > 0) {
            const fadeInWidth = fadeIn * getPixelsPerSecond();
            const handleLeft = rect.left;
            const handleRight = rect.left + fadeInWidth + HANDLE_DETECT_THRESHOLD;
            
            if (e.clientX >= handleLeft && e.clientX <= handleRight && 
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                return { clipId, type: 'fadeIn', value: fadeIn, rect };
            }
        }
        
        // Check fade out handle (right edge)
        if (fadeOut > 0) {
            const fadeOutWidth = fadeOut * getPixelsPerSecond();
            const handleLeft = rect.right - fadeOutWidth - HANDLE_DETECT_THRESHOLD;
            const handleRight = rect.right;
            
            if (e.clientX >= handleLeft && e.clientX <= handleRight &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                return { clipId, type: 'fadeOut', value: fadeOut, rect };
            }
        }
        
        // If no fade but within edge detection zone
        if (e.clientX >= rect.left - 5 && e.clientX <= rect.left + HANDLE_DETECT_THRESHOLD &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            return { clipId, type: 'fadeIn', value: 0, rect };
        }
        
        if (e.clientX >= rect.right - HANDLE_DETECT_THRESHOLD && e.clientX <= rect.right + 5 &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            return { clipId, type: 'fadeOut', value: 0, rect };
        }
    }
    
    return null;
}

/**
 * Update cursor when hovering near fade handle
 */
function updateCursorForFadeHover(result) {
    const canvas = fadeHandleState.overlayCanvas;
    if (!canvas) return;
    
    if (result) {
        canvas.style.cursor = 'ew-resize';
        renderHoverFadeHandle(result);
    } else {
        canvas.style.cursor = 'default';
        clearOverlay();
    }
}

/**
 * Get pixels per second from timeline settings
 */
function getPixelsPerSecond() {
    // Try to get from global state or use default
    if (typeof getPixelsPerSecondState === 'function') {
        return getPixelsPerSecondState();
    }
    return 50; // Default
}

/**
 * Apply fade value to clip
 */
function applyFadeToClip(clipId, type, value) {
    // Try to find clip in track data
    if (typeof tracks !== 'undefined') {
        for (const track of tracks) {
            const clip = track.clips?.find(c => c.id === clipId);
            if (clip) {
                if (type === 'fadeIn') {
                    clip.fadeIn = value;
                    clipEl.dataset.fadeIn = value;
                } else {
                    clip.fadeOut = value;
                    clipEl.dataset.fadeOut = value;
                }
                
                // Trigger UI update
                document.dispatchEvent(new CustomEvent('timelineRendered'));
                return;
            }
        }
    }
    
    // Fallback: update DOM element directly
    const clipEl = document.querySelector(`[data-clip-id="${clipId}"]`);
    if (clipEl) {
        clipEl.dataset[type] = value;
    }
}

/**
 * Render active fade handle being dragged
 */
function renderActiveFadeHandle() {
    const canvas = fadeHandleState.overlayCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    clearOverlay();
    
    if (!fadeHandleState.clipId) return;
    
    // Find clip element
    const clipEl = document.querySelector(`[data-clip-id="${fadeHandleState.clipId}"]`) ||
                   document.querySelector(`.clip[data-id="${fadeHandleState.clipId}"]`);
    
    if (!clipEl) return;
    
    const rect = clipEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    const relX = rect.left - canvasRect.left;
    const relY = rect.top - canvasRect.top;
    const width = rect.width;
    const height = rect.height;
    
    ctx.save();
    
    if (fadeHandleState.type === 'fadeIn') {
        const fadeWidth = fadeHandleState.currentValue * getPixelsPerSecond();
        
        // Draw fade region highlight
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.fillRect(relX, relY, fadeWidth, height);
        
        // Draw fade curve
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const curve = getFadeCurve(clipEl.dataset.fadeInCurve || 'linear');
        
        for (let i = 0; i <= fadeWidth; i++) {
            const t = i / fadeWidth;
            const gain = curve(t);
            const y = relY + height * (1 - gain);
            
            if (i === 0) ctx.moveTo(relX + i, y);
            else ctx.lineTo(relX + i, y);
        }
        ctx.stroke();
        
        // Draw handle line
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(relX + fadeWidth, relY);
        ctx.lineTo(relX + fadeWidth, relY + height);
        ctx.stroke();
        
        // Draw value tooltip
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(relX + fadeWidth - 30, relY - 25, 60, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${fadeHandleState.currentValue.toFixed(2)}s`, relX + fadeWidth, relY - 10);
        
    } else if (fadeHandleState.type === 'fadeOut') {
        const fadeWidth = fadeHandleState.currentValue * getPixelsPerSecond();
        
        // Draw fade region highlight
        ctx.fillStyle = 'rgba(255, 74, 74, 0.2)';
        ctx.fillRect(relX + width - fadeWidth, relY, fadeWidth, height);
        
        // Draw fade curve
        ctx.strokeStyle = '#ff4a4a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const curve = getFadeCurve(clipEl.dataset.fadeOutCurve || 'linear');
        
        for (let i = 0; i <= fadeWidth; i++) {
            const t = i / fadeWidth;
            const gain = curve(1 - t);
            const y = relY + height * (1 - gain);
            
            if (i === 0) ctx.moveTo(relX + width - fadeWidth + i, y);
            else ctx.lineTo(relX + width - fadeWidth + i, y);
        }
        ctx.stroke();
        
        // Draw handle line
        ctx.strokeStyle = '#ff4a4a';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(relX + width - fadeWidth, relY);
        ctx.lineTo(relX + width - fadeWidth, relY + height);
        ctx.stroke();
        
        // Draw value tooltip
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(relX + width - fadeWidth - 30, relY - 25, 60, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${fadeHandleState.currentValue.toFixed(2)}s`, relX + width - fadeWidth, relY - 10);
    }
    
    ctx.restore();
    
    // Continue animation if active
    if (fadeHandleState.active) {
        fadeHandleState.animationFrame = requestAnimationFrame(renderActiveFadeHandle);
    }
}

/**
 * Render hover indicator for fade handle
 */
function renderHoverFadeHandle(result) {
    const canvas = fadeHandleState.overlayCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const clipEl = document.querySelector(`[data-clip-id="${result.clipId}"]`) ||
                   document.querySelector(`.clip[data-id="${result.clipId}"]`);
    
    if (!clipEl) return;
    
    const rect = clipEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    const relX = rect.left - canvasRect.left;
    const relY = rect.top - canvasRect.top;
    const width = rect.width;
    const height = rect.height;
    
    ctx.save();
    
    if (result.type === 'fadeIn') {
        const fadeWidth = result.value * getPixelsPerSecond();
        
        if (fadeWidth > 0) {
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(relX + fadeWidth, relY);
            ctx.lineTo(relX + fadeWidth, relY + height);
            ctx.stroke();
        } else {
            // Show indicator even for zero fade
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(relX + 8, relY);
            ctx.lineTo(relX + 8, relY + height);
            ctx.stroke();
        }
    } else {
        const fadeWidth = result.value * getPixelsPerSecond();
        
        if (fadeWidth > 0) {
            ctx.strokeStyle = '#ff4a4a';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(relX + width - fadeWidth, relY);
            ctx.lineTo(relX + width - fadeWidth, relY + height);
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#ff4a4a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(relX + width - 8, relY);
            ctx.lineTo(relX + width - 8, relY + height);
            ctx.stroke();
        }
    }
    
    ctx.restore();
}

/**
 * Clear overlay canvas
 */
function clearOverlay() {
    const canvas = fadeHandleState.overlayCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Get fade curve function
 */
function getFadeCurve(curveType) {
    switch (curveType) {
        case 'linear':
            return t => t;
        case 'exponential':
            return t => Math.pow(t, 2);
        case 'logarithmic':
            return t => Math.log(1 + t * 9) / Math.log(10);
        case 'sine':
            return t => Math.sin(t * Math.PI / 2);
        case 's-curve':
            const k = 6;
            return t => 1 / (1 + Math.exp(-k * (t - 0.5)));
        case 'fast_in':
            return t => 1 - Math.pow(1 - t, 3);
        case 'slow_in':
            return t => Math.pow(t, 3);
        default:
            return t => t;
    }
}

/**
 * Event handlers
 */
function onClipSelectionChanged(e) {
    // Redraw handles for selected clips
    renderActiveFadeHandle();
}

function onTimelineRendered(e) {
    // Update overlay size and redraw
    resizeOverlayCanvas();
}

/**
 * Open clip fade handles settings/panel
 */
export function openClipFadeHandlesPanel() {
    // Create simple panel for fade handle settings
    const existing = document.getElementById('clipFadeHandlesPanel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'clipFadeHandlesPanel';
    panel.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        width: 300px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 14px;">Clip Fade Handles</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        <div style="padding: 16px;">
            <p style="color: #aaa; font-size: 12px; margin: 0 0 12px 0;">
                Drag the edges of clips to adjust fade in/out. 
                A visual curve preview will show while dragging.
            </p>
            <div style="margin-bottom: 12px;">
                <label style="color: #888; font-size: 11px;">Handle Sensitivity</label>
                <input type="range" id="fadeHandleSensitivity" min="5" max="30" value="${HANDLE_DETECT_THRESHOLD}" style="
                    width: 100%;
                    margin-top: 4px;
                ">
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="resetAllFades" style="
                    flex: 1;
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px;
                    cursor: pointer;
                    font-size: 11px;
                ">Reset Selected Fades</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
    });
    
    // Sensitivity slider
    const sensitivitySlider = panel.querySelector('#fadeHandleSensitivity');
    sensitivitySlider.addEventListener('input', (e) => {
        // Could update global handle detection threshold
        console.log('Fade handle sensitivity:', e.target.value);
    });
    
    // Reset fades button
    const resetBtn = panel.querySelector('#resetAllFades');
    resetBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('resetClipFades'));
        panel.remove();
    });
    
    return panel;
}

/**
 * Get fade handles state
 */
export function getFadeHandleState() {
    return { ...fadeHandleState };
}
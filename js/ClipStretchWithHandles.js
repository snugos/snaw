/**
 * js/ClipStretchWithHandles.js - Drag clip edges to stretch/squash audio non-destructively
 * Works with canvas-based timeline, showing visual handles on left/right edges of audio clips
 */

import { getLoopStretchInfo } from './ClipLoopStretch.js';

let localAppServices = {};
let stretchHandleState = {
    active: false,
    type: null, // 'left' | 'right'
    clipId: null,
    trackId: null,
    originalDuration: 1,
    startX: 0,
    overlayCanvas: null,
    animationFrame: null,
    // Timeline info for coordinate conversion
    timelineInfo: {
        pps: 50,
        scrollX: 0,
        scrollY: 0,
        trackHeaderWidth: 150,
        rulerHeight: 30
    }
};

const HANDLE_ZONE = 10; // pixels from edge to show handle

/**
 * Initialize the clip stretch handles module
 */
export function initClipStretchWithHandles(appServices) {
    localAppServices = appServices || {};
    createStretchOverlayCanvas();
    attachStretchHandleEvents();
    console.log('[ClipStretchWithHandles] Initialized');
}

/**
 * Create overlay canvas for stretch handle visualization
 */
function createStretchOverlayCanvas() {
    if (stretchHandleState.overlayCanvas) return;
    
    // Find the timeline canvas or main content container
    const timelineCanvas = document.querySelector('canvas') || 
                          document.querySelector('.timeline-canvas') ||
                          document.querySelector('#mainContent');
    
    const container = timelineCanvas || document.body;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'stretchHandleOverlay';
    canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 999;
    `;
    
    container.style.position = container.style.position || 'relative';
    container.appendChild(canvas);
    
    stretchHandleState.overlayCanvas = canvas;
    resizeOverlayCanvas();
    window.addEventListener('resize', resizeOverlayCanvas);
}

/**
 * Resize overlay canvas
 */
function resizeOverlayCanvas() {
    const canvas = stretchHandleState.overlayCanvas;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
    }
}

/**
 * Update timeline info for coordinate conversion
 */
function updateTimelineInfo() {
    // Try to get timeline info from localAppServices
    if (localAppServices.getTimelineInfo) {
        const info = localAppServices.getTimelineInfo();
        Object.assign(stretchHandleState.timelineInfo, info);
    } else if (localAppServices.getPixelsPerSecond) {
        stretchHandleState.timelineInfo.pps = localAppServices.getPixelsPerSecond();
    }
}

/**
 * Attach mouse events for stretch handle interaction
 */
function attachStretchHandleEvents() {
    const container = document.querySelector('#mainContent') || 
                     document.querySelector('.timeline-view') ||
                     document.body;
    
    if (container instanceof Element) {
        container.addEventListener('mousedown', handleStretchMouseDown);
        container.addEventListener('mousemove', handleStretchMouseMove);
        container.addEventListener('mouseup', handleStretchMouseUp);
        container.addEventListener('mouseleave', handleStretchMouseUp);
    }
    
    document.addEventListener('timelineRendered', onTimelineRendered);
    document.addEventListener('timelineUpdated', onTimelineRendered);
}

/**
 * Detect if mouse is near a stretch handle on a clip
 */
function detectStretchHandle(e) {
    updateTimelineInfo();
    const info = stretchHandleState.timelineInfo;
    const pps = info.pps;
    
    // Get tracks data
    const tracks = getTracksData();
    if (!tracks || tracks.length === 0) return null;
    
    // Calculate timeline position from mouse coordinates
    const container = document.querySelector('#mainContent') || document.body;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Skip if above ruler area
    if (mouseY < info.rulerHeight) return null;
    
    // Calculate the time position at mouse X
    const timeAtMouse = (mouseX - info.trackHeaderWidth + info.scrollX) / pps;
    
    // Find clip at this position
    for (const track of tracks) {
        if (track.type !== 'Audio') continue;
        if (!track.timelineClips || track.timelineClips.length === 0) continue;
        
        // Calculate track Y position
        const trackIndex = tracks.indexOf(track);
        const trackHeight = 80; // Default track height
        const trackY = info.rulerHeight + trackIndex * trackHeight - info.scrollY;
        const trackBottom = trackY + trackHeight;
        
        // Check if mouse is in this track's Y range
        if (mouseY < trackY || mouseY > trackBottom) continue;
        
        // Find clip at this time position
        for (const clip of track.timelineClips) {
            const clipStart = clip.start || 0;
            const clipDuration = clip.duration || 1;
            const clipEnd = clipStart + clipDuration;
            
            // Check if mouse is within this clip's X range
            if (timeAtMouse >= clipStart && timeAtMouse <= clipEnd) {
                const clipX = clipStart * pps - info.scrollX + info.trackHeaderWidth;
                const clipRight = clipX + clipDuration * pps;
                
                // Determine if we're on left or right handle
                const distToLeft = Math.abs(mouseX - clipX);
                const distToRight = Math.abs(mouseX - clipRight);
                
                if (distToLeft <= HANDLE_ZONE) {
                    return {
                        clipId: clip.id,
                        trackId: track.id,
                        type: 'left',
                        clip,
                        track,
                        clipX,
                        clipRight,
                        clipY: trackY + 5,
                        clipWidth: clipDuration * pps,
                        clipHeight: trackHeight - 10
                    };
                } else if (distToRight <= HANDLE_ZONE) {
                    return {
                        clipId: clip.id,
                        trackId: track.id,
                        type: 'right',
                        clip,
                        track,
                        clipX,
                        clipRight,
                        clipY: trackY + 5,
                        clipWidth: clipDuration * pps,
                        clipHeight: trackHeight - 10
                    };
                }
            }
        }
    }
    
    return null;
}

/**
 * Get tracks data from state
 */
function getTracksData() {
    if (typeof getTracksState === 'function') {
        return getTracksState();
    }
    if (localAppServices.getTracks) {
        return localAppServices.getTracks();
    }
    return [];
}

/**
 * Handle mouse down on stretch area
 */
function handleStretchMouseDown(e) {
    const result = detectStretchHandle(e);
    if (!result) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const { clipId, type, clip, trackId } = result;
    
    // Get original duration
    const info = getLoopStretchInfo(clip);
    
    stretchHandleState.active = true;
    stretchHandleState.type = type;
    stretchHandleState.clipId = clipId;
    stretchHandleState.trackId = trackId;
    stretchHandleState.originalDuration = info.originalDuration;
    stretchHandleState.startX = e.clientX;
    stretchHandleState.currentClipX = result.clipX;
    stretchHandleState.currentClipRight = result.clipRight;
    stretchHandleState.currentClipY = result.clipY;
    stretchHandleState.currentClipWidth = result.clipWidth;
    stretchHandleState.currentClipHeight = result.clipHeight;
    
    const canvas = stretchHandleState.overlayCanvas;
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'ew-resize';
    }
    
    renderActiveStretchHandle();
    console.log(`[ClipStretchWithHandles] Started ${type} stretch on clip ${clipId}`);
}

/**
 * Handle mouse move for drag
 */
function handleStretchMouseMove(e) {
    if (!stretchHandleState.active) {
        const result = detectStretchHandle(e);
        updateCursorForStretchHover(result);
        return;
    }
    
    const deltaX = e.clientX - stretchHandleState.startX;
    const pps = stretchHandleState.timelineInfo.pps;
    const deltaSeconds = deltaX / pps;
    
    const tracks = getTracksData();
    const track = tracks.find(t => t.id === stretchHandleState.trackId);
    if (!track) return;
    
    const clip = track.timelineClips?.find(c => c.id === stretchHandleState.clipId);
    if (!clip) return;
    
    const originalDuration = stretchHandleState.originalDuration;
    
    if (stretchHandleState.type === 'left') {
        // Dragging left handle adjusts start offset (shrink from start)
        const newStart = Math.max(0, Math.min(originalDuration - 0.1, deltaSeconds));
        clip.stretchStartOffset = newStart;
    } else {
        // Dragging right handle adjusts end offset
        const currentEnd = clip.stretchEndOffset || originalDuration;
        const newEnd = Math.max(0.1, Math.min(originalDuration, currentEnd + deltaSeconds));
        clip.stretchEndOffset = newEnd;
    }
    
    renderActiveStretchHandle();
}

/**
 * Handle mouse up to end drag
 */
function handleStretchMouseUp(e) {
    if (!stretchHandleState.active) return;
    
    const tracks = getTracksData();
    const track = tracks.find(t => t.id === stretchHandleState.trackId);
    
    if (track) {
        const clip = track.timelineClips?.find(c => c.id === stretchHandleState.clipId);
        if (clip) {
            const startOffset = clip.stretchStartOffset || 0;
            const endOffset = clip.stretchEndOffset || stretchHandleState.originalDuration;
            
            // Calculate new duration
            const newDuration = endOffset - startOffset;
            
            // Store the stretch data
            clip.stretchStartOffset = startOffset;
            clip.stretchEndOffset = endOffset;
            clip.duration = newDuration;
            
            console.log(`[ClipStretchWithHandles] Applied: start=${startOffset.toFixed(2)}, end=${endOffset.toFixed(2)}, duration=${newDuration.toFixed(2)}`);
            
            // Notify timeline to redraw
            document.dispatchEvent(new CustomEvent('timelineRendered'));
        }
    }
    
    // Reset state
    stretchHandleState.active = false;
    stretchHandleState.type = null;
    stretchHandleState.clipId = null;
    stretchHandleState.trackId = null;
    
    const canvas = stretchHandleState.overlayCanvas;
    if (canvas) {
        canvas.style.pointerEvents = 'none';
        canvas.style.cursor = 'default';
    }
    
    if (stretchHandleState.animationFrame) {
        cancelAnimationFrame(stretchHandleState.animationFrame);
        stretchHandleState.animationFrame = null;
    }
    
    renderActiveStretchHandle();
}

/**
 * Update cursor when hovering near stretch handle
 */
function updateCursorForStretchHover(result) {
    const canvas = stretchHandleState.overlayCanvas;
    if (!canvas) return;
    
    if (result) {
        canvas.style.cursor = 'ew-resize';
        renderHoverStretchHandle(result);
    } else {
        canvas.style.cursor = 'default';
        clearOverlay();
    }
}

/**
 * Render active stretch handle being dragged
 */
function renderActiveStretchHandle() {
    const canvas = stretchHandleState.overlayCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    clearOverlay();
    
    if (!stretchHandleState.active) return;
    
    const x = stretchHandleState.currentClipX;
    const y = stretchHandleState.currentClipY;
    const width = stretchHandleState.currentClipWidth;
    const height = stretchHandleState.currentClipHeight;
    
    ctx.save();
    
    const color = stretchHandleState.type === 'left' ? '#4a9eff' : '#ff4a4a';
    
    if (stretchHandleState.type === 'left') {
        // Left handle zone
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.fillRect(x, y, HANDLE_ZONE, height);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + HANDLE_ZONE, y);
        ctx.lineTo(x + HANDLE_ZONE, y + height);
        ctx.stroke();
        
        // Draw arrows
        drawResizeArrows(ctx, x + HANDLE_ZONE/2, y + height/2, 'left');
        
        // Value tooltip
        const tracks = getTracksData();
        const track = tracks.find(t => t.id === stretchHandleState.trackId);
        const clip = track?.timelineClips?.find(c => c.id === stretchHandleState.clipId);
        if (clip) {
            const startVal = clip.stretchStartOffset?.toFixed(2) || '0.00';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x - 50, y - 25, 80, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Start: ${startVal}s`, x - 10, y - 10);
        }
        
    } else {
        // Right handle zone
        ctx.fillStyle = 'rgba(255, 74, 74, 0.2)';
        ctx.fillRect(x + width - HANDLE_ZONE, y, HANDLE_ZONE, height);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + width - HANDLE_ZONE, y);
        ctx.lineTo(x + width - HANDLE_ZONE, y + height);
        ctx.stroke();
        
        // Draw arrows
        drawResizeArrows(ctx, x + width - HANDLE_ZONE/2, y + height/2, 'right');
        
        // Value tooltip
        const tracks = getTracksData();
        const track = tracks.find(t => t.id === stretchHandleState.trackId);
        const clip = track?.timelineClips?.find(c => c.id === stretchHandleState.clipId);
        if (clip) {
            const endVal = clip.stretchEndOffset?.toFixed(2) || clip.duration?.toFixed(2) || '1.00';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x + width - 30, y - 25, 80, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`End: ${endVal}s`, x + width + 10, y - 10);
        }
    }
    
    ctx.restore();
    
    if (stretchHandleState.active) {
        stretchHandleState.animationFrame = requestAnimationFrame(renderActiveStretchHandle);
    }
}

/**
 * Draw resize arrows
 */
function drawResizeArrows(ctx, x, y, direction) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const arrowSize = 6;
    
    if (direction === 'left') {
        ctx.moveTo(x + arrowSize, y - arrowSize);
        ctx.lineTo(x - arrowSize, y);
        ctx.lineTo(x + arrowSize, y + arrowSize);
    } else {
        ctx.moveTo(x - arrowSize, y - arrowSize);
        ctx.lineTo(x + arrowSize, y);
        ctx.lineTo(x - arrowSize, y + arrowSize);
    }
    
    ctx.stroke();
}

/**
 * Render hover indicator for stretch handle
 */
function renderHoverStretchHandle(result) {
    const canvas = stretchHandleState.overlayCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    clearOverlay();
    
    const { clipX, clipY, clipWidth, clipHeight, type } = result;
    
    ctx.save();
    
    const color = type === 'left' ? '#4a9eff' : '#ff4a4a';
    
    // Draw subtle highlight
    ctx.fillStyle = type === 'left' ? 'rgba(74, 158, 255, 0.1)' : 'rgba(255, 74, 74, 0.1)';
    if (type === 'left') {
        ctx.fillRect(clipX, clipY, HANDLE_ZONE, clipHeight);
    } else {
        ctx.fillRect(clipX + clipWidth - HANDLE_ZONE, clipY, HANDLE_ZONE, clipHeight);
    }
    
    // Draw edge line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    
    if (type === 'left') {
        ctx.moveTo(clipX + HANDLE_ZONE, clipY);
        ctx.lineTo(clipX + HANDLE_ZONE, clipY + clipHeight);
    } else {
        ctx.moveTo(clipX + clipWidth - HANDLE_ZONE, clipY);
        ctx.lineTo(clipX + clipWidth - HANDLE_ZONE, clipY + clipHeight);
    }
    
    ctx.stroke();
    ctx.restore();
}

/**
 * Clear overlay canvas
 */
function clearOverlay() {
    const canvas = stretchHandleState.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Event handlers
 */
function onClipSelectionChanged(e) {
    clearOverlay();
}

function onTimelineRendered(e) {
    resizeOverlayCanvas();
    clearOverlay();
    updateTimelineInfo();
}

/**
 * Reset a clip to its original state
 */
export function resetClipStretch(clipId) {
    const tracks = getTracksData();
    for (const track of tracks) {
        const clip = track.timelineClips?.find(c => c.id === clipId);
        if (clip) {
            clip.stretchStartOffset = 0;
            clip.stretchEndOffset = clip.originalDuration || clip.duration;
            clip.duration = clip.originalDuration || clip.duration;
            document.dispatchEvent(new CustomEvent('timelineRendered'));
            return;
        }
    }
}

/**
 * Get stretch info for UI display
 */
export function getClipStretchInfo(clipId) {
    const tracks = getTracksData();
    for (const track of tracks) {
        const clip = track.timelineClips?.find(c => c.id === clipId);
        if (clip) {
            return {
                startOffset: clip.stretchStartOffset || 0,
                endOffset: clip.stretchEndOffset || clip.duration || 1,
                originalDuration: clip.originalDuration || clip.duration,
                currentDuration: clip.duration
            };
        }
    }
    return null;
}

/**
 * Open stretch info panel for a clip
 */
export function openClipStretchPanel(clipId) {
    const existing = document.getElementById('clipStretchPanel');
    if (existing) existing.remove();
    
    const tracks = getTracksData();
    let targetClip = null;
    for (const track of tracks) {
        targetClip = track.timelineClips?.find(c => c.id === clipId);
        if (targetClip) break;
    }
    
    if (!targetClip) return;
    
    const info = getClipStretchInfo(clipId);
    
    const panel = document.createElement('div');
    panel.id = 'clipStretchPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 320px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10001;
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
            <h3 style="margin: 0; color: #fff; font-size: 14px;">Clip Stretch with Handles</h3>
            <button id="closeStretchPanel" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        <div style="padding: 16px;">
            <p style="color: #aaa; font-size: 12px; margin: 0 0 12px 0;">
                Drag the left or right edges of an audio clip to stretch or squash the audio.
                This is non-destructive and can be reset.
            </p>
            <div style="background: #252540; border-radius: 4px; padding: 10px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #888; font-size: 11px;">Start Offset:</span>
                    <span id="stretchStartVal" style="color: #4a9eff; font-size: 11px; font-family: monospace;">${info.startOffset.toFixed(2)}s</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #888; font-size: 11px;">End Offset:</span>
                    <span id="stretchEndVal" style="color: #ff4a4a; font-size: 11px; font-family: monospace;">${info.endOffset.toFixed(2)}s</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #888; font-size: 11px;">Original Duration:</span>
                    <span style="color: #fff; font-size: 11px; font-family: monospace;">${info.originalDuration.toFixed(2)}s</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #888; font-size: 11px;">Current Duration:</span>
                    <span id="stretchCurrentDur" style="color: #90EE90; font-size: 11px; font-family: monospace;">${info.currentDuration.toFixed(2)}s</span>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="resetClipStretch" style="
                    flex: 1;
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px;
                    cursor: pointer;
                    font-size: 11px;
                ">Reset Stretch</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    panel.querySelector('#closeStretchPanel').addEventListener('click', () => panel.remove());
    panel.querySelector('#resetClipStretch').addEventListener('click', () => {
        resetClipStretch(clipId);
        panel.remove();
    });
}
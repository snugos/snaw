/**
 * Audio Scrubbing Integration
 * Integrates AudioScrubber with the timeline for audible scrub preview
 */

import { AudioScrubber, createAudioScrubber } from './AudioScrubbing.js';
import { getTimelineClipAudioBuffer } from './audio.js';

let audioScrubber = null;
let isScrubActive = false;
let scrubTargetClipId = null;
let scrubTargetDbKey = null;
let scrubOnDragEnabled = true;
let localAppServices = {};

// Initialize audio scrubbing with app services
export function initAudioScrubbing(appServices) {
    localAppServices = appServices || {};
    
    // Get audio context from Tone.js
    const audioContext = getAudioContextForScrubbing();
    if (!audioContext) {
        console.warn('[AudioScrubbing] Could not get audio context');
        return;
    }
    
    audioScrubber = createAudioScrubber(audioContext);
    
    // Set up timeline event listeners
    setupTimelineScrubEvents();
    
    console.log('[AudioScrubbing] Audio scrubbing initialized');
}

// Get audio context from Tone.js or web audio
function getAudioContextForScrubbing() {
    if (typeof Tone !== 'undefined' && Tone.getContext) {
        return Tone.getContext().rawContext;
    }
    if (typeof Tone !== 'undefined' && Tone.context) {
        return Tone.context.rawContext || Tone.context;
    }
    if (typeof AudioContext !== 'undefined') {
        return new AudioContext();
    }
    return null;
}

// Set up timeline drag events for scrubbing
function setupTimelineScrubEvents() {
    const timeline = document.getElementById('timeline');
    if (!timeline) {
        console.warn('[AudioScrubbing] Timeline element not found');
        return;
    }
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    
    // Track mouse state for drag detection
    timeline.addEventListener('mousedown', (e) => {
        // Only activate on primary button and non-playhead areas
        if (e.button !== 0) return;
        
        // Check if clicking on playhead - if so, skip scrub
        if (e.target.closest('.playhead') || e.target.closest('#playhead')) {
            return;
        }
        
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        // Try to find audio clip at this position
        const clipInfo = findClipAtPosition(e);
        if (clipInfo) {
            scrubTargetClipId = clipInfo.clipId;
            scrubTargetDbKey = clipInfo.dbKey;
            
            // Start scrub at click position
            const position = clipInfo.clipStartTime + clipInfo.offsetInClip;
            startScrubAtPosition(position);
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !isScrubActive) return;
        
        // Calculate position delta
        const deltaX = e.clientX - dragStartX;
        
        // Get pixels per second from app services or estimate
        const pixelsPerSecond = getPixelsPerSecond();
        
        // Calculate new position
        const currentPos = audioScrubber.getPosition();
        const positionDelta = deltaX / pixelsPerSecond;
        const newPosition = Math.max(0, currentPos + positionDelta);
        
        // Update scrub position
        audioScrubber.updateScrub(newPosition);
        
        // Update drag tracking
        dragStartX = e.clientX;
    });
    
    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            stopScrub();
        }
    });
    
    // Handle escape key to cancel scrub
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isScrubActive) {
            stopScrub();
            isDragging = false;
        }
    });
}

// Get estimated pixels per second from UI
function getPixelsPerSecond() {
    // Try to get from app services if available
    if (localAppServices.getPixelsPerSecond) {
        return localAppServices.getPixelsPerSecond();
    }
    // Default estimate - typical DAW zoom level
    return 50;
}

// Find audio clip at screen position
function findClipAtPosition(mouseEvent) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    for (const track of tracks) {
        if (track.type !== 'Audio') continue;
        if (!track.timelineClips || track.timelineClips.length === 0) continue;
        
        // Get track lane element
        const trackLane = document.querySelector(`[data-track-id="${track.id}"] .track-lane, [data-track-id="${track.id}"]`);
        if (!trackLane) continue;
        
        const rect = trackLane.getBoundingClientRect();
        
        // Check if mouse is within track lane vertically
        if (mouseEvent.clientY < rect.top || mouseEvent.clientY > rect.bottom) continue;
        
        // Find clip under cursor
        for (const clip of track.timelineClips) {
            const clipLeft = (clip.startTime || 0) * getPixelsPerSecond();
            const clipRight = clipLeft + ((clip.duration || 4) * getPixelsPerSecond());
            const clipRightClient = rect.left + clipRight;
            
            if (mouseEvent.clientX >= rect.left + clipLeft && mouseEvent.clientX <= clipRightClient) {
                const offsetInClip = (mouseEvent.clientX - (rect.left + clipLeft)) / getPixelsPerSecond();
                return {
                    clipId: clip.id,
                    trackId: track.id,
                    dbKey: clip.dbKey,
                    clipStartTime: clip.startTime || 0,
                    offsetInClip: offsetInClip,
                    clipDuration: clip.duration || 4
                };
            }
        }
    }
    
    return null;
}

// Start scrubbing at a specific position
async function startScrubAtPosition(position) {
    if (!audioScrubber) return;
    
    // Stop any existing scrub
    audioScrubber.stopScrub();
    
    // Load audio buffer for the target clip
    if (scrubTargetDbKey) {
        try {
            const audioBuffer = await getTimelineClipAudioBuffer(scrubTargetClipId, scrubTargetDbKey);
            if (audioBuffer) {
                audioScrubber.loadBuffer(audioBuffer);
                audioScrubber.startScrub(position, { volume: 0.8, speed: 1 });
                isScrubActive = true;
                isScrubEnabled = true;
                return;
            }
        } catch (e) {
            console.warn('[AudioScrubbing] Could not load audio buffer:', e);
        }
    }
    
    // No audio found - try to find any clip at position
    const clipInfo = findClipAtPositionFromTime(position);
    if (clipInfo) {
        scrubTargetClipId = clipInfo.clipId;
        scrubTargetDbKey = clipInfo.dbKey;
        
        try {
            const audioBuffer = await getTimelineClipAudioBuffer(scrubTargetClipId, scrubTargetDbKey);
            if (audioBuffer) {
                audioScrubber.loadBuffer(audioBuffer);
                audioScrubber.startScrub(position, { volume: 0.8, speed: 1 });
                isScrubActive = true;
                isScrubEnabled = true;
                return;
            }
        } catch (e) {
            console.warn('[AudioScrubbing] Could not load audio buffer:', e);
        }
    }
}

// Find clip info from time position (reverse lookup)
function findClipAtPositionFromTime(timePosition) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    for (const track of tracks) {
        if (track.type !== 'Audio') continue;
        if (!track.timelineClips || track.timelineClips.length === 0) continue;
        
        for (const clip of track.timelineClips) {
            const clipStart = clip.startTime || 0;
            const clipEnd = clipStart + (clip.duration || 4);
            
            if (timePosition >= clipStart && timePosition <= clipEnd) {
                return {
                    clipId: clip.id,
                    trackId: track.id,
                    dbKey: clip.dbKey
                };
            }
        }
    }
    
    return null;
}

// Stop scrubbing
function stopScrub() {
    if (audioScrubber) {
        audioScrubber.stopScrub();
    }
    isScrubActive = false;
    scrubTargetClipId = null;
    scrubTargetDbKey = null;
}

// Check if scrubbing is currently active
export function isAudioScrubActive() {
    return isScrubActive;
}

// Enable/disable scrub on drag
export function setScrubOnDragEnabled(enabled) {
    scrubOnDragEnabled = enabled;
}

// Check if scrub on drag is enabled
export function isScrubOnDragEnabled() {
    return scrubOnDragEnabled;
}

// Open scrub settings panel
export function openScrubSettingsPanel() {
    const existingPanel = document.getElementById('scrub-settings-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'scrub-settings-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid #555;
        border-radius: 8px;
        padding: 12px 16px;
        color: #eee;
        font-family: system-ui, sans-serif;
        font-size: 12px;
        z-index: 1000;
        min-width: 180px;
    `;
    
    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Audio Scrubbing</div>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="scrub-on-drag-toggle" ${scrubOnDragEnabled ? 'checked' : ''}>
            <span>Scrub audio on timeline drag</span>
        </label>
        <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
            <span style="color: #888;">Volume:</span>
            <input type="range" id="scrub-volume-slider" min="0" max="100" value="80" style="width: 80px;">
            <span id="scrub-volume-display" style="width: 30px;">80%</span>
        </div>
        <div style="margin-top: 8px; color: #888; font-size: 10px;">
            Tip: Hold Shift while dragging for slower scrub
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Wire up controls
    document.getElementById('scrub-on-drag-toggle').addEventListener('change', (e) => {
        setScrubOnDragEnabled(e.target.checked);
    });
    
    document.getElementById('scrub-volume-slider').addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        document.getElementById('scrub-volume-display').textContent = e.target.value + '%';
        if (audioScrubber) {
            audioScrubber.setVolume(volume);
        }
    });
}

// Window alias for menu access
window.openScrubSettingsPanel = openScrubSettingsPanel;
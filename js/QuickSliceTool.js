// js/QuickSliceTool.js - Quick Slice Tool for Snug/OS DAW
// Press 'S' key to split selected clip at current playhead position

let localAppServices = {};
let sliceShortcutEnabled = true;

export function initQuickSliceTool(appServices) {
    localAppServices = appServices || {};
    document.addEventListener('keydown', handleQuickSliceKeydown);
    console.log('[QuickSliceTool] Initialized - press Shift+S to slice clip at playhead');
}

function handleQuickSliceKeydown(event) {
    if (!sliceShortcutEnabled) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;
    
    // Shift+S to slice
    if (event.key === 'S' && event.shiftKey) {
        event.preventDefault();
        sliceSelectedClipAtPlayhead();
    }
}

function sliceSelectedClipAtPlayhead() {
    const selectedClipIds = localAppServices.getSelectedClipIds?.();
    if (!selectedClipIds || selectedClipIds.length === 0) {
        localAppServices.showNotification?.('No clip selected', 1500);
        return;
    }
    
    const clipId = selectedClipIds[0];
    const track = findTrackWithClip(clipId);
    if (!track) {
        localAppServices.showNotification?.('Clip track not found', 1500);
        return;
    }
    
    // Get playhead position
    const playheadTime = getPlayheadTime();
    
    // Get clip start time
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        localAppServices.showNotification?.('Clip not found', 1500);
        return;
    }
    
    const clipStart = clip.start;
    const clipEnd = clipStart + (clip.duration || 0);
    
    // Check if playhead is within clip range
    if (playheadTime <= clipStart || playheadTime >= clipEnd) {
        localAppServices.showNotification?.('Playhead must be within clip', 1500);
        return;
    }
    
    // Perform the slice
    if (typeof track.splitClipAtPlayhead === 'function') {
        track.splitClipAtPlayhead(clipId, playheadTime);
        localAppServices.showNotification?.(`Sliced clip at ${playheadTime.toFixed(2)}s`, 1500);
        
        // Update UI
        if (localAppServices.renderTimeline) {
            localAppServices.renderTimeline();
        }
    } else {
        // Fallback: use splitClipAtTime if available
        if (typeof track.splitClipAtTime === 'function') {
            track.splitClipAtTime(clipId, playheadTime);
            localAppServices.showNotification?.(`Sliced clip at ${playheadTime.toFixed(2)}s`, 1500);
            
            if (localAppServices.renderTimeline) {
                localAppServices.renderTimeline();
            }
        } else {
            localAppServices.showNotification?.('Slice not available for this track type', 1500);
        }
    }
}

function getPlayheadTime() {
    // Try to get playhead position from various sources
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        return Tone.Transport.seconds;
    }
    if (typeof getCurrentTimelinePosition === 'function') {
        return getCurrentTimelinePosition();
    }
    return 0;
}

function findTrackWithClip(clipId) {
    const tracks = localAppServices.getTracks?.() || [];
    for (const track of tracks) {
        if (track.timelineClips?.some(c => c.id === clipId)) {
            return track;
        }
    }
    return null;
}

export function setQuickSliceEnabled(enabled) {
    sliceShortcutEnabled = !!enabled;
}

export function isQuickSliceEnabled() {
    return sliceShortcutEnabled;
}

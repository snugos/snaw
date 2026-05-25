// js/MuteSelectedTracks.js - Mute Selected Tracks Feature
// Press M to mute/unmute all currently selected tracks

let localAppServices = {};
let isInitialized = false;

/**
 * Initialize the Mute Selected Tracks feature
 * @param {object} appServices - The main appServices object from main.js
 */
export function initMuteSelectedTracks(appServices) {
    localAppServices = appServices || {};
    
    // Register keyboard shortcut handler
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', handleMuteSelectedKeydown);
    }
    
    isInitialized = true;
    console.log('[MuteSelectedTracks] Initialized - M key to mute/unmute selected tracks');
}

/**
 * Handle keydown for M shortcut
 */
function handleMuteSelectedKeydown(event) {
    // Ignore if typing in an input field
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.tagName === 'SELECT' ||
        event.target.isContentEditable) {
        return;
    }
    
    // M key - mute/unmute selected tracks
    if (event.key === 'm' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleMuteSelectedTracks();
    }
}

/**
 * Toggle mute state for all selected tracks
 */
export function toggleMuteSelectedTracks() {
    const getSelectedClipIds = localAppServices.getSelectedClipIds;
    const getTracks = localAppServices.getTracks;
    const showNotification = localAppServices.showNotification;
    const captureStateForUndo = localAppServices.captureStateForUndo;
    const renderTimeline = localAppServices.renderTimeline;
    
    if (!getSelectedClipIds || !getTracks) {
        console.warn('[MuteSelectedTracks] Required appServices not available');
        return;
    }
    
    const selectedClipIds = getSelectedClipIds();
    const tracks = getTracks();
    
    // Find tracks that have selected clips
    const tracksWithSelectedClips = new Set();
    tracks.forEach(track => {
        if (track.timelineClips) {
            const hasSelected = track.timelineClips.some(clip => selectedClipIds.includes(clip.id));
            if (hasSelected) {
                tracksWithSelectedClips.add(track.id);
            }
        }
    });
    
    if (tracksWithSelectedClips.size === 0) {
        // No clips selected - toggle mute for all tracks or current track
        const currentTrackId = localAppServices.getActiveSequencerTrackId ? 
            localAppServices.getActiveSequencerTrackId() : null;
        
        if (currentTrackId) {
            const track = tracks.find(t => t.id === currentTrackId);
            if (track && typeof track.setMuted === 'function') {
                captureStateForUndo?.('Toggle track mute');
                const newMuteState = !track.isMuted;
                track.setMuted(newMuteState);
                
                if (showNotification) {
                    showNotification(`${track.name} ${newMuteState ? 'muted' : 'unmuted'}`, 1500);
                }
                
                renderTimeline?.();
            }
        } else {
            if (showNotification) {
                showNotification('Select clips or a track first', 1500);
            }
        }
        return;
    }
    
    // Find majority mute state to toggle to
    let mutedCount = 0;
    let unmutedCount = 0;
    
    tracksWithSelectedClips.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            if (track.isMuted) mutedCount++;
            else unmutedCount++;
        }
    });
    
    // Toggle to the state that has fewer tracks (toggle minority)
    const targetMutedState = mutedCount > unmutedCount ? false : true;
    
    captureStateForUndo?.('Toggle mute on selected tracks');
    
    let toggledCount = 0;
    tracksWithSelectedClips.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && typeof track.setMuted === 'function') {
            if (track.isMuted !== targetMutedState) {
                track.setMuted(targetMutedState);
                toggledCount++;
            }
        }
    });
    
    if (showNotification) {
        if (toggledCount > 0) {
            showNotification(`${targetMutedState ? 'Muted' : 'Unmuted'} ${toggledCount} track(s)`, 1500);
        } else {
            showNotification('Selected tracks already in target state', 1500);
        }
    }
    
    renderTimeline?.();
}

/**
 * Mute all selected tracks (force mute)
 */
export function muteSelectedTracks() {
    const getSelectedClipIds = localAppServices.getSelectedClipIds;
    const getTracks = localAppServices.getTracks;
    
    if (!getSelectedClipIds || !getTracks) return;
    
    const selectedClipIds = getSelectedClipIds();
    const tracks = getTracks();
    
    tracks.forEach(track => {
        if (track.timelineClips) {
            const hasSelected = track.timelineClips.some(clip => selectedClipIds.includes(clip.id));
            if (hasSelected && typeof track.setMuted === 'function') {
                track.setMuted(true);
            }
        }
    });
}

/**
 * Unmute all selected tracks (force unmute)
 */
export function unmuteSelectedTracks() {
    const getSelectedClipIds = localAppServices.getSelectedClipIds;
    const getTracks = localAppServices.getTracks;
    
    if (!getSelectedClipIds || !getTracks) return;
    
    const selectedClipIds = getSelectedClipIds();
    const tracks = getTracks();
    
    tracks.forEach(track => {
        if (track.timelineClips) {
            const hasSelected = track.timelineClips.some(clip => selectedClipIds.includes(clip.id));
            if (hasSelected && typeof track.setMuted === 'function') {
                track.setMuted(false);
            }
        }
    });
}
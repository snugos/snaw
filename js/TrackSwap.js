// js/TrackSwap.js - Swap positions of two tracks instantly
// Right-click two track headers to swap their positions

let localAppServices = {};
let selectedTrackForSwap = null;

/**
 * Initialize the Track Swap module
 * @param {Object} services - App services from main.js
 */
export function initTrackSwap(services) {
    localAppServices = services;
    
    // Listen for right-click on track headers
    document.addEventListener('contextmenu', handleTrackSwapContextMenu);
    
    console.log('[TrackSwap] Initialized - right-click two tracks to swap');
}

/**
 * Handle right-click context menu for track swap
 * @param {MouseEvent} e
 */
function handleTrackSwapContextMenu(e) {
    const trackHeader = e.target.closest('.track-header, [data-track-id]');
    
    if (!trackHeader) return;
    
    const trackId = parseInt(trackHeader.dataset.trackId, 10);
    if (isNaN(trackId)) return;
    
    // Check if this is a swap action (Ctrl+Right-click or Shift+Right-click)
    const isSwapTrigger = e.ctrlKey || e.shiftKey;
    
    if (isSwapTrigger && selectedTrackForSwap !== null && selectedTrackForSwap !== trackId) {
        e.preventDefault();
        swapTwoTracks(selectedTrackForSwap, trackId);
        selectedTrackForSwap = null;
        clearSwapSelectionUI();
    } else {
        // Just set up for potential swap
        selectedTrackForSwap = trackId;
        showSwapIndicator(trackId);
        
        // Clear after 3 seconds if no second track selected
        setTimeout(() => {
            if (selectedTrackForSwap === trackId) {
                selectedTrackForSwap = null;
                clearSwapSelectionUI();
            }
        }, 3000);
    }
}

/**
 * Show swap indicator on track header
 * @param {number} trackId
 */
function showSwapIndicator(trackId) {
    const trackEl = document.querySelector(`[data-track-id="${trackId}"]`);
    if (trackEl) {
        trackEl.style.boxShadow = '0 0 0 2px #a855f7';
        trackEl.title = 'Track selected for swap - Ctrl+Right-click another track to swap';
        
        // Show notification
        localAppServices.showNotification?.('Swap: Right-click another track with Ctrl key', 2000);
    }
}

/**
 * Clear swap selection UI
 */
function clearSwapSelectionUI() {
    document.querySelectorAll('[data-track-id]').forEach(el => {
        el.style.boxShadow = '';
        el.title = '';
    });
}

/**
 * Swap two tracks by their IDs
 * @param {number} trackId1 - First track ID
 * @param {number} trackId2 - Second track ID
 */
export function swapTwoTracks(trackId1, trackId2) {
    if (trackId1 === trackId2) return;
    
    const tracks = localAppServices.getTracksState?.();
    if (!tracks) {
        console.warn('[TrackSwap] Tracks state not available');
        return;
    }
    
    const index1 = tracks.findIndex(t => t.id === trackId1);
    const index2 = tracks.findIndex(t => t.id === trackId2);
    
    if (index1 === -1 || index2 === -1) {
        console.warn('[TrackSwap] One or both tracks not found');
        return;
    }
    
    // Swap in the array
    const temp = tracks[index1];
    tracks[index1] = tracks[index2];
    tracks[index2] = temp;
    
    console.log(`[TrackSwap] Swapped track ${trackId1} (index ${index1}) with track ${trackId2} (index ${index2})`);
    
    // Capture undo state
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Swap track positions');
    }
    
    // Update UI
    if (localAppServices.renderTracks) {
        localAppServices.renderTracks();
    }
    if (localAppServices.saveState) {
        localAppServices.saveState();
    }
    
    // Get track names for notification
    const track1Name = tracks[index1]?.name || `Track ${trackId1}`;
    const track2Name = tracks[index2]?.name || `Track ${trackId2}`;
    
    localAppServices.showNotification?.(`Swapped: ${track1Name} ↔ ${track2Name}`, 2000);
}

/**
 * Clear track swap selection
 */
export function clearTrackSwapSelection() {
    selectedTrackForSwap = null;
    clearSwapSelectionUI();
}
/**
 * js/ClipSelectionManager.js - Timeline Clip Multi-Select System
 * Provides Shift+Click multi-select and Delete key support for timeline clips
 */

let selectedClipIds = new Set(); // Set of clip ID strings
let lastSelectedClipId = null; // For Shift+Click range selection
let appServicesRef = null;

/**
 * Initialize the clip selection manager with app services reference
 * @param {object} appServices - The main appServices object from main.js
 */
export function initClipSelectionManager(appServices) {
    appServicesRef = appServices;
    
    // Register our functions in appServices
    appServices.getSelectedClipIds = getSelectedClipIds;
    appServices.setSelectedClipIds = setSelectedClipIds;
    appServices.clearClipSelections = clearClipSelections;
    appServices.addClipToSelection = addClipToSelection;
    appServices.removeClipFromSelection = removeClipFromSelection;
    appServices.toggleClipSelection = toggleClipSelection;
    appServices.isClipSelected = isClipSelected;
    
    // Initialize DOM click handlers
    initClipClickHandlers();
    
    console.log('[ClipSelectionManager] Initialized - Shift+Click multi-select enabled');
}

/**
 * Get the current selected clip IDs as a Set
 * @returns {Set} Set of clip ID strings
 */
export function getSelectedClipIds() {
    return selectedClipIds;
}

/**
 * Set selected clip IDs
 * @param {Array|Set} clipIds - Array or Set of clip ID strings
 */
export function setSelectedClipIds(clipIds) {
    clearClipSelections();
    if (Array.isArray(clipIds)) {
        clipIds.forEach(id => selectedClipIds.add(String(id)));
    } else if (clipIds instanceof Set) {
        clipIds.forEach(id => selectedClipIds.add(String(id)));
    }
    updateClipDOMSelection();
    console.log(`[ClipSelectionManager] Set ${selectedClipIds.size} clip(s) selected`);
}

/**
 * Clear all selected clip IDs
 */
export function clearClipSelections() {
    const count = selectedClipIds.size;
    selectedClipIds.clear();
    lastSelectedClipId = null;
    updateClipDOMSelection();
    if (count > 0) {
        console.log(`[ClipSelectionManager] Cleared ${count} clip selection(s)`);
    }
}

/**
 * Add a clip to selection
 * @param {string} clipId - Clip ID string
 */
export function addClipToSelection(clipId) {
    selectedClipIds.add(String(clipId));
    updateClipDOMSelection();
}

/**
 * Remove a clip from selection
 * @param {string} clipId - Clip ID string
 */
export function removeClipFromSelection(clipId) {
    selectedClipIds.delete(String(clipId));
    updateClipDOMSelection();
}

/**
 * Toggle clip selection
 * @param {string} clipId - Clip ID string
 */
export function toggleClipSelection(clipId) {
    const id = String(clipId);
    if (selectedClipIds.has(id)) {
        selectedClipIds.delete(id);
    } else {
        selectedClipIds.add(id);
    }
    updateClipDOMSelection();
}

/**
 * Check if a clip is selected
 * @param {string} clipId - Clip ID string
 * @returns {boolean}
 */
export function isClipSelected(clipId) {
    return selectedClipIds.has(String(clipId));
}

/**
 * Initialize click handlers on timeline clips using event delegation
 */
function initClipClickHandlers() {
    // Wait for DOM to be ready, then set up event delegation
    if (typeof document !== 'undefined') {
        document.addEventListener('click', handleClipClick, true);
        console.log('[ClipSelectionManager] Click handlers registered via delegation');
    }
}

/**
 * Handle click on timeline clips
 * @param {MouseEvent} event
 */
function handleClipClick(event) {
    const clipEl = event.target.closest('.timeline-clip');
    if (!clipEl) return;
    
    const clipId = clipEl.dataset.clipId;
    const trackId = clipEl.dataset.trackId;
    if (!clipId) return;
    
    // Determine selection mode
    const isShiftClick = event.shiftKey;
    const isCtrlClick = event.ctrlKey || event.metaKey;
    
    if (isShiftClick && lastSelectedClipId) {
        // Shift+Click: Range selection
        performRangeSelection(clipId);
    } else if (isCtrlClick) {
        // Ctrl/Cmd+Click: Toggle individual clip
        toggleClipSelection(clipId);
        lastSelectedClipId = clipId;
    } else {
        // Regular click: Clear and select only this clip
        clearClipSelections();
        addClipToSelection(clipId);
        lastSelectedClipId = clipId;
    }
    
    updateClipDOMSelection();
    
    // Trigger UI update if needed
    if (appServicesRef?.showNotification && selectedClipIds.size > 0) {
        // Only show notification on first selection, not every click
    }
}

/**
 * Perform range selection between last selected and current clip
 * @param {string} targetClipId - The clip to select up to
 */
function performRangeSelection(targetClipId) {
    // Get all clips in timeline order from DOM
    const allClips = Array.from(document.querySelectorAll('.timeline-clip'));
    
    // Find the range between lastSelectedClipId and targetClipId
    const lastIdx = allClips.findIndex(el => el.dataset.clipId === lastSelectedClipId);
    const targetIdx = allClips.findIndex(el => el.dataset.clipId === targetClipId);
    
    if (lastIdx === -1 || targetIdx === -1) {
        // Fallback: just add the target clip
        addClipToSelection(targetClipId);
        return;
    }
    
    const start = Math.min(lastIdx, targetIdx);
    const end = Math.max(lastIdx, targetIdx);
    
    // Add all clips in the range
    for (let i = start; i <= end; i++) {
        const clipId = allClips[i].dataset.clipId;
        if (clipId) {
            addClipToSelection(clipId);
        }
    }
}

/**
 * Update the DOM to reflect current selection state
 */
function updateClipDOMSelection() {
    if (typeof document === 'undefined') return;
    
    // Remove .selected class from all clips first
    document.querySelectorAll('.timeline-clip.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add .selected class to currently selected clips
    selectedClipIds.forEach(clipId => {
        const el = document.querySelector(`.timeline-clip[data-clip-id="${clipId}"]`);
        if (el) {
            el.classList.add('selected');
        }
    });
}

// Export for external use
export function getSelectionCount() {
    return selectedClipIds.size;
}

export function getSelectionAsArray() {
    return Array.from(selectedClipIds);
}
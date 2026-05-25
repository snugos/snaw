/**
 * js/TrackRenameHotkey.js - Track Rename Hotkey (F2)
 * Press F2 to rename the selected track inline
 */

let localAppServices = {};
let renameInput = null;
let renameOriginalName = null;

/**
 * Initialize the Track Rename Hotkey module
 * @param {Object} services - App services from main.js
 */
export function initTrackRenameHotkey(services) {
    localAppServices = services || {};
    console.log('[TrackRenameHotkey] Initialized');
}

/**
 * Get the currently selected track
 * @returns {Object|null} Selected track or null
 */
function getSelectedTrack() {
    if (typeof localAppServices.getSelectedTrack === 'function') {
        return localAppServices.getSelectedTrack();
    }
    
    // Fallback: try to get track from UI state
    const selectedTrackId = localAppServices.getSelectedTrackId?.();
    if (selectedTrackId != null) {
        const tracks = localAppServices.getTracksState?.() || [];
        return tracks.find(t => t.id === selectedTrackId) || null;
    }
    
    // Fallback: get first track
    const tracks = localAppServices.getTracksState?.() || [];
    if (tracks.length > 0) {
        return tracks[0];
    }
    
    return null;
}

/**
 * Get the track name element in the UI for a track
 * @param {Object} track - Track object
 * @returns {HTMLElement|null} Track name element or null
 */
function getTrackNameElement(track) {
    if (!track) return null;
    
    // Try different selectors for track name elements
    const selectors = [
        `.track-strip[data-track-id="${track.id}"] .text-xs.font-medium.text-white`,
        `.track-lane[data-track-id="${track.id}"] .track-name`,
        `[data-track-id="${track.id}"] .track-name`,
        `.track-list-item[data-track-id="${track.id}"] .track-name-label`,
    ];
    
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    
    // Try to find by text content matching track name
    const allEls = document.querySelectorAll('.text-xs.font-medium.text-white, .track-name-label, .track-name');
    for (const el of allEls) {
        if (el.textContent.trim() === track.name) {
            return el;
        }
    }
    
    return null;
}

/**
 * Start inline rename for a track
 * @param {Object} track - Track to rename
 */
function startInlineRename(track) {
    if (!track) return;
    
    // Cancel any existing rename
    cancelRename();
    
    const nameEl = getTrackNameElement(track);
    if (!nameEl) {
        console.log('[TrackRenameHotkey] Could not find track name element in UI');
        return;
    }
    
    renameOriginalName = track.name;
    
    // Create input element
    renameInput = document.createElement('input');
    renameInput.type = 'text';
    renameInput.value = track.name;
    renameInput.className = 'track-rename-input inline-block px-1 py-0.5 text-xs font-medium bg-white dark:bg-slate-600 text-black dark:text-white border border-blue-500 rounded outline-none';
    renameInput.style.maxWidth = '150px';
    
    // Replace name element with input
    const rect = nameEl.getBoundingClientRect();
    nameEl.style.display = 'none';
    nameEl.parentNode.insertBefore(renameInput, nameEl);
    renameInput.focus();
    renameInput.select();
    
    // Event handlers
    renameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyRename(track);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRename();
        }
    });
    
    renameInput.addEventListener('blur', () => {
        applyRename(track);
    });
    
    renameInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

/**
 * Apply the rename
 * @param {Object} track - Track to rename
 */
function applyRename(track) {
    if (!renameInput || !track) return;
    
    const newName = renameInput.value.trim();
    
    if (newName && newName !== renameOriginalName) {
        // Apply rename to track object
        track.name = newName;
        
        // Update UI
        if (localAppServices.renderTimeline) {
            localAppServices.renderTimeline();
        }
        if (localAppServices.updateTrackHeaders) {
            localAppServices.updateTrackHeaders();
        }
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Renamed track to "${newName}"`, 1500);
        }
        
        console.log(`[TrackRenameHotkey] Renamed track to "${newName}"`);
    }
    
    cleanupRenameUI();
}

/**
 * Cancel the rename operation
 */
function cancelRename() {
    if (!renameInput) return;
    
    // Restore original name element
    const nameEl = document.querySelector('.track-rename-input + .text-xs.font-medium.text-white, .track-rename-input + .track-name');
    if (nameEl) {
        nameEl.style.display = '';
    }
    
    cleanupRenameUI();
}

/**
 * Clean up rename UI elements
 */
function cleanupRenameUI() {
    if (renameInput) {
        const parent = renameInput.parentNode;
        if (parent) {
            // Find and show the original name element
            const nameEls = parent.querySelectorAll('.text-xs.font-medium.text-white, .track-name-label, .track-name');
            for (const el of nameEls) {
                if (el.textContent.trim() === renameOriginalName || el.textContent.trim() === renameInput.value) {
                    el.style.display = '';
                    break;
                }
            }
        }
        renameInput.remove();
        renameInput = null;
    }
    renameOriginalName = null;
}

/**
 * Handle F2 key press for track rename
 */
export function handleTrackRenameKey() {
    const track = getSelectedTrack();
    if (track) {
        startInlineRename(track);
    } else {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('No track selected to rename', 1500);
        }
    }
}
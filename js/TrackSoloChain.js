/**
 * js/TrackSoloChain.js - Track Solo Chain feature
 * Mute all tracks except a selected chain of tracks for focused listening
 */

let localAppServices = {};
let soloChainMode = false;
let soloChainTracks = new Set();

/**
 * Initialize the Track Solo Chain module
 * @param {Object} appServices - App services from main.js
 */
export function initTrackSoloChain(appServices) {
    localAppServices = appServices || {};
    console.log('[TrackSoloChain] Module initialized');
}

/**
 * Check if solo chain mode is active
 * @returns {boolean}
 */
export function getIsActive() {
    return soloChainMode;
}

/**
 * Get the set of solo chain track IDs
 * @returns {string[]} Array of track IDs
 */
export function getSoloedTrackIds() {
    return Array.from(soloChainTracks);
}

/**
 * Enable solo chain mode
 */
export function enableSoloChain() {
    if (soloChainTracks.size === 0) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Select tracks to add to chain first', 'warning');
        }
        return;
    }
    soloChainMode = true;
    applySoloChain();
    updateSoloChainUI();
    updateTrackMuteStates();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Solo Chain enabled with ${soloChainTracks.size} track(s)`, 'info');
    }
}

/**
 * Disable solo chain mode
 */
export function disableSoloChain() {
    soloChainMode = false;
    applySoloChain();
    updateSoloChainUI();
    updateTrackMuteStates();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification('Solo Chain disabled', 'info');
    }
}

/**
 * Toggle a track in the solo chain
 * @param {string} trackId - Track ID to toggle
 */
export function toggleTrackInChain(trackId) {
    if (soloChainTracks.has(trackId)) {
        soloChainTracks.delete(trackId);
    } else {
        soloChainTracks.add(trackId);
    }
    
    if (soloChainTracks.size === 0) {
        soloChainMode = false;
    }
    
    applySoloChain();
    updateSoloChainUI();
    updateTrackMuteStates();
}

/**
 * Clear all tracks from solo chain
 */
export function clearChain() {
    soloChainTracks.clear();
    soloChainMode = false;
    applySoloChain();
    updateSoloChainUI();
    updateTrackMuteStates();
}

/**
 * Apply solo chain to all tracks (mute non-chain tracks)
 */
function applySoloChain() {
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    tracks.forEach(track => {
        if (!track || !track.id) return;
        
        if (soloChainMode && soloChainTracks.size > 0) {
            // Save original mute state before muting
            if (track._originalMuteState === undefined) {
                track._originalMuteState = track.isMuted || false;
            }
            // Mute all tracks not in the chain
            if (!soloChainTracks.has(track.id)) {
                track.isMuted = true;
            } else {
                track.isMuted = false; // Keep chain tracks unmuted
            }
        } else {
            // Restore original mute state
            if (track._originalMuteState !== undefined) {
                track.isMuted = track._originalMuteState;
                delete track._originalMuteState;
            }
        }
    });
}

/**
 * Update track mute states based on solo chain
 */
function updateTrackMuteStates() {
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    // Update track UI
    if (localAppServices.updateTrackUI) {
        tracks.forEach(track => {
            if (track && track.id) {
                localAppServices.updateTrackUI(track.id, 'soloChainMute');
            }
        });
    }
    
    // Re-render timeline if available
    if (localAppServices.renderTimeline && typeof localAppServices.renderTimeline === 'function') {
        localAppServices.renderTimeline();
    }
}

/**
 * Update the solo chain UI elements
 */
function updateSoloChainUI() {
    const indicator = localAppServices.uiElementsCache?.soloChainIndicator;
    if (indicator) {
        if (soloChainMode && soloChainTracks.size > 0) {
            indicator.classList.add('active');
            indicator.textContent = `Solo Chain (${soloChainTracks.size})`;
        } else {
            indicator.classList.remove('active');
            indicator.textContent = 'Solo Chain';
        }
    }
    
    // Update track mute buttons
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    tracks.forEach(track => {
        if (!track || !track.id) return;
        const muteBtn = document.querySelector(`[data-track-mute="${track.id}"]`);
        if (muteBtn) {
            muteBtn.classList.toggle('solo-chain-muted', soloChainMode && !soloChainTracks.has(track.id));
        }
    });
}

/**
 * Open the Solo Chain panel
 */
export function openSoloChainPanel() {
    const existingPanel = document.getElementById('soloChainPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'soloChainPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e1e2e;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 20px;
        min-width: 350px;
        max-height: 70vh;
        overflow-y: auto;
        z-index: 10000;
        color: #e0e0e0;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Track Solo Chain</h3>
            <button id="soloChainCloseBtn" style="
                background: none;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            ">&times;</button>
        </div>
        
        <div style="margin-bottom: 15px; padding: 10px; background: #2a2a3a; border-radius: 6px;">
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #aaa;">
                Mute all tracks except selected ones for focused listening.
            </p>
            <div style="display: flex; gap: 10px;">
                <button id="soloChainEnableBtn" style="
                    flex: 1;
                    padding: 8px 12px;
                    background: ${soloChainMode ? '#22c55e' : '#3b82f6'};
                    border: none;
                    border-radius: 4px;
                    color: white;
                    font-size: 13px;
                    cursor: pointer;
                ">${soloChainMode ? 'Disable Solo Chain' : 'Enable Solo Chain'}</button>
                <button id="soloChainClearBtn" style="
                    flex: 1;
                    padding: 8px 12px;
                    background: #666;
                    border: none;
                    border-radius: 4px;
                    color: white;
                    font-size: 13px;
                    cursor: pointer;
                ">Clear All</button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: ${soloChainTracks.size > 0 ? '#22c55e' : '#888'};">
                ${soloChainTracks.size > 0 ? `${soloChainTracks.size} track(s) in chain` : 'No tracks selected'}
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${tracks.length === 0 ? '<div style="color: #666; text-align: center; padding: 20px;">No tracks available</div>' : ''}
            ${tracks.map(track => `
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    background: ${soloChainTracks.has(track.id) ? '#1a3a2a' : '#2a2a3a'};
                    border-radius: 6px;
                    border: 1px solid ${soloChainTracks.has(track.id) ? '#22c55e44' : 'transparent'};
                    cursor: pointer;
                " data-solo-chain-track="${track.id}">
                    <div style="
                        width: 20px;
                        height: 20px;
                        border-radius: 4px;
                        background: ${soloChainTracks.has(track.id) ? '#22c55e' : '#444'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        color: white;
                    ">${soloChainTracks.has(track.id) ? '✓' : ''}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500;">${track.name || 'Untitled Track'}</div>
                        <div style="font-size: 11px; color: #888;">${track.type || 'Audio'}</div>
                    </div>
                    <div style="
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        background: ${track.color || '#666'};
                        color: white;
                    ">${track.color || 'none'}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    panel.querySelector('#soloChainCloseBtn').addEventListener('click', () => panel.remove());
    
    panel.querySelector('#soloChainEnableBtn').addEventListener('click', () => {
        if (soloChainMode) {
            disableSoloChain();
        } else {
            enableSoloChain();
        }
        openSoloChainPanel(); // Refresh
    });
    
    panel.querySelector('#soloChainClearBtn').addEventListener('click', () => {
        clearChain();
        openSoloChainPanel(); // Refresh
    });
    
    // Track selection
    panel.querySelectorAll('[data-solo-chain-track]').forEach(item => {
        item.addEventListener('click', () => {
            const trackId = item.getAttribute('data-solo-chain-track');
            toggleTrackInChain(trackId);
            openSoloChainPanel(); // Refresh
        });
    });
    
    // Close on outside click
    panel.addEventListener('click', (e) => {
        if (e.target === panel) {
            panel.remove();
        }
    });
}

/**
 * Close the Solo Chain panel
 */
export function closeSoloChainPanel() {
    const existingPanel = document.getElementById('soloChainPanel');
    if (existingPanel) {
        existingPanel.remove();
    }
}

// Expose for global access
window.openSoloChainPanel = openSoloChainPanel;
window.closeSoloChainPanel = closeSoloChainPanel;

/**
 * Track Solo Automation - Draw solo/unsolo automation on tracks
 * Allows tracks to automatically unsolo during certain sections for conditional listening
 */

let localAppServices = {};
let soloAutomationPanel = null;

/**
 * Initialize Track Solo Automation module
 * @param {Object} services - App services from main.js
 */
export function initTrackSoloAutomation(services) {
    localAppServices = services || {};
    
    // Listen for track selection changes to show/hide solo automation
    document.addEventListener('trackSelected', onTrackSelected);
    
    // Listen for playback position updates to apply solo automation
    if (typeof Tone !== 'undefined') {
        Tone.Transport.scheduleRepeat(checkSoloAutomation, '8n');
    }
    
    console.log('[TrackSoloAutomation] Initialized');
}

/**
 * Handle track selection
 */
function onTrackSelected(e) {
    const trackId = e.detail?.trackId;
    if (!trackId) return;
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    // If track has solo automation points, show indicator
    if (track.soloAutomation && track.soloAutomation.length > 0) {
        showSoloAutomationIndicator(trackId);
    }
}

/**
 * Check and apply solo automation at current playback position
 */
function checkSoloAutomation() {
    if (typeof Tone === 'undefined' || !Tone.Transport) return;
    
    const currentTime = Tone.Transport.seconds;
    const tracks = localAppServices.getTracks?.() || [];
    
    tracks.forEach(track => {
        if (!track.soloAutomation || track.soloAutomation.length === 0) return;
        
        // Find the current automation state
        let shouldBeSoloed = track.isSoloed; // Default to current state
        
        for (const point of track.soloAutomation) {
            if (point.time <= currentTime) {
                shouldBeSoloed = point.value;
            }
        }
        
        // Apply the solo state if different
        if (track.isSoloed !== shouldBeSoloed) {
            if (shouldBeSoloed) {
                soloTrack(track.id);
            } else {
                unsoloTrack(track.id);
            }
        }
    });
}

/**
 * Solo a track
 */
function soloTrack(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    // Check if already soloed
    if (track.isSoloed) return;
    
    // Unsolo any other track first (exclusive solo)
    const tracks = localAppServices.getTracks?.() || [];
    tracks.forEach(t => {
        if (t.isSoloed && t.id !== trackId) {
            t.isSoloed = false;
            localAppServices.updateTrackUI?.(t.id, 'soloChanged');
        }
    });
    
    track.isSoloed = true;
    track.soloLocked = true; // Lock so automation doesn't toggle it back immediately
    
    localAppServices.updateTrackUI?.(trackId, 'soloChanged');
    
    console.log(`[TrackSoloAutomation] Soloed track ${trackId}`);
}

/**
 * Unsolo a track
 */
function unsoloTrack(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    if (!track.isSoloed) return;
    
    track.isSoloed = false;
    track.soloLocked = false;
    
    localAppServices.updateTrackUI?.(trackId, 'soloChanged');
    
    console.log(`[TrackSoloAutomation] Unsoloed track ${trackId}`);
}

/**
 * Show solo automation indicator on track header
 */
function showSoloAutomationIndicator(trackId) {
    const trackHeader = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
    if (!trackHeader) return;
    
    const indicator = trackHeader.querySelector('.solo-automation-indicator');
    if (indicator) return; // Already showing
    
    const div = document.createElement('div');
    div.className = 'solo-automation-indicator';
    div.title = 'Track has solo automation';
    div.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 8px;
        height: 8px;
        background: #f59e0b;
        border-radius: 50%;
        box-shadow: 0 0 4px #f59e0b;
    `;
    
    trackHeader.style.position = 'relative';
    trackHeader.appendChild(div);
}

/**
 * Add solo automation point to a track
 * @param {number} trackId - Track ID
 * @param {number} time - Time in seconds
 * @param {boolean} value - Solo state (true = soloed, false = unsoloed)
 */
export function addSoloAutomationPoint(trackId, time, value) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[TrackSoloAutomation] Track not found:', trackId);
        return false;
    }
    
    if (!track.soloAutomation) {
        track.soloAutomation = [];
    }
    
    // Remove existing point at same time
    track.soloAutomation = track.soloAutomation.filter(p => Math.abs(p.time - time) > 0.01);
    
    // Add new point
    track.soloAutomation.push({ time, value });
    track.soloAutomation.sort((a, b) => a.time - b.time);
    
    console.log(`[TrackSoloAutomation] Added point at ${time.toFixed(2)}s: ${value ? 'solo' : 'unsolo'}`);
    
    // Show indicator
    showSoloAutomationIndicator(trackId);
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Add solo automation on Track ${trackId}`);
    }
    
    return true;
}

/**
 * Remove solo automation point
 * @param {number} trackId - Track ID
 * @param {number} time - Time of point to remove
 */
export function removeSoloAutomationPoint(trackId, time) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track || !track.soloAutomation) return false;
    
    const initialLength = track.soloAutomation.length;
    track.soloAutomation = track.soloAutomation.filter(p => Math.abs(p.time - time) > 0.01);
    
    if (track.soloAutomation.length < initialLength) {
        console.log(`[TrackSoloAutomation] Removed point at ${time.toFixed(2)}s`);
        
        if (track.soloAutomation.length === 0) {
            hideSoloAutomationIndicator(trackId);
        }
        
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Remove solo automation on Track ${trackId}`);
        }
        return true;
    }
    return false;
}

/**
 * Clear all solo automation for a track
 * @param {number} trackId - Track ID
 */
export function clearSoloAutomation(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return false;
    
    track.soloAutomation = [];
    hideSoloAutomationIndicator(trackId);
    
    console.log(`[TrackSoloAutomation] Cleared solo automation for track ${trackId}`);
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Clear solo automation on Track ${trackId}`);
    }
    
    return true;
}

/**
 * Hide solo automation indicator
 */
function hideSoloAutomationIndicator(trackId) {
    const indicator = document.querySelector(`[data-track-id="${trackId}"] .solo-automation-indicator`);
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Get solo automation data for a track
 * @param {number} trackId - Track ID
 * @returns {Array} Array of {time, value} points
 */
export function getSoloAutomation(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return [];
    return track.soloAutomation || [];
}

/**
 * Open the solo automation panel for a track
 * @param {number} trackId - Track ID (optional, uses current track if not provided)
 */
export function openSoloAutomationPanel(trackId) {
    if (soloAutomationPanel) {
        soloAutomationPanel.remove();
        soloAutomationPanel = null;
    }
    
    const targetTrackId = trackId || localAppServices.getSelectedTrackId?.();
    if (!targetTrackId) {
        localAppServices.showNotification?.('No track selected', 'warning');
        return;
    }
    
    const track = localAppServices.getTrackById?.(targetTrackId);
    if (!track) {
        localAppServices.showNotification?.('Track not found', 'error');
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'soloAutomationPanel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        width: 340px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 12px 16px;
        background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
        border-bottom: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `
        <div>
            <h3 style="margin: 0; color: #fff; font-size: 14px;">Solo Automation</h3>
            <span style="color: #888; font-size: 11px;">Track: ${track.name}</span>
        </div>
        <button id="sap-close" style="
            background: transparent;
            border: none;
            color: #888;
            font-size: 20px;
            cursor: pointer;
        ">×</button>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'padding: 16px;';
    
    const points = track.soloAutomation || [];
    
    content.innerHTML = `
        <div style="margin-bottom: 12px;">
            <p style="color: #888; font-size: 11px; margin: 0 0 8px 0;">
                Click on the timeline to add solo/unsolo automation points.
                The track will automatically solo/unsolo during playback.
            </p>
        </div>
        
        <div style="margin-bottom: 12px;">
            <button id="sap-add-solo" style="
                width: 100%;
                padding: 8px;
                background: #f59e0b;
                border: none;
                border-radius: 4px;
                color: #000;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 6px;
            ">Add Solo Point at Playhead</button>
            
            <button id="sap-add-unsolo" style="
                width: 100%;
                padding: 8px;
                background: #6b7280;
                border: none;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
            ">Add Unsolo Point at Playhead</button>
        </div>
        
        <div style="border-top: 1px solid #333; padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #888; font-size: 11px;">Automation Points (${points.length})</span>
                <button id="sap-clear" style="
                    padding: 4px 8px;
                    background: #dc3545;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 10px;
                    cursor: pointer;
                ">Clear All</button>
            </div>
            
            <div id="sap-points-list" style="max-height: 200px; overflow-y: auto;">
                ${points.length === 0 ? '<div style="color: #555; font-size: 11px; text-align: center; padding: 16px;">No automation points</div>' : ''}
            </div>
        </div>
        
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #333;">
            <button id="sap-close-btn" style="
                width: 100%;
                padding: 8px;
                background: #333;
                border: none;
                border-radius: 4px;
                color: #888;
                font-size: 12px;
                cursor: pointer;
            ">Close</button>
        </div>
    `;
    
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
    soloAutomationPanel = panel;
    
    // Update points list
    updatePointsList(targetTrackId);
    
    // Event listeners
    document.getElementById('sap-close').onclick = closeSoloAutomationPanel;
    document.getElementById('sap-close-btn').onclick = closeSoloAutomationPanel;
    
    document.getElementById('sap-add-solo').onclick = () => {
        const time = typeof Tone !== 'undefined' ? Tone.Transport.seconds : 0;
        addSoloAutomationPoint(targetTrackId, time, true);
        updatePointsList(targetTrackId);
        localAppServices.showNotification?.('Solo point added', 'info');
    };
    
    document.getElementById('sap-add-unsolo').onclick = () => {
        const time = typeof Tone !== 'undefined' ? Tone.Transport.seconds : 0;
        addSoloAutomationPoint(targetTrackId, time, false);
        updatePointsList(targetTrackId);
        localAppServices.showNotification?.('Unsolo point added', 'info');
    };
    
    document.getElementById('sap-clear').onclick = () => {
        if (confirm('Clear all solo automation for this track?')) {
            clearSoloAutomation(targetTrackId);
            updatePointsList(targetTrackId);
            localAppServices.showNotification?.('Solo automation cleared', 'info');
        }
    };
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!panel.contains(e.target)) {
                closeSoloAutomationPanel();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

/**
 * Update the points list in the panel
 */
function updatePointsList(trackId) {
    const container = document.getElementById('sap-points-list');
    if (!container) return;
    
    const points = getSoloAutomation(trackId);
    
    if (points.length === 0) {
        container.innerHTML = '<div style="color: #555; font-size: 11px; text-align: center; padding: 16px;">No automation points</div>';
        return;
    }
    
    container.innerHTML = points.map((p, i) => `
        <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            background: #0f0f1a;
            border: 1px solid #333;
            border-radius: 4px;
            margin-bottom: 4px;
        ">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${p.value ? '#f59e0b' : '#6b7280'};
                "></span>
                <span style="color: #aaa; font-size: 11px;">${p.value ? 'SOLO' : 'UNSOLO'}</span>
                <span style="color: #888; font-size: 10px;">@ ${p.time.toFixed(2)}s</span>
            </div>
            <button data-index="${i}" data-time="${p.time}" class="sap-remove-point" style="
                padding: 2px 6px;
                background: #dc3545;
                border: none;
                border-radius: 3px;
                color: #fff;
                font-size: 9px;
                cursor: pointer;
            ">×</button>
        </div>
    `).join('');
    
    // Add remove handlers
    container.querySelectorAll('.sap-remove-point').forEach(btn => {
        btn.onclick = () => {
            const time = parseFloat(btn.dataset.time);
            removeSoloAutomationPoint(trackId, time);
            updatePointsList(trackId);
        };
    });
}

/**
 * Close the solo automation panel
 */
export function closeSoloAutomationPanel() {
    if (soloAutomationPanel) {
        soloAutomationPanel.remove();
        soloAutomationPanel = null;
    }
}

/**
 * Check if solo automation panel is open
 * @returns {boolean}
 */
export function isSoloAutomationPanelOpen() {
    return soloAutomationPanel !== null;
}
// js/TrackMuteAutomation.js - Track Mute Automation Integration
// Draw mute/unmute automation on tracks for conditional silencing
// Integrates MuteAutomation class with the main DAW appServices

import { MuteAutomation } from './MuteAutomation.js';

let localAppServices = {};
let muteAutomation = null;
let muteAutomationWindow = null;

/**
 * Initialize the Track Mute Automation module
 * @param {object} services - App services from main.js
 */
export function initTrackMuteAutomation(services) {
    localAppServices = services;
    
    // Get audio context from Tone.js
    const audioContext = getAudioContext();
    if (!audioContext) {
        console.warn('[TrackMuteAutomation] No audio context available');
        return;
    }
    
    // Initialize the mute automation engine
    muteAutomation = new MuteAutomation(audioContext, {
        resolution: 100,
        defaultTransition: 'instant',
        fadeTime: 0.01
    });
    
    // Add all existing tracks
    const tracks = localAppServices.getTracks?.() || [];
    for (const track of tracks) {
        addTrackToAutomation(track);
    }
    
    console.log('[TrackMuteAutomation] Initialized with', tracks.length, 'tracks');
    
    // Register keyboard shortcut (Alt+M)
    if (localAppServices.registerKeyBinding) {
        localAppServices.registerKeyBinding('Alt+M', toggleMuteAutomationPanel, 'Track Mute Automation');
    }
}

/**
 * Get the audio context from Tone.js
 * @returns {AudioContext|null}
 */
function getAudioContext() {
    if (typeof Tone !== 'undefined' && Tone.context) {
        return Tone.context.rawContext;
    }
    return null;
}

/**
 * Add a track to mute automation
 * @param {object} track - Track object
 */
function addTrackToAutomation(track) {
    if (!muteAutomation || !track) return;
    
    const trackDuration = localAppServices.getProjectDuration?.() || 60;
    muteAutomation.addTrack(track.id, {
        name: track.name || `Track ${track.id}`,
        duration: trackDuration
    });
    
    // Set gain node if available
    if (track.gainNode) {
        muteAutomation.setTrackGainNode(track.id, track.gainNode);
    }
}

/**
 * Toggle the mute automation panel visibility
 */
export function toggleMuteAutomationPanel() {
    if (muteAutomationWindow && muteAutomationWindow.element && !muteAutomationWindow.isMinimized) {
        muteAutomationWindow.close();
        muteAutomationWindow = null;
        return;
    }
    openTrackMuteAutomationPanel();
}

/**
 * Open the Track Mute Automation panel
 * @returns {object} Window object
 */
export function openTrackMuteAutomationPanel() {
    const windowId = 'trackMuteAutomation';
    
    // Check if window already exists
    const existingWin = localAppServices.getWindowByIdState?.(windowId);
    if (existingWin) {
        existingWin.restore();
        renderMuteAutomationContent();
        return existingWin;
    }
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackMuteAutomationContent';
    contentContainer.className = 'flex flex-col h-full bg-gray-900 text-white p-3';
    
    const options = {
        width: 550,
        height: 480,
        minWidth: 400,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow?.(windowId, 'Track Mute Automation', contentContainer, options);
    if (win?.element) {
        muteAutomationWindow = win;
        setTimeout(() => renderMuteAutomationContent(), 50);
    }
    
    return win;
}

/**
 * Render the mute automation panel content
 */
function renderMuteAutomationContent() {
    const container = document.getElementById('trackMuteAutomationContent');
    if (!container || !muteAutomation) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    
    // Add any new tracks
    for (const track of tracks) {
        const existingTrack = muteAutomation.tracks.get(track.id);
        if (!existingTrack) {
            addTrackToAutomation(track);
        }
    }
    
    let html = `
        <div class="mb-3 text-xs text-gray-400">
            Click on a track timeline to toggle mute at that position. Muted regions are shown in red.
        </div>
        
        <div class="flex-1 overflow-y-auto space-y-2">
    `;
    
    for (const track of tracks) {
        const automationPoints = muteAutomation.getAutomationPoints(track.id);
        const duration = localAppServices.getProjectDuration?.() || 60;
        
        // Build mute regions HTML
        let muteRegionsHtml = '';
        let lastMuted = false;
        let lastTime = 0;
        
        // Sort points by time
        const sortedPoints = [...automationPoints].sort((a, b) => a.time - b.time);
        
        for (const point of sortedPoints) {
            if (point.muted && !lastMuted) {
                // Start mute region
                const left = (lastTime / duration) * 100;
                muteRegionsHtml += `<div class="mute-region absolute top-0 bottom-0 bg-red-500/40" style="left: ${left}%;"></div>`;
            } else if (!point.muted && lastMuted) {
                // End mute region - we need to close the previous region
                const left = (automationPoints.find(p => p.time === lastTime)?.time / duration) * 100 || 0;
                const right = (point.time / duration) * 100;
                // Find and update the last opened region
                const regions = muteRegionsHtml.match(/<div class="mute-region[^"]*" style="left: [0-9.]+%;"><\/div>/g) || [];
                if (regions.length > 0) {
                    const lastRegion = regions[regions.length - 1];
                    const leftMatch = lastRegion.match(/left: ([0-9.]+)%/);
                    if (leftMatch) {
                        const startLeft = parseFloat(leftMatch[1]);
                        const width = right - startLeft;
                        const newRegion = `<div class="mute-region absolute top-0 bottom-0 bg-red-500/40" style="left: ${startLeft}%; width: ${width}%;"></div>`;
                        muteRegionsHtml = muteRegionsHtml.replace(lastRegion, newRegion);
                    }
                }
            }
            lastMuted = point.muted;
            lastTime = point.time;
        }
        
        // Close any open mute region at the end
        if (lastMuted) {
            const regions = muteRegionsHtml.match(/<div class="mute-region[^"]*" style="left: [0-9.]+%;"><\/div>/g) || [];
            if (regions.length > 0) {
                const lastRegion = regions[regions.length - 1];
                const leftMatch = lastRegion.match(/left: ([0-9.]+)%/);
                if (leftMatch) {
                    const startLeft = parseFloat(leftMatch[1]);
                    const width = 100 - startLeft;
                    const newRegion = `<div class="mute-region absolute top-0 bottom-0 bg-red-500/40" style="left: ${startLeft}%; width: ${width}%;"></div>`;
                    muteRegionsHtml = muteRegionsHtml.replace(lastRegion, newRegion);
                }
            }
        }
        
        html += `
            <div class="track-mute-row p-2 bg-gray-800 rounded border border-gray-700" data-track-id="${track.id}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-white font-medium">${track.name || `Track ${track.id}`}</span>
                        <span class="text-xs text-gray-500 capitalize">${track.type || 'Track'}</span>
                    </div>
                    <div class="flex gap-1">
                        <button class="mute-toggle-btn px-2 py-1 text-xs rounded ${track.muted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'} text-white" data-track-id="${track.id}">
                            ${track.muted ? 'Muted' : 'Mute'}
                        </button>
                        <button class="mute-clear-btn px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 text-white" data-track-id="${track.id}">
                            Clear
                        </button>
                    </div>
                </div>
                <div class="mute-timeline relative h-8 bg-gray-900 rounded cursor-crosshair" 
                     data-track-id="${track.id}" 
                     style="position: relative; height: 32px; background: #1a1a1a; border-radius: 4px; overflow: hidden;">
                    ${muteRegionsHtml}
                    <div class="playhead-line absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10 pointer-events-none" style="left: 0;"></div>
                </div>
                <div class="time-axis flex justify-between text-xs text-gray-500 mt-1">
                    <span>0:00</span>
                    <span>${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                </div>
            </div>
        `;
    }
    
    if (tracks.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500">
                <p>No tracks available.</p>
                <p class="text-xs mt-2">Create some tracks first to add mute automation.</p>
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Add export/import buttons
    html += `
        <div class="mt-3 pt-2 border-t border-gray-700 flex gap-2">
            <button id="muteAutomationExportBtn" class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium">
                Export
            </button>
            <button id="muteAutomationImportBtn" class="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium">
                Import
            </button>
            <button id="muteAutomationClearAllBtn" class="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium">
                Clear All
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Setup event listeners
    container.querySelectorAll('.mute-timeline').forEach(timeline => {
        timeline.addEventListener('click', (e) => {
            const rect = timeline.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = (x / rect.width) * (localAppServices.getProjectDuration?.() || 60);
            const trackId = parseInt(timeline.dataset.trackId);
            
            if (muteAutomation) {
                muteAutomation.toggleMuteAt(trackId, time);
                renderMuteAutomationContent();
            }
        });
    });
    
    container.querySelectorAll('.mute-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = parseInt(btn.dataset.trackId);
            const track = localAppServices.getTrackById?.(trackId);
            if (track) {
                const newMuted = !track.muted;
                if (localAppServices.setTrackMuted) {
                    localAppServices.setTrackMuted(trackId, newMuted);
                }
                renderMuteAutomationContent();
            }
        });
    });
    
    container.querySelectorAll('.mute-clear-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = parseInt(btn.dataset.trackId);
            if (muteAutomation) {
                muteAutomation.clearAutomation(trackId);
                renderMuteAutomationContent();
                localAppServices.showNotification?.('Mute automation cleared', 1500);
            }
        });
    });
    
    // Export button
    const exportBtn = document.getElementById('muteAutomationExportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (muteAutomation) {
                const data = muteAutomation.exportAutomation();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mute-automation.json';
                a.click();
                URL.revokeObjectURL(url);
                localAppServices.showNotification?.('Mute automation exported', 1500);
            }
        });
    }
    
    // Import button
    const importBtn = document.getElementById('muteAutomationImportBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file && muteAutomation) {
                    const text = await file.text();
                    if (muteAutomation.importAutomation(text)) {
                        renderMuteAutomationContent();
                        localAppServices.showNotification?.('Mute automation imported', 1500);
                    } else {
                        localAppServices.showNotification?.('Failed to import automation', 2000);
                    }
                }
            };
            input.click();
        });
    }
    
    // Clear all button
    const clearAllBtn = document.getElementById('muteAutomationClearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (muteAutomation) {
                const tracks = localAppServices.getTracks?.() || [];
                for (const track of tracks) {
                    muteAutomation.clearAutomation(track.id);
                }
                renderMuteAutomationContent();
                localAppServices.showNotification?.('All mute automation cleared', 1500);
            }
        });
    }
    
    // Update playhead position
    updatePlayheadInMuteAutomation();
}

/**
 * Update playhead position in mute automation panel
 */
function updatePlayheadInMuteAutomation() {
    if (!muteAutomationWindow || muteAutomationWindow.isMinimized) return;
    
    const container = document.getElementById('trackMuteAutomationContent');
    if (!container) return;
    
    const currentTime = localAppServices.getCurrentTime?.() || 0;
    const duration = localAppServices.getProjectDuration?.() || 60;
    const playheadPercent = Math.min(100, (currentTime / duration) * 100);
    
    container.querySelectorAll('.playhead-line').forEach(line => {
        line.style.left = `${playheadPercent}%`;
    });
    
    requestAnimationFrame(updatePlayheadInMuteAutomation);
}

/**
 * Get mute automation state at a specific time for a track
 * @param {number} trackId - Track ID
 * @param {number} time - Time in seconds
 * @returns {boolean} Whether the track should be muted
 */
export function getMuteAutomationState(trackId, time) {
    if (!muteAutomation) return false;
    return muteAutomation.getMuteStateAt(trackId, time);
}

/**
 * Check if a track has any mute automation
 * @param {number} trackId - Track ID
 * @returns {boolean} Whether track has mute automation
 */
export function hasMuteAutomation(trackId) {
    if (!muteAutomation) return false;
    const points = muteAutomation.getAutomationPoints(trackId);
    return points.length > 0;
}

console.log('[TrackMuteAutomation] Module loaded');
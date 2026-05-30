// js/ClipChopperGrid.js - Clip Chopper Grid for Snug/OS DAW
// Automatically slice audio clips at regular grid intervals (beat grid)

let localAppServices = {};
let chopperPanel = null;

export function initClipChopperGrid(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipChopperGrid] Initialized');
}

export function openClipChopperGridPanel() {
    if (chopperPanel) {
        chopperPanel.remove();
        chopperPanel = null;
    }
    
    chopperPanel = document.createElement('div');
    chopperPanel.id = 'clipChopperPanel';
    chopperPanel.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 260px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid #444;
        border-radius: 8px;
        padding: 12px;
        z-index: 9990;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #ddd;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    
    chopperPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px;">
            <span style="font-weight: 600; color: #fff;">✂️ Clip Chopper Grid</span>
            <button id="chopperCloseBtn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px; padding: 0;">&times;</button>
        </div>
        <div style="margin-bottom: 10px;">
            <label style="font-size: 11px; color: #888;">Grid Division:</label>
            <select id="chopperGridSelect" style="width: 100%; margin-top: 4px; padding: 6px; background: #222; border: 1px solid #444; border-radius: 4px; color: #ddd;">
                <option value="4">Quarter Notes (1/4)</option>
                <option value="8" selected>Eighth Notes (1/8)</option>
                <option value="16">Sixteenth Notes (1/16)</option>
                <option value="32">Thirty-seconds (1/32)</option>
                <option value="2">Half Notes (1/2)</option>
                <option value="1">Whole Notes (1/1)</option>
            </select>
        </div>
        <div style="margin-bottom: 10px;">
            <label style="font-size: 11px; color: #888;">Action:</label>
            <select id="chopperActionSelect" style="width: 100%; margin-top: 4px; padding: 6px; background: #222; border: 1px solid #444; border-radius: 4px; color: #ddd;">
                <option value="slice">Slice at Grid Points</option>
                <option value="addMarkers">Add Markers Only</option>
            </select>
        </div>
        <div style="margin-bottom: 10px; font-size: 11px; color: #666;">
            Select a clip first, then click Chop to slice it at all grid points within the clip.
        </div>
        <button id="chopperChopBtn" style="width: 100%; padding: 8px; background: #ff7700; border: none; border-radius: 4px; color: #fff; font-weight: 600; cursor: pointer;">
            ✂️ Chop Clip
        </button>
    `;
    
    document.body.appendChild(chopperPanel);
    
    document.getElementById('chopperCloseBtn').addEventListener('click', () => {
        if (chopperPanel) {
            chopperPanel.remove();
            chopperPanel = null;
        }
    });
    
    document.getElementById('chopperChopBtn').addEventListener('click', () => {
        const gridValue = parseInt(document.getElementById('chopperGridSelect').value);
        const action = document.getElementById('chopperActionSelect').value;
        chopSelectedClip(gridValue, action);
    });
}

function chopSelectedClip(divisionsPerBar, action) {
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
    
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        localAppServices.showNotification?.('Clip not found', 1500);
        return;
    }
    
    // Calculate grid interval based on tempo
    const bpm = localAppServices.getTempo?.() || 120;
    const beatsPerBar = localAppServices.getTimeSignature?.()?.beatsPerBar || 4;
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    const gridInterval = secondsPerBar / divisionsPerBar;
    
    const clipStart = clip.start;
    const clipEnd = clipStart + (clip.duration || 0);
    
    // Collect all slice points
    const slicePoints = [];
    let point = clipStart + gridInterval;
    while (point < clipEnd) {
        slicePoints.push(point);
        point += gridInterval;
    }
    
    if (slicePoints.length === 0) {
        localAppServices.showNotification?.('No grid points found in clip', 1500);
        return;
    }
    
    if (action === 'addMarkers') {
        localAppServices.showNotification?.(`Added ${slicePoints.length} markers`, 2000);
        if (chopperPanel) {
            chopperPanel.remove();
            chopperPanel = null;
        }
        return;
    }
    
    // Sort slice points in reverse order to slice from end to start (avoid index shifting)
    slicePoints.sort((a, b) => b - a);
    
    // Perform slices
    let slicedCount = 0;
    for (const sliceTime of slicePoints) {
        if (typeof track.splitClipAtTime === 'function') {
            const result = track.splitClipAtTime(clipId, sliceTime);
            if (result && result.success !== false) {
                slicedCount++;
                // Update clipId to the new one after split if available
                if (result.newClipId) {
                    clipId = result.newClipId;
                }
            }
        }
    }
    
    localAppServices.showNotification?.(`Sliced clip at ${slicePoints.length} grid points`, 2000);
    
    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }
    
    if (chopperPanel) {
        chopperPanel.remove();
        chopperPanel = null;
    }
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

export function isClipChopperGridPanelOpen() {
    return chopperPanel !== null;
}

// Export function to register menu listener
export function initClipChopperGridMenu() {
    const menuItem = document.getElementById('menuClipChopperGrid');
    if (menuItem) {
        menuItem.addEventListener('click', openClipChopperGridPanel);
    }
}

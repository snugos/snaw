// Tempo Jump Markers - Set quick tempo jump points during playback with single click
// When playhead reaches a tempo jump marker, the BPM changes automatically

let tempoJumpMarkers = []; // Array of { id, position, bpm, name }
let tempoJumpMarkerIdCounter = 0;
let tempoJumpPlaybackWatcher = null;

// Initialize tempo jump marker system
export function initTempoJumpMarkers() {
    console.log('[TempoJumpMarkers] Initialized');
    
    // Set up playback position watcher to detect when we reach a tempo jump marker
    setupPlaybackWatcher();
    
    // Add tempo jump markers toggle button to transport bar
    addTempoJumpMarkerToggle();
}

// Set up a watcher to check playhead position during playback
function setupPlaybackWatcher() {
    // Check position every 100ms during playback
    setInterval(() => {
        if (typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
            const currentTime = Tone.Transport.seconds;
            checkTempoJumpMarkers(currentTime);
        }
    }, 100);
}

// Check if we've crossed a tempo jump marker
function checkTempoJumpMarkers(currentTime) {
    for (const marker of tempoJumpMarkers) {
        // If we're within 0.05 seconds of the marker position and it hasn't been triggered yet
        if (Math.abs(currentTime - marker.position) < 0.05 && !marker.triggered) {
            // Only trigger if we're moving forward (not rewinding)
            if (!marker.triggered) {
                applyTempoJump(marker);
                marker.triggered = true;
                
                // Reset triggered flag after we've moved past the marker
                setTimeout(() => {
                    marker.triggered = false;
                }, 2000);
            }
        }
    }
}

// Apply the tempo jump
function applyTempoJump(marker) {
    if (typeof Tone !== 'undefined') {
        const oldBpm = Tone.Transport.bpm.value;
        Tone.Transport.bpm.value = marker.bpm;
        
        // Update display
        if (typeof updateTransportBPMDisplay === 'function') {
            updateTransportBPMDisplay(marker.bpm);
        }
        
        console.log(`[TempoJumpMarkers] Jumped to ${marker.bpm} BPM at position ${marker.position.toFixed(2)}s`);
        
        // Show visual feedback
        showTempoJumpFeedback(marker, oldBpm);
    }
}

// Show visual feedback when tempo jumps
function showTempoJumpFeedback(marker, oldBpm) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: #4ade80;
        padding: 20px 40px;
        border-radius: 12px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10000;
        border: 2px solid #4ade80;
        pointer-events: none;
        animation: tempoJumpFade 1.5s ease-out forwards;
    `;
    feedback.innerHTML = `
        <div style="font-size: 14px; color: #888; margin-bottom: 8px;">TEMPO JUMP</div>
        <div style="font-size: 36px;">${oldBpm} → ${marker.bpm} BPM</div>
        ${marker.name ? `<div style="font-size: 14px; color: #aaa; margin-top: 8px;">${marker.name}</div>` : ''}
    `;
    
    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes tempoJumpFade {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
            40% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
        style.remove();
    }, 1500);
}

// Add a new tempo jump marker
export function addTempoJumpMarker(position, bpm, name = '') {
    const marker = {
        id: `tempoJump_${++tempoJumpMarkerIdCounter}`,
        position: parseFloat(position) || 0,
        bpm: parseFloat(bpm) || 120,
        name: name || `Jump to ${bpm}`,
        triggered: false
    };
    
    tempoJumpMarkers.push(marker);
    tempoJumpMarkers.sort((a, b) => a.position - b.position);
    
    console.log(`[TempoJumpMarkers] Added marker at ${marker.position.toFixed(2)}s: ${marker.bpm} BPM`);
    
    // Update timeline ruler display
    updateTempoJumpMarkersDisplay();
    
    return marker;
}

// Remove a tempo jump marker
export function removeTempoJumpMarker(markerId) {
    const index = tempoJumpMarkers.findIndex(m => m.id === markerId);
    if (index !== -1) {
        const removed = tempoJumpMarkers.splice(index, 1)[0];
        console.log(`[TempoJumpMarkers] Removed marker "${removed.name}"`);
        updateTempoJumpMarkersDisplay();
        return true;
    }
    return false;
}

// Update a tempo jump marker's properties
export function updateTempoJumpMarker(markerId, updates) {
    const marker = tempoJumpMarkers.find(m => m.id === markerId);
    if (marker) {
        if (updates.position !== undefined) marker.position = parseFloat(updates.position) || 0;
        if (updates.bpm !== undefined) marker.bpm = parseFloat(updates.bpm) || 120;
        if (updates.name !== undefined) marker.name = updates.name;
        tempoJumpMarkers.sort((a, b) => a.position - b.position);
        updateTempoJumpMarkersDisplay();
        return marker;
    }
    return null;
}

// Get all tempo jump markers
export function getTempoJumpMarkers() {
    return [...tempoJumpMarkers];
}

// Clear all tempo jump markers
export function clearTempoJumpMarkers() {
    tempoJumpMarkers = [];
    updateTempoJumpMarkersDisplay();
    console.log('[TempoJumpMarkers] Cleared all markers');
}

// Update the timeline ruler to show tempo jump markers
function updateTempoJumpMarkersDisplay() {
    // Remove existing tempo jump marker elements
    document.querySelectorAll('.tempo-jump-marker').forEach(el => el.remove());
    
    // Get timeline ruler
    const ruler = document.querySelector('#timeline-ruler, .timeline-ruler, .ruler');
    if (!ruler) return;
    
    // Get timeline container to calculate position scaling
    const timeline = document.querySelector('#timeline, .timeline');
    if (!timeline) return;
    
    // Calculate pixels per second
    const timelineWidth = timeline.scrollWidth || timeline.offsetWidth || 1000;
    const duration = typeof getProjectDuration === 'function' ? getProjectDuration() : 300;
    const pixelsPerSecond = timelineWidth / duration;
    
    // Add marker elements to ruler
    for (const marker of tempoJumpMarkers) {
        const markerEl = document.createElement('div');
        markerEl.className = 'tempo-jump-marker';
        markerEl.dataset.markerId = marker.id;
        
        const leftPos = marker.position * pixelsPerSecond;
        markerEl.style.cssText = `
            position: absolute;
            left: ${leftPos}px;
            top: 0;
            width: 16px;
            height: 100%;
            background: linear-gradient(to bottom, #f59e0b 0%, #f59e0b 50%, transparent 50%);
            cursor: pointer;
            z-index: 100;
            border-left: 2px solid #f59e0b;
        `;
        
        // Add tooltip on hover
        markerEl.title = `${marker.name}\n${marker.bpm} BPM\nClick to edit, double-click to remove`;
        
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            showTempoJumpMarkerEditor(marker.id);
        });
        
        markerEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            removeTempoJumpMarker(marker.id);
        });
        
        ruler.appendChild(markerEl);
    }
}

// Show editor panel for a tempo jump marker
function showTempoJumpMarkerEditor(markerId) {
    const marker = tempoJumpMarkers.find(m => m.id === markerId);
    if (!marker) return;
    
    // Create modal editor
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: #1a1a2e; padding: 24px; border-radius: 12px; min-width: 300px; border: 1px solid #444;">
            <h3 style="margin: 0 0 20px 0; color: #f59e0b; font-size: 18px;">Edit Tempo Jump Marker</h3>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #888; font-size: 12px; margin-bottom: 6px;">Name</label>
                <input type="text" id="tj-name" value="${marker.name}" style="
                    width: 100%;
                    padding: 10px;
                    background: #0a0a14;
                    border: 1px solid #333;
                    border-radius: 6px;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #888; font-size: 12px; margin-bottom: 6px;">Position (seconds)</label>
                <input type="number" id="tj-position" value="${marker.position.toFixed(2)}" step="0.1" min="0" style="
                    width: 100%;
                    padding: 10px;
                    background: #0a0a14;
                    border: 1px solid #333;
                    border-radius: 6px;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #888; font-size: 12px; margin-bottom: 6px;">BPM</label>
                <input type="number" id="tj-bpm" value="${marker.bpm}" min="20" max="999" step="1" style="
                    width: 100%;
                    padding: 10px;
                    background: #0a0a14;
                    border: 1px solid #333;
                    border-radius: 6px;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="tj-cancel" style="
                    padding: 10px 20px;
                    background: #333;
                    border: none;
                    border-radius: 6px;
                    color: #888;
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
                <button id="tj-delete" style="
                    padding: 10px 20px;
                    background: #dc2626;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">Delete</button>
                <button id="tj-save" style="
                    padding: 10px 20px;
                    background: #f59e0b;
                    border: none;
                    border-radius: 6px;
                    color: black;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                ">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Button handlers
    modal.querySelector('#tj-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#tj-delete').addEventListener('click', () => {
        removeTempoJumpMarker(markerId);
        modal.remove();
    });
    modal.querySelector('#tj-save').addEventListener('click', () => {
        const name = modal.querySelector('#tj-name').value;
        const position = parseFloat(modal.querySelector('#tj-position').value);
        const bpm = parseInt(modal.querySelector('#tj-bpm').value);
        
        updateTempoJumpMarker(markerId, { name, position, bpm });
        modal.remove();
    });
    
    // Close on escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Add toggle button to transport bar
function addTempoJumpMarkerToggle() {
    // Wait for DOM to be ready
    setTimeout(() => {
        // Find transport bar or create a container
        let transportBar = document.querySelector('#transport-bar, .transport-bar, #transport');
        if (!transportBar) {
            // Create transport bar if it doesn't exist
            transportBar = document.createElement('div');
            transportBar.id = 'transport-bar';
            transportBar.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(20, 20, 30, 0.95);
                padding: 10px 20px;
                border-radius: 8px;
                display: flex;
                gap: 10px;
                align-items: center;
                z-index: 1000;
                border: 1px solid #333;
            `;
            document.body.appendChild(transportBar);
        }
        
        // Check if button already exists
        if (document.getElementById('tempo-jump-toggle')) return;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'tempo-jump-toggle';
        toggleBtn.innerHTML = '⏱ Tempo Jump';
        toggleBtn.title = 'Add tempo jump marker at current position';
        toggleBtn.style.cssText = `
            padding: 8px 16px;
            background: #1a1a2e;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            color: #f59e0b;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        `;
        
        toggleBtn.addEventListener('click', () => {
            if (typeof Tone !== 'undefined') {
                const currentTime = Tone.Transport.seconds;
                const currentBpm = Tone.Transport.bpm.value;
                addTempoJumpMarker(currentTime, currentBpm);
                
                // Visual feedback
                toggleBtn.style.background = '#f59e0b';
                toggleBtn.style.color = 'black';
                setTimeout(() => {
                    toggleBtn.style.background = '#1a1a2e';
                    toggleBtn.style.color = '#f59e0b';
                }, 200);
            }
        });
        
        transportBar.appendChild(toggleBtn);
        
        // Also add a list button
        const listBtn = document.createElement('button');
        listBtn.id = 'tempo-jump-list-btn';
        listBtn.innerHTML = '📋';
        listBtn.title = 'View all tempo jump markers';
        listBtn.style.cssText = `
            padding: 8px 12px;
            background: #1a1a2e;
            border: 1px solid #666;
            border-radius: 6px;
            color: #888;
            cursor: pointer;
            font-size: 13px;
        `;
        
        listBtn.addEventListener('click', showTempoJumpMarkersList);
        transportBar.appendChild(listBtn);
        
        console.log('[TempoJumpMarkers] Toggle button added');
    }, 1000);
}

// Show list of all tempo jump markers
function showTempoJumpMarkersList() {
    if (tempoJumpMarkers.length === 0) {
        alert('No tempo jump markers. Click "⏱ Tempo Jump" to add one at the current position.');
        return;
    }
    
    const listHtml = tempoJumpMarkers.map(m => 
        `${m.name} - ${m.bpm} BPM @ ${m.position.toFixed(2)}s`
    ).join('\n');
    
    const markers = tempoJumpMarkers.map(m => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #0a0a14; margin: 6px 0; border-radius: 6px; border: 1px solid #333;">
            <div>
                <div style="color: #f59e0b; font-weight: bold;">${m.name}</div>
                <div style="color: #888; font-size: 12px;">${m.bpm} BPM @ ${m.position.toFixed(2)}s</div>
            </div>
            <button onclick="removeTempoJumpMarker('${m.id}'); this.parentElement.remove();" style="
                padding: 6px 12px;
                background: #dc2626;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 12px;
            ">×</button>
        </div>
    `).join('');
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: #1a1a2e; padding: 24px; border-radius: 12px; min-width: 400px; max-width: 600px; max-height: 80vh; overflow-y: auto; border: 1px solid #444;">
            <h3 style="margin: 0 0 20px 0; color: #f59e0b; font-size: 18px;">Tempo Jump Markers (${tempoJumpMarkers.length})</h3>
            <div id="tj-list">${markers}</div>
            <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
                <button id="tj-close" style="
                    padding: 10px 20px;
                    background: #333;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">Close</button>
                <button id="tj-clear-all" style="
                    padding: 10px 20px;
                    background: #dc2626;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">Clear All</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#tj-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#tj-clear-all').addEventListener('click', () => {
        clearTempoJumpMarkers();
        modal.remove();
    });
}

// Make functions globally accessible for inline onclick handlers
if (typeof window !== 'undefined') {
    window.removeTempoJumpMarker = removeTempoJumpMarker;
}
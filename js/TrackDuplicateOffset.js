// TrackDuplicateOffset.js - Duplicate tracks with configurable time offset
// Adds offset option to track duplication for layered takes

let localAppServices = {};
let offsetDialog = null;

/**
 * Open the duplicate with offset dialog
 * @param {number} trackId - Source track ID
 */
export function openDuplicateOffsetDialog(trackId) {
    if (offsetDialog) offsetDialog.remove();
    
    const tracks = localAppServices.getTracksState?.() || [];
    const sourceTrack = tracks.find(t => t.id === trackId);
    if (!sourceTrack) return;
    
    offsetDialog = document.createElement('div');
    offsetDialog.id = 'duplicate-offset-dialog';
    offsetDialog.className = 'fixed bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-[10001] p-4 w-72';
    offsetDialog.style.left = `${Math.min(window.innerWidth - 320, window.innerWidth / 2 - 150)}px`;
    offsetDialog.style.top = `${Math.min(window.innerHeight - 200, window.innerHeight / 2 - 80)}px`;
    
    offsetDialog.innerHTML = `
        <div class="text-sm font-semibold text-white mb-3">Duplicate Track with Offset</div>
        <div class="text-xs text-gray-400 mb-3">Source: ${escapeHtml(sourceTrack.name || 'Track ' + trackId)}</div>
        <div class="mb-3">
            <label class="block text-xs text-gray-400 mb-1">Time Offset (seconds)</label>
            <input type="number" id="duplicate-offset-input" value="4" min="-60" max="60" step="0.5"
                class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500">
        </div>
        <div class="flex gap-2 justify-end">
            <button id="duplicate-offset-cancel" class="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">Cancel</button>
            <button id="duplicate-offset-confirm" class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">Duplicate</button>
        </div>
    `;
    
    document.body.appendChild(offsetDialog);
    
    // Event listeners
    offsetDialog.querySelector('#duplicate-offset-cancel').addEventListener('click', () => {
        offsetDialog.remove();
        offsetDialog = null;
    });
    
    offsetDialog.querySelector('#duplicate-offset-confirm').addEventListener('click', () => {
        const offset = parseFloat(offsetDialog.querySelector('#duplicate-offset-input').value) || 0;
        duplicateTrackWithOffset(trackId, offset);
        offsetDialog.remove();
        offsetDialog = null;
    });
    
    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            offsetDialog.remove();
            offsetDialog = null;
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Focus input
    setTimeout(() => offsetDialog.querySelector('#duplicate-offset-input').focus(), 50);
}

/**
 * Duplicate track with offset
 * @param {number} trackId - Source track ID
 * @param {number} offsetSeconds - Time offset for duplicated clips
 * @returns {object|null} New track or null
 */
export function duplicateTrackWithOffset(trackId, offsetSeconds = 0) {
    const tracks = localAppServices.getTracksState?.();
    if (!tracks) return null;
    
    const sourceTrack = tracks.find(t => t.id === trackId);
    if (!sourceTrack) {
        console.warn('[TrackDuplicateOffset] Source track not found:', trackId);
        return null;
    }
    
    // Create new track data
    const newTrack = JSON.parse(JSON.stringify(sourceTrack));
    newTrack.id = localAppServices.generateId ? localAppServices.generateId() : Date.now();
    newTrack.name = (sourceTrack.name || 'Track') + ' Offset';
    
    // Offset all clips
    if (newTrack.clips && Array.isArray(newTrack.clips)) {
        newTrack.clips = newTrack.clips.map(clip => {
            const newClip = {...clip, id: localAppServices.generateId ? localAppServices.generateId() : Date.now() + Math.random()};
            newClip.startTime = (clip.startTime || 0) + offsetSeconds;
            return newClip;
        });
    }
    
    // Offset effects IDs
    if (newTrack.effects && Array.isArray(newTrack.effects)) {
        newTrack.effects = newTrack.effects.map(effect => ({
            ...effect,
            id: localAppServices.generateId ? localAppServices.generateId() : Date.now() + Math.random()
        }));
    }
    
    // Add to state
    tracks.push(newTrack);
    
    // Render and save
    if (localAppServices.renderTracks) localAppServices.renderTracks();
    if (localAppServices.saveState) localAppServices.saveState();
    
    localAppServices.showNotification?.(`Track duplicated (+${offsetSeconds}s offset)`, 1500);
    console.log('[TrackDuplicateOffset] Duplicated track', sourceTrack.name, 'with offset', offsetSeconds, '→ new track', newTrack.name);
    
    return newTrack;
}

/**
 * Initialize the module
 * @param {object} services - App services
 */
export function initTrackDuplicateOffset(services) {
    localAppServices = services;
    console.log('[TrackDuplicateOffset] Initialized');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
// js/MidiChordDisplay.js - MIDI Chord Display Feature
// Show chord names (Cmaj7, D7, etc.) above MIDI clip sections on timeline

let localAppServices = {};
let chordOverlayContainer = null;
let midiChordDisplayEnabled = true;
let clipChordCache = new Map(); // clipId -> chordSymbol

// Chord detection templates
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_TEMPLATES = {
    'major': [0, 4, 7],
    'minor': [0, 3, 7],
    'dim': [0, 3, 6],
    'aug': [0, 4, 8],
    'sus2': [0, 2, 7],
    'sus4': [0, 5, 7],
    '7': [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    'm7': [0, 3, 7, 10],
    'dim7': [0, 3, 6, 9],
    'm7b5': [0, 3, 6, 10],
    'add9': [0, 4, 7, 14],
    '6': [0, 4, 7, 9],
    'm6': [0, 3, 7, 9],
    '9': [0, 4, 7, 10, 14],
};

/**
 * Initialize MIDI Chord Display module
 * @param {object} services - App services from main.js
 */
export function initMidiChordDisplay(services) {
    localAppServices = services || {};
    console.log('[MidiChordDisplay] Initialized');
    
    // Create overlay container
    createOverlayContainer();
    
    // Listen for timeline renders to update chord labels
    if (localAppServices.renderTimeline) {
        const originalRender = localAppServices.renderTimeline;
        localAppServices.renderTimeline = function(...args) {
            const result = originalRender.apply(this, args);
            updateChordLabelsOnTimeline();
            return result;
        };
    }
    
    // Initial render after short delay
    setTimeout(() => updateChordLabelsOnTimeline(), 500);
}

/**
 * Create the chord overlay container
 */
function createOverlayContainer() {
    if (chordOverlayContainer) return;
    
    chordOverlayContainer = document.createElement('div');
    chordOverlayContainer.id = 'midiChordDisplayOverlay';
    chordOverlayContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 150px;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 100;
    `;
    
    // Append to timeline area if it exists
    const timeline = document.getElementById('timeline') || document.querySelector('.timeline-area');
    if (timeline) {
        timeline.style.position = 'relative';
        timeline.appendChild(chordOverlayContainer);
    } else {
        document.body.appendChild(chordOverlayContainer);
    }
}

/**
 * Detect chord from MIDI notes
 * @param {Array} notes - Array of {pitch, velocity, time}
 * @returns {string|null} Chord symbol or null
 */
export function detectChordFromNotes(notes) {
    if (!notes || notes.length === 0) return null;
    
    // Get unique pitch classes
    const pitchClasses = new Set();
    notes.forEach(n => {
        if (n.pitch !== undefined) {
            pitchClasses.add(((n.pitch % 12) + 12) % 12);
        }
    });
    
    if (pitchClasses.size < 2) return null;
    
    const chroma = Array.from(pitchClasses).sort((a, b) => a - b);
    
    // Try each root to find best matching chord
    let bestChord = null;
    let bestScore = 0;
    
    for (let root = 0; root < 12; root++) {
        for (const [type, intervals] of Object.entries(CHORD_TEMPLATES)) {
            const chordChroma = new Set(intervals.map(i => (root + i) % 12));
            
            // Count matching notes
            let matches = 0;
            chroma.forEach(pc => {
                if (chordChroma.has(pc)) matches++;
            });
            
            // Penalize for missing or extra notes
            const score = matches - (chordChroma.size - matches) * 0.5 - Math.abs(chroma.length - chordChroma.size) * 0.3;
            
            if (score > bestScore && matches >= Math.min(3, chordChroma.size)) {
                bestScore = score;
                bestChord = {
                    root: NOTE_NAMES[root],
                    type,
                    symbol: formatChordSymbol(NOTE_NAMES[root], type)
                };
            }
        }
    }
    
    return bestChord ? bestChord.symbol : null;
}

/**
 * Format chord symbol from root and type
 */
function formatChordSymbol(root, type) {
    if (type === 'major') return root;
    if (type === 'minor') return root + 'm';
    return root + type;
}

/**
 * Get chord for a specific MIDI clip
 * @param {string} clipId - Clip ID
 * @param {object} track - Track object
 * @returns {string|null} Chord symbol
 */
export function getChordForClip(clipId, track) {
    if (!track || !track.timelineClips) return null;
    
    const clip = track.timelineClips.find(c => c.id === clipId);
    if (!clip) return null;
    
    // Check cache
    if (clipChordCache.has(clipId)) {
        return clipChordCache.get(clipId);
    }
    
    // Detect chord from clip notes
    let chord = null;
    
    if (clip.notes && Array.isArray(clip.notes) && clip.notes.length > 0) {
        chord = detectChordFromNotes(clip.notes);
    } else if (clip.sequence && clip.sequence.notes) {
        chord = detectChordFromNotes(clip.sequence.notes);
    }
    
    // Cache the result
    if (chord) {
        clipChordCache.set(clipId, chord);
    }
    
    return chord;
}

/**
 * Clear chord cache (call when clips change)
 */
export function clearChordCache() {
    clipChordCache.clear();
}

/**
 * Update chord labels on all MIDI clips in timeline
 */
export function updateChordLabelsOnTimeline() {
    if (!chordOverlayContainer || !midiChordDisplayEnabled) {
        if (chordOverlayContainer) chordOverlayContainer.innerHTML = '';
        return;
    }
    
    // Clear existing labels
    chordOverlayContainer.innerHTML = '';
    
    // Get all tracks and clips
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    if (!tracks || tracks.length === 0) return;
    
    // Clear cache and rebuild based on current clip state
    clearChordCache();
    
    // Get pixels per second for positioning
    const pixelsPerSecond = localAppServices.getPixelsPerSecond ? localAppServices.getPixelsPerSecond() : 100;
    
    tracks.forEach(track => {
        if (!track.timelineClips) return;
        
        track.timelineClips.forEach(clip => {
            // Only process MIDI clips
            if (clip.type !== 'midi' && clip.type !== 'sequence') return;
            
            const chord = getChordForClip(clip.id, track);
            if (!chord) return;
            
            // Calculate position on timeline
            const startX = (clip.startTime || 0) * pixelsPerSecond;
            const clipWidth = (clip.duration || 4) * pixelsPerSecond;
            
            // Only show if clip is wide enough
            if (clipWidth < 60) return;
            
            // Create label element
            const label = document.createElement('div');
            label.className = 'midi-chord-label';
            label.style.cssText = `
                position: absolute;
                left: ${startX}px;
                top: 2px;
                height: 18px;
                padding: 0 6px;
                background: rgba(99, 102, 241, 0.85);
                color: white;
                font-size: 10px;
                font-weight: 600;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                white-space: nowrap;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            `;
            label.textContent = chord;
            label.title = `${clip.name || 'MIDI Clip'}: ${chord}`;
            
            chordOverlayContainer.appendChild(label);
        });
    });
}

/**
 * Toggle MIDI chord display on/off
 */
export function toggleMidiChordDisplay() {
    midiChordDisplayEnabled = !midiChordDisplayEnabled;
    if (!midiChordDisplayEnabled) {
        if (chordOverlayContainer) chordOverlayContainer.innerHTML = '';
    } else {
        updateChordLabelsOnTimeline();
    }
    return midiChordDisplayEnabled;
}

/**
 * Get current enabled state
 */
export function isMidiChordDisplayEnabled() {
    return midiChordDisplayEnabled;
}

// Window exposure for external access
window.updateMidiChordLabels = updateChordLabelsOnTimeline;
window.toggleMidiChordDisplay = toggleMidiChordDisplay;
window.isMidiChordDisplayEnabled = isMidiChordDisplayEnabled;
// js/ChordTriggerMode.js - Chord Trigger Mode for SnugOS DAW
// Play a chord by pressing a single key, with configurable voicings

import * as Constants from './constants.js';

let localAppServices = {};
let chordTriggerEnabled = false;
let chordKeyMappings = {}; // { key: { rootNote, chordType, octave, voicing, inversion } }
let activeChordTrackId = null;
let activeChords = new Map(); // key -> { notes, startTime }

const DEFAULT_CHORD_MAPPINGS = [
    { key: 'q', rootNote: 'C', chordType: 'major', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'w', rootNote: 'C', chordType: 'minor', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'e', rootNote: 'D', chordType: 'major', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'r', rootNote: 'D', chordType: 'minor', octave: 4, voicing: 'close', inversion: 0 },
    { key: 't', rootNote: 'E', chordType: 'major', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'y', rootNote: 'E', chordType: 'minor', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'u', rootNote: 'F', chordType: 'major', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'i', rootNote: 'F', chordType: 'minor', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'o', rootNote: 'G', chordType: 'major', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'p', rootNote: 'G', chordType: 'minor', octave: 4, voicing: 'close', inversion: 0 },
    { key: 'a', rootNote: 'A', chordType: 'major', octave: 4, voicing: 'close', inversion: 0 },
    { key: 's', rootNote: 'A', chordType: 'minor', octave: 4, voicing: 'close', inversion: 0 },
];

export function initChordTriggerMode(appServices) {
    localAppServices = appServices || {};
    
    // Load default mappings
    DEFAULT_CHORD_MAPPINGS.forEach(mapping => {
        chordKeyMappings[mapping.key] = mapping;
    });
    
    console.log('[ChordTriggerMode] Initialized with', Object.keys(chordKeyMappings).length, 'key mappings');
}

export function isChordTriggerEnabled() {
    return chordTriggerEnabled;
}

export function setChordTriggerEnabled(enabled, trackId = null) {
    chordTriggerEnabled = !!enabled;
    activeChordTrackId = trackId || activeChordTrackId;
    
    // Stop any active chords when disabling
    if (!chordTriggerEnabled) {
        stopAllActiveChords();
    }
    
    // Update UI
    updateChordTriggerUI();
    
    localAppServices.showNotification?.(
        chordTriggerEnabled ? 'Chord Trigger Mode ON' : 'Chord Trigger Mode OFF',
        1500
    );
    
    console.log(`[ChordTriggerMode] ${chordTriggerEnabled ? 'Enabled' : 'Disabled'} for track ${activeChordTrackId}`);
}

export function toggleChordTriggerMode(trackId = null) {
    setChordTriggerEnabled(!chordTriggerEnabled, trackId);
}

export function getChordKeyMappings() {
    return JSON.parse(JSON.stringify(chordKeyMappings));
}

export function setChordKeyMapping(key, config) {
    const normalizedKey = key.toLowerCase();
    chordKeyMappings[normalizedKey] = {
        rootNote: config.rootNote || 'C',
        chordType: config.chordType || 'major',
        octave: config.octave !== undefined ? config.octave : 4,
        voicing: config.voicing || 'close',
        inversion: config.inversion || 0
    };
    console.log(`[ChordTriggerMode] Mapped key "${normalizedKey}" to ${config.rootNote} ${config.chordType}`);
}

export function clearChordKeyMapping(key) {
    const normalizedKey = key.toLowerCase();
    if (chordKeyMappings[normalizedKey]) {
        delete chordKeyMappings[normalizedKey];
        console.log(`[ChordTriggerMode] Cleared mapping for key "${normalizedKey}"`);
    }
}

export function clearAllChordMappings() {
    chordKeyMappings = {};
}

// Handle chord trigger from keyboard input
export function handleChordTriggerKeyDown(key) {
    if (!chordTriggerEnabled) return false;
    
    const normalizedKey = key.toLowerCase();
    const mapping = chordKeyMappings[normalizedKey];
    
    if (!mapping) return false;
    
    // Find the armed track or use the active one
    const trackId = activeChordTrackId || getDefaultChordTrackId();
    if (!trackId) return false;
    
    // Play the chord
    playChordForKey(normalizedKey, trackId, mapping);
    
    return true;
}

export function handleChordTriggerKeyUp(key) {
    if (!chordTriggerEnabled) return false;
    
    const normalizedKey = key.toLowerCase();
    
    // Stop the chord
    stopChordForKey(normalizedKey);
    
    return true;
}

function playChordForKey(key, trackId, mapping) {
    // Stop any existing chord on this key
    if (activeChords.has(key)) {
        stopChordForKey(key);
    }
    
    const { rootNote, chordType, octave, voicing, inversion } = mapping;
    
    // Call the main.js service to play the chord
    if (localAppServices.playMidiChord) {
        const result = localAppServices.playMidiChord(trackId, rootNote, octave, chordType, {
            voicing,
            inversion,
            velocity: 0.8
        });
        
        activeChords.set(key, {
            trackId,
            mapping,
            startTime: Date.now(),
            notes: result?.notes || []
        });
        
        // Update visual indicator
        updateChordIndicator(key, true);
        
        console.log(`[ChordTriggerMode] Playing ${rootNote}${octave} ${chordType} on key "${key}"`);
    }
}

function stopChordForKey(key) {
    const chordData = activeChords.get(key);
    if (!chordData) return;
    
    const { trackId } = chordData;
    
    // Call the main.js service to stop the chord
    if (localAppServices.stopMidiChord) {
        localAppServices.stopMidiChord(trackId);
    }
    
    // Update visual indicator
    updateChordIndicator(key, false);
    
    activeChords.delete(key);
}

function stopAllActiveChords() {
    activeChords.forEach((data, key) => {
        if (localAppServices.stopMidiChord) {
            localAppServices.stopMidiChord(data.trackId);
        }
        updateChordIndicator(key, false);
    });
    activeChords.clear();
}

function getDefaultChordTrackId() {
    // Find the first track that can play chords (Synth or Sampler with polyphony)
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const synthTrack = tracks.find(t => t.type === 'Synth' || t.type === 'Sampler');
    return synthTrack?.id || tracks[0]?.id || null;
}

function updateChordIndicator(key, isPlaying) {
    const indicator = document.getElementById(`chord-indicator-${key}`);
    if (indicator) {
        if (isPlaying) {
            indicator.classList.add('chord-active');
        } else {
            indicator.classList.remove('chord-active');
        }
    }
}

function updateChordTriggerUI() {
    // Update any UI elements that show chord mode status
    const statusElements = document.querySelectorAll('.chord-trigger-status');
    statusElements.forEach(el => {
        if (chordTriggerEnabled) {
            el.classList.add('active');
            el.textContent = 'Chord Mode: ON';
        } else {
            el.classList.remove('active');
            el.textContent = 'Chord Mode: OFF';
        }
    });
}

// Open the chord trigger configuration panel
export function openChordTriggerPanel() {
    const windowId = 'chordTriggerPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'chordTriggerContent';
    contentContainer.className = 'flex flex-col h-full bg-gray-900 text-white p-4 overflow-auto';
    
    const options = {
        width: 500,
        height: 600,
        minWidth: 400,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Chord Trigger Mode', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderChordTriggerContent(), 50);
    }
    
    return win;
}

function renderChordTriggerContent() {
    const container = document.getElementById('chordTriggerContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const trackOptions = tracks.filter(t => t.type === 'Synth' || t.type === 'Sampler' || t.type === 'MIDI')
        .map(t => `<option value="${t.id}" ${t.id === activeChordTrackId ? 'selected' : ''}>${t.name}</option>`)
        .join('');
    
    const chordTypes = Object.keys(Constants.CHORD_PATTERNS).map(type => 
        `<option value="${type}">${Constants.CHORD_PATTERNS[type].name}</option>`
    ).join('');
    
    const rootNotes = Constants.MIDI_CHORD_ROOT_NOTES.map(n => 
        `<option value="${n.note}">${n.note}</option>`
    ).join('');
    
    let mappingsList = Object.entries(chordKeyMappings).map(([key, config]) => {
        return `
            <div class="flex items-center justify-between p-2 bg-gray-800 rounded mb-2 chord-mapping-row" data-key="${key}">
                <div class="flex items-center gap-2">
                    <span class="w-8 h-8 flex items-center justify-center bg-blue-600 rounded font-bold text-sm">${key.toUpperCase()}</span>
                    <span class="text-sm text-gray-300">${config.rootNote}${config.octave} ${config.chordType}</span>
                </div>
                <button class="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded clear-mapping-btn" data-key="${key}">Clear</button>
            </div>
        `;
    }).join('');
    
    if (!mappingsList) {
        mappingsList = '<p class="text-gray-500 text-sm text-center py-4">No key mappings configured. Click "Add Mapping" to create one.</p>';
    }
    
    container.innerHTML = `
        <div class="space-y-4">
            <!-- Enable/Disable Toggle -->
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded">
                <span class="font-medium">Chord Trigger Mode</span>
                <button id="chordTriggerToggleBtn" class="px-4 py-2 rounded font-medium ${chordTriggerEnabled ? 'bg-green-600' : 'bg-gray-600'}">
                    ${chordTriggerEnabled ? 'Enabled' : 'Disabled'}
                </button>
            </div>
            
            <!-- Track Selection -->
            <div class="p-3 bg-gray-800 rounded">
                <label class="block text-sm text-gray-400 mb-2">Target Track</label>
                <select id="chordTriggerTrackSelect" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white">
                    ${trackOptions || '<option value="">No compatible tracks</option>'}
                </select>
            </div>
            
            <!-- Add New Mapping -->
            <div class="p-3 bg-gray-800 rounded">
                <h3 class="font-medium mb-3 text-sm">Add New Mapping</h3>
                <div class="grid grid-cols-5 gap-2 mb-3">
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">Key</label>
                        <input type="text" id="chordMappingKey" maxlength="1" class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-center uppercase" placeholder="Q">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">Root</label>
                        <select id="chordMappingRoot" class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                            ${rootNotes}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">Type</label>
                        <select id="chordMappingType" class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                            ${chordTypes}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">Octave</label>
                        <input type="number" id="chordMappingOctave" min="1" max="7" value="4" class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-center">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">Inv</label>
                        <input type="number" id="chordMappingInversion" min="0" max="3" value="0" class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-center">
                    </div>
                </div>
                <button id="addChordMappingBtn" class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Add Mapping</button>
            </div>
            
            <!-- Current Mappings -->
            <div class="p-3 bg-gray-800 rounded">
                <h3 class="font-medium mb-3 text-sm">Current Mappings (${Object.keys(chordKeyMappings).length})</h3>
                <div id="chordMappingsList" class="max-h-48 overflow-y-auto">
                    ${mappingsList}
                </div>
            </div>
            
            <!-- Quick Presets -->
            <div class="p-3 bg-gray-800 rounded">
                <h3 class="font-medium mb-3 text-sm">Quick Presets</h3>
                <div class="grid grid-cols-2 gap-2">
                    <button class="preset-btn px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm" data-preset="major">Major Keys</button>
                    <button class="preset-btn px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm" data-preset="minor">Minor Keys</button>
                    <button class="preset-btn px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm" data-preset="7ths">7th Chords</button>
                    <button class="preset-btn px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm" data-preset="all">All Chords</button>
                </div>
            </div>
            
            <!-- Instructions -->
            <div class="p-3 bg-gray-700 rounded text-xs text-gray-300">
                <p class="mb-1"><strong>How to use:</strong></p>
                <p>1. Enable Chord Trigger Mode using the button above</p>
                <p>2. Press a mapped key on your computer keyboard to play a chord</p>
                <p>3. Release the key to stop the chord</p>
                <p>4. Use the piano roll editor for single-note editing when in normal mode</p>
            </div>
        </div>
    `;
    
    // Attach event handlers
    setupChordTriggerEvents(container);
}

function setupChordTriggerEvents(container) {
    // Toggle button
    const toggleBtn = container.querySelector('#chordTriggerToggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const trackSelect = container.querySelector('#chordTriggerTrackSelect');
            const trackId = trackSelect?.value ? parseInt(trackSelect.value) : null;
            toggleChordTriggerMode(trackId);
            renderChordTriggerContent();
        });
    }
    
    // Track selection
    const trackSelect = container.querySelector('#chordTriggerTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            activeChordTrackId = e.target.value ? parseInt(e.target.value) : null;
        });
    }
    
    // Add mapping button
    const addBtn = container.querySelector('#addChordMappingBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const keyInput = container.querySelector('#chordMappingKey');
            const rootSelect = container.querySelector('#chordMappingRoot');
            const typeSelect = container.querySelector('#chordMappingType');
            const octaveInput = container.querySelector('#chordMappingOctave');
            const invInput = container.querySelector('#chordMappingInversion');
            
            const key = keyInput?.value.trim().toLowerCase();
            const rootNote = rootSelect?.value;
            const chordType = typeSelect?.value;
            const octave = parseInt(octaveInput?.value) || 4;
            const inversion = parseInt(invInput?.value) || 0;
            
            if (!key) {
                localAppServices.showNotification?.('Please enter a key', 1500);
                return;
            }
            
            setChordKeyMapping(key, {
                rootNote,
                chordType,
                octave,
                inversion,
                voicing: 'close'
            });
            
            renderChordTriggerContent();
            localAppServices.showNotification?.(`Mapped "${key.toUpperCase()}" to ${rootNote} ${chordType}`, 1500);
        });
    }
    
    // Clear mapping buttons
    container.querySelectorAll('.clear-mapping-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            clearChordKeyMapping(key);
            renderChordTriggerContent();
        });
    });
    
    // Preset buttons
    container.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            loadChordPreset(preset);
            renderChordTriggerContent();
        });
    });
}

function loadChordPreset(preset) {
    const keys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's'];
    const roots = ['C', 'D', 'E', 'F', 'G', 'A'];
    
    switch (preset) {
        case 'major':
            chordKeyMappings = {};
            keys.slice(0, 12).forEach((key, i) => {
                chordKeyMappings[key] = {
                    rootNote: roots[i % roots.length],
                    chordType: 'major',
                    octave: 4,
                    voicing: 'close',
                    inversion: 0
                };
            });
            break;
        case 'minor':
            chordKeyMappings = {};
            keys.slice(0, 12).forEach((key, i) => {
                chordKeyMappings[key] = {
                    rootNote: roots[i % roots.length],
                    chordType: 'minor',
                    octave: 4,
                    voicing: 'close',
                    inversion: 0
                };
            });
            break;
        case '7ths':
            chordKeyMappings = {};
            keys.slice(0, 8).forEach((key, i) => {
                const types = ['maj7', 'min7', 'dom7', 'dim'];
                chordKeyMappings[key] = {
                    rootNote: roots[i % roots.length],
                    chordType: types[i % types.length],
                    octave: 4,
                    voicing: 'close',
                    inversion: 0
                };
            });
            break;
        case 'all':
            chordKeyMappings = {};
            keys.slice(0, 12).forEach((key, i) => {
                const types = Object.keys(Constants.CHORD_PATTERNS);
                chordKeyMappings[key] = {
                    rootNote: roots[i % roots.length],
                    chordType: types[i % types.length],
                    octave: 4,
                    voicing: 'close',
                    inversion: 0
                };
            });
            break;
    }
    
    localAppServices.showNotification?.(`Loaded ${preset} preset`, 1500);
    console.log(`[ChordTriggerMode] Loaded preset "${preset}" with ${Object.keys(chordKeyMappings).length} mappings`);
}

// Export for keyboard event integration
export function getChordTriggerState() {
    return {
        enabled: chordTriggerEnabled,
        trackId: activeChordTrackId,
        mappings: Object.keys(chordKeyMappings)
    };
}

console.log('[ChordTriggerMode] Module loaded');
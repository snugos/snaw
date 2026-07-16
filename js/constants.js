// js/constants.js - Shared constants for SnugOS

export const APP_VERSION = "0.4.27"; // v0.4.26 Metronome Accent Pattern (four-step persisted pattern + transport toggle); v0.4.25 Track Visibility Toggle (hide/show tracks in timeline and mixer without muting audio); v0.4.24 Clip Lock Toggle // 2026-07-16 - v0.4.23 Record-arm status tooltip (record control identifies the armed/recording track and input-monitor state); v0.4.22 Pre-roll Count-In Toggle (transport-bar toggle for a persisted one-bar click-only count-in before recording), v0.4.20 Quick Marker navigation shortcuts ([ / ]) + transport-bar Markers button; v0.4.19 Quick Marker Set clear-all control + v0.4.17 Quick Marker Set (M + Shift+M marker shortcuts, per-marker delete controls) + Enhanced Panic Save (full project serialization) // 2026-07-13 - v0.4.16 Ctrl+Shift+S Panic Save (defensively-guarded keyboard shortcut that snapshots in-memory project state to localStorage under snawPanicSaves, max 5 LRU entries, surfaces 2s showNotification toast with timestamp + entry count, recovery deferred to a follow-up), v0.4.15 Transport Bar Master Output Meter (L/R horizontal peak meter in the transport bar, post-master-fader, pre-limiter; per-frame update via updateTransportBarMasterMeter hook in updatePerformanceStats; click-to-toggle settings popover; db-floored -60 dB range, peak-hold ticks, green/amber/red gradient) + Quick Project Snapshot List (last 5 auto + manual snapshots persisted to IndexedDB under snapshot_<id> keys; localStorage index for synchronous panel render; openProjectSnapshotListPanel / close / toggle window exports; captureProjectSnapshot window export for ad-hoc captures; auto-snapshot every 5min after a recent mutation; load via reconstructDAWInternal; wraps appServices.captureStateForUndo and saveProject to nudge the auto-snapshot throttle), v0.4.14 Daily Merge & Bug Fixes (merged app bugfixes: setAutomationArmed, setMonitoringEnabled, setSelectedSliceForEdit, setSelectedDrumPadForEdit methods with undo captures; added undo captures to loadSampleToPad, addEffect, removeEffect), v0.4.13 Mute-Others Solo (Shift+S soloes selected track and temporarily mutes every other track; same shortcut toggles back to the previous mix), v0.4.12 Project Session Timer (MM:SS elapsed-since-load in status bar, click to reset), v0.4.11 Undo Toast (↶/↷ styled toast on undo/redo with action name), v0.4.10 Track Notes Sidebar (📝 button on every track-strip opens an inline textarea popover, auto-saves on blur, separate from TrackNotes.js), v0.4.09 Clip Drag-to-Clone (Alt-drag timeline clip leaves original behind + paints clones), v0.4.08 Clip Time Handles (mm:ss readouts on audio clips + selected-clip timecode panel), v0.4.07 MIDI File Import/Export (SMF .mid parse/write + drag-drop import + file-picker + project-wide export), v0.4.06 Marker Color Presets, v0.4.05 Audio Clip Labeling + TimelineMarkers dedup, v0.4.04 Track Grouping by Instrument

export const STEPS_PER_BAR = 16;
export const defaultStepsPerBar = 16; // Default for new tracks
export const MAX_BARS = 512; // Maximum number of bars a sequence can have

export const MIN_TEMPO = 0; // Minimum tempo in BPM
export const MAX_TEMPO = 999; // Maximum tempo in BPM
export const DEFAULT_TEMPO = 120; // Default tempo for Alt+click reset on tempo nudge buttons

// Note: Reversed for typical top-to-bottom piano roll display in a UI
export const synthPitches = [
    'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
    'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
    'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
    'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
    'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
    'C6', 'C#6', 'D6', 'D#6', 'E6', 'F6', 'F#6', 'G6', 'G#6', 'A6', 'A#6', 'B6'
].reverse();

export const soundLibraries = {
    "Drums": "assets/drums.zip",
    "Instruments": "assets/instruments.zip",
    "Instruments 2": "assets/instruments2.zip",
    "Instruments 3": "assets/instruments3.zip"
    // Add more libraries here as needed
};

export const numSlices = 8; // Default number of slices for a new Sampler track
export const numDrumSamplerPads = 8; // Number of pads for the DrumSampler
export const samplerMIDINoteStart = 36; // C2, used for mapping MIDI notes to sampler slices/pads

export const defaultVelocity = 0.7; // Default velocity for new notes

export const defaultDesktopBg = '#101010'; // Matches style.css body background

export const MAX_HISTORY_STATES = 50; // Increased from 30 for more undo/redo capacity

// Computer Keyboard to MIDI mapping for Synthesizer-like instruments
// QWERTY layout, bottom row for C-major scale starting on C4 (MIDI 60) by default
// Top row for sharps/flats or extended notes.
// 'a' maps to C4 (MIDI 60)
export const computerKeySynthMap = {
    // Bottom row (white keys on piano often)
    'a': 48, // C3 (octave shift will modify this)
    's': 50, // D3
    'd': 52, // E3
    'f': 53, // F3
    'g': 55, // G3
    'h': 57, // A3
    'j': 59, // B3
    'k': 60, // C4

    // Top row (black keys on piano often)
    'w': 49, // C#3
    'e': 51, // D#3
    // 'r': // F (no black key)
    't': 54, // F#3
    'y': 56, // G#3
    'u': 58, // A#3
    // 'i': // C (no black key)

    // Alternative mapping for some DAWs (shifted QWERTY)
    // 'q': 60, // C4
    // '2': 61, // C#4
    // 'w': 62, // D4
    // '3': 63, // D#4
    // 'e': 64, // E4
    // 'r': 65, // F4
    // '5': 66, // F#4
    // 't': 67, // G4
    // '6': 68, // G#4
    // 'y': 69, // A4
    // '7': 70, // A#4
    // 'u': 71, // B4
    // 'i': 72  // C5
};

// Computer Keyboard to MIDI mapping for Sampler (slices/pads)
// Numbers 1-8 typically map to slices/pads
export const computerKeySamplerMap = {
    'Digit1': samplerMIDINoteStart + 0,
    'Digit2': samplerMIDINoteStart + 1,
    'Digit3': samplerMIDINoteStart + 2,
    'Digit4': samplerMIDINoteStart + 3,
    'Digit5': samplerMIDINoteStart + 4,
    'Digit6': samplerMIDINoteStart + 5,
    'Digit7': samplerMIDINoteStart + 6,
    'Digit8': samplerMIDINoteStart + 7
    // Can extend to 'Digit9', 'Digit0' or other keys if more pads/slices are common
};

// --- Scale/Key Constants ---
export const AVAILABLE_SCALES = [
    { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'minor', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'harmonic_minor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
    { id: 'melodic_minor', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
    { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
    { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
    { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
    { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    { id: 'pentatonic_major', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
    { id: 'pentatonic_minor', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
    { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
    { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: 'whole_tone', name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10] },
    { id: 'dorian_b9', name: 'Dorian b9', intervals: [0, 1, 3, 5, 7, 9, 10] },
    { id: 'lydian_dom', name: 'Lydian Dominant', intervals: [0, 2, 4, 6, 7, 9, 10] }
];

export const AVAILABLE_KEYS = [
    { id: 'C', name: 'C', semitones: 0 },
    { id: 'C#', name: 'C#', semitones: 1 },
    { id: 'D', name: 'D', semitones: 2 },
    { id: 'D#', name: 'D#', semitones: 3 },
    { id: 'E', name: 'E', semitones: 4 },
    { id: 'F', name: 'F', semitones: 5 },
    { id: 'F#', name: 'F#', semitones: 6 },
    { id: 'G', name: 'G', semitones: 7 },
    { id: 'G#', name: 'G#', semitones: 8 },
    { id: 'A', name: 'A', semitones: 9 },
    { id: 'A#', name: 'A#', semitones: 10 },
    { id: 'B', name: 'B', semitones: 11 }
];

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getScaleNotes(keyRoot, scaleIntervals) {
    const rootSemitones = typeof keyRoot === 'string'
        ? NOTE_NAMES.indexOf(keyRoot.toUpperCase().replace(/b$/, '#').replace('bb', '##'))
        : keyRoot;
    return scaleIntervals.map(interval => {
        const noteIndex = (rootSemitones + interval) % 12;
        return NOTE_NAMES[noteIndex < 0 ? noteIndex + 12 : noteIndex];
    });
}

// --- MIDI Chord Player Constants ---
// Chord voicings mapped to root note semitone offset
export const CHORD_PATTERNS = {
    major: { name: 'Major', intervals: [0, 4, 7] },
    minor: { name: 'Minor', intervals: [0, 3, 7] },
    maj7: { name: 'Major 7th', intervals: [0, 4, 7, 11] },
    min7: { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
    dom7: { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
    dim: { name: 'Diminished', intervals: [0, 3, 6] },
    aug: { name: 'Augmented', intervals: [0, 4, 8] },
    sus2: { name: 'Suspended 2nd', intervals: [0, 2, 7] },
    sus4: { name: 'Suspended 4th', intervals: [0, 5, 7] },
    add9: { name: 'Add 9', intervals: [0, 4, 7, 14] },
    min9: { name: 'Minor 9th', intervals: [0, 3, 7, 10, 14] },
    maj9: { name: 'Major 9th', intervals: [0, 4, 7, 11, 14] },
    '6': { name: '6th', intervals: [0, 4, 7, 9] },
    m6: { name: 'Minor 6th', intervals: [0, 3, 7, 9] }
};

export const MIDI_CHORD_ROOT_NOTES = [
    { note: 'C', semitone: 0 },
    { note: 'C#', semitone: 1 },
    { note: 'D', semitone: 2 },
    { note: 'D#', semitone: 3 },
    { note: 'E', semitone: 4 },
    { note: 'F', semitone: 5 },
    { note: 'F#', semitone: 6 },
    { note: 'G', semitone: 7 },
    { note: 'G#', semitone: 8 },
    { note: 'A', semitone: 9 },
    { note: 'A#', semitone: 10 },
    { note: 'B', semitone: 11 }
];

// --- Trill Notes Constants ---
export const TRILL_NOTES_MIN_TAPS = 2; // Minimum trill taps (2 = single up+down oscillation)
export const TRILL_NOTES_MAX_TAPS = 16; // Maximum trill taps (16 = 8 full up-down oscillations)
export const TRILL_NOTES_DEFAULT_TAPS = 6; // Default 6 taps (~3 cycles of up/down)
export const TRILL_NOTES_MIN_INTERVAL = 1; // Minimum semitone interval from source (unison = no trill)
export const TRILL_NOTES_MAX_INTERVAL = 12; // Maximum semitone interval (1 octave)
export const TRILL_NOTES_DEFAULT_INTERVAL = 2; // Default 2 semitones (whole step) trill
export const TRILL_NOTES_MIN_VELOCITY_FACTOR = 0.5; // Floor for velocity scaling
export const TRILL_NOTES_MAX_VELOCITY_FACTOR = 1.0; // Maximum velocity factor (1.0 = no scaling)
export const TRILL_NOTES_DEFAULT_VELOCITY_FACTOR = 0.95; // Default 95% velocity preservation
export const TRILL_NOTES_DIRECTION_UP = 'up'; // Trill alternates: source, +N, source, +N...
export const TRILL_NOTES_DIRECTION_DOWN = 'down'; // Trill alternates: source, -N, source, -N...
export const TRILL_NOTES_DIRECTION_BOTH = 'both'; // Trill alternates: +N, -N, +N, -N (no source repeats)
export const TRILL_NOTES_DIRECTIONS = [
    TRILL_NOTES_DIRECTION_UP,
    TRILL_NOTES_DIRECTION_DOWN,
    TRILL_NOTES_DIRECTION_BOTH
];

// --- Drift Notes Constants ---
export const DRIFT_NOTES_MIN_MAX_SHIFT = 1; // Minimum drift distance in steps
export const DRIFT_NOTES_MAX_MAX_SHIFT = 8; // Maximum drift distance in steps (1/2 note)
export const DRIFT_NOTES_DEFAULT_MAX_SHIFT = 4; // Default 4 steps (1/4 note) max drift
export const DRIFT_NOTES_MIN_SKIP_CHANCE = 0.0; // Minimum probability of skipping a note
export const DRIFT_NOTES_MAX_SKIP_CHANCE = 0.9; // Maximum probability of skipping a note
export const DRIFT_NOTES_DEFAULT_SKIP_CHANCE = 0.0; // Default: all notes drift
export const DRIFT_NOTES_MIN_VELOCITY_FACTOR = 0.1; // Minimum velocity factor (preserves 10% velocity at floor)
export const DRIFT_NOTES_MAX_VELOCITY_FACTOR = 1.0; // Maximum velocity factor (1.0 = no change)
export const DRIFT_NOTES_DEFAULT_VELOCITY_FACTOR = 0.95; // Default slight attenuation per drift step
export const DRIFT_NOTES_MODE_LINEAR_UP = 'linear-up'; // Shift grows from 0 to maxShift
export const DRIFT_NOTES_MODE_LINEAR_DOWN = 'linear-down'; // Shift shrinks from maxShift to 0
export const DRIFT_NOTES_MODE_LINEAR_CENTER = 'linear-center'; // Shift peaks at the middle of the bar
export const DRIFT_NOTES_MODE_RANDOM_PER_NOTE = 'random-per-note'; // Each note gets a random shift in [-maxShift, +maxShift]
export const DRIFT_NOTES_MODE_MIRROR = 'mirror'; // Mirror of linear-up: notes start spread, then collapse back to origin
export const DRIFT_NOTES_MODES = [
    DRIFT_NOTES_MODE_LINEAR_UP,
    DRIFT_NOTES_MODE_LINEAR_DOWN,
    DRIFT_NOTES_MODE_LINEAR_CENTER,
    DRIFT_NOTES_MODE_RANDOM_PER_NOTE,
    DRIFT_NOTES_MODE_MIRROR
];
// --- Humanize Velocity Constants ---
// Used by Track.humanizeVelocity(amount) and the Humanize Velocity context menu submenu.
export const HUMANIZE_VELOCITY_MIN_AMOUNT = 0.01;       // Minimum randomization (1% of velocity)
export const HUMANIZE_VELOCITY_MAX_AMOUNT = 0.5;        // Maximum randomization (±50% of velocity)
export const HUMANIZE_VELOCITY_DEFAULT_AMOUNT = 0.15;   // Default: 15% velocity variation
export const HUMANIZE_VELOCITY_PRESET_SUBTLE = 0.05;    // Subtle preset (±5%)
export const HUMANIZE_VELOCITY_PRESET_MEDIUM = 0.15;    // Medium preset (±15%)
export const HUMANIZE_VELOCITY_PRESET_HEAVY = 0.30;     // Heavy preset (±30%)
export const HUMANIZE_VELOCITY_PRESET_WILD = 0.50;      // Wild preset (±50%)

// --- Track Role Constants ---
// Roles mark tracks for smart mix presets (e.g. auto-EQ ranges, send levels, pan defaults).
// Stored on Track.role and persisted in project state. Roles are user-assigned metadata.
export const TRACK_ROLE_NONE = 'none';              // Unclassified (default — no role)
export const TRACK_ROLE_BASS = 'bass';              // Bass / sub frequencies
export const TRACK_ROLE_DRUMS = 'drums';            // Drums / percussion
export const TRACK_ROLE_VOCAL = 'vocal';            // Lead / backing vocal
export const TRACK_ROLE_GUITAR = 'guitar';          // Acoustic or electric guitar
export const TRACK_ROLE_KEYS = 'keys';              // Keys / piano / organ
export const TRACK_ROLE_SYNTH = 'synth';            // Synth lead / pad
export const TRACK_ROLE_FX = 'fx';                  // Sound effects / risers / impacts
export const TRACK_ROLE_OTHER = 'other';            // Anything else
export const TRACK_ROLES = [
    TRACK_ROLE_NONE,
    TRACK_ROLE_BASS,
    TRACK_ROLE_DRUMS,
    TRACK_ROLE_VOCAL,
    TRACK_ROLE_GUITAR,
    TRACK_ROLE_KEYS,
    TRACK_ROLE_SYNTH,
    TRACK_ROLE_FX,
    TRACK_ROLE_OTHER
];
export const TRACK_ROLE_LABELS = {
    [TRACK_ROLE_NONE]: 'Unclassified',
    [TRACK_ROLE_BASS]: 'Bass',
    [TRACK_ROLE_DRUMS]: 'Drums',
    [TRACK_ROLE_VOCAL]: 'Vocal',
    [TRACK_ROLE_GUITAR]: 'Guitar',
    [TRACK_ROLE_KEYS]: 'Keys',
    [TRACK_ROLE_SYNTH]: 'Synth',
    [TRACK_ROLE_FX]: 'FX',
    [TRACK_ROLE_OTHER]: 'Other'
};
export const TRACK_ROLE_ICONS = {
    [TRACK_ROLE_NONE]: '⚪',
    [TRACK_ROLE_BASS]: '🔊',
    [TRACK_ROLE_DRUMS]: '🥁',
    [TRACK_ROLE_VOCAL]: '🎤',
    [TRACK_ROLE_GUITAR]: '🎸',
    [TRACK_ROLE_KEYS]: '🎹',
    [TRACK_ROLE_SYNTH]: '🎛️',
    [TRACK_ROLE_FX]: '✨',
    [TRACK_ROLE_OTHER]: '🎵'
};

// js/MIDINoteRepeat.js - Hold a key for auto-repeat at configurable rate

let localAppServices = {};

/**
 * MIDI Note Repeat - Auto-repeat notes when held down
 * Useful for drum programming and rhythmic input
 */

let repeatInterval = null;
let isRepeatActive = false;
let repeatNote = null;
let repeatVelocity = 100;
let repeatRate = 200; // ms between repeats
let repeatOctaveShift = 0;

let originalNoteOnHandler = null;
let originalNoteOffHandler = null;
let noteKeyStates = new Map(); // Map<noteNumber, true>

/**
 * Initialize MIDI Note Repeat
 * @param {object} services - App services
 */
export function initMIDINoteRepeat(services) {
    localAppServices = services;
    console.log('[MIDINoteRepeat] Initialized');
}

/**
 * Configure repeat rate
 * @param {number} rateMs - Milliseconds between repeats
 */
export function setRepeatRate(rateMs) {
    repeatRate = Math.max(50, Math.min(1000, rateMs));
    console.log(`[MIDINoteRepeat] Repeat rate set to ${repeatRate}ms`);
    
    // If currently repeating, restart with new rate
    if (isRepeatActive && repeatInterval) {
        clearInterval(repeatInterval);
        repeatInterval = setInterval(triggerRepeat, repeatRate);
    }
}

/**
 * Set repeat velocity
 * @param {number} vel - Velocity 0-127
 */
export function setRepeatVelocity(vel) {
    repeatVelocity = Math.max(1, Math.min(127, vel));
}

/**
 * Set octave shift for repeats
 * @param {number} shift - Octaves to shift (-2 to +2)
 */
export function setOctaveShift(shift) {
    repeatOctaveShift = Math.max(-2, Math.min(2, shift));
}

/**
 * Start repeating a note
 * @param {number} noteNumber - MIDI note number
 * @param {number} velocity - Note velocity
 */
export function startRepeat(noteNumber, velocity = 100) {
    // Stop any existing repeat
    stopRepeat();
    
    repeatNote = noteNumber + (repeatOctaveShift * 12);
    repeatVelocity = velocity;
    isRepeatActive = true;
    
    // Trigger immediately
    triggerNoteOn(repeatNote, repeatVelocity);
    
    // Start interval
    repeatInterval = setInterval(triggerRepeat, repeatRate);
    
    console.log(`[MIDINoteRepeat] Started repeating note ${repeatNote} at ${repeatRate}ms`);
}

/**
 * Stop repeating
 */
export function stopRepeat() {
    if (repeatInterval) {
        clearInterval(repeatInterval);
        repeatInterval = null;
    }
    
    if (isRepeatActive && repeatNote !== null) {
        triggerNoteOff(repeatNote);
    }
    
    isRepeatActive = false;
    repeatNote = null;
}

/**
 * Trigger note on for repeated note
 */
function triggerRepeat() {
    if (!isRepeatActive || repeatNote === null) return;
    
    // Trigger note off then note on quickly
    triggerNoteOff(repeatNote);
    triggerNoteOn(repeatNote, repeatVelocity);
}

/**
 * Trigger note on via app services
 */
function triggerNoteOn(noteNumber, velocity) {
    if (localAppServices.playNoteOn) {
        localAppServices.playNoteOn(noteNumber, velocity);
    }
    if (localAppServices.sendNoteOn) {
        localAppServices.sendNoteOn(noteNumber, velocity);
    }
}

/**
 * Trigger note off via app services
 */
function triggerNoteOff(noteNumber) {
    if (localAppServices.playNoteOff) {
        localAppServices.playNoteOff(noteNumber);
    }
    if (localAppServices.sendNoteOff) {
        localAppServices.sendNoteOff(noteNumber);
    }
}

/**
 * Open the MIDI Note Repeat settings panel
 */
export function openMIDINoteRepeatPanel() {
    const existing = document.getElementById('midi-note-repeat-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'midi-note-repeat-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 12px;
        padding: 20px;
        width: 340px;
        color: white;
        font-family: system-ui;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 16px;">🥁 MIDI Note Repeat</h2>
            <button id="close-note-repeat" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Repeat Rate</label>
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="range" id="repeat-rate-slider" min="50" max="500" value="${repeatRate}" step="10" style="flex: 1;">
                <span id="repeat-rate-value" style="min-width: 50px; text-align: right; font-size: 13px;">${repeatRate}ms</span>
            </div>
            <div style="display: flex; gap: 4px; margin-top: 8px;">
                ${[50, 100, 200, 300, 500].map(v => `<button class="rate-preset" data-rate="${v}" style="flex: 1; padding: 6px; background: ${repeatRate === v ? '#3b82f6' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">${v}</button>`).join('')}
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Velocity</label>
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="range" id="repeat-velocity-slider" min="1" max="127" value="${repeatVelocity}" style="flex: 1;">
                <span id="repeat-velocity-value" style="min-width: 35px; text-align: right; font-size: 13px;">${repeatVelocity}</span>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Octave Shift</label>
            <div style="display: flex; gap: 4px;">
                ${[-2, -1, 0, 1, 2].map(v => `<button class="octave-preset" data-octave="${v}" style="flex: 1; padding: 6px; background: ${repeatOctaveShift === v ? '#3b82f6' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">${v > 0 ? '+' + v : v}</button>`).join('')}
            </div>
        </div>
        
        <div style="background: #111; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Status</div>
            <div id="repeat-status" style="font-size: 14px; color: #888;">Inactive</div>
        </div>
        
        <div style="font-size: 11px; color: #666; line-height: 1.6;">
            <strong>How to use:</strong><br>
            1. Enable MIDI input in settings<br>
            2. Hold down a key on your MIDI keyboard<br>
            3. The note will auto-repeat at the set rate<br>
            4. Release to stop
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    panel.querySelector('#close-note-repeat').addEventListener('click', () => panel.remove());
    
    // Escape to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Rate slider
    panel.querySelector('#repeat-rate-slider').addEventListener('input', (e) => {
        const rate = parseInt(e.target.value);
        setRepeatRate(rate);
        panel.querySelector('#repeat-rate-value').textContent = rate + 'ms';
        updateRatePresets(panel, rate);
    });
    
    // Rate presets
    panel.querySelectorAll('.rate-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const rate = parseInt(btn.dataset.rate);
            setRepeatRate(rate);
            panel.querySelector('#repeat-rate-slider').value = rate;
            panel.querySelector('#repeat-rate-value').textContent = rate + 'ms';
            updateRatePresets(panel, rate);
        });
    });
    
    // Velocity slider
    panel.querySelector('#repeat-velocity-slider').addEventListener('input', (e) => {
        const vel = parseInt(e.target.value);
        setRepeatVelocity(vel);
        panel.querySelector('#repeat-velocity-value').textContent = vel;
    });
    
    // Octave presets
    panel.querySelectorAll('.octave-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const octave = parseInt(btn.dataset.octave);
            setOctaveShift(octave);
            updateOctavePresets(panel, octave);
        });
    });
}

function updateRatePresets(panel, rate) {
    panel.querySelectorAll('.rate-preset').forEach(btn => {
        btn.style.background = parseInt(btn.dataset.rate) === rate ? '#3b82f6' : '#333';
    });
}

function updateOctavePresets(panel, octave) {
    panel.querySelectorAll('.octave-preset').forEach(btn => {
        btn.style.background = parseInt(btn.dataset.octave) === octave ? '#3b82f6' : '#333';
    });
}

/**
 * Check if a MIDI keyboard key is being held
 * Called from MIDI input handler
 */
export function onMIDINoteOn(noteNumber, velocity) {
    // Mark note as held
    noteKeyStates.set(noteNumber, true);
    
    // Only start repeat if this is a "hold" (not just a quick tap)
    // We detect this by starting a short timer and checking if note is still held
    setTimeout(() => {
        if (noteKeyStates.get(noteNumber)) {
            // Note is still held after 100ms, start repeating
            startRepeat(noteNumber, velocity);
        }
    }, 100);
}

/**
 * Called when MIDI note off is received
 */
export function onMIDINoteOff(noteNumber) {
    noteKeyStates.delete(noteNumber);
    
    // Stop repeat if this was the repeating note
    if (repeatNote === noteNumber) {
        stopRepeat();
    }
}

/**
 * Get current state
 */
export function getMIDINoteRepeatState() {
    return {
        isActive: isRepeatActive,
        currentNote: repeatNote,
        rate: repeatRate,
        velocity: repeatVelocity,
        octaveShift: repeatOctaveShift
    };
}

export default {
    initMIDINoteRepeat,
    openMIDINoteRepeatPanel,
    setRepeatRate,
    setRepeatVelocity,
    setOctaveShift,
    startRepeat,
    stopRepeat,
    onMIDINoteOn,
    onMIDINoteOff,
    getMIDINoteRepeatState
};
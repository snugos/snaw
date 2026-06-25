// js/MIDITapTempo.js - MIDI Controller Pad as Tap-Tempo Source (v0.3.75)
// Lets the user assign a specific MIDI note (e.g. a drum-pad or a controller button)
// as the tap-tempo trigger. The next note-on matching the filter is fed into the
// same tap-tempo pipeline as the keyboard `T` key and the AudioTapTempo panel.
//
// Usage:
//   import { initMIDITapTempo, openMIDITapTempoPanel, handleMIDITapMessage } from './MIDITapTempo.js';
//   initMIDITapTempo(localAppServices);
//   // In handleMIDIMessage, before per-track dispatch:
//   handleMIDITapMessage(status, data1, data2, channel);
//
// Persistence:
//   - enabled: bool
//   - noteFilter: 'any' | MIDI note number (string-encoded number)
//   - channelFilter: 'any' | 1..16
//   - velocityMin: 1..127 (default 1 — accept any non-zero velocity)
//   - autoApplyBpm: bool — whether to push the detected BPM to Tone.Transport

let localAppServices = {};
let isInitialized = false;

// --- Persistent settings ---
const STORAGE_KEY = 'snaw_midi_tap_tempo_v1';

let settings = {
    enabled: false,
    noteFilter: 'any',        // 'any' or '60' (middle C) etc.
    channelFilter: 'any',     // 'any' or '1'..'16'
    velocityMin: 1,           // ignore note-ons below this velocity
    autoApplyBpm: true        // push detected BPM to Tone.Transport
};

// --- Panel state ---
let panelElement = null;
let panelVisible = false;
let isLearning = false;       // "Learn note" mode: next note-on assigns noteFilter
let lastTapAt = 0;            // for visual pulse + log throttling
let lastAppliedBpm = null;
let tapCount = 0;

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.enabled === 'boolean') settings.enabled = parsed.enabled;
        if (typeof parsed.noteFilter === 'string') settings.noteFilter = parsed.noteFilter;
        if (typeof parsed.channelFilter === 'string') settings.channelFilter = parsed.channelFilter;
        if (typeof parsed.velocityMin === 'number') settings.velocityMin = Math.max(1, Math.min(127, Math.round(parsed.velocityMin)));
        if (typeof parsed.autoApplyBpm === 'boolean') settings.autoApplyBpm = parsed.autoApplyBpm;
        console.log('[MIDITapTempo] Loaded settings:', settings);
    } catch (e) {
        console.warn('[MIDITapTempo] Failed to load settings:', e);
    }
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('[MIDITapTempo] Failed to save settings:', e);
    }
}

loadSettings();

/**
 * Initialize the MIDITapTempo module.
 * @param {Object} services - App services from main.js
 */
export function initMIDITapTempo(services) {
    localAppServices = services || {};
    isInitialized = true;
    console.log('[MIDITapTempo] Initialized. Enabled =', settings.enabled,
        'noteFilter =', settings.noteFilter, 'channelFilter =', settings.channelFilter);
}

/**
 * Check whether a (status, data1, data2, channel) MIDI message matches the
 * configured tap-tempo filter. Returns true if it should be treated as a tap.
 */
export function matchesMIDITapFilter(status, data1, data2, channel) {
    if (!settings.enabled) return false;
    const command = status & 0xF0;
    // Only note-on (144) with non-zero velocity counts as a tap.
    if (command !== 144) return false;
    const velocity = data2;
    if (velocity < settings.velocityMin) return false;

    // Channel filter: channel is 0-indexed; settings.channelFilter is 1-indexed ('1'..'16') or 'any'.
    if (settings.channelFilter !== 'any') {
        const wantCh = parseInt(settings.channelFilter, 10);
        if (!isNaN(wantCh) && (channel + 1) !== wantCh) return false;
    }

    // Note filter: 'any' or specific MIDI note number.
    if (settings.noteFilter !== 'any') {
        const wantNote = parseInt(settings.noteFilter, 10);
        if (!isNaN(wantNote) && data1 !== wantNote) return false;
    }

    return true;
}

/**
 * Handle a MIDI note-on as a tap. Called from eventHandlers.handleMIDIMessage
 * before per-track dispatch. Returns true if the message was consumed as a tap.
 */
export async function handleMIDITapMessage(status, data1, data2, channel) {
    if (!isInitialized) return false;

    // Learning mode: capture the next note-on as the note filter, but do NOT count
    // it as a tap (user is configuring, not tapping).
    if (isLearning) {
        const command = status & 0xF0;
        if (command === 144 && data2 > 0) {
            settings.noteFilter = String(data1);
            isLearning = false;
            saveSettings();
            updatePanelUI();
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`MIDI Tap: note ${midiNoteName(data1)} (${data1}) bound.`, 2500);
            }
            console.log('[MIDITapTempo] Learned note filter:', settings.noteFilter);
            return true; // Consume so the armed track doesn't also fire
        }
        return false;
    }

    if (!matchesMIDITapFilter(status, data1, data2, channel)) return false;

    // Avoid double-counting: if we got two events in < 5ms, ignore the second.
    const now = performance.now();
    if (now - lastTapAt < 5) return true;
    lastTapAt = now;
    tapCount++;

    // Defer to ui.handleTapTempo() for BPM calculation (same path as `T` key)
    // so all the TapHistoryUI / TapTempoVisual hooks fire consistently.
    let detectedBpm = null;
    try {
        const ui = await import('./ui.js');
        if (typeof ui.handleTapTempo === 'function') {
            detectedBpm = ui.handleTapTempo();
        }
    } catch (e) {
        console.warn('[MIDITapTempo] Failed to import ui.js for handleTapTempo:', e);
        return false;
    }

    // Visual: pulse the indicator + log.
    pulsePanelTap();
    console.log(`[MIDITapTempo] Tap #${tapCount} (note ${data1} ch${channel + 1} vel${data2})` +
        (detectedBpm != null ? ` → ${detectedBpm} BPM` : ''));

    // Auto-apply to transport (optional).
    if (settings.autoApplyBpm && detectedBpm != null && typeof Tone !== 'undefined' && Tone.Transport) {
        try {
            const clamped = Math.max(20, Math.min(300, detectedBpm));
            Tone.Transport.bpm.value = clamped;
            lastAppliedBpm = clamped;
            if (localAppServices.captureStateForUndo) {
                try { localAppServices.captureStateForUndo(`MIDI Tap Tempo: ${clamped} BPM`); } catch (_) {}
            }
            console.log('[MIDITapTempo] Applied BPM:', clamped);
        } catch (e) {
            console.warn('[MIDITapTempo] Failed to apply BPM:', e);
        }
    }

    // Update panel live display.
    if (panelVisible) {
        const bpmEl = panelElement?.querySelector('.midi-tap-bpm');
        const tapEl = panelElement?.querySelector('.midi-tap-count');
        if (bpmEl) bpmEl.textContent = detectedBpm != null ? `${detectedBpm} BPM` : '-- BPM';
        if (tapEl) tapEl.textContent = `${tapCount} tap${tapCount === 1 ? '' : 's'}`;
    }

    return true; // Consume — don't also dispatch this note to an armed track.
}

/**
 * Convert a MIDI note number to its conventional name (e.g. 60 → "C4").
 */
export function midiNoteName(noteNumber) {
    if (typeof noteNumber !== 'number' || noteNumber < 0 || noteNumber > 127) return '?';
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const name = names[noteNumber % 12];
    return `${name}${octave}`;
}

// --- Public API for settings ---

export function isMIDITapTempoEnabled() { return settings.enabled; }
export function setMIDITapTempoEnabled(v) {
    settings.enabled = !!v;
    saveSettings();
    if (panelVisible) updatePanelUI();
}
export function getNoteFilter() { return settings.noteFilter; }
export function setNoteFilter(v) {
    settings.noteFilter = (v === 'any') ? 'any' : String(parseInt(v, 10) || 'any');
    saveSettings();
}
export function getChannelFilter() { return settings.channelFilter; }
export function setChannelFilter(v) {
    settings.channelFilter = (v === 'any') ? 'any' : String(parseInt(v, 10) || 'any');
    saveSettings();
}
export function getVelocityMin() { return settings.velocityMin; }
export function setVelocityMin(v) {
    settings.velocityMin = Math.max(1, Math.min(127, Math.round(v) || 1));
    saveSettings();
}
export function isAutoApplyBpm() { return settings.autoApplyBpm; }
export function setAutoApplyBpm(v) { settings.autoApplyBpm = !!v; saveSettings(); }
export function isLearningNote() { return isLearning; }
export function startLearnNote() {
    isLearning = true;
    if (localAppServices.showNotification) {
        localAppServices.showNotification('MIDI Tap Tempo: press a pad/note to bind…', 3000);
    }
    if (panelVisible) updatePanelUI();
}
export function cancelLearnNote() {
    isLearning = false;
    if (panelVisible) updatePanelUI();
}
export function getTapCount() { return tapCount; }
export function getLastAppliedBpm() { return lastAppliedBpm; }
export function resetTapCount() {
    tapCount = 0;
    lastAppliedBpm = null;
    if (panelVisible) updatePanelUI();
}

// --- Panel UI ---

export function toggleMIDITapTempoPanel() {
    if (panelVisible) closeMIDITapTempoPanel();
    else openMIDITapTempoPanel();
}

export function openMIDITapTempoPanel() {
    if (panelElement) {
        panelElement.style.display = 'flex';
        panelVisible = true;
        updatePanelUI();
        return;
    }
    panelElement = document.createElement('div');
    panelElement.id = 'midi-tap-tempo-panel';
    panelElement.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: rgba(20, 20, 28, 0.96);
        border: 1px solid #555;
        border-radius: 10px;
        padding: 16px 18px;
        color: #eee;
        font-family: system-ui, sans-serif;
        font-size: 12px;
        z-index: 10000;
        min-width: 280px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    document.body.appendChild(panelElement);
    panelVisible = true;
    updatePanelUI();
}

export function closeMIDITapTempoPanel() {
    if (panelElement) {
        panelElement.remove();
        panelElement = null;
    }
    panelVisible = false;
}

function pulsePanelTap() {
    if (!panelElement) return;
    const indicator = panelElement.querySelector('.midi-tap-indicator');
    if (!indicator) return;
    indicator.style.transform = 'scale(1.4)';
    indicator.style.background = '#00ffcc';
    indicator.style.boxShadow = '0 0 14px #00ffcc';
    setTimeout(() => {
        if (!indicator) return;
        indicator.style.transform = 'scale(1)';
        indicator.style.background = '#7c3aed';
        indicator.style.boxShadow = '0 0 6px rgba(124,58,237,0.5)';
    }, 120);
}

function updatePanelUI() {
    if (!panelElement) return;

    const filterLabel = settings.noteFilter === 'any'
        ? 'Any note'
        : `${midiNoteName(parseInt(settings.noteFilter, 10))} (${settings.noteFilter})`;
    const channelLabel = settings.channelFilter === 'any' ? 'Any ch' : `Ch ${settings.channelFilter}`;

    panelElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 13px; letter-spacing: 0.3px;">MIDI TAP TEMPO</span>
            <button class="midi-tap-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px; line-height: 1; padding: 0;">&times;</button>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
            <div class="midi-tap-indicator" style="
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #7c3aed;
                box-shadow: 0 0 6px rgba(124,58,237,0.5);
                transition: all 0.12s ease;
                flex-shrink: 0;
            "></div>
            <div style="flex: 1;">
                <div class="midi-tap-bpm" style="font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px;">
                    ${lastAppliedBpm != null ? `${lastAppliedBpm} BPM` : '-- BPM'}
                </div>
                <div class="midi-tap-count" style="font-size: 10px; color: #888;">
                    ${tapCount} tap${tapCount === 1 ? '' : 's'}
                </div>
            </div>
        </div>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" class="midi-tap-enabled" ${settings.enabled ? 'checked' : ''} />
            <span>Enable MIDI tap input</span>
        </label>

        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #aaa; flex: 1;">Note filter:</span>
            <span class="midi-tap-note-label" style="font-weight: 600; min-width: 80px; text-align: right;">${filterLabel}</span>
            <button class="midi-tap-learn" style="
                padding: 4px 10px;
                background: ${isLearning ? '#00ffcc' : '#333'};
                color: ${isLearning ? '#000' : '#eee'};
                border: 1px solid #555;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
            ">${isLearning ? 'Press note…' : 'Learn'}</button>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #aaa; flex: 1;">Channel:</span>
            <select class="midi-tap-channel" style="background: #2a2a2a; border: 1px solid #444; color: #eee; padding: 3px 6px; border-radius: 4px; cursor: pointer;">
                <option value="any" ${settings.channelFilter === 'any' ? 'selected' : ''}>Any</option>
                ${Array.from({length: 16}, (_, i) => i + 1).map(n =>
                    `<option value="${n}" ${settings.channelFilter === String(n) ? 'selected' : ''}>${n}</option>`
                ).join('')}
            </select>
        </div>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <span style="color: #aaa; flex: 1;">Auto-apply BPM to transport:</span>
            <input type="checkbox" class="midi-tap-autoapply" ${settings.autoApplyBpm ? 'checked' : ''} />
        </label>

        <div style="font-size: 10px; color: #555; line-height: 1.4;">
            ${isLearning
                ? '<span style="color:#00ffcc;">Press any pad to bind it as the tap trigger.</span>'
                : 'Hit your bound pad repeatedly to set tempo. Same pipeline as the <kbd>T</kbd> key.'}
        </div>
    `;

    panelElement.querySelector('.midi-tap-close').addEventListener('click', closeMIDITapTempoPanel);
    panelElement.querySelector('.midi-tap-enabled').addEventListener('change', (e) => {
        setMIDITapTempoEnabled(e.target.checked);
    });
    panelElement.querySelector('.midi-tap-channel').addEventListener('change', (e) => {
        setChannelFilter(e.target.value);
        updatePanelUI();
    });
    panelElement.querySelector('.midi-tap-learn').addEventListener('click', () => {
        if (isLearning) cancelLearnNote();
        else startLearnNote();
    });
    panelElement.querySelector('.midi-tap-autoapply').addEventListener('change', (e) => {
        setAutoApplyBpm(e.target.checked);
    });
}

/**
 * Convenience: bind a global keyboard shortcut for opening the panel (Ctrl/Cmd+Shift+M).
 */
export function installGlobalKeyShortcut() {
    if (typeof window === 'undefined') return;
    if (window._midiTapTempoKeyHandlerInstalled) return;
    window._midiTapTempoKeyHandlerInstalled = true;
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
            e.preventDefault();
            toggleMIDITapTempoPanel();
        }
    });
}

// Mirror to window for ad-hoc console / debugging access.
if (typeof window !== 'undefined') {
    window.MIDITapTempo = {
        initMIDITapTempo,
        handleMIDITapMessage,
        matchesMIDITapFilter,
        isMIDITapTempoEnabled,
        setMIDITapTempoEnabled,
        getNoteFilter, setNoteFilter,
        getChannelFilter, setChannelFilter,
        getVelocityMin, setVelocityMin,
        isAutoApplyBpm, setAutoApplyBpm,
        isLearningNote, startLearnNote, cancelLearnNote,
        getTapCount, getLastAppliedBpm, resetTapCount,
        openMIDITapTempoPanel, closeMIDITapTempoPanel, toggleMIDITapTempoPanel,
        midiNoteName,
        installGlobalKeyShortcut
    };
}

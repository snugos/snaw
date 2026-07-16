// js/audio.js - Audio Engine, Tone.js interactions, Sample Loading
import * as Constants from './constants.js';
// showNotification will be accessed via localAppServices
// import { showNotification } from './utils.js'; // Not directly imported, accessed via appServices
import { createEffectInstance } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';
import { getRecordingStartTimeState, getAdaptiveMetronomeEnabled, getAdaptiveTimingOffset, getMetronomeVolume as getMetronomeVolumeState, setMetronomeVolume as setMetronomeVolumeState } from './state.js';
import { isBeatAccented } from './MetronomeAccentPatterns.js';


let masterEffectsBusInputNode = null;
let masterGainNodeActual = null; // The actual Tone.Gain node for master volume
let masterMeterNode = null;
let masterAnalyserNode = null; // FFT analyser for spectrum visualization
let activeMasterEffectNodes = new Map();
let masterLimiterNode = null; // Master brick-wall limiter (Tone.Limiter); null until first call to getMasterLimiterNode()
let masterLimiterEnabled = false; // True when the limiter is engaged in the master chain
let masterLimiterThresholdDb = -0.1; // dBFS threshold (Tone.Limiter.threshold); -0.1 default
let masterLimiterCeilingDb = -0.3; // informational display value (we don't have a separate ceiling on Tone.Limiter; it acts as a hard ceiling via its threshold)

let audioContextInitialized = false;

let localAppServices = {};

// Variables for audio recording
let mic = null;
let recorder = null;

// --- Send/Return Bus Infrastructure ---
const SEND_BUSES = {
    reverb: { id: 'reverb', name: 'Reverb', node: null, returnGain: null, wetGain: null, dryGain: null },
    delay: { id: 'delay', name: 'Delay', node: null, returnGain: null, wetGain: null, dryGain: null }
};

// Track send levels: Map<trackId, Map<busId, sendLevel>>
const trackSendLevels = new Map();

// --- Sidechain Infrastructure ---
let sidechainBusNode = null; // The bus that receives sidechain trigger signals
let sidechainCompressorNode = null; // The compressor that ducks the destination
const sidechainRouting = new Map(); // Map<sourceTrackId, Set<destinationTrackIds>>
const sidechainSettings = {
    threshold: -30, // dB
    ratio: 4,
    attack: 0.01, // seconds
    release: 0.25 // seconds
};

/**
 * Sets up send buses (Reverb, Delay) with return channels.
 * Should be called after master bus setup.
 */
function setupSendBuses() {
    console.log('[Audio setupSendBuses] Setting up send buses...');
    
    // Setup Reverb bus
    if (!SEND_BUSES.reverb.node || SEND_BUSES.reverb.node.disposed) {
        try {
            SEND_BUSES.reverb.node = new Tone.Reverb({ decay: 2.5, wet: 0.5 });
            SEND_BUSES.reverb.returnGain = new Tone.Gain(0.7);
            SEND_BUSES.reverb.wetGain = new Tone.Gain(0.5);
            SEND_BUSES.reverb.dryGain = new Tone.Gain(1);
            
            // Connect: wet signal through reverb to return gain
            SEND_BUSES.reverb.wetGain.connect(SEND_BUSES.reverb.node);
            SEND_BUSES.reverb.node.connect(SEND_BUSES.reverb.returnGain);
            SEND_BUSES.reverb.returnGain.connect(masterGainNodeActual || Tone.Destination);
            
            console.log('[Audio setupSendBuses] Reverb bus created.');
        } catch (e) {
            console.error('[Audio setupSendBuses] Error creating Reverb bus:', e);
        }
    }
    
    // Setup Delay bus
    if (!SEND_BUSES.delay.node || SEND_BUSES.delay.node.disposed) {
        try {
            SEND_BUSES.delay.node = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.5 });
            SEND_BUSES.delay.returnGain = new Tone.Gain(0.6);
            SEND_BUSES.delay.wetGain = new Tone.Gain(0.5);
            SEND_BUSES.delay.dryGain = new Tone.Gain(1);
            
            // Connect: wet signal through delay to return gain
            SEND_BUSES.delay.wetGain.connect(SEND_BUSES.delay.node);
            SEND_BUSES.delay.node.connect(SEND_BUSES.delay.returnGain);
            SEND_BUSES.delay.returnGain.connect(masterGainNodeActual || Tone.Destination);
            
            console.log('[Audio setupSendBuses] Delay bus created.');
        } catch (e) {
            console.error('[Audio setupSendBuses] Error creating Delay bus:', e);
        }
    }
}

/**
 * Gets the input node for a send bus (where tracks connect their sends).
 * @param {string} busId - The bus ID ('reverb' or 'delay')
 * @returns {Tone.Gain|null}
 */
export function getSendBusInputNode(busId) {
    const bus = SEND_BUSES[busId];
    if (!bus) {
        console.warn(`[Audio getSendBusInputNode] Unknown bus ID: ${busId}`);
        return null;
    }
    if (!bus.wetGain || bus.wetGain.disposed) {
        setupSendBuses();
    }
    return bus.wetGain;
}

/**
 * Gets the return gain node for a send bus.
 * @param {string} busId - The bus ID
 * @returns {Tone.Gain|null}
 */
export function getSendBusReturnGain(busId) {
    const bus = SEND_BUSES[busId];
    return bus?.returnGain || null;
}

/**
 * Gets all available send bus IDs.
 * @returns {string[]}
 */
export function getAvailableSendBuses() {
    return Object.keys(SEND_BUSES);
}

/**
 * Gets the send bus info for UI display.
 * @returns {Array<{id: string, name: string, hasEffect: boolean}>}
 */
export function getSendBusesInfo() {
    return Object.values(SEND_BUSES).map(bus => ({
        id: bus.id,
        name: bus.name,
        hasEffect: !!(bus.node && !bus.node.disposed)
    }));
}

/**
 * Sets the send level for a track to a specific bus.
 * @param {number} trackId - The track ID
 * @param {string} busId - The bus ID
 * @param {number} level - Send level (0-1)
 */
export function setTrackSendLevel(trackId, busId, level) {
    if (!trackSendLevels.has(trackId)) {
        trackSendLevels.set(trackId, new Map());
    }
    trackSendLevels.get(trackId).set(busId, Math.max(0, Math.min(1, level)));
    console.log(`[Audio setTrackSendLevel] Track ${trackId} -> ${busId}: ${level}`);
}

/**
 * Gets the send level for a track to a specific bus.
 * @param {number} trackId - The track ID
 * @param {string} busId - The bus ID
 * @returns {number} Send level (0-1), default 0
 */
export function getTrackSendLevel(trackId, busId) {
    const trackSends = trackSendLevels.get(trackId);
    return trackSends?.get(busId) || 0;
}

/**
 * Sets the return level for a send bus.
 * @param {string} busId - The bus ID
 * @param {number} level - Return level (0-1)
 */
export function setSendBusReturnLevel(busId, level) {
    const bus = SEND_BUSES[busId];
    if (bus?.returnGain && !bus.returnGain.disposed) {
        bus.returnGain.gain.value = Math.max(0, Math.min(1, level));
        console.log(`[Audio setSendBusReturnLevel] ${busId} return: ${level}`);
    }
}

/**
 * Gets the return level for a send bus.
 * @param {string} busId - The bus ID
 * @returns {number} Return level (0-1)
 */
export function getSendBusReturnLevel(busId) {
    const bus = SEND_BUSES[busId];
    return bus?.returnGain?.gain?.value || 0.5;
}

/**
 * Sets the wet/dry mix for a send bus effect.
 * @param {string} busId - The bus ID
 * @param {number} wet - Wet level (0-1)
 */
export function setSendBusWet(busId, wet) {
    const bus = SEND_BUSES[busId];
    if (bus?.node && !bus.node.disposed && bus.node.wet) {
        bus.node.wet.value = Math.max(0, Math.min(1, wet));
    }
    if (bus?.wetGain && !bus.wetGain.disposed) {
        bus.wetGain.gain.value = Math.max(0, Math.min(1, wet));
    }
}

// --- Sidechain Functions ---

/**
 * Gets the sidechain bus node (for receiving trigger signals).
 * @returns {Tone.Gain|null}
 */
export function getSidechainBusNode() {
    if (!sidechainBusNode || sidechainBusNode.disposed) {
        setupSidechainInfrastructure();
    }
    return sidechainBusNode;
}

/**
 * Sets up the sidechain infrastructure.
 */
function setupSidechainInfrastructure() {
    console.log('[Audio setupSidechainInfrastructure] Setting up sidechain...');
    
    if (!sidechainBusNode || sidechainBusNode.disposed) {
        sidechainBusNode = new Tone.Gain(1);
        console.log('[Audio setupSidechainInfrastructure] Sidechain bus node created.');
    }
    
    if (!sidechainCompressorNode || sidechainCompressorNode.disposed) {
        sidechainCompressorNode = new Tone.Compressor({
            threshold: sidechainSettings.threshold,
            ratio: sidechainSettings.ratio,
            attack: sidechainSettings.attack,
            release: sidechainSettings.release
        });
        console.log('[Audio setupSidechainInfrastructure] Sidechain compressor created.');
    }
}

/**
 * Sets up sidechain routing from a source track to a destination track.
 * @param {number} sourceTrackId - The track that triggers sidechain
 * @param {number} destinationTrackId - The track that gets ducked
 * @returns {boolean} Success
 */
export function setupSidechainRouting(sourceTrackId, destinationTrackId) {
    setupSidechainInfrastructure();
    
    if (!sidechainRouting.has(sourceTrackId)) {
        sidechainRouting.set(sourceTrackId, new Set());
    }
    sidechainRouting.get(sourceTrackId).add(destinationTrackId);
    
    console.log(`[Audio setupSidechainRouting] Sidechain routing: Track ${sourceTrackId} -> Track ${destinationTrackId}`);
    return true;
}

/**
 * Removes sidechain routing from source to destination.
 * @param {number} sourceTrackId
 * @param {number} destinationTrackId
 */
export function removeSidechainRouting(sourceTrackId, destinationTrackId) {
    const destinations = sidechainRouting.get(sourceTrackId);
    if (destinations) {
        destinations.delete(destinationTrackId);
        if (destinations.size === 0) {
            sidechainRouting.delete(sourceTrackId);
        }
    }
    console.log(`[Audio removeSidechainRouting] Removed sidechain: Track ${sourceTrackId} -> Track ${destinationTrackId}`);
}

/**
 * Clears all sidechain routing for a track.
 * @param {number} trackId - Can be source or destination
 */
export function clearAllSidechainForTrack(trackId) {
    // Remove as source
    sidechainRouting.delete(trackId);
    
    // Remove as destination
    for (const [sourceId, destinations] of sidechainRouting) {
        destinations.delete(trackId);
        if (destinations.size === 0) {
            sidechainRouting.delete(sourceId);
        }
    }
    console.log(`[Audio clearAllSidechainForTrack] Cleared all sidechain routing for track ${trackId}`);
}

/**
 * Gets all sidechain destinations for a source track.
 * @param {number} sourceTrackId
 * @returns {number[]} Array of destination track IDs
 */
export function getSidechainDestinations(sourceTrackId) {
    const destinations = sidechainRouting.get(sourceTrackId);
    return destinations ? Array.from(destinations) : [];
}

/**
 * Checks if a track has sidechain routing (as source or destination).
 * @param {number} trackId
 * @returns {{isSource: boolean, isDestination: boolean, sources: number[], destinations: number[]}}
 */
export function getTrackSidechainInfo(trackId) {
    const destinations = sidechainRouting.get(trackId) || new Set();
    const sources = [];
    
    for (const [sourceId, destSet] of sidechainRouting) {
        if (destSet.has(trackId)) {
            sources.push(sourceId);
        }
    }
    
    return {
        isSource: destinations.size > 0,
        isDestination: sources.length > 0,
        sources,
        destinations: Array.from(destinations)
    };
}

/**
 * Triggers sidechain ducking for tracks routed from the given source.
 * Called when the source track plays a note.
 * @param {number} sourceTrackId - The source track ID
 * @param {number} duration - Duration of the duck in seconds (default: 0.25)
 */
export function triggerSidechainForTrack(sourceTrackId, duration = 0.25) {
    const destinations = sidechainRouting.get(sourceTrackId);
    if (!destinations || destinations.size === 0) return;
    
    const now = Tone.now();
    const duckAmount = 0.3; // Duck to 30% volume
    const releaseTime = duration;
    
    for (const destTrackId of destinations) {
        const track = localAppServices.getTrackById ? localAppServices.getTrackById(destTrackId) : null;
        if (track?.gainNode && !track.gainNode.disposed) {
            const currentGain = track.gainNode.gain.value;
            
            // Duck down
            track.gainNode.gain.cancelScheduledValues(now);
            track.gainNode.gain.setValueAtTime(currentGain, now);
            track.gainNode.gain.linearRampToValueAtTime(currentGain * duckAmount, now + 0.01);
            
            // Return to normal
            track.gainNode.gain.linearRampToValueAtTime(currentGain, now + releaseTime);
        }
    }
}

/**
 * Updates sidechain compressor settings.
 * @param {Object} settings - { threshold, ratio, attack, release }
 */
export function updateSidechainSettings(settings) {
    if (settings.threshold !== undefined) sidechainSettings.threshold = settings.threshold;
    if (settings.ratio !== undefined) sidechainSettings.ratio = settings.ratio;
    if (settings.attack !== undefined) sidechainSettings.attack = settings.attack;
    if (settings.release !== undefined) sidechainSettings.release = settings.release;
    
    if (sidechainCompressorNode && !sidechainCompressorNode.disposed) {
        if (settings.threshold !== undefined) sidechainCompressorNode.threshold.value = settings.threshold;
        if (settings.ratio !== undefined) sidechainCompressorNode.ratio.value = settings.ratio;
        if (settings.attack !== undefined) sidechainCompressorNode.attack.value = settings.attack;
        if (settings.release !== undefined) sidechainCompressorNode.release.value = settings.release;
    }
    
    console.log('[Audio updateSidechainSettings] Updated:', sidechainSettings);
}

/**
 * Gets current sidechain settings.
 * @returns {Object}
 */
export function getSidechainSettings() {
    return { ...sidechainSettings };
}

// --- Metronome ---
let metronomeSynth = null;
let metronomeGain = null;

/**
 * Initializes the metronome synth.
 */
function initMetronome() {
    if (metronomeSynth) return;
    
    try {
        metronomeSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 }
        });
        metronomeGain = new Tone.Gain(0.5);
        metronomeSynth.connect(metronomeGain);
        metronomeGain.connect(Tone.Destination);
        console.log('[Audio initMetronome] Metronome synth initialized.');
    } catch (e) {
        console.error('[Audio initMetronome] Error initializing metronome:', e);
    }
}

function triggerMetronomeVisualFlash(isDownbeat) {
    const btn = document.getElementById('metronomeToggleBtnGlobal');
    if (!btn) return;
    
    // Flash colors: downbeat = red, regular beat = orange
    const flashColor = isDownbeat ? '#ef4444' : '#f97316';
    const originalBg = btn.style.backgroundColor || '';
    const originalBoxShadow = btn.style.boxShadow || '';
    
    btn.style.backgroundColor = flashColor;
    btn.style.boxShadow = `0 0 12px ${flashColor}`;
    
    setTimeout(() => {
        btn.style.backgroundColor = originalBg;
        btn.style.boxShadow = originalBoxShadow;
    }, 100);
}

/**
 * Plays a metronome click.
 * @param {boolean} isDownbeat - True for downbeat (high pitch), false for upbeat (low pitch)
 * @param {number} time - Tone.js time to schedule the click
 */
export function playMetronomeClick(isDownbeat = true, time) {
    if (!metronomeSynth || metronomeSynth.disposed) {
        initMetronome();
    }
    
    if (!metronomeSynth) return;
    
    const freq = isDownbeat ? 1200 : 440; // E6 (D#6) for downbeat, A4 for upbeat - higher pitch on downbeat
    const duration = '16n';
    
    try {
        if (time !== undefined) {
            metronomeSynth.triggerAttackRelease(freq, duration, time);
        } else {
            metronomeSynth.triggerAttackRelease(freq, duration);
        }
    } catch (e) {
        console.error('[Audio playMetronomeClick] Error playing metronome:', e);
    }
    
    // --- Visual Beat Flash ---
    triggerMetronomeVisualFlash(isDownbeat);
}

/**
 * Sets the metronome volume.
 * @param {number} volume - Volume level (0-1)
 */
export function setMetronomeVolume(volume) {
    if (!metronomeGain || metronomeGain.disposed) {
        initMetronome();
    }
    
    if (metronomeGain) {
        metronomeGain.gain.value = Math.max(0, Math.min(1, volume));
        console.log('[Audio setMetronomeVolume] Volume set to:', volume);
    }
}

/**
 * Gets the current metronome volume.
 * @returns {number}
 */
export function getMetronomeVolume() {
    return metronomeGain ? metronomeGain.gain.value : 0.5;
}

/**
 * Disposes metronome resources.
 */
export function disposeMetronome() {
    if (metronomeSynth && !metronomeSynth.disposed) {
        metronomeSynth.dispose();
        metronomeSynth = null;
    }
    if (metronomeGain && !metronomeGain.disposed) {
        metronomeGain.dispose();
        metronomeGain = null;
    }
    console.log('[Audio disposeMetronome] Metronome disposed.');
}

// --- Metronome Scheduling ---
let metronomeScheduleId = null;
let currentMetronomeInterval = '4n'; // Default to quarter notes

/**
 * Starts the metronome scheduling during transport playback.
 * @param {string} interval - The interval for metronome clicks (e.g., '4n', '8n')
 */
export function startMetronomeScheduling(interval = '4n') {
    stopMetronomeScheduling();
    currentMetronomeInterval = interval;
    
    // Schedule metronome clicks
    metronomeScheduleId = Tone.Transport.scheduleRepeat((time) => {
        // Determine whether this scheduled click lands on a downbeat (beat 1).
        // IMPORTANT: derive the beat position from the scheduled `time` arg
        // (pinned to the audio clock at callback-registration time), NOT from
        // `Tone.Transport.position` read at JS-callback-execution time. On slow
        // machines or audio-thread-starved tabs the transport playhead can race
        // ahead of the scheduled audio time, which would mis-flag beats 2/3/4 as
        // downbeats (high-pitch 1200Hz click) while the real downbeat gets the
        // low-pitch 440Hz click.
        let beatInBar = 0;
        try {
            // Tone.TransportTime converts a seconds value to a bars:beats:sixteenths position.
            const bbs = Tone.TransportTime(time).toBarsBeatsSixteenths();
            const parts = bbs.split(':');
            beatInBar = parseInt(parts[1], 10) || 0;
        } catch (e) {
            // Legacy fallback: if TransportTime is unavailable or throws, fall
            // back to reading the transport position (the old race-prone path).
            try {
                const pos = Tone.Transport.position;
                const parts = pos.split(':');
                beatInBar = parseInt(parts[1], 10) || 0;
            } catch (_) { beatInBar = 0; }
        }
        const isAccented = isBeatAccented(beatInBar + 1, 4);
        
        // Apply adaptive timing offset if enabled
        let adjustedTime = time;
        if (typeof getAdaptiveMetronomeEnabled === 'function' && getAdaptiveMetronomeEnabled()) {
            const offset = typeof getAdaptiveTimingOffset === 'function' ? getAdaptiveTimingOffset() : 0;
            adjustedTime = time + (offset / 1000); // Convert ms to seconds
        }
        
        playMetronomeClick(isAccented, adjustedTime);
    }, interval);
    
    console.log('[Audio] Metronome scheduling started with interval:', interval);
}

/**
 * Stops the metronome scheduling.
 */
export function stopMetronomeScheduling() {
    if (metronomeScheduleId !== null) {
        Tone.Transport.clear(metronomeScheduleId);
        metronomeScheduleId = null;
        console.log('[Audio] Metronome scheduling stopped.');
    }
}

/**
 * Updates the metronome interval (e.g., when tempo changes).
 * @param {string} interval - The new interval for metronome clicks
 */
export function updateMetronomeInterval(interval) {
    if (metronomeScheduleId !== null) {
        stopMetronomeScheduling();
        startMetronomeScheduling(interval);
    }
}

/**
 * Starts metronome if enabled in state, called when transport starts.
 */
export function handleTransportStart() {
    if (typeof getMetronomeEnabled === 'function' && getMetronomeEnabled()) {
        startMetronomeScheduling('4n');
    }
}

/**
 * Stops metronome when transport stops.
 */
export function handleTransportStop() {
    stopMetronomeScheduling();
}

// --- Tempo Ramp Scheduling ---
let tempoRampsScheduleId = null;
let activeTempoRamps = []; // Cached from state

/**
 * Sets up the tempo ramp schedule. Called when transport starts.
 * Uses Tone.Transport.scheduleRepeat to update BPM based on ramp points.
 */
export function setupTempoRampScheduling(tempoRamps) {
    clearTempoRampScheduling();
    
    if (!tempoRamps || tempoRamps.length === 0) {
        console.log('[Audio setupTempoRampScheduling] No tempo ramps to schedule.');
        return;
    }
    
    activeTempoRamps = [...tempoRamps].sort((a, b) => a.barPosition - b.barPosition);
    
    // Use scheduleRepeat to check and update tempo at every beat
    // We need high resolution to catch ramp changes. Using '16n' for precision.
    tempoRampsScheduleId = Tone.Transport.scheduleRepeat((time) => {
        if (activeTempoRamps.length === 0) return;
        
        // Get current position in bars
        const pos = Tone.Transport.position;
        const parts = pos.split(':');
        const bars = parseInt(parts[0], 10);
        const beats = parseInt(parts[1], 10);
        const subBeats = parseFloat(parts[2] || '0');
        const currentBarFloat = bars + (beats / 4) + (subBeats / 16);
        
        // Find the applicable ramp point
        // Tempo changes at the ramp point's bar position
        let targetBpm = Tone.Transport.bpm.value; // Default to current
        let currentRampCurve = 'linear'; // Default curve
        
        for (let i = activeTempoRamps.length - 1; i >= 0; i--) {
            if (currentBarFloat >= activeTempoRamps[i].barPosition) {
                targetBpm = activeTempoRamps[i].bpm;
                currentRampCurve = activeTempoRamps[i].curve || 'linear';
                break;
            }
        }
        
        // Only update if different (avoid jitter)
        if (Math.abs(Tone.Transport.bpm.value - targetBpm) > 0.01) {
            // Apply curve type for tempo changes
            if (currentRampCurve === 'stepped') {
                // Stepped: apply immediately at the ramp point (abrupt change)
                Tone.Transport.bpm.value = targetBpm;
                console.log(`[Audio tempoRamp/stepped] Bar ${currentBarFloat.toFixed(2)} -> BPM ${targetBpm}`);
            } else {
                // Linear or exponential: use smooth transition
                Tone.Transport.bpm.value = targetBpm;
                console.log(`[Audio tempoRamp/${currentRampCurve}] Bar ${currentBarFloat.toFixed(2)} -> BPM ${targetBpm}`);
            }
        }
    }, '16n');
    
    console.log('[Audio setupTempoRampScheduling] Tempo ramp scheduling started with', activeTempoRamps.length, 'points.');
}

/**
 * Clears the tempo ramp schedule.
 */
export function clearTempoRampScheduling() {
    if (tempoRampsScheduleId !== null) {
        Tone.Transport.clear(tempoRampsScheduleId);
        tempoRampsScheduleId = null;
        activeTempoRamps = [];
        console.log('[Audio clearTempoRampScheduling] Tempo ramp scheduling cleared.');
    }
}

/**
 * Refreshes tempo ramp scheduling with updated ramps from state.
 * Call this when ramps are modified during playback.
 */
export function refreshTempoRampScheduling(tempoRamps) {
    if (Tone.Transport.state === 'started') {
        setupTempoRampScheduling(tempoRamps);
    }
}

// --- Tempo Jump Markers Scheduling ---
let tempoJumpScheduleId = null;
let activeTempoJumps = []; // Cached from state

/**
 * Sets up tempo jump scheduling. Tempo jumps are immediate tempo changes at specific bar positions.
 */
export function setupTempoJumpScheduling(tempoJumps) {
    clearTempoJumpScheduling();
    
    if (!tempoJumps || tempoJumps.length === 0) {
        console.log('[Audio setupTempoJumpScheduling] No tempo jumps to schedule.');
        return;
    }
    
    activeTempoJumps = [...tempoJumps].sort((a, b) => a.barPosition - b.barPosition);
    
    tempoJumpScheduleId = Tone.Transport.scheduleRepeat((time) => {
        if (activeTempoJumps.length === 0) return;
        
        const pos = Tone.Transport.position;
        const parts = pos.split(':');
        const bars = parseInt(parts[0], 10);
        const beats = parseInt(parts[1], 10);
        const subBeats = parseFloat(parts[2] || '0');
        const currentBarFloat = bars + (beats / 4) + (subBeats / 16);
        
        for (let i = activeTempoJumps.length - 1; i >= 0; i--) {
            if (currentBarFloat >= activeTempoJumps[i].barPosition) {
                const targetBpm = activeTempoJumps[i].bpm;
                if (Math.abs(Tone.Transport.bpm.value - targetBpm) > 0.01) {
                    Tone.Transport.bpm.value = targetBpm;
                    console.log(`[Audio tempoJump] Bar ${currentBarFloat.toFixed(2)} -> BPM ${targetBpm}`);
                }
                // Remove this jump from active list so it only fires once
                activeTempoJumps.splice(i, 1);
                break;
            }
        }
    }, '16n');
    
    console.log('[Audio setupTempoJumpScheduling] Tempo jump scheduling started with', tempoJumps.length, 'jumps.');
}

export function clearTempoJumpScheduling() {
    if (tempoJumpScheduleId !== null) {
        Tone.Transport.clear(tempoJumpScheduleId);
        tempoJumpScheduleId = null;
        activeTempoJumps = [];
        console.log('[Audio clearTempoJumpScheduling] Tempo jump scheduling cleared.');
    }
}

export function refreshTempoJumpScheduling(tempoJumps) {
    if (Tone.Transport.state === 'started') {
        setupTempoJumpScheduling(tempoJumps);
    }
}

export function initializeAudioModule(appServicesFromMain) {
    localAppServices = appServicesFromMain;
    // MODIFICATION START: Debug to confirm function reference
    if (typeof getLoadedZipFilesState !== 'undefined') { // Need to import it for this check to be valid
        console.log('[Audio Init DEBUG] localAppServices.getLoadedZipFiles === getLoadedZipFilesState (from state.js import)?', localAppServices.getLoadedZipFiles === getLoadedZipFilesState);
    } else {
        // console.log('[Audio Init DEBUG] getLoadedZipFilesState not imported, cannot compare reference directly here.');
    }
    // MODIFICATION END
}

export function getMasterEffectsBusInputNode() {
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        console.log("[Audio getMasterEffectsBusInputNode] Master bus input node not ready or disposed, attempting setup.");
        setupMasterBus();
    }
    return masterEffectsBusInputNode;
}

export function getActualMasterGainNode() {
    if (!masterGainNodeActual || masterGainNodeActual.disposed) {
        console.log("[Audio getActualMasterGainNode] Actual master gain node not ready or disposed, attempting setup.");
        setupMasterBus();
    }
    return masterGainNodeActual;
}
export function getMasterMeterNode() {
    if (!masterMeterNode || masterMeterNode.disposed) {
        console.log("[Audio getMasterMeterNode] Master meter node not ready or disposed, attempting setup.");
        setupMasterBus();
    }
    return masterMeterNode;
}

// ---- Master Brick-Wall Limiter ----
// The limiter is a `Tone.Limiter` (a built-in Tone.js hard-knee brick-wall limiter)
// that sits in the master effect chain between the user-added master effects and
// `masterGainNodeActual` when enabled. When disabled, it is bypassed (not inserted
// into the chain) so there is zero audio cost.
export function getMasterLimiterNode() {
    if (!masterLimiterNode || masterLimiterNode.disposed) {
        if (masterLimiterNode && !masterLimiterNode.disposed) {
            try { masterLimiterNode.dispose(); } catch(e) { console.warn('[Audio getMasterLimiterNode] Error disposing old master limiter:', e?.message); }
        }
        try {
            masterLimiterNode = new Tone.Limiter(masterLimiterThresholdDb);
            console.log('[Audio getMasterLimiterNode] Created new master limiter node at threshold', masterLimiterThresholdDb, 'dB');
        } catch (e) {
            console.error('[Audio getMasterLimiterNode] Failed to create Tone.Limiter:', e?.message || e);
            masterLimiterNode = null;
        }
    }
    return masterLimiterNode;
}

export function isMasterLimiterEnabled() { return !!masterLimiterEnabled; }

export function setMasterLimiterEnabled(enabled) {
    const next = !!enabled;
    if (masterLimiterEnabled === next) return masterLimiterEnabled;
    masterLimiterEnabled = next;
    // Lazily create the node now so it's ready for the rebuild.
    if (masterLimiterEnabled) {
        try {
            const node = getMasterLimiterNode();
            // If the limiter node failed to create (e.g. Tone.Limiter constructor
            // threw because the AudioContext isn't running), revert the flag and
            // surface a user-visible notification. Previously this silently left
            // masterLimiterEnabled=true while the node was null, so the chain
            // rebuild skipped the limiter wiring but the UI showed it as "enabled".
            if (!node) {
                masterLimiterEnabled = false;
                console.error('[Audio setMasterLimiterEnabled] getMasterLimiterNode returned null; limiter not wired into chain.');
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('Master Limiter: could not create limiter node. Is audio initialized?', 4000);
                }
                return masterLimiterEnabled;
            }
        } catch(e) {
            masterLimiterEnabled = false;
            console.warn('[Audio setMasterLimiterEnabled] getMasterLimiterNode threw:', e?.message);
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Master Limiter: could not create limiter node.', 4000);
            }
            return masterLimiterEnabled;
        }
    }
    // Always rebuild so the chain reflects the new state (with/without limiter).
    try {
        if (typeof rebuildMasterEffectChain === 'function') rebuildMasterEffectChain();
    } catch (e) {
        console.error('[Audio setMasterLimiterEnabled] rebuildMasterEffectChain failed:', e?.message || e);
    }
    return masterLimiterEnabled;
}

export function getMasterLimiterThresholdDb() { return masterLimiterThresholdDb; }
export function getMasterLimiterCeilingDb() { return masterLimiterCeilingDb; }

export function setMasterLimiterThresholdDb(db) {
    const n = Number(db);
    if (!Number.isFinite(n)) return masterLimiterThresholdDb;
    masterLimiterThresholdDb = Math.max(-24, Math.min(0, n));
    if (masterLimiterNode && !masterLimiterNode.disposed) {
        try { masterLimiterNode.threshold.value = masterLimiterThresholdDb; } catch(e) { console.warn('[Audio setMasterLimiterThresholdDb] Error:', e?.message); }
    }
    return masterLimiterThresholdDb;
}

export function setMasterLimiterCeilingDb(db) {
    // Informational only — Tone.Limiter has no separate ceiling (the threshold IS the ceiling).
    const n = Number(db);
    if (!Number.isFinite(n)) return masterLimiterCeilingDb;
    masterLimiterCeilingDb = Math.max(-6, Math.min(0, n));
    return masterLimiterCeilingDb;
}

// Returns the limiter's current gain reduction in dB (negative or zero).
// Reads the embedded compressor's reduction value via the limit's internal node.
export function getMasterLimiterReductionDb() {
    try {
        if (!masterLimiterEnabled) return 0;
        const node = getMasterLimiterNode();
        if (!node || node.disposed) return 0;
        // Tone.Limiter wraps a compressor; `reduction` is the gain reduction signal in dB.
        const r = (node._compressor && typeof node._compressor.reduction !== 'undefined')
            ? node._compressor.reduction
            : (typeof node.reduction === 'number' ? node.reduction : 0);
        return Number.isFinite(r) ? r : 0;
    } catch (e) {
        return 0;
    }
}


export async function initAudioContextAndMasterMeter(isUserInitiated = false) {
    if (audioContextInitialized && Tone.context && Tone.context.state === 'running') {
        if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
            !masterGainNodeActual || masterGainNodeActual.disposed ||
            !masterMeterNode || masterMeterNode.disposed) {
            console.warn("[Audio initAudioContextAndMasterMeter] Context was running, but master bus components are not fully initialized. Re-setting up.");
            setupMasterBus();
        }
        return true;
    }

    console.log('[Audio initAudioContextAndMasterMeter] Attempting Tone.start(). Current context state:', Tone.context?.state);
    try {
        await Tone.start();
        console.log('[Audio initAudioContextAndMasterMeter] Tone.start() completed. Context state:', Tone.context?.state);

        if (Tone.context && Tone.context.state === 'running') {
            if (!audioContextInitialized) {
                console.log('[Audio initAudioContextAndMasterMeter] First time setup for master bus after context became running.');
                setupMasterBus();
            } else if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
                       !masterGainNodeActual || masterGainNodeActual.disposed ||
                       !masterMeterNode || masterMeterNode.disposed) {
                console.warn('[Audio initAudioContextAndMasterMeter] Audio context is running, but master bus components seem to be missing or disposed. Re-initializing master bus.');
                setupMasterBus();
            }
            audioContextInitialized = true;
            console.log('[Audio initAudioContextAndMasterMeter] Audio context initialized and running.');
            return true;
        } else {
            console.warn('[Audio initAudioContextAndMasterMeter] Audio context NOT running after Tone.start(). State:', Tone.context?.state);
            const message = "AudioContext could not be started. Please click again or refresh the page.";
            if (localAppServices.showNotification) {
                localAppServices.showNotification(message, 5000);
            } else {
                alert(message); // Fallback if showNotification is not available
            }
            audioContextInitialized = false;
            return false;
        }
    } catch (error) {
        console.error("[Audio initAudioContextAndMasterMeter] Error during Tone.start() or master bus setup:", error);
        const message = `Error initializing audio: ${error.message || 'Please check console.'}. Try interacting with the page or refreshing.`;
        if (localAppServices.showNotification) {
            localAppServices.showNotification(message, 5000);
        } else {
            alert(message);
        }
        audioContextInitialized = false;
        return false;
    }
}

function setupMasterBus() {
    console.log('[Audio setupMasterBus] Setting up master bus...');
    if (!Tone.context || Tone.context.state !== 'running') {
        console.warn('[Audio setupMasterBus] Audio context not running. Aborting master bus setup.');
        return;
    }

    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        if (masterEffectsBusInputNode && !masterEffectsBusInputNode.disposed) {
             try { masterEffectsBusInputNode.dispose(); } catch(e){ console.warn("[Audio setupMasterBus] Error disposing old master bus input:", e.message); }
        }
        masterEffectsBusInputNode = new Tone.Gain(); // Destination will be set by rebuildMasterEffectChain
        console.log('[Audio setupMasterBus] Master effects bus input node created.');
    }

    if (!masterGainNodeActual || masterGainNodeActual.disposed) {
        if (masterGainNodeActual && !masterGainNodeActual.disposed) {
            try { masterGainNodeActual.dispose(); } catch(e){ console.warn("[Audio setupMasterBus] Error disposing old master gain node actual:", e.message); }
        }
        const initialMasterVolumeValue = localAppServices.getMasterGainValue ? localAppServices.getMasterGainValue() : Tone.dbToGain(0);
        masterGainNodeActual = new Tone.Gain(initialMasterVolumeValue);
        if (localAppServices.setMasterGainValueState) localAppServices.setMasterGainValueState(masterGainNodeActual.gain.value); // Update state module
        console.log('[Audio setupMasterBus] Master gain node actual created with gain:', masterGainNodeActual.gain.value);
    }

    if (!masterMeterNode || masterMeterNode.disposed) {
        if (masterMeterNode && !masterMeterNode.disposed) {
            try { masterMeterNode.dispose(); } catch(e) { console.warn("[Audio setupMasterBus] Error disposing old master meter:", e.message); }
        }
        masterMeterNode = new Tone.Meter({ smoothing: 0.8 });
        console.log('[Audio setupMasterBus] Master meter node created.');
    }

    if (!masterAnalyserNode || masterAnalyserNode.disposed) {
        if (masterAnalyserNode && !masterAnalyserNode.disposed) {
            try { masterAnalyserNode.dispose(); } catch(e) { console.warn("[Audio setupMasterBus] Error disposing old master analyser:", e.message); }
        }
        try {
            masterAnalyserNode = new Tone.Analyser('fft', 256);
            console.log('[Audio setupMasterBus] Master analyser node created.');
        } catch(e) {
            console.warn("[Audio setupMasterBus] Error creating master analyser:", e.message);
        }
    }
    rebuildMasterEffectChain(); // This will handle connections
    setupSendBuses(); // Setup send/return buses
    console.log('[Audio setupMasterBus] Master bus setup process complete.');
}

export function rebuildMasterEffectChain() {
    console.log('[Audio rebuildMasterEffectChain] Rebuilding master effect chain...');
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
        !masterGainNodeActual || masterGainNodeActual.disposed ||
        !masterMeterNode || masterMeterNode.disposed) {
        console.warn('[Audio rebuildMasterEffectChain] Master bus components not fully ready, attempting setup...');
        setupMasterBus(); // Try to set them up again
        // Re-check after setup attempt
        if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
            !masterGainNodeActual || masterGainNodeActual.disposed ||
            !masterMeterNode || masterMeterNode.disposed) {
            console.error('[Audio rebuildMasterEffectChain] Master bus components still not ready after setup attempt. Aborting chain rebuild.');
            return;
        }
    }

    try { masterEffectsBusInputNode.disconnect(); } catch(e) { console.warn("[Audio rebuildMasterEffectChain] Error disconnecting masterEffectsBusInputNode:", e.message); }
    activeMasterEffectNodes.forEach((node, id) => {
        if (node && !node.disposed) {
            try { node.disconnect(); } catch(e) { console.warn(`[Audio rebuildMasterEffectChain] Error disconnecting active master effect node ${id}:`, e.message); }
        }
    });
    try { masterGainNodeActual.disconnect(); } catch(e) { console.warn("[Audio rebuildMasterEffectChain] Error disconnecting masterGainNodeActual:", e.message); }
    // masterMeterNode is connected in parallel, so usually disconnect from source (masterGainNodeActual)

    let currentAudioPathEnd = masterEffectsBusInputNode;
    const masterEffectsState = localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : [];
    console.log(`[Audio rebuildMasterEffectChain] Master effects in state: ${masterEffectsState.length}`);

    masterEffectsState.forEach(effectState => {
        let effectNode = activeMasterEffectNodes.get(effectState.id);
        if (!effectNode || effectNode.disposed) {
            console.warn(`[Audio rebuildMasterEffectChain] Master effect node for ${effectState.type} (ID: ${effectState.id}) not found or disposed. Attempting recreation.`);
            effectNode = createEffectInstance(effectState.type, effectState.params);
            if (effectNode) {
                activeMasterEffectNodes.set(effectState.id, effectNode);
                console.log(`[Audio rebuildMasterEffectChain] Recreated master effect node for ${effectState.type} (ID: ${effectState.id}).`);
            } else {
                console.error(`[Audio rebuildMasterEffectChain] CRITICAL: Failed to recreate master effect node for ${effectState.type} (ID: ${effectState.id}). Chain will skip this effect and continue.`);
                effectNode = null;
                // FIX: Don't break the chain - skip failed effect and continue
            }
        }

        if (effectNode && currentAudioPathEnd && !currentAudioPathEnd.disposed) {
            try {
                console.log(`[Audio rebuildMasterEffectChain] Connecting ${currentAudioPathEnd.toString()} to ${effectNode.toString()} (${effectState.type})`);
                currentAudioPathEnd.connect(effectNode);
                currentAudioPathEnd = effectNode;
            } catch (e) {
                console.error(`[Audio rebuildMasterEffectChain] Error connecting master effect ${effectState.type}:`, e);
            }
        } else if (effectNode && !effectNode.disposed) {
            // This case means the chain started with this effect (currentAudioPathEnd is null)
            currentAudioPathEnd = effectNode;
            console.warn(`[Audio rebuildMasterEffectChain] Starting chain segment with ${effectState.type}.`);
        } else if (!effectNode) {
            // Effect failed to create, skip it and keep chain intact
            console.warn(`[Audio rebuildMasterEffectChain] Skipping failed effect ${effectState.type}, chain continues.`);
        }
    });

    // Insert the Master Brick-Wall Limiter as the final stage before masterGainNodeActual
    // when the user has enabled it from the Start menu (v0.3.65 — Master Limiter feature).
    // When enabled we take full ownership of the final wire so the downstream
    // `currentAudioPathEnd.connect(masterGainNodeActual)` below is skipped.
    let _masterLimiterWired = false;
    if (masterLimiterEnabled && masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            const limiterNode = getMasterLimiterNode();
            if (limiterNode && !limiterNode.disposed) {
                // Sync threshold in case it was changed while disabled
                try { limiterNode.threshold.value = masterLimiterThresholdDb; } catch(_e) { /* ignore */ }
                // Disconnect any prior wire into masterGainNodeActual from currentAudioPathEnd
                // (or from bus input if there were no effects).
                const wireSource = (currentAudioPathEnd && !currentAudioPathEnd.disposed)
                    ? currentAudioPathEnd
                    : (masterEffectsBusInputNode && !masterEffectsBusInputNode.disposed ? masterEffectsBusInputNode : null);
                if (wireSource) {
                    try { wireSource.disconnect(masterGainNodeActual); } catch(_e) { /* nothing was connected — ignore */ }
                }
                // Wire wireSource → limiter → masterGainNodeActual
                if (wireSource) {
                    try {
                        wireSource.connect(limiterNode);
                        limiterNode.connect(masterGainNodeActual);
                        _masterLimiterWired = true;
                        console.log('[Audio rebuildMasterEffectChain] Master limiter inserted into chain (threshold', masterLimiterThresholdDb, 'dB)');
                    } catch (e) {
                        console.error('[Audio rebuildMasterEffectChain] Error wiring limiter into chain:', e?.message || e);
                    }
                }
            }
        } catch (e) {
            console.error('[Audio rebuildMasterEffectChain] Error inserting master limiter:', e?.message || e);
        }
    }

    // Connect the end of the effect chain to masterGainNodeActual
    // (Skip when the master limiter is enabled — the limiter block above already wired this.)
    if (_masterLimiterWired) {
        // Already wired via limiter; nothing more to do.
    } else if (currentAudioPathEnd && !currentAudioPathEnd.disposed && masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            console.log(`[Audio rebuildMasterEffectChain] Connecting end of master effect chain (${currentAudioPathEnd.toString()}) to masterGainNodeActual.`);
            currentAudioPathEnd.connect(masterGainNodeActual);
        } catch (e) {
            console.error(`[Audio rebuildMasterEffectChain] Error connecting master chain output to masterGainNodeActual:`, e);
        }
    } else {
        console.warn('[Audio rebuildMasterEffectChain] Could not connect master chain output to masterGainNodeActual. Current end:', currentAudioPathEnd?.toString(), 'Master Gain:', masterGainNodeActual?.toString());
         if (!masterEffectsBusInputNode.numberOfOutputs && masterGainNodeActual && !masterGainNodeActual.disposed) { // If no effects, connect input directly
            try {
                masterEffectsBusInputNode.connect(masterGainNodeActual);
                console.log("[Audio rebuildMasterEffectChain] Connected masterEffectsBusInputNode directly to masterGainNodeActual (no effects).");
            } catch (e) {
                console.error("[Audio rebuildMasterEffectChain] Error directly connecting masterEffectsBusInputNode to masterGainNodeActual:", e.message);
            }
        }
    }

    // Connect masterGainNodeActual to destination and meter
    if (masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            console.log('[Audio rebuildMasterEffectChain] Connecting masterGainNodeActual to destination and meter.');
            masterGainNodeActual.toDestination(); // Connects to Tone.Destination (context.destination)
            if (masterMeterNode && !masterMeterNode.disposed) {
                masterGainNodeActual.connect(masterMeterNode);
            } else {
                 console.warn("[Audio rebuildMasterEffectChain] Master meter node not available for connection during rebuild. Should have been re-created by setupMasterBus.");
            }
            if (masterAnalyserNode && !masterAnalyserNode.disposed) {
                masterGainNodeActual.connect(masterAnalyserNode);
            }
        } catch (e) { console.error("[Audio rebuildMasterEffectChain] Error connecting masterGainNodeActual to destination/meter:", e); }
    } else {
         console.warn('[Audio rebuildMasterEffectChain] masterGainNodeActual not available for final connection.');
    }
    console.log('[Audio rebuildMasterEffectChain] Master effect chain rebuild complete.');
}


export async function addMasterEffectToAudio(effectIdInState, effectType, initialParams) {
    const toneNode = createEffectInstance(effectType, initialParams);
    if (toneNode) {
        activeMasterEffectNodes.set(effectIdInState, toneNode);
        rebuildMasterEffectChain();
    } else {
        if (localAppServices.showNotification) localAppServices.showNotification(`Failed to create master effect: ${effectType}`, 3000);
        console.error(`[Audio addMasterEffectToAudio] Failed to create Tone.js instance for master effect: ${effectType}`);
    }
}

export async function removeMasterEffectFromAudio(effectId) {
    const nodeToRemove = activeMasterEffectNodes.get(effectId);
    if (nodeToRemove) {
        if (!nodeToRemove.disposed) {
            try {
                nodeToRemove.dispose();
            } catch (e) {
                console.warn(`[Audio removeMasterEffectFromAudio] Error disposing master effect node for ID ${effectId}:`, e.message);
            }
        }
        activeMasterEffectNodes.delete(effectId);
        rebuildMasterEffectChain();
    } else {
        console.warn(`[Audio removeMasterEffectFromAudio] Node to remove with ID ${effectId} not found in activeMasterEffectNodes.`);
    }
}

export function updateMasterEffectParamInAudio(effectId, paramPath, value) {
    const effectNode = activeMasterEffectNodes.get(effectId);
    if (!effectNode || effectNode.disposed) {
        console.warn(`[Audio updateMasterEffectParamInAudio] Master effect node for ID ${effectId} not found or disposed for param update.`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let targetObject = effectNode;
        for (let i = 0; i < keys.length - 1; i++) {
            if (targetObject && typeof targetObject[keys[i]] !== 'undefined') {
                targetObject = targetObject[keys[i]];
            } else {
                throw new Error(`Path ${keys.slice(0,i+1).join('.')} not found on Tone node.`);
            }
        }
        const finalParamKey = keys[keys.length - 1];
        const paramInstance = targetObject[finalParamKey];

        if (paramInstance && typeof paramInstance.value !== 'undefined') { // It's a Tone.Param or Signal
            if (typeof paramInstance.rampTo === 'function') {
                paramInstance.rampTo(value, 0.02); // Smooth ramp
            } else {
                paramInstance.value = value; // Direct value assignment
            }
        } else if (typeof targetObject[finalParamKey] !== 'undefined') { // Direct property like 'type' or 'oversample'
            targetObject[finalParamKey] = value;
        } else {
            console.warn(`[Audio updateMasterEffectParamInAudio] Parameter ${finalParamKey} not found on target object for effect ID ${effectId}. Target:`, targetObject);
        }
    } catch (err) {
        console.error(`[Audio updateMasterEffectParamInAudio] Error updating param "${paramPath}" for master effect ID ${effectId}:`, err);
    }
}

export function reorderMasterEffectInAudio(effectIdIgnored, newIndexIgnored) {
    // The actual reordering happens in state; this just rebuilds the audio chain
    rebuildMasterEffectChain();
}

export function setMasterEffectWet(effectId, wetValue) {
    const effectNode = activeMasterEffectNodes.get(effectId);
    if (!effectNode || effectNode.disposed) {
        console.warn(`[Audio setMasterEffectWet] Master effect node for ID ${effectId} not found or disposed.`);
        return false;
    }
    
    try {
        if (effectNode.wet && typeof effectNode.wet.rampTo === 'function') {
            effectNode.wet.rampTo(wetValue, 0.02);
        } else if (effectNode.wet && typeof effectNode.wet.value !== 'undefined') {
            effectNode.wet.value = wetValue;
        } else {
            console.warn(`[Audio setMasterEffectWet] Effect node for ID ${effectId} does not have a wet parameter.`);
            return false;
        }
        console.log(`[Audio setMasterEffectWet] Set master effect ${effectId} wet to ${wetValue}`);
        return true;
    } catch (err) {
        console.error(`[Audio setMasterEffectWet] Error setting wet for master effect ID ${effectId}:`, err);
        return false;
    }
}


export function updateMeters(globalMasterMeterBar, mixerMasterMeterBar, tracks) {
    if (!Tone.context || Tone.context.state !== 'running' || !audioContextInitialized) return;

    if (masterMeterNode && typeof masterMeterNode.getValue === 'function' && !masterMeterNode.disposed) {
        const masterLevelValue = masterMeterNode.getValue();
        // Ensure masterLevelValue is a number, taking the first channel if it's an array (stereo)
        const numericMasterLevel = Array.isArray(masterLevelValue) ? masterLevelValue[0] : masterLevelValue;
        if (typeof numericMasterLevel === 'number' && isFinite(numericMasterLevel)) {
            const level = Tone.dbToGain(numericMasterLevel);
            const isClipping = numericMasterLevel > -0.1;

            if (globalMasterMeterBar) {
                globalMasterMeterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                globalMasterMeterBar.classList.toggle('clipping', isClipping);
            }
            if (mixerMasterMeterBar) {
                mixerMasterMeterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                mixerMasterMeterBar.classList.toggle('clipping', isClipping);
            }
        } else {
            // console.warn("[Audio updateMeters] Master meter returned invalid value:", masterLevelValue);
        }
    } else if (masterMeterNode && masterMeterNode.disposed) {
        console.warn("[Audio updateMeters] Master meter node is disposed. Attempting to re-initialize master bus.");
        setupMasterBus(); // Attempt to re-initialize if disposed
    }


    (tracks || []).forEach(track => {
        if (track && track.trackMeter && typeof track.trackMeter.getValue === 'function' && !track.trackMeter.disposed) {
            const meterValue = track.trackMeter.getValue();
            const numericMeterValue = Array.isArray(meterValue) ? meterValue[0] : meterValue;

            if (typeof numericMeterValue === 'number' && isFinite(numericMeterValue)) {
                const level = Tone.dbToGain(numericMeterValue);
                const isClipping = numericMeterValue > -0.1;

                if (localAppServices.updateTrackMeterUI) {
                    localAppServices.updateTrackMeterUI(track.id, level, isClipping);
                }
            } else {
                // console.warn(`[Audio updateMeters] Track ${track.id} meter returned invalid value:`, meterValue);
            }
        }
    });
}

export async function playSlicePreview(trackId, sliceIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0) {
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio not ready for preview.", 2000);
        return;
    }

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;

    if (!track || track.type !== 'Sampler' || !track.audioBuffer || !track.audioBuffer.loaded || !track.slices[sliceIndex]) {
        console.warn(`[Audio playSlicePreview] Conditions not met for playing slice preview for track ${trackId}, slice ${sliceIndex}`);
        return;
    }
    const sliceData = track.slices[sliceIndex];
    if (!sliceData || sliceData.duration <= 0) {
        console.warn(`[Audio playSlicePreview] Invalid slice data or zero duration for track ${trackId}, slice ${sliceIndex}.`);
        return;
    }

    const time = Tone.now();
    const totalPitchShift = (sliceData.pitchShift || 0) + additionalPitchShiftInSemitones;
    const playbackRate = Math.pow(2, totalPitchShift / 12);
    let playDuration = sliceData.duration / playbackRate;
    if (sliceData.loop) playDuration = Math.min(playDuration, 2); // Limit looped preview duration

    // Determine the correct destination node
    const actualDestination = (track.activeEffects.length > 0 && track.activeEffects[0].toneNode && !track.activeEffects[0].toneNode.disposed)
        ? track.activeEffects[0].toneNode
        : (track.gainNode && !track.gainNode.disposed ? track.gainNode : getMasterEffectsBusInputNode());

    if (!actualDestination || actualDestination.disposed) {
        console.error(`[Audio playSlicePreview] No valid destination node for track ${trackId}.`);
        return;
    }

    if (!track.slicerIsPolyphonic) {
        if (!track.slicerMonoPlayer || track.slicerMonoPlayer.disposed) {
            track.setupSlicerMonoNodes(); // This also assigns track.audioBuffer to player
            if (!track.slicerMonoPlayer) { // Check again after setup
                console.error(`[Audio playSlicePreview] Mono slicer player still not set up for track ${trackId} after attempt.`);
                return;
            }
        }
        const player = track.slicerMonoPlayer;
        const env = track.slicerMonoEnvelope;
        const gain = track.slicerMonoGain;

        // Ensure correct connection
        if (gain && !gain.disposed && actualDestination && !actualDestination.disposed) {
            try { gain.disconnect(); } catch(e) { /* ignore if not connected */ }
            gain.connect(actualDestination);
        }

        if (player.state === 'started') player.stop(time);
        if (env && env.getValueAtTime(time) > 0.001) env.triggerRelease(time);

        if (track.audioBuffer && track.audioBuffer.loaded) player.buffer = track.audioBuffer; else return; // No buffer
        if (env) env.set(sliceData.envelope);
        if (gain) gain.gain.value = Tone.dbToGain(-6) * sliceData.volume * velocity; // Apply slight attenuation for previews
        player.playbackRate = playbackRate;
        player.reverse = sliceData.reverse || false;
        player.loop = sliceData.loop || false;
        player.loopStart = sliceData.offset;
        player.loopEnd = sliceData.offset + sliceData.duration;

        player.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
        if (env) env.triggerAttack(time);
        if (!sliceData.loop && env) {
            const releaseTime = time + playDuration - (sliceData.envelope.release || 0.1);
            env.triggerRelease(Math.max(time, releaseTime));
        }
    } else { // Polyphonic
        const tempPlayer = new Tone.Player(track.audioBuffer);
        const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
        const tempGain = new Tone.Gain(Tone.dbToGain(-6) * sliceData.volume * velocity);

        try {
            tempPlayer.chain(tempEnv, tempGain, actualDestination);
            tempPlayer.playbackRate = playbackRate;
            tempPlayer.reverse = sliceData.reverse || false;
            tempPlayer.loop = sliceData.loop || false;
            tempPlayer.loopStart = sliceData.offset;
            tempPlayer.loopEnd = sliceData.offset + sliceData.duration;

            tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
            tempEnv.triggerAttack(time);
            if (!sliceData.loop) tempEnv.triggerRelease(time + playDuration * 0.95);

            // Schedule disposal
            const disposeTime = time + playDuration + (sliceData.envelope.release || 0.1) + 0.5; // Generous buffer
            Tone.Transport.scheduleOnce(() => {
                if (tempPlayer && !tempPlayer.disposed) tempPlayer.dispose();
                if (tempEnv && !tempEnv.disposed) tempEnv.dispose();
                if (tempGain && !tempGain.disposed) tempGain.dispose();
            }, disposeTime);
        } catch (error) {
            console.error(`[Audio playSlicePreview] Error setting up polyphonic preview player for track ${trackId}:`, error);
            // Dispose if partially created
            if (tempPlayer && !tempPlayer.disposed) tempPlayer.dispose();
            if (tempEnv && !tempEnv.disposed) tempEnv.dispose();
            if (tempGain && !tempGain.disposed) tempGain.dispose();
        }
    }
}

export async function playDrumSamplerPadPreview(trackId, padIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0) {
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio not ready for preview.", 2000);
        return;
    }

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;

    if (!track || track.type !== 'DrumSampler' || !track.drumPadPlayers[padIndex] || track.drumPadPlayers[padIndex].disposed || !track.drumPadPlayers[padIndex].loaded) {
        console.warn(`[Audio playDrumSamplerPadPreview] Conditions not met for playing drum pad preview for track ${trackId}, pad ${padIndex}. Player loaded: ${track?.drumPadPlayers[padIndex]?.loaded}`);
        if (localAppServices.showNotification && track && track.type === 'DrumSampler' && (!track.drumPadPlayers[padIndex] || !track.drumPadPlayers[padIndex].loaded) ) {
            localAppServices.showNotification(`Sample for Pad ${padIndex + 1} not loaded or player error.`, 2000);
        }
        return;
    }
    const player = track.drumPadPlayers[padIndex];
    const padData = track.drumSamplerPads[padIndex];

    if (!padData) {
        console.error(`[Audio playDrumSamplerPadPreview] No padData for track ${trackId}, pad ${padIndex}.`);
        return;
    }

    const actualDestination = (track.activeEffects.length > 0 && track.activeEffects[0].toneNode && !track.activeEffects[0].toneNode.disposed)
        ? track.activeEffects[0].toneNode
        : (track.gainNode && !track.gainNode.disposed ? track.gainNode : getMasterEffectsBusInputNode());

    if (!actualDestination || actualDestination.disposed) {
        console.error(`[Audio playDrumSamplerPadPreview] No valid destination node for track ${trackId}, pad ${padIndex}.`);
        return;
    }

    try {
        player.disconnect(); // Disconnect from any previous connections
        player.connect(actualDestination);
    } catch (e) {
        console.warn(`[Audio playDrumSamplerPadPreview] Error reconnecting drum pad player for track ${trackId}, pad ${padIndex}:`, e.message);
        return; // Don't proceed if connection fails
    }

    player.volume.value = Tone.gainToDb(padData.volume * velocity * 0.7); // Apply some headroom
    const totalPadPitchShift = (padData.pitchShift || 0) + additionalPitchShiftInSemitones;
    player.playbackRate = Math.pow(2, totalPadPitchShift / 12);
    player.start(Tone.now());
}

export function getMimeTypeFromFilename(filename) {
    if (!filename || typeof filename !== 'string') return "application/octet-stream"; // Default MIME type
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith(".wav")) return "audio/wav";
    if (lowerFilename.endsWith(".mp3")) return "audio/mpeg";
    if (lowerFilename.endsWith(".ogg")) return "audio/ogg";
    if (lowerFilename.endsWith(".flac")) return "audio/flac";
    if (lowerFilename.endsWith(".aac")) return "audio/aac";
    if (lowerFilename.endsWith(".m4a")) return "audio/mp4"; // Often audio/mp4 or audio/x-m4a
    // Add more types if needed
    return "application/octet-stream"; // Fallback
}

async function commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint, padIndex = null) {
    const isReconstructing = localAppServices.getIsReconstructingDAW ? localAppServices.getIsReconstructingDAW() : false;

    if (localAppServices.captureStateForUndo && !isReconstructing) {
        const targetName = trackTypeHint === 'DrumSampler' && padIndex !== null ?
            `Pad ${padIndex + 1} on ${track.name}` :
            track.name;
        localAppServices.captureStateForUndo(`Load ${sourceName} to ${targetName}`);
    }

    let objectURLForTone = null;
    let base64DataURL = null; // Kept for potential future use, but direct blob->IndexedDB is better

    try {
        objectURLForTone = URL.createObjectURL(fileObject);
        // base64DataURL might not be strictly necessary if storing blob directly in IDB and loading Tone.Buffer from ObjectURL/Blob
        // However, it was in the original logic, so keeping it for now unless it proves problematic.
        // For large files, converting to base64 is memory intensive.
        // Consider removing if `samplerAudioData.audioBufferDataURL` is not critically used elsewhere for reconstruction.

        const dbKeySuffix = trackTypeHint === 'DrumSampler' && padIndex !== null ?
            `drumPad-${padIndex}-${sourceName.replace(/[^a-zA-Z0-9-_.]/g, '_')}` : // Allow dots in filenames
            `${trackTypeHint}-${sourceName.replace(/[^a-zA-Z0-9-_.]/g, '_')}`;
        const dbKey = `track-${track.id}-${dbKeySuffix}-${fileObject.size}-${fileObject.lastModified}`; // More unique key
        await storeAudio(dbKey, fileObject);
        console.log(`[Audio commonLoadSampleLogic] Stored in DB with key: ${dbKey}`);

        const newAudioBuffer = await new Tone.Buffer().load(objectURLForTone);

        if (trackTypeHint === 'Sampler') {
            if (track.audioBuffer && !track.audioBuffer.disposed) track.audioBuffer.dispose();
            track.disposeSlicerMonoNodes(); // Important to call before setting new buffer related properties
            track.audioBuffer = newAudioBuffer;
            track.samplerAudioData = { fileName: sourceName, /* audioBufferDataURL: base64DataURL, */ dbKey: dbKey, status: 'loaded' };
            if (!track.slicerIsPolyphonic && track.audioBuffer?.loaded) track.setupSlicerMonoNodes();
            if (localAppServices.autoSliceSample && track.audioBuffer.loaded && (!track.slices || track.slices.every(s => s.duration === 0))) {
                localAppServices.autoSliceSample(track.id, Constants.numSlices);
            }
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'samplerLoaded');

        } else if (trackTypeHint === 'InstrumentSampler') {
            if (track.instrumentSamplerSettings.audioBuffer && !track.instrumentSamplerSettings.audioBuffer.disposed) {
                track.instrumentSamplerSettings.audioBuffer.dispose();
            }
            if (track.toneSampler && !track.toneSampler.disposed) track.toneSampler.dispose();

            track.instrumentSamplerSettings = {
                ...track.instrumentSamplerSettings, // Preserve existing settings like rootNote, loop
                audioBuffer: newAudioBuffer,
                /* audioBufferDataURL: base64DataURL, */ // Potentially remove if not needed
                originalFileName: sourceName,
                dbKey: dbKey,
                status: 'loaded',
                // Reset loop points if a new sample is loaded, unless specific logic dictates otherwise
                loopStart: 0,
                loopEnd: newAudioBuffer.duration
            };
            track.setupToneSampler(); // Re-initialize Tone.Sampler
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'instrumentSamplerLoaded');

        } else if (trackTypeHint === 'DrumSampler' && padIndex !== null) {
            const padData = track.drumSamplerPads[padIndex];
            if (padData) {
                if (padData.audioBuffer && !padData.audioBuffer.disposed) padData.audioBuffer.dispose();
                if (track.drumPadPlayers[padIndex] && !track.drumPadPlayers[padIndex].disposed) track.drumPadPlayers[padIndex].dispose();

                padData.audioBuffer = newAudioBuffer;
                /* padData.audioBufferDataURL = base64DataURL; */ // Potentially remove
                padData.originalFileName = sourceName;
                padData.dbKey = dbKey;
                padData.status = 'loaded';
                track.drumPadPlayers[padIndex] = new Tone.Player(newAudioBuffer); // Create new player
                // Connection will be handled by rebuildMasterEffectChain or play preview
            } else {
                console.error(`[Audio commonLoadSampleLogic] Pad data not found for index ${padIndex} on track ${track.id}`);
                throw new Error(`Pad data not found for index ${padIndex}.`);
            }
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'drumPadLoaded', padIndex);
        }

        track.rebuildEffectChain(); // Rebuild chain as sources might have changed
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Sample "${sourceName}" loaded for ${track.name}${trackTypeHint === 'DrumSampler' && padIndex !== null ? ` (Pad ${padIndex+1})` : ''}.`, 2000);
        }

    } catch (error) {
        console.error(`[Audio commonLoadSampleLogic] Error loading sample "${sourceName}" for track ${track.id} (${trackTypeHint}):`, error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Error loading sample "${sourceName.substring(0,30)}": ${error.message}`, 4000);
        }
        // Update status in track data to 'error'
        if (trackTypeHint === 'Sampler') if(track.samplerAudioData) track.samplerAudioData.status = 'error';
        else if (trackTypeHint === 'InstrumentSampler') if(track.instrumentSamplerSettings) track.instrumentSamplerSettings.status = 'error';
        else if (trackTypeHint === 'DrumSampler' && padIndex !== null && track.drumSamplerPads[padIndex]) track.drumSamplerPads[padIndex].status = 'error';

        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sampleLoadError', padIndex);
    } finally {
        if (objectURLForTone) URL.revokeObjectURL(objectURLForTone);
    }
}

export async function loadSampleFile(eventOrUrl, trackId, trackTypeHint, fileNameForUrl = null) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Track ID ${trackId} not found.`, 3000);
        return;
    }
    if (trackTypeHint !== 'Sampler' && trackTypeHint !== 'InstrumentSampler') {
        if (localAppServices.showNotification) localAppServices.showNotification(`Cannot load general sample into ${trackTypeHint} track. Use specific loader.`, 3000);
        return;
    }
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio system not ready. Please interact with the page.", 3000);
        return;
    }

    let providedBlob, sourceName;
    const isUrlSource = typeof eventOrUrl === 'string';
    const isDirectFile = eventOrUrl instanceof File; // For direct file objects
    const isBlobEvent = eventOrUrl instanceof Blob && !(eventOrUrl instanceof File); // For Blobs that are not Files

    if (isUrlSource) {
        sourceName = fileNameForUrl || eventOrUrl.split('/').pop().split('?')[0] || "loaded_sample_from_url";
        try {
            const response = await fetch(eventOrUrl);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status} for "${sourceName}"`);
            providedBlob = await response.blob();
        } catch (e) {
            console.error(`[Audio loadSampleFile] Error fetching sample from URL "${eventOrUrl}":`, e);
            if (localAppServices.showNotification) localAppServices.showNotification(`Error fetching sample "${sourceName.substring(0,30)}": ${e.message}`, 3000);
            return;
        }
    } else if (eventOrUrl && eventOrUrl.target && eventOrUrl.target.files && eventOrUrl.target.files.length > 0) { // From file input event
        providedBlob = eventOrUrl.target.files[0];
        sourceName = providedBlob.name;
    } else if (isDirectFile) { // Directly passed File object
        providedBlob = eventOrUrl;
        sourceName = providedBlob.name;
    } else if (isBlobEvent) { // Directly passed Blob object
        providedBlob = eventOrUrl;
        sourceName = fileNameForUrl || `loaded_blob_${Date.now()}.wav`; // Provide a default name
    } else {
        if (localAppServices.showNotification) localAppServices.showNotification("No file selected or invalid source.", 3000);
        return;
    }

    if (!providedBlob) {
        if (localAppServices.showNotification) localAppServices.showNotification("Could not obtain file data.", 3000);
        return;
    }

    const inferredType = getMimeTypeFromFilename(sourceName);
    const explicitType = providedBlob.type || inferredType || 'application/octet-stream'; // Use provided type, then inferred, then default
    const fileObject = new File([providedBlob], sourceName, { type: explicitType });

    if (!fileObject.type.startsWith('audio/') && fileObject.type !== "application/octet-stream") {
        if (localAppServices.showNotification) localAppServices.showNotification(`Invalid audio file type: "${fileObject.type}". Please use common audio formats.`, 3000);
        return;
    }
    if (fileObject.size === 0) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Audio file "${sourceName}" is empty.`, 3000);
        return;
    }
    console.log(`[Audio loadSampleFile] Attempting to load "${sourceName}" (Type: ${fileObject.type}, Size: ${fileObject.size}) for track ${trackId} (${trackTypeHint})`);
    await commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint);
}


export async function loadDrumSamplerPadFile(eventOrUrl, trackId, padIndex, fileNameForUrl = null) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track || track.type !== 'DrumSampler') {
        if (localAppServices.showNotification) localAppServices.showNotification(`Track ID ${trackId} is not a Drum Sampler.`, 3000);
        return;
    }
    if (typeof padIndex !== 'number' || isNaN(padIndex) || padIndex < 0 || padIndex >= track.drumSamplerPads.length) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Invalid pad index: ${padIndex}.`, 3000);
        return;
    }
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio system not ready. Please interact with the page.", 3000);
        return;
    }

    let providedBlob, sourceName;
    const isUrlSource = typeof eventOrUrl === 'string';
    const isDirectFile = eventOrUrl instanceof File;
    const isBlobEvent = eventOrUrl instanceof Blob && !(eventOrUrl instanceof File);


    if (isUrlSource) {
        sourceName = fileNameForUrl || eventOrUrl.split('/').pop().split('?')[0] || `pad_${padIndex}_sample_from_url`;
        try {
            const response = await fetch(eventOrUrl);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status} for "${sourceName}"`);
            providedBlob = await response.blob();
        } catch (e) {
            console.error(`[Audio loadDrumSamplerPadFile] Error fetching drum sample from URL "${eventOrUrl}":`, e);
            if (localAppServices.showNotification) localAppServices.showNotification(`Error fetching drum sample "${sourceName.substring(0,30)}": ${e.message}`, 3000);
            return;
        }
    } else if (eventOrUrl && eventOrUrl.target && eventOrUrl.target.files && eventOrUrl.target.files.length > 0) {
        providedBlob = eventOrUrl.target.files[0];
        sourceName = providedBlob.name;
    } else if (isDirectFile) {
        providedBlob = eventOrUrl;
        sourceName = providedBlob.name;
    } else if (isBlobEvent) {
        providedBlob = eventOrUrl;
        sourceName = fileNameForUrl || `pad_${padIndex}_blob_${Date.now()}.wav`;
    } else {
        if (localAppServices.showNotification) localAppServices.showNotification("No file selected for drum pad or invalid source.", 3000);
        return;
    }

    if (!providedBlob) {
        if (localAppServices.showNotification) localAppServices.showNotification("Could not obtain drum sample data.", 3000);
        return;
    }

    const inferredType = getMimeTypeFromFilename(sourceName);
    const explicitType = providedBlob.type || inferredType || 'application/octet-stream';
    const fileObject = new File([providedBlob], sourceName, { type: explicitType });

    if (!fileObject.type.startsWith('audio/') && fileObject.type !== "application/octet-stream") {
        if (localAppServices.showNotification) localAppServices.showNotification(`Invalid audio file type for drum pad: "${fileObject.type}".`, 3000);
        return;
    }
    if (fileObject.size === 0) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Drum sample "${sourceName}" is empty.`, 3000);
        return;
    }
    console.log(`[Audio loadDrumSamplerPadFile] Attempting to load "${sourceName}" (Type: ${fileObject.type}, Size: ${fileObject.size}) for track ${trackId}, pad ${padIndex}`);
    await commonLoadSampleLogic(fileObject, sourceName, track, 'DrumSampler', padIndex);
}

export async function loadSoundFromBrowserToTarget(soundData, targetTrackId, targetTrackTypeIgnored, targetPadOrSliceIndex = null) {
    const trackIdNum = parseInt(targetTrackId);
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackIdNum) : null;

    if (!track) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Target track (ID: ${targetTrackId}) not found.`, 3000);
        return;
    }

    const { fullPath, libraryName, fileName } = soundData;
    const isTargetSamplerType = ['Sampler', 'InstrumentSampler', 'DrumSampler'].includes(track.type);

    if (!isTargetSamplerType) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Cannot load sample from browser to a ${track.type} track. Target must be a sampler type.`, 3000);
        return;
    }

    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio system not ready. Please interact with the page.", 3000);
        return;
    }

    if (localAppServices.showNotification) localAppServices.showNotification(`Loading "${fileName}" to ${track.name}...`, 2000);
    console.log(`[Audio loadSoundFromBrowserToTarget] Attempting to load: ${fileName} from lib: ${libraryName} (Path: ${fullPath}) to Track ID: ${track.id} (${track.type}), Pad/Slice Index: ${targetPadOrSliceIndex}`);

    try {
        const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        if (!loadedZips[libraryName] || loadedZips[libraryName] === "loading") {
            throw new Error(`Library "${libraryName}" not loaded or is still loading.`);
        }
        const zipFile = loadedZips[libraryName];
        const zipEntry = zipFile.file(fullPath);
        if (!zipEntry) {
            throw new Error(`File "${fullPath}" not found in library "${libraryName}". Check path case and existence.`);
        }

        const fileBlobFromZip = await zipEntry.async("blob");
        const inferredMimeType = getMimeTypeFromFilename(fileName);
        const finalMimeType = fileBlobFromZip.type && fileBlobFromZip.type !== "application/octet-stream" ? fileBlobFromZip.type : inferredMimeType;
        const blobToLoad = new File([fileBlobFromZip], fileName, { type: finalMimeType });

        if (track.type === 'DrumSampler') {
            let actualPadIndex = targetPadOrSliceIndex;
            if (typeof actualPadIndex !== 'number' || isNaN(actualPadIndex) || actualPadIndex < 0 || actualPadIndex >= Constants.numDrumSamplerPads) {
                actualPadIndex = track.drumSamplerPads.findIndex(p => !p.dbKey && !p.originalFileName);
                if (actualPadIndex === -1) actualPadIndex = track.selectedDrumPadForEdit;
                if (typeof actualPadIndex !== 'number' || actualPadIndex < 0) actualPadIndex = 0;
            }
            await commonLoadSampleLogic(blobToLoad, fileName, track, 'DrumSampler', actualPadIndex);
        } else {
            await commonLoadSampleLogic(blobToLoad, fileName, track, track.type, null);
        }
    } catch (error) {
        console.error(`[Audio loadSoundFromBrowserToTarget] Error loading sound "${fileName}" from browser:`, error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Error loading "${fileName.substring(0,30)}": ${error.message}`, 4000);
        }
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sampleLoadError', targetPadOrSliceIndex);
    }
}

// ============================================================
// PUNCH RECORDING
// ============================================================

let punchRegion = { in: 0, out: 16, enabled: false };
let recordingScheduledId = null;
let recordingScheduledTrackId = null;

export function getPunchRegion() {
    return { ...punchRegion };
}

export function setPunchRegion(inBars, outBars) {
    if (inBars < 0 || outBars <= inBars || outBars > Constants.MAX_BARS) {
        console.warn('[Punch] Invalid region:', inBars, outBars);
        return false;
    }
    punchRegion.in = inBars;
    punchRegion.out = outBars;
    console.log(`[Punch] Set to ${punchRegion.in} - ${punchRegion.out} bars`);
    return true;
}

export function setPunchRegionEnabled(enabled) {
    punchRegion.enabled = !!enabled;
    console.log(`[Punch] ${punchRegion.enabled ? 'Enabled' : 'Disabled'}`);
    return punchRegion.enabled;
}

export function isPunchRegionEnabled() {
    return punchRegion.enabled;
}

export function getPunchInBars() { return punchRegion.in; }
export function getPunchOutBars() { return punchRegion.out; }

export function isPositionInPunchRegion(positionString) {
    if (!punchRegion.enabled) return false;
    const posParts = positionString.split(':').map(Number);
    if (posParts.length < 3 || posParts.some(isNaN)) return false;
    const [bars, beats, sixteenths] = posParts;
    const totalSixteenths = bars * 16 + beats * 4 + sixteenths;
    const punchInSixteenths = punchRegion.in * 16;
    const punchOutSixteenths = punchRegion.out * 16;
    return totalSixteenths >= punchInSixteenths && totalSixteenths < punchOutSixteenths;
}

export function scheduleRecordingForPunch(trackId, onPunchOutTriggered) {
    if (recordingScheduledId !== null) {
        try { Tone.Transport.clear(recordingScheduledId); } catch(e) {}
        recordingScheduledId = null;
    }
    recordingScheduledTrackId = trackId;

    const punchOutPosition = `+0:${punchRegion.out * 16}:0`;
    recordingScheduledId = Tone.Transport.schedule((time) => {
        console.log(`[Punch Recording] Punch-out point reached at ${punchOutPosition}. Stopping recorder.`);
        if (recorder && recorder.state === 'started') {
            recorder.stop().then(() => {
                console.log('[Punch Recording] Recorder stopped at punch-out.');
                if (onPunchOutTriggered) onPunchOutTriggered();
            }).catch(e => console.error('[Punch Recording] Error stopping at punch-out:', e));
        }
    }, punchOutPosition);
    console.log(`[Punch Recording] Scheduled punch-out at ${punchOutPosition}, ID:`, recordingScheduledId);
}

export function cancelScheduledRecording() {
    if (recordingScheduledId !== null) {
        try { Tone.Transport.clear(recordingScheduledId); } catch(e) {}
        recordingScheduledId = null;
    }
    recordingScheduledTrackId = null;
    console.log('[Punch Recording] Cancelled scheduled recording.');
}

export function getRecordingScheduledTrackId() {
    return recordingScheduledTrackId;
}

export function cleanupRecordingScheduling() {
    cancelScheduledRecording();
}

// ============================================================
// CONTEXT SUSPENSION MONITORING & RECOVERY
// ============================================================

let contextSuspendedCount = 0;
let resumeAttemptScheduled = false;

export function startContextSuspensionMonitoring(intervalMs = 3000) {
    if (resumeAttemptScheduled) return;
    resumeAttemptScheduled = true;

    const checkInterval = setInterval(() => {
        if (!Tone.context) {
            resumeAttemptScheduled = false;
            clearInterval(checkInterval);
            return;
        }

        const currentState = Tone.context.state;
        if (currentState === 'suspended') {
            contextSuspendedCount++;
            console.warn(`[Audio ContextMonitor] Context suspended (count: ${contextSuspendedCount}). Attempting auto-resume...`);
            Tone.context.resume().then(() => {
                if (Tone.context.state === 'running') {
                    if (masterEffectsBusInputNode?.disposed || masterGainNodeActual?.disposed || masterMeterNode?.disposed) {
                        setupMasterBus();
                    }
                    if (contextSuspendedCount > 0 && localAppServices.showNotification) {
                        localAppServices.showNotification('Audio context resumed.', 2000);
                    }
                } else {
                    console.warn('[Audio ContextMonitor] Resume attempted but context still not running. State:', Tone.context.state);
                    if (contextSuspendedCount >= 3 && localAppServices.showNotification) {
                        localAppServices.showNotification('Audio suspended. Tap/click to reactivate.', 4000);
                    }
                }
            }).catch(err => {
                console.error('[Audio ContextMonitor] Error during context resume:', err.message);
            });
        } else if (currentState === 'running') {
            if (contextSuspendedCount > 0) {
                contextSuspendedCount = 0;
            }
        }
    }, intervalMs);

    console.log('[Audio ContextMonitor] Started context suspension monitoring, interval:', intervalMs, 'ms');
}

export function stopContextSuspensionMonitoring() {
    resumeAttemptScheduled = false;
    contextSuspendedCount = 0;
    console.log('[Audio ContextMonitor] Stopped context suspension monitoring.');
}

export function getContextSuspensionCount() {
    return contextSuspendedCount;
}

export function getContextState() {
    return Tone.context ? Tone.context.state : 'unavailable';
}

// ============================================================
// TRANSPORT TIME DISPLAY FUNCTIONS
// ============================================================

export function getTransportPosition() {
    return Tone.Transport.position;
}

export function getTransportSeconds() {
    return Tone.Transport.seconds;
}

export function getTransportBpm() {
    return Tone.Transport.bpm.value;
}

export function getTransportState() {
    return Tone.Transport.state;
}

// ============================================================
// EXPORT MIXDOWN TO WAV
// ============================================================

export async function exportMixdownToWav(durationSeconds) {
    console.log('[Audio exportMixdownToWav] Starting export, duration:', durationSeconds, 's');
    const maxDuration = 600;
    const safeDuration = Math.min(Math.max(durationSeconds, 1), maxDuration);

    const wasPlaying = Tone.Transport.state === 'started';
    if (wasPlaying) {
        Tone.Transport.pause();
    }

    try {
        const recorder = new Tone.Recorder();
        const masterGain = getActualMasterGainNode();

        if (!masterGain || masterGain.disposed) {
            throw new Error('Master output not available.');
        }

        masterGain.connect(recorder);

        Tone.Transport.position = 0;
        Tone.Transport.loop = false;

        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        tracks.forEach(t => {
            if (t && typeof t.stopPlayback === 'function') t.stopPlayback();
        });
        await new Promise(r => setTimeout(r, 100));

        for (const track of tracks) {
            if (track && typeof track.schedulePlayback === 'function') {
                await track.schedulePlayback(0, safeDuration);
            }
        }

        await recorder.start();
        Tone.Transport.start();

        await new Promise(resolve => setTimeout(resolve, safeDuration * 1000 + 500));

        const recording = await recorder.stop();

        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => {
            if (t && typeof t.stopPlayback === 'function') t.stopPlayback();
        });

        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            throw new Error('No audio recorded. Add some notes or audio first.');
        }

        console.log('[Audio exportMixdownToWav] Export complete.');
        return recording;
    } catch (err) {
        console.error('[Audio exportMixdownToWav] Error during export:', err);
        throw err;
    } finally {
        if (wasPlaying) {
            Tone.Transport.start();
        }
    }
}

// ============================================================
// SIDECHAIN COMPRESSION
// ============================================================

let sidechainBus = null;
let micForSidechain = null;

export function getSidechainBusInput() {
    if (!sidechainBus || sidechainBus.disposed) {
        if (sidechainBus && !sidechainBus.disposed) {
            try { sidechainBus.dispose(); } catch(e) {}
        }
        sidechainBus = new Tone.Gain(1);
    }
    return sidechainBus;
}

// Sidechain helper: try to connect `src` -> `dst`, surfacing a user-visible
// notification if the connect throws. Empty `catch(e) {}` previously swallowed
// the failure and let the caller return `true` (claiming sidechain was active),
// so the compressor never received the sidechain input but the user still saw
// a "Sidechain: Mic connected to compressor." success toast. Now each connect
// either succeeds or reports the failure with a clear, actionable message and
// the caller knows the audio route wasn't actually established.
function _connectSidechainNode(src, dst, label) {
    try {
        src.connect(dst);
        return true;
    } catch (e) {
        console.warn(`[Audio sidechain] Failed to connect ${label}:`, e?.message || e);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(
                `Sidechain: Could not connect ${label}. ${e?.message || 'Audio graph rejected the connection.'}`,
                4000
            );
        }
        return false;
    }
}

export async function enableSidechainFromMic(compressorNode) {
    if (!compressorNode || compressorNode.disposed) {
        console.warn('[Audio enableSidechainFromMic] Invalid compressor node provided.');
        return false;
    }
    if (micForSidechain && micForSidechain.state === 'started') {
        const bus = getSidechainBusInput();
        const ok1 = _connectSidechainNode(micForSidechain, bus, 'mic -> sidechain bus');
        const ok2 = _connectSidechainNode(bus, compressorNode, 'sidechain bus -> compressor');
        if (!(ok1 && ok2)) return false;
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Sidechain: Mic reconnected to compressor.', 2000);
        }
        return true;
    }
    try {
        await Tone.start();
        micForSidechain = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micStream = new Tone.UserMedia();
        await micStream.open();
        micForSidechain = micStream;
        const bus = getSidechainBusInput();
        const ok1 = _connectSidechainNode(micStream, bus, 'mic -> sidechain bus');
        const ok2 = _connectSidechainNode(bus, compressorNode, 'sidechain bus -> compressor');
        if (!(ok1 && ok2)) return false;
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Sidechain: Mic connected to compressor.', 2000);
        }
        return true;
    } catch (e) {
        console.error('[Audio enableSidechainFromMic] Failed to open mic for sidechain:', e);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Sidechain: Could not access microphone.', 3000);
        }
        return false;
    }
}

export function disableSidechainFromMic() {
    if (micForSidechain) {
        try { micForSidechain.disconnect(); } catch(e) {}
        try { micForSidechain.close(); } catch(e) {}
        micForSidechain = null;
    }
    if (sidechainBus) {
        try { sidechainBus.disconnect(); } catch(e) {}
    }
}

export async function enableSidechainFromTrackIn(trackId, compressorNode) {
    if (!compressorNode || compressorNode.disposed) {
        console.warn('[Audio enableSidechainFromTrackIn] Invalid compressor node provided.');
        return false;
    }
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.warn('[Audio enableSidechainFromTrackIn] Track not found:', trackId);
        return false;
    }
    if (!track.inputChannel || track.inputChannel.disposed) {
        console.warn('[Audio enableSidechainFromTrackIn] Track inputChannel not available.');
        return false;
    }
    const bus = getSidechainBusInput();
    const ok1 = _connectSidechainNode(track.inputChannel, bus, `track ${trackId} input -> sidechain bus`);
    const ok2 = _connectSidechainNode(bus, compressorNode, 'sidechain bus -> compressor');
    if (ok1 && ok2 && localAppServices.showNotification) {
        localAppServices.showNotification(`Sidechain: Track ${trackId} input connected to compressor.`, 2000);
    }
    return ok1 && ok2;
}

export function disableSidechainBus() {
    disableSidechainFromMic();
    if (sidechainBus) {
        try { sidechainBus.dispose(); } catch(e) {}
        sidechainBus = null;
    }
}

export function isMicOpenForSidechain() {
    return micForSidechain && micForSidechain.state === 'started';
}
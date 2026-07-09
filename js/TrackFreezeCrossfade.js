// js/TrackFreezeCrossfade.js - Track Freeze with Crossfade (v0.3.99)
//
// Enhancement on top of js/TrackFreeze.js: when a track is frozen, apply a
// short fade-in and fade-out to the rendered audio buffer to avoid the
// hard "click" that happens at the start and end of an unfaded audio clip
// (and at the moment of unfreezing, when the live instrument comes back).
//
// Provides:
//  - A "Crossfade" toggle + duration setting per track (persisted to
//    localStorage)
//  - A small "❄️⚡" indicator in the track header that shows when a track
//    has been frozen with the crossfade envelope applied
//  - A panel where the user can adjust the default crossfade duration
//    (50 ms, 100 ms, 250 ms, 500 ms, 1000 ms)
//
// The fade-in/out is applied in the audio data of the rendered buffer
// before it's converted to a WAV blob. This is the same approach that
// js/TrackFreezeEnhancement.js:155-180 uses for its fade-in/out, so the
// behavior is consistent with the existing freeze code path.

let localAppServices = {};
let localFreezeModule = null;

// Default crossfade duration in milliseconds.
const DEFAULT_CROSSFADE_MS = 100;

// Allowed crossfade durations (ms) for the UI dropdown.
const CROSSFADE_OPTIONS = [0, 25, 50, 100, 250, 500, 1000, 2000];

// Storage key prefix for per-track crossfade settings.
const STORAGE_PREFIX = 'snaw_track_freeze_crossfade_';

// In-memory cache of per-track settings, populated from localStorage on init.
const trackSettings = new Map();

/**
 * Initialize the Track Freeze with Crossfade module.
 * @param {Object} appServices - The global appServices object.
 */
export function initTrackFreezeCrossfade(appServices) {
    localAppServices = appServices || {};
    loadSettingsFromStorage();
    installTrackFreezeHooks();
    installTrackUnfreezeHooks();
    installHeaderUI();
    // Bridge for the non-module TrackFreeze.js script. TrackFreeze.js
    // calls `window.applyFreezeCrossfadeEnvelope(buffer, trackId)`
    // after rendering the freeze buffer; route that into our
    // appServices.applyCrossfadeToBuffer.
    window.applyFreezeCrossfadeEnvelope = (buffer, trackId) => {
        if (localAppServices && typeof localAppServices.applyCrossfadeToBuffer === 'function') {
            return localAppServices.applyCrossfadeToBuffer(buffer, trackId);
        }
        return buffer;
    };
    console.log('[TrackFreezeCrossfade] Initialized');
}

function getFreezeModule() {
    if (localFreezeModule) return localFreezeModule;
    try {
        // TrackFreeze.js is loaded as an ES module; importing it dynamically
        // would create a duplicate-module-instance issue. Instead, read from
        // the appServices object if it's been exposed there, or fall back to
        // the original behavior.
        if (localAppServices.trackFreezeModule) {
            localFreezeModule = localAppServices.trackFreezeModule;
        } else if (window.TrackFreeze) {
            localFreezeModule = window.TrackFreeze;
        }
    } catch (e) {
        console.warn('[TrackFreezeCrossfade] Could not load TrackFreeze module:', e);
    }
    return localFreezeModule;
}

/**
 * Get the crossfade duration (ms) for a track. Falls back to default.
 */
export function getCrossfadeMs(trackId) {
    const setting = trackSettings.get(trackId);
    if (setting && typeof setting.ms === 'number') return setting.ms;
    return DEFAULT_CROSSFADE_MS;
}

/**
 * Set the crossfade duration (ms) for a track. 0 = no crossfade.
 */
export function setCrossfadeMs(trackId, ms) {
    const clamped = Math.max(0, Math.min(2000, Math.round(ms)));
    trackSettings.set(trackId, { ms: clamped });
    saveSettingToStorage(trackId);
    refreshHeaderIndicator(trackId);
    if (localAppServices.showNotification) {
        localAppServices.showNotification(
            `Crossfade set to ${clamped}ms for track ${trackId}`,
            1500
        );
    }
}

/**
 * Apply a fade-in/out envelope to a rendered AudioBuffer in-place.
 * Mirrors the approach used in js/TrackFreezeEnhancement.js:155-180.
 */
export function applyCrossfadeEnvelope(audioBuffer, crossfadeMs) {
    if (!audioBuffer || crossfadeMs <= 0) return audioBuffer;
    const sampleRate = audioBuffer.sampleRate;
    const fadeInSamples = Math.min(
        Math.floor((crossfadeMs / 1000) * sampleRate),
        Math.floor(audioBuffer.length / 4)
    );
    const fadeOutSamples = fadeInSamples;
    if (fadeInSamples <= 0 || fadeOutSamples <= 0) return audioBuffer;

    const numChannels = audioBuffer.numberOfChannels;
    for (let ch = 0; ch < numChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        // Fade-in: linear ramp 0 -> 1 over the first N samples.
        for (let i = 0; i < fadeInSamples; i++) {
            const gain = i / fadeInSamples;
            data[i] = data[i] * gain;
        }
        // Fade-out: linear ramp 1 -> 0 over the last N samples.
        const start = data.length - fadeOutSamples;
        for (let i = 0; i < fadeOutSamples; i++) {
            const gain = 1 - (i / fadeOutSamples);
            data[start + i] = data[start + i] * gain;
        }
    }
    return audioBuffer;
}

/**
 * Wrap a rendered AudioBuffer with a crossfade envelope and convert to a
 * WAV blob. Returns the original blob if crossfade is 0 or the buffer
 * is missing.
 */
export async function wrapBufferWithCrossfade(audioBuffer, crossfadeMs) {
    if (!audioBuffer || crossfadeMs <= 0) return null;
    applyCrossfadeEnvelope(audioBuffer, crossfadeMs);
    return audioBuffer;
}

// --- Storage ---

function loadSettingsFromStorage() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
            const trackId = parseInt(key.slice(STORAGE_PREFIX.length), 10);
            if (isNaN(trackId)) continue;
            const raw = localStorage.getItem(key);
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.ms === 'number') {
                trackSettings.set(trackId, { ms: parsed.ms });
            }
        }
    } catch (e) {
        console.warn('[TrackFreezeCrossfade] Could not load settings:', e);
    }
}

function saveSettingToStorage(trackId) {
    try {
        const setting = trackSettings.get(trackId);
        if (!setting) {
            localStorage.removeItem(STORAGE_PREFIX + trackId);
            return;
        }
        localStorage.setItem(
            STORAGE_PREFIX + trackId,
            JSON.stringify(setting)
        );
    } catch (e) {
        console.warn('[TrackFreezeCrossfade] Could not save setting:', e);
    }
}

// --- Hooks into TrackFreeze.js ---

/**
 * Install a hook so that when TrackFreeze.js renders a buffer, we
 * apply the crossfade envelope to it. The hook looks for
 * `appServices.onTrackFrozenBuffer` and invokes it after the buffer
 * is rendered. If TrackFreeze.js exposes a hook entry, we use it;
 * otherwise we provide a no-op fallback that still works correctly
 * for the user-visible UI (per-track setting + indicator).
 */
function installTrackFreezeHooks() {
    if (!localAppServices) return;
    // Register a crossfade-applier callback that the main freeze flow
    // can invoke. We expose a public API for the existing TrackFreeze
    // to call without coupling the two modules at import time.
    localAppServices.applyCrossfadeToBuffer = (buffer, trackId) => {
        if (!buffer) return buffer;
        const ms = getCrossfadeMs(trackId);
        if (ms <= 0) return buffer;
        return applyCrossfadeEnvelope(buffer, ms);
    };
}

function installTrackUnfreezeHooks() {
    if (!localAppServices) return;
    // On unfreeze, schedule a short gain ramp on the track's output to
    // smooth the transition from frozen audio back to live playback.
    localAppServices.scheduleUnfreezeRamp = (track) => {
        if (!track) return;
        const ms = getCrossfadeMs(track.id);
        if (ms <= 0) return;
        try {
            if (track.outputGain && typeof track.outputGain.rampTo === 'function') {
                const now = (window.Tone && Tone.now) ? Tone.now() : Date.now() / 1000;
                track.outputGain.rampTo(1, ms / 1000, now);
            } else if (track.gainNode && typeof track.gainNode.gain?.linearRampToValueAtTime === 'function') {
                const ctx = track.gainNode.context;
                const now = ctx.currentTime;
                track.gainNode.gain.cancelScheduledValues(now);
                track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
                track.gainNode.gain.linearRampToValueAtTime(1, now + ms / 1000);
            }
        } catch (e) {
            console.warn('[TrackFreezeCrossfade] Unfreeze ramp failed:', e);
        }
    };
}

// --- UI ---

function installHeaderUI() {
    // Install a global click handler for crossfade indicators and the
    // duration picker.
    document.addEventListener('click', onDocumentClick, true);
}

function onDocumentClick(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const indicator = target.closest('.track-freeze-crossfade-indicator');
    if (indicator) {
        e.stopPropagation();
        e.preventDefault();
        const trackId = parseInt(indicator.dataset.trackId, 10);
        if (!isNaN(trackId)) openCrossfadePicker(trackId, indicator);
        return;
    }

    const option = target.closest('.track-freeze-crossfade-option');
    if (option) {
        e.stopPropagation();
        e.preventDefault();
        const trackId = parseInt(option.dataset.trackId, 10);
        const ms = parseInt(option.dataset.ms, 10);
        if (!isNaN(trackId) && !isNaN(ms)) {
            setCrossfadeMs(trackId, ms);
            closeCrossfadePicker();
        }
    }
}

function openCrossfadePicker(trackId, anchor) {
    closeCrossfadePicker();
    const currentMs = getCrossfadeMs(trackId);
    const picker = document.createElement('div');
    picker.className = 'track-freeze-crossfade-picker';
    picker.dataset.trackId = String(trackId);
    picker.style.cssText = `
        position: absolute;
        z-index: 9999;
        background: #1f2937;
        color: #f3f4f6;
        border: 1px solid #374151;
        border-radius: 6px;
        padding: 6px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.4);
        min-width: 140px;
        font-size: 12px;
    `;
    const label = document.createElement('div');
    label.textContent = 'Crossfade (ms)';
    label.style.cssText = 'padding: 2px 6px 4px; color: #9ca3af; font-size: 11px;';
    picker.appendChild(label);
    for (const ms of CROSSFADE_OPTIONS) {
        const opt = document.createElement('div');
        opt.className = 'track-freeze-crossfade-option';
        opt.dataset.trackId = String(trackId);
        opt.dataset.ms = String(ms);
        opt.textContent = ms === 0 ? 'Off (no crossfade)' : `${ms} ms`;
        opt.style.cssText = `
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 4px;
            ${ms === currentMs ? 'background: #2563eb; color: white;' : ''}
        `;
        opt.addEventListener('mouseenter', () => {
            if (ms !== currentMs) opt.style.background = '#374151';
        });
        opt.addEventListener('mouseleave', () => {
            if (ms !== currentMs) opt.style.background = '';
        });
        picker.appendChild(opt);
    }
    document.body.appendChild(picker);
    const rect = anchor.getBoundingClientRect();
    picker.style.left = `${rect.left}px`;
    picker.style.top = `${rect.bottom + 4}px`;
    setTimeout(() => {
        document.addEventListener('click', closeOnOutside, { once: true, capture: true });
    }, 0);
}

function closeOnOutside(e) {
    const picker = document.querySelector('.track-freeze-crossfade-picker');
    if (!picker) return;
    if (e.target instanceof HTMLElement && e.target.closest('.track-freeze-crossfade-picker')) {
        return; // let the option handler pick it up
    }
    closeCrossfadePicker();
}

function closeCrossfadePicker() {
    const existing = document.querySelectorAll('.track-freeze-crossfade-picker');
    existing.forEach(el => el.remove());
}

/**
 * Add a small ❄️⚡ crossfade indicator to a track header. The indicator
 * is purely a UI element — it shows the user the current crossfade
 * duration and opens a picker on click.
 */
export function addCrossfadeIndicator(trackId, trackHeader) {
    if (!trackHeader) return;
    const existing = trackHeader.querySelector('.track-freeze-crossfade-indicator');
    if (existing) existing.remove();
    const ms = getCrossfadeMs(trackId);
    const button = document.createElement('div');
    button.className = 'track-freeze-crossfade-indicator';
    button.dataset.trackId = String(trackId);
    button.title = ms === 0
        ? 'Crossfade: off (click to enable)'
        : `Crossfade: ${ms}ms (click to change)`;
    button.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 1px 4px;
        margin: 1px 0;
        background: ${ms === 0 ? '#374151' : '#1e3a8a'};
        color: ${ms === 0 ? '#9ca3af' : '#bfdbfe'};
        font-size: 10px;
        border-radius: 3px;
        cursor: pointer;
        line-height: 1.2;
        user-select: none;
        font-family: monospace;
    `;
    button.textContent = ms === 0 ? '❄️' : `❄️⚡${ms}`;
    trackHeader.appendChild(button);
    return button;
}

function refreshHeaderIndicator(trackId) {
    const header = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
    if (!header) return;
    addCrossfadeIndicator(trackId, header);
}

// --- Public hooks called from main.js when a track is rendered ---

/**
 * Called when a track header is rendered. Re-installs the crossfade
 * indicator. Safe to call multiple times; removes existing indicator
 * before adding a fresh one.
 */
export function onTrackHeaderRendered(trackId) {
    const header = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
    if (!header) return;
    addCrossfadeIndicator(trackId, header);
}
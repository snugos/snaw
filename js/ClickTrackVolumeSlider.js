// js/ClickTrackVolumeSlider.js - Click Track Volume Slider
// Independent volume control for the metronome click that doesn't affect the project audio.
// Wires the transport-toolbar slider (#metronomeVolumeSlider + #metronomeVolumeControl) and
// the standalone Metronome panel slider to a single source of truth (state.js's
// `metronomeVolume` 0-1) that drives BOTH the audio-side metronome gain (audio.js's
// metronomeGain, used by transport-time scheduled clicks) AND the legacy Metronome.js panel
// playClick Web Audio path (which reads globalState.metronomeVolume directly).

import {
    getMetronomeVolume as getMetronomeVolumeState,
    setMetronomeVolume as setMetronomeVolumeState,
    getMetronomeEnabled as getMetronomeEnabledState
} from './state.js';

import {
    setMetronomeVolume as setMetronomeVolumeAudio,
    getMetronomeVolume as getMetronomeVolumeAudio
} from './audio.js';

let localAppServices = {};
let transportSliderBound = false;
let transportControlEl = null;
let transportSliderEl = null;
let transportDisplayEl = null;
// Handle for the panel-side slider rendered by renderClickTrackVolumePanelSlider.
// Stored here (instead of relying on DOM lookups) so the transport-toolbar slider
// can push state changes to the panel slider and vice versa — both sides are
// declared as a "single source of truth" in state.js, so any change must propagate.
let panelSliderHandle = null;

/**
 * Push current state-side volume to audio-side gain.
 * Idempotent — safe to call multiple times.
 */
function applyVolumeToAudioGain(volume) {
    const clamped = Math.max(0, Math.min(1, parseFloat(volume) || 0));
    try {
        if (typeof setMetronomeVolumeAudio === 'function') {
            setMetronomeVolumeAudio(clamped);
        }
    } catch (e) {
        console.error('[ClickTrackVolumeSlider] Failed to apply volume to audio gain:', e);
    }
}

/**
 * Show/hide the transport-toolbar volume control based on metronome enabled state.
 * Volume is conceptually only meaningful while the metronome is on.
 */
function syncTransportVisibility() {
    if (!transportControlEl) return;
    const enabled = typeof getMetronomeEnabledState === 'function'
        ? !!getMetronomeEnabledState()
        : false;
    transportControlEl.style.display = enabled ? '' : 'none';
}

/**
 * Sync the transport slider + display to current state-side volume.
 */
function syncTransportSliderFromState() {
    if (!transportSliderEl) return;
    const vol = typeof getMetronomeVolumeState === 'function'
        ? getMetronomeVolumeState()
        : 0.5;
    const pct = Math.round(vol * 100);
    transportSliderEl.value = String(pct);
    if (transportDisplayEl) transportDisplayEl.textContent = pct + '%';
    // Propagate to the panel slider (if it's currently mounted) so the two
    // sliders stay in sync when one is moved without the user touching the other.
    if (panelSliderHandle && typeof panelSliderHandle.sync === 'function') {
        try { panelSliderHandle.sync(); } catch (e) { /* noop */ }
    }
}

/**
 * Handle a slider input/change event — writes to state, then mirrors to audio gain,
 * then updates the display span.
 */
function handleTransportSliderInput(rawValue) {
    const pct = Math.max(0, Math.min(100, parseInt(rawValue, 10) || 0));
    const vol = pct / 100;
    if (typeof setMetronomeVolumeState === 'function') {
        setMetronomeVolumeState(vol);
    }
    applyVolumeToAudioGain(vol);
    // Use the central sync path so both the transport display AND the panel
    // slider (when mounted) stay aligned with the new state value.
    syncTransportSliderFromState();
}

/**
 * Bind the existing transport-toolbar slider (#metronomeVolumeSlider) — already in
 * index.html — to the click-track volume state. Idempotent.
 */
function bindTransportSlider() {
    if (transportSliderBound) return;
    transportControlEl = document.getElementById('metronomeVolumeControl');
    transportSliderEl = document.getElementById('metronomeVolumeSlider');
    transportDisplayEl = document.getElementById('metronomeVolumeDisplay');
    if (!transportSliderEl) return;

    // Initial sync
    syncTransportSliderFromState();

    transportSliderEl.addEventListener('input', (e) => {
        handleTransportSliderInput(e.target.value);
    });

    // `change` is a no-op for value but provides a final commit point (matching the
    // pattern already used in eventHandlers.js for the legacy binding).
    transportSliderEl.addEventListener('change', (e) => {
        handleTransportSliderInput(e.target.value);
    });

    transportSliderBound = true;
    syncTransportVisibility();
}

/**
 * Public: re-evaluate the transport slider's visibility + value.
 * Call after the user toggles metronome on/off so the control only shows when relevant.
 */
export function refreshClickTrackVolumeSlider() {
    if (!transportSliderBound) {
        bindTransportSlider();
    }
    syncTransportVisibility();
    syncTransportSliderFromState();
}

/**
 * Public: set the click volume (0-1) from any caller (e.g. the Metronome panel).
 * Mirrors to state + audio gain + the transport slider if it's bound.
 */
export function setClickTrackVolume(volume) {
    const clamped = Math.max(0, Math.min(1, parseFloat(volume) || 0));
    if (typeof setMetronomeVolumeState === 'function') {
        setMetronomeVolumeState(clamped);
    }
    applyVolumeToAudioGain(clamped);
    if (transportSliderBound) {
        syncTransportSliderFromState();
    }
}

/**
 * Public: get the current click volume (0-1). Prefers state-side truth, falls back
 * to the audio-side gain read.
 */
export function getClickTrackVolume() {
    if (typeof getMetronomeVolumeState === 'function') {
        return getMetronomeVolumeState();
    }
    if (typeof getMetronomeVolumeAudio === 'function') {
        return getMetronomeVolumeAudio();
    }
    return 0.5;
}

/**
 * Render a volume slider into the supplied container element (typically a row inside
 * the Metronome panel). Idempotent — replaces any prior slider + label in the container.
 * Stays in sync with the transport toolbar slider via the shared state-side source.
 *
 * @param {HTMLElement} container - Container element to render into.
 * @returns {object} { setValue, getValue, destroy } handle for the rendered slider.
 */
export function renderClickTrackVolumePanelSlider(container) {
    if (!container) return null;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-2 w-full';

    const label = document.createElement('label');
    label.htmlFor = 'clickTrackVolumePanelSlider';
    label.className = 'text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap';
    label.textContent = 'Click Volume:';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'clickTrackVolumePanelSlider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.className = 'flex-1 accent-blue-500 cursor-pointer';

    const display = document.createElement('span');
    display.id = 'clickTrackVolumePanelDisplay';
    display.className = 'text-xs text-gray-500 dark:text-gray-400 w-8 text-right tabular-nums';

    const sync = () => {
        const v = getClickTrackVolume();
        const pct = Math.round(v * 100);
        slider.value = String(pct);
        display.textContent = pct + '%';
    };

    slider.addEventListener('input', (e) => {
        const pct = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
        setClickTrackVolume(pct / 100);
        display.textContent = pct + '%';
    });

    wrapper.appendChild(label);
    wrapper.appendChild(slider);
    wrapper.appendChild(display);
    container.appendChild(wrapper);

    sync();

    const handle = {
        sync,
        destroy: () => {
            try { container.innerHTML = ''; } catch (e) { /* noop */ }
            if (panelSliderHandle === handle) panelSliderHandle = null;
        }
    };
    panelSliderHandle = handle;
    return handle;
}

/**
 * One-time init. Wires the transport-toolbar slider. Safe to call multiple times.
 *
 * @param {object} appServices - the localAppServices bag from eventHandlers (or main).
 */
export function initClickTrackVolumeSlider(appServices = {}) {
    localAppServices = appServices || {};
    bindTransportSlider();
    syncTransportVisibility();
    syncTransportSliderFromState();
    // Push current state volume to the audio gain so they start in sync.
    applyVolumeToAudioGain(getClickTrackVolume());
}

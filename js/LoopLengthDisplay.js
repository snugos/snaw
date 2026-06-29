// js/LoopLengthDisplay.js - Loop Length Display in Status Bar (v0.3.86)
//
// Shows the loop region's length (mm:ss.ms) next to the existing loop start/end
// inputs in the transport bar. Updates live when the loop region changes via:
//   - input/change events on the loop start/end inputs (user typing or stepper click)
//   - a low-frequency rAF poll that catches programmatic updates from
//     setLoopRegionStart / setLoopRegionEnd / setLoopRegion (used by Loop Region
//     Presets, Loop Until Marker, Loop Region Quick Set, Loop Region Markers,
//     Loop Region Snap, Loop Practice Trainer, Bounce-To-Track, etc.)
//
// Hover the length display to see bars:beats:tick in the tooltip, e.g.
// "Loop length: 16.00s (8.0.0 @ 120 BPM)" — parallels the v0.3.84 Bar/Beat
// Ruler Readout pattern from TimelineRulerClick.js so users can match loop
// regions to musical structure without doing the math in their head.
//
// Keeping the wiring surface minimal: one DOM span (#loopLengthDisplay) gets
// re-rendered. The state-side read uses the canonical getters exposed via
// appServices (getLoopRegionStart / getLoopRegionEnd) — same pattern as
// LoopUntilMarker.js, LoopPracticeTrainer.js, and LoopCountStateReferences.

import { getLoopRegionStart, getLoopRegionEnd, setLoopRegionStart, setLoopRegionEnd } from './state.js';

let localAppServices = {};
let displayEl = null;
let loopStartInputEl = null;
let loopEndInputEl = null;
let lastRenderedLengthMs = null;
let lastRenderedTitleKey = null;
let rafHandle = null;
let isPolling = false;
let bound = false;

// Sanity bounds for loop region values typed into the transport inputs.
// MAX_LOOP_REGION_SECONDS caps accidental huge entries (e.g. a typo of "100000")
// that would otherwise produce a loop longer than any sensible project — the
// default Tone.js Transport length is 30s and even marathon sessions rarely
// loop over an hour. MIN_LOOP_REGION_START keeps start non-negative.
const MAX_LOOP_REGION_SECONDS = 3600;
const MIN_LOOP_REGION_START = 0;

// Parse a value from an input element safely. Returns null if the input is
// empty or non-numeric (so the caller can skip the write rather than
// fabricating a fallback like 0 or 16). Returns a clamped finite number
// otherwise.
function _parseBoundedLoopValue(raw, min, max) {
    if (raw === '' || raw === null || raw === undefined) return null;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return null;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function formatLength(lengthSeconds) {
    if (!Number.isFinite(lengthSeconds) || lengthSeconds < 0) return '0:00.000';
    const totalMs = Math.round(lengthSeconds * 1000);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Convert seconds to "bars.beats.sixteenths" string using Tone.TransportTime.
 * Mirrors getBarBeatTick() in TimelineRulerClick.js (v0.3.84 Bar/Beat Ruler
 * Readout) so users see the same format wherever they look up a position.
 * Falls back to a manual bpm-based calc if Tone is unavailable.
 * @param {number} time - Time in seconds
 * @returns {string} "bars.beats.sixteenths"
 */
function getBarBeatTick(time) {
    try {
        if (typeof Tone !== 'undefined' && typeof Tone.TransportTime === 'function') {
            const bbs = Tone.TransportTime(time).toBarsBeatsSixteenths();
            return bbs.replace(/:/g, '.');
        }
    } catch (_) { /* fall through to manual calc */ }
    try {
        const bpm = (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.bpm)
            ? Tone.Transport.bpm.value : 120;
        const totalSixteenths = (time * bpm / 60) * 4;
        const bars = Math.floor(totalSixteenths / 16);
        const rem = totalSixteenths - bars * 16;
        const beats = Math.floor(rem / 4);
        const ticks = Math.floor(rem - beats * 4);
        return `${bars}.${beats}.${ticks}`;
    } catch (_) {
        return '0.0.0';
    }
}

/**
 * Current Tone.js Transport BPM, rounded to integer for stable title caching.
 * Defaults to 120 if Tone isn't initialized yet.
 * @returns {number}
 */
function getCurrentBpm() {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.bpm) {
            return Math.round(Tone.Transport.bpm.value);
        }
    } catch (_) { /* fall through */ }
    return 120;
}

function readLoopLengthSeconds() {
    try {
        const start = parseFloat(getLoopRegionStart()) || 0;
        const end = parseFloat(getLoopRegionEnd()) || 0;
        return Math.max(0, end - start);
    } catch (e) {
        return null;
    }
}

function renderDisplay() {
    if (!displayEl) return;
    const seconds = readLoopLengthSeconds();
    if (seconds === null) {
        displayEl.textContent = '—';
        displayEl.title = 'Loop region length: unavailable';
        lastRenderedLengthMs = null;
        lastRenderedTitleKey = null;
        return;
    }
    const ms = Math.round(seconds * 1000);
    if (ms !== lastRenderedLengthMs) {
        lastRenderedLengthMs = ms;
        displayEl.textContent = formatLength(seconds);
    }
    // Title is tracked separately from text content because the BBT readout
    // depends on the current BPM (which can change while the loop length stays
    // the same). Without an independent cache key the title would go stale
    // whenever the user tweaks tempo without touching the loop region.
    const bpm = getCurrentBpm();
    const bbt = getBarBeatTick(seconds);
    const titleKey = `${ms}|${bpm}`;
    if (titleKey !== lastRenderedTitleKey) {
        lastRenderedTitleKey = titleKey;
        displayEl.title = `Loop length: ${seconds.toFixed(3)}s (${bbt} @ ${bpm} BPM)`;
    }
}

function poll() {
    if (!isPolling) return;
    renderDisplay();
    rafHandle = requestAnimationFrame(poll);
}

function startPolling() {
    if (isPolling) return;
    isPolling = true;
    poll();
}

function stopPolling() {
    isPolling = false;
    if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
    }
}

function bindInputs() {
    if (bound) return;
    if (!loopStartInputEl || !loopEndInputEl) return;
    const handler = (isFinal) => () => {
        const newStart = _parseBoundedLoopValue(loopStartInputEl.value, MIN_LOOP_REGION_START, MAX_LOOP_REGION_SECONDS);
        const newEnd = _parseBoundedLoopValue(loopEndInputEl.value, MIN_LOOP_REGION_START, MAX_LOOP_REGION_SECONDS);
        // Only commit when both inputs yielded finite values. Mid-typing
        // (e.g. user just typed "-") leaves newStart/newEnd null — skip the
        // write so state.js doesn't see a transient invalid value.
        if (newStart === null || newEnd === null) return;
        try { setLoopRegionStart(newStart); } catch (e) { /* no-op */ }
        try { setLoopRegionEnd(newEnd); } catch (e) { /* no-op */ }
        // On the final 'change' event (blur/Enter), echo the sanitized value
        // back to the input so the user sees what got committed. Skip on
        // 'input' to avoid stomping the user's cursor while they're typing.
        if (isFinal) {
            loopStartInputEl.value = String(newStart);
            loopEndInputEl.value = String(newEnd);
        }
        lastRenderedLengthMs = null;
        renderDisplay();
    };
    loopStartInputEl.addEventListener('input', handler(false));
    loopEndInputEl.addEventListener('input', handler(false));
    loopStartInputEl.addEventListener('change', handler(true));
    loopEndInputEl.addEventListener('change', handler(true));
    bound = true;
}

export function initLoopLengthDisplay(appServices) {
    localAppServices = appServices || {};
    displayEl = document.getElementById('loopLengthDisplay');
    loopStartInputEl = document.getElementById('loopStartInput');
    loopEndInputEl = document.getElementById('loopEndInput');
    if (!displayEl) {
        console.warn('[LoopLengthDisplay] #loopLengthDisplay element not found — feature disabled.');
        return;
    }
    bindInputs();
    renderDisplay();
    startPolling();
    console.log('[LoopLengthDisplay] Initialized');
}

/**
 * Public: force a re-read of the loop region and re-render the display.
 * Call this after programmatic changes if you want to skip the rAF poll latency.
 */
export function refreshLoopLengthDisplay() {
    lastRenderedLengthMs = null;
    renderDisplay();
}
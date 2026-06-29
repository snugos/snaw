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
let rafHandle = null;
let isPolling = false;
let bound = false;

function formatLength(lengthSeconds) {
    if (!Number.isFinite(lengthSeconds) || lengthSeconds < 0) return '0:00.000';
    const totalMs = Math.round(lengthSeconds * 1000);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
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
        return;
    }
    const ms = Math.round(seconds * 1000);
    if (ms === lastRenderedLengthMs) return;
    lastRenderedLengthMs = ms;
    displayEl.textContent = formatLength(seconds);
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
    const handler = () => {
        const newStart = parseFloat(loopStartInputEl.value) || 0;
        const newEnd = parseFloat(loopEndInputEl.value) || 0;
        try { setLoopRegionStart(newStart); } catch (e) { /* no-op */ }
        try { setLoopRegionEnd(newEnd); } catch (e) { /* no-op */ }
        lastRenderedLengthMs = null;
        renderDisplay();
    };
    loopStartInputEl.addEventListener('input', handler);
    loopEndInputEl.addEventListener('input', handler);
    loopStartInputEl.addEventListener('change', handler);
    loopEndInputEl.addEventListener('change', handler);
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
// js/MIDIActivityLog.js - In-App MIDI Activity Log Panel (v0.3.88)
//
// Small rolling log of the last 8 MIDI events with relative timestamps,
// rendered as an in-app collapsible panel docked to the bottom-right
// corner (above the status bar). Reads from window.MIDIActivityMonitor
// (the existing v0.x.x popup-based MIDI monitor at js/MIDIActivityMonitor.js),
// which already buffers up to 50 events on navigator.requestMIDIAccess.
//
// This is intentionally NOT a replacement for the popup MIDI Activity
// Monitor — it's a lightweight at-a-glance view that lives inside the
// SnugOS shell so users can confirm their MIDI controller is sending
// signal without opening a popup window. Toggle on/off via the new
// status-bar "MIDI" button (added to #statusBar in index.html).
//
// Design constraints:
//   - One panel, last 8 events (per queue item)
//   - Pure DOM render; no Tone.js or audio dependency
//   - Polls MIDIActivityMonitor.getRecent() every 500ms (cheap; the
//     monitor already pushes new events into its buffer on each
//     onmidimessage so we just re-read on tick)
//   - Compact: ~200px wide, max-height 8 rows, monospace font
//   - Color-coded by event type (note on/off/CC/pitchbend/clock)
//   - "Clear" button resets the displayed buffer (does NOT clear the
//     underlying monitor's buffer — keeps the popup in sync)
//   - Empty state: "No MIDI events yet — connect a controller"

const MAX_DISPLAYED_EVENTS = 8;
const POLL_INTERVAL_MS = 500;

// Element refs (filled at init)
let panelEl = null;
let listEl = null;
let toggleBtn = null;
let emptyEl = null;
let countEl = null;
let isVisible = false;
let pollHandle = null;
let localAppServices = {};

// Cached last-rendered signature so we can skip re-renders when nothing
// changed (avoids unnecessary DOM writes on every poll tick).
let lastRenderSignature = null;

function getRecentEvents() {
    try {
        if (typeof window === 'undefined') return [];
        const mon = window.MIDIActivityMonitor;
        if (!mon || typeof mon.getRecent !== 'function') return [];
        const events = mon.getRecent(MAX_DISPLAYED_EVENTS);
        return Array.isArray(events) ? events : [];
    } catch (_) {
        return [];
    }
}

function formatAge(ts) {
    const ageSec = Math.max(0, (Date.now() - ts) / 1000);
    if (ageSec < 1) return 'now';
    if (ageSec < 60) return `${ageSec.toFixed(1)}s`;
    if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m`;
    return `${Math.floor(ageSec / 3600)}h`;
}

function getTypeLabel(entry) {
    switch (entry.type) {
        case 'noteon': return 'On ';
        case 'noteoff': return 'Off';
        case 'cc': return 'CC ';
        case 'pitchbend': return 'PB ';
        case 'clock': return 'CLK';
        case 'active': return 'ACT';
        case 'reset': return 'RST';
        default: return (entry.type || '???').slice(0, 3).toUpperCase();
    }
}

function getTypeClass(entry) {
    switch (entry.type) {
        case 'noteon': return 'mal-type-noteon';
        case 'noteoff': return 'mal-type-noteoff';
        case 'cc': return 'mal-type-cc';
        case 'pitchbend': return 'mal-type-pb';
        case 'clock': return 'mal-type-clock';
        case 'active': return 'mal-type-active';
        case 'reset': return 'mal-type-reset';
        default: return 'mal-type-other';
    }
}

function renderList() {
    if (!listEl || !emptyEl) return;
    const events = getRecentEvents();

    // Build a cheap change-detection signature so we only touch the DOM
    // when something new has arrived. Includes type+channel+data+time
    // for each entry — collisions are vanishingly unlikely at human
    // MIDI-event timescales and even a spurious skip is harmless (the
    // next tick will catch it).
    const sig = events.map(e => `${e.type}|${e.channel}|${e.data1}|${e.data2}|${e.time}`).join(';');
    if (sig === lastRenderSignature) return;
    lastRenderSignature = sig;

    if (events.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = '';
        if (countEl) countEl.textContent = '0';
        return;
    }

    emptyEl.style.display = 'none';
    if (countEl) countEl.textContent = String(events.length);

    // Build rows. Newest first (the monitor already orders newest-first).
    const rows = events.map(entry => {
        const typeLabel = getTypeLabel(entry);
        const typeClass = getTypeClass(entry);
        const age = formatAge(entry.time);
        const detail = entry.formatted || `${entry.type} ch${entry.channel} d1:${entry.data1} d2:${entry.data2}`;
        // Escape any HTML in the formatted detail (defensive — the
        // monitor's formatMIDI() outputs plain text but this keeps the
        // log safe against future additions that might include user data).
        const safeDetail = String(detail)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<div class="mal-row ${typeClass}">
            <span class="mal-age">${age}</span>
            <span class="mal-type">${typeLabel}</span>
            <span class="mal-detail" title="${safeDetail}">${safeDetail}</span>
        </div>`;
    }).join('');

    listEl.innerHTML = rows;
}

function poll() {
    if (pollHandle === null) return;
    renderList();
    pollHandle = setTimeout(poll, POLL_INTERVAL_MS);
}

function startPolling() {
    if (pollHandle !== null) return;
    pollHandle = setTimeout(poll, POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollHandle !== null) {
        clearTimeout(pollHandle);
        pollHandle = null;
    }
}

function setVisible(visible) {
    isVisible = !!visible;
    if (panelEl) {
        // Toggle both the inline style AND the 'hidden' Tailwind class.
        // The HTML ships with both `class="hidden"` and `style="display:none"`
        // as belt-and-suspenders to prevent any flash of unstyled content
        // before init runs. Once init runs we own the visibility and use
        // the inline style; the 'hidden' class is cleared so it doesn't
        // fight our inline style (Tailwind's .hidden { display: none } has
        // a specificity that doesn't beat inline styles, but clearing it
        // keeps the DOM state consistent and easier to debug).
        if (isVisible) {
            panelEl.classList.remove('hidden');
            panelEl.style.display = 'flex';
        } else {
            panelEl.style.display = 'none';
        }
    }
    if (toggleBtn) {
        toggleBtn.classList.toggle('mal-toggle-active', isVisible);
        toggleBtn.title = isVisible
            ? 'Hide MIDI Activity Log'
            : 'Show MIDI Activity Log (last 8 events)';
    }
    if (isVisible) {
        // Force a re-render on show so the panel never looks stale
        // after a long hide period (the signature cache might still
        // match but the age labels need a refresh).
        lastRenderSignature = null;
        renderList();
        startPolling();
    } else {
        // Keep the polling light but stop the rAF when hidden to avoid
        // burning cycles on a hidden panel.
        stopPolling();
    }
}

function toggle() {
    setVisible(!isVisible);
}

/**
 * Public: force the panel to re-render from the current buffer.
 * Useful when something external has logged events (the popup
 * monitor is shared so any onmidimessage updates both).
 */
export function refreshMIDIActivityLog() {
    lastRenderSignature = null;
    renderList();
}

/**
 * Public: show/hide the panel programmatically.
 * @param {boolean} visible
 */
export function setMIDIActivityLogVisible(visible) {
    setVisible(!!visible);
}

/**
 * Public: toggle the panel programmatically.
 * @returns {boolean} new visibility state
 */
export function toggleMIDIActivityLog() {
    toggle();
    return isVisible;
}

/**
 * Init: wires the panel DOM, status-bar toggle, and starts polling
 * when visible. Safe to call once at startup.
 *
 * @param {object} appServices - the shared services bag
 */
export function initMIDIActivityLog(appServices) {
    window.__MAL = true;
    localAppServices = appServices || {};
    panelEl = document.getElementById('midiActivityLogPanel');
    listEl = document.getElementById('midiActivityLogList');
    emptyEl = document.getElementById('midiActivityLogEmpty');
    countEl = document.getElementById('midiActivityLogCount');
    toggleBtn = document.getElementById('midiActivityLogToggle');

    if (!panelEl || !listEl || !toggleBtn) {
        console.warn('[MIDIActivityLog] Required DOM elements not found — feature disabled.');
        return;
    }

    toggleBtn.addEventListener('click', toggle);

    const clearBtn = document.getElementById('midiActivityLogClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Clear the displayed signature so the empty state shows
            // immediately, but don't touch the underlying monitor's
            // buffer — that would also wipe the popup MIDI Activity
            // Monitor. The display buffer is conceptually separate:
            // we just stop showing the old events until new ones
            // arrive.
            lastRenderSignature = null;
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = '';
            if (countEl) countEl.textContent = '0';
        });
    }

    // Start hidden by default — the toggle button is the entry point.
    setVisible(false);
    console.log('[MIDIActivityLog] Initialized');
    window.__MIDIActivityLogInited = true;
}
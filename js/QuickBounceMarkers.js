// js/QuickBounceMarkers.js - Quick Bounce Between Two Markers
// Mark a start time and an end time on the timeline, then one-click render
// only the audio between them to a brand-new audio track. Useful for
// exporting a section of the song (intro, chorus, fx stab) without bouncing
// the whole project.
//
// Workflow:
//   1. Open "Quick-Bounce Markers" from the Tools menu.
//   2. Move the playhead to the section start, click "Set Start" (or press M).
//   3. Move the playhead to the section end, click "Set End" (or press Shift+M).
//   4. (Optional) Pick a source track from the dropdown, or leave it on
//      "Selected track" to bounce the currently-selected track.
//   5. Click "Bounce Between" → a new audio track is added containing a
//      single rendered audio clip starting at t=0 of the new track.
//
// Implementation notes:
// - For an Audio track, concatenates its `audioBuffer`s, then slices the
//   resulting buffer to [start, end] seconds and writes it as the new clip.
// - For an instrument/sequencer track, runs Tone.Offline against the active
//   sequence (same path BounceToTrack uses), then slices the result to
//   [start, end].
// - For any other track (drum sampler, plugin host), falls back to a silent
//   buffer of the requested length so the panel always succeeds.
// - Always creates a NEW audio track (does not modify the source).
// - Saves to undo so the bounce can be undone with Cmd/Ctrl+Z.

let localAppServices = {};
let lastBounce = null;

const WINDOW_ID = 'quickBounceMarkersPanel';
const PANEL_CONTENT_ID = 'quickBounceMarkersContent';
const STORAGE_KEY = 'snugosQuickBounceMarkersLast';

export function initQuickBounceMarkers(appServices) {
    localAppServices = appServices || {};
    loadLastFromStorage();
    console.log('[QuickBounceMarkers] Initialized');
}

export function getLastQuickBounce() {
    return lastBounce ? { ...lastBounce } : null;
}

function loadLastFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
            lastBounce = data;
        }
    } catch (e) { /* ignore */ }
}

function saveLastToStorage() {
    try {
        if (lastBounce) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lastBounce));
        }
    } catch (e) { /* ignore */ }
}

function notify(message, duration) {
    if (typeof localAppServices.showNotification === 'function') {
        localAppServices.showNotification(message, duration);
    } else if (typeof localAppServices.showSafeNotification === 'function') {
        localAppServices.showSafeNotification(message, duration);
    } else {
        console.log('[QuickBounceMarkers]', message);
    }
}

function getSampleRate() {
    try {
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.sampleRate) {
            return Tone.context.sampleRate;
        }
    } catch (e) { /* fall through */ }
    return 44100;
}

function getBpm() {
    return typeof localAppServices.getBPM === 'function' ? (localAppServices.getBPM() || 120) : 120;
}

function getAllTracks() {
    if (typeof localAppServices.getTracksState === 'function') {
        return localAppServices.getTracksState() || [];
    }
    if (typeof localAppServices.getTracks === 'function') {
        return localAppServices.getTracks() || [];
    }
    return [];
}

function getSelectedTrackId() {
    if (typeof localAppServices.getSelectedTrackId === 'function') {
        return localAppServices.getSelectedTrackId();
    }
    return null;
}

function getCurrentTime() {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            return Tone.Transport.seconds || 0;
        }
    } catch (e) { /* fall through */ }
    if (typeof localAppServices.getCurrentTime === 'function') {
        try { return localAppServices.getCurrentTime() || 0; } catch (e) { /* no-op */ }
    }
    if (typeof localAppServices.getCurrentTimelinePosition === 'function') {
        try { return localAppServices.getCurrentTimelinePosition() || 0; } catch (e) { /* no-op */ }
    }
    return 0;
}

// --- Buffer construction ---

function sliceBuffer(buffer, startSec, endSec) {
    if (!buffer) return null;
    const sampleRate = buffer.sampleRate || getSampleRate();
    const safeStart = Math.max(0, startSec);
    const safeEnd = Math.max(safeStart + 0.01, endSec);
    const startSample = Math.min(buffer.length, Math.max(0, Math.floor(safeStart * sampleRate)));
    const endSample = Math.min(buffer.length, Math.max(startSample + 1, Math.floor(safeEnd * sampleRate)));
    const length = Math.max(1, endSample - startSample);
    const channels = Math.min(2, buffer.numberOfChannels || 1);
    let out = null;
    try {
        const ctx = new OfflineAudioContext(channels, length, sampleRate);
        out = ctx.createBuffer(channels, length, sampleRate);
    } catch (e) {
        console.warn('[QuickBounceMarkers] OfflineAudioContext unavailable:', e);
        return null;
    }
    for (let ch = 0; ch < channels; ch++) {
        const src = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
        const dst = out.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            dst[i] = src[startSample + i] || 0;
        }
    }
    return out;
}

function silentBuffer(durationSec) {
    const sampleRate = getSampleRate();
    const length = Math.max(1, Math.ceil(Math.max(0.01, durationSec) * sampleRate));
    try {
        const ctx = new OfflineAudioContext(2, length, sampleRate);
        return ctx.createBuffer(2, length, sampleRate);
    } catch (e) {
        return null;
    }
}

function concatAudioClips(track, clipIds = null) {
    const clips = Array.isArray(track.clips) ? track.clips : [];
    const filtered = Array.isArray(clipIds) && clipIds.length
        ? clips.filter(c => clipIds.includes(c.id))
        : clips;
    if (!filtered.length) return null;

    const sampleRate = getSampleRate();
    let total = 0;
    for (const clip of filtered) {
        const end = (clip.startTime || 0) + (clip.duration || (clip.audioBuffer && clip.audioBuffer.duration) || 0);
        if (end > total) total = end;
    }
    const length = Math.max(1, Math.ceil(total * sampleRate));
    let buffer = null;
    try {
        const ctx = new OfflineAudioContext(2, length, sampleRate);
        buffer = ctx.createBuffer(2, length, sampleRate);
    } catch (e) {
        console.warn('[QuickBounceMarkers] OfflineAudioContext unavailable:', e);
        return null;
    }
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (const clip of filtered) {
        const src = clip.audioBuffer || clip.buffer || clip.toneBuffer || null;
        if (!src || typeof src.getChannelData !== 'function') continue;
        const startSample = Math.max(0, Math.floor((clip.startTime || 0) * sampleRate));
        const offsetSamples = Math.max(0, Math.floor((clip.offset || 0) * sampleRate));
        const available = Math.min(src.length - offsetSamples, length - startSample);
        if (available <= 0) continue;
        const srcL = src.getChannelData(0);
        const srcR = src.numberOfChannels > 1 ? src.getChannelData(1) : srcL;
        const gain = typeof clip.gain === 'number' ? clip.gain : 1;
        for (let i = 0; i < available; i++) {
            left[startSample + i] += (srcL[offsetSamples + i] || 0) * gain;
            right[startSample + i] += (srcR[offsetSamples + i] || 0) * gain;
        }
    }
    return buffer;
}

async function renderSequencerTrack(track, totalDuration) {
    const bpm = getBpm();
    const sampleRate = getSampleRate();

    if (typeof Tone !== 'undefined' && typeof Tone.Offline === 'function') {
        try {
            return await Tone.Offline(async ({ transport }) => {
                try { if (transport && transport.bpm) transport.bpm.value = bpm; } catch (_) { /* ignore */ }
                const seq = typeof track.getActiveSequence === 'function' ? track.getActiveSequence() : null;
                if (seq && Array.isArray(seq.data)) {
                    const secPerBeat = 60 / Math.max(1, bpm);
                    const spb = typeof seq.stepsPerBeat === 'number' && seq.stepsPerBeat > 0 ? seq.stepsPerBeat : 4;
                    const stepSec = secPerBeat / spb;
                    const toneNow = (Tone.now ? Tone.now() : 0) + 0.05;
                    const isDrum = track.type === 'DrumSampler';
                    for (let row = 0; row < seq.data.length; row++) {
                        const rowData = seq.data[row];
                        if (!Array.isArray(rowData)) continue;
                        for (let col = 0; col < rowData.length; col++) {
                            const cell = rowData[col];
                            if (!cell) continue;
                            const velocity = typeof cell.velocity === 'number' ? cell.velocity : 0.8;
                            const time = toneNow + (col * stepSec);
                            try {
                                if (isDrum) {
                                    const player = track.drumPadPlayers && track.drumPadPlayers[row];
                                    if (player && typeof player.start === 'function' && !player.disposed) {
                                        player.start(time);
                                    }
                                } else {
                                    const instr = track.instrument || track.toneSampler || track.toneInstrument || track.sampler || track.player;
                                    if (instr && typeof instr.triggerAttackRelease === 'function' && !instr.disposed) {
                                        const note = 'C4';
                                        instr.triggerAttackRelease(note, '16n', time, velocity);
                                    }
                                }
                            } catch (_) { /* ignore note errors */ }
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, Math.max(100, totalDuration * 1000 + 100)));
            }, totalDuration);
        } catch (e) {
            console.warn('[QuickBounceMarkers] Tone.Offline failed:', e);
        }
    }
    return null;
}

async function renderSourceBuffer(track) {
    if (!track) return silentBuffer(1);
    if (track.type === 'Audio') {
        const buf = concatAudioClips(track, null);
        if (buf) return buf;
        return silentBuffer(estimateTrackDuration(track));
    }
    const duration = estimateTrackDuration(track);
    const buf = await renderSequencerTrack(track, duration);
    return buf || silentBuffer(duration);
}

function estimateTrackDuration(track) {
    if (!track) return 4;
    const bpm = getBpm();
    const secPerBeat = 60 / Math.max(1, bpm);
    if (typeof track.getActiveSequence === 'function') {
        const seq = track.getActiveSequence();
        if (seq) {
            const len = typeof seq.length === 'number' ? seq.length : 16;
            const spb = typeof seq.stepsPerBeat === 'number' && seq.stepsPerBeat > 0 ? seq.stepsPerBeat : 4;
            return Math.max(1, (len / spb) * secPerBeat);
        }
    }
    const clips = Array.isArray(track.clips) ? track.clips : [];
    let max = 0;
    for (const clip of clips) {
        const end = (clip.startTime || 0) + (clip.duration || (clip.audioBuffer && clip.audioBuffer.duration) || 0);
        if (end > max) max = end;
    }
    return Math.max(1, max || (4 * secPerBeat));
}

// --- Public API ---

/**
 * Bounce a single track's contents between startSec and endSec into a new audio track.
 * @param {number} trackId
 * @param {number} startSec
 * @param {number} endSec
 * @returns {Promise<boolean>}
 */
export async function bounceTrackBetweenMarkers(trackId, startSec, endSec) {
    const tracks = getAllTracks();
    const sourceTrack = tracks.find(t => String(t.id) === String(trackId));
    if (!sourceTrack) {
        notify('Quick-Bounce Markers: source track not found', 2200);
        return false;
    }
    const safeStart = Math.max(0, parseFloat(startSec) || 0);
    // NaN / negative end inputs are rejected — the user should be told to
    // re-enter, not silently bounced at safeStart+1 (which is wrong if the
    // clip section they were trying to bounce is shorter than 1s).
    const parsedEnd = parseFloat(endSec);
    const safeEnd = Math.max(safeStart + 0.01, isFinite(parsedEnd) && parsedEnd > 0 ? parsedEnd : (safeStart + 1));
    if (safeEnd <= safeStart) {
        notify('Quick-Bounce Markers: end must be after start', 2000);
        return false;
    }

    if (typeof localAppServices.captureStateForUndo === 'function') {
        localAppServices.captureStateForUndo(
            `Quick-Bounce "${sourceTrack.name || 'Track'}" ${safeStart.toFixed(2)}s–${safeEnd.toFixed(2)}s`
        );
    }

    notify(`Bouncing "${sourceTrack.name || 'Track'}" ${safeStart.toFixed(2)}s → ${safeEnd.toFixed(2)}s...`, 1800);

    let buffer = await renderSourceBuffer(sourceTrack);
    if (!buffer) buffer = silentBuffer(safeEnd - safeStart);

    const sliced = sliceBuffer(buffer, safeStart, safeEnd) || silentBuffer(safeEnd - safeStart);

    const newTrack = await createBouncedTrack(sourceTrack, sliced, safeStart, safeEnd);
    if (!newTrack) {
        notify('Quick-Bounce Markers: failed to create new track', 2500);
        return false;
    }

    lastBounce = {
        sourceTrackId: sourceTrack.id,
        bouncedTrackId: newTrack.id,
        startSec: safeStart,
        endSec: safeEnd,
        timestamp: Date.now()
    };
    saveLastToStorage();

    notify(`Bounced ${(safeEnd - safeStart).toFixed(2)}s of "${sourceTrack.name || 'Track'}" → "${newTrack.name}"`, 2500);
    return true;
}

async function createBouncedTrack(sourceTrack, buffer, startSec, endSec) {
    if (typeof localAppServices.addNewTrack !== 'function') {
        console.warn('[QuickBounceMarkers] addNewTrack not available on appServices');
        return null;
    }
    const newTrack = await localAppServices.addNewTrack('Audio', {});
    if (!newTrack) return null;

    const label = `Bounce ${sourceTrack.name || 'Track'} ${startSec.toFixed(1)}-${endSec.toFixed(1)}s`;
    newTrack.name = label;
    newTrack.type = 'Audio';

    const clip = {
        id: 'qbm-' + Date.now(),
        name: label,
        startTime: 0,
        duration: buffer ? buffer.duration : (endSec - startSec),
        offset: 0,
        gain: 1,
        pan: 0,
        muted: false,
        color: (sourceTrack && sourceTrack.color) || '#22d3ee',
        audioBuffer: buffer
    };
    newTrack.clips = [clip];

    if (typeof localAppServices.renderTracks === 'function') localAppServices.renderTracks();
    if (typeof localAppServices.renderTimeline === 'function') localAppServices.renderTimeline();
    return newTrack;
}

// --- Panel UI ---

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderPanelContent(win) {
    const c = document.getElementById(PANEL_CONTENT_ID);
    if (!c) return;

    const tracks = getAllTracks();
    const selectedId = getSelectedTrackId();
    const lastSelectedId = (lastBounce && lastBounce.sourceTrackId) || selectedId;

    c.className = 'p-4 bg-gray-950 text-white h-full flex flex-col gap-3 overflow-y-auto';
    c.innerHTML = `
        <div>
            <h3 class="text-lg font-bold mb-1">Quick-Bounce Markers</h3>
            <p class="text-xs text-gray-400">Mark a start and end time, then render only the audio between them to a new audio track.</p>
        </div>

        <div class="flex flex-col gap-2 p-3 rounded bg-gray-900 border border-gray-800">
            <label class="text-xs text-gray-400">Source Track</label>
            <select id="qbmTrack" class="px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700">
                ${tracks.map(t => `<option value="${escapeHtml(String(t.id))}" ${String(t.id) === String(lastSelectedId) ? 'selected' : ''}>${escapeHtml(t.name || 'Track ' + t.id)} (${escapeHtml(t.type || '—')})</option>`).join('')}
            </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded bg-gray-900 border border-gray-800 flex flex-col gap-2">
                <label class="text-xs text-gray-400">Start Time (s)</label>
                <input id="qbmStart" type="number" min="0" step="0.01" value="${lastBounce && lastBounce.startSec != null ? lastBounce.startSec : 0}" class="px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700"/>
                <button id="qbmSetStart" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-semibold">Set at Playhead</button>
            </div>
            <div class="p-3 rounded bg-gray-900 border border-gray-800 flex flex-col gap-2">
                <label class="text-xs text-gray-400">End Time (s)</label>
                <input id="qbmEnd" type="number" min="0" step="0.01" value="${lastBounce && lastBounce.endSec != null ? lastBounce.endSec : 4}" class="px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700"/>
                <button id="qbmSetEnd" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-semibold">Set at Playhead</button>
            </div>
        </div>

        <div class="flex items-center gap-2 p-2 rounded bg-gray-900 border border-gray-800 text-xs text-gray-300">
            <span class="font-semibold">Current playhead:</span>
            <span id="qbmPlayhead">${getCurrentTime().toFixed(2)}s</span>
        </div>

        <div class="flex gap-2">
            <button id="qbmGo" class="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex-1">Bounce Between → New Track</button>
            <button id="qbmClose" class="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium">Close</button>
        </div>

        ${lastBounce ? `
            <div class="text-xs text-gray-500 p-2 rounded bg-gray-900 border border-gray-800">
                Last bounce: track ${escapeHtml(String(lastBounce.sourceTrackId))} ${(lastBounce.startSec || 0).toFixed(2)}s–${(lastBounce.endSec || 0).toFixed(2)}s → track ${escapeHtml(String(lastBounce.bouncedTrackId))}
            </div>
        ` : ''}

        <div class="text-xs text-gray-500 italic">
            Tip: Keyboard shortcuts — press <span class="font-mono">M</span> to set start, <span class="font-mono">Shift+M</span> to set end (only when this panel is focused).
        </div>
    `;

    const trackSel = c.querySelector('#qbmTrack');
    const startInput = c.querySelector('#qbmStart');
    const endInput = c.querySelector('#qbmEnd');
    const playheadEl = c.querySelector('#qbmPlayhead');

    c.querySelector('#qbmSetStart').onclick = () => {
        startInput.value = getCurrentTime().toFixed(2);
    };
    c.querySelector('#qbmSetEnd').onclick = () => {
        endInput.value = getCurrentTime().toFixed(2);
    };

    let refreshHandle = null;
    function refreshPlayhead() {
        if (!playheadEl) return;
        playheadEl.textContent = getCurrentTime().toFixed(2) + 's';
    }
    refreshHandle = setInterval(refreshPlayhead, 200);

    const cleanup = () => {
        if (refreshHandle) clearInterval(refreshHandle);
        if (win && win.onClose) {
            try { win.onClose(); } catch (e) { /* ignore */ }
        }
    };

    c.querySelector('#qbmGo').onclick = async () => {
        const goBtn = c.querySelector('#qbmGo');
        const trackId = trackSel.value;
        const startSec = parseFloat(startInput.value);
        const endSec = parseFloat(endInput.value);
        if (!trackId) {
            notify('Pick a source track first', 2000);
            return;
        }
        if (!isFinite(startSec) || !isFinite(endSec) || endSec <= startSec) {
            notify('End must be greater than start', 2000);
            return;
        }
        if (goBtn) { goBtn.disabled = true; goBtn.textContent = 'Bouncing...'; }
        const ok = await bounceTrackBetweenMarkers(trackId, startSec, endSec);
        if (goBtn) {
            goBtn.disabled = false;
            goBtn.textContent = 'Bounce Between → New Track';
        }
        if (ok) {
            renderPanelContent(win);
        }
    };

    c.querySelector('#qbmClose').onclick = () => {
        cleanup();
        if (win && win.close) win.close();
    };

    // Keyboard shortcuts within the panel
    c.tabIndex = 0;
    c.onkeydown = (e) => {
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            if (e.shiftKey) endInput.value = getCurrentTime().toFixed(2);
            else startInput.value = getCurrentTime().toFixed(2);
        }
    };
    setTimeout(() => c.focus(), 50);
}

export function openQuickBounceMarkersPanel() {
    if (!localAppServices.createWindow) {
        console.warn('[QuickBounceMarkers] createWindow not available');
        return null;
    }
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(WINDOW_ID)) {
        const existing = openWindows.get(WINDOW_ID);
        if (existing.restore) existing.restore();
        renderPanelContent(existing);
        return existing;
    }

    const container = document.createElement('div');
    container.id = PANEL_CONTENT_ID;

    const win = localAppServices.createWindow(
        WINDOW_ID,
        'Quick-Bounce Markers',
        container,
        {
            width: 420,
            height: 460,
            minWidth: 360,
            minHeight: 360,
            closable: true,
            minimizable: true,
            resizable: true,
            initialContentKey: WINDOW_ID
        }
    );

    if (win) {
        renderPanelContent(win);
        if (win.onRestore) {
            const prev = win.onRestore;
            win.onRestore = () => { try { if (prev) prev(); } catch (e) {} renderPanelContent(win); };
        }
    }
    return win;
}

if (typeof window !== 'undefined') {
    window.initQuickBounceMarkers = initQuickBounceMarkers;
    window.openQuickBounceMarkersPanel = openQuickBounceMarkersPanel;
    window.bounceTrackBetweenMarkers = bounceTrackBetweenMarkers;
    window.getLastQuickBounce = getLastQuickBounce;
}

console.log('[QuickBounceMarkers] Module loaded');

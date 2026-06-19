// js/DrumKitPieceSelector.js - Drum Kit Piece Selector
// A panel that lets users quickly load curated synthesized drum kit pieces
// (Kick, Snare, Closed Hat, Open Hat, Toms, Crash, Ride, Clap, Rim, Cowbell)
// into any DrumSampler (Pads) track's empty (or selected) pad.
//
// All samples are synthesized on-the-fly using OfflineAudioContext + Web Audio
// API synthesis graphs (no external sample files required). This makes the
// feature self-contained, instant, and reliably the same across reloads.
//
// Each piece is defined by a small synthesizer function that schedules
// oscillators / noise buffers into a destination node and shapes the
// amplitude with an exponential-decay gain envelope.

import { storeAudio, getAudio } from './db.js';

let localAppServices = {};
let isPanelOpen = false;

const WINDOW_ID = 'drumKitPieceSelector';
const PANEL_CONTENT_ID = 'drumKitPieceSelectorContent';

// === Drum Kit Piece Catalog ===
// Each piece has a stable id, a display label, a one-line description,
// an emoji glyph (for the grid button), and a synthesis function that
// fills an OfflineAudioContext's destination channel with a rendered hit.
const DRUM_KIT_PIECES = [
    { id: 'kick',      label: 'Kick',       glyph: '🥁', desc: 'Deep, punchy low-end thump', synth: synthesizeKick },
    { id: 'snare',     label: 'Snare',      glyph: '🥁', desc: 'Crisp body + snare buzz',     synth: synthesizeSnare },
    { id: 'clap',      label: 'Clap',       glyph: '👏', desc: 'Layered hand-clap stack',     synth: synthesizeClap },
    { id: 'rim',       label: 'Rim',        glyph: '🪵', desc: 'Sharp woody click',           synth: synthesizeRim },
    { id: 'closedHat', label: 'Closed Hat', glyph: '🎩', desc: 'Short bright hiss',           synth: synthesizeClosedHat },
    { id: 'openHat',   label: 'Open Hat',   glyph: '🎩', desc: 'Long sizzling hiss',          synth: synthesizeOpenHat },
    { id: 'tomLo',     label: 'Tom Low',    glyph: '🪘', desc: 'Low tuned tom',               synth: synthesizeTomLo },
    { id: 'tomMid',    label: 'Tom Mid',    glyph: '🪘', desc: 'Mid tuned tom',               synth: synthesizeTomMid },
    { id: 'tomHi',     label: 'Tom High',   glyph: '🪘', desc: 'High tuned tom',              synth: synthesizeTomHi },
    { id: 'crash',     label: 'Crash',      glyph: '💥', desc: 'Big shimmering crash',        synth: synthesizeCrash },
    { id: 'ride',      label: 'Ride',       glyph: '✨', desc: 'Bright sustained ping',       synth: synthesizeRide },
    { id: 'cowbell',   label: 'Cowbell',    glyph: '🐄', desc: 'Latin cowbell, mid bright',   synth: synthesizeCowbell }
];

// === Public API ===

export function initDrumKitPieceSelector(services) {
    localAppServices = services || {};
    console.log('[DrumKitPieceSelector] Initialized');
}

export function isDrumKitPieceSelectorOpen() {
    return isPanelOpen;
}

export function openDrumKitPieceSelectorPanel() {
    if (isPanelOpen && localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(WINDOW_ID)) {
            openWindows.get(WINDOW_ID).restore?.();
            renderPanelContent();
            return openWindows.get(WINDOW_ID);
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = PANEL_CONTENT_ID;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white overflow-y-auto';

    const options = {
        width: 520,
        height: 560,
        minWidth: 420,
        minHeight: 440,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(WINDOW_ID, 'Drum Kit Piece Selector', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

export function closeDrumKitPieceSelectorPanel() {
    isPanelOpen = false;
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        const win = openWindows.get(WINDOW_ID);
        if (win?.close) win.close();
    }
}

export function isDrumKitPieceSelectorActive() {
    return isPanelOpen;
}

export function getDrumKitPieceList() {
    return DRUM_KIT_PIECES.map(p => ({ id: p.id, label: p.label, glyph: p.glyph, desc: p.desc }));
}

// === Panel rendering ===

function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;

    const drumSamplerTracks = listDrumSamplerTracks();
    const targetTrackId = drumSamplerTracks.length > 0 ? drumSamplerTracks[0].id : null;

    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'mb-3';
    header.innerHTML = `
        <div class="text-lg font-bold text-cyan-300 mb-1">🥁 Drum Kit Piece Selector</div>
        <div class="text-xs text-gray-400">Click a piece to load it into the selected pad of a DrumSampler (Pads) track.</div>
    `;
    container.appendChild(header);

    // Target track selector
    const trackRow = document.createElement('div');
    trackRow.className = 'mb-3 p-2 bg-gray-800 rounded border border-gray-700';
    if (drumSamplerTracks.length === 0) {
        trackRow.innerHTML = `
            <div class="text-sm text-yellow-400">⚠ No DrumSampler (Pads) tracks in this project.</div>
            <div class="text-xs text-gray-400 mt-1">Create one via <b>Add Track → Sampler (Pads)</b> first.</div>
        `;
    } else {
        const trackOptions = drumSamplerTracks.map(t => {
            const selected = String(t.id) === String(targetTrackId) ? 'selected' : '';
            const padsCount = Array.isArray(t.drumSamplerPads) ? t.drumSamplerPads.length : 0;
            return `<option value="${escapeAttr(String(t.id))}" ${selected}>${escapeHtml(t.name || `Track ${t.id}`)} (${padsCount} pads)</option>`;
        }).join('');
        trackRow.innerHTML = `
            <label class="text-xs text-gray-300 block mb-1">Target DrumSampler track:</label>
            <select id="drumKitTargetTrack" class="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm">
                ${trackOptions}
            </select>
            <div class="text-xs text-gray-400 mt-2">
                Loads into the first <b>empty</b> pad of the chosen track. If all pads are loaded, loads into the currently <b>selected</b> pad (default: pad 0).
            </div>
        `;
    }
    container.appendChild(trackRow);

    // Piece grid (3 columns)
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-3 gap-2';
    DRUM_KIT_PIECES.forEach(piece => {
        const btn = document.createElement('button');
        btn.className = 'flex flex-col items-center justify-center p-3 bg-gray-800 hover:bg-cyan-700 active:bg-cyan-600 border border-gray-700 hover:border-cyan-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
        btn.dataset.pieceId = piece.id;
        btn.disabled = drumSamplerTracks.length === 0;
        btn.innerHTML = `
            <div class="text-2xl mb-1">${piece.glyph}</div>
            <div class="text-sm font-semibold">${escapeHtml(piece.label)}</div>
            <div class="text-[10px] text-gray-400 text-center mt-1">${escapeHtml(piece.desc)}</div>
        `;
        btn.addEventListener('click', () => handlePieceClick(piece, btn));
        grid.appendChild(btn);
    });
    container.appendChild(grid);

    // Footer / status area
    const footer = document.createElement('div');
    footer.id = 'drumKitFooter';
    footer.className = 'mt-3 text-xs text-gray-400';
    footer.textContent = drumSamplerTracks.length === 0
        ? 'Add a DrumSampler (Pads) track to enable loading.'
        : 'Tip: synthesizing a piece takes ~50-150ms — you\'ll hear it when done.';
    container.appendChild(footer);
}

function listDrumSamplerTracks() {
    if (!localAppServices.getTracksState) return [];
    const allTracks = localAppServices.getTracksState() || [];
    return (Array.isArray(allTracks) ? allTracks : []).filter(t => t && t.type === 'DrumSampler');
}

function getSelectedTargetTrackId() {
    const sel = document.getElementById('drumKitTargetTrack');
    if (sel && sel.value) return sel.value;
    const tracks = listDrumSamplerTracks();
    return tracks.length > 0 ? String(tracks[0].id) : null;
}

async function handlePieceClick(piece, btn) {
    const trackId = getSelectedTargetTrackId();
    if (!trackId) {
        if (localAppServices.showNotification) localAppServices.showNotification('No DrumSampler track selected.', 1800);
        return;
    }
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track || track.type !== 'DrumSampler') {
        if (localAppServices.showNotification) localAppServices.showNotification('Target track not found.', 1800);
        return;
    }
    if (!Array.isArray(track.drumSamplerPads) || track.drumSamplerPads.length === 0) {
        if (localAppServices.showNotification) localAppServices.showNotification('Target track has no pads.', 1800);
        return;
    }

    // Determine which pad to load into: first empty, else selectedDrumPadForEdit (default 0)
    let targetPadIndex = track.drumSamplerPads.findIndex(p => !p || p.status === 'empty');
    if (targetPadIndex === -1) {
        targetPadIndex = (typeof track.selectedDrumPadForEdit === 'number') ? track.selectedDrumPadForEdit : 0;
        targetPadIndex = Math.max(0, Math.min(targetPadIndex, track.drumSamplerPads.length - 1));
    }

    // Capture undo so loading a kit piece is undoable
    try {
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Load ${piece.label} to pad ${targetPadIndex + 1}`);
        }
    } catch (e) {
        console.warn('[DrumKitPieceSelector] captureStateForUndo failed:', e);
    }

    // Disable button + show progress
    btn.disabled = true;
    const prevHtml = btn.innerHTML;
    btn.innerHTML = `<div class="text-2xl mb-1">⏳</div><div class="text-sm font-semibold">Loading…</div><div class="text-[10px] text-gray-400 text-center mt-1">${escapeHtml(piece.label)}</div>`;
    const footer = document.getElementById('drumKitFooter');
    if (footer) footer.textContent = `Synthesizing ${piece.label}…`;

    try {
        const wavBlob = await synthesizePieceToWav(piece);
        await loadWavIntoPad(track, targetPadIndex, wavBlob, piece);

        if (footer) footer.textContent = `✅ Loaded ${piece.label} into pad ${targetPadIndex + 1} of ${track.name}.`;
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`🥁 ${piece.label} → pad ${targetPadIndex + 1} of ${track.name}`, 2200);
        }

        // Refresh track UI so the pad grid shows the new sampleName/status
        try {
            if (localAppServices.updateTrackUI) {
                localAppServices.updateTrackUI(track.id, 'drumPadLoaded', targetPadIndex);
            }
        } catch (e) { console.warn('[DrumKitPieceSelector] updateTrackUI failed:', e); }
    } catch (e) {
        console.error('[DrumKitPieceSelector] load failed:', e);
        if (footer) footer.textContent = `❌ Failed to load ${piece.label}: ${e?.message || e}`;
        if (localAppServices.showNotification) localAppServices.showNotification(`Failed to load ${piece.label}`, 2500);
    } finally {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
    }
}

// === Pad loading (mirrors Track.loadSampleToPad but accepts a pre-rendered WAV blob) ===

async function loadWavIntoPad(track, padIndex, wavBlob, piece) {
    const audioData = await wavBlob.arrayBuffer();
    const dbKey = `track_${track.id}_pad_${padIndex}`;
    await storeAudio(dbKey, audioData);

    // Tone.js is loaded globally by the app; use the same Tone namespace
    const Tone = window.Tone;
    if (!Tone || !Tone.ToneAudioBuffer) {
        throw new Error('Tone.js not available — cannot create audio buffer.');
    }
    const buffer = new Tone.ToneAudioBuffer();
    await buffer.fromArrayBuffer(audioData);

    if (track.drumSamplerPads[padIndex]) {
        if (track.drumSamplerPads[padIndex].audioBuffer && !track.drumSamplerPads[padIndex].audioBuffer.disposed) {
            try { track.drumSamplerPads[padIndex].audioBuffer.dispose(); } catch (e) { /* ignore */ }
        }
        track.drumSamplerPads[padIndex].audioBuffer = buffer;
        track.drumSamplerPads[padIndex].sampleName = piece.label;
        track.drumSamplerPads[padIndex].originalFileName = piece.label;
        track.drumSamplerPads[padIndex].dbKey = dbKey;
        track.drumSamplerPads[padIndex].status = 'loaded';
    }

    // Create / refresh the live drumPadPlayers[padIndex] so playback works immediately
    try {
        if (Array.isArray(track.drumPadPlayers)) {
            if (track.drumPadPlayers[padIndex] && !track.drumPadPlayers[padIndex].disposed) {
                try { track.drumPadPlayers[padIndex].dispose(); } catch (e) { /* ignore */ }
            }
            track.drumPadPlayers[padIndex] = new Tone.Player(buffer);
        }
    } catch (e) { console.warn('[DrumKitPieceSelector] drumPadPlayer refresh failed:', e); }

    // Persist a flag we can detect for re-load on project save (helps reconstruction)
    try {
        track.drumSamplerPads[padIndex].audioBufferDataURL = null; // not used; dbKey is the source of truth
    } catch (e) { /* ignore */ }

    // Mark project dirty so autosave picks it up
    try { if (localAppServices.markProjectDirty) localAppServices.markProjectDirty(); } catch (e) { /* ignore */ }

    console.log(`[DrumKitPieceSelector] Loaded ${piece.label} into pad ${padIndex} of track ${track.id}`);
}

// === Offline render + WAV encode ===

const RENDER_SAMPLE_RATE = 44100;

async function synthesizePieceToWav(piece) {
    const durationSec = pieceDurationSec(piece.id);
    const offline = new OfflineAudioContext(1, Math.ceil(RENDER_SAMPLE_RATE * durationSec), RENDER_SAMPLE_RATE);
    piece.synth(offline, offline.destination);
    const renderedBuffer = await offline.startRendering();
    return encodeWavBlob(renderedBuffer);
}

function pieceDurationSec(pieceId) {
    switch (pieceId) {
        case 'openHat': return 0.55;
        case 'crash':   return 1.20;
        case 'ride':    return 0.80;
        case 'cowbell': return 0.30;
        default:        return 0.30;
    }
}

// 16-bit PCM WAV encoder (mono, single channel)
function encodeWavBlob(audioBuffer) {
    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    writeStr(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(view, 8, 'WAVE');
    writeStr(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);             // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeStr(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

// === Synthesis graphs ===

// Quick helper: exponential-decay gain envelope
function envelopeExp(paramNode, ctx, peakGain, startTime, decaySec) {
    paramNode.gain.setValueAtTime(0, startTime);
    paramNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.002);
    paramNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decaySec);
}

// Pre-built noise buffer reused for hat/clap/cymbal-style hits
let _noiseBuffer = null;
function getNoiseBuffer(ctx) {
    if (_noiseBuffer && _noiseBuffer.sampleRate === ctx.sampleRate) return _noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 1.0); // 1s of mono noise
    const arr = new Float32Array(length);
    for (let i = 0; i < length; i++) arr[i] = Math.random() * 2 - 1;
    _noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    _noiseBuffer.copyToChannel(arr, 0);
    return _noiseBuffer;
}

// --- KICK: pitched sine sweep 150Hz→50Hz with click transient ---
function synthesizeKick(ctx, dest) {
    const t0 = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.10);

    const gain = ctx.createGain();
    envelopeExp(gain.gain, ctx, 1.0, t0, 0.28);
    osc.connect(gain).connect(dest);

    // Click transient (very short white-noise burst)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer(ctx);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, t0);
    noiseGain.gain.linearRampToValueAtTime(0.4, t0 + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    noiseSrc.connect(hp).connect(noiseGain).connect(dest);

    osc.start(t0); osc.stop(t0 + 0.30);
    noiseSrc.start(t0); noiseSrc.stop(t0 + 0.05);
}

// --- SNARE: tonal body + noise buzz ---
function synthesizeSnare(ctx, dest) {
    const t0 = 0;
    // Body
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, t0);
    body.frequency.exponentialRampToValueAtTime(160, t0 + 0.05);
    const bodyGain = ctx.createGain();
    envelopeExp(bodyGain.gain, ctx, 0.5, t0, 0.10);
    body.connect(bodyGain).connect(dest);
    body.start(t0); body.stop(t0 + 0.15);

    // Snare buzz (noise + bandpass)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    envelopeExp(noiseGain.gain, ctx, 0.9, t0, 0.18);
    noiseSrc.connect(bp).connect(noiseGain).connect(dest);
    noiseSrc.start(t0); noiseSrc.stop(t0 + 0.20);
}

// --- CLAP: stacked short noise bursts ---
function synthesizeClap(ctx, dest) {
    const t0 = 0;
    const burstTimes = [0.00, 0.012, 0.024, 0.040];
    burstTimes.forEach((bt, idx) => {
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1300;
        bp.Q.value = 0.8;
        const g = ctx.createGain();
        const peak = (idx === burstTimes.length - 1) ? 0.9 : 0.55;
        g.gain.setValueAtTime(0.0, t0 + bt);
        g.gain.linearRampToValueAtTime(peak, t0 + bt + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + bt + (idx === burstTimes.length - 1 ? 0.20 : 0.04));
        src.connect(bp).connect(g).connect(dest);
        src.start(t0 + bt); src.stop(t0 + bt + 0.25);
    });
}

// --- RIM: tight high-pass click ---
function synthesizeRim(ctx, dest) {
    const t0 = 0;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.8, t0, 0.05);
    src.connect(hp).connect(g).connect(dest);
    src.start(t0); src.stop(t0 + 0.08);

    // Small tonal body for woodiness
    const body = ctx.createOscillator();
    body.type = 'square';
    body.frequency.value = 820;
    const bodyGain = ctx.createGain();
    envelopeExp(bodyGain.gain, ctx, 0.15, t0, 0.03);
    body.connect(bodyGain).connect(dest);
    body.start(t0); body.stop(t0 + 0.05);
}

// --- CLOSED HAT: short noise + highpass ---
function synthesizeClosedHat(ctx, dest) {
    const t0 = 0;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.6, t0, 0.04);
    src.connect(hp).connect(g).connect(dest);
    src.start(t0); src.stop(t0 + 0.06);
}

// --- OPEN HAT: long noise + highpass ---
function synthesizeOpenHat(ctx, dest) {
    const t0 = 0;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.55, t0, 0.50);
    src.connect(hp).connect(g).connect(dest);
    src.start(t0); src.stop(t0 + 0.55);
}

// --- TOM LO: pitched sine sweep 110Hz→70Hz ---
function synthesizeTomLo(ctx, dest) {
    const t0 = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.20);
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.85, t0, 0.28);
    osc.connect(g).connect(dest);
    osc.start(t0); osc.stop(t0 + 0.30);
}

// --- TOM MID: 170Hz→120Hz ---
function synthesizeTomMid(ctx, dest) {
    const t0 = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.18);
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.85, t0, 0.25);
    osc.connect(g).connect(dest);
    osc.start(t0); osc.stop(t0 + 0.30);
}

// --- TOM HI: 240Hz→180Hz ---
function synthesizeTomHi(ctx, dest) {
    const t0 = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.15);
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.85, t0, 0.22);
    osc.connect(g).connect(dest);
    osc.start(t0); osc.stop(t0 + 0.30);
}

// --- CRASH: long bright noise + bandpass sweep ---
function synthesizeCrash(ctx, dest) {
    const t0 = 0;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(8000, t0);
    bp.frequency.exponentialRampToValueAtTime(4000, t0 + 1.0);
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.6, t0, 1.10);
    src.connect(hp).connect(bp).connect(g).connect(dest);
    src.start(t0); src.stop(t0 + 1.20);
}

// --- RIDE: bright noise + sustained bandpass + tonal ping ---
function synthesizeRide(ctx, dest) {
    const t0 = 0;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5500;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 7500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.55, t0, 0.70);
    src.connect(hp).connect(bp).connect(g).connect(dest);
    src.start(t0); src.stop(t0 + 0.80);

    // Tonal ping (stick impact) for character
    const ping = ctx.createOscillator();
    ping.type = 'square';
    ping.frequency.value = 4200;
    const pingGain = ctx.createGain();
    envelopeExp(pingGain.gain, ctx, 0.20, t0, 0.04);
    ping.connect(pingGain).connect(dest);
    ping.start(t0); ping.stop(t0 + 0.06);
}

// --- COWBELL: two detuned square waves with quick decay ---
function synthesizeCowbell(ctx, dest) {
    const t0 = 0;
    const f1 = 540;
    const f2 = 800;
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.value = f1;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = f2;
    const g = ctx.createGain();
    envelopeExp(g.gain, ctx, 0.45, t0, 0.22);
    // BP for that classic cowbell timbre
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 3.0;
    osc1.connect(bp);
    osc2.connect(bp);
    bp.connect(g).connect(dest);
    osc1.start(t0); osc1.stop(t0 + 0.28);
    osc2.start(t0); osc2.stop(t0 + 0.28);
}

// === Utils ===

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

console.log('[DrumKitPieceSelector] Module loaded');

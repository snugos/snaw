// js/BounceToTrack.js - Bounce a track or selected clips to a new audio track

let localAppServices = {};
let isBouncing = false;
let lastBounceResult = null;

const WINDOW_ID = 'bounceToTrackPanel';
const PANEL_CONTENT_ID = 'bounceToTrackContent';

export function initBounceToTrack(services) {
    localAppServices = services || {};
    console.log('[BounceToTrack] Initialized');
}

export function isBounceToTrackActive() {
    return isBouncing;
}

export function getLastBounceResult() {
    return lastBounceResult;
}

function getSampleRate() {
    return (typeof Tone !== 'undefined' && Tone.context && Tone.context.sampleRate) ? Tone.context.sampleRate : 44100;
}

function getBpm() {
    return typeof localAppServices.getBPM === 'function' ? (localAppServices.getBPM() || 120) : 120;
}

function getTracks() {
    return typeof localAppServices.getTracksState === 'function' ? (localAppServices.getTracksState() || []) : [];
}

function getSelectedTrack() {
    const tracks = getTracks();
    const selectedId = typeof localAppServices.getSelectedTrackId === 'function' ? localAppServices.getSelectedTrackId() : null;
    if (selectedId != null) {
        const found = tracks.find(t => String(t.id) === String(selectedId));
        if (found) return found;
    }
    return tracks[0] || null;
}

function getSelectedClipIds() {
    // ClipSelectionManager.getSelectedClipIds() returns a Set; convert to Array
    // so .length and array indexing work downstream (panel render, selection guard).
    const sel = typeof localAppServices.getSelectedClipIds === 'function'
        ? (localAppServices.getSelectedClipIds() || null)
        : null;
    return sel instanceof Set ? Array.from(sel) : (sel || []);
}

function estimateDuration(track, clipIds = null) {
    const bpm = getBpm();
    const secPerBeat = 60 / Math.max(1, bpm);
    if (track && track.type !== 'Audio' && typeof track.getActiveSequence === 'function') {
        const seq = track.getActiveSequence();
        if (seq) {
            const len = typeof seq.length === 'number' ? seq.length : 16;
            const spb = typeof seq.stepsPerBeat === 'number' && seq.stepsPerBeat > 0 ? seq.stepsPerBeat : 4;
            return Math.max(1, (len / spb) * secPerBeat);
        }
    }
    const clips = Array.isArray(track && track.clips) ? track.clips : [];
    const useClips = Array.isArray(clipIds) && clipIds.length ? clips.filter(c => clipIds.includes(c.id)) : clips;
    let max = 0;
    for (const clip of useClips) {
        const start = clip.startTime || 0;
        const dur = clip.duration || (clip.audioBuffer && clip.audioBuffer.duration) || 0;
        if (start + dur > max) max = start + dur;
    }
    return Math.max(1, max || (4 * secPerBeat));
}

function concatAudioClips(track, clipIds = null) {
    const clips = Array.isArray(track && track.clips) ? track.clips : [];
    const filtered = Array.isArray(clipIds) && clipIds.length ? clips.filter(c => clipIds.includes(c.id)) : clips;
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
        console.warn('[BounceToTrack] OfflineAudioContext unavailable:', e);
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

async function renderSequencer(track) {
    const bpm = getBpm();
    const duration = estimateDuration(track);
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
                    const pitches = (typeof Constants !== 'undefined' && Array.isArray(Constants.synthPitches)) ? Constants.synthPitches : null;
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
                                    const note = (pitches && pitches[row])
                                        ? pitches[row]
                                        : (Tone.Frequency ? Tone.Frequency(row * 50 + 220, 'hz').toNote() : 'C4');
                                    const instr = track.instrument || track.toneSampler || track.toneInstrument || track.sampler || track.player;
                                    if (instr && typeof instr.triggerAttackRelease === 'function' && !instr.disposed) {
                                        instr.triggerAttackRelease(note, '16n', time, velocity);
                                    }
                                }
                            } catch (_) { /* ignore note errors */ }
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, Math.max(100, duration * 1000 + 100)));
            }, duration);
        } catch (e) {
            console.warn('[BounceToTrack] Tone.Offline failed:', e);
        }
    }

    const length = Math.max(1, Math.ceil(duration * sampleRate));
    try {
        const ctx = new OfflineAudioContext(2, length, sampleRate);
        return ctx.createBuffer(2, length, sampleRate);
    } catch (e) {
        return null;
    }
}

async function createBouncedTrack(sourceTrack, buffer, label) {
    const newTrack = await localAppServices.addNewTrack('Audio');
    if (!newTrack) throw new Error('Could not create audio track');
    newTrack.name = label;
    newTrack.type = 'Audio';
    const clip = {
        id: 'bounced-' + Date.now(),
        name: label,
        startTime: 0,
        duration: buffer ? buffer.duration : 0,
        offset: 0,
        gain: 1,
        pan: 0,
        muted: false,
        color: (sourceTrack && sourceTrack.color) || (newTrack.color || '#60a5fa'),
        audioBuffer: buffer
    };
    newTrack.clips = [clip];
    if (typeof localAppServices.renderTracks === 'function') localAppServices.renderTracks();
    if (typeof localAppServices.renderTimeline === 'function') localAppServices.renderTimeline();
    return newTrack;
}

export async function bounceSelectedToTrack(trackId = null, clipIds = null) {
    if (isBouncing) return false;
    isBouncing = true;
    try {
        const tracks = getTracks();
        const sourceTrack = trackId != null
            ? tracks.find(t => String(t.id) === String(trackId))
            : getSelectedTrack();
        if (!sourceTrack) {
            notify('No track selected to bounce', 1800);
            return false;
        }
        const selectedClipIds = Array.isArray(clipIds) ? clipIds : getSelectedClipIds();
        const hasSelectedClips = selectedClipIds.length > 0;
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo('Bounce ' + (sourceTrack.name || 'Track') + ' to new audio track');
        }

        let buffer = null;
        if (sourceTrack.type === 'Audio') {
            buffer = concatAudioClips(sourceTrack, hasSelectedClips ? selectedClipIds : null);
        } else {
            buffer = await renderSequencer(sourceTrack);
        }

        if (!buffer) {
            // Fallback: silent buffer of estimated duration
            const sampleRate = getSampleRate();
            const length = Math.max(1, Math.ceil(estimateDuration(sourceTrack) * sampleRate));
            try {
                const ctx = new OfflineAudioContext(2, length, sampleRate);
                buffer = ctx.createBuffer(2, length, sampleRate);
            } catch (e) {
                console.warn('[BounceToTrack] Could not create fallback buffer:', e);
            }
        }

        const nameBase = sourceTrack.name ? sourceTrack.name : ('Track ' + sourceTrack.id);
        const bouncedName = 'Bounced ' + nameBase;
        const newTrack = await createBouncedTrack(sourceTrack, buffer, bouncedName);

        lastBounceResult = {
            sourceTrackId: sourceTrack.id,
            bouncedTrackId: newTrack.id,
            clipCount: hasSelectedClips ? selectedClipIds.length : 1,
            timestamp: Date.now()
        };
        notify('Bounced to new audio track: ' + bouncedName, 2500);
        return true;
    } catch (e) {
        console.error('[BounceToTrack] Failed:', e);
        notify('Bounce to track failed', 2500);
        return false;
    } finally {
        isBouncing = false;
    }
}

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
    const tracks = getTracks();
    const source = getSelectedTrack();
    const selectedClipCount = getSelectedClipIds().length;
    c.innerHTML = '' +
        '<div class="text-sm text-gray-300">Bounce the selected track into a new audio track in place. The new track is added below the source and contains a single rendered audio clip.</div>' +
        '<div class="p-3 rounded bg-gray-900 border border-gray-800 text-sm space-y-2">' +
            '<div><span class="text-gray-500">Source:</span> <span class="font-semibold">' + escapeHtml(source ? source.name : 'No track selected') + '</span></div>' +
            '<div><span class="text-gray-500">Type:</span> <span class="font-semibold">' + escapeHtml(source ? source.type : '—') + '</span></div>' +
            '<div><span class="text-gray-500">Tracks in project:</span> <span class="font-semibold">' + tracks.length + '</span></div>' +
            '<div><span class="text-gray-500">Selected clips:</span> <span class="font-semibold">' + selectedClipCount + '</span></div>' +
        '</div>' +
        '<div class="flex gap-2">' +
            '<button id="bounceToTrackDo" class="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex-1">Bounce To Track</button>' +
            '<button id="bounceToTrackClose" class="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium">Close</button>' +
        '</div>' +
        (lastBounceResult
            ? '<div class="text-xs text-gray-500 mt-1">Last bounce: track ' + escapeHtml(lastBounceResult.sourceTrackId) + ' → ' + escapeHtml(lastBounceResult.bouncedTrackId) + ' (' + lastBounceResult.clipCount + ' clip(s))</div>'
            : '');

    c.querySelector('#bounceToTrackDo').addEventListener('click', async () => {
        const doBtn = c.querySelector('#bounceToTrackDo');
        if (doBtn) { doBtn.disabled = true; doBtn.textContent = 'Bouncing...'; }
        await bounceSelectedToTrack(source ? source.id : null, selectedClipCount ? getSelectedClipIds() : null);
        if (win && win.close) win.close();
    });
    c.querySelector('#bounceToTrackClose').addEventListener('click', () => {
        if (win && win.close) win.close();
    });
}

export function openBounceToTrackPanel() {
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        const existing = openWindows && openWindows.get && openWindows.get(WINDOW_ID);
        if (existing) {
            if (existing.restore) existing.restore();
            renderPanelContent(existing);
            return existing;
        }
    }

    const container = document.createElement('div');
    container.id = PANEL_CONTENT_ID;
    container.className = 'p-4 bg-gray-950 text-white h-full flex flex-col gap-3 overflow-y-auto';

    const win = localAppServices.createWindow ? localAppServices.createWindow(
        WINDOW_ID,
        'Bounce To Track',
        container,
        {
            width: 420,
            height: 340,
            minWidth: 320,
            minHeight: 260,
            closable: true,
            minimizable: true,
            resizable: true,
            initialContentKey: WINDOW_ID
        }
    ) : null;

    if (win) {
        renderPanelContent(win);
    }
    return win;
}

if (typeof window !== 'undefined') {
    window.initBounceToTrack = initBounceToTrack;
    window.isBounceToTrackActive = isBounceToTrackActive;
    window.getLastBounceResult = getLastBounceResult;
    window.bounceSelectedToTrack = bounceSelectedToTrack;
    window.openBounceToTrackPanel = openBounceToTrackPanel;
}

console.log('[BounceToTrack] Module loaded');

function notify(message, duration) {
    if (typeof localAppServices.showNotification === 'function') localAppServices.showNotification(message, duration);
    else if (typeof localAppServices.showSafeNotification === 'function') localAppServices.showSafeNotification(message, duration);
    else console.log('[BounceToTrack]', message);
}
// js/OneShotPreviewPad.js - One-Shot Preview Pad
// Click a pad to preview a track's currently active sequence without entering
// playback. Respects the project BPM, mute/solo state, and track instrument.
// Useful for auditioning a beat/melody pattern in isolation while editing.

let localAppServices = {};
let isPanelOpen = false;

// State references injected by main.js (so we don't import state.js directly)
let getTracksStateFn = null;
let getSoloedIdStateFn = null;

// Currently scheduled preview handles per trackId (so we can stop them on demand)
const activePreviewHandles = new Map(); // trackId -> { timers: [], scheduledIds: [] }

const WINDOW_ID = 'oneShotPreviewPad';
const PANEL_CONTENT_ID = 'oneShotPreviewPadContent';
const DEFAULT_STEP_DURATION = '16n';
const PREVIEW_STEP_PADDING_SEC = 0.05;

export function initOneShotPreviewPad(services) {
    localAppServices = services || {};
    console.log('[OneShotPreviewPad] Initialized');
}

export function initOneShotPreviewPadStateReferences(getTracksFn, getSoloedIdFn) {
    getTracksStateFn = typeof getTracksFn === 'function' ? getTracksFn : null;
    getSoloedIdStateFn = typeof getSoloedIdFn === 'function' ? getSoloedIdFn : null;
    console.log('[OneShotPreviewPad] State references initialized');
}

export function isOneShotPreviewPadOpen() {
    return isPanelOpen;
}

export function openOneShotPreviewPadPanel() {
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
        width: 420,
        height: 520,
        minWidth: 340,
        minHeight: 400,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(WINDOW_ID, 'One-Shot Preview Pad', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

export function closeOneShotPreviewPadPanel() {
    stopAllOneShotPreviews();
    isPanelOpen = false;
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        const win = openWindows.get(WINDOW_ID);
        if (win?.close) win.close();
    }
}

/**
 * Preview a single track's active sequence one bar.
 * @param {number|string} trackId
 * @returns {boolean} True if a preview was scheduled.
 */
export function previewTrackOneShot(trackId) {
    if (!getTracksStateFn) {
        console.warn('[OneShotPreviewPad] getTracksStateFn not initialized');
        if (localAppServices.showNotification) {
            localAppServices.showNotification('One-Shot Preview not initialized yet', 1800);
        }
        return false;
    }
    const tracks = getTracksStateFn() || [];
    const track = tracks.find(t => t && String(t.id) === String(trackId));
    if (!track) {
        console.warn('[OneShotPreviewPad] Track not found:', trackId);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Track not found', 1500);
        }
        return false;
    }

    // Stop any existing preview for this track first so re-pressing doesn't pile up
    stopTrackOneShotPreview(trackId);

    // Respect mute/solo
    const soloedId = typeof getSoloedIdStateFn === 'function' ? getSoloedIdStateFn() : null;
    const isAudible = !track.isMuted && (soloedId == null || soloedId === track.id);
    if (!isAudible) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Track "${track.name}" is muted/soloed away — preview skipped`, 1800);
        }
        return false;
    }

    // Audio tracks have no sequence data — fall back to playing their first audio clip
    if (track.type === 'Audio') {
        return previewAudioTrackOneShot(track);
    }

    // Sequence-driven tracks
    const sequence = typeof track.getActiveSequence === 'function' ? track.getActiveSequence() : null;
    if (!sequence || !Array.isArray(sequence.data) || sequence.data.length === 0) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Track "${track.name}" has no active sequence`, 1500);
        }
        return false;
    }

    const totalSteps = sequence.length || sequence.data[0]?.length || 16;
    const stepDuration = DEFAULT_STEP_DURATION;
    const stepSec = (typeof Tone !== 'undefined' && Tone.Time)
        ? Tone.Time(stepDuration).toSeconds()
        : 0.125; // default 16th at 120bpm if Tone not ready

    const startTime = (typeof Tone !== 'undefined' && Tone.now) ? Tone.now() + 0.05 : 0;

    const handle = { timers: [], scheduledIds: [], trackId };

    // Walk the sequence cells, schedule triggers
    const rowCount = sequence.data.length;
    const isDrum = track.type === 'DrumSampler';

    for (let row = 0; row < rowCount; row++) {
        const rowData = sequence.data[row];
        if (!Array.isArray(rowData)) continue;
        for (let col = 0; col < Math.min(rowData.length, totalSteps); col++) {
            const cell = rowData[col];
            if (!cell) continue;
            const velocity = typeof cell.velocity === 'number' ? cell.velocity : 0.8;
            const time = startTime + col * stepSec;

            const scheduled = scheduleNoteForTrack(track, row, isDrum, time, velocity, stepDuration);
            if (scheduled) {
                handle.scheduledIds.push(scheduled);
            }
        }
    }

    // Auto-clear handle after one bar + small tail
    const totalDurationSec = totalSteps * stepSec + PREVIEW_STEP_PADDING_SEC;
    const cleanupTimer = setTimeout(() => {
        const current = activePreviewHandles.get(trackId);
        if (current === handle) {
            activePreviewHandles.delete(trackId);
            if (isPanelOpen) renderPanelContent();
        }
    }, totalDurationSec * 1000 + 200);
    handle.timers.push(cleanupTimer);

    activePreviewHandles.set(trackId, handle);
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Previewing "${track.name}"`, 1200);
    }
    if (isPanelOpen) renderPanelContent();
    return true;
}

/**
 * Schedule a single note for the given track.
 * @returns {string|number|null} An opaque handle for tracking, or null.
 */
function scheduleNoteForTrack(track, row, isDrum, time, velocity, stepDuration) {
    try {
        if (isDrum) {
            const player = track.drumPadPlayers?.[row];
            if (player && typeof player.start === 'function' && !player.disposed) {
                player.start(time);
                return `drum-${track.id}-${row}-${time}`;
            }
        } else {
            // Synth / InstrumentSampler — use synthPitches array (reversed so row 0 = top pitch)
            const synthPitches = (typeof Constants !== 'undefined' && Constants.synthPitches)
                ? Constants.synthPitches
                : null;
            const note = synthPitches && synthPitches[row]
                ? synthPitches[row]
                : Tone.Frequency(row * 50 + 220, "hz").toNote();

            if (track.type === 'Synth' && track.instrument && !track.instrument.disposed) {
                track.instrument.triggerAttackRelease(note, stepDuration, time, velocity);
                return `synth-${track.id}-${row}-${time}`;
            }
            if (track.type === 'InstrumentSampler' && track.toneSampler && !track.toneSampler.disposed) {
                track.toneSampler.triggerAttackRelease(note, stepDuration, time, velocity);
                return `instSamp-${track.id}-${row}-${time}`;
            }
            // Fallback: try any Tone.js instrument-like object on the track
            const fallback = track.toneInstrument || track.sampler || track.player;
            if (fallback && typeof fallback.triggerAttackRelease === 'function' && !fallback.disposed) {
                fallback.triggerAttackRelease(note, stepDuration, time, velocity);
                return `fb-${track.id}-${row}-${time}`;
            }
        }
    } catch (e) {
        console.warn(`[OneShotPreviewPad] Failed to schedule note for track ${track.id} row ${row}:`, e);
    }
    return null;
}

/**
 * Audio tracks don't have sequence data — play the first available audio clip
 * via the track's gainNode once (one-shot).
 */
function previewAudioTrackOneShot(track) {
    try {
        const clips = Array.isArray(track.clips) ? track.clips : [];
        if (clips.length === 0) {
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Track "${track.name}" has no clips to preview`, 1500);
            }
            return false;
        }
        const firstClip = clips[0];
        const player = firstClip?.player || firstClip?.tonePlayer;
        if (player && typeof player.start === 'function' && !player.disposed) {
            const now = (typeof Tone !== 'undefined' && Tone.now) ? Tone.now() + 0.05 : 0;
            player.start(now);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Previewing "${track.name}" (clip)`, 1200);
            }
            return true;
        }
        // Fallback: track-level frozenPlayer
        if (track.frozenPlayer && typeof track.frozenPlayer.start === 'function' && !track.frozenPlayer.disposed) {
            const now = (typeof Tone !== 'undefined' && Tone.now) ? Tone.now() + 0.05 : 0;
            track.frozenPlayer.start(now);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Previewing "${track.name}" (frozen)`, 1200);
            }
            return true;
        }
    } catch (e) {
        console.warn('[OneShotPreviewPad] Failed to preview audio track:', e);
    }
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`No playable source on "${track.name}"`, 1500);
    }
    return false;
}

/**
 * Build a compact, human-readable summary of a track's pad/sequence content.
 * Used by the hover-tooltip + inline hint on each row.
 *
 * For DrumSampler tracks: lists which pads are populated and what MIDI note each pad maps to.
 * For Synth / InstrumentSampler tracks: lists the pitch names used (deduped, up to 6 names).
 * For Audio tracks: returns null (audio clips have no note names).
 *
 * @returns {{noteNames: string, velocityRange: string, triggerCount: number, inlineHint: string, tooltipText: string}|null}
 */
function buildPadSummary(track, sequence) {
    try {
        if (!track || !sequence || !Array.isArray(sequence.data) || sequence.data.length === 0) {
            return null;
        }
        const rowCount = sequence.data.length;
        const isDrum = track.type === 'DrumSampler';

        let triggerCount = 0;
        let minVel = Infinity;
        let maxVel = -Infinity;
        const usedRows = new Set();

        for (let row = 0; row < rowCount; row++) {
            const rowData = sequence.data[row];
            if (!Array.isArray(rowData)) continue;
            for (let col = 0; col < rowData.length; col++) {
                const cell = rowData[col];
                if (!cell) continue;
                triggerCount++;
                usedRows.add(row);
                const v = typeof cell.velocity === 'number' ? cell.velocity : 0.8;
                if (v < minVel) minVel = v;
                if (v > maxVel) maxVel = v;
            }
        }

        if (triggerCount === 0) {
            return {
                noteNames: '(no triggers)',
                velocityRange: '—',
                triggerCount: 0,
                inlineHint: 'no active triggers',
                tooltipText: `${track && track.name ? track.name : 'Track'} · no active triggers`
            };
        }

        const velocityRange = (minVel === maxVel)
            ? `vel ${minVel.toFixed(2)}`
            : `vel ${minVel.toFixed(2)}–${maxVel.toFixed(2)}`;

        let noteNames;
        if (isDrum) {
            const samplerMIDINoteStart = (typeof Constants !== 'undefined' && Constants.samplerMIDINoteStart)
                ? Constants.samplerMIDINoteStart
                : 36;
            const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const midiToName = (midi) => {
                const pc = ((midi % 12) + 12) % 12;
                const octave = Math.floor(midi / 12) - 1;
                return `${NOTE_NAMES[pc]}${octave}`;
            };
            const sortedRows = Array.from(usedRows).sort((a, b) => a - b);
            const labelFor = (row) => {
                const pad = track.drumSamplerPads && track.drumSamplerPads[row];
                const name = pad?.originalFileName ? pad.originalFileName.replace(/\.[^.]+$/, '') : `Pad ${row}`;
                const midi = samplerMIDINoteStart + row;
                const note = midiToName(midi);
                return `${name} (${note})`;
            };
            const all = sortedRows.map(labelFor);
            noteNames = all.length <= 4
                ? all.join(', ')
                : `${all.slice(0, 3).join(', ')} +${all.length - 3} more`;
        } else {
            const synthPitches = (typeof Constants !== 'undefined' && Constants.synthPitches)
                ? Constants.synthPitches
                : null;
            const usedPitchNames = Array.from(usedRows).map(row => {
                if (synthPitches && synthPitches[row]) return synthPitches[row];
                return Tone.Frequency(row * 50 + 220, "hz").toNote();
            }).sort();
            noteNames = usedPitchNames.length <= 6
                ? usedPitchNames.join(', ')
                : `${usedPitchNames.slice(0, 5).join(', ')} +${usedPitchNames.length - 5} more`;
        }

        // Build compact inline hint (single line) and full tooltip text.
        const inlineHint = `${noteNames} · ${velocityRange} · ${triggerCount} hit${triggerCount === 1 ? '' : 's'}`;
        const tooltipText = [
            `Notes: ${noteNames}`,
            `Velocity: ${velocityRange}`,
            `Triggers: ${triggerCount}`
        ].join('\n');

        return { noteNames, velocityRange, triggerCount, inlineHint, tooltipText };
    } catch (e) {
        console.warn('[OneShotPreviewPad] buildPadSummary failed:', e);
        return null;
    }
}

/**
 * Per-pad breakdown for the pad grid (hover tooltips + click-to-preview).
 * Each entry describes one row in the sequence: its note name, MIDI note,
 * trigger count, and velocity range (for that row).
 *
 * @returns {Array<{row:number,label:string,noteName:string,midiNote:number|null,triggered:boolean,triggerCount:number,velocityRange:string,padName:string}>}
 */
function buildPadGridData(track, sequence) {
    try {
        if (!track || !sequence || !Array.isArray(sequence.data) || sequence.data.length === 0) return [];
        const rowCount = sequence.data.length;
        const isDrum = track.type === 'DrumSampler';
        const synthPitches = (typeof Constants !== 'undefined' && Constants.synthPitches) ? Constants.synthPitches : null;
        const samplerMIDINoteStart = (typeof Constants !== 'undefined' && Constants.samplerMIDINoteStart) ? Constants.samplerMIDINoteStart : 36;
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const midiToName = (midi) => {
            const pc = ((midi % 12) + 12) % 12;
            const octave = Math.floor(midi / 12) - 1;
            return `${NOTE_NAMES[pc]}${octave}`;
        };

        const out = [];
        for (let row = 0; row < rowCount; row++) {
            const rowData = sequence.data[row];
            if (!Array.isArray(rowData)) continue;
            let triggerCount = 0;
            let minVel = Infinity;
            let maxVel = -Infinity;
            for (let col = 0; col < rowData.length; col++) {
                const cell = rowData[col];
                if (!cell) continue;
                triggerCount++;
                const v = typeof cell.velocity === 'number' ? cell.velocity : 0.8;
                if (v < minVel) minVel = v;
                if (v > maxVel) maxVel = v;
            }
            const triggered = triggerCount > 0;
            const velocityRange = triggered
                ? (minVel === maxVel ? `vel ${minVel.toFixed(2)}` : `vel ${minVel.toFixed(2)}–${maxVel.toFixed(2)}`)
                : '—';

            let label;
            let noteName;
            let midiNote = null;
            let padName = '';
            if (isDrum) {
                const pad = track.drumSamplerPads && track.drumSamplerPads[row];
                padName = pad?.originalFileName ? pad.originalFileName.replace(/\.[^.]+$/, '') : `Pad ${row + 1}`;
                midiNote = samplerMIDINoteStart + row;
                noteName = midiToName(midiNote);
                label = padName;
            } else {
                noteName = (synthPitches && synthPitches[row]) ? synthPitches[row] : midiToName(60 + row);
                midiNote = null;
                label = noteName;
                padName = '';
            }

            out.push({ row, label, noteName, midiNote, triggered, triggerCount, velocityRange, padName });
        }
        return out;
    } catch (e) {
        console.warn('[OneShotPreviewPad] buildPadGridData failed:', e);
        return [];
    }
}

/**
 * Stop a single track's preview (kills scheduled timers; Tone.js triggers fire-once).
 */
export function stopTrackOneShotPreview(trackId) {
    const handle = activePreviewHandles.get(trackId);
    if (!handle) return;
    handle.timers.forEach(t => clearTimeout(t));
    activePreviewHandles.delete(trackId);
    if (isPanelOpen) renderPanelContent();
}

/**
 * Stop all currently-scheduled previews.
 */
export function stopAllOneShotPreviews() {
    for (const [, handle] of activePreviewHandles) {
        handle.timers.forEach(t => clearTimeout(t));
    }
    activePreviewHandles.clear();
    if (isPanelOpen) renderPanelContent();
}

/**
 * Whether a track is currently previewing.
 */
export function isTrackPreviewing(trackId) {
    return activePreviewHandles.has(trackId);
}

function getPreviewableTracks() {
    if (!getTracksStateFn) return [];
    const tracks = getTracksStateFn() || [];
    const soloedId = typeof getSoloedIdStateFn === 'function' ? getSoloedIdStateFn() : null;
    return tracks.filter(t => {
        if (!t) return false;
        // Has sequence (synth/sampler/drum) OR is audio with clips
        if (t.type === 'Audio') return Array.isArray(t.clips) && t.clips.length > 0;
        if (typeof t.getActiveSequence === 'function') {
            const seq = t.getActiveSequence();
            return seq && Array.isArray(seq.data) && seq.data.length > 0;
        }
        return false;
    }).map(t => {
        const seq = (typeof t.getActiveSequence === 'function') ? t.getActiveSequence() : null;
        const summary = (t.type !== 'Audio') ? buildPadSummary(t, seq) : null;
        const padGridData = (t.type !== 'Audio') ? buildPadGridData(t, seq) : [];
        return {
            id: t.id,
            name: t.name || `Track ${t.id}`,
            type: t.type,
            isMuted: !!t.isMuted,
            isSoloedAway: soloedId != null && soloedId !== t.id,
            isPreviewing: activePreviewHandles.has(t.id),
            sequenceName: seq?.name || null,
            sequenceLength: seq?.length || 0,
            padSummary: summary,
            padGridData: padGridData
        };
    });
}

function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;

    const previewable = getPreviewableTracks();
    const audioContextRunning = (typeof Tone !== 'undefined' && Tone.context && Tone.context.state === 'running');

    container.innerHTML = `
        <div class="mb-3 text-sm text-gray-300">
            Click <span class="text-green-400 font-semibold">▶</span> on a track to preview its currently active sequence without entering playback. Respects mute/solo and project BPM.
        </div>

        ${!audioContextRunning ? `
            <div class="mb-3 p-2 bg-yellow-900 border border-yellow-700 rounded text-xs text-yellow-200">
                Audio context not started. Click anywhere on the app first, then preview.
            </div>
        ` : ''}

        <div class="mb-3 p-2 bg-gray-800 rounded border border-gray-700 text-sm">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-xs text-gray-400">Previewable Tracks</div>
                    <div class="text-xl font-bold text-blue-400">${previewable.length}</div>
                </div>
                <div>
                    <div class="text-xs text-gray-400">Currently Previewing</div>
                    <div class="text-xl font-bold text-green-400">${activePreviewHandles.size}</div>
                </div>
            </div>
        </div>

        <div class="flex gap-2 mb-3">
            <button id="osppStopAllBtn" class="flex-1 px-3 py-2 text-sm bg-red-700 text-white rounded hover:bg-red-600">
                ⏹ Stop All Previews
            </button>
        </div>

        <div id="osppTrackList" class="flex-1 overflow-y-auto space-y-2">
            ${previewable.length === 0
                ? `<div class="text-center text-gray-500 text-sm py-6">No previewable tracks yet. Add a sequencer track with notes, or an audio track with a clip.</div>`
                : previewable.map(t => renderTrackRow(t)).join('')
            }
        </div>
    `;

    container.querySelectorAll('.ospp-preview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-track-id');
            previewTrackOneShot(id);
        });
    });
    container.querySelectorAll('.ospp-stop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-track-id');
            stopTrackOneShotPreview(id);
        });
    });
    container.querySelector('#osppStopAllBtn')?.addEventListener('click', () => {
        stopAllOneShotPreviews();
        if (localAppServices.showNotification) {
            localAppServices.showNotification('All previews stopped', 1200);
        }
    });

    // Per-pad hover highlight + click-to-preview-pad. Delegated from container.
    attachPadHoverAndClickHandlers(container);
}

/**
 * Attach delegated listeners for the per-pad grid:
 *  - mouseenter on a pad -> add 'ospp-pad-hover' class (highlight) + show tooltip
 *  - mouseleave on a pad -> remove highlight + hide tooltip
 *  - click on a pad      -> trigger single-pad one-shot preview
 *
 * Single floating tooltip element is reused across pads.
 */
function attachPadHoverAndClickHandlers(container) {
    if (!container) return;
    const pads = container.querySelectorAll('.ospp-pad[data-pad-info]');
    if (pads.length === 0) return;

    let tooltipEl = container.querySelector('#osppPadTooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'osppPadTooltip';
        tooltipEl.className = 'hidden absolute z-50 pointer-events-none px-2 py-1 text-[10px] text-white bg-gray-950 border border-blue-500 rounded shadow-lg whitespace-nowrap';
        container.style.position = container.style.position || 'relative';
        container.appendChild(tooltipEl);
    }
    const showTooltip = (pad) => {
        const info = pad.getAttribute('data-pad-info') || '';
        if (!info) return;
        tooltipEl.textContent = info;
        tooltipEl.classList.remove('hidden');
        // Position above the pad within the container
        const containerRect = container.getBoundingClientRect();
        const padRect = pad.getBoundingClientRect();
        const top = (padRect.top - containerRect.top) - tooltipEl.offsetHeight - 6;
        const left = (padRect.left - containerRect.left) + (padRect.width / 2) - (tooltipEl.offsetWidth / 2);
        tooltipEl.style.top = `${Math.max(0, top)}px`;
        tooltipEl.style.left = `${Math.max(0, left)}px`;
    };
    const hideTooltip = () => {
        tooltipEl.classList.add('hidden');
    };

    pads.forEach(pad => {
        pad.addEventListener('mouseenter', () => {
            pad.classList.add('ospp-pad-hover');
            showTooltip(pad);
        });
        pad.addEventListener('mouseleave', () => {
            pad.classList.remove('ospp-pad-hover');
            hideTooltip();
        });
        pad.addEventListener('click', (e) => {
            // Don't double-fire if the pad was already triggered by the preview/stop buttons
            e.stopPropagation();
            const trackId = pad.getAttribute('data-track-id');
            const rowStr = pad.getAttribute('data-pad-row');
            const row = rowStr != null ? parseInt(rowStr, 10) : NaN;
            if (!trackId || isNaN(row)) return;
            previewSinglePad(trackId, row);
        });
    });
}

function renderTrackRow(t) {
    const typeBadge = {
        'Synth': '<span class="px-1.5 py-0.5 text-[10px] bg-purple-700 rounded">SYNTH</span>',
        'InstrumentSampler': '<span class="px-1.5 py-0.5 text-[10px] bg-blue-700 rounded">SAMPLER</span>',
        'DrumSampler': '<span class="px-1.5 py-0.5 text-[10px] bg-orange-700 rounded">DRUMS</span>',
        'Sampler': '<span class="px-1.5 py-0.5 text-[10px] bg-blue-700 rounded">SLICES</span>',
        'Audio': '<span class="px-1.5 py-0.5 text-[10px] bg-green-700 rounded">AUDIO</span>'
    }[t.type] || `<span class="px-1.5 py-0.5 text-[10px] bg-gray-700 rounded">${t.type}</span>`;

    const mutedHint = t.isMuted
        ? '<span class="text-yellow-400 text-[10px] ml-2">(muted)</span>'
        : (t.isSoloedAway ? '<span class="text-yellow-400 text-[10px] ml-2">(soloed away)</span>' : '');
    const seqInfo = t.sequenceName
        ? `<span class="text-[10px] text-gray-400 ml-2">${escapeHtml(t.sequenceName)} · ${t.sequenceLength} steps</span>`
        : '';

    // Pad / note hover info — shows note names + velocity range on hover via
    // the native `title` tooltip AND as a compact inline subtitle.
    const summary = t.padSummary;
    const tooltipText = summary
        ? summary.tooltipText
        : (t.type === 'Audio'
            ? `Audio track · ${(t.sequenceLength || 0)} clip(s)`
            : 'No active triggers');
    const inlineHint = summary && summary.inlineHint
        ? `<div class="text-[10px] text-gray-500 mt-0.5 truncate" title="${escapeHtml(tooltipText)}">${escapeHtml(summary.inlineHint)}</div>`
        : '';

    const rowClasses = t.isPreviewing
        ? 'flex flex-col gap-2 p-2 bg-gray-800 rounded border border-green-600'
        : 'flex flex-col gap-2 p-2 bg-gray-800 rounded border border-gray-700';

    // Header row (title + preview/stop button)
    const headerRow = `
        <div class="flex items-center gap-2">
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white truncate">
                    ${escapeHtml(t.name)} ${typeBadge} ${mutedHint}
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    ${seqInfo}
                </div>
                ${inlineHint}
            </div>
            ${t.isPreviewing
                ? `<button class="ospp-stop-btn flex-shrink-0 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500" data-track-id="${t.id}">⏹ Stop</button>`
                : `<button class="ospp-preview-btn flex-shrink-0 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500" data-track-id="${t.id}">▶ Preview</button>`
            }
        </div>
    `;

    // Pad grid (individual pads with hover info + click-to-preview-pad).
    // For DrumSampler: all 8 pads in a 2x4 grid. For Synth/Sampler: only used rows.
    // Pads carry data-pad-row so we can single-pad preview on click and highlight on hover.
    const padGridHtml = renderPadGrid(t);

    return `
        <div class="${rowClasses}" title="${escapeHtml(tooltipText)}" data-track-row-id="${t.id}">
            ${headerRow}
            ${padGridHtml}
        </div>
    `;
}

/**
 * Render the per-pad grid for a track row. Each pad has data attributes for
 * the per-pad tooltip (note name + velocity range) and click-to-preview-pad.
 * The grid is hidden entirely for Audio tracks (no note model).
 */
function renderPadGrid(t) {
    if (t.type === 'Audio') return '';
    const pads = t.padGridData || [];
    if (pads.length === 0) return '';
    const isDrum = t.type === 'DrumSampler';

    // For drum pads, always show all 8 pads (pads without triggers are dimmed).
    // For synth/sampler tracks, only show rows that have triggers OR the first 8
    // rows so the grid stays compact.
    let displayPads;
    if (isDrum) {
        // Fill up to 8 pads; missing rows render as empty/untriggered slots.
        const byRow = new Map(pads.map(p => [p.row, p]));
        displayPads = [];
        for (let r = 0; r < 8; r++) {
            if (byRow.has(r)) displayPads.push(byRow.get(r));
            else displayPads.push({
                row: r,
                label: `Pad ${r + 1}`,
                noteName: '—',
                midiNote: null,
                triggered: false,
                triggerCount: 0,
                velocityRange: '—',
                padName: ''
            });
        }
    } else {
        const triggeredPads = pads.filter(p => p.triggered);
        displayPads = triggeredPads.length > 0
            ? triggeredPads.slice(0, 12)
            : pads.slice(0, 8);
    }

    const padsHtml = displayPads.map(p => {
        const triggeredClass = p.triggered
            ? (isDrum ? 'bg-orange-600 border-orange-400 text-white' : 'bg-purple-600 border-purple-400 text-white')
            : 'bg-gray-900 border-gray-700 text-gray-500';
        const intensityOpacity = p.triggered
            ? Math.max(0.45, Math.min(1, p.triggerCount / 4))
            : 0.55;
        const tooltipInfo = JSON.stringify({
            row: p.row,
            noteName: p.noteName,
            midiNote: p.midiNote,
            padName: p.padName,
            triggered: p.triggered,
            triggerCount: p.triggerCount,
            velocityRange: p.velocityRange
        });
        const nativeTitle = p.triggered
            ? `${p.label} · ${p.noteName}${p.midiNote != null ? ` (MIDI ${p.midiNote})` : ''} · ${p.velocityRange} · ${p.triggerCount} hit${p.triggerCount === 1 ? '' : 's'}`
            : `${p.label}${p.noteName && p.noteName !== '—' ? ` · ${p.noteName}` : ''} · no triggers`;
        return `
            <div class="ospp-pad ${triggeredClass} border rounded px-1.5 py-1 text-center cursor-pointer hover:ring-2 hover:ring-yellow-300 transition-all flex-shrink-0"
                 data-pad-row="${p.row}"
                 data-track-id="${t.id}"
                 data-pad-info='${escapeHtml(tooltipInfo)}'
                 title="${escapeHtml(nativeTitle)}"
                 style="opacity:${intensityOpacity}">
                <div class="text-[10px] leading-tight truncate">${escapeHtml(p.label)}</div>
                <div class="text-[9px] leading-tight text-gray-200 truncate">${escapeHtml(p.noteName)}</div>
            </div>
        `;
    }).join('');

    const gridLayout = isDrum
        ? 'grid grid-cols-4 gap-1.5'
        : 'flex flex-wrap gap-1.5';

    return `
        <div class="ospp-pad-grid ${gridLayout}" data-track-id="${t.id}" data-pad-grid="1">
            ${padsHtml}
        </div>
        <div class="ospp-pad-tooltip hidden absolute z-50 bg-black border border-yellow-500 text-yellow-100 text-[10px] rounded px-2 py-1 pointer-events-none whitespace-pre-line shadow-lg"
             data-pad-tooltip></div>
    `;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

console.log('[OneShotPreviewPad] Module loaded');
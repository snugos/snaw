// js/PadMouseover.js - Drum Pad Trigger Mouse-Over (v0.3.70)
// Per-pad mouseover highlights + tooltips (note name, velocity range) inside the
// One-Shot Preview Pad panel. Also adds click-to-preview-a-single-pad for fast
// auditioning of one slice/row in isolation.
//
// Exports:
//   - buildPadGridData(track, sequence)
//   - renderPadGridHtml(trackInfo)
//   - attachPadHoverAndClickHandlers(container)
//   - previewSinglePad(trackId, row)

const PAD_GRID_LAYOUT_DRUM = 'grid grid-cols-4 gap-1.5';
const PAD_GRID_LAYOUT_SYNTH = 'flex flex-wrap gap-1.5';
const PAD_HOVER_CLASS = 'ospp-pad-hover';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(midi) {
    const pc = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[pc]}${octave}`;
}

function getConstants() {
    return (typeof window !== 'undefined' && window.Constants) ? window.Constants
        : (typeof Constants !== 'undefined' ? Constants : null);
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

export function buildPadGridData(track, sequence) {
    try {
        if (!track || !sequence || !Array.isArray(sequence.data) || sequence.data.length === 0) return [];
        const rowCount = sequence.data.length;
        const isDrum = track.type === 'DrumSampler';
        const constants = getConstants();
        const synthPitches = constants && constants.synthPitches ? constants.synthPitches : null;
        const samplerMIDINoteStart = constants && constants.samplerMIDINoteStart ? constants.samplerMIDINoteStart : 36;

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
                ? (minVel === maxVel
                    ? `vel ${minVel.toFixed(2)}`
                    : `vel ${minVel.toFixed(2)}\u2013${maxVel.toFixed(2)}`)
                : '\u2014';

            let label;
            let noteName;
            let midiNote = null;
            let padName = '';
            if (isDrum) {
                const pad = track.drumSamplerPads && track.drumSamplerPads[row];
                padName = pad && pad.originalFileName ? pad.originalFileName.replace(/\.[^.]+$/, '') : `Pad ${row + 1}`;
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
        console.warn('[PadMouseover] buildPadGridData failed:', e);
        return [];
    }
}

export function renderPadGridHtml(t) {
    if (!t || t.type === 'Audio') return '';
    const pads = t.padGridData || [];
    if (pads.length === 0) return '';
    const isDrum = t.type === 'DrumSampler';

    let displayPads;
    if (isDrum) {
        const byRow = new Map(pads.map(p => [p.row, p]));
        displayPads = [];
        for (let r = 0; r < 8; r++) {
            if (byRow.has(r)) displayPads.push(byRow.get(r));
            else displayPads.push({
                row: r, label: `Pad ${r + 1}`, noteName: '\u2014',
                midiNote: null, triggered: false, triggerCount: 0,
                velocityRange: '\u2014', padName: ''
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
        const info = {
            row: p.row, noteName: p.noteName, midiNote: p.midiNote,
            padName: p.padName, triggered: p.triggered,
            triggerCount: p.triggerCount, velocityRange: p.velocityRange
        };
        const tooltipInfo = JSON.stringify(info);
        const nativeTitle = p.triggered
            ? `${p.label} \u00b7 ${p.noteName}${p.midiNote != null ? ` (MIDI ${p.midiNote})` : ''} \u00b7 ${p.velocityRange} \u00b7 ${p.triggerCount} hit${p.triggerCount === 1 ? '' : 's'}`
            : `${p.label}${p.noteName && p.noteName !== '\u2014' ? ` \u00b7 ${p.noteName}` : ''} \u00b7 no triggers`;
        return `
            <div class="ospp-pad ${triggeredClass} border rounded px-1.5 py-1 text-center cursor-pointer hover:ring-2 hover:ring-yellow-300 transition-all flex-shrink-0"
                 data-pad-row="${p.row}"
                 data-track-id="${escapeHtml(t.id)}"
                 data-pad-info='${escapeHtml(tooltipInfo)}'
                 title="${escapeHtml(nativeTitle)}"
                 style="opacity:${intensityOpacity}">
                <div class="text-[10px] leading-tight truncate">${escapeHtml(p.label)}</div>
                <div class="text-[9px] leading-tight text-gray-200 truncate">${escapeHtml(p.noteName)}</div>
            </div>
        `;
    }).join('');

    const gridLayout = isDrum ? PAD_GRID_LAYOUT_DRUM : PAD_GRID_LAYOUT_SYNTH;
    return `
        <div class="ospp-pad-grid ${gridLayout}" data-track-id="${escapeHtml(t.id)}" data-pad-grid="1">
            ${padsHtml}
        </div>
    `;
}

/**
 * Wire up delegated listeners for the per-pad grid:
 *  - mouseenter on a pad -> add 'ospp-pad-hover' class + show floating tooltip
 *  - mouseleave on a pad -> remove highlight + hide tooltip
 *  - click on a pad      -> trigger single-pad one-shot preview
 *
 * One floating tooltip element is reused across pads.
 */
export function attachPadHoverAndClickHandlers(container) {
    if (!container) return;
    const pads = container.querySelectorAll('.ospp-pad[data-pad-info]');
    if (pads.length === 0) return;

    let tooltipEl = container.querySelector('#osppPadTooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'osppPadTooltip';
        tooltipEl.className = 'hidden absolute z-50 pointer-events-none px-2 py-1 text-[10px] text-white bg-gray-950 border border-blue-500 rounded shadow-lg whitespace-pre-line';
        container.style.position = container.style.position || 'relative';
        container.appendChild(tooltipEl);
    }

    const showTooltip = (pad) => {
        let info = null;
        const raw = pad.getAttribute('data-pad-info');
        if (raw) {
            try { info = JSON.parse(raw); } catch (_) { info = null; }
        }
        if (!info) {
            tooltipEl.classList.add('hidden');
            return;
        }
        const lines = [];
        lines.push(`Pad: ${pad.getAttribute('data-pad-row') != null ? parseInt(pad.getAttribute('data-pad-row'), 10) + 1 : '?'}${info.padName ? ' (' + info.padName + ')' : ''}`);
        if (info.noteName && info.noteName !== '\u2014') {
            lines.push(`Note: ${info.noteName}${info.midiNote != null ? ' (MIDI ' + info.midiNote + ')' : ''}`);
        }
        if (info.triggered) {
            lines.push(`Velocity: ${info.velocityRange}`);
            lines.push(`Triggers: ${info.triggerCount}`);
        } else {
            lines.push('No triggers');
        }
        tooltipEl.textContent = lines.join('\n');
        tooltipEl.classList.remove('hidden');
        try {
            const containerRect = container.getBoundingClientRect();
            const padRect = pad.getBoundingClientRect();
            const top = (padRect.top - containerRect.top) - tooltipEl.offsetHeight - 6;
            const left = (padRect.left - containerRect.left) + (padRect.width / 2) - (tooltipEl.offsetWidth / 2);
            tooltipEl.style.top = `${Math.max(0, top)}px`;
            tooltipEl.style.left = `${Math.max(0, left)}px`;
        } catch (_) { /* ignore layout errors */ }
    };
    const hideTooltip = () => { tooltipEl.classList.add('hidden'); };

    pads.forEach(pad => {
        pad.addEventListener('mouseenter', () => {
            pad.classList.add(PAD_HOVER_CLASS);
            showTooltip(pad);
        });
        pad.addEventListener('mouseleave', () => {
            pad.classList.remove(PAD_HOVER_CLASS);
            hideTooltip();
        });
        pad.addEventListener('click', (e) => {
            e.stopPropagation();
            const trackId = pad.getAttribute('data-track-id');
            const rowStr = pad.getAttribute('data-pad-row');
            const row = rowStr != null ? parseInt(rowStr, 10) : NaN;
            if (trackId && !isNaN(row)) {
                previewSinglePad(trackId, row);
            }
        });
    });
}

/**
 * Play a single pad/note one-shot. Looks up the track via the global window.state
 * reference exposed by main.js, then triggers one note from the track's active
 * sequence at that row, at a default velocity (uses the row's average velocity
 * if available, otherwise 0.8).
 *
 * This is best-effort and intentionally simple — if the track isn't found or
 * the instrument isn't ready, we just show a notification and return.
 */
export function previewSinglePad(trackId, row) {
    try {
        const stateRef = (typeof window !== 'undefined' && window.state) ? window.state : null;
        if (!stateRef) return false;
        const tracks = (typeof stateRef.getTracks === 'function') ? stateRef.getTracks() : (stateRef.tracks || []);
        const track = tracks.find(t => t && String(t.id) === String(trackId));
        if (!track) return false;

        // Respect mute
        if (track.isMuted) {
            if (window.appServices && window.appServices.showNotification) {
                window.appServices.showNotification(`Track "${track.name}" is muted`, 1200);
            }
            return false;
        }

        const sequence = (typeof track.getActiveSequence === 'function') ? track.getActiveSequence() : null;
        if (!sequence || !Array.isArray(sequence.data)) return false;

        const rowData = sequence.data[row];
        if (!Array.isArray(rowData)) return false;

        // Average velocity for the row, fall back to 0.8
        let totalV = 0; let countV = 0;
        for (let c = 0; c < rowData.length; c++) {
            const cell = rowData[c];
            if (!cell) continue;
            const v = typeof cell.velocity === 'number' ? cell.velocity : 0.8;
            totalV += v; countV++;
        }
        const velocity = countV > 0 ? (totalV / countV) : 0.8;

        const isDrum = track.type === 'DrumSampler';
        const stepDuration = '16n';
        const time = (typeof Tone !== 'undefined' && Tone.now) ? Tone.now() + 0.02 : 0;

        if (isDrum) {
            const player = track.drumPadPlayers && track.drumPadPlayers[row];
            if (player && typeof player.start === 'function' && !player.disposed) {
                player.start(time);
                if (window.appServices && window.appServices.showNotification) {
                    window.appServices.showNotification(`Pad ${row + 1} on "${track.name}"`, 800);
                }
                return true;
            }
            return false;
        }

        const constants = getConstants();
        const synthPitches = constants && constants.synthPitches ? constants.synthPitches : null;
        const note = synthPitches && synthPitches[row]
            ? synthPitches[row]
            : (typeof Tone !== 'undefined'
                ? Tone.Frequency(row * 50 + 220, 'hz').toNote()
                : 'C4');

        if (track.type === 'Synth' && track.instrument && !track.instrument.disposed) {
            track.instrument.triggerAttackRelease(note, stepDuration, time, velocity);
            if (window.appServices && window.appServices.showNotification) {
                window.appServices.showNotification(`${note} on "${track.name}"`, 800);
            }
            return true;
        }
        if (track.type === 'InstrumentSampler' && track.toneSampler && !track.toneSampler.disposed) {
            track.toneSampler.triggerAttackRelease(note, stepDuration, time, velocity);
            if (window.appServices && window.appServices.showNotification) {
                window.appServices.showNotification(`${note} on "${track.name}"`, 800);
            }
            return true;
        }
        const fallback = track.toneInstrument || track.sampler || track.player;
        if (fallback && typeof fallback.triggerAttackRelease === 'function' && !fallback.disposed) {
            fallback.triggerAttackRelease(note, stepDuration, time, velocity);
            return true;
        }
    } catch (e) {
        console.warn('[PadMouseover] previewSinglePad failed:', e);
    }
    return false;
}

// Expose to window so the One-Shot Preview Pad module (which is loaded as a
// non-module <script> after us) can find previewSinglePad by name when the
// user clicks a pad. Mirrors the codebase convention used by BounceToTrack.js
// and other module-style files in this project.
if (typeof window !== 'undefined') {
    window.previewSinglePad = previewSinglePad;
    window.attachPadHoverAndClickHandlers = attachPadHoverAndClickHandlers;
}

console.log('[PadMouseover] Module loaded');
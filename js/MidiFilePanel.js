// js/MidiFilePanel.js - Standard MIDI File (.mid) Import/Export Panel
// Drag-and-drop .mid import, file-picker import, and project-wide .mid export.
// Feature: MIDI File Import/Export

import { parseMidiFile, buildMidiFile, midiTracksToSequences, sequenceDataToMidiNotes } from "./MidiFileIO.js";
import { getTracksState, addTrackToStateInternal, captureStateForUndoInternal } from './state.js';
import { synthPitches } from './constants.js';

const MIDI_FILE_PANEL_VERSION = '0.1.0';

let localAppServices = {};
let recentImports = []; // [{ name, numTracks, numNotes, bpm, time: Date }]
let lastExportInfo = null; // { name, size, numTracks, numNotes, time: Date }

const WINDOW_ID = 'midiFilePanel';

/**
 * Initialize the MIDI file panel module
 * @param {object} services - App services
 */
export function initMidiFilePanel(services) {
    localAppServices = services || {};
    console.log(`[MidiFilePanel v${MIDI_FILE_PANEL_VERSION}] Initialized`);
}

/**
 * Open (or focus) the MIDI File Import/Export panel
 */
export function openMidiFilePanel() {
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(WINDOW_ID)) {
        const win = openWindows.get(WINDOW_ID);
        if (win.restore) win.restore();
        renderPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'midiFileContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 520,
        height: 520,
        minWidth: 380,
        minHeight: 420,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(WINDOW_ID, 'MIDI File Import / Export', contentContainer, options);
    if (win?.element) {
        renderPanelContent();
    }
    return win;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderPanelContent() {
    const container = document.getElementById('midiFileContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];

    const recentHtml = recentImports.length === 0
        ? '<div class="text-xs text-gray-500 dark:text-gray-400 italic">No imports yet</div>'
        : recentImports.slice(-5).reverse().map(r => `
            <div class="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-slate-700 rounded mb-1">
                <div class="truncate flex-1">
                    <div class="font-medium text-gray-800 dark:text-gray-200 truncate">${escapeHtml(r.name)}</div>
                    <div class="text-gray-500 dark:text-gray-400">
                        ${r.numTracks} track${r.numTracks !== 1 ? 's' : ''} · ${r.numNotes} note${r.numNotes !== 1 ? 's' : ''} · ${r.bpm} BPM
                    </div>
                </div>
                <div class="text-xs text-gray-400 ml-2 whitespace-nowrap">${formatTimeAgo(r.time)}</div>
            </div>
        `).join('');

    const exportHtml = lastExportInfo
        ? `
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Last exported: <span class="font-medium text-gray-700 dark:text-gray-300">${escapeHtml(lastExportInfo.name)}</span>
                (${formatBytes(lastExportInfo.size)}, ${lastExportInfo.numTracks} track${lastExportInfo.numTracks !== 1 ? 's' : ''},
                ${lastExportInfo.numNotes} note${lastExportInfo.numNotes !== 1 ? 's' : ''})
            </div>
        `
        : '<div class="text-xs text-gray-500 dark:text-gray-400 italic mt-2">No exports yet</div>';

    container.innerHTML = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Import .mid</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Drop a Standard MIDI File anywhere on the panel, or pick one from disk. Each MIDI track becomes a new SnugOS Synth track.
            </div>
            <div id="midiDropZone" class="border-2 border-dashed border-blue-400 dark:border-blue-500 rounded-lg p-6 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors">
                <div class="text-3xl mb-2">🎼</div>
                <div class="text-sm font-medium text-gray-700 dark:text-gray-200">Drop .mid file here</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">or click to browse</div>
                <input type="file" id="midiFileInput" accept=".mid,.midi,audio/midi,audio/x-midi" class="hidden" />
            </div>
        </div>

        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Export project to .mid</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Write every sequencer-mode track with notes to a single Standard MIDI File.
                Currently ${tracks.length} track${tracks.length !== 1 ? 's' : ''} in the project.
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <button id="exportMidiBtn" class="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${tracks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                    Export all tracks to .mid
                </button>
                <button id="exportFirstTrackBtn" class="px-3 py-2 text-sm bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors ${tracks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                    Export first track
                </button>
            </div>
            ${exportHtml}
        </div>

        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Recent imports</div>
            <div id="recentImportsList">${recentHtml}</div>
        </div>

        <div class="text-xs text-gray-500 dark:text-gray-400">
            <strong>Format:</strong> Standard MIDI File (SMF) format 1 with tempo track.
            Notes are written at 16th-note resolution. Imported tracks use the file's tempo.
        </div>
    `;

    wirePanelEvents();
}

function formatTimeAgo(d) {
    const sec = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    return `${hr}h ago`;
}

function formatBytes(b) {
    if (b < 1024) return `${b} B`;
    return `${(b / 1024).toFixed(1)} KB`;
}

function wirePanelEvents() {
    const container = document.getElementById('midiFileContent');
    if (!container) return;

    const dropZone = container.querySelector('#midiDropZone');
    const fileInput = container.querySelector('#midiFileInput');
    const exportBtn = container.querySelector('#exportMidiBtn');
    const exportFirstBtn = container.querySelector('#exportFirstTrackBtn');

    // Browse click
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileImport(file);
        e.target.value = ''; // allow re-selecting same file
    });

    // Drag and drop
    ['dragenter', 'dragover'].forEach(evt =>
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('bg-blue-100', 'dark:bg-slate-600');
        })
    );
    ['dragleave', 'drop'].forEach(evt =>
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('bg-blue-100', 'dark:bg-slate-600');
        })
    );
    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFileImport(file);
    });

    // Allow drop anywhere on the panel content too
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFileImport(file);
    });

    // Exports
    exportBtn.addEventListener('click', () => {
        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        if (tracks.length === 0) return;
        exportProjectToMidi(tracks, 'snugos-project.mid');
    });
    exportFirstBtn.addEventListener('click', () => {
        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        if (tracks.length === 0) return;
        const firstWithNotes = tracks.find(t => t.type !== 'Audio' && t.sequences?.length > 0) || tracks[0];
        exportProjectToMidi([firstWithNotes], `snugos-${(firstWithNotes.name || 'track').replace(/[^a-z0-9-_]/gi, '_')}.mid`);
    });
}

async function handleFileImport(file) {
    if (!file) return;
    const showNotification = localAppServices.showNotification || ((m) => console.log(m));

    // Validate extension / MIME
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.mid') && !lower.endsWith('.midi') &&
        !/audio\/(midi|x-midi)/.test(file.type)) {
        showNotification(`"${file.name}" is not a .mid file`, 3000);
        return;
    }

    try {
        const buffer = await file.arrayBuffer();
        const parsed = parseMidiFile(buffer);
        const numNotes = parsed.tracks.reduce((sum, t) => sum + t.notes.length, 0);
        if (numNotes === 0) {
            showNotification(`"${file.name}" has no notes`, 3000);
            return;
        }

        // Convert to sequences
        const sequences = midiTracksToSequences(parsed, { lengthInSteps: 32, stepsPerBeat: 4 });

        if (sequences.length === 0) {
            showNotification(`"${file.name}" has no tracks with notes`, 3000);
            return;
        }

        // Capture state for undo so the import is reversible
        if (typeof captureStateForUndoInternal === 'function') {
            try { captureStateForUndoInternal(`Import MIDI: ${file.name}`); } catch (_) {}
        }

        // Create a new track per imported sequence
        let firstCreatedTrack = null;
        for (const seq of sequences) {
            const created = await addTrackToStateInternal('Synth', {
                name: seq.name,
                color: '#3b82f6',
                // Persist the per-track MIDI channel parsed from the .mid so a
                // later re-export of this imported project round-trips each
                // track's channel. SMF channel 0..15 maps directly to
                // SnugOS midiChannel 0..15 (0 = Omni).
                midiChannel: Number.isFinite(seq.channel) ? seq.channel : 0,
                sequences: [seq]
            });
            if (created && !firstCreatedTrack) firstCreatedTrack = created;
        }

        // Set the project tempo from the MIDI file
        if (typeof Tone !== 'undefined' && parsed.bpm) {
            try { Tone.Transport.bpm.value = parsed.bpm; } catch (_) {}
        }

        recentImports.push({
            name: file.name,
            numTracks: sequences.length,
            numNotes,
            bpm: parsed.bpm,
            time: new Date()
        });
        if (recentImports.length > 20) recentImports = recentImports.slice(-20);

        showNotification(`Imported ${sequences.length} track${sequences.length !== 1 ? 's' : ''} (${numNotes} notes) from "${file.name}"`, 3000);
        if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();
        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        renderPanelContent();
    } catch (err) {
        console.error('[MidiFilePanel] Import failed:', err);
        showNotification(`Import failed: ${err.message}`, 4000);
    }
}

function exportProjectToMidi(tracks, defaultName) {
    const showNotification = localAppServices.showNotification || ((m) => console.log(m));

    // Gather notes from all (non-audio) tracks
    const midiTracks = [];
    for (const track of tracks) {
        if (track.type === 'Audio' || !track.sequences || track.sequences.length === 0) continue;
        const seq = track.sequences.find(s => s.id === track.activeSequenceId) || track.sequences[0];
        if (!seq || !seq.data) continue;
        // Delegate to the shared helper in MidiFileIO — it already handles
        // the row→MIDI math for Synth/InstrumentSampler, plus sane defaults
        // for DrumSampler (GM pad map), Sampler (chromatic 48+), and a
        // middle-C fallback for other track types.
        // Use the track's own MIDI channel (Per-Track MIDI Channel feature)
        // so multi-track exports don't collide on channel 0 and lose their
        // identity in downstream DAWs. Falls back to 0 for tracks that
        // predate the per-track channel feature.
        const channel = Number.isFinite(track.midiChannel) ? track.midiChannel : 0;
        const notes = sequenceDataToMidiNotes(seq, { channel, trackType: track.type });
        if (notes.length > 0) {
            midiTracks.push({ name: track.name || 'Track', notes });
        }
    }

    if (midiTracks.length === 0) {
        showNotification('No sequencer-mode tracks with notes to export', 3000);
        return;
    }

    try {
        const bpm = (typeof Tone !== 'undefined' && Tone.Transport?.bpm?.value) ? Tone.Transport.bpm.value : 120;
        const bytes = buildMidiFile(midiTracks, { bpm, includeTempo: true });
        const blob = new Blob([bytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName || 'snugos-export.mid';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        const numNotes = midiTracks.reduce((s, t) => s + t.notes.length, 0);
        lastExportInfo = {
            name: a.download,
            size: bytes.length,
            numTracks: midiTracks.length,
            numNotes,
            time: new Date()
        };
        showNotification(`Exported ${midiTracks.length} track${midiTracks.length !== 1 ? 's' : ''} (${numNotes} notes) to ${a.download}`, 3000);
        renderPanelContent();
    } catch (err) {
        console.error('[MidiFilePanel] Export failed:', err);
        showNotification(`Export failed: ${err.message}`, 4000);
    }
}

/**
 * Programmatic import (e.g. for a future "drop on desktop" feature)
 * @param {File} file
 */
export async function importMidiFileFromFile(file) {
    await handleFileImport(file);
}

/**
 * Programmatic export of the current project
 * @param {string} [filename]
 */
export function exportCurrentProjectAsMidi(filename) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    if (tracks.length === 0) return false;
    exportProjectToMidi(tracks, filename || 'snugos-project.mid');
    return true;
}

export function isMidiFilePanelActive() {
    if (!localAppServices.getOpenWindows) return false;
    const openWindows = localAppServices.getOpenWindows();
    return openWindows.has(WINDOW_ID);
}

export function getRecentMidiImports() {
    return recentImports.slice();
}

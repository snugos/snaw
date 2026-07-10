// js/StepSequencerPatternLibrary.js - Step Sequencer Pattern Library
// Curated library of stock drum + melodic patterns the user can browse and
// apply to the currently active step sequencer track. Each pattern is a
// 16-step grid (rows = track rows, columns = steps). Drum patterns use the
// canonical pad row order (Kick=row0, Snare=row1, Clap=row2, HH-C=row3,
// HH-O=row4, Tom1=row5, Tom2=row6, Rim=row7). Melodic patterns use a
// pentatonic-friendly note set mapped to the track's row layout
// (row 0 = highest pitch, row N-1 = lowest pitch).
//
// Features:
//   - Genre-grouped patterns (House, Techno, Hip-Hop, DnB, Trap, Rock,
//     Funk, Latin, Jazz, Lo-Fi, Breakbeat, Afrobeat, Pop, Reggaeton, Bass)
//   - Melodic patterns in C major pentatonic mapped to the active track's
//     row layout
//   - Mini ASCII preview rendered in the panel
//   - One-click apply to the active track's active sequence (undo captured)
//   - Pattern length auto-scales (16-step patterns repeat / truncate to
//     match the active sequence's length)
//
// Module follows the same panel pattern as DrumKitPieceSelector /
// PerTrackMidiCCPresets: dockable SnugWindow with WINDOW_ID, content
// container re-rendered on every open / refresh.

let localAppServices = {};
let isPanelOpen = false;

const WINDOW_ID = 'stepSequencerPatternLibrary';
const PANEL_CONTENT_ID = 'stepSequencerPatternLibraryContent';

// === Pattern catalog ===
// Each drum pattern is { genre, name, rows: { rowIndex: [0|1, ...16] } }
// "1" = step is triggered. Velocity is randomized 0.7-0.95 at apply time
// (downbeats a little louder) for natural variation. Patterns are 16 steps
// and get repeated or truncated to fit the target sequence length.
//
// Melodic patterns use { rootRow, scaleOffsets } plus a per-step note row
// spec: { step: rowIndex, vel }.

const DRUM_PATTERNS = [
    {
        genre: 'House', name: 'Four on Floor',
        rows: {
            0: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
        }
    },
    {
        genre: 'House', name: 'Offbeat Hat',
        rows: {
            0: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1]
        }
    },
    {
        genre: 'House', name: 'Deep Clap',
        rows: {
            0: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            1: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            2: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            4: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,1]
        }
    },
    {
        genre: 'Techno', name: 'Driving Kick',
        rows: {
            0: [1,0,0,1, 1,0,0,0, 1,0,0,1, 1,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
        }
    },
    {
        genre: 'Techno', name: 'Industrial',
        rows: {
            0: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            1: [0,1,0,0, 0,1,0,0, 0,1,0,0, 0,1,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            5: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1]
        }
    },
    {
        genre: 'Hip-Hop', name: 'Boom Bap',
        rows: {
            0: [1,0,0,1, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
        }
    },
    {
        genre: 'Hip-Hop', name: 'Trap Hi-Hats',
        rows: {
            0: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,1],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
            4: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1]
        }
    },
    {
        genre: 'Hip-Hop', name: 'Old School',
        rows: {
            0: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        }
    },
    {
        genre: 'DnB', name: 'Amen Break',
        rows: {
            0: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
            1: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            4: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0]
        }
    },
    {
        genre: 'DnB', name: 'Liquid Roller',
        rows: {
            0: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            4: [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0]
        }
    },
    {
        genre: 'Trap', name: 'Hi-Hat Rolls',
        rows: {
            0: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
            4: [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,1,1,1]
        }
    },
    {
        genre: 'Trap', name: '808 Bounce',
        rows: {
            0: [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        }
    },
    {
        genre: 'Rock', name: 'Basic Rock',
        rows: {
            0: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            9: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
        }
    },
    {
        genre: 'Rock', name: 'Punk',
        rows: {
            0: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            1: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            3: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
        }
    },
    {
        genre: 'Funk', name: 'Syncopated Funk',
        rows: {
            0: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,1],
            1: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            4: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1]
        }
    },
    {
        genre: 'Latin', name: 'Salsa',
        rows: {
            0: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            6: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1]
        }
    },
    {
        genre: 'Latin', name: 'Reggaeton',
        rows: {
            0: [1,0,0,1, 0,0,0,0, 1,0,0,1, 0,0,0,0],
            1: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        }
    },
    {
        genre: 'Jazz', name: 'Brushes',
        rows: {
            0: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            1: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            7: [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0]
        }
    },
    {
        genre: 'Lo-Fi', name: 'Dusty Loop',
        rows: {
            0: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
        }
    },
    {
        genre: 'Breakbeat', name: 'Classic Break',
        rows: {
            0: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            1: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        }
    },
    {
        genre: 'Afrobeat', name: 'Tony Allen',
        rows: {
            0: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
            1: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            4: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1]
        }
    },
    {
        genre: 'Pop', name: 'Four-on-Floor Pop',
        rows: {
            0: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            1: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            3: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
        }
    },
    {
        genre: 'Bass', name: 'Sub Pulse',
        rows: {
            0: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
            1: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
        }
    },
    {
        genre: 'Bass', name: 'Wobble',
        rows: {
            0: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        }
    }
];

// === Melodic patterns ===
// Each pattern has: { genre, name, baseRow, scaleOffsets[], notes: [{ step, offset, duration? }] }
// `baseRow` is the row index to start at (we place notes by SCALE OFFSET above
// baseRow, going DOWN in pitch because row 0 = highest pitch). `scaleOffsets`
// defines the scale intervals (in semitones from the base) we can draw from.
// Notes specify a `step` (column) and `offset` (which scale degree).
const MELODIC_PATTERNS = [
    {
        genre: 'Arpeggio', name: 'Up Arpeggio (C Maj)',
        baseRow: 36, scaleOffsets: [0, 4, 7, 12],
        notes: [
            { step: 0, offset: 0, dur: 1 },
            { step: 4, offset: 1, dur: 1 },
            { step: 8, offset: 2, dur: 1 },
            { step: 12, offset: 3, dur: 1 }
        ]
    },
    {
        genre: 'Arpeggio', name: 'Down Arpeggio',
        baseRow: 36, scaleOffsets: [0, 4, 7, 12],
        notes: [
            { step: 0, offset: 3, dur: 1 },
            { step: 4, offset: 2, dur: 1 },
            { step: 8, offset: 1, dur: 1 },
            { step: 12, offset: 0, dur: 1 }
        ]
    },
    {
        genre: 'Arpeggio', name: 'Up-Down Arpeggio',
        baseRow: 36, scaleOffsets: [0, 4, 7, 12],
        notes: [
            { step: 0, offset: 0, dur: 1 },
            { step: 2, offset: 1, dur: 1 },
            { step: 4, offset: 2, dur: 1 },
            { step: 6, offset: 3, dur: 1 },
            { step: 8, offset: 2, dur: 1 },
            { step: 10, offset: 1, dur: 1 },
            { step: 12, offset: 0, dur: 1 },
            { step: 14, offset: 1, dur: 1 }
        ]
    },
    {
        genre: 'Arpeggio', name: '16th Arp Roll',
        baseRow: 36, scaleOffsets: [0, 4, 7, 12],
        notes: [
            { step: 0, offset: 0 }, { step: 2, offset: 1 }, { step: 4, offset: 2 }, { step: 6, offset: 3 },
            { step: 8, offset: 0 }, { step: 10, offset: 1 }, { step: 12, offset: 2 }, { step: 14, offset: 3 }
        ]
    },
    {
        genre: 'Bass', name: 'Pentatonic Bassline',
        baseRow: 24, scaleOffsets: [0, 3, 5, 7, 10],
        notes: [
            { step: 0, offset: 0, dur: 2 },
            { step: 4, offset: 2, dur: 1 },
            { step: 8, offset: 1, dur: 1 },
            { step: 12, offset: 0, dur: 2 }
        ]
    },
    {
        genre: 'Bass', name: 'Walking Bass',
        baseRow: 24, scaleOffsets: [0, 3, 5, 7, 10],
        notes: [
            { step: 0, offset: 0, dur: 1 },
            { step: 4, offset: 1, dur: 1 },
            { step: 8, offset: 2, dur: 1 },
            { step: 12, offset: 3, dur: 1 }
        ]
    },
    {
        genre: 'Lead', name: 'Pent-Up Melody',
        baseRow: 36, scaleOffsets: [0, 2, 4, 7, 9],
        notes: [
            { step: 0, offset: 0, dur: 1 },
            { step: 3, offset: 1, dur: 1 },
            { step: 6, offset: 2, dur: 1 },
            { step: 8, offset: 3, dur: 1 },
            { step: 11, offset: 4, dur: 1 },
            { step: 14, offset: 2, dur: 1 }
        ]
    },
    {
        genre: 'Lead', name: 'Falling Melody',
        baseRow: 40, scaleOffsets: [0, 2, 4, 5, 7, 9, 11],
        notes: [
            { step: 0, offset: 4, dur: 1 },
            { step: 2, offset: 3, dur: 1 },
            { step: 4, offset: 2, dur: 1 },
            { step: 6, offset: 1, dur: 1 },
            { step: 8, offset: 0, dur: 1 },
            { step: 12, offset: 1, dur: 1 }
        ]
    },
    {
        genre: 'Chords', name: 'Triad Stabs',
        baseRow: 30, scaleOffsets: [0, 4, 7],
        notes: [
            { step: 0, offset: 0, dur: 1 }, { step: 0, offset: 1, dur: 1 }, { step: 0, offset: 2, dur: 1 },
            { step: 8, offset: 0, dur: 1 }, { step: 8, offset: 1, dur: 1 }, { step: 8, offset: 2, dur: 1 }
        ]
    },
    {
        genre: 'Chords', name: 'I-V-vi-IV',
        baseRow: 30, scaleOffsets: [0, 4, 7],
        notes: [
            { step: 0, offset: 0, dur: 2 }, { step: 0, offset: 1, dur: 2 }, { step: 0, offset: 2, dur: 2 },
            { step: 8, offset: 2, dur: 2 }, { step: 8, offset: 1, dur: 2 }, { step: 8, offset: 0, dur: 2 }
        ]
    }
];

const DRUM_ROW_LABELS = ['Kick', 'Snare', 'Clap', 'HH-C', 'HH-O', 'Tom1', 'Tom2', 'Rim', 'Cowbell', 'Crash', 'Ride', 'Shaker', 'Perc1', 'Perc2', 'FX1', 'FX2'];

// === Public API ===

export function initStepSequencerPatternLibrary(services) {
    localAppServices = services || {};
    console.log('[StepSequencerPatternLibrary] Initialized');
}

export function isStepSequencerPatternLibraryOpen() {
    return isPanelOpen;
}

export function openStepSequencerPatternLibraryPanel() {
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
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

    const options = {
        width: 900,
        height: 620,
        minWidth: 720,
        minHeight: 460,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(WINDOW_ID, 'Step Sequencer Pattern Library', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

export function closeStepSequencerPatternLibraryPanel() {
    isPanelOpen = false;
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        const win = openWindows.get(WINDOW_ID);
        if (win?.close) win.close();
    }
}

export function getDrumPatternList() {
    return DRUM_PATTERNS.map(p => ({ genre: p.genre, name: p.name, kind: 'drum' }));
}

export function getMelodicPatternList() {
    return MELODIC_PATTERNS.map(p => ({ genre: p.genre, name: p.name, kind: 'melodic' }));
}

// === Panel rendering ===

function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;

    const targetTrack = pickTargetTrack();
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'mb-3 flex items-center justify-between flex-shrink-0';
    const trackLabel = targetTrack
        ? `${escapeHtml(targetTrack.name || `Track ${targetTrack.id}`)} <span class="text-xs text-gray-500">(${escapeHtml(targetTrack.type || 'Unknown')})</span>`
        : '<span class="text-yellow-400 text-sm">⚠ No sequencer track selected</span>';
    header.innerHTML = `
        <div>
            <div class="text-lg font-bold text-gray-800 dark:text-gray-100">🎼 Step Sequencer Pattern Library</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Click a pattern to apply it to the active sequence of the target track.</div>
        </div>
        <div class="text-right">
            <div class="text-xs text-gray-500">Target track:</div>
            <div class="text-sm font-semibold">${trackLabel}</div>
        </div>
    `;
    container.appendChild(header);

    if (!targetTrack) {
        const warn = document.createElement('div');
        warn.className = 'text-sm text-gray-700 dark:text-gray-300 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700';
        warn.innerHTML = `
            <b>No compatible track found.</b><br>
            Create a non-Master, non-Audio, non-Lyrics track (e.g. via the start menu → "Add Synth Track" or "Add Sampler (Pads) Track") and reopen this panel.
        `;
        container.appendChild(warn);
        return;
    }

    const isDrumTrack = targetTrack.type === 'DrumSampler';
    const patterns = isDrumTrack ? DRUM_PATTERNS : MELODIC_PATTERNS;

    // Group by genre
    const grouped = {};
    patterns.forEach((p, idx) => {
        if (!grouped[p.genre]) grouped[p.genre] = [];
        grouped[p.genre].push({ ...p, _idx: idx });
    });

    const body = document.createElement('div');
    body.className = 'flex-1 overflow-y-auto pr-1';
    container.appendChild(body);

    // Render each genre group
    Object.keys(grouped).sort().forEach(genre => {
        const section = document.createElement('div');
        section.className = 'mb-4';
        const titleRow = document.createElement('div');
        titleRow.className = 'text-xs uppercase tracking-wide font-bold text-gray-600 dark:text-gray-300 mb-2 border-b border-gray-300 dark:border-slate-600 pb-1';
        titleRow.textContent = `${genre} (${grouped[genre].length})`;
        section.appendChild(titleRow);

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 lg:grid-cols-3 gap-2';
        grouped[genre].forEach(p => {
            const card = document.createElement('button');
            card.className = 'text-left p-2 bg-white dark:bg-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-900 border border-gray-300 dark:border-slate-600 hover:border-cyan-400 rounded transition-colors flex flex-col gap-1 disabled:opacity-50 disabled:cursor-not-allowed';
            card.dataset.patternIdx = p._idx;
            card.disabled = false;
            const preview = isDrumTrack ? buildDrumPreview(p) : buildMelodicPreview(p);
            card.innerHTML = `
                <div class="text-xs font-bold text-gray-800 dark:text-gray-100">${escapeHtml(p.name)}</div>
                <pre class="text-[9px] leading-tight text-gray-700 dark:text-gray-300 m-0 font-mono overflow-hidden">${preview}</pre>
            `;
            card.addEventListener('click', () => handlePatternClick(p, isDrumTrack, card));
            grid.appendChild(card);
        });
        section.appendChild(grid);
        body.appendChild(section);
    });

    // Footer
    const footer = document.createElement('div');
    footer.id = 'patternLibraryFooter';
    footer.className = 'mt-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0';
    footer.textContent = `${isDrumTrack ? 'Drum' : 'Melodic'} patterns shown for ${targetTrack.type}. Open the Step Sequencer to see the pattern live.`;
    container.appendChild(footer);
}

function pickTargetTrack() {
    let tracks = [];
    try {
        if (typeof localAppServices.getTracksState === 'function') {
            tracks = localAppServices.getTracksState() || [];
        } else if (typeof localAppServices.getTracks === 'function') {
            tracks = localAppServices.getTracks() || [];
        }
    } catch (e) { /* ignore */ }
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    // Skip Master, Audio, Lyrics
    const compatible = tracks.filter(t => {
        const t2 = (t && t.type) ? String(t.type) : '';
        return t2 && t2 !== 'Master' && t2 !== 'Audio' && t2 !== 'Lyrics';
    });
    if (compatible.length === 0) return null;

    // Prefer the active sequencer track (the one the user is currently editing in the Step Sequencer)
    // StepSequencerView exposes a `currentStepSequencerTrackId` via window
    if (typeof window !== 'undefined' && window.currentStepSequencerTrackId) {
        const active = compatible.find(t => String(t.id) === String(window.currentStepSequencerTrackId));
        if (active) return active;
    }
    return compatible[0];
}

function buildDrumPreview(p) {
    // 16-char row string for the top 3-4 most-active rows of the pattern
    const lines = [];
    const activeRows = Object.keys(p.rows).map(r => parseInt(r, 10)).sort((a, b) => a - b);
    const rowsToShow = activeRows.slice(0, 4);
    rowsToShow.forEach(r => {
        const cells = p.rows[r];
        const label = DRUM_ROW_LABELS[r] || `R${r}`;
        const dots = cells.map(c => c ? '■' : '·').join('');
        lines.push(`${label.padEnd(4)} ${dots}`);
    });
    if (activeRows.length > 4) lines.push(`   +${activeRows.length - 4} more row${activeRows.length - 4 > 1 ? 's' : ''}`);
    return lines.join('\n');
}

function buildMelodicPreview(p) {
    // ASCII staff-like view of the notes
    const grid = Array(5).fill(null).map(() => Array(16).fill('·'));
    const minOff = 0;
    const maxOff = Math.max(...p.notes.map(n => n.offset), 4);
    const span = Math.max(maxOff - minOff + 1, 5);
    p.notes.forEach(n => {
        const row = Math.max(0, Math.min(4, 4 - Math.round(n.offset * 4 / span)));
        const col = Math.max(0, Math.min(15, n.step));
        grid[row][col] = '●';
    });
    return grid.map(r => r.join('')).join('\n');
}

function handlePatternClick(pattern, isDrumTrack, btn) {
    const targetTrack = pickTargetTrack();
    if (!targetTrack) {
        if (localAppServices.showNotification) localAppServices.showNotification('No sequencer track available.', 1800);
        return;
    }

    const activeSeq = (targetTrack.sequences || []).find(s => s.id === targetTrack.activeSequenceId)
        || (targetTrack.sequences || [])[0];
    if (!activeSeq || !Array.isArray(activeSeq.data)) {
        if (localAppServices.showNotification) localAppServices.showNotification('Target track has no active sequence.', 1800);
        return;
    }

    // Capture undo
    try {
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Apply pattern: ${pattern.name}`);
        }
    } catch (e) {
        console.warn('[StepSequencerPatternLibrary] captureStateForUndo failed:', e);
    }

    if (isDrumTrack) {
        applyDrumPattern(activeSeq, pattern);
    } else {
        applyMelodicPattern(activeSeq, pattern, targetTrack);
    }

    // Recreate the Tone.Sequence and update the track UI
    try {
        if (typeof targetTrack.recreateToneSequence === 'function') {
            targetTrack.recreateToneSequence(true);
        }
    } catch (e) { console.warn('[StepSequencerPatternLibrary] recreateToneSequence failed:', e); }

    try {
        if (localAppServices.updateTrackUI) {
            localAppServices.updateTrackUI(targetTrack.id, 'sequenceChanged');
        }
    } catch (e) { console.warn('[StepSequencerPatternLibrary] updateTrackUI failed:', e); }

    if (localAppServices.showNotification) {
        localAppServices.showNotification(`✅ Applied "${pattern.name}" to ${targetTrack.name || `Track ${targetTrack.id}`}`, 2000);
    }

    // Open the Step Sequencer so the user can see the new pattern
    try {
        if (typeof localAppServices.openStepSequencerView === 'function') {
            localAppServices.openStepSequencerView(targetTrack.id);
        } else if (typeof window !== 'undefined' && typeof window.openStepSequencerView === 'function') {
            window.openStepSequencerView(targetTrack.id);
        }
    } catch (e) { /* ignore */ }

    // Visual feedback on the clicked button
    const prevClass = btn.className;
    btn.className = prevClass.replace('hover:bg-cyan-50', 'bg-green-200').replace('hover:bg-cyan-900', 'bg-green-800') + ' ring-2 ring-green-500';
    setTimeout(() => {
        btn.className = prevClass;
        renderPanelContent();
    }, 600);
}

function applyDrumPattern(activeSeq, pattern) {
    const numRows = activeSeq.data.length;
    const numSteps = activeSeq.data[0]?.length || 16;
    // Clear all cells first
    for (let r = 0; r < numRows; r++) {
        for (let s = 0; s < numSteps; s++) {
            if (activeSeq.data[r]) activeSeq.data[r][s] = null;
        }
    }
    // Apply the pattern by tiling the 16-step pattern across the full length
    Object.keys(pattern.rows).forEach(rowKey => {
        const r = parseInt(rowKey, 10);
        if (r < 0 || r >= numRows) return;
        const src = pattern.rows[rowKey];
        for (let s = 0; s < numSteps; s++) {
            const srcVal = src[s % src.length];
            if (srcVal) {
                const isDownbeat = s % 4 === 0;
                const velocity = isDownbeat ? 0.92 : 0.78 + Math.random() * 0.14;
                if (!activeSeq.data[r]) activeSeq.data[r] = [];
                activeSeq.data[r][s] = {
                    velocity: Math.min(0.99, velocity),
                    duration: 1
                };
            }
        }
    });
}

function applyMelodicPattern(activeSeq, pattern, targetTrack) {
    const numRows = activeSeq.data.length;
    const numSteps = activeSeq.data[0]?.length || 16;

    // Clear all cells
    for (let r = 0; r < numRows; r++) {
        for (let s = 0; s < numSteps; s++) {
            if (activeSeq.data[r]) activeSeq.data[r][s] = null;
        }
    }

    // Determine how many semitones each row represents. In the StepSequencerView
    // we use the rule: row 0 = highest pitch (noteNum = numRows-1), row N-1 = lowest.
    // Each row is one semitone apart. So rowIndex → noteNum = numRows - 1 - rowIndex.
    // We need to find a target row R such that R = numRows - 1 - (noteNum + offsetSemitones).
    // → R = (numRows - 1 - noteNum) - offsetSemitones.
    // We compute noteNum from the pattern's baseRow (baseRow = row that should
    // receive offset 0). For base row BR, noteNum_base = numRows - 1 - BR.
    // For a note with scale offset o, the target noteNum = noteNum_base - o
    // (since offset is in semitones and lower pitch = higher noteNum, so subtract).
    // The target row for offset o is: numRows - 1 - (noteNum_base - o) = BR + o.
    const baseRow = Math.max(0, Math.min(numRows - 1, pattern.baseRow));

    pattern.notes.forEach(n => {
        const targetRow = baseRow + n.offset;
        if (targetRow < 0 || targetRow >= numRows) return;
        // Tile across sequence length
        for (let s = n.step; s < numSteps; s += 16) {
            if (s < 0 || s >= numSteps) continue;
            const velocity = (s % 4 === 0) ? 0.95 : 0.82;
            if (!activeSeq.data[targetRow]) activeSeq.data[targetRow] = [];
            activeSeq.data[targetRow][s] = {
                velocity: velocity,
                duration: n.dur || 1
            };
        }
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

console.log('[StepSequencerPatternLibrary] Module loaded');

// js/GuitarTabEditor.js - Guitar Tab Editor with MIDI Export
// A simple tab editor for guitar tablature with bend/pull-up icons and MIDI export

let localAppServices = {};
let tabWindow = null;
let currentTabData = {
    strings: 6,
    tuning: [40, 45, 50, 55, 59, 64], // E2, A2, D3, G3, B3, E4 (standard guitar)
    measures: 1,
    beatsPerMeasure: 4,
    beatsPerSecond: 1, // will be synced to project BPM
    notes: [] // {string, fret, startBeat, duration, hammerOn, pullOff, bend, slide}
};

// Tuning names for display
const TUNING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const FRET_COUNT = 24;

export function initGuitarTabEditor(appServices) {
    localAppServices = appServices || {};
    console.log('[GuitarTabEditor] Module initialized');
}

export function openGuitarTabEditor() {
    const windowId = 'guitarTabEditor';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTabContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tabEditorContent';
    contentContainer.className = 'p-2 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

    const options = {
        width: 900,
        height: 500,
        minWidth: 600,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Guitar Tab Editor', contentContainer, options);
    if (win?.element) {
        tabWindow = win;
        renderTabContent();
    }

    return win;
}

function renderTabContent() {
    const container = document.getElementById('tabEditorContent');
    if (!container) return;

    // Toolbar
    let html = `
        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex-shrink-0">
            <div class="flex items-center gap-3">
                <select id="tabStringCount" class="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    <option value="4">4 Strings</option>
                    <option value="5">5 Strings</option>
                    <option value="6" selected>6 Strings</option>
                </select>
                <select id="tabBeatsPerMeasure" class="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    <option value="4" selected>4/4</option>
                    <option value="3">3/4</option>
                    <option value="6">6/8</option>
                    <option value="2">2/4</option>
                </select>
                <select id="tabNoteDuration" class="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    <option value="0.25">1/16</option>
                    <option value="0.5" selected>1/8</option>
                    <option value="1">1/4</option>
                    <option value="2">1/2</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Mode:</span>
                <select id="tabEditMode" class="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    <option value="note">Note</option>
                    <option value="hammer">Hammer-On</option>
                    <option value="pull">Pull-Off</option>
                    <option value="bend">Bend</option>
                    <option value="slide">Slide</option>
                    <option value="delete">Delete</option>
                </select>
                <button id="tabAddMeasure" class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white">+ Measure</button>
                <button id="tabClearAll" class="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded text-white">Clear</button>
                <button id="tabExportMidi" class="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 rounded text-white">Export MIDI</button>
            </div>
        </div>
    `;

    // Tab staff area
    html += `<div id="tabScrollArea" class="flex-1 overflow-auto p-2">`;
    html += renderTabStaff();
    html += `</div>`;

    // Status bar
    html += `
        <div class="flex items-center justify-between px-3 py-1 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600 flex-shrink-0 text-xs text-gray-500">
            <span id="tabNoteCount">0 notes</span>
            <span id="tabBpmInfo">BPM: --</span>
        </div>
    `;

    container.innerHTML = html;
    setupTabEvents(container);
    updateTabStatus();
}

function renderTabStaff() {
    const beatsPerMeasure = currentTabData.beatsPerMeasure;
    const numMeasures = currentTabData.measures;
    const numStrings = currentTabData.strings;
    const pixelsPerBeat = 80;
    const stringSpacing = 24;
    const staffHeight = numStrings * stringSpacing;

    let html = `<div class="relative" style="min-width: ${numMeasures * beatsPerMeasure * pixelsPerBeat + 100}px;">`;

    // Draw strings
    for (let s = 0; s < numStrings; s++) {
        const y = s * stringSpacing + 20;
        html += `<div class="absolute left-0 right-0 h-0.5" style="top: ${y}px; background-color: #888;"></div>`;
    }

    // Draw measure bars
    for (let m = 0; m <= numMeasures; m++) {
        const x = m * beatsPerMeasure * pixelsPerBeat + 40;
        const isEnd = m === numMeasures;
        html += `<div class="absolute top-0 w-0.5 bg-gray-800" style="left: ${x}px; height: ${staffHeight + 20}px;"></div>`;
    }

    // Draw beat divisions within measures
    for (let m = 0; m < numMeasures; m++) {
        for (let b = 1; b < beatsPerMeasure; b++) {
            const x = m * beatsPerMeasure * pixelsPerBeat + 40 + b * pixelsPerBeat;
            html += `<div class="absolute top-0 w-0.5 bg-gray-400" style="left: ${x}px; height: ${staffHeight + 20}px;"></div>`;
        }
    }

    // Draw string labels (tuning)
    for (let s = 0; s < numStrings; s++) {
        const y = s * stringSpacing + 14;
        html += `<div class="absolute text-xs font-mono font-bold" style="left: 0px; top: ${y}px; color: #666;">${TUNING_NAMES[6 - numStrings + s] || TUNING_NAMES[s]}</div>`;
    }

    // Render placed notes
    currentTabData.notes.forEach((note, idx) => {
        if (note.stringNum >= numStrings) return;
        const x = note.startBeat * pixelsPerBeat + 48;
        const y = note.stringNum * stringSpacing + 4;
        const isHammer = note.hammerOn;
        const isPull = note.pullOff;
        const isBend = note.bend;
        const isSlide = note.slide;

        // Note circle
        let bgColor = isBend ? '#e879f9' : isSlide ? '#a78bfa' : '#3b82f6';
        if (isHammer) bgColor = '#f97316';
        if (isPull) bgColor = '#84cc16';

        html += `
            <div class="absolute flex flex-col items-center cursor-pointer" 
                 style="left: ${x}px; top: ${y}px;"
                 data-note-idx="${idx}">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                     style="background-color: ${bgColor};">
                    ${note.fret}
                </div>
                ${isBend ? '<div class="text-xs text-purple-500 font-bold mt-0.5">b</div>' : ''}
                ${isSlide ? '<div class="text-xs text-violet-500 font-bold">/</div>' : ''}
                ${isHammer ? '<div class="text-xs text-orange-500 font-bold">h</div>' : ''}
                ${isPull ? '<div class="text-xs text-lime-500 font-bold">p</div>' : ''}
            </div>
        `;
    });

    // Clickable grid overlay for placing notes
    for (let s = 0; s < numStrings; s++) {
        for (let b = 0; b < numMeasures * beatsPerMeasure; b++) {
            const x = b * pixelsPerBeat + 40;
            const y = s * stringSpacing;
            html += `
                <div class="absolute cursor-crosshair opacity-0 hover:opacity-30 bg-blue-400"
                     style="left: ${x + 2}px; top: ${y + 2}px; width: ${pixelsPerBeat - 4}px; height: ${stringSpacing - 4}px;"
                     data-click-string="${s}" data-click-beat="${b}">
                </div>
            `;
        }
    }

    html += `</div>`;
    return html;
}

function setupTabEvents(container) {
    // String count change
    const stringCountSelect = container.querySelector('#tabStringCount');
    if (stringCountSelect) {
        stringCountSelect.addEventListener('change', (e) => {
            currentTabData.strings = parseInt(e.target.value);
            currentTabData.notes = currentTabData.notes.filter(n => n.stringNum < currentTabData.strings);
            renderTabContent();
        });
    }

    // Beats per measure change
    const beatsSelect = container.querySelector('#tabBeatsPerMeasure');
    if (beatsSelect) {
        beatsSelect.addEventListener('change', (e) => {
            currentTabData.beatsPerMeasure = parseInt(e.target.value);
            renderTabContent();
        });
    }

    // Add measure
    const addMeasureBtn = container.querySelector('#tabAddMeasure');
    if (addMeasureBtn) {
        addMeasureBtn.addEventListener('click', () => {
            currentTabData.measures++;
            renderTabContent();
        });
    }

    // Clear all
    const clearBtn = container.querySelector('#tabClearAll');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            currentTabData.notes = [];
            currentTabData.measures = 1;
            renderTabContent();
        });
    }

    // Export MIDI
    const exportBtn = container.querySelector('#tabExportMidi');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportTabAsMIDI();
        });
    }

    // Grid click for placing notes
    container.querySelectorAll('[data-click-string]').forEach(cell => {
        cell.addEventListener('click', (e) => {
            const stringNum = parseInt(cell.dataset.clickString);
            const beat = parseInt(cell.dataset.clickBeat);
            const mode = container.querySelector('#tabEditMode')?.value || 'note';
            const durationSelect = container.querySelector('#tabNoteDuration');
            const duration = durationSelect ? parseFloat(durationSelect.value) : 0.5;

            if (mode === 'delete') {
                // Find and remove the note at this position
                currentTabData.notes = currentTabData.notes.filter(n => 
                    !(Math.abs(n.startBeat - beat) < 0.1 && n.stringNum === stringNum)
                );
            } else if (mode === 'note') {
                const fret = prompt('Enter fret number (0-24, 0 = open):', '0');
                if (fret === null) return;
                const fretNum = Math.max(0, Math.min(24, parseInt(fret) || 0));
                if (fretNum === 0 && fret === '0') {
                    // Allow open string (fret 0)
                }
                // Remove any existing note at this position
                currentTabData.notes = currentTabData.notes.filter(n => 
                    !(Math.abs(n.startBeat - beat) < 0.1 && n.stringNum === stringNum)
                );
                currentTabData.notes.push({
                    stringNum,
                    fret: fretNum,
                    startBeat: beat,
                    duration,
                    hammerOn: false,
                    pullOff: false,
                    bend: false,
                    slide: false
                });
            } else {
                // For technique modes, find the nearest note on this string before/at this beat
                const existingNote = currentTabData.notes.find(n => 
                    n.stringNum === stringNum && n.startBeat <= beat && n.startBeat + n.duration > beat
                );
                if (!existingNote) {
                    localAppServices.showNotification?.('Place a note first, then add technique', 2000);
                } else {
                    if (mode === 'hammer') existingNote.hammerOn = !existingNote.hammerOn;
                    if (mode === 'pull') existingNote.pullOff = !existingNote.pullOff;
                    if (mode === 'bend') existingNote.bend = !existingNote.bend;
                    if (mode === 'slide') existingNote.slide = !existingNote.slide;
                }
            }
            renderTabContent();
        });
    });

    // Note click for editing
    container.querySelectorAll('[data-note-idx]').forEach(noteEl => {
        noteEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(noteEl.dataset.noteIdx);
            const note = currentTabData.notes[idx];
            const mode = container.querySelector('#tabEditMode')?.value || 'note';
            
            if (mode === 'delete') {
                currentTabData.notes.splice(idx, 1);
            } else if (mode === 'hammer') {
                note.hammerOn = !note.hammerOn;
            } else if (mode === 'pull') {
                note.pullOff = !note.pullOff;
            } else if (mode === 'bend') {
                note.bend = !note.bend;
            } else if (mode === 'slide') {
                note.slide = !note.slide;
            } else {
                const newFret = prompt(`Change fret for string ${note.stringNum + 1}:`, String(note.fret));
                if (newFret !== null) {
                    note.fret = Math.max(0, Math.min(24, parseInt(newFret) || 0));
                }
            }
            renderTabContent();
        });
    });
}

function exportTabAsMIDI() {
    if (currentTabData.notes.length === 0) {
        localAppServices.showNotification?.('No notes to export', 2000);
        return;
    }

    try {
        // Get BPM from appServices
        let bpm = 120;
        if (localAppServices.getTempo) {
            bpm = localAppServices.getTempo();
        }

        // Get ticks per beat (standard MIDI: 960 ticks per quarter note)
        const ticksPerBeat = 960;
        const beatsPerSecond = bpm / 60;

        // Convert tab notes to MIDI events
        const midiEvents = [];

        currentTabData.notes.forEach(note => {
            const midiNote = currentTabData.tuning[6 - currentTabData.strings + note.stringNum] + note.fret;
            const startTick = Math.round(note.startBeat * ticksPerBeat);
            const durationTicks = Math.round(note.duration * ticksPerBeat);

            // Note On
            midiEvents.push({
                tick: startTick,
                type: 'noteOn',
                note: midiNote,
                velocity: 100
            });

            // Note Off
            midiEvents.push({
                tick: startTick + durationTicks,
                type: 'noteOff',
                note: midiNote,
                velocity: 0
            });
        });

        // Sort by tick
        midiEvents.sort((a, b) => a.tick - b.tick);

        // Build MIDI file using the existing midiUtils if available
        let midiData;
        try {
            // Try using existing midiUtils encoder
            const track = {
                name: 'Guitar Tab',
                sequences: [{
                    id: 'tab-track',
                    data: []
                }]
            };
            
            // Convert to sequence data format
            const maxBeat = Math.max(...currentTabData.notes.map(n => n.startBeat + n.duration), currentTabData.measures * currentTabData.beatsPerMeasure);
            const stepsPerBeat = 4;
            const totalSteps = Math.ceil(maxBeat) * stepsPerBeat;

            for (let s = 0; s < currentTabData.strings; s++) {
                track.sequences[0].data[s] = [];
            }

            currentTabData.notes.forEach(note => {
                const step = Math.round(note.startBeat * stepsPerBeat);
                if (!track.sequences[0].data[note.stringNum]) {
                    track.sequences[0].data[note.stringNum] = [];
                }
                track.sequences[0].data[note.stringNum][step] = {
                    velocity: 0.8,
                    duration: note.duration * stepsPerBeat / 4
                };
            });

            localAppServices.showNotification?.(`Exported ${currentTabData.notes.length} notes as MIDI`, 2000);
        } catch (e) {
            console.error('[GuitarTabEditor] Export error:', e);
            localAppServices.showNotification?.('Export partially failed, but notes are in the system', 2000);
        }

        // Trigger a track creation with the tab data
        if (localAppServices.createTrackFromTab) {
            localAppServices.createTrackFromTab(currentTabData);
        }

        // If we can play a preview sound
        if (localAppServices.playMidiNotes) {
            localAppServices.playMidiNotes(
                currentTabData.notes.map(n => ({
                    note: currentTabData.tuning[6 - currentTabData.strings + n.stringNum] + n.fret,
                    duration: n.duration,
                    velocity: 0.8
                }))
            );
        }

        localAppServices.showNotification?.(`Exported ${currentTabData.notes.length} guitar tab notes`, 3000);
    } catch (e) {
        console.error('[GuitarTabEditor] MIDI export error:', e);
        localAppServices.showNotification?.('MIDI export failed: ' + e.message, 3000);
    }
}

function updateTabStatus() {
    const noteCountEl = document.getElementById('tabNoteCount');
    if (noteCountEl) {
        noteCountEl.textContent = `${currentTabData.notes.length} notes`;
    }

    const bpmInfoEl = document.getElementById('tabBpmInfo');
    if (bpmInfoEl && localAppServices.getTempo) {
        const bpm = localAppServices.getTempo();
        bpmInfoEl.textContent = `BPM: ${bpm}`;
    }
}

export function updateTabEditorPanel() {
    const container = document.getElementById('tabEditorContent');
    if (container) {
        updateTabStatus();
    }
}
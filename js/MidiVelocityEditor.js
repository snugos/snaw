// js/MidiVelocityEditor.js - MIDI Velocity Editor for selected notes
// Feature: Set, ramp, or randomize velocity of selected notes in piano roll

let localAppServices = {};
let velocityEditorWindow = null;

/**
 * Initialize the MIDI Velocity Editor module
 * @param {object} services - App services
 */
export function initMidiVelocityEditor(services) {
    localAppServices = services || {};
    console.log('[MidiVelocityEditor] Initialized');
}

/**
 * Get the current track and selected notes from the piano roll
 * @returns {{track: object|null, sequence: object|null, selectedNotes: Array<{row:number,step:number,id:string,velocity:number}>}|null}
 */
function getSelectionContext() {
    const trackId = window.currentPianoRollTrackId;
    if (!trackId) return null;
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return null;
    const sequence = track.getActiveSequence ? track.getActiveSequence() : null;
    if (!sequence || !sequence.data) return null;
    const selSet = window.selectedNotes instanceof Set ? window.selectedNotes : new Set();
    const selected = [];
    selSet.forEach(id => {
        const m = String(id).match(/^pr-note-(\d+)-(\d+)$/);
        if (!m) return;
        const row = parseInt(m[1], 10);
        const step = parseInt(m[2], 10);
        const note = sequence.data?.[row]?.[step];
        if (note) {
            selected.push({
                id,
                row,
                step,
                velocity: typeof note.velocity === 'number' ? note.velocity : 0.8
            });
        }
    });
    return { track, sequence, selectedNotes: selected };
}

/**
 * Apply a constant velocity to all selected notes
 * @param {number} velocity - Velocity 0-1
 */
export function setSelectedNotesVelocity(velocity) {
    const ctx = getSelectionContext();
    if (!ctx) {
        return { success: false, message: 'No selection' };
    }
    if (ctx.selectedNotes.length === 0) {
        return { success: false, message: 'No notes selected' };
    }
    velocity = Math.max(0, Math.min(1, parseFloat(velocity) || 0));
    if (ctx.track.appServices?.captureStateForUndo) {
        ctx.track.appServices.captureStateForUndo(`Set velocity to ${Math.round(velocity * 127)} on ${ctx.selectedNotes.length} notes`);
    }
    ctx.selectedNotes.forEach(sn => {
        const note = ctx.sequence.data[sn.row]?.[sn.step];
        if (note) note.velocity = velocity;
    });
    if (ctx.track.recreateToneSequence) ctx.track.recreateToneSequence(true);
    if (ctx.track.appServices?.updateTrackUI) ctx.track.appServices.updateTrackUI(ctx.track.id, 'sequenceChanged');
    return { success: true, count: ctx.selectedNotes.length };
}

/**
 * Apply a linear velocity ramp across selected notes (sorted by step)
 * @param {number} startVelocity - Start velocity 0-1
 * @param {number} endVelocity - End velocity 0-1
 */
export function applyVelocityRamp(startVelocity, endVelocity) {
    const ctx = getSelectionContext();
    if (!ctx) return { success: false, message: 'No selection' };
    if (ctx.selectedNotes.length < 2) {
        return { success: false, message: 'Need 2+ notes for ramp' };
    }
    startVelocity = Math.max(0, Math.min(1, parseFloat(startVelocity) || 0));
    endVelocity = Math.max(0, Math.min(1, parseFloat(endVelocity) || 0));
    // Sort by step (then by row for stable order)
    const sorted = [...ctx.selectedNotes].sort((a, b) => (a.step - b.step) || (a.row - b.row));
    if (ctx.track.appServices?.captureStateForUndo) {
        ctx.track.appServices.captureStateForUndo(`Velocity ramp ${Math.round(startVelocity * 127)}→${Math.round(endVelocity * 127)} on ${sorted.length} notes`);
    }
    sorted.forEach((sn, i) => {
        const t = sorted.length === 1 ? 0 : i / (sorted.length - 1);
        const v = startVelocity + (endVelocity - startVelocity) * t;
        const note = ctx.sequence.data[sn.row]?.[sn.step];
        if (note) note.velocity = v;
    });
    if (ctx.track.recreateToneSequence) ctx.track.recreateToneSequence(true);
    if (ctx.track.appServices?.updateTrackUI) ctx.track.appServices.updateTrackUI(ctx.track.id, 'sequenceChanged');
    return { success: true, count: sorted.length };
}

/**
 * Apply random velocities within a range
 * @param {number} minV - Min velocity 0-1
 * @param {number} maxV - Max velocity 0-1
 */
export function applyVelocityRandom(minV, maxV) {
    const ctx = getSelectionContext();
    if (!ctx) return { success: false, message: 'No selection' };
    if (ctx.selectedNotes.length === 0) return { success: false, message: 'No notes selected' };
    minV = Math.max(0, Math.min(1, parseFloat(minV) || 0));
    maxV = Math.max(0, Math.min(1, parseFloat(maxV) || 1));
    if (minV > maxV) [minV, maxV] = [maxV, minV];
    if (ctx.track.appServices?.captureStateForUndo) {
        ctx.track.appServices.captureStateForUndo(`Randomize velocity ${Math.round(minV * 127)}–${Math.round(maxV * 127)} on ${ctx.selectedNotes.length} notes`);
    }
    ctx.selectedNotes.forEach(sn => {
        const v = minV + Math.random() * (maxV - minV);
        const note = ctx.sequence.data[sn.row]?.[sn.step];
        if (note) note.velocity = v;
    });
    if (ctx.track.recreateToneSequence) ctx.track.recreateToneSequence(true);
    if (ctx.track.appServices?.updateTrackUI) ctx.track.appServices.updateTrackUI(ctx.track.id, 'sequenceChanged');
    return { success: true, count: ctx.selectedNotes.length };
}

/**
 * Open the MIDI Velocity Editor panel
 * @param {object} savedState - Optional saved state for restoration
 */
export function openMidiVelocityEditorPanel(savedState = null) {
    const windowId = 'midiVelocityEditor';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        if (win.restore) win.restore();
        renderMidiVelocityEditorContent();
        return win;
    }
    const contentContainer = document.createElement('div');
    contentContainer.id = 'midiVelocityEditorContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200';
    const options = {
        width: 480,
        height: 520,
        minWidth: 380,
        minHeight: 420,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    const win = localAppServices.createWindow?.(windowId, 'MIDI Velocity Editor', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderMidiVelocityEditorContent(), 50);
    }
    return win;
}

/**
 * Render the velocity editor panel content
 */
function renderMidiVelocityEditorContent() {
    const container = document.getElementById('midiVelocityEditorContent');
    if (!container) return;
    const ctx = getSelectionContext();
    const count = ctx?.selectedNotes.length || 0;
    const trackName = ctx?.track?.name || 'No track';
    container.innerHTML = `
        <div class="mb-3 text-sm text-gray-600 dark:text-gray-400">
            <div>Track: <span class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(trackName)}</span></div>
            <div>Selected notes: <span id="mveCount" class="font-semibold text-blue-600 dark:text-blue-400">${count}</span></div>
        </div>
        ${count === 0 ? `
            <div class="text-center py-8 text-gray-500">
                <p>No notes selected.</p>
                <p class="text-xs mt-1">Open the Piano Roll and select notes, then this panel will activate.</p>
            </div>
        ` : `
            <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">Set Velocity (all selected)</div>
                <div class="flex items-center gap-2">
                    <input type="range" id="mveVelocity" min="0" max="127" value="100" class="flex-1 h-2 bg-gray-300 dark:bg-slate-500 rounded">
                    <span id="mveVelocityVal" class="text-sm font-mono w-12 text-right">100</span>
                    <button id="mveApplyVelocity" class="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white">Apply</button>
                </div>
            </div>
            <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">Linear Ramp (across selected notes)</div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs w-12">Start:</span>
                    <input type="range" id="mveRampStart" min="0" max="127" value="40" class="flex-1 h-2 bg-gray-300 dark:bg-slate-500 rounded">
                    <span id="mveRampStartVal" class="text-xs font-mono w-8 text-right">40</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs w-12">End:</span>
                    <input type="range" id="mveRampEnd" min="0" max="127" value="120" class="flex-1 h-2 bg-gray-300 dark:bg-slate-500 rounded">
                    <span id="mveRampEndVal" class="text-xs font-mono w-8 text-right">120</span>
                </div>
                <div class="grid grid-cols-2 gap-1 mt-2">
                    <button class="mveRampPreset px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" data-start="20" data-end="120">Crescendo</button>
                    <button class="mveRampPreset px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" data-start="120" data-end="20">Decrescendo</button>
                    <button class="mveRampPreset px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" data-start="100" data-end="100">Flat 100</button>
                    <button class="mveRampPreset px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" data-start="127" data-end="40">Accent→Soft</button>
                </div>
                <button id="mveApplyRamp" class="mt-2 w-full px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 rounded text-white">Apply Ramp</button>
            </div>
            <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">Random Velocity</div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs w-12">Min:</span>
                    <input type="range" id="mveRandMin" min="0" max="127" value="60" class="flex-1 h-2 bg-gray-300 dark:bg-slate-500 rounded">
                    <span id="mveRandMinVal" class="text-xs font-mono w-8 text-right">60</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs w-12">Max:</span>
                    <input type="range" id="mveRandMax" min="0" max="127" value="120" class="flex-1 h-2 bg-gray-300 dark:bg-slate-500 rounded">
                    <span id="mveRandMaxVal" class="text-xs font-mono w-8 text-right">120</span>
                </div>
                <button id="mveApplyRandom" class="w-full px-3 py-1 text-xs bg-orange-500 hover:bg-orange-600 rounded text-white">Apply Random</button>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
                💡 All actions capture undo state and update the sequence.
            </div>
        `}
    `;
    if (count === 0) return;

    const velSlider = container.querySelector('#mveVelocity');
    const velVal = container.querySelector('#mveVelocityVal');
    const rampStart = container.querySelector('#mveRampStart');
    const rampStartVal = container.querySelector('#mveRampStartVal');
    const rampEnd = container.querySelector('#mveRampEnd');
    const rampEndVal = container.querySelector('#mveRampEndVal');
    const randMin = container.querySelector('#mveRandMin');
    const randMinVal = container.querySelector('#mveRandMinVal');
    const randMax = container.querySelector('#mveRandMax');
    const randMaxVal = container.querySelector('#mveRandMaxVal');
    velSlider.addEventListener('input', () => { velVal.textContent = velSlider.value; });
    rampStart.addEventListener('input', () => { rampStartVal.textContent = rampStart.value; });
    rampEnd.addEventListener('input', () => { rampEndVal.textContent = rampEnd.value; });
    randMin.addEventListener('input', () => { randMinVal.textContent = randMin.value; });
    randMax.addEventListener('input', () => { randMaxVal.textContent = randMax.value; });
    container.querySelectorAll('.mveRampPreset').forEach(btn => {
        btn.addEventListener('click', () => {
            rampStart.value = btn.dataset.start;
            rampEnd.value = btn.dataset.end;
            rampStartVal.textContent = btn.dataset.start;
            rampEndVal.textContent = btn.dataset.end;
        });
    });
    container.querySelector('#mveApplyVelocity').addEventListener('click', () => {
        const v = parseInt(velSlider.value, 10) / 127;
        const res = setSelectedNotesVelocity(v);
        localAppServices.showNotification?.(res.message || `Set ${res.count} note(s) to velocity ${velSlider.value}`, 1500);
    });
    container.querySelector('#mveApplyRamp').addEventListener('click', () => {
        const s = parseInt(rampStart.value, 10) / 127;
        const e = parseInt(rampEnd.value, 10) / 127;
        const res = applyVelocityRamp(s, e);
        localAppServices.showNotification?.(res.message || `Ramped ${res.count} note(s)`, 1500);
    });
    container.querySelector('#mveApplyRandom').addEventListener('click', () => {
        const mn = parseInt(randMin.value, 10) / 127;
        const mx = parseInt(randMax.value, 10) / 127;
        const res = applyVelocityRandom(mn, mx);
        localAppServices.showNotification?.(res.message || `Randomized ${res.count} note(s)`, 1500);
    });
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

console.log('[MidiVelocityEditor] Module loaded');

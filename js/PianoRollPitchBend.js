// js/PianoRollPitchBend.js - Per-note pitch bend editor for the Piano Roll
// Provides a panel that lets users edit a pitch-bend curve for the currently
// selected notes in the Piano Roll. The curve is stored on the note object as
// `note.pitchBend` (Array<{offset: number, value: number}>).
// - offset: 0..1 fraction of note duration
// - value:  in cents, ±200 = ±2 semitones
//
// Playback integration is intentionally out of scope for this initial cut —
// the data is stored, persisted via state.js's deep-clone of sequences, and
// rendered visually on the note. Wiring the playback to actually apply the
// bend via Tone.Part callbacks is a follow-up that depends on the track's
// playback pipeline in js/Track.js.

let localAppServices = {};
let pitchBendWindow = null;
let pitchBendContent = null;
let canvasPoints = []; // local working copy for the editor
let suppressRefresh = false;

// Drag state lives at module scope so the single pair of document-level
// mousemove/mouseup listeners (installed once below) can read it across
// every canvas re-attach. Previously these refs were local to each
// attachCanvasHandlers() invocation, but attachCanvasHandlers() is called
// on every preset button (Clear / Vibrato / Bend Up / Bend Down) because
// each one re-runs renderPitchBendContent() which rewires the canvas.
// That meant every preset click added 2 more document listeners — a
// silent memory/handler leak that grew unbounded over a long session.
let draggingIndex = -1;
let pendingUndo = false;
let activeCanvas = null;
let activeSelection = [];
let documentHandlersInstalled = false;

const PITCH_BEND_RANGE_CENTS = 200;

function getSelectedNotesFromPianoRoll() {
    if (typeof window === 'undefined') return [];
    const set = window.selectedNotes;
    if (!set || typeof set.size !== 'number' || set.size === 0) return [];
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const trackId = window.currentPianoRollTrackId;
    const track = tracks.find(t => t.id === trackId);
    if (!track) return [];
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq?.data) return [];
    const result = [];
    set.forEach(id => {
        const parts = id.replace('pr-note-', '').split('-');
        if (parts.length !== 2) return;
        const r = Number(parts[0]);
        const s = Number(parts[1]);
        if (!Number.isFinite(r) || !Number.isFinite(s)) return;
        const note = activeSeq.data[r]?.[s];
        if (note) result.push({ id, row: r, step: s, note, track, activeSeq });
    });
    return result;
}

function ensureBendArray(note) {
    if (!note) return [];
    if (!Array.isArray(note.pitchBend)) note.pitchBend = [];
    return note.pitchBend;
}

function normalizeBendPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return [];
    return points
        .map(p => ({ offset: Number(p.offset), value: Number(p.value) }))
        .filter(p => Number.isFinite(p.offset) && Number.isFinite(p.value))
        .map(p => ({
            offset: Math.max(0, Math.min(1, p.offset)),
            value: Math.max(-PITCH_BEND_RANGE_CENTS, Math.min(PITCH_BEND_RANGE_CENTS, p.value)),
        }))
        .sort((a, b) => a.offset - b.offset);
}

function captureUndoForSelection(selection, label) {
    if (!selection.length) return;
    const track = selection[0].track;
    if (track?.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo(label);
    } else if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(label);
    }
}

function notify(message) {
    if (localAppServices.showNotification) {
        localAppServices.showNotification(message, 2000);
    }
}

function refreshPianoRoll() {
    if (typeof window === 'undefined') return;
    if (suppressRefresh) return;
    if (typeof window.updatePianoRollPanel === 'function') {
        window.updatePianoRollPanel();
    } else if (localAppServices.updatePianoRollPanel) {
        localAppServices.updatePianoRollPanel();
    }
}

function getFirstBendForEditor(selection) {
    if (!selection.length) return [];
    return normalizeBendPoints(ensureBendArray(selection[0].note));
}

function setBendForSelection(selection, newPoints) {
    const cleaned = normalizeBendPoints(newPoints);
    selection.forEach(s => {
        s.note.pitchBend = cleaned.map(p => ({ offset: p.offset, value: p.value }));
    });
}

function findInsertIndex(points, offset) {
    for (let i = 0; i < points.length; i++) {
        if (points[i].offset > offset) return i;
    }
    return points.length;
}

function drawCanvas(canvas, points) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const x = (i / 4) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`+${PITCH_BEND_RANGE_CENTS}c`, 4, 12);
    ctx.fillText(`-${PITCH_BEND_RANGE_CENTS}c`, 4, h - 4);
    if (points.length === 0) return;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        const x = points[i].offset * w;
        const y = h / 2 - (points[i].value / PITCH_BEND_RANGE_CENTS) * (h / 2 - 4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#4f46e5';
    for (let i = 0; i < points.length; i++) {
        const x = points[i].offset * w;
        const y = h / 2 - (points[i].value / PITCH_BEND_RANGE_CENTS) * (h / 2 - 4);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function initPianoRollPitchBend(appServices) {
    localAppServices = appServices || {};
    if (typeof window !== 'undefined') {
        window.openPianoRollPitchBend = openPitchBendEditor;
    }
    console.log('[PianoRollPitchBend] Module initialized');
}

export function openPitchBendEditor() {
    if (typeof window === 'undefined') return;
    const windowId = 'pianoRollPitchBend';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPitchBendContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'pianoRollPitchBendContent';
    contentContainer.className = 'p-0 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

    if (localAppServices.createWindow) {
        pitchBendWindow = localAppServices.createWindow({
            id: windowId,
            title: 'Pitch Bend Editor',
            width: 560,
            height: 380,
            content: contentContainer,
        });
    } else {
        // Fallback: simple modal
        const wrapper = document.createElement('div');
        wrapper.id = windowId;
        wrapper.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:560px;height:380px;z-index:10000;background:#1e293b;border:1px solid #475569;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
        const close = document.createElement('button');
        close.textContent = 'X';
        close.style.cssText = 'position:absolute;top:8px;right:8px;background:#475569;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;z-index:1;';
        close.addEventListener('click', closePitchBendEditor);
        wrapper.appendChild(close);
        wrapper.appendChild(contentContainer);
        document.body.appendChild(wrapper);
        pitchBendWindow = { close: () => wrapper.remove() };
    }

    pitchBendContent = contentContainer;
    renderPitchBendContent();
    return pitchBendWindow;
}

export function closePitchBendEditor() {
    if (pitchBendWindow && pitchBendWindow.close) {
        pitchBendWindow.close();
    }
    pitchBendWindow = null;
    pitchBendContent = null;
    // Drop refs to the now-detached canvas and the selection that targeted
    // it, so the long-lived document listeners don't try to mutate them.
    // draggingIndex/pendingUndo are module-scope and will naturally reset
    // on the next mousedown.
    activeCanvas = null;
    activeSelection = [];
}

function renderPitchBendContent() {
    if (!pitchBendContent) return;
    const selection = getSelectedNotesFromPianoRoll();

    if (selection.length === 0) {
        pitchBendContent.innerHTML = `
            <div class="flex flex-col h-full">
                <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Pitch Bend</h3>
                    <button id="pbClose" class="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 rounded text-white">Close</button>
                </div>
                <div class="flex-1 flex items-center justify-center p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                    Open the Piano Roll and select one or more notes to edit their pitch bend.
                </div>
            </div>
        `;
        const closeBtn = pitchBendContent.querySelector('#pbClose');
        if (closeBtn) closeBtn.addEventListener('click', closePitchBendEditor);
        return;
    }

    canvasPoints = getFirstBendForEditor(selection);
    const totalSelected = selection.length;
    const withBend = selection.filter(s => Array.isArray(s.note.pitchBend) && s.note.pitchBend.length > 0).length;

    pitchBendContent.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex-shrink-0">
                <div class="flex items-center gap-2">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Pitch Bend</h3>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${totalSelected} note${totalSelected === 1 ? '' : 's'} selected${withBend > 0 ? ' - ' + withBend + ' with bend' : ''}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button id="pbPresetVib" class="px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 rounded text-white" title="Subtle vibrato (~5 Hz, ±10 cents)">+ Vibrato</button>
                    <button id="pbPresetBendUp" class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white" title="Bend up 100 cents over the note">+ Bend Up</button>
                    <button id="pbPresetBendDown" class="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 rounded text-white" title="Bend down 100 cents over the note">+ Bend Down</button>
                    <button id="pbClear" class="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded text-white" title="Remove all pitch bend">Clear</button>
                    <button id="pbClose" class="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 rounded text-white">Close</button>
                </div>
            </div>
            <div class="flex-1 flex flex-col p-3 overflow-auto">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Click in the lane to set a bend point. Drag a point to move it. Right-click a point to delete it. Range: ±${PITCH_BEND_RANGE_CENTS} cents (±2 semitones).
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mb-2">
                    <span>Curve points:</span>
                    <span id="pbPointCount" class="px-2 py-0.5 bg-gray-200 dark:bg-slate-700 rounded">${canvasPoints.length}</span>
                </div>
                <canvas id="pbCanvas" class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded cursor-crosshair" style="height: 200px;"></canvas>
            </div>
            <div class="px-3 py-1 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
                Edits apply to all ${totalSelected} selected note${totalSelected === 1 ? '' : 's'}.
            </div>
        </div>
    `;

    wirePitchBendContent(selection);
}

function wirePitchBendContent(selection) {
    if (!pitchBendContent) return;
    const closeBtn = pitchBendContent.querySelector('#pbClose');
    if (closeBtn) closeBtn.addEventListener('click', closePitchBendEditor);

    const clearBtn = pitchBendContent.querySelector('#pbClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            captureUndoForSelection(selection, 'Clear pitch bend');
            setBendForSelection(selection, []);
            canvasPoints = [];
            refreshPianoRoll();
            renderPitchBendContent();
            notify('Pitch bend cleared');
        });
    }

    const vibBtn = pitchBendContent.querySelector('#pbPresetVib');
    if (vibBtn) {
        vibBtn.addEventListener('click', () => {
            // 6-point vibrato at ±10 cents across the note
            const pts = [];
            for (let i = 0; i <= 6; i++) {
                const t = i / 6;
                const v = Math.sin(t * Math.PI * 4) * 10;
                pts.push({ offset: t, value: Math.round(v) });
            }
            captureUndoForSelection(selection, 'Vibrato pitch bend');
            setBendForSelection(selection, pts);
            canvasPoints = normalizeBendPoints(pts);
            refreshPianoRoll();
            renderPitchBendContent();
            notify('Vibrato applied');
        });
    }

    const upBtn = pitchBendContent.querySelector('#pbPresetBendUp');
    if (upBtn) {
        upBtn.addEventListener('click', () => {
            const pts = [
                { offset: 0, value: 0 },
                { offset: 0.5, value: 100 },
                { offset: 1, value: 100 },
            ];
            captureUndoForSelection(selection, 'Bend up');
            setBendForSelection(selection, pts);
            canvasPoints = normalizeBendPoints(pts);
            refreshPianoRoll();
            renderPitchBendContent();
            notify('Bend up applied');
        });
    }

    const downBtn = pitchBendContent.querySelector('#pbPresetBendDown');
    if (downBtn) {
        downBtn.addEventListener('click', () => {
            const pts = [
                { offset: 0, value: 0 },
                { offset: 0.5, value: -100 },
                { offset: 1, value: -100 },
            ];
            captureUndoForSelection(selection, 'Bend down');
            setBendForSelection(selection, pts);
            canvasPoints = normalizeBendPoints(pts);
            refreshPianoRoll();
            renderPitchBendContent();
            notify('Bend down applied');
        });
    }

    const canvas = pitchBendContent.querySelector('#pbCanvas');
    if (canvas) {
        // Ensure canvas backing pixel size matches CSS layout
        requestAnimationFrame(() => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.max(100, Math.floor(rect.width));
            canvas.height = Math.max(120, Math.floor(rect.height || 200));
            drawCanvas(canvas, canvasPoints);
            attachCanvasHandlers(canvas, selection);
        });
    }
}

function installDocumentDragHandlers() {
    if (documentHandlersInstalled) return;
    if (typeof document === 'undefined') return;
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
    documentHandlersInstalled = true;
}

function onDocumentMouseMove(e) {
    if (draggingIndex < 0) return;
    if (!activeCanvas) return;
    const p = eventToPoint(e, activeCanvas);
    canvasPoints[draggingIndex] = p;
    canvasPoints.sort((a, b) => a.offset - b.offset);
    // recompute dragging index after sort
    draggingIndex = canvasPoints.findIndex(q => q === p);
    if (draggingIndex < 0) draggingIndex = 0;
    setBendForSelection(activeSelection, canvasPoints);
    drawCanvas(activeCanvas, canvasPoints);
    refreshPianoRoll();
}

function onDocumentMouseUp() {
    if (draggingIndex >= 0) {
        pendingUndo = false;
    }
    draggingIndex = -1;
}

function eventToPoint(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const offset = x / rect.width;
    const value = -((y / rect.height) * 2 - 1) * PITCH_BEND_RANGE_CENTS;
    return { offset, value: Math.max(-PITCH_BEND_RANGE_CENTS, Math.min(PITCH_BEND_RANGE_CENTS, value)) };
}

function pointAt(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = 0; i < canvasPoints.length; i++) {
        const px = canvasPoints[i].offset * rect.width;
        const py = rect.height / 2 - (canvasPoints[i].value / PITCH_BEND_RANGE_CENTS) * (rect.height / 2 - 4);
        if (Math.hypot(px - x, py - y) <= 6) return i;
    }
    return -1;
}

function attachCanvasHandlers(canvas, selection) {
    // Install the document-level mousemove/mouseup pair ONCE for the
    // lifetime of the module — every canvas re-attach only re-wires the
    // canvas mousedown. We also stash refs to the current canvas +
    // selection in module scope so the document handlers know what to
    // mutate. The canvas element is recreated by renderPitchBendContent()
    // (innerHTML rewrite) so the previous mousedown listener is GC'd with
    // its old canvas; the document listeners are the long-lived ones and
    // must not be re-added.
    activeCanvas = canvas;
    activeSelection = selection;
    installDocumentDragHandlers();

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            // right click: delete
            const idx = pointAt(e, canvas);
            if (idx >= 0) {
                if (!pendingUndo) {
                    captureUndoForSelection(selection, 'Edit pitch bend');
                    pendingUndo = true;
                }
                canvasPoints.splice(idx, 1);
                setBendForSelection(selection, canvasPoints);
                drawCanvas(canvas, canvasPoints);
                updatePointCount();
                refreshPianoRoll();
            }
            return;
        }
        const idx = pointAt(e, canvas);
        if (idx >= 0) {
            draggingIndex = idx;
            if (!pendingUndo) {
                captureUndoForSelection(selection, 'Edit pitch bend');
                pendingUndo = true;
            }
        } else {
            if (!pendingUndo) {
                captureUndoForSelection(selection, 'Add pitch bend point');
                pendingUndo = true;
            }
            const p = eventToPoint(e, canvas);
            const insertAt = findInsertIndex(canvasPoints, p.offset);
            canvasPoints.splice(insertAt, 0, p);
            draggingIndex = insertAt;
            setBendForSelection(selection, canvasPoints);
            drawCanvas(canvas, canvasPoints);
            updatePointCount();
            refreshPianoRoll();
        }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updatePointCount() {
    if (!pitchBendContent) return;
    const el = pitchBendContent.querySelector('#pbPointCount');
    if (el) el.textContent = String(canvasPoints.length);
}

export function getPianoRollPitchBendWindow() {
    return pitchBendWindow;
}

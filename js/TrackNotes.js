// js/TrackNotes.js - Per-Track Notes for SnugOS DAW
// Attach text notes (lyrics, mix notes, performance cues) to individual tracks.
// Notes are stored in a Map keyed by trackId, persisted to localStorage,
// rendered as a colored indicator on the track header, and managed from a
// floating notes panel accessible via the start menu ("Track Notes") and
// the per-track "Add Note" context-menu entry.

const STORAGE_KEY = 'snaw_track_notes_v1';
const TRACK_INDEX_STORAGE_KEY = 'snaw_track_notes_index_v1';

const noteColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const defaultColor = '#3b82f6';
const maxNoteLength = 2000;

let notes = new Map(); // trackId -> { text, color, timestamp, author }
let localAppServices = {};
let overviewPanel = null;
let overviewSearchQuery = '';

function persist() {
    try {
        const data = {};
        notes.forEach((value, key) => { data[key] = value; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(TRACK_INDEX_STORAGE_KEY, JSON.stringify(Object.keys(data)));
    } catch (e) {
        console.warn('[TrackNotes] Failed to persist:', e);
    }
}

function hydrate() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                notes = new Map(Object.entries(parsed));
            }
        }
    } catch (e) {
        console.warn('[TrackNotes] Failed to hydrate:', e);
    }
}

function clampLength(text) {
    if (typeof text !== 'string') return '';
    if (text.length > maxNoteLength) {
        console.warn(`[TrackNotes] Note truncated to ${maxNoteLength} characters`);
        return text.slice(0, maxNoteLength);
    }
    return text;
}

function getTrackId(track) {
    if (track === null || track === undefined) return null;
    if (typeof track === 'string' || typeof track === 'number') return String(track);
    return track.id != null ? String(track.id) : (track.trackId != null ? String(track.trackId) : null);
}

function getTrackLabel(trackId) {
    if (!trackId) return 'Unknown Track';
    try {
        const tracks = (localAppServices && localAppServices.getAllTracks && localAppServices.getAllTracks()) || [];
        const found = tracks.find(t => t.id === trackId);
        if (found && found.name) return found.name;
    } catch (e) { /* ignore */ }
    return `Track ${String(trackId).slice(0, 8)}`;
}

export function initTrackNotes(services) {
    localAppServices = services || {};
    hydrate();
    // Re-render indicators for any tracks currently in the DOM
    notes.forEach((note, trackId) => updateTrackUI(trackId, note));
    console.log('[TrackNotes] Initialized with', notes.size, 'note(s)');
}

export function getNote(trackId) {
    if (!trackId) return null;
    return notes.get(String(trackId)) || null;
}

export function setNote(trackId, text, color = null) {
    if (!trackId) return false;
    const safeText = clampLength(text || '');
    const existing = notes.get(String(trackId));
    const note = {
        text: safeText,
        color: color || (existing && existing.color) || defaultColor,
        timestamp: Date.now(),
        author: 'User'
    };
    notes.set(String(trackId), note);
    updateTrackUI(String(trackId), note);
    persist();
    return true;
}

export function removeNote(trackId) {
    if (!trackId) return false;
    const had = notes.delete(String(trackId));
    clearTrackUI(String(trackId));
    if (had) persist();
    return had;
}

export function getAllNotes() {
    return Array.from(notes.entries()).map(([trackId, note]) => ({ trackId, ...note }));
}

export function searchNotes(query) {
    if (!query) return getAllNotes();
    const q = String(query).toLowerCase();
    const results = [];
    notes.forEach((note, trackId) => {
        if ((note.text || '').toLowerCase().includes(q)) {
            results.push({ trackId, ...note });
        }
    });
    return results;
}

export function exportNotes() {
    const data = {};
    notes.forEach((note, trackId) => { data[trackId] = note; });
    return data;
}

export function importNotes(data) {
    if (!data || typeof data !== 'object') return false;
    notes = new Map(Object.entries(data));
    persist();
    notes.forEach((note, trackId) => updateTrackUI(trackId, note));
    return true;
}

function updateTrackUI(trackId, note) {
    const el = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
    if (!el) return;
    const existing = el.querySelector('.track-note-indicator');
    if (existing) existing.remove();
    if (!note || !note.text) return;
    const indicator = document.createElement('div');
    indicator.className = 'track-note-indicator';
    indicator.style.cssText = [
        'width:10px',
        'height:10px',
        `background:${note.color || defaultColor}`,
        'border-radius:50%',
        'margin-left:8px',
        'cursor:pointer',
        'flex-shrink:0',
        'box-shadow:0 0 0 1px rgba(255,255,255,0.25)',
        'transition:transform 0.1s ease'
    ].join(';');
    indicator.title = `${getTrackLabel(trackId)}: ${note.text.slice(0, 120)}${note.text.length > 120 ? '…' : ''}`;
    indicator.addEventListener('click', (e) => {
        e.stopPropagation();
        openNoteEditor(trackId);
    });
    indicator.addEventListener('mouseenter', () => { indicator.style.transform = 'scale(1.25)'; });
    indicator.addEventListener('mouseleave', () => { indicator.style.transform = 'scale(1)'; });
    el.appendChild(indicator);
}

function clearTrackUI(trackId) {
    const el = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
    if (!el) return;
    const indicator = el.querySelector('.track-note-indicator');
    if (indicator) indicator.remove();
}

export function refreshIndicators() {
    notes.forEach((note, trackId) => updateTrackUI(trackId, note));
}

export function openNoteEditor(trackId, x = null, y = null) {
    if (!trackId) return;
    trackId = String(trackId);
    const existing = document.getElementById('track-note-editor');
    if (existing) existing.remove();

    const currentNote = getNote(trackId) || { text: '', color: defaultColor };
    const editor = document.createElement('div');
    editor.id = 'track-note-editor';
    const baseStyle = [
        'position:fixed',
        'background:#1a1a2e',
        'border:1px solid #333',
        'border-radius:8px',
        'padding:16px',
        'z-index:10000',
        'width:320px',
        'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
        'color:#fff',
        'font-family:inherit'
    ];
    if (x !== null && y !== null) {
        editor.style.cssText = `${baseStyle.join(';')};left:${Math.max(8, x)}px;top:${Math.max(8, y)}px;`;
    } else {
        editor.style.cssText = `${baseStyle.join(';')};right:20px;top:80px;`;
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
    const title = document.createElement('div');
    title.textContent = `Note · ${getTrackLabel(trackId)}`;
    title.style.cssText = 'color:#fff;font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;';
    closeBtn.addEventListener('click', () => editor.remove());
    header.appendChild(closeBtn);
    editor.appendChild(header);

    // Color selector
    const colorSection = document.createElement('div');
    colorSection.style.cssText = 'margin-bottom:10px;';
    const colorLabel = document.createElement('div');
    colorLabel.textContent = 'Color';
    colorLabel.style.cssText = 'color:#888;font-size:11px;margin-bottom:6px;';
    colorSection.appendChild(colorLabel);
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;gap:6px;';
    const swatches = [];
    noteColors.forEach((color) => {
        const swatch = document.createElement('div');
        swatch.style.cssText = `width:22px;height:22px;background:${color};border-radius:4px;cursor:pointer;border:2px solid transparent;transition:transform 0.1s;`;
        if (currentNote.color === color) swatch.style.borderColor = '#fff';
        swatch.addEventListener('click', () => {
            swatches.forEach(s => { s.style.borderColor = 'transparent'; });
            swatch.style.borderColor = '#fff';
            currentNote.color = color;
        });
        swatches.push(swatch);
        colorRow.appendChild(swatch);
    });
    colorSection.appendChild(colorRow);
    editor.appendChild(colorSection);

    // Text area
    const textArea = document.createElement('textarea');
    textArea.value = currentNote.text || '';
    textArea.placeholder = 'Lyrics, mix notes, performance cues…';
    textArea.maxLength = maxNoteLength;
    textArea.style.cssText = [
        'width:100%',
        'height:130px',
        'background:#0a0a14',
        'border:1px solid #333',
        'border-radius:4px',
        'color:#fff',
        'padding:10px',
        'font-family:inherit',
        'font-size:13px',
        'resize:vertical',
        'box-sizing:border-box',
        'line-height:1.4'
    ].join(';');
    const charCount = document.createElement('div');
    const updateCount = () => { charCount.textContent = `${textArea.value.length}/${maxNoteLength}`; };
    textArea.addEventListener('input', updateCount);
    editor.appendChild(textArea);

    charCount.textContent = `${(currentNote.text || '').length}/${maxNoteLength}`;
    charCount.style.cssText = 'color:#666;font-size:11px;text-align:right;margin-top:4px;';
    editor.appendChild(charCount);

    // Action row
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'flex:1;padding:9px;background:#3b82f6;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:600;font-size:13px;';
    saveBtn.addEventListener('click', () => {
        const value = textArea.value.trim();
        if (value) setNote(trackId, value, currentNote.color);
        else removeNote(trackId);
        editor.remove();
        if (localAppServices && typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification(value ? 'Note saved' : 'Note removed', 1500);
        }
    });
    buttons.appendChild(saveBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = 'flex:1;padding:9px;background:#7f1d1d;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:13px;';
    deleteBtn.addEventListener('click', () => {
        removeNote(trackId);
        editor.remove();
        if (localAppServices && typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification('Note deleted', 1500);
        }
    });
    buttons.appendChild(deleteBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex:0 0 70px;padding:9px;background:#333;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:13px;';
    cancelBtn.addEventListener('click', () => editor.remove());
    buttons.appendChild(cancelBtn);
    editor.appendChild(buttons);

    // Close on outside click
    setTimeout(() => {
        const onDocClick = (e) => {
            if (!editor.contains(e.target)) {
                editor.remove();
                document.removeEventListener('click', onDocClick, true);
            }
        };
        document.addEventListener('click', onDocClick, true);
    }, 10);

    // Close on Escape
    const onKey = (e) => {
        if (e.key === 'Escape') {
            editor.remove();
            document.removeEventListener('keydown', onKey);
        }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(editor);
    updateCount();
    textArea.focus();
}

function renderOverviewList(container) {
    container.innerHTML = '';
    const items = overviewSearchQuery ? searchNotes(overviewSearchQuery) : getAllNotes();
    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = overviewSearchQuery ? 'No notes match your search.' : 'No track notes yet. Right-click a track header and choose "Add Note".';
        empty.style.cssText = 'color:#666;text-align:center;padding:24px 12px;font-size:12px;line-height:1.5;';
        container.appendChild(empty);
        return;
    }
    items.forEach(({ trackId, text, color, timestamp }) => {
        const card = document.createElement('div');
        card.style.cssText = `background:#1a1a2e;border-radius:6px;padding:10px 12px;border-left:3px solid ${color || defaultColor};cursor:pointer;transition:background 0.1s;`;
        card.addEventListener('mouseenter', () => { card.style.background = '#22223a'; });
        card.addEventListener('mouseleave', () => { card.style.background = '#1a1a2e'; });
        card.addEventListener('click', () => openNoteEditor(trackId));
        const label = document.createElement('div');
        label.textContent = getTrackLabel(trackId);
        label.style.cssText = 'color:#aaa;font-size:11px;margin-bottom:4px;font-weight:600;';
        card.appendChild(label);
        const textNode = document.createElement('div');
        const snippet = (text || '').slice(0, 140);
        textNode.textContent = snippet + ((text || '').length > 140 ? '…' : '');
        textNode.style.cssText = 'color:#fff;font-size:12px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;';
        card.appendChild(textNode);
        const meta = document.createElement('div');
        meta.textContent = new Date(timestamp).toLocaleString();
        meta.style.cssText = 'color:#555;font-size:10px;margin-top:6px;';
        card.appendChild(meta);
        container.appendChild(card);
    });
}

export function openNotesPanel() {
    if (overviewPanel) {
        overviewPanel.remove();
        overviewPanel = null;
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'track-notes-overview';
    panel.style.cssText = [
        'position:fixed',
        'right:20px',
        'top:80px',
        'width:340px',
        'max-height:520px',
        'background:#0f0f1a',
        'border:1px solid #333',
        'border-radius:8px',
        'padding:14px',
        'z-index:9000',
        'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
        'display:flex',
        'flex-direction:column',
        'gap:10px',
        'color:#fff',
        'font-family:inherit'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    const title = document.createElement('h3');
    title.textContent = 'Track Notes';
    title.style.cssText = 'color:#fff;margin:0;font-size:15px;font-weight:600;';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;';
    closeBtn.addEventListener('click', () => {
        panel.remove();
        overviewPanel = null;
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search notes…';
    search.value = overviewSearchQuery || '';
    search.style.cssText = [
        'width:100%',
        'padding:8px 10px',
        'background:#1a1a2e',
        'border:1px solid #333',
        'border-radius:4px',
        'color:#fff',
        'font-size:12px',
        'box-sizing:border-box',
        'font-family:inherit'
    ].join(';');
    search.addEventListener('input', (e) => {
        overviewSearchQuery = e.target.value;
        const list = panel.querySelector('.tn-list');
        if (list) renderOverviewList(list);
    });
    panel.appendChild(search);

    const list = document.createElement('div');
    list.className = 'tn-list';
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1;min-height:120px;';
    panel.appendChild(list);
    renderOverviewList(list);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#666;border-top:1px solid #222;padding-top:8px;';
    const count = document.createElement('span');
    count.textContent = `${getAllNotes().length} note(s)`;
    footer.appendChild(count);
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export JSON';
    exportBtn.style.cssText = 'background:#222;border:1px solid #333;color:#ccc;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;';
    exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(exportNotes(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'snaw-track-notes.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    footer.appendChild(exportBtn);
    panel.appendChild(footer);

    document.body.appendChild(panel);
    overviewPanel = panel;
}

export function closeNotesPanel() {
    if (overviewPanel) {
        overviewPanel.remove();
        overviewPanel = null;
    }
}

/**
 * Adds a context-menu entry to the per-track context menu so users can
 * open the note editor for a specific track from the right-click menu.
 * Returns a function that returns the menu item definition so callers can
 * splice it into their own menu arrays.
 */
export function getTrackContextMenuEntry(trackId) {
    return {
        label: getNote(trackId) ? 'Edit Track Note' : 'Add Track Note',
        action: () => openNoteEditor(trackId)
    };
}

export function openNoteForTrack(track) {
    const trackId = getTrackId(track);
    if (!trackId) {
        if (localAppServices && typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification('No track selected', 1500);
        }
        return false;
    }
    openNoteEditor(trackId);
    return true;
}

export function openNoteForCurrentTrack() {
    let trackId = null;
    try {
        if (localAppServices && typeof localAppServices.getSelectedTrackId === 'function') {
            trackId = localAppServices.getSelectedTrackId();
        }
        if (!trackId && localAppServices && typeof localAppServices.getAllTracks === 'function') {
            const tracks = localAppServices.getAllTracks();
            if (tracks && tracks.length) trackId = tracks[0].id;
        }
    } catch (e) { /* ignore */ }
    if (!trackId) {
        if (localAppServices && typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification('No tracks available. Add a track first.', 2000);
        }
        return false;
    }
    openNoteEditor(trackId);
    return true;
}

if (typeof window !== 'undefined') {
    window.initTrackNotes = initTrackNotes;
    window.getNote = getNote;
    window.setNote = setNote;
    window.removeNote = removeNote;
    window.getAllNotes = getAllNotes;
    window.searchNotes = searchNotes;
    window.exportNotes = exportNotes;
    window.importNotes = importNotes;
    window.refreshIndicators = refreshIndicators;
    window.openNoteEditor = openNoteEditor;
    window.openNotesPanel = openNotesPanel;
    window.closeNotesPanel = closeNotesPanel;
    window.getTrackContextMenuEntry = getTrackContextMenuEntry;
    window.openNoteForTrack = openNoteForTrack;
    window.openNoteForCurrentTrack = openNoteForCurrentTrack;
    window.openTrackNotesPanel = openNotesPanel;
    window.trackNotes = {
        init: initTrackNotes,
        getNote, setNote, removeNote, getAllNotes, searchNotes,
        exportNotes, importNotes, refreshIndicators,
        openNoteEditor, openNotesPanel, closeNotesPanel,
        getTrackContextMenuEntry, openNoteForTrack, openNoteForCurrentTrack
    };
}

console.log('[TrackNotes] Module loaded');

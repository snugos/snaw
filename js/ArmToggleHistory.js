// js/ArmToggleHistory.js - Dedicated undo stack for Track Record-Arm toggles
//
// Lets users undo a record-arm toggle (R / strip button) WITHOUT triggering
// a full project-state reconstruction, which would otherwise briefly disturb
// playback, transport position, tempo, scroll, selection, etc.
//
// Usage:
//   initArmToggleHistory(appServices)        // once at boot
//   recordArmToggle(prevId, newId, trkId, trkName)  // before mutating armedTrackId
//   undoLastRecordArmToggle()                 // call to restore previous arm state
//
// The dedicated Cmd+Z routing happens in eventHandlers.js — when an arm
// toggle is at the top of the main undo stack (description starts with
// "Arm Track" / "Disarm Track"), we pop ONLY the dedicated arm entry and
// restore the previous armed track id without rebuilding the whole project.

let localAppServices = {};

export function initArmToggleHistory(services) {
    localAppServices = services || {};
    console.log('[ArmToggleHistory] Initialized');
}

const MAX_HISTORY = 50;

const armHistory = {
    stack: [],

    push(entry) {
        this.stack.push({ ...entry, timestamp: Date.now() });
        if (this.stack.length > MAX_HISTORY) this.stack.shift();
    },

    pop() {
        return this.stack.length > 0 ? this.stack.pop() : null;
    },

    peek() {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    },

    clear() {
        this.stack = [];
    },

    get size() { return this.stack.length; }
};

function pushEntry(prevArmedId, newArmedId, trackId, trackName) {
    armHistory.push({
        prevArmedId: prevArmedId ?? null,
        newArmedId: newArmedId ?? null,
        trackId,
        trackName
    });
}

function undoLast() {
    const entry = armHistory.pop();
    if (!entry) return { ok: false, reason: 'empty' };

    // Only mutate the global armed-track state; do NOT touch anything else.
    const setArmed = localAppServices.setArmedTrackIdState
        || localAppServices.setArmedTrackId;
    if (typeof setArmed === 'function') {
        setArmed(entry.prevArmedId);
    }

    // Visual refresh: update the affected track's UI (armChanged) + mixer.
    if (entry.trackId && localAppServices.updateTrackUI) {
        try { localAppServices.updateTrackUI(entry.trackId, 'armChanged'); } catch (e) {}
    }
    if (entry.prevArmedId && localAppServices.updateTrackUI) {
        try { localAppServices.updateTrackUI(entry.prevArmedId, 'armChanged'); } catch (e) {}
    }
    if (typeof localAppServices.renderMixerChannelStripContent === 'function') {
        try { localAppServices.renderMixerChannelStripContent(); } catch (e) {}
    }
    if (typeof localAppServices.renderMixer === 'function') {
        try { localAppServices.renderMixer(); } catch (e) {}
    }

    const restoredTrack = (localAppServices.getTrackByIdState || localAppServices.getTrackById)?.(entry.prevArmedId);
    const msg = restoredTrack
        ? `Restored arm: ${restoredTrack.name}`
        : (entry.prevArmedId == null ? 'All tracks disarmed' : 'Previous arm state restored');
    if (localAppServices.showNotification) {
        localAppServices.showNotification(msg, 1500);
    }
    return { ok: true, entry };
}

function hasUndo() { return armHistory.stack.length > 0; }
function clear() { armHistory.clear(); }
function size() { return armHistory.stack.length; }

// Public API (also mirrored on window for parity with SoloMuteHistory)
export function recordArmToggle(prevArmedId, newArmedId, trackId, trackName) {
    pushEntry(prevArmedId, newArmedId, trackId, trackName);
}

export function undoLastRecordArmToggle() {
    return undoLast();
}

export function hasArmToggleUndo() { return hasUndo(); }
export function clearArmToggleHistory() { clear(); }
export function getArmToggleHistorySize() { return size(); }

window.ArmToggleHistory = {
    record: recordArmToggle,
    undo: undoLastRecordArmToggle,
    hasUndo: hasArmToggleUndo,
    clear: clearArmToggleHistory,
    size: getArmToggleHistorySize
};
window.undoLastRecordArmToggle = undoLastRecordArmToggle;
window.recordArmToggle = recordArmToggle;
window.hasArmToggleUndo = hasArmToggleUndo;
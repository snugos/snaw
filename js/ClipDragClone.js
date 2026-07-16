// js/ClipDragClone.js - Drag clips on the timeline; Alt+drag to clone-paint (leave original)
//
// Plain drag: moves the selected clip(s) horizontally by the mouse delta.
// Alt+drag:    leaves the original clip(s) in place and creates new clone(s)
//              at the drop position (clip-paint workflow).
//
// Works alongside ClipSelectionManager (multi-select aware) and any module
// that re-renders the timeline (we re-apply our drag transform on every frame).

import { isClipLocked, notifyClipLocked } from './ClipLockToggle.js';

let localAppServices = {};
let activeDrag = null; // { clipIds, originalClipIds, startX, lastX, pixelsPerSecond, isAlt }

const DRAG_THRESHOLD_PX = 3; // mouse must move this far before we begin a real drag

function getPixelsPerSecondSafe() {
    try {
        if (typeof localAppServices.getPixelsPerSecond === 'function') {
            const v = localAppServices.getPixelsPerSecond();
            if (Number.isFinite(v) && v > 0) return v;
        }
    } catch (_) { /* fallthrough */ }
    return 50; // matches the default used elsewhere in the app
}

function getSelectedClipIds() {
    try {
        if (typeof localAppServices.getSelectedClipIds === 'function') {
            const sel = localAppServices.getSelectedClipIds();
            if (sel instanceof Set) return Array.from(sel);
            if (Array.isArray(sel)) return sel;
        }
    } catch (_) { /* fallthrough */ }
    return [];
}

function getTrackAndClipById(clipId) {
    const tracks = (typeof localAppServices.getTracks === 'function')
        ? localAppServices.getTracks()
        : [];
    for (const track of tracks) {
        const clip = (track.timelineClips || []).find(c => c.id === clipId);
        if (clip) return { track, clip };
    }
    return null;
}

function cloneClip(clip, newId) {
    const copy = JSON.parse(JSON.stringify(clip));
    copy.id = newId;
    if (copy.name) copy.name = `${copy.name} (clone)`;
    return copy;
}

function generateClipId() {
    return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function applyDragTransform(deltaSeconds) {
    if (!activeDrag || !activeDrag.clipIds || activeDrag.clipIds.length === 0) return;
    const tracks = (typeof localAppServices.getTracks === 'function')
        ? localAppServices.getTracks()
        : [];

    if (activeDrag.isAlt) {
        // Move the *clones* (stored separately so originals stay put).
        activeDrag.phantomClipIds = activeDrag.phantomClipIds || [];
        activeDrag.phantomClips = activeDrag.phantomClips || [];

        // Ensure the phantom clips exist in their tracks.
        activeDrag.clipIds.forEach((origId, idx) => {
            const found = getTrackAndClipById(origId);
            if (!found) return;
            let phantom = activeDrag.phantomClips[idx];
            if (!phantom) {
                phantom = cloneClip(found.clip, generateClipId());
                // Start the phantom exactly on top of the original.
                phantom.startTime = found.clip.startTime;
                found.track.timelineClips.push(phantom);
                activeDrag.phantomClips[idx] = phantom;
                activeDrag.phantomClipIds[idx] = phantom.id;
            }
            const newStart = Math.max(0, found.clip.startTime + deltaSeconds);
            phantom.startTime = newStart;
        });
    } else {
        // Move the originals directly.
        activeDrag.clipIds.forEach(clipId => {
            const found = getTrackAndClipById(clipId);
            if (!found) return;
            const newStart = Math.max(0, found.clip.startTime + deltaSeconds);
            found.clip.startTime = newStart;
        });
    }

    if (typeof localAppServices.renderTimeline === 'function') {
        localAppServices.renderTimeline();
    }
}

function cleanupPhantomClips() {
    if (!activeDrag) return;
    if (activeDrag.phantomClips && activeDrag.phantomClips.length) {
        // Keep the phantoms — they ARE the clones we wanted to leave behind.
        // Just clear our reference so a second drag doesn't re-target them.
        activeDrag.phantomClips = [];
        activeDrag.phantomClipIds = [];
    }
}

function onMouseDown(e) {
    // Only respond to the primary mouse button, on a timeline clip.
    if (e.button !== 0) return;
    const clipEl = e.target.closest('.timeline-clip');
    if (!clipEl) return;

    // Don't hijack drag attempts that are clearly on a handle/control
    // (the fade-handle module sets its own listeners and uses stopPropagation).
    if (e.target.closest('.clip-fade-handle, .fade-handle, button, input, select, textarea, label')) return;

    const clipId = clipEl.getAttribute('data-clip-id') || clipEl.getAttribute('data-id');
    if (!clipId) return;
    if (isClipLocked(clipId)) {
        notifyClipLocked('move');
        return;
    }

    // If the clip isn't part of the current selection, treat the click as
    // "select this clip and start dragging it" — matches the usual DAW feel.
    let selectedIds = getSelectedClipIds().map(String);
    const isAlreadySelected = selectedIds.includes(String(clipId));
    if (!isAlreadySelected) {
        // If user shift-clicks, let ClipSelectionManager handle multi-select first.
        if (e.shiftKey) return;
        // Plain click on an unselected clip → use just that clip for the drag.
        selectedIds = [String(clipId)];
    }

    if (selectedIds.some(isClipLocked)) {
        notifyClipLocked('move');
        return;
    }

    activeDrag = {
        clipIds: selectedIds,
        startX: e.clientX,
        lastX: e.clientX,
        pixelsPerSecond: getPixelsPerSecondSafe(),
        isAlt: e.altKey,
        started: false,
        phantomClips: [],
        phantomClipIds: []
    };

    // Capture for the move/up events so we still get them if the cursor
    // leaves the clip element.
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);

    // Don't preventDefault here — a plain click should still select the clip.
    // The drag itself begins once the cursor moves past the threshold.
}

function onMouseMove(e) {
    if (!activeDrag) return;
    const dx = e.clientX - activeDrag.startX;
    if (!activeDrag.started) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        activeDrag.started = true;

        // Snapshot the project for undo right when the drag actually starts.
        if (typeof localAppServices.captureStateForUndo === 'function') {
            try {
                localAppServices.captureStateForUndo(
                    activeDrag.isAlt
                        ? `Alt-drag duplicate ${activeDrag.clipIds.length} clip(s)`
                        : `Drag move ${activeDrag.clipIds.length} clip(s)`
                );
            } catch (_) { /* best-effort */ }
        }
        document.body.style.cursor = activeDrag.isAlt ? 'copy' : 'grabbing';
    }
    activeDrag.lastX = e.clientX;
    const deltaSeconds = dx / activeDrag.pixelsPerSecond;
    applyDragTransform(deltaSeconds);
}

function onMouseUp(e) {
    if (!activeDrag) return;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    document.body.style.cursor = '';

    if (activeDrag.started) {
        if (activeDrag.isAlt) {
            cleanupPhantomClips();
            // Select the new clones so the user can immediately duplicate them again.
            if (typeof localAppServices.setSelectedClipIds === 'function'
                && activeDrag.phantomClipIds && activeDrag.phantomClipIds.length) {
                try {
                    localAppServices.setSelectedClipIds(activeDrag.phantomClipIds);
                } catch (_) { /* best-effort */ }
            }
            if (typeof localAppServices.showSafeNotification === 'function') {
                localAppServices.showSafeNotification(
                    `Cloned ${activeDrag.clipIds.length} clip(s) (Alt+drag)`,
                    1800
                );
            }
        } else if (typeof localAppServices.showSafeNotification === 'function') {
            const dx = activeDrag.lastX - activeDrag.startX;
            if (Math.abs(dx) >= DRAG_THRESHOLD_PX) {
                const seconds = (dx / activeDrag.pixelsPerSecond).toFixed(2);
                localAppServices.showSafeNotification(
                    `Moved ${activeDrag.clipIds.length} clip(s) by ${seconds}s`,
                    1200
                );
            }
        }
    }

    activeDrag = null;
}

function onKeyDown(e) {
    if (!activeDrag) return;
    // Allow the user to toggle Alt mid-drag to flip into/out of clone mode.
    if (e.key === 'Alt') {
        if (activeDrag && !activeDrag.isAlt) {
            // Switching from move → clone is awkward (the originals have
            // already moved), so we leave the mode as set on mousedown.
        }
    }
    if (e.key === 'Escape' && activeDrag) {
        // Cancel the in-flight drag by reverting any phantom clips.
        if (activeDrag.isAlt && activeDrag.phantomClips && activeDrag.phantomClips.length) {
            activeDrag.phantomClips.forEach(phantom => {
                if (!phantom) return;
                const tracks = (typeof localAppServices.getTracks === 'function')
                    ? localAppServices.getTracks()
                    : [];
                for (const track of tracks) {
                    const idx = (track.timelineClips || []).indexOf(phantom);
                    if (idx >= 0) {
                        track.timelineClips.splice(idx, 1);
                        break;
                    }
                }
            });
            if (typeof localAppServices.renderTimeline === 'function') {
                localAppServices.renderTimeline();
            }
        } else {
            // For a plain drag, revert by re-applying the inverse delta.
            const dx = activeDrag.lastX - activeDrag.startX;
            const inverse = -dx / activeDrag.pixelsPerSecond;
            applyDragTransform(inverse);
        }
        if (typeof localAppServices.showSafeNotification === 'function') {
            localAppServices.showSafeNotification('Drag cancelled', 1200);
        }
        window.removeEventListener('mousemove', onMouseMove, true);
        window.removeEventListener('mouseup', onMouseUp, true);
        document.body.style.cursor = '';
        activeDrag = null;
    }
}

export function initClipDragClone(appServices) {
    localAppServices = appServices || {};
    // Capture-phase listener so we get the mousedown before any
    // selection/click handler that might stop propagation.
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);
    console.log('[ClipDragClone] Initialized — drag clips, Alt+drag to clone-paint');
}

export function getClipDragCloneVersion() {
    return '1.0.0';
}

console.log('[ClipDragClone] Module loaded');

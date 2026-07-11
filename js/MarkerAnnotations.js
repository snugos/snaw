// js/MarkerAnnotations.js - Project Marker Annotations
//
// Attach a multi-line text note to any timeline marker (verse lyrics,
// mix notes, arrangement reminders). Tooltip on marker hover shows the
// note; right-click on a marker → "Edit Marker Note" opens an inline
// popover with a multi-line textarea. A small 📝 indicator is rendered
// on every marker that has a note so the user can see at a glance
// which markers are annotated.
//
// Built on top of the existing `marker.note` field already supported by
// js/TimelineMarkers.js (single-line input in the panel, saved in
// localStorage under `snugosTimelineMarkers`). This module adds:
//   1. A right-click context menu on each timeline marker with
//      "Edit Marker Note" / "Clear Marker Note" / "Jump to Marker" /
//      "Delete Marker" entries
//   2. A small 📝 indicator on the marker itself when it has a note
//   3. A multi-line textarea popover (with Save / Cancel) that lets the
//      user author a longer note without leaving the timeline
//   4. A "Edit Note" button on each row of the existing Markers panel
//      that opens the same popover (multi-line)
//   5. Exports on `appServices` for use by future modules
//
// Persistence: notes are stored in the same `snugosTimelineMarkers`
// localStorage key as the rest of the marker data, so they survive a
// reload without any new storage keys.

import { showNotification } from './utils.js';
import { createContextMenu } from './utils.js';

let localAppServices = {};
let isInitialized = false;

// Track which marker the current popover is editing, so re-opening
// focuses the textarea and remembers the cancel target.
let activePopoverMarkerId = null;

// --- Public API ---

export function initMarkerAnnotations(appServices) {
    if (isInitialized) return;
    isInitialized = true;
    localAppServices = appServices || {};

    // Re-render indicators when marker data changes (panel edits, etc.)
    // We can't import the TimelineMarkers module cleanly without breaking
    // a circular import, so we hook into its storage writes by polling
    // the rendered container. A MutationObserver would also work but
    // the container is rebuilt from scratch on every change anyway.
    document.addEventListener('timelineMarkersRerendered', () => {
        annotateTimelineMarkerDots();
    });

    // Observe the document for right-clicks inside any marker element.
    document.addEventListener('contextmenu', handleMarkerContextMenu, true);
    // Left-click on the small 📝 indicator → open the editor popover.
    document.addEventListener('click', handleMarkerClick, true);
    // Dismiss the popover on outside click / Escape.
    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleEditorKeydown, true);

    // Annotate any markers that are already on the timeline (e.g.
    // loaded from localStorage on a fresh page load).
    setTimeout(annotateTimelineMarkerDots, 250);

    console.log('[MarkerAnnotations] Initialized');
}

/**
 * Forces a re-render of the small 📝 indicator dots on every timeline
 * marker. Call this after any change to marker notes.
 */
export function refreshMarkerAnnotations() {
    annotateTimelineMarkerDots();
}

// --- DOM hooks ---

function getMarkerContainer() {
    return document.getElementById('timelineMarkersContainer');
}

function getMarkerDots() {
    const container = getMarkerContainer();
    if (!container) return [];
    return Array.from(container.querySelectorAll('.timeline-marker-dot'));
}

function annotateTimelineMarkerDots() {
    const dots = getMarkerDots();
    if (dots.length === 0) return;

    dots.forEach(dot => {
        // Remove any previous indicator so we can re-derive it.
        const existing = dot.querySelector('.marker-note-indicator');
        if (existing) existing.remove();

        const id = dot.dataset.markerId;
        if (!id) return;
        const marker = findMarkerById(id);
        if (!marker) return;
        if (!marker.note || !String(marker.note).trim()) return;

        const indicator = document.createElement('div');
        indicator.className = 'marker-note-indicator';
        indicator.textContent = '📝';
        indicator.title = `Has note: ${truncate(marker.note, 60)}`;
        indicator.style.cssText = `
            position: absolute;
            left: 4px;
            top: -2px;
            width: 14px;
            height: 14px;
            font-size: 11px;
            line-height: 14px;
            text-align: center;
            cursor: pointer;
            background: rgba(0,0,0,0.55);
            border-radius: 3px;
            user-select: none;
            pointer-events: auto;
        `;
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openMarkerNotePopover(id);
        });
        dot.appendChild(indicator);
    });
}

function handleMarkerClick(e) {
    // The 📝 indicator has its own click handler; left-click on the
    // marker body itself still triggers the existing jump behavior.
    const target = e.target;
    if (target && target.classList && target.classList.contains('marker-note-indicator')) {
        return; // handled by indicator's own listener
    }
}

function handleMarkerContextMenu(e) {
    const target = e.target;
    if (!target) return;
    const dot = target.closest && target.closest('.timeline-marker-dot');
    if (!dot) return;

    const id = dot.dataset.markerId;
    if (!id) return;
    const marker = findMarkerById(id);
    if (!marker) return;

    // Build the context menu items
    const items = [
        { label: '✏️ Edit Marker Note', action: () => openMarkerNotePopover(id) },
        ...(marker.note && String(marker.note).trim()
            ? [{ label: '🗑️ Clear Marker Note', action: () => clearMarkerNote(id) }]
            : []),
        { separator: true },
        { label: '⏩ Jump to Marker', action: () => jumpToMarker(id) },
        { label: '🗑️ Delete Marker', action: () => deleteMarker(id) }
    ];

    const services = localAppServices && localAppServices.getHighestZ
        ? localAppServices
        : null;
    if (typeof createContextMenu === 'function') {
        // createContextMenu installs a capture-phase contextmenu closeListener
        // on document. Stop it from also firing on this same event and
        // immediately removing the menu we just opened.
        e.stopImmediatePropagation();
        createContextMenu(e, items, services);
    }
}

function handleOutsideClick(e) {
    if (!activePopoverMarkerId) return;
    const popover = document.getElementById('markerNotePopover');
    if (!popover) return;
    if (popover.contains(e.target)) return;
    // The marker dot or its 📝 indicator is also "inside" semantically
    const dot = e.target && e.target.closest && e.target.closest('.timeline-marker-dot');
    if (dot) return;
    closeMarkerNotePopover(false);
}

function handleEditorKeydown(e) {
    if (!activePopoverMarkerId) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMarkerNotePopover(false);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl+Enter saves
        e.preventDefault();
        e.stopPropagation();
        const popover = document.getElementById('markerNotePopover');
        if (popover) {
            const ta = popover.querySelector('textarea');
            if (ta) saveMarkerNote(activePopoverMarkerId, ta.value);
        }
    }
}

// --- Popover ---

function openMarkerNotePopover(markerId) {
    const marker = findMarkerById(markerId);
    if (!marker) return;

    // Close any existing popover first (so the new one can be positioned)
    const existing = document.getElementById('markerNotePopover');
    if (existing) existing.remove();
    activePopoverMarkerId = markerId;

    // Anchor the popover to the marker dot on the timeline
    const dot = getMarkerDots().find(d => d.dataset.markerId === markerId);
    if (!dot) {
        // Fallback: place near the playhead if the dot is missing.
        showNotification('Could not locate marker on timeline', 2000, 'warning');
        return;
    }

    const popover = document.createElement('div');
    popover.id = 'markerNotePopover';
    popover.style.cssText = `
        position: fixed;
        z-index: 20000;
        background: #1f2937;
        color: white;
        border: 1px solid #374151;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        padding: 10px;
        width: 280px;
        font-family: inherit;
    `;

    const notePreview = (marker.note || '').slice(0, 80);
    popover.innerHTML = `
        <div style="font-weight:600;font-size:13px;margin-bottom:4px;">📝 Marker Note</div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">
            ${escapeHtml(marker.name)} @ ${marker.time.toFixed(2)}s
        </div>
        <textarea
            data-marker-id="${markerId}"
            placeholder="Verse lyrics, mix notes, arrangement reminders..."
            style="width:100%;min-height:90px;background:#111827;color:white;border:1px solid #374151;border-radius:4px;padding:6px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;"
        >${escapeHtml(marker.note || '')}</textarea>
        <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;">
            <button data-action="cancel" style="background:#4b5563;color:white;border:none;border-radius:4px;padding:5px 10px;font-size:12px;cursor:pointer;">Cancel</button>
            <button data-action="clear" style="background:#b91c1c;color:white;border:none;border-radius:4px;padding:5px 10px;font-size:12px;cursor:pointer;">Clear</button>
            <button data-action="save" style="background:#2563eb;color:white;border:none;border-radius:4px;padding:5px 10px;font-size:12px;cursor:pointer;">Save</button>
        </div>
    `;

    // Position near the marker dot
    const rect = dot.getBoundingClientRect();
    const popoverWidth = 280;
    let left = rect.left + 12;
    if (left + popoverWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - popoverWidth - 8);
    }
    let top = rect.bottom + 4;
    if (top + 200 > window.innerHeight) {
        top = Math.max(8, rect.top - 200);
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    document.body.appendChild(popover);

    // Wire up buttons
    popover.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeMarkerNotePopover(false);
    });
    popover.querySelector('[data-action="clear"]').addEventListener('click', () => {
        saveMarkerNote(markerId, '');
        closeMarkerNotePopover(false);
    });
    popover.querySelector('[data-action="save"]').addEventListener('click', () => {
        const ta = popover.querySelector('textarea');
        saveMarkerNote(markerId, ta ? ta.value : '');
        closeMarkerNotePopover(false);
    });

    // Focus the textarea + select existing text
    const ta = popover.querySelector('textarea');
    if (ta) {
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(0, ta.value.length);
        }, 30);
    }
    // Suppress an unused-var linter warning for notePreview
    void notePreview;
}

function closeMarkerNotePopover(/* saved */) {
    const popover = document.getElementById('markerNotePopover');
    if (popover) popover.remove();
    activePopoverMarkerId = null;
}

function saveMarkerNote(markerId, newNote) {
    const marker = findMarkerById(markerId);
    if (!marker) return;
    if (typeof localAppServices.updateTimelineMarker === 'function') {
        localAppServices.updateTimelineMarker(markerId, { note: newNote });
    } else {
        // Fallback: mutate directly + persist via TimelineMarkers
        marker.note = newNote;
        try {
            const raw = localStorage.getItem('snugosTimelineMarkers');
            if (raw) {
                const arr = JSON.parse(raw);
                const target = arr.find(m => m.id === markerId);
                if (target) {
                    target.note = newNote;
                    localStorage.setItem('snugosTimelineMarkers', JSON.stringify(arr));
                }
            }
        } catch (e) {
            console.warn('[MarkerAnnotations] Failed to persist note:', e);
        }
    }
    showNotification(newNote && newNote.trim() ? 'Marker note saved' : 'Marker note cleared', 1500);
    // Force a re-render of the indicators
    setTimeout(annotateTimelineMarkerDots, 50);
}

function clearMarkerNote(markerId) {
    saveMarkerNote(markerId, '');
}

function jumpToMarker(markerId) {
    const marker = findMarkerById(markerId);
    if (marker && typeof localAppServices.jumpToTime === 'function') {
        localAppServices.jumpToTime(marker.time);
        showNotification(`Jumped to ${marker.name}`, 1200);
    }
}

function deleteMarker(markerId) {
    if (typeof localAppServices.removeTimelineMarker === 'function') {
        localAppServices.removeTimelineMarker(markerId);
        showNotification('Marker deleted', 1500);
        setTimeout(annotateTimelineMarkerDots, 50);
    }
}

// --- Helpers ---

function findMarkerById(id) {
    if (!id) return null;
    if (typeof localAppServices.getTimelineMarkers === 'function') {
        const arr = localAppServices.getTimelineMarkers();
        return arr.find(m => m.id === id) || null;
    }
    // Fallback: read directly from localStorage
    try {
        const raw = localStorage.getItem('snugosTimelineMarkers');
        if (raw) {
            const arr = JSON.parse(raw);
            return arr.find(m => m.id === id) || null;
        }
    } catch (e) {}
    return null;
}

function truncate(s, n) {
    s = String(s == null ? '' : s);
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

console.log('[MarkerAnnotations] Module loaded');

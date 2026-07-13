// js/TrackNotesSidebar.js - Per-Track Quick-Access Notes Sidebar (v0.4.10)
// A small 📝 button on every track-strip header that opens a popover
// with a plain-text textarea anchored to the track. Auto-saves as
// you type, Esc/click-outside closes. Storage is deliberately separate
// from js/TrackNotes.js (which is the global "Track Notes" panel from
// the start menu) so the two features don't fight each other.
//
// Pattern follows the established module style:
//   - IIFE
//   - init(appServices) wiring
//   - exports on window for the render-side helper
//   - syncState in localStorage keyed by trackId

(function() {
    'use strict';

    const STORAGE_KEY = 'snaw_track_sidebar_notes_v1';
    const POPOVER_CLASS = 'track-notes-sidebar-popover';
    const BUTTON_CLASS = 'track-notes-sidebar-btn';
    const ACTIVE_CLASS = 'track-notes-sidebar-btn--active';
    const MAX_LEN = 4000;
    const SAVE_DEBOUNCE_MS = 250;
    const POPOVER_WIDTH = 240;
    const POPOVER_MAX_HEIGHT = 220;

    // Per-track notes keyed by trackId. Kept in memory for fast access
    // and persisted to localStorage on every meaningful change.
    const notes = new Map();
    let appServices = null;
    let saveTimer = null;
    let activePopover = null; // { trackId, el, textarea, outsideHandler, escHandler }

    // ---- persistence ----

    function persist() {
        try {
            const out = {};
            notes.forEach((v, k) => { out[k] = v; });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
        } catch (e) {
            console.warn('[TrackNotesSidebar] persist failed:', e);
        }
    }

    function hydrate() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                Object.keys(parsed).forEach(k => {
                    const v = parsed[k];
                    if (typeof v === 'string' && v.length > 0) notes.set(k, v);
                });
            }
        } catch (e) {
            console.warn('[TrackNotesSidebar] hydrate failed:', e);
        }
    }

    function clamp(s) {
        if (typeof s !== 'string') return '';
        if (s.length > MAX_LEN) {
            console.warn(`[TrackNotesSidebar] truncated to ${MAX_LEN} chars`);
            return s.slice(0, MAX_LEN);
        }
        return s;
    }

    // ---- public API ----

    function getNote(trackId) {
        if (trackId == null) return '';
        return notes.get(String(trackId)) || '';
    }

    function setNote(trackId, text) {
        if (trackId == null) return;
        const key = String(trackId);
        const clean = clamp(text || '');
        if (clean.length === 0) {
            notes.delete(key);
        } else {
            notes.set(key, clean);
        }
        // Debounce writes — typing in a textarea fires every keystroke.
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS);
    }

    function clearNote(trackId) {
        if (trackId == null) return;
        notes.delete(String(trackId));
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        persist();
        refreshButtonState(trackId);
    }

    function hasNote(trackId) {
        if (trackId == null) return false;
        const v = notes.get(String(trackId));
        return typeof v === 'string' && v.length > 0;
    }

    // ---- DOM rendering ----

    // Returns the small 📝 button HTML injected into the track-strip
    // header. Rendered as a discrete icon-only button that fits next
    // to M/S/R/B. Active state uses a filled background to signal
    // "this track has a note".
    function getSidebarButtonHTML(track) {
        if (!track || track.id == null) return '';
        const id = String(track.id);
        const isActive = hasNote(id);
        const cls = isActive
            ? `${BUTTON_CLASS} ${ACTIVE_CLASS}`
            : BUTTON_CLASS;
        const title = isActive
            ? 'Edit track note (has saved note)'
            : 'Add a quick track note';
        return `<button type="button" class="${cls}" data-track-id="${id}" title="${title}" aria-label="Track note">📝</button>`;
    }

    // Called after every state change that could affect whether a
    // track has a note (save/clear) and after every track-strip
    // re-render. Cheaper than patching renderTrackStrip because we
    // just refresh the class on existing buttons.
    function refreshButtonState(trackId) {
        if (trackId == null) return;
        const id = String(trackId);
        const buttons = document.querySelectorAll(`.${BUTTON_CLASS}[data-track-id="${id}"]`);
        if (buttons.length === 0) return;
        const isActive = hasNote(id);
        const title = isActive
            ? 'Edit track note (has saved note)'
            : 'Add a quick track note';
        buttons.forEach(btn => {
            if (isActive) {
                btn.classList.add(ACTIVE_CLASS);
            } else {
                btn.classList.remove(ACTIVE_CLASS);
            }
            btn.title = title;
        });
    }

    // Re-paint the 📝 button on every track-strip to reflect current
    // note state. Used as a fallback when we don't have a clean
    // re-render hook for the strip.
    function refreshAllButtons() {
        const buttons = document.querySelectorAll(`.${BUTTON_CLASS}`);
        buttons.forEach(btn => {
            const id = btn.getAttribute('data-track-id');
            if (!id) return;
            const isActive = hasNote(id);
            if (isActive) {
                btn.classList.add(ACTIVE_CLASS);
            } else {
                btn.classList.remove(ACTIVE_CLASS);
            }
            btn.title = isActive
                ? 'Edit track note (has saved note)'
                : 'Add a quick track note';
        });
    }

    // ---- popover ----

    function closePopover() {
        if (!activePopover) return;
        const { el, outsideHandler, escHandler, trackId } = activePopover;
        if (outsideHandler) document.removeEventListener('mousedown', outsideHandler, true);
        if (escHandler) document.removeEventListener('keydown', escHandler, true);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        activePopover = null;
        // Re-paint the button in case the note was cleared.
        refreshButtonState(trackId);
    }

    function openPopover(trackId, anchorBtn) {
        if (trackId == null) return;
        // Only one popover at a time.
        if (activePopover) closePopover();

        const id = String(trackId);
        const track = (appServices && appServices.getTrackById)
            ? appServices.getTrackById(trackId)
            : null;
        const trackName = (track && track.name) ? track.name : `Track ${id}`;
        const initial = getNote(id);

        // Find the track-strip element to anchor against (gives us
        // a stable position even if the user scrolls within the
        // mixer).
        const strip = anchorBtn.closest('.track-strip') || anchorBtn.parentElement;
        const stripRect = strip ? strip.getBoundingClientRect() : null;

        const popover = document.createElement('div');
        popover.className = `${POPOVER_CLASS} fixed z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 flex flex-col gap-1`;
        popover.style.width = POPOVER_WIDTH + 'px';
        popover.style.maxHeight = POPOVER_MAX_HEIGHT + 'px';
        if (stripRect) {
            // Position to the right of the strip, aligned to its top.
            popover.style.left = Math.round(stripRect.right + 6) + 'px';
            popover.style.top = Math.round(stripRect.top + 4) + 'px';
        } else {
            // Fallback: anchor to the button itself.
            const r = anchorBtn.getBoundingClientRect();
            popover.style.left = Math.round(r.right + 6) + 'px';
            popover.style.top = Math.round(r.top) + 'px';
        }
        popover.setAttribute('data-track-id', id);

        // Header row
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-2 text-[11px] text-gray-300';
        const title = document.createElement('span');
        title.className = 'truncate font-medium';
        title.textContent = `📝 ${trackName}`;
        title.title = trackName;
        const counter = document.createElement('span');
        counter.className = 'text-gray-500 font-mono text-[10px]';
        counter.textContent = `${initial.length}/${MAX_LEN}`;
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'text-[10px] text-red-300 hover:text-red-200 px-1';
        clearBtn.textContent = 'Clear';
        clearBtn.title = 'Delete this note';
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearNote(id);
            textarea.value = '';
            counter.textContent = `0/${MAX_LEN}`;
            closePopover();
        });
        header.appendChild(title);
        header.appendChild(counter);
        header.appendChild(clearBtn);

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'w-full flex-1 bg-gray-800 text-gray-100 text-[12px] leading-snug rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none p-1.5';
        textarea.style.minHeight = '110px';
        textarea.placeholder = 'Lyrics, mix notes, performance cues…';
        textarea.value = initial;
        textarea.maxLength = MAX_LEN;
        textarea.addEventListener('input', () => {
            const v = clamp(textarea.value);
            setNote(id, v);
            counter.textContent = `${v.length}/${MAX_LEN}`;
            // Update button visual hint live.
            refreshButtonState(id);
        });
        // Stop Esc/click-outside logic from stealing focus/keys
        // while the user is typing in the popover.
        textarea.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        textarea.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // Footer hint
        const footer = document.createElement('div');
        footer.className = 'text-[10px] text-gray-500 flex justify-between';
        const left = document.createElement('span');
        left.textContent = 'Auto-saves · Esc to close';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'text-gray-400 hover:text-white';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closePopover();
        });
        footer.appendChild(left);
        footer.appendChild(closeBtn);

        popover.appendChild(header);
        popover.appendChild(textarea);
        popover.appendChild(footer);
        document.body.appendChild(popover);

        // Outside click closes the popover.
        const outsideHandler = (e) => {
            if (!popover.contains(e.target)) {
                // Don't close if the click was on the same button
                // that opened the popover — that's a no-op toggle.
                if (e.target === anchorBtn || anchorBtn.contains(e.target)) return;
                closePopover();
            }
        };
        // Esc closes the popover.
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closePopover();
            }
        };
        // Use capture so we beat the rest of the document handlers.
        setTimeout(() => {
            document.addEventListener('mousedown', outsideHandler, true);
            document.addEventListener('keydown', escHandler, true);
        }, 0);

        activePopover = { trackId: id, el: popover, textarea, outsideHandler, escHandler };
        // Focus the textarea for immediate typing.
        setTimeout(() => {
            try { textarea.focus(); textarea.setSelectionRange(textarea.value.length, textarea.value.length); } catch (_) {}
        }, 10);
    }

    // ---- click delegation ----

    function onDocumentClick(e) {
        const target = e.target;
        if (!target || !target.closest) return;
        const btn = target.closest(`.${BUTTON_CLASS}`);
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const trackId = btn.getAttribute('data-track-id');
        if (!trackId) return;
        // Toggle: if the same button opened the popover, close it.
        if (activePopover && activePopover.trackId === String(trackId)) {
            closePopover();
            return;
        }
        openPopover(trackId, btn);
    }

    // ---- init ----

    function init(services) {
        appServices = services || {};
        hydrate();

        // Document-level click delegation. Cheap and survives
        // track-strip re-renders.
        document.addEventListener('click', onDocumentClick, true);

        // Expose HTML helper + accessors on window for the
        // track-strip renderer and any future right-click wiring.
        if (typeof window !== 'undefined') {
            window.getTrackNotesSidebarButtonHTML = getSidebarButtonHTML;
            window.trackNotesSidebar = {
                get: getNote,
                set: setNote,
                clear: clearNote,
                has: hasNote,
                refresh: refreshAllButtons,
                closePopover,
                getVersion: () => '0.4.10'
            };
        }

        // Refresh any pre-rendered buttons (in case the strip
        // renders before this module loads — e.g. cached state).
        setTimeout(refreshAllButtons, 0);

        console.log(`[TrackNotesSidebar] Initialized (${notes.size} saved note(s))`);
    }

    if (typeof window !== 'undefined') {
        window.initTrackNotesSidebar = init;
    }

    console.log('[TrackNotesSidebar] Module loaded');
})();

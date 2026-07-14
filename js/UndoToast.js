// js/UndoToast.js - Smart Undo/Redo Action Toast (v0.4.11)
// Intercepts the existing "Undoing: X..." / "Redoing: X..." notifications
// emitted by state.js and re-renders them as a styled floating toast with
// a clear arrow glyph (↶ for undo, ↷ for redo) and the action name in
// a single line. Falls back to the original showNotification for
// unrelated messages so no existing UX is disturbed.
//
// Pattern follows the established module style:
//   - named ESM exports (plus window.* mirrors for legacy loaders)
//   - init(appServices) wiring
//   - small, self-contained CSS (added to style.css)

'use strict';

    const VERSION = 'v0.4.11';
    const TOAST_ID = 'undo-toast';
    const TOAST_DURATION_MS = 1800;
    const FADE_OUT_MS = 250;
    const UNDO_PREFIX = 'Undoing:';
    const REDO_PREFIX = 'Redoing:';
    const ARROW_UNDO = '\u21B6';   // ↶
    const ARROW_REDO = '\u21B7';   // ↷

    let appServices = null;
    let originalShowNotification = null;
    let hideTimer = null;
    let fadeTimer = null;

    // ---- DOM ----

    function ensureToastEl() {
        let el = document.getElementById(TOAST_ID);
        if (el) return el;
        el = document.createElement('div');
        el.id = TOAST_ID;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('data-direction', 'undo');
        el.innerHTML =
            '<span class="undo-toast__arrow" aria-hidden="true">\u21B6</span>' +
            '<span class="undo-toast__word">Undid:</span>' +
            '<span class="undo-toast__label">\u2014</span>';
        document.body.appendChild(el);
        return el;
    }

    function setToastContent(direction, actionName) {
        const el = ensureToastEl();
        el.setAttribute('data-direction', direction === 'redo' ? 'redo' : 'undo');
        const arrow = direction === 'redo' ? ARROW_REDO : ARROW_UNDO;
        const word = direction === 'redo' ? 'Redid:' : 'Undid:';
        const label = (actionName && String(actionName).trim()) || 'last action';
        const arrowEl = el.querySelector('.undo-toast__arrow');
        const wordEl = el.querySelector('.undo-toast__word');
        const labelEl = el.querySelector('.undo-toast__label');
        if (arrowEl) arrowEl.textContent = arrow;
        if (wordEl) wordEl.textContent = word;
        if (labelEl) labelEl.textContent = label;
    }

    function showToast(direction, actionName) {
        if (!appServices) return;
        setToastContent(direction, actionName);
        const el = ensureToastEl();
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
        el.classList.remove('show');
        // Force reflow so the CSS transition fires reliably
        void el.offsetWidth;
        el.classList.add('show');
        hideTimer = setTimeout(() => {
            el.classList.remove('show');
            fadeTimer = setTimeout(() => {
                el.classList.remove('show');
            }, FADE_OUT_MS);
        }, TOAST_DURATION_MS);
    }

    // ---- parsing ----

    function parseUndoOrRedo(message) {
        if (typeof message !== 'string') return null;
        const m = message.trim();
        if (m.startsWith(UNDO_PREFIX)) {
            const rest = m.slice(UNDO_PREFIX.length).replace(/\.+$/, '').trim();
            return { direction: 'undo', actionName: rest || 'last action' };
        }
        if (m.startsWith(REDO_PREFIX)) {
            const rest = m.slice(REDO_PREFIX.length).replace(/\.+$/, '').trim();
            return { direction: 'redo', actionName: rest || 'last action' };
        }
        return null;
    }

    function wrappedShowNotification(message, duration) {
        const parsed = parseUndoOrRedo(message);
        if (parsed) {
            // Show our toast and skip the original text-based notification.
            showToast(parsed.direction, parsed.actionName);
            return;
        }
        // Unrelated notification: pass through to the original.
        if (typeof originalShowNotification === 'function') {
            return originalShowNotification(message, duration);
        }
        // No original captured (shouldn't happen, but be safe). Fall back to
        // window-bound utils.showNotification if appServices isn't ready.
        const target = appServices &&
            (appServices.showNotification || (typeof window !== 'undefined' && window.showNotification));
        if (typeof target === 'function') {
            return target(message, duration);
        }
        // Last resort: log.
        try { console.log('[UndoToast]', message); } catch (_) { /* ignore */ }
    }

    // ---- public API ----

    function initUndoToast(services) {
        if (services) appServices = services;
        // Capture and wrap the existing showNotification on appServices.
        if (appServices && typeof appServices.showNotification === 'function') {
            // Avoid double-wrapping if init runs twice.
            if (appServices.showNotification.__undoToastWrapped) {
                return true;
            }
            originalShowNotification = appServices.showNotification;
            const wrapped = function(msg, dur) {
                return wrappedShowNotification(msg, dur);
            };
            wrapped.__undoToastWrapped = true;
            appServices.showNotification = wrapped;
        }
        // Pre-create the DOM element so the first toast has no FOUC.
        ensureToastEl();
        return true;
    }

    function fireUndoToast(actionName) {
        showToast('undo', actionName || 'last action');
    }

    function fireRedoToast(actionName) {
        showToast('redo', actionName || 'last action');
    }

    function getUndoToastVersion() {
        return VERSION;
    }

    // Exports
    if (typeof window !== 'undefined') {
        window.initUndoToast = initUndoToast;
        window.fireUndoToast = fireUndoToast;
        window.fireRedoToast = fireRedoToast;
        window.getUndoToastVersion = getUndoToastVersion;
    }

    // Named ESM exports so `import { initUndoToast, ... }` from main.js resolves.
    // Original IIFE only hung these off window, which silently broke the
    // v0.4.11 module-style import.
    export { initUndoToast, fireUndoToast, fireRedoToast, getUndoToastVersion };

// js/ToolbarTooltips.js - Custom hover tooltips for toolbar/statusbar/taskbar buttons
//
// Replaces the slow, ugly native browser `title` tooltip with a snappy, two-line
// custom tooltip on every element in #globalControlsBar, #taskbar, and #statusBar
// that has a `title="…"` attribute. Parses the title text into:
//   - description (the body of the title)
//   - shortcut (the trailing parenthesized text, e.g. "(Spacebar)" or "(Ctrl+Shift+P)")
// and renders them as separate lines so the shortcut is visually distinct.
//
// Features:
//   - On/off toggle via Start menu entry "Toolbar Tooltips" (default: ON)
//   - Per-button enable/disable via the Start menu (turns off individual button
//     tooltips while keeping the rest active)
//   - Persists state in localStorage
//   - Suppresses the native browser tooltip (removes the `title` attribute on
//     first hover and re-attaches on mouseleave) so users only see one popup
//   - Adjusts position to stay on screen near the cursor
//   - 200ms hover delay before showing (snappier than the browser default ~500ms)

const TOOLBAR_TOOLTIPS_VERSION = '0.1.0';
const STORAGE_KEY_ENABLED = 'snugosToolbarTooltipsEnabled';
const STORAGE_KEY_DISABLED = 'snugosToolbarTooltipsDisabledButtons';

const HOVER_DELAY_MS = 200;             // Show tooltip 200ms after mouseenter
const TOOLTIP_OFFSET_PX = 14;            // Distance from cursor
const EDGE_PADDING_PX = 8;               // Min distance from viewport edge
const TOOLTIP_MAX_WIDTH_PX = 280;

let _enabled = true;
let _disabledButtons = new Set();        // Button IDs that have been turned off
let _tooltipEl = null;
let _currentTarget = null;
let _showTimer = null;
let _lastMouseX = 0;
let _lastMouseY = 0;
let _attached = false;

function _loadFromStorage() {
    try {
        if (typeof localStorage === 'undefined') return;
        const e = localStorage.getItem(STORAGE_KEY_ENABLED);
        if (e === '0' || e === 'false') _enabled = false;
        const d = localStorage.getItem(STORAGE_KEY_DISABLED);
        if (d) {
            const arr = JSON.parse(d);
            if (Array.isArray(arr)) _disabledButtons = new Set(arr.filter(x => typeof x === 'string'));
        }
    } catch (_) { /* ignore */ }
}

function _persistEnabled() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_ENABLED, _enabled ? '1' : '0'); } catch (_) {}
}

function _persistDisabled() {
    try {
        if (typeof localStorage === 'undefined') return;
        if (_disabledButtons.size === 0) localStorage.removeItem(STORAGE_KEY_DISABLED);
        else localStorage.setItem(STORAGE_KEY_DISABLED, JSON.stringify(Array.from(_disabledButtons)));
    } catch (_) {}
}

// Parse a title like "MIDI Panic: Stop all audio and send All-Notes-Off on all MIDI channels (Ctrl+Shift+P)"
// into { description, shortcut }. The shortcut is the LAST parenthesized group if and only if it
// looks like a key combo (contains + or is a single word like "Spacebar", "M", "L", "T", "Tab", "Esc", etc.).
function _parseTitle(title) {
    if (!title) return { description: '', shortcut: '' };
    // Match a trailing (...) at end of string
    const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m && _looksLikeShortcut(m[2])) {
        return { description: m[1].trim(), shortcut: m[2].trim() };
    }
    return { description: title.trim(), shortcut: '' };
}

function _looksLikeShortcut(s) {
    if (!s) return false;
    // Common shortcut tokens: Ctrl, Shift, Alt, Meta, Cmd, plus single keys (a-z, 0-9, Space, Spacebar, Tab, Esc, Enter, ArrowUp, etc.)
    if (/\b(Ctrl|Shift|Alt|Meta|Cmd|Option|Command)\b/i.test(s)) return true;
    if (/[+=]/.test(s)) return true;
    if (/^(Space|Spacebar|Tab|Esc|Escape|Enter|Return|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown|F1-\w*|Insert)$/i.test(s)) return true;
    if (/^Arrow(Up|Down|Left|Right)$/i.test(s)) return true;
    // Single key like "M", "L", "T", "?", "Spacebar"
    if (/^[A-Z?]$/i.test(s)) return true;
    return false;
}

function _ensureTooltipElement() {
    if (typeof document === 'undefined' || !document || !document.body || !document.createElement) return null;
    if (_tooltipEl && document.body.contains(_tooltipEl)) return _tooltipEl;
    const el = document.createElement('div');
    el.id = 'snugosToolbarTooltip';
    el.setAttribute('role', 'tooltip');
    el.style.cssText = [
        'position: fixed',
        'z-index: 1000000',
        'display: none',
        'pointer-events: none',
        'max-width: ' + TOOLTIP_MAX_WIDTH_PX + 'px',
        'padding: 6px 10px',
        'background: rgba(20, 20, 20, 0.96)',
        'color: #e8e8e8',
        'border: 1px solid #3a3a3a',
        'border-radius: 4px',
        'box-shadow: 0 4px 12px rgba(0,0,0,0.5)',
        'font-family: Inter, system-ui, sans-serif',
        'font-size: 12px',
        'line-height: 1.35',
        'white-space: normal',
        'word-wrap: break-word',
        'user-select: none',
        '-webkit-user-select: none'
    ].join(';');
    document.body.appendChild(el);
    _tooltipEl = el;
    return el;
}

function _showTooltip(target) {
    if (!_enabled) return;
    if (!target) return;
    const buttonId = target.id || '';
    if (buttonId && _disabledButtons.has(buttonId)) return;

    const rawTitle = target.getAttribute('data-tt-original-title') || target.getAttribute('title') || '';
    if (!rawTitle) return;
    const { description, shortcut } = _parseTitle(rawTitle);

    const el = _ensureTooltipElement();
    el.innerHTML = '';
    if (description) {
        const desc = document.createElement('div');
        desc.className = 'tt-desc';
        desc.textContent = description;
        desc.style.cssText = 'color: #e8e8e8; font-weight: 500;';
        el.appendChild(desc);
    }
    if (shortcut) {
        const sc = document.createElement('div');
        sc.className = 'tt-sc';
        sc.textContent = shortcut;
        sc.style.cssText = 'margin-top: 3px; color: #ffaa44; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.02em;';
        el.appendChild(sc);
    }

    el.style.display = 'block';
    el.style.visibility = 'hidden';
    // Position next to the cursor
    const raf = (typeof requestAnimationFrame === 'function')
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 16);
    raf(() => {
        if (el.style.display === 'none') return; // may have been hidden already
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = _lastMouseX + TOOLTIP_OFFSET_PX;
        let y = _lastMouseY + TOOLTIP_OFFSET_PX;
        // Flip horizontally if it would overflow right
        if (x + rect.width + EDGE_PADDING_PX > vw) {
            x = Math.max(EDGE_PADDING_PX, _lastMouseX - TOOLTIP_OFFSET_PX - rect.width);
        }
        // Flip vertically if it would overflow bottom
        if (y + rect.height + EDGE_PADDING_PX > vh) {
            y = Math.max(EDGE_PADDING_PX, _lastMouseY - TOOLTIP_OFFSET_PX - rect.height);
        }
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.visibility = 'visible';
    });
}

function _hideTooltip() {
    if (_showTimer) { clearTimeout(_showTimer); _showTimer = null; }
    if (_tooltipEl) _tooltipEl.style.display = 'none';
    _currentTarget = null;
}

function _onMouseEnter(e) {
    if (!_enabled) return;
    const target = e.currentTarget;
    if (!target) return;
    // Suppress native browser tooltip: stash the original title, then remove it.
    if (target.hasAttribute('title')) {
        const original = target.getAttribute('title');
        target.setAttribute('data-tt-original-title', original);
        target.removeAttribute('title');
    }
    _currentTarget = target;
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
    if (_showTimer) clearTimeout(_showTimer);
    _showTimer = setTimeout(() => { _showTooltip(_currentTarget); }, HOVER_DELAY_MS);
}

function _onMouseMove(e) {
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
    if (_tooltipEl && _tooltipEl.style.display === 'block') {
        // Reposition on the fly
        const rect = _tooltipEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = _lastMouseX + TOOLTIP_OFFSET_PX;
        let y = _lastMouseY + TOOLTIP_OFFSET_PX;
        if (x + rect.width + EDGE_PADDING_PX > vw) {
            x = Math.max(EDGE_PADDING_PX, _lastMouseX - TOOLTIP_OFFSET_PX - rect.width);
        }
        if (y + rect.height + EDGE_PADDING_PX > vh) {
            y = Math.max(EDGE_PADDING_PX, _lastMouseY - TOOLTIP_OFFSET_PX - rect.height);
        }
        _tooltipEl.style.left = x + 'px';
        _tooltipEl.style.top = y + 'px';
    }
}

function _onMouseLeave(e) {
    if (_showTimer) { clearTimeout(_showTimer); _showTimer = null; }
    _hideTooltip();
    // Restore the original title so the native tooltip is available again
    // (e.g. if a user turns the custom tooltips off later)
    const target = e.currentTarget;
    if (target && target.hasAttribute('data-tt-original-title') && !target.hasAttribute('title')) {
        target.setAttribute('title', target.getAttribute('data-tt-original-title'));
    }
}

function _selectToolbarButtons() {
    // In Node / non-DOM contexts (smoke tests, SSR), document may be undefined — bail out
    // safely so the module still loads and exports work.
    if (typeof document === 'undefined' || !document || !document.querySelectorAll) return [];
    // Only the top transport bar, the taskbar (Start button, window buttons, BPM display),
    // and the bottom status bar get tooltips. We intentionally do NOT touch track-lane
    // buttons or in-window controls (those are too small/dense to benefit from a custom
    // tooltip and may have title="..." they use for accessibility).
    const selector = [
        '#globalControlsBar [title]',
        '#taskbar [title]',
        '#statusBar [title]',
        '#startMenu [title]'
    ].join(', ');
    return Array.from(document.querySelectorAll(selector)).filter(el => {
        // Skip elements that aren't actually focusable/hoverable (e.g. <title> in <head>)
        if (!(el instanceof HTMLElement)) return false;
        // Only buttons, inputs, spans, and divs styled as buttons (start menu items)
        const tag = el.tagName;
        return tag === 'BUTTON' || tag === 'INPUT' || tag === 'SPAN' || tag === 'DIV' || tag === 'LI';
    });
}

function _attach() {
    if (_attached) return;
    const buttons = _selectToolbarButtons();
    for (const el of buttons) {
        el.addEventListener('mouseenter', _onMouseEnter);
        el.addEventListener('mousemove', _onMouseMove);
        el.addEventListener('mouseleave', _onMouseLeave);
    }
    _attached = true;
}

function _detach() {
    if (!_attached) return;
    const buttons = _selectToolbarButtons();
    for (const el of buttons) {
        el.removeEventListener('mouseenter', _onMouseEnter);
        el.removeEventListener('mousemove', _onMouseMove);
        el.removeEventListener('mouseleave', _onMouseLeave);
    }
    _hideTooltip();
    _attached = false;
}

// Public API

export function initToolbarTooltips(services) {
    _loadFromStorage();
    if (_enabled) _attach();
    console.log(`[ToolbarTooltips] Initialized (enabled=${_enabled}, version=${TOOLBAR_TOOLTIPS_VERSION})`);
}

export function getToolbarTooltipsVersion() {
    return TOOLBAR_TOOLTIPS_VERSION;
}

export function isToolbarTooltipsEnabled() {
    return _enabled;
}

export function setToolbarTooltipsEnabled(enabled) {
    const next = !!enabled;
    if (next === _enabled) return;
    _enabled = next;
    _persistEnabled();
    if (_enabled) _attach();
    else { _detach(); }
}

export function toggleToolbarTooltips() {
    setToolbarTooltipsEnabled(!_enabled);
    return _enabled;
}

export function isToolbarTooltipDisabledForButton(buttonId) {
    return _disabledButtons.has(buttonId);
}

export function setToolbarTooltipDisabledForButton(buttonId, disabled) {
    if (!buttonId) return;
    const had = _disabledButtons.has(buttonId);
    if (disabled && !had) {
        _disabledButtons.add(buttonId);
        _persistDisabled();
    } else if (!disabled && had) {
        _disabledButtons.delete(buttonId);
        _persistDisabled();
    }
}

export function getToolbarTooltipsDisabledButtons() {
    return Array.from(_disabledButtons);
}

export function clearAllDisabledToolbarTooltips() {
    if (_disabledButtons.size === 0) return;
    _disabledButtons.clear();
    _persistDisabled();
}

// Re-scan the DOM for new buttons (e.g. after a window opens and adds a taskbar button)
export function refreshToolbarTooltipTargets() {
    if (!_enabled) return;
    if (_attached) _detach();
    _attach();
}

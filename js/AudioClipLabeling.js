// js/AudioClipLabeling.js - Freeform text label on audio clips
// Adds a separate `label` field on every clip (audio + midi + sampler) that is
// independent of the clip's `name`. Labels are useful for content cues like
// "lead-in", "verse 1 chorus", "fill", "bar 32 — drop", etc.
//
// - A small label badge appears on the top-left of any clip with a non-empty label.
// - Right-click a clip → "Edit Label…" to set / change / clear its label.
// - Press `L` with one or more clips selected to bulk-label them.
// - The Tools → Audio Clip Labels panel lists every labeled clip for quick editing.

let localAppServices = {};
const LABEL_PANEL_ID = 'audioClipLabelingPanel';
const LABEL_BADGE_CLASS = 'snaw-clip-label-badge';
const LABEL_CONTEXT_ID = 'snaw-clip-label-menu';

function getTracks() {
    try { return localAppServices.getTracks ? (localAppServices.getTracks() || []) : []; }
    catch (e) { console.warn('[AudioClipLabeling] getTracks failed:', e); return []; }
}

function findClip(clipId) {
    if (clipId == null) return null;
    const tracks = getTracks();
    for (const track of tracks) {
        const clips = track.timelineClips || [];
        const clip = clips.find(c => c && c.id === clipId);
        if (clip) return { track, clip };
    }
    return null;
}

/**
 * Update the label on a clip. `label` is trimmed; an empty/whitespace string
 * is treated as "clear the label".
 */
export function setClipLabel(clipId, label) {
    const found = findClip(clipId);
    if (!found) {
        console.warn('[AudioClipLabeling] setClipLabel: clip not found:', clipId);
        return false;
    }
    const { clip } = found;
    const previous = typeof clip.label === 'string' ? clip.label : '';
    const next = (label == null ? '' : String(label)).trim();
    if (previous === next) return true;
    if (localAppServices.captureStateForUndo) {
        try { localAppServices.captureStateForUndo(`Set clip label to "${next}"`); }
        catch (e) { console.warn('[AudioClipLabeling] captureStateForUndo failed:', e); }
    }
    clip.label = next;
    if (localAppServices.renderTimeline) {
        try { localAppServices.renderTimeline(); }
        catch (e) { console.warn('[AudioClipLabeling] renderTimeline failed:', e); }
    }
    refreshPanelIfOpen();
    if (localAppServices.showNotification) {
        try {
            const msg = next ? `Label set to "${next}"` : 'Label cleared';
            localAppServices.showNotification(msg, 1500);
        } catch (e) { /* ignore */ }
    }
    return true;
}

/**
 * Bulk-set the same label on every clipId in the list.
 */
export function setClipLabelsBulk(clipIds, label) {
    if (!Array.isArray(clipIds) || clipIds.length === 0) return 0;
    let count = 0;
    const next = (label == null ? '' : String(label)).trim();
    const previous = [];
    for (const id of clipIds) {
        const found = findClip(id);
        if (!found) continue;
        previous.push({ clip: found.clip, value: typeof found.clip.label === 'string' ? found.clip.label : '' });
        found.clip.label = next;
        count++;
    }
    if (count === 0) return 0;
    if (localAppServices.captureStateForUndo) {
        try { localAppServices.captureStateForUndo(`Set ${count} clip label${count === 1 ? '' : 's'} to "${next}"`); }
        catch (e) { console.warn('[AudioClipLabeling] captureStateForUndo failed:', e); }
    }
    if (localAppServices.renderTimeline) {
        try { localAppServices.renderTimeline(); }
        catch (e) { console.warn('[AudioClipLabeling] renderTimeline failed:', e); }
    }
    refreshPanelIfOpen();
    if (localAppServices.showNotification) {
        try {
            localAppServices.showNotification(
                next ? `Labeled ${count} clip${count === 1 ? '' : 's'} "${next}"`
                     : `Cleared ${count} label${count === 1 ? '' : 's'}`,
                1500
            );
        } catch (e) { /* ignore */ }
    }
    return count;
}

/**
 * Iterate every clip across every track; yields { track, clip }.
 */
function* iterAllClips() {
    for (const track of getTracks()) {
        for (const clip of (track.timelineClips || [])) {
            if (!clip) continue;
            yield { track, clip };
        }
    }
}

/**
 * Get every clip with a non-empty label, sorted by track order then startTime.
 */
export function getLabeledClips() {
    const out = [];
    for (const { track, clip } of iterAllClips()) {
        const label = typeof clip.label === 'string' ? clip.label.trim() : '';
        if (label) {
            out.push({
                clipId: clip.id,
                trackId: track.id,
                trackName: track.name || 'Track',
                clipName: clip.name || 'Unnamed clip',
                startTime: Number(clip.startTime) || 0,
                duration: Number(clip.duration) || 0,
                label,
            });
        }
    }
    out.sort((a, b) => {
        if (a.trackId !== b.trackId) return a.trackId - b.trackId;
        return a.startTime - b.startTime;
    });
    return out;
}

/**
 * Get the current label (or '' if none) for a clip.
 */
export function getClipLabel(clipId) {
    const found = findClip(clipId);
    if (!found) return '';
    const v = found.clip.label;
    return typeof v === 'string' ? v : '';
}

/**
 * Build the HTML for the management panel.
 */
function buildPanelHTML() {
    const labeled = getLabeledClips();
    const items = labeled.length
        ? labeled.map(item => `
            <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-700/50 border border-zinc-700"
                 data-row-clip-id="${escapeAttr(item.clipId)}">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-zinc-100 truncate">${escapeHtml(item.label)}</div>
                    <div class="text-xs text-zinc-400 truncate">${escapeHtml(item.trackName)} · ${escapeHtml(item.clipName)}</div>
                </div>
                <button class="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
                        data-action="edit" data-clip-id="${escapeAttr(item.clipId)}">Edit</button>
                <button class="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
                        data-action="clear" data-clip-id="${escapeAttr(item.clipId)}">Clear</button>
            </div>
        `).join('')
        : '<div class="text-sm text-zinc-400 px-2 py-3 text-center">No labeled clips yet. Right-click a clip → "Edit Label…" or select clips and press L.</div>';

    return `
        <div class="p-3 text-zinc-100">
            <div class="flex items-center gap-2 mb-3">
                <input type="text" id="aclFilter" placeholder="Filter by label / track / clip…"
                       class="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500">
                <button id="aclRefresh" class="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100">Refresh</button>
            </div>
            <div id="aclList" class="space-y-1 max-h-96 overflow-y-auto">${items}</div>
            <div class="mt-3 text-xs text-zinc-500 leading-relaxed">
                <div><b>Tip:</b> Right-click a clip → "Edit Label…", or select clips and press <kbd class="px-1 py-0.5 bg-zinc-700 rounded">L</kbd>.</div>
                <div>Labels are saved with the project and shown as a small badge on the clip.</div>
            </div>
        </div>
    `;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

function attachPanelHandlers(panelEl) {
    const filter = panelEl.querySelector('#aclFilter');
    if (filter) {
        filter.addEventListener('input', () => {
            const q = filter.value.trim().toLowerCase();
            const rows = panelEl.querySelectorAll('[data-row-clip-id]');
            rows.forEach(row => {
                if (!q) { row.style.display = ''; return; }
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(q) ? '' : 'none';
            });
        });
    }
    const refresh = panelEl.querySelector('#aclRefresh');
    if (refresh) refresh.addEventListener('click', () => refreshPanelIfOpen());

    panelEl.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clipId = btn.getAttribute('data-clip-id');
            const action = btn.getAttribute('data-action');
            if (!clipId) return;
            if (action === 'edit') {
                const current = getClipLabel(clipId);
                promptAndSetLabel(clipId, current);
            } else if (action === 'clear') {
                setClipLabel(clipId, '');
            }
        });
    });
}

function refreshPanelIfOpen() {
    if (!localAppServices.getOpenWindowIds) return;
    let openIds = [];
    try { openIds = localAppServices.getOpenWindowIds() || []; } catch (e) { return; }
    if (!openIds.includes(LABEL_PANEL_ID)) return;
    // Re-render the panel body in place.
    const root = document.querySelector(`[data-window-id="${LABEL_PANEL_ID}"]`);
    if (!root) return;
    const body = root.querySelector('.window-content, .snaw-window-body, .panel-body') || root;
    body.innerHTML = buildPanelHTML();
    attachPanelHandlers(body);
}

/**
 * Open the Audio Clip Labeling management panel.
 */
export function openAudioClipLabelingPanel() {
    if (!localAppServices.createWindow) {
        console.warn('[AudioClipLabeling] createWindow service not available.');
        return null;
    }
    if (localAppServices.closeWindow) {
        try { localAppServices.closeWindow(LABEL_PANEL_ID); } catch (e) { /* ignore */ }
    }
    const html = buildPanelHTML();
    const win = localAppServices.createWindow(
        LABEL_PANEL_ID,
        'Audio Clip Labels',
        html,
        {
            width: 420,
            height: 520,
            closable: true,
            minimizable: true,
            resizable: true,
        }
    );
    // Bind handlers after the window is mounted in the DOM.
    setTimeout(() => {
        const root = document.querySelector(`[data-window-id="${LABEL_PANEL_ID}"]`);
        if (root) {
            const body = root.querySelector('.window-content, .snaw-window-body, .panel-body') || root;
            attachPanelHandlers(body);
        }
    }, 50);
    return win;
}

function promptAndSetLabel(clipId, currentLabel) {
    const next = (typeof window !== 'undefined' && window.prompt)
        ? window.prompt('Set clip label (empty to clear):', currentLabel || '')
        : null;
    if (next === null) return; // user cancelled
    setClipLabel(clipId, next);
}

/**
 * Draw (or update) the label badge on a clip element. Adds it as a child node
 * if the clip has a non-empty label, removes it if not.
 */
function applyLabelBadgeToElement(clipEl, clip) {
    if (!clipEl) return;
    const label = typeof clip.label === 'string' ? clip.label.trim() : '';
    let badge = clipEl.querySelector(`:scope > .${LABEL_BADGE_CLASS}`);
    if (!label) {
        if (badge) badge.remove();
        return;
    }
    if (!badge) {
        badge = document.createElement('div');
        badge.className = LABEL_BADGE_CLASS;
        // CSS lives in style.css but we set inline fallbacks so it works even
        // if the stylesheet hasn't been edited.
        badge.style.cssText = [
            'position:absolute',
            'top:2px',
            'left:2px',
            'max-width:calc(100% - 8px)',
            'padding:1px 6px',
            'border-radius:4px',
            'background:rgba(15,118,110,0.92)',
            'color:#e6fffa',
            'font-size:10px',
            'line-height:1.2',
            'font-weight:600',
            'letter-spacing:0.01em',
            'pointer-events:none',
            'overflow:hidden',
            'text-overflow:ellipsis',
            'white-space:nowrap',
            'box-shadow:0 1px 2px rgba(0,0,0,0.4)',
            'z-index:5',
        ].join(';');
        clipEl.appendChild(badge);
    }
    badge.textContent = label;
    badge.title = label;
}

/**
 * Iterate every clip DOM element and update its label badge. Called after
 * every renderTimeline() (wrapped below).
 */
function applyAllLabelBadges() {
    for (const { clip } of iterAllClips()) {
        const el = document.querySelector(`[data-clip-id="${clip.id}"]`);
        if (el) applyLabelBadgeToElement(el, clip);
    }
}

/**
 * Augment the context menu for clip elements: insert "Edit Label…" item.
 */
function augmentClipContextMenu(e) {
    // Find a clip element under the cursor.
    const clipEl = e.target && e.target.closest && e.target.closest('[data-clip-id]');
    if (!clipEl) return;
    const clipId = clipEl.getAttribute('data-clip-id');
    if (!clipId) return;

    // Defer to the existing context menu module (if any) so we can add an item
    // to its menu instead of creating a parallel one. Many projects expose a
    // `addContextMenuItem` helper; fall back to injecting into the first
    // visible context menu after a short delay.
    if (localAppServices.addContextMenuItem) {
        try {
            localAppServices.addContextMenuItem({
                id: 'snaw-clip-label-edit',
                label: 'Edit Label…',
                onClick: () => {
                    const current = getClipLabel(clipId);
                    promptAndSetLabel(clipId, current);
                },
            });
            return;
        } catch (err) { /* fall through */ }
    }
    // No helper: open a tiny standalone prompt after a small delay. The
    // standard browser context menu is the default, so this only fires if a
    // custom menu system is present but doesn't expose addContextMenuItem.
    setTimeout(() => {
        // Only act if the default contextmenu was suppressed (custom menu is open).
        const customMenu = document.querySelector('.context-menu, .custom-context-menu, [data-context-menu]');
        if (customMenu) {
            // Best-effort: do nothing here, since we don't want to spawn a second
            // floating menu. The user can still press L on selected clips.
        }
    }, 0);
}

/**
 * Keyboard handler: pressing `L` with one or more selected clips opens a
 * bulk-label prompt. Skips when an input/textarea is focused.
 */
function onKeyDown(e) {
    if (!e) return;
    if (e.key !== 'l' && e.key !== 'L') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.isContentEditable))) return;
    const selected = (localAppServices.getSelectedClipIds && localAppServices.getSelectedClipIds()) || [];
    if (!selected.length) return;
    e.preventDefault();
    const next = (typeof window !== 'undefined' && window.prompt)
        ? window.prompt(`Label for ${selected.length} clip${selected.length === 1 ? '' : 's'} (empty to clear):`, '')
        : null;
    if (next === null) return;
    setClipLabelsBulk(selected.slice(), next);
}

/**
 * Initialize the module.
 */
export function initAudioClipLabeling(services) {
    localAppServices = services || {};
    console.log('[AudioClipLabeling] Initialized');

    // Wrap renderTimeline so the label badges repaint after every render.
    if (localAppServices.renderTimeline) {
        const original = localAppServices.renderTimeline;
        if (!original.__snawClipLabelWrapped) {
            const wrapped = function (...args) {
                const result = original.apply(this, args);
                setTimeout(() => {
                    try { applyAllLabelBadges(); }
                    catch (e) { console.warn('[AudioClipLabeling] applyAllLabelBadges failed:', e); }
                }, 30);
                return result;
            };
            wrapped.__snawClipLabelWrapped = true;
            localAppServices.renderTimeline = wrapped;
        }
    }

    // Document-level keyboard handler.
    document.addEventListener('keydown', onKeyDown);

    // Right-click on a clip → try to inject an "Edit Label…" menu item.
    document.addEventListener('contextmenu', augmentClipContextMenu, true);
}

console.log('[AudioClipLabeling] Module loaded');

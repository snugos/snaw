// js/PerformanceModeRecall.js - Save & recall panel layout snapshots
// Captures which dockable panels are currently open (and their minimized state)
// as a named preset, then on recall closes panels not in the preset and opens
// the ones that are. Useful for switching between e.g. "Live Performance"
// (mixer + master FX + sends overview), "Composing" (piano roll + sequencer +
// chord progression builder), and "Mixing" (mixer + effects rack + sends +
// loudness meter) without manually reopening every panel each time.
//
// Presets are persisted to localStorage. Window positions/sizes are intentionally
// NOT captured here — that's what QuickStackLayouts already does. Performance
// Mode Recall is about *which* panels exist, not *where* they sit.
//
// To make recall useful for panels it doesn't own, callers can register an
// "opener" for a window id via registerWindowOpener(id, fn). The fn is called
// when a preset contains an id that's not currently open. Unknown ids (no
// opener registered) are simply logged and skipped, so recalling a preset on
// a different code revision won't crash.

let localAppServices = {};
let currentWindow = null;

const STORAGE_INDEX = 'snugos_performance_mode_preset_index';
const STORAGE_PREFIX = 'snugos_performance_mode_preset_';

// windowId -> () => void opener function
const windowOpeners = new Map();

// ids the panel never includes in captures or closes (otherwise capturing and
// immediately recalling would tear the panel itself down)
const SELF_PROTECTED_IDS = new Set(['performanceModeRecall']);

/**
 * Initialize the Performance Mode Recall module.
 * @param {object} services - appServices from main.js
 */
export function initPerformanceModeRecall(services) {
    localAppServices = services || {};
    console.log('[PerformanceModeRecall] Initialized');
}

/**
 * Register an opener function for a window id so recall can reopen panels
 * that aren't currently mounted. Caller passes a function that takes no
 * arguments and re-opens the panel.
 * @param {string} windowId
 * @param {function} openerFn
 */
export function registerWindowOpener(windowId, openerFn) {
    if (!windowId || typeof openerFn !== 'function') return;
    windowOpeners.set(windowId, openerFn);
}

/**
 * Unregister an opener.
 * @param {string} windowId
 */
export function unregisterWindowOpener(windowId) {
    windowOpeners.delete(windowId);
}

/**
 * Get the module version string (used by the panel footer).
 */
export function getPerformanceModeRecallVersion() {
    return 'v0.3.82';
}

/**
 * Whether the Performance Mode Recall panel is currently open.
 */
export function isPerformanceModeRecallPanelOpen() {
    try {
        const wins = localAppServices.getOpenWindows?.();
        return !!(wins && wins.has && wins.has('performanceModeRecall'));
    } catch (e) {
        return false;
    }
}

/**
 * Get the list of saved preset names (insertion order).
 * @returns {string[]}
 */
export function getPresets() {
    try {
        const raw = localStorage.getItem(STORAGE_INDEX);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        console.warn('[PerformanceModeRecall] Failed to load preset index', e);
        return [];
    }
}

function writePresetIndex(arr) {
    try {
        localStorage.setItem(STORAGE_INDEX, JSON.stringify(arr));
    } catch (e) {
        console.error('[PerformanceModeRecall] Failed to write preset index', e);
    }
}

/**
 * Load a preset by name (returns null if not found).
 * @param {string} name
 * @returns {object|null}
 */
export function getPreset(name) {
    if (!name) return null;
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + name.replace(/\s+/g, '_'));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.windows)) return null;
        return parsed;
    } catch (e) {
        console.warn('[PerformanceModeRecall] Failed to load preset', name, e);
        return null;
    }
}

/**
 * Capture the current open-window layout as a preset (overwrites if name
 * already exists). Returns the saved preset object, or null on failure.
 * @param {string} name
 * @returns {object|null}
 */
export function captureCurrentLayout(name) {
    if (!name || typeof name !== 'string') {
        console.warn('[PerformanceModeRecall] capture: invalid name');
        return null;
    }
    const wins = localAppServices.getOpenWindows?.();
    const windows = [];
    if (wins && typeof wins.forEach === 'function') {
        wins.forEach((win, id) => {
            if (!id || SELF_PROTECTED_IDS.has(id)) return;
            if (!win) return;
            windows.push({ id, isMinimized: !!win.isMinimized });
        });
    }
    const preset = {
        name,
        version: 1,
        createdAt: Date.now(),
        windowCount: windows.length,
        windows
    };
    try {
        localStorage.setItem(
            STORAGE_PREFIX + name.replace(/\s+/g, '_'),
            JSON.stringify(preset)
        );
        const idx = getPresets();
        if (!idx.includes(name)) {
            idx.push(name);
            writePresetIndex(idx);
        }
        console.log(`[PerformanceModeRecall] Captured layout "${name}" with ${windows.length} windows`);
        return preset;
    } catch (e) {
        console.error('[PerformanceModeRecall] Failed to capture layout', e);
        return null;
    }
}

/**
 * Delete a saved preset. Returns true if removed, false if not found.
 * @param {string} name
 * @returns {boolean}
 */
export function deletePreset(name) {
    if (!name) return false;
    const key = STORAGE_PREFIX + name.replace(/\s+/g, '_');
    let existed = false;
    try {
        existed = localStorage.getItem(key) !== null;
        localStorage.removeItem(key);
    } catch (e) {
        console.warn('[PerformanceModeRecall] delete: storage error', e);
    }
    const idx = getPresets().filter(n => n !== name);
    writePresetIndex(idx);
    return existed;
}

/**
 * Rename a saved preset. Returns true on success.
 * @param {string} oldName
 * @param {string} newName
 * @returns {boolean}
 */
export function renamePreset(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return false;
    const preset = getPreset(oldName);
    if (!preset) return false;
    preset.name = newName;
    preset.updatedAt = Date.now();
    try {
        localStorage.setItem(
            STORAGE_PREFIX + newName.replace(/\s+/g, '_'),
            JSON.stringify(preset)
        );
        localStorage.removeItem(STORAGE_PREFIX + oldName.replace(/\s+/g, '_'));
    } catch (e) {
        console.error('[PerformanceModeRecall] rename: storage error', e);
        return false;
    }
    const idx = getPresets().map(n => (n === oldName ? newName : n));
    writePresetIndex(idx);
    return true;
}

/**
 * Recall a preset: close windows not in the preset (skipping self-protected
 * ids and ids that look like per-track ids such as trackInspector-123, which
 * are skipped since they're resource-bound), restore any in the preset that
 * are already open, and open any that aren't.
 *
 * Returns { opened: number, closed: number, skipped: number, errors: string[] }
 * @param {string} name
 */
export function recallPreset(name) {
    const preset = getPreset(name);
    if (!preset) {
        console.warn(`[PerformanceModeRecall] recallPreset: "${name}" not found`);
        return { opened: 0, closed: 0, skipped: 0, errors: [`Preset "${name}" not found`] };
    }
    const wins = localAppServices.getOpenWindows?.();
    const presetIds = new Set((preset.windows || []).map(w => w && w.id).filter(Boolean));
    const result = { opened: 0, closed: 0, skipped: 0, errors: [] };

    if (!wins || typeof wins.forEach !== 'function') {
        result.errors.push('getOpenWindows unavailable');
        return result;
    }

    // Phase 1: close windows not in the preset (skip self-protected)
    const toClose = [];
    wins.forEach((win, id) => {
        if (!id) return;
        if (SELF_PROTECTED_IDS.has(id)) return;
        if (!presetIds.has(id)) toClose.push(id);
    });

    toClose.forEach(id => {
        const win = wins.get(id);
        if (win && typeof win.close === 'function') {
            try { win.close(true); result.closed++; } catch (e) {
                console.warn(`[PerformanceModeRecall] Failed to close ${id}`, e);
            }
        }
    });

    // Phase 2: open or restore each preset window
    (preset.windows || []).forEach(entry => {
        if (!entry || !entry.id) { result.skipped++; return; }
        const existing = wins.get(entry.id);
        if (existing) {
            try {
                if (entry.isMinimized) {
                    if (typeof existing.minimize === 'function') existing.minimize();
                } else {
                    if (typeof existing.restore === 'function') existing.restore();
                }
                return;
            } catch (e) {
                console.warn(`[PerformanceModeRecall] Failed to adjust ${entry.id}`, e);
                result.errors.push(`${entry.id}: ${e && e.message ? e.message : 'adjust failed'}`);
                return;
            }
        }
        const opener = windowOpeners.get(entry.id);
        if (typeof opener === 'function') {
            try {
                opener();
                result.opened++;
                if (entry.isMinimized) {
                    setTimeout(() => {
                        try {
                            const w = wins.get(entry.id);
                            if (w && typeof w.minimize === 'function') w.minimize();
                        } catch (_) { /* best-effort */ }
                    }, 80);
                }
            } catch (e) {
                console.warn(`[PerformanceModeRecall] Opener failed for ${entry.id}`, e);
                result.errors.push(`${entry.id}: ${e && e.message ? e.message : 'opener failed'}`);
                result.skipped++;
            }
        } else {
            console.log(`[PerformanceModeRecall] No opener registered for "${entry.id}", skipping`);
            result.skipped++;
        }
    });

    console.log(`[PerformanceModeRecall] Recalled "${name}" — opened ${result.opened}, closed ${result.closed}, skipped ${result.skipped}`);
    return result;
}

/**
 * Open the Performance Mode Recall panel.
 */
export function openPerformanceModeRecallPanel(savedState = null) {
    const windowId = 'performanceModeRecall';

    if (localAppServices.getOpenWindows) {
        const wins = localAppServices.getOpenWindows();
        if (wins && wins.has && wins.has(windowId)) {
            const existing = wins.get(windowId);
            if (existing?.restore) existing.restore();
            currentWindow = existing;
            renderPerformanceModeRecallContent();
            return existing;
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'performanceModeRecallContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 460,
        height: 540,
        minWidth: 380,
        minHeight: 420,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    if (savedState && typeof savedState === 'object') {
        if (Number.isFinite(parseInt(savedState.left, 10))) options.x = parseInt(savedState.left, 10);
        if (Number.isFinite(parseInt(savedState.top, 10))) options.y = parseInt(savedState.top, 10);
        if (Number.isFinite(parseInt(savedState.width, 10))) options.width = parseInt(savedState.width, 10);
        if (Number.isFinite(parseInt(savedState.height, 10))) options.height = parseInt(savedState.height, 10);
        if (savedState.zIndex) options.zIndex = savedState.zIndex;
        if (savedState.isMinimized) options.isMinimized = true;
    }

    const win = localAppServices.createWindow?.(
        windowId,
        'Performance Mode Recall',
        contentContainer,
        options
    );

    if (win?.element) {
        currentWindow = win;
        setTimeout(() => renderPerformanceModeRecallContent(), 50);
    }
    return win;
}

function renderPerformanceModeRecallContent() {
    const container = document.getElementById('performanceModeRecallContent');
    if (!container) return;

    const presets = getPresets();
    const wins = localAppServices.getOpenWindows?.();
    const currentCount = (wins && typeof wins.size === 'number') ? wins.size : 0;
    // Subtract self so the "currently open" count doesn't include this panel
    const selfOpen = !!(wins && wins.has && wins.has('performanceModeRecall'));
    const reportedCurrent = Math.max(0, currentCount - (selfOpen ? 1 : 0));

    let html = `
        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Capture current layout</div>
            <div class="flex items-center gap-2">
                <input type="text" id="pmrNewName" placeholder="Preset name (e.g. Live Performance)"
                    class="flex-1 px-3 py-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" />
                <button id="pmrSaveBtn" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ${reportedCurrent} panel${reportedCurrent === 1 ? '' : 's'} currently open.
                Position &amp; size are not stored — only which panels are open.
            </div>
        </div>

        <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Saved Presets</h3>
            <button id="pmrRefreshBtn" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500">Refresh</button>
        </div>
    `;

    if (presets.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded">
                <p class="text-sm">No presets saved yet.</p>
                <p class="text-xs mt-2">Open the panels you want, type a name above, and click Save.</p>
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        presets.forEach(name => {
            const preset = getPreset(name);
            const windowCount = preset?.windowCount ?? (preset?.windows?.length ?? 0);
            const ts = preset?.createdAt ? new Date(preset.createdAt).toLocaleString() : '';
            html += `
                <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button class="pmr-recall-btn px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600" data-name="${escapeHtml(name)}">Recall</button>
                            <button class="pmr-rename-btn px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600" data-name="${escapeHtml(name)}">Rename</button>
                            <button class="pmr-delete-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-name="${escapeHtml(name)}">✕</button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        ${windowCount} panel${windowCount === 1 ? '' : 's'} · ${escapeHtml(ts)}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    html += `
        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600 text-xs text-gray-500 dark:text-gray-400">
            Performance Mode Recall ${escapeHtml(getPerformanceModeRecallVersion())}
        </div>
    `;

    container.innerHTML = html;

    const saveBtn = container.querySelector('#pmrSaveBtn');
    const nameInput = container.querySelector('#pmrNewName');
    const refreshBtn = container.querySelector('#pmrRefreshBtn');

    saveBtn?.addEventListener('click', () => {
        const name = nameInput?.value?.trim();
        if (!name) {
            localAppServices.showSafeNotification?.('Please enter a preset name', 1500);
            return;
        }
        const existing = getPresets().includes(name);
        if (existing) {
            const ok = window.confirm(`Overwrite existing preset "${name}"?`);
            if (!ok) return;
        }
        const result = captureCurrentLayout(name);
        if (result) {
            localAppServices.showSafeNotification?.(`Saved preset "${name}" (${result.windowCount} panels)`, 1500);
            nameInput.value = '';
            renderPerformanceModeRecallContent();
        } else {
            localAppServices.showSafeNotification?.('Save failed', 1500);
        }
    });

    refreshBtn?.addEventListener('click', () => renderPerformanceModeRecallContent());

    container.querySelectorAll('.pmr-recall-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.currentTarget.dataset.name;
            const r = recallPreset(name);
            const errs = r.errors?.length ? ` (${r.errors.length} error${r.errors.length === 1 ? '' : 's'})` : '';
            localAppServices.showSafeNotification?.(
                `Recalled "${name}" — ${r.opened} opened, ${r.closed} closed, ${r.skipped} skipped${errs}`,
                1800
            );
            setTimeout(renderPerformanceModeRecallContent, 200);
        });
    });

    container.querySelectorAll('.pmr-rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const oldName = e.currentTarget.dataset.name;
            const newName = window.prompt(`Rename preset "${oldName}" to:`, oldName);
            if (!newName || newName.trim() === oldName) return;
            if (getPresets().includes(newName.trim())) {
                localAppServices.showSafeNotification?.(`A preset named "${newName.trim()}" already exists`, 1500);
                return;
            }
            if (renamePreset(oldName, newName.trim())) {
                localAppServices.showSafeNotification?.(`Renamed to "${newName.trim()}"`, 1500);
                renderPerformanceModeRecallContent();
            } else {
                localAppServices.showSafeNotification?.('Rename failed', 1500);
            }
        });
    });

    container.querySelectorAll('.pmr-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.currentTarget.dataset.name;
            if (!window.confirm(`Delete preset "${name}"?`)) return;
            if (deletePreset(name)) {
                localAppServices.showSafeNotification?.(`Deleted preset "${name}"`, 1500);
                renderPerformanceModeRecallContent();
            } else {
                localAppServices.showSafeNotification?.('Delete failed', 1500);
            }
        });
    });
}

function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
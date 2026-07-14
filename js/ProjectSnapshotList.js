/**
 * js/ProjectSnapshotList.js - Quick Project Snapshot List (v0.4.15)
 *
 * Producers often want to pop back to a recent state of the project
 * without going through the full file dialog. This module keeps an
 * index of the last 5 snapshots (mix of auto-saved + manual) and
 * shows them in a small floating panel that can be opened from the
 * project menu ("Snapshots…") or via the `openProjectSnapshotListPanel()`
 * window export.
 *
 * Snapshot data (the full `gatherProjectDataInternal()` payload) is
 * persisted to IndexedDB under `snapshot_<id>` keys, reusing the
 * `projectState` object store. The 5-entry index itself (id, label,
 * timestamp, source) lives in localStorage so the panel can render
 * synchronously without an async round-trip on open.
 *
 * Sources:
 *   - "auto"   - Created by the periodic auto-save hook (see
 *                startAutoSnapshotCapture). Throttled to once every
 *                `AUTO_SNAPSHOT_INTERVAL_MS` (5 min by default) and
 *                only when the project has been mutated since the
 *                last snapshot.
 *   - "manual" - Created by the user via the "Save Manual Snapshot"
 *                button at the bottom of the panel.
 *
 * Behaviour:
 *   - The index is bounded to MAX_ENTRIES (5). New snapshots push
 *     out the oldest entry, and the corresponding IndexedDB blob is
 *     deleted to keep the store from growing unboundedly.
 *   - "Load" reconstructs the project via the existing
 *     `reconstructDAWInternal(state, false)` path. The reconstruct
 *     path is async and rebinds all the Tone.js nodes; we let it
 *     resolve before notifying the user so the panel can stay open
 *     in the background.
 *   - Panel is fixed-position (top-right, 320px wide) with a
 *     self-contained stylesheet injected once on first open.
 *
 * Why a separate module:
 *   - Keeps the persistence layout (localStorage index + IDB blobs)
 *     out of the existing `autoSaveProjectState` so the existing
 *     crash-recovery flow is untouched.
 *   - Mirrors the IIFE / init(appServices) / window export pattern
 *     used by TrackNotesSidebar.js and ProjectSessionTimer.js.
 *
 * (v0.4.15)
 */

import { gatherProjectDataInternal, reconstructDAWInternal } from './state.js';
import { storeProjectState, getProjectState, deleteProjectState } from './db.js';

const STORAGE_KEY = 'snaw_project_snapshots_v1';
const PANEL_ID = 'projectSnapshotListPanel';
const VERSION = 'v0.4.15';
const MAX_ENTRIES = 5;
const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const MUTATION_RESET_MS = 30 * 1000;             // consider the project "changed" if anything happens within 30s of last save

let localAppServices = {};
let autoSnapshotTimerId = null;
let lastSnapshotTimestamp = 0;
let lastMutationTimestamp = 0;
let suppressNextAutoSnapshot = false;

function readIndex() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(e => e && typeof e.id === 'string');
    } catch (err) {
        console.warn('[ProjectSnapshotList] Failed to read index:', err);
        return [];
    }
}

function writeIndex(entries) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    } catch (err) {
        console.warn('[ProjectSnapshotList] Failed to write index:', err);
    }
}

function formatRelative(timestamp) {
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
}

function formatClock(timestamp) {
    try {
        const d = new Date(timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (_) {
        return '';
    }
}

function pruneOldSnapshots(entries) {
    // Caller is expected to pass the *kept* entries; we just enforce the cap.
    return entries.slice(0, MAX_ENTRIES);
}

async function persistSnapshot(entry, projectData) {
    if (!entry || !entry.id || !projectData) return false;
    try {
        await storeProjectState(`snapshot_${entry.id}`, projectData);
        return true;
    } catch (err) {
        console.warn('[ProjectSnapshotList] Failed to persist snapshot blob:', err);
        return false;
    }
}

async function dropSnapshotBlob(id) {
    if (!id) return;
    try {
        await deleteProjectState(`snapshot_${id}`);
    } catch (err) {
        console.warn(`[ProjectSnapshotList] Failed to drop snapshot blob ${id}:`, err);
    }
}

function recordMutation() {
    lastMutationTimestamp = Date.now();
}

function shouldAutoSnapshot() {
    if (suppressNextAutoSnapshot) {
        suppressNextAutoSnapshot = false;
        return false;
    }
    const now = Date.now();
    if (now - lastSnapshotTimestamp < AUTO_SNAPSHOT_INTERVAL_MS) return false;
    if (now - lastMutationTimestamp > MUTATION_RESET_MS) return false;
    return true;
}

async function captureSnapshot({ source, label } = {}) {
    if (typeof gatherProjectDataInternal !== 'function') {
        console.warn('[ProjectSnapshotList] gatherProjectDataInternal unavailable; aborting capture.');
        return null;
    }
    let projectData;
    try {
        projectData = gatherProjectDataInternal();
    } catch (err) {
        console.warn('[ProjectSnapshotList] gatherProjectDataInternal failed:', err);
        return null;
    }
    if (!projectData) return null;

    const id = `snap_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    const entry = {
        id,
        label: label || (source === 'manual'
            ? `Manual ${new Date().toLocaleString()}`
            : `Auto ${formatClock(Date.now())}`),
        timestamp: Date.now(),
        source: source === 'manual' ? 'manual' : 'auto',
    };

    const existing = readIndex();
    const next = pruneOldSnapshots([entry, ...existing]);

    // Persist the blob first so a partial-write doesn't leave the
    // index pointing at a missing IDB record.
    const ok = await persistSnapshot(entry, projectData);
    if (!ok) return null;

    // Trim any IDB blobs for entries that fell off the end of the
    // index. Run them in parallel but never block the UI.
    const droppedIds = existing.slice(MAX_ENTRIES - 1).map(e => e.id).filter(Boolean);
    droppedIds.forEach(dropSnapshotBlob);

    writeIndex(next);
    lastSnapshotTimestamp = Date.now();
    refreshPanelIfOpen();
    return entry;
}

async function loadSnapshotById(id) {
    if (!id) return false;
    let data = null;
    try {
        data = await getProjectState(`snapshot_${id}`);
    } catch (err) {
        console.warn(`[ProjectSnapshotList] Failed to load snapshot ${id}:`, err);
    }
    if (!data) {
        notify(`Snapshot could not be loaded`, 2500);
        return false;
    }
    if (typeof reconstructDAWInternal !== 'function') {
        console.warn('[ProjectSnapshotList] reconstructDAWInternal unavailable.');
        return false;
    }
    try {
        // The second arg is `isUndoRedo`; pass false so this counts as
        // a real load and is captured on the undo stack like any other
        // project mutation.
        await reconstructDAWInternal(data, false);
        notify(`Snapshot loaded`, 1800);
        return true;
    } catch (err) {
        console.error('[ProjectSnapshotList] Reconstruct failed:', err);
        notify(`Snapshot load failed`, 2500);
        return false;
    }
}

function deleteSnapshotById(id) {
    if (!id) return false;
    const next = readIndex().filter(e => e.id !== id);
    writeIndex(next);
    dropSnapshotBlob(id);
    refreshPanelIfOpen();
    return true;
}

function notify(message, duration) {
    const fn = localAppServices && typeof localAppServices.showNotification === 'function'
        ? localAppServices.showNotification
        : (typeof window !== 'undefined' && typeof window.showNotification === 'function'
            ? window.showNotification
            : null);
    if (fn) {
        try { fn(message, duration || 2000); } catch (_) { /* non-fatal */ }
    } else {
        console.log(`[ProjectSnapshotList] ${message}`);
    }
}

function buildPanelHTML() {
    const entries = readIndex();
    let body;
    if (!entries.length) {
        body = `<div class="psl-empty">No snapshots yet. Make a manual snapshot or keep working for an auto-snapshot to appear.</div>`;
    } else {
        body = '<div class="psl-list">';
        entries.forEach((entry) => {
            const safeId = String(entry.id).replace(/[^a-zA-Z0-9_-]/g, '_');
            const sourceLabel = entry.source === 'manual' ? 'Manual' : 'Auto';
            const sourceClass = entry.source === 'manual' ? 'psl-source-manual' : 'psl-source-auto';
            const escapedLabel = String(entry.label || 'Snapshot').replace(/[<>&"']/g, (c) => ({
                '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
            })[c]);
            body += `
                <div class="psl-row" data-id="${safeId}">
                    <div class="psl-meta">
                        <div class="psl-label" title="${escapedLabel}">${escapedLabel}</div>
                        <div class="psl-sub">
                            <span class="psl-source ${sourceClass}">${sourceLabel}</span>
                            <span class="psl-time" title="${new Date(entry.timestamp).toLocaleString()}">${formatRelative(entry.timestamp)}</span>
                        </div>
                    </div>
                    <div class="psl-actions">
                        <button class="psl-btn psl-load" data-act="load" data-id="${safeId}">Load</button>
                        <button class="psl-btn psl-del" data-act="del" data-id="${safeId}" title="Delete">✕</button>
                    </div>
                </div>
            `;
        });
        body += '</div>';
    }
    return `
        <div class="psl-header">
            <span>Project Snapshots</span>
            <button class="psl-close" data-act="close" title="Close">✕</button>
        </div>
        <div class="psl-body">${body}</div>
        <div class="psl-footer">
            <button class="psl-btn psl-manual" data-act="manual">Save Manual Snapshot</button>
            <span class="psl-count">${entries.length}/${MAX_ENTRIES}</span>
        </div>
    `;
}

function ensurePanelStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('psl-styles')) return;
    const style = document.createElement('style');
    style.id = 'psl-styles';
    style.textContent = `
        #${PANEL_ID} {
            position: fixed; top: 80px; right: 20px; width: 320px;
            background: #1a1a1a; border: 1px solid #444; border-radius: 8px;
            z-index: 10001; box-shadow: 0 6px 24px rgba(0,0,0,0.55);
            font-family: system-ui, sans-serif; color: #f3f3f3;
        }
        #${PANEL_ID} .psl-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 12px; background: #252525; border-radius: 8px 8px 0 0;
            border-bottom: 1px solid #333; font-size: 13px; font-weight: 600;
        }
        #${PANEL_ID} .psl-close {
            background: none; border: none; color: #aaa; cursor: pointer; font-size: 14px;
        }
        #${PANEL_ID} .psl-close:hover { color: #fff; }
        #${PANEL_ID} .psl-body { padding: 8px 10px; max-height: 360px; overflow-y: auto; }
        #${PANEL_ID} .psl-empty {
            font-size: 12px; color: #888; padding: 12px; text-align: center; line-height: 1.4;
        }
        #${PANEL_ID} .psl-list { display: flex; flex-direction: column; gap: 6px; }
        #${PANEL_ID} .psl-row {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; background: #222; border: 1px solid #2c2c2c; border-radius: 5px;
        }
        #${PANEL_ID} .psl-row:hover { background: #262626; }
        #${PANEL_ID} .psl-meta { flex: 1; min-width: 0; }
        #${PANEL_ID} .psl-label {
            font-size: 12px; color: #f3f3f3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        #${PANEL_ID} .psl-sub {
            display: flex; gap: 6px; align-items: center; margin-top: 2px;
            font-size: 10px; color: #888;
        }
        #${PANEL_ID} .psl-source {
            padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase;
        }
        #${PANEL_ID} .psl-source-auto { background: #1d3a5f; color: #6cb1ff; }
        #${PANEL_ID} .psl-source-manual { background: #3b2a5c; color: #c39bff; }
        #${PANEL_ID} .psl-time { color: #888; }
        #${PANEL_ID} .psl-actions { display: flex; gap: 4px; }
        #${PANEL_ID} .psl-btn {
            background: #333; color: #ddd; border: 1px solid #444; padding: 3px 8px;
            border-radius: 3px; cursor: pointer; font-size: 11px; font-family: inherit;
        }
        #${PANEL_ID} .psl-btn:hover { background: #3d3d3d; color: #fff; }
        #${PANEL_ID} .psl-load:hover { background: #2d6cdf; border-color: #2d6cdf; }
        #${PANEL_ID} .psl-del:hover { background: #c84a4a; border-color: #c84a4a; color: #fff; }
        #${PANEL_ID} .psl-manual {
            flex: 1; background: #2a6f3a; border-color: #2a6f3a; color: #fff; padding: 6px 8px; font-weight: 600;
        }
        #${PANEL_ID} .psl-manual:hover { background: #348a47; }
        #${PANEL_ID} .psl-footer {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 10px; border-top: 1px solid #333; background: #1f1f1f; border-radius: 0 0 8px 8px;
        }
        #${PANEL_ID} .psl-count { font-size: 10px; color: #888; }
    `;
    document.head.appendChild(style);
}

function refreshPanelIfOpen() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    // Rebuild the panel inner content in place so the click handler
    // attached to the panel root still routes the new buttons.
    panel.innerHTML = buildPanelHTML();
}

function attachPanelHandlers(panel) {
    if (!panel) return;
    panel.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const act = target.getAttribute('data-act');
        const id = target.getAttribute('data-id');
        if (act === 'close') {
            closeProjectSnapshotListPanel();
            return;
        }
        if (act === 'manual') {
            captureSnapshot({ source: 'manual' })
                .then((entry) => {
                    if (entry) notify(`Snapshot saved (${entry.label})`, 2000);
                })
                .catch((err) => console.warn('[ProjectSnapshotList] Manual capture failed:', err));
            return;
        }
        if (act === 'load' && id) {
            loadSnapshotById(id).catch((err) => {
                console.warn('[ProjectSnapshotList] Load failed:', err);
            });
            return;
        }
        if (act === 'del' && id) {
            deleteSnapshotById(id);
            return;
        }
    });
}

export function openProjectSnapshotListPanel() {
    if (typeof document === 'undefined') return;
    ensurePanelStyle();
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
        existing.remove();
    }
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);
    attachPanelHandlers(panel);
}

export function closeProjectSnapshotListPanel() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
}

export function toggleProjectSnapshotListPanel() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
        closeProjectSnapshotListPanel();
    } else {
        openProjectSnapshotListPanel();
    }
}

function startAutoSnapshotCapture() {
    if (autoSnapshotTimerId !== null) return;
    if (typeof setInterval !== 'function') return;
    autoSnapshotTimerId = setInterval(() => {
        try {
            if (!shouldAutoSnapshot()) return;
            captureSnapshot({ source: 'auto' })
                .then((entry) => {
                    if (entry) {
                        console.log(`[ProjectSnapshotList] Auto-snapshot captured: ${entry.label}`);
                    }
                })
                .catch((err) => {
                    console.warn('[ProjectSnapshotList] Auto-snapshot failed:', err);
                });
        } catch (err) {
            console.warn('[ProjectSnapshotList] Auto-snapshot tick failed:', err);
        }
    }, AUTO_SNAPSHOT_INTERVAL_MS);
    // Pre-arm the mutation timestamp so we don't fire on a freshly-loaded
    // project that the user hasn't touched yet.
    recordMutation();
}

export function initProjectSnapshotList(appServices) {
    localAppServices = appServices || {};

    // Mirror to window for menu wiring and ad-hoc inspection.
    if (typeof window !== 'undefined') {
        window.openProjectSnapshotListPanel = openProjectSnapshotListPanel;
        window.closeProjectSnapshotListPanel = closeProjectSnapshotListPanel;
        window.toggleProjectSnapshotListPanel = toggleProjectSnapshotListPanel;
        window.captureProjectSnapshot = (opts) => captureSnapshot(opts || {});
        window.getProjectSnapshotList = () => readIndex().slice();
        window.getProjectSnapshotListVersion = () => VERSION;
        window.recordProjectSnapshotMutation = recordMutation;
    }

    // Expose a single "record a mutation" hook on appServices so other
    // modules (undo captures, manual saves, etc.) can nudge the auto-
    // snapshot throttle without depending on us directly.
    if (localAppServices) {
        localAppServices.recordProjectSnapshotMutation = recordMutation;
    }

    // Hook a few well-known services to auto-record mutations. Best-
    // effort: any of these can be missing and the module still works.
    try {
        // captureStateForUndo fires on virtually every project mutation
        // (track add, clip move, effect change, etc.) so it is the most
        // reliable signal that the user has actually changed something
        // since the last snapshot.
        if (typeof localAppServices.captureStateForUndo === 'function') {
            const originalCapture = localAppServices.captureStateForUndo;
            localAppServices.captureStateForUndo = function patchedCapture(...args) {
                recordMutation();
                return originalCapture.apply(this, args);
            };
        }
    } catch (err) {
        console.warn('[ProjectSnapshotList] Could not wrap captureStateForUndo:', err);
    }

    try {
        // If saveProject ever becomes a real service (TrackFreezeAll
        // already calls appServices.saveProject), a manual file-save is
        // also a great moment to drop a snapshot.
        if (typeof localAppServices.saveProject === 'function') {
            const originalSave = localAppServices.saveProject;
            localAppServices.saveProject = async function patchedSaveProject(...args) {
                recordMutation();
                const result = await originalSave.apply(this, args);
                try {
                    await captureSnapshot({ source: 'manual', label: 'After Save' });
                } catch (err) {
                    console.warn('[ProjectSnapshotList] Post-save snapshot failed:', err);
                }
                return result;
            };
        }
    } catch (err) {
        console.warn('[ProjectSnapshotList] Could not wrap saveProject:', err);
    }

    startAutoSnapshotCapture();
    console.log(`[ProjectSnapshotList] Initialized (${VERSION}) — capacity ${MAX_ENTRIES}, auto interval ${AUTO_SNAPSHOT_INTERVAL_MS / 1000}s`);
}

console.log('[ProjectSnapshotList] Module loaded');

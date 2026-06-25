// js/TrackFolderCollapseMemory.js - Track Folder Collapse Memory (v0.3.76)
// Feature: Track Folder Collapse Memory - Remember per-project which track folders
// (track groups + track stacks) are collapsed/expanded across reloads.
//
// Storage shape (localStorage key 'snaw_track_folder_collapse'):
//   { "<projectName>": { "group:<id>": true, "stack:<id>": true } }
// `true` = collapsed. Missing = use the default (expanded).

let localAppServices = {};
const STORAGE_KEY = 'snaw_track_folder_collapse';

function loadAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) { return {}; }
}

function saveAll(all) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
    catch (e) { console.warn('[TrackFolderCollapseMemory] save failed:', e); }
}

function projectKey() {
    try {
        const name = localAppServices.getProjectNameState?.();
        if (typeof name === 'string' && name.trim() && name !== 'Untitled Project') {
            return name.trim();
        }
    } catch (e) { /* ignore */ }
    return '__default__';
}

function entryKey(kind, id) {
    if ((kind !== 'group' && kind !== 'stack') || id === null || id === undefined) return null;
    return `${kind}:${id}`;
}

/**
 * Persist the collapse state of one folder (track group or stack) for the
 * currently-loaded project. Stores `true` when collapsed, removes the entry
 * when expanded so we don't accumulate dead entries.
 */
export function rememberFolderCollapse(kind, id, collapsed) {
    const key = entryKey(kind, id);
    if (!key) return;
    const all = loadAll();
    const proj = projectKey();
    if (!all[proj] || typeof all[proj] !== 'object') all[proj] = {};
    if (collapsed) {
        all[proj][key] = true;
    } else {
        delete all[proj][key];
    }
    saveAll(all);
}

/**
 * Look up the remembered collapse state for a folder in the current project.
 * @returns {boolean|null} true=collapsed, false=expanded (we don't store
 *                          expanded entries - returns false), null=unknown
 */
export function recallFolderCollapse(kind, id) {
    const key = entryKey(kind, id);
    if (!key) return null;
    const all = loadAll();
    const proj = projectKey();
    if (all[proj] && all[proj][key] === true) return true;
    return false;
}

/**
 * Apply remembered collapse state to every existing TrackGrouping group.
 * Call this after opening the Track Groups panel for the first time, or
 * after a project load. Idempotent - safe to call repeatedly.
 * @returns {number} number of groups whose collapse state was applied
 */
export function applyRememberedCollapseToGroups() {
    try {
        const getGroups = (typeof window !== 'undefined' && window.getTrackGroups)
            || localAppServices.getTrackGroups;
        const updateGroup = (typeof window !== 'undefined' && window.updateTrackGroup)
            || localAppServices.updateTrackGroup;
        if (typeof getGroups !== 'function' || typeof updateGroup !== 'function') return 0;
        const groups = getGroups();
        if (!Array.isArray(groups)) return 0;
        let applied = 0;
        groups.forEach(g => {
            if (!g || g.id === undefined || g.id === null) return;
            const remembered = recallFolderCollapse('group', g.id);
            const currentlyCollapsed = !!g.collapsed;
            if (remembered === true && !currentlyCollapsed) {
                updateGroup(g.id, { collapsed: true });
                applied++;
            }
        });
        return applied;
    } catch (e) {
        console.warn('[TrackFolderCollapseMemory] applyRememberedCollapseToGroups failed:', e);
        return 0;
    }
}

/**
 * Apply remembered collapse state to every existing TrackStack entry.
 * @returns {Promise<number>}
 */
export async function applyRememberedCollapseToStacks() {
    try {
        const mod = await import('./TrackStack.js');
        if (!mod || typeof mod.getTrackStacks !== 'function'
                 || typeof mod.toggleStackCollapse !== 'function') return 0;
        const stacks = mod.getTrackStacks();
        if (!stacks || typeof stacks !== 'object') return 0;
        let applied = 0;
        Object.values(stacks).forEach(stack => {
            if (!stack || stack.id === undefined) return;
            const remembered = recallFolderCollapse('stack', stack.id);
            if (remembered === true && !stack.isCollapsed) {
                mod.toggleStackCollapse(stack.id);
                applied++;
            }
        });
        return applied;
    } catch (e) {
        console.warn('[TrackFolderCollapseMemory] applyRememberedCollapseToStacks failed:', e);
        return 0;
    }
}

/**
 * Clear all remembered collapse state for the current project.
 * Useful if the user wants to start fresh.
 */
export function clearCurrentProjectCollapseMemory() {
    const all = loadAll();
    const proj = projectKey();
    if (all[proj]) {
        delete all[proj];
        saveAll(all);
    }
}

/**
 * Initialize the feature: wire up persistence to TrackGrouping updateTrackGroup
 * + TrackStack toggleStackCollapse. Once wrapped, any toggle of a folder's
 * collapse state will be remembered automatically.
 * @param {Object} services - The appServices object from main.js
 */
export function initTrackFolderCollapseMemory(services) {
    localAppServices = services || {};

    // If window.updateTrackGroup isn't set yet (the rest of the codebase exposes
    // it via appServices = window.updateTrackGroup in main.js but never assigns
    // it), bind it to TrackGrouping.js's updateTrackGroup so the UI's
    // localAppServices.updateTrackGroup calls have something to talk to.
    try {
        if (typeof window !== 'undefined') {
            if (typeof window.updateTrackGroup !== 'function') {
                import('./TrackGrouping.js').then(mod => {
                    if (mod && typeof mod.updateTrackGroup === 'function'
                        && typeof window.updateTrackGroup !== 'function') {
                        window.updateTrackGroup = mod.updateTrackGroup;
                    }
                }).catch(() => { /* safe to ignore */ });
            }
        }
    } catch (e) { /* ignore */ }

    // Wrap TrackGrouping's window.updateTrackGroup so any { collapsed } update is persisted.
    try {
        if (typeof window !== 'undefined' && typeof window.updateTrackGroup === 'function'
            && !window.updateTrackGroup.__tfcmWrapped) {
            const original = window.updateTrackGroup;
            const wrapped = function (groupId, updates, ...rest) {
                const result = original.apply(this, [groupId, updates, ...rest]);
                if (updates && Object.prototype.hasOwnProperty.call(updates, 'collapsed')) {
                    rememberFolderCollapse('group', groupId, !!updates.collapsed);
                }
                return result;
            };
            wrapped.__tfcmWrapped = true;
            window.updateTrackGroup = wrapped;
        }
    } catch (e) {
        console.warn('[TrackFolderCollapseMemory] Failed to wrap updateTrackGroup:', e);
    }

    // Wrap TrackStack's toggleStackCollapse (exported, not on window).
    try {
        if (typeof window !== 'undefined') {
            import('./TrackStack.js').then(mod => {
                if (mod && typeof mod.toggleStackCollapse === 'function'
                    && !mod.toggleStackCollapse.__tfcmWrapped) {
                    const originalToggle = mod.toggleStackCollapse;
                    const wrappedToggle = function (stackId, ...rest) {
                        const result = originalToggle.apply(this, [stackId, ...rest]);
                        try {
                            const stacks = (typeof mod.getTrackStacks === 'function')
                                ? mod.getTrackStacks() : {};
                            const stack = stacks && stacks[stackId];
                            if (stack) {
                                rememberFolderCollapse('stack', stackId, !!stack.isCollapsed);
                            }
                        } catch (innerE) { /* ignore */ }
                        return result;
                    };
                    wrappedToggle.__tfcmWrapped = true;
                    mod.toggleStackCollapse = wrappedToggle;
                }
            }).catch(() => { /* TrackStack may not be loaded yet - safe to ignore */ });
        }
    } catch (e) {
        console.warn('[TrackFolderCollapseMemory] TrackStack wrap setup failed:', e);
    }

    // Apply remembered state on init (in case any groups/stacks already exist
    // at app startup - e.g. from auto-save crash recovery).
    try {
        setTimeout(() => {
            const appliedGroups = applyRememberedCollapseToGroups();
            applyRememberedCollapseToStacks().then(appliedStacks => {
                const total = appliedGroups + appliedStacks;
                if (total > 0 && localAppServices.showSafeNotification) {
                    localAppServices.showSafeNotification(
                        `Restored collapse state for ${total} folder${total !== 1 ? 's' : ''}`,
                        2000
                    );
                }
            });
        }, 600);
    } catch (e) {
        console.warn('[TrackFolderCollapseMemory] Initial restore failed:', e);
    }

    console.log('[TrackFolderCollapseMemory] Initialized');
}
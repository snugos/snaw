/**
 * js/TrackInstrumentGrouping.js - Track Grouping by Instrument
 *
 * Right-click a track header → "Assign to Group: Drums / Bass / Lead / Pad / FX"
 * so mix presets and routing templates can target a logical bundle of
 * tracks. The 5 instrument groups are fixed (not user-named) and each
 * track can be in AT MOST ONE group at a time (assigning a track to a
 * new group removes it from the previous one). A dockable panel lists
 * all 5 groups with the tracks currently in each one and lets the
 * user ungroup / re-assign.
 *
 * Built on top of the existing per-track `track.role` field (which is
 * set when a track joins a group), so the same groups are visible to
 * the existing TrackRolePanel and the existing AI mix-assistant code
 * paths that already understand `role`. The new module just adds:
 *   1. The 5-group fixed taxonomy (Drums / Bass / Lead / Pad / FX)
 *   2. The "Assign to Group" submenu on the track-header right-click
 *   3. A dockable "Track Groups by Instrument" panel that shows the
 *      current mapping and lets the user move / remove tracks
 *   4. `getTracksByInstrumentGroup(role)` helper for mix presets and
 *      routing templates to consume
 *
 * Persistence: group membership is derived from each track's
 * `role` field (the role maps 1:1 to an instrument group — bass,
 * drums, synth → Lead, fx, etc. — see INSTRUMENT_GROUPS below). The
 * track.role field is already persisted in the project save data, so
 * the instrument groups survive a reload without separate storage.
 *
 * (v0.4.04)
 */

import {
    TRACK_ROLE_BASS,
    TRACK_ROLE_DRUMS,
    TRACK_ROLE_SYNTH,
    TRACK_ROLE_VOCAL,
    TRACK_ROLE_FX,
    TRACK_ROLE_OTHER,
    TRACK_ROLE_LABELS
} from './constants.js';

let localAppServices = {};
let isInitialized = false;
let isPanelOpen = false;
let lastRenderedAt = 0;

const WINDOW_ID = 'trackInstrumentGrouping';
const PANEL_CONTENT_ID = 'trackInstrumentGroupingContent';

/**
 * The 5 fixed instrument groups. The first 5 entries are the user-
 * visible groups; the last entry ("Other") is the implicit
 * fallback group for tracks whose role is "other" (still shown in
 * the panel so the user can see + move them).
 *
 * group.role === TRACK_ROLE_*, so joining a group is equivalent to
 * setting track.role. This is what makes the groups survive a page
 * reload via the existing track.role persistence — no separate
 * localStorage key is needed.
 */
const INSTRUMENT_GROUPS = [
    { role: TRACK_ROLE_DRUMS,  label: 'Drums',  icon: '🥁', color: '#dc2626', description: 'Drum kits, percussion, beat tracks' },
    { role: TRACK_ROLE_BASS,   label: 'Bass',   icon: '🔊', color: '#a16207', description: 'Bass lines, sub frequencies' },
    { role: TRACK_ROLE_SYNTH,  label: 'Lead',   icon: '🎛️', color: '#8b5cf6', description: 'Synth leads, vocals, lead instruments (any track carrying the melody)' },
    { role: TRACK_ROLE_FX,     label: 'FX',     icon: '✨', color: '#06b6d4', description: 'Sound effects, risers, impacts, transitions' },
    { role: TRACK_ROLE_OTHER,  label: 'Other',  icon: '🎵', color: '#64748b', description: 'Unclassified or one-off tracks' }
];

// Roles that belong to the "Lead" group (anything that can carry a
// lead / melody). The user picks "Lead" from the right-click menu
// and the code sets track.role to the first role in this list (Synth
// is the canonical "lead" role since the existing TrackRolePanel
// already uses it that way). Vocals are also lead-like so they
// count as Lead group too.
const LEAD_ROLES = new Set([TRACK_ROLE_SYNTH, TRACK_ROLE_VOCAL]);

/**
 * Resolve a role to its instrument group. Returns the INSTRUMENT_GROUPS
 * entry whose role matches, or the "Other" fallback.
 */
function groupForRole(role) {
    if (LEAD_ROLES.has(role)) {
        return INSTRUMENT_GROUPS.find(g => g.role === TRACK_ROLE_SYNTH);
    }
    return INSTRUMENT_GROUPS.find(g => g.role === role) || INSTRUMENT_GROUPS[INSTRUMENT_GROUPS.length - 1];
}

/**
 * Initialize the Track Instrument Grouping module.
 * @param {object} services - appServices
 */
export function initTrackInstrumentGrouping(services) {
    localAppServices = services || {};
    isInitialized = true;
    console.log('[TrackInstrumentGrouping v0.4.04] Initialized');
}

export function isTrackInstrumentGroupingInitialized() {
    return isInitialized;
}

export function isTrackInstrumentGroupingPanelOpen() {
    return isPanelOpen;
}

/**
 * Get the list of instrument groups (read-only).
 * @returns {Array} INSTRUMENT_GROUPS copy
 */
export function getInstrumentGroups() {
    return INSTRUMENT_GROUPS.map(g => ({ ...g }));
}

/**
 * Get all tracks that belong to a given instrument group.
 * @param {string} groupRole - The TRACK_ROLE_* identifier
 * @returns {Array} Array of track objects (may be empty)
 */
export function getTracksByInstrumentGroup(groupRole) {
    const tracks = (typeof localAppServices.getTracks === 'function')
        ? (localAppServices.getTracks() || [])
        : [];
    return tracks.filter(t => {
        if (!t) return false;
        if (t.type === 'Master' || t.type === 'Lyrics') return false;
        const role = (typeof t.getRole === 'function') ? t.getRole() : (t.role || 'none');
        if (groupRole === TRACK_ROLE_SYNTH) {
            return LEAD_ROLES.has(role);
        }
        if (groupRole === TRACK_ROLE_OTHER) {
            // "Other" is the catch-all group: any track whose role is
            // 'other' OR is ungrouped ('none') shows up here so the
            // user always has a place to find ungrouped tracks.
            return role === TRACK_ROLE_OTHER || role === 'none';
        }
        return role === groupRole;
    });
}

/**
 * Get a summary of all instrument groups and their member track counts.
 * Used by the start-menu "open for active track" path and by any future
 * mix-preset / routing-template consumer.
 * @returns {Array} [{ role, label, icon, color, count }, ...]
 */
export function getInstrumentGroupSummary() {
    return INSTRUMENT_GROUPS.map(g => ({
        role: g.role,
        label: g.label,
        icon: g.icon,
        color: g.color,
        count: getTracksByInstrumentGroup(g.role).length
    }));
}

/**
 * Assign a track to an instrument group. This is equivalent to setting
 * track.role to the group's role (with the LEAD_ROLES expansion for
 * the "Lead" group). Undo is captured by the underlying track.setRole.
 * @param {number} trackId
 * @param {string} groupRole - One of the INSTRUMENT_GROUPS roles
 * @returns {boolean} True on success
 */
export function assignTrackToInstrumentGroup(trackId, groupRole) {
    const track = (typeof localAppServices.getTrackById === 'function')
        ? localAppServices.getTrackById(trackId)
        : null;
    if (!track) return false;
    // "Lead" group covers synth + vocal; setting the role to "synth" is the
    // canonical mapping used by the existing TrackRolePanel.
    const targetRole = (groupRole === TRACK_ROLE_SYNTH) ? TRACK_ROLE_SYNTH : groupRole;
    if (typeof track.setRole === 'function') {
        track.setRole(targetRole, true);
    } else {
        track.role = targetRole;
    }
    return true;
}

/**
 * Remove a track from its current instrument group (set role to 'none').
 * @param {number} trackId
 * @returns {boolean} True on success
 */
export function unassignTrackFromInstrumentGroup(trackId) {
    const track = (typeof localAppServices.getTrackById === 'function')
        ? localAppServices.getTrackById(trackId)
        : null;
    if (!track) return false;
    if (typeof track.setRole === 'function') {
        track.setRole('none', true);
    } else {
        track.role = 'none';
    }
    return true;
}

/**
 * Build the right-click submenu items for a given track. The consumer
 * (TrackContextMenu or the dockable panel) calls this with the trackId
 * and a callback to invoke after assignment. Returns an array of
 * menu-item objects compatible with utils.createContextMenu.
 *
 * @param {number} trackId
 * @returns {Array} menu item objects
 */
export function getInstrumentGroupContextMenuItems(trackId) {
    const track = (typeof localAppServices.getTrackById === 'function')
        ? localAppServices.getTrackById(trackId)
        : null;
    if (!track) return [];
    // Master / Lyrics aren't groupable — they have no instrument role.
    if (track.type === 'Master' || track.type === 'Lyrics') return [];
    const currentRole = (typeof track.getRole === 'function') ? track.getRole() : (track.role || 'none');
    const currentGroup = groupForRole(currentRole);
    const items = [];
    items.push({ separator: true });
    items.push({ label: '🎼 Assign to Instrument Group', disabled: true });
    for (const g of INSTRUMENT_GROUPS) {
        const isCurrent = g === currentGroup;
        items.push({
            label: `${isCurrent ? '● ' : '   '}${g.icon} ${g.label}`,
            title: g.description,
            action: () => {
                const ok = assignTrackToInstrumentGroup(trackId, g.role);
                if (ok) {
                    localAppServices.showNotification?.(`Assigned "${track.name}" to ${g.icon} ${g.label} group`, 2000);
                }
                if (isPanelOpen) renderPanelContent();
            }
        });
    }
    // Only show the ungroup option if the track is currently in a group
    if (currentRole !== 'none') {
        items.push({ separator: true });
        items.push({
            label: '   ⊘ Remove from group',
            title: 'Clear the track\'s instrument group (role → none)',
            action: () => {
                const ok = unassignTrackFromInstrumentGroup(trackId);
                if (ok) {
                    localAppServices.showNotification?.(`Removed "${track.name}" from ${currentGroup.icon} ${currentGroup.label} group`, 2000);
                }
                if (isPanelOpen) renderPanelContent();
            }
        });
    }
    return items;
}

/**
 * Open (or focus) the dockable "Track Groups by Instrument" panel.
 * One window, focused if already open.
 * @returns {object|null} The window object
 */
export function openTrackInstrumentGroupingPanel() {
    if (isPanelOpen && typeof localAppServices.getOpenWindows === 'function') {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(WINDOW_ID)) {
            const existing = openWindows.get(WINDOW_ID);
            if (typeof existing.restore === 'function') existing.restore();
            renderPanelContent();
            return existing;
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = PANEL_CONTENT_ID;
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-y-auto';

    const options = {
        width: 560,
        height: 520,
        minWidth: 420,
        minHeight: 380,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true,
        onCloseCallback: () => { isPanelOpen = false; }
    };

    const win = (typeof localAppServices.createWindow === 'function')
        ? localAppServices.createWindow(WINDOW_ID, 'Track Groups by Instrument', contentContainer, options)
        : null;
    if (win && win.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

export function closeTrackInstrumentGroupingPanel() {
    isPanelOpen = false;
    if (typeof localAppServices.getOpenWindows === 'function') {
        const openWindows = localAppServices.getOpenWindows();
        const win = openWindows.get(WINDOW_ID);
        if (win && typeof win.close === 'function') {
            try { win.close(); } catch (e) { /* non-fatal */ }
        }
    }
}

/**
 * Render the panel content. Idempotent: safe to call from open() and
 * from any post-assignment refresh path.
 */
function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;
    lastRenderedAt = Date.now();

    const tracks = (typeof localAppServices.getTracks === 'function')
        ? (localAppServices.getTracks() || [])
        : [];
    const showNotification = localAppServices.showNotification || ((msg) => console.log(msg));

    // Filter out Master / Lyrics — they aren't groupable.
    const groupableTracks = tracks.filter(t => t && t.type !== 'Master' && t.type !== 'Lyrics');
    const groupedCount = groupableTracks.filter(t => {
        const r = (typeof t.getRole === 'function') ? t.getRole() : (t.role || 'none');
        return r !== 'none';
    }).length;

    let html = `
        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-start justify-between gap-2 mb-1">
                <div class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Track Groups by Instrument</div>
                <button
                    class="instrument-group-clear-all-btn text-[10px] px-2 py-0.5 rounded border border-gray-300 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-slate-600 dark:hover:text-red-300 dark:hover:border-red-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:disabled:hover:text-gray-300"
                    ${groupedCount === 0 ? 'disabled' : ''}
                    title="Remove every track from its instrument group"
                >Clear all</button>
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-300">
                Right-click any track header to assign it to <strong>Drums / Bass / Lead / FX / Other</strong>.
                Mix presets and routing templates can target a whole group at once.
                <span class="block mt-1 text-gray-500 dark:text-gray-400">${groupedCount} of ${groupableTracks.length} groupable track${groupableTracks.length === 1 ? '' : 's'} are currently in a group.</span>
            </div>
        </div>
    `;

    for (const g of INSTRUMENT_GROUPS) {
        const members = getTracksByInstrumentGroup(g.role);
        html += `
            <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 rounded flex items-center justify-center text-white text-sm flex-shrink-0" style="background-color: ${g.color}">
                        ${g.icon}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 dark:text-gray-200 text-sm">${escapeHtml(g.label)}</div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400">${escapeHtml(g.description)} · ${members.length} track${members.length === 1 ? '' : 's'}</div>
                    </div>
                </div>
                <div class="instrument-group-members" data-group-role="${g.role}">
        `;
        if (members.length === 0) {
            html += `<div class="text-[11px] italic text-gray-400 dark:text-gray-500 py-1">(no tracks yet — right-click a track header to assign)</div>`;
        } else {
            for (const t of members) {
                const tId = t.id != null ? String(t.id) : '';
                const tName = t.name || `Track ${tId}`;
                html += `
                    <div class="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-gray-100 dark:hover:bg-slate-600 text-xs" data-track-id="${tId}">
                        <span class="flex-1 truncate text-gray-700 dark:text-gray-200" title="${escapeHtml(tName)}">${escapeHtml(tName)}</span>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500">${escapeHtml(t.type || '')}</span>
                        <button class="instrument-group-remove-btn text-[10px] text-red-500 hover:text-red-300 px-1" data-track-id="${tId}" title="Remove from this group">✕</button>
                    </div>
                `;
            }
        }
        html += `</div></div>`;
    }

    // Tracks that are in a *specific* group (not the Other catch-all).
    const specificallyGrouped = groupableTracks.filter(t => {
        const r = (typeof t.getRole === 'function') ? t.getRole() : (t.role || 'none');
        return r !== 'none' && r !== 'other';
    });
    if (specificallyGrouped.length === 0 && groupableTracks.length > 0) {
        html += `
            <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div class="text-xs text-gray-500 dark:text-gray-400 italic">No tracks are currently in a Drums / Bass / Lead / FX group. All groupable tracks are in the <strong>Other</strong> group above — right-click any track header to assign it to a specific group.</div>
            </div>
        `;
    }

    container.innerHTML = html;
    wirePanelEvents(container, showNotification);
}

function wirePanelEvents(container, showNotification) {
    // Remove-from-group buttons
    container.querySelectorAll('.instrument-group-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tId = btn.dataset.trackId;
            const track = (typeof localAppServices.getTrackById === 'function')
                ? localAppServices.getTrackById(parseInt(tId, 10))
                : null;
            if (!track) return;
            const ok = unassignTrackFromInstrumentGroup(parseInt(tId, 10));
            if (ok) {
                showNotification?.(`Removed "${track.name}" from its instrument group`, 2000);
                renderPanelContent();
            }
        });
    });

    // Clear-all button: unassign every grouped track in one click.
    // Iterates over getInstrumentGroupSummary so we work from the same
    // role-derived membership view the panel renders (no chance of
    // missing a track that was assigned via the right-click submenu).
    const clearAllBtn = container.querySelector('.instrument-group-clear-all-btn');
    if (clearAllBtn && !clearAllBtn.disabled) {
        clearAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const summary = (typeof getInstrumentGroupSummary === 'function')
                ? getInstrumentGroupSummary()
                : { total: 0, grouped: 0, byGroup: {} };
            if (!summary.grouped) return;
            let removed = 0;
            for (const [role, count] of Object.entries(summary.byGroup || {})) {
                if (role === 'none') continue;
                const memberIds = (typeof getTracksByInstrumentGroup === 'function')
                    ? getTracksByInstrumentGroup(role).map(t => t && t.id).filter(id => id != null)
                    : [];
                for (const id of memberIds) {
                    if (unassignTrackFromInstrumentGroup(id)) removed++;
                }
            }
            showNotification?.(`Cleared instrument group from ${removed} track${removed === 1 ? '' : 's'}`, 2000);
            renderPanelContent();
        });
    }
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

console.log('[TrackInstrumentGrouping] Module loaded');

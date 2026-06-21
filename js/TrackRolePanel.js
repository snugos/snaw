// js/TrackRolePanel.js - Track Role Panel for marking tracks as Bass/Drums/Vocal/etc.
// Used by smart mix presets, AI assistants, and color-coding helpers to know what kind
// of audio a track carries. Roles are user-assigned metadata; selecting a role also
// optionally tints the track a sensible default color for the role.

import {
    TRACK_ROLE_NONE,
    TRACK_ROLE_BASS,
    TRACK_ROLE_DRUMS,
    TRACK_ROLE_VOCAL,
    TRACK_ROLE_GUITAR,
    TRACK_ROLE_KEYS,
    TRACK_ROLE_SYNTH,
    TRACK_ROLE_FX,
    TRACK_ROLE_OTHER,
    TRACK_ROLES,
    TRACK_ROLE_LABELS,
    TRACK_ROLE_ICONS
} from './constants.js';

const TRACK_ROLE_PANEL_VERSION = '0.1.0';

let localAppServices = {};
let currentTrackId = null;

// Default role → suggested track color (used when "Apply role color" is checked)
const ROLE_DEFAULT_COLORS = {
    [TRACK_ROLE_NONE]: '#3b82f6',
    [TRACK_ROLE_BASS]: '#a16207',
    [TRACK_ROLE_DRUMS]: '#dc2626',
    [TRACK_ROLE_VOCAL]: '#ec4899',
    [TRACK_ROLE_GUITAR]: '#f97316',
    [TRACK_ROLE_KEYS]: '#22c55e',
    [TRACK_ROLE_SYNTH]: '#8b5cf6',
    [TRACK_ROLE_FX]: '#06b6d4',
    [TRACK_ROLE_OTHER]: '#64748b'
};

/**
 * Initialize the track role panel module
 * @param {object} services - App services
 */
export function initTrackRolePanel(services) {
    localAppServices = services;
    console.log(`[TrackRolePanel v${TRACK_ROLE_PANEL_VERSION}] Initialized`);
}

/**
 * Open (or focus) the Track Role panel for a specific track
 * @param {number} trackId - Track ID to assign a role to
 */
export function openTrackRolePanel(trackId) {
    currentTrackId = trackId;
    const windowId = 'trackRole';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackRoleContent(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackRoleContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 360,
        height: 460,
        minWidth: 300,
        minHeight: 380,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Track Role', contentContainer, options);

    if (win?.element) {
        renderTrackRoleContent(trackId);
    }

    return win;
}

/**
 * Render the role panel content
 * @param {number} trackId
 */
function renderTrackRoleContent(trackId) {
    const container = document.getElementById('trackRoleContent');
    if (!container) return;

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        container.innerHTML = '<div class="p-4 text-red-500">Track not found</div>';
        return;
    }

    const currentRole = track.role || TRACK_ROLE_NONE;
    const currentColor = track.color || '#3b82f6';
    const showNotification = localAppServices.showNotification || ((msg, dur) => console.log(msg));

    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-8 h-8 rounded flex items-center justify-center text-white text-sm"
                    style="background-color: ${currentColor}">
                    ${TRACK_ROLE_ICONS[currentRole] || '⚪'}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-800 dark:text-gray-200 truncate">${escapeHtml(track.name || 'Unnamed Track')}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Current role:
                        <span class="font-semibold">${TRACK_ROLE_ICONS[currentRole] || '⚪'} ${TRACK_ROLE_LABELS[currentRole] || 'Unclassified'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mb-3">
            <div class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Assign Role</div>
            <div class="grid grid-cols-3 gap-2" id="trackRoleGrid">
    `;

    for (const role of TRACK_ROLES) {
        const isSelected = role === currentRole;
        const suggestedColor = ROLE_DEFAULT_COLORS[role] || '#3b82f6';
        html += `
            <button class="role-btn p-3 rounded border text-left transition-transform hover:scale-105 ${isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
                : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-500'}"
                data-role="${role}"
                title="Suggested color: ${suggestedColor}">
                <div class="text-xl mb-1">${TRACK_ROLE_ICONS[role] || '⚪'}</div>
                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">${TRACK_ROLE_LABELS[role] || role}</div>
            </button>
        `;
    }

    html += `</div>`;

    html += `
        <div class="mt-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" id="applyRoleColor" class="cursor-pointer">
                <span>Also tint track to role's default color</span>
            </label>
        </div>

        <div class="mt-3 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Actions</div>
            <div class="flex flex-wrap gap-2">
                <button id="clearRoleBtn" class="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">
                    Clear Role
                </button>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Roles are used by smart mix presets, AI assistants, and stem exporters
                to know what kind of audio a track carries.
            </div>
        </div>
    `;

    container.innerHTML = html;
    wireTrackRoleEvents(trackId, showNotification);
}

/**
 * Wire up event handlers for the role panel
 */
function wireTrackRoleEvents(trackId, showNotification) {
    const container = document.getElementById('trackRoleContent');
    if (!container) return;

    const applyColorCheckbox = container.querySelector('#applyRoleColor');

    container.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.dataset.role;
            const applyColor = !!applyColorCheckbox?.checked;
            applyRoleToTrack(trackId, role, applyColor, showNotification);
            renderTrackRoleContent(trackId);
        });
    });

    container.querySelector('#clearRoleBtn')?.addEventListener('click', () => {
        applyRoleToTrack(trackId, TRACK_ROLE_NONE, false, showNotification);
        renderTrackRoleContent(trackId);
    });
}

/**
 * Apply a role to a track (and optionally tint its color)
 */
function applyRoleToTrack(trackId, role, applyColor, showNotification) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;

    if (typeof track.setRole === 'function') {
        track.setRole(role, true);
    } else {
        track.role = role;
        if (localAppServices.updateTrackUI) {
            localAppServices.updateTrackUI(trackId, 'roleChanged');
        }
    }

    if (applyColor && role !== TRACK_ROLE_NONE) {
        const suggestedColor = ROLE_DEFAULT_COLORS[role];
        if (suggestedColor) {
            if (typeof track.setColor === 'function') {
                // false = programmatic, not a user interaction; color is bundled with the role undo
                track.setColor(suggestedColor, false);
            } else {
                track.color = suggestedColor;
            }
        }
    }

    if (localAppServices.renderTracks) {
        localAppServices.renderTracks();
    }

    const label = TRACK_ROLE_LABELS[role] || role;
    showNotification(`Track role set to ${TRACK_ROLE_ICONS[role] || ''} ${label}`, 1500);
}

/**
 * Get all tracks in the project grouped by their assigned role.
 * Used by smart mix presets and exporters.
 * @returns {Object} Map of role -> Array<{ id, name, color }>
 */
export function getTracksByRole() {
    const tracksState = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const grouped = {};
    for (const role of TRACK_ROLES) grouped[role] = [];

    for (const t of tracksState) {
        const role = t.role || TRACK_ROLE_NONE;
        if (!grouped[role]) grouped[role] = [];
        grouped[role].push({ id: t.id, name: t.name || `Track ${t.id}`, color: t.color || '#3b82f6', type: t.type });
    }
    return grouped;
}

/**
 * Get a summary string of all currently classified roles in the project
 * (e.g. "2 Drums · 1 Bass · 1 Vocal · 3 Unclassified").
 * @returns {string}
 */
export function getRoleSummary() {
    const grouped = getTracksByRole();
    const parts = [];
    for (const role of TRACK_ROLES) {
        if (grouped[role] && grouped[role].length > 0 && role !== TRACK_ROLE_NONE) {
            parts.push(`${grouped[role].length} ${TRACK_ROLE_LABELS[role]}`);
        }
    }
    const unclassified = grouped[TRACK_ROLE_NONE]?.length || 0;
    if (unclassified > 0) parts.push(`${unclassified} Unclassified`);
    return parts.join(' · ');
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Export for external use
export { TRACK_ROLE_PANEL_VERSION };

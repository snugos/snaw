// js/ClipStartOffset.js - Clip Start Offset Control
// Shift the playback start point within a clip without moving the clip on the timeline

import { getTracksState, getTrackByIdState } from './state.js';

let localAppServices = {};

export function initClipStartOffset(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipStartOffset] Initialized');
}

/**
 * Get the start offset for a clip
 * @param {string} clipId - Clip ID
 * @returns {number} Start offset in seconds (default 0)
 */
export function getClipStartOffset(clipId) {
    const { clip } = findClipById(clipId);
    return clip?.startOffset ?? 0;
}

/**
 * Set the start offset for a clip
 * @param {string} clipId - Clip ID
 * @param {number} offset - Start offset in seconds
 * @returns {boolean} Success
 */
export function setClipStartOffset(clipId, offset) {
    const { clip, track } = findClipById(clipId);
    if (!clip) {
        console.warn('[ClipStartOffset] Clip not found:', clipId);
        return false;
    }

    // Validate: offset cannot exceed clip duration
    const maxOffset = clip.duration > 0 ? clip.duration - 0.01 : 0;
    clip.startOffset = Math.max(0, Math.min(offset, maxOffset));

    console.log(`[ClipStartOffset] Clip "${clip.name}" startOffset set to ${clip.startOffset.toFixed(3)}s`);
    return true;
}

/**
 * Reset start offset to 0
 * @param {string} clipId - Clip ID
 * @returns {boolean} Success
 */
export function resetClipStartOffset(clipId) {
    return setClipStartOffset(clipId, 0);
}

/**
 * Check if a clip has a non-zero start offset
 * @param {string} clipId - Clip ID
 * @returns {boolean} True if offset > 0
 */
export function hasClipStartOffset(clipId) {
    const offset = getClipStartOffset(clipId);
    return offset > 0;
}

// Find a clip by ID across all tracks' timelineClips
function findClipById(clipId) {
    const tracks = getTracksState();
    for (const track of tracks) {
        if (track.timelineClips) {
            const clip = track.timelineClips.find(c => c.id === clipId);
            if (clip) return { clip, track };
        }
    }
    return { clip: null, track: null };
}

/**
 * Open the clip start offset panel for a specific clip
 * @param {string} clipId - Clip ID
 */
export function openClipStartOffsetPanel(clipId) {
    const { clip, track } = findClipById(clipId);
    if (!clip) {
        console.warn('[ClipStartOffset] Clip not found:', clipId);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Clip not found', 2000);
        }
        return;
    }

    const windowId = `clipStartOffset-${clipId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = `clipStartOffsetContent-${clipId}`;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const options = {
        width: 400,
        height: 300,
        minWidth: 300,
        minHeight: 200,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, `Start Offset - ${clip.name}`, contentContainer, options);

    if (win?.element) {
        setTimeout(() => renderClipStartOffsetContent(clipId), 50);
    }

    return win;
}

/**
 * Render the clip start offset panel content
 * @param {string} clipId - Clip ID
 */
function renderClipStartOffsetContent(clipId) {
    const container = document.getElementById(`clipStartOffsetContent-${clipId}`);
    if (!container) return;

    const { clip, track } = findClipById(clipId);
    if (!clip) return;

    const currentOffset = clip.startOffset ?? 0;
    const duration = clip.duration || 0;
    const maxOffset = duration > 0 ? duration : 0;

    container.innerHTML = `
        <div class="mb-4 text-sm text-gray-400">
            Shift where audio playback begins within this clip, without moving the clip on the timeline.
        </div>
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Clip Duration</span>
                <span class="text-sm text-white font-mono">${duration.toFixed(3)}s</span>
            </div>
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Current Offset</span>
                <span class="text-sm text-white font-mono" id="currentOffsetDisplay">${currentOffset.toFixed(3)}s</span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-400">Remaining Playable</span>
                <span class="text-sm text-white font-mono" id="remainingDisplay">${(duration - currentOffset).toFixed(3)}s</span>
            </div>
        </div>
        <div class="mb-4">
            <label class="block text-sm text-gray-400 mb-2">Start Offset (seconds)</label>
            <div class="flex items-center gap-3">
                <input type="range" id="offsetSlider"
                    min="0" max="${maxOffset}" step="0.001"
                    value="${currentOffset}"
                    class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                <input type="number" id="offsetInput"
                    min="0" max="${maxOffset}" step="0.001"
                    value="${currentOffset}"
                    class="w-24 p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm text-center">
            </div>
        </div>
        <div class="mb-4 flex gap-2">
            <button id="resetOffsetBtn" class="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-500">
                Reset to 0
            </button>
            <button id="closeOffsetBtn" class="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 flex-1">
                Done
            </button>
        </div>
        <div class="text-xs text-gray-500">
            <p>Note: Offset cannot exceed clip duration. Adjusting the offset is non-destructive.</p>
        </div>
    `;

    const slider = document.getElementById('offsetSlider');
    const input = document.getElementById('offsetInput');
    const currentDisplay = document.getElementById('currentOffsetDisplay');
    const remainingDisplay = document.getElementById('remainingDisplay');

    function updateOffset(value) {
        const offset = Math.max(0, Math.min(parseFloat(value), maxOffset));
        currentDisplay.textContent = `${offset.toFixed(3)}s`;
        remainingDisplay.textContent = `${(duration - offset).toFixed(3)}s`;
        setClipStartOffset(clipId, offset);
    }

    slider?.addEventListener('input', (e) => {
        const value = e.target.value;
        input.value = parseFloat(value).toFixed(3);
        updateOffset(value);
    });

    input?.addEventListener('input', (e) => {
        const value = e.target.value;
        slider.value = parseFloat(value);
        updateOffset(value);
    });

    document.getElementById('resetOffsetBtn')?.addEventListener('click', () => {
        input.value = '0';
        slider.value = '0';
        updateOffset(0);
    });

    document.getElementById('closeOffsetBtn')?.addEventListener('click', () => {
        const winId = `clipStartOffset-${clipId}`;
        const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
        if (openWindows.has(winId)) {
            openWindows.get(winId).close();
        }
    });
}

console.log('[ClipStartOffset] Module loaded');
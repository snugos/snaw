/**
 * js/TimelineClipOperations.js - Multi-Select Timeline Clip Operations
 * Provides move, copy, cut, paste, delete, and duplicate operations for selected clips
 */

let localAppServices = {};
let localGetTracks = null;
let localGetTrackById = null;
let localCaptureStateForUndo = null;
let localRenderTimeline = null;
let localIsClipLocked = null;

/**
 * Initialize the timeline clip operations module
 * @param {object} appServices - The main appServices object from main.js
 */
export function initTimelineClipOperations(appServices) {
    localAppServices = appServices;
    localGetTracks = appServices.getTracks || (() => []);
    localGetTrackById = appServices.getTrackById || (() => null);
    localCaptureStateForUndo = appServices.captureStateForUndo || ((desc) => {});
    localRenderTimeline = appServices.renderTimeline || (() => {});
    localIsClipLocked = appServices.isClipLocked || (() => false);

    // Register functions in appServices
    appServices.moveSelectedClips = moveSelectedClips;
    appServices.groupEditClips = groupEditClips;
    appServices.copySelectedClips = copySelectedClips;
    appServices.cutSelectedClips = cutSelectedClips;
    appServices.pasteClips = pasteClips;
    appServices.deleteTimelineClips = deleteTimelineClips;
    appServices.duplicateTimelineClips = duplicateTimelineClips;

    console.log('[TimelineClipOperations] Initialized - multi-select clip operations enabled');
}

/**
 * Move multiple clips by a time offset
 * @param {Array} clipIds - Array of clip ID strings
 * @param {number} delta - Time offset in seconds (positive = later, negative = earlier)
 * @returns {object} Result object with success and movedCount
 */
export function moveSelectedClips(clipIds, delta) {
    if (!clipIds || clipIds.length === 0) {
        return { success: false, message: 'No clips selected' };
    }
    if (typeof delta !== 'number' || delta === 0) {
        return { success: false, message: 'No time delta provided' };
    }

    const tracks = localGetTracks();
    let movedCount = 0;

    // Group clips by track
    const clipsByTrack = new Map();
    clipIds.filter(clipId => !localIsClipLocked(clipId)).forEach(clipId => {
        for (const track of tracks) {
            const clip = track.timelineClips?.find(c => c.id === clipId);
            if (clip) {
                if (!clipsByTrack.has(track.id)) {
                    clipsByTrack.set(track.id, []);
                }
                clipsByTrack.get(track.id).push(clip);
                break;
            }
        }
    });

    // Move clips on each track
    clipsByTrack.forEach((clips, trackId) => {
        const track = localGetTrackById(trackId);
        if (track && track.type === 'Audio') {
            clips.forEach(clip => {
                const newStartTime = Math.max(0, clip.startTime + delta);
                if (newStartTime !== clip.startTime) {
                    clip.startTime = newStartTime;
                    movedCount++;
                }
            });
        }
    });

    if (movedCount > 0) {
        localRenderTimeline();
        console.log(`[TimelineClipOperations] Moved ${movedCount} clips by ${delta}s`);
    }

    return { success: true, movedCount, message: `Moved ${movedCount} clip(s)` };
}

/**
 * Apply group edit operation to multiple clips (gain, volume, etc.)
 * @param {Array} clipIds - Array of clip ID strings
 * @param {string} property - Property to edit ('gain', 'volume', 'pan', etc.)
 * @param {any} value - New value for the property
 * @returns {object} Result object with success and affectedCount
 */
export function groupEditClips(clipIds, property, value) {
    if (!clipIds || clipIds.length === 0) {
        return { success: false, message: 'No clips selected' };
    }

    const tracks = localGetTracks();
    let affectedCount = 0;

    clipIds.forEach(clipId => {
        for (const track of tracks) {
            const clip = track.timelineClips?.find(c => c.id === clipId);
            if (clip) {
                switch (property) {
                    case 'gain':
                        if (typeof value === 'number') {
                            clip.gain = Math.max(0, Math.min(2, value));
                            affectedCount++;
                        }
                        break;
                    case 'volume':
                        if (typeof value === 'number') {
                            clip.volume = Math.max(-60, Math.min(12, value));
                            affectedCount++;
                        }
                        break;
                    case 'pan':
                        if (typeof value === 'number') {
                            clip.pan = Math.max(-1, Math.min(1, value));
                            affectedCount++;
                        }
                        break;
                    case 'color':
                        if (typeof value === 'string') {
                            clip.color = value;
                            affectedCount++;
                        }
                        break;
                }
                break;
            }
        }
    });

    if (affectedCount > 0) {
        localRenderTimeline();
        console.log(`[TimelineClipOperations] Applied ${property}=${value} to ${affectedCount} clips`);
    }

    return { success: true, affectedCount, message: `Edited ${affectedCount} clip(s)` };
}

/**
 * Copy selected clips to clipboard
 * @param {Array} clipIds - Array of clip ID strings
 * @returns {object} Result object with success and copiedCount
 */
export function copySelectedClips(clipIds) {
    if (!clipIds || clipIds.length === 0) {
        return { success: false, message: 'No clips selected' };
    }

    const tracks = localGetTracks();
    const clipboard = [];

    clipIds.forEach(clipId => {
        for (const track of tracks) {
            const clip = track.timelineClips?.find(c => c.id === clipId);
            if (clip) {
                clipboard.push({
                    ...JSON.parse(JSON.stringify(clip)),
                    sourceTrackId: track.id
                });
                break;
            }
        }
    });

    // Store in localStorage for persistence
    try {
        localStorage.setItem('snawClipClipboard', JSON.stringify(clipboard));
    } catch (e) {
        console.warn('[TimelineClipOperations] Failed to save clipboard to localStorage:', e);
    }

    console.log(`[TimelineClipOperations] Copied ${clipboard.length} clips to clipboard`);

    return { success: true, copiedCount: clipboard.length, message: `Copied ${clipboard.length} clip(s)` };
}

/**
 * Cut selected clips to clipboard
 * @param {Array} clipIds - Array of clip ID strings
 * @returns {object} Result object with success and cutCount
 */
export function cutSelectedClips(clipIds) {
    if (!clipIds || clipIds.length === 0) {
        return { success: false, message: 'No clips selected' };
    }

    const editableClipIds = clipIds.filter(clipId => !localIsClipLocked(clipId));
    if (editableClipIds.length === 0) {
        localAppServices.notifyClipLocked?.('cut');
        return { success: false, message: 'Selected clips are locked' };
    }
    if (editableClipIds.length !== clipIds.length) localAppServices.notifyClipLocked?.('cut');

    // First copy
    const copyResult = copySelectedClips(editableClipIds);
    if (!copyResult.success) {
        return copyResult;
    }

    const tracks = localGetTracks();
    let cutCount = 0;

    // Then delete from tracks
    editableClipIds.forEach(clipId => {
        for (const track of tracks) {
            if (track.timelineClips) {
                const idx = track.timelineClips.findIndex(c => c.id === clipId);
                if (idx !== -1) {
                    track.timelineClips.splice(idx, 1);
                    cutCount++;
                    break;
                }
            }
        }
    });

    if (cutCount > 0) {
        localRenderTimeline();
        console.log(`[TimelineClipOperations] Cut ${cutCount} clips`);
    }

    return { success: true, cutCount, message: `Cut ${cutCount} clip(s)` };
}

/**
 * Paste clips from clipboard to a track
 * @param {number} trackId - Target track ID
 * @param {number} startTime - Time to start pasting (0 = use original times)
 * @returns {object} Result object with success and pastedCount
 */
export function pasteClips(trackId, startTime = 0) {
    let clipboard = [];
    try {
        const stored = localStorage.getItem('snawClipClipboard');
        if (stored) {
            clipboard = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('[TimelineClipOperations] Failed to load clipboard from localStorage:', e);
        return { success: false, message: 'Clipboard empty or corrupted' };
    }

    if (!clipboard || clipboard.length === 0) {
        return { success: false, message: 'Clipboard empty' };
    }

    const track = localGetTrackById(trackId);
    if (!track || track.type !== 'Audio') {
        return { success: false, message: 'Invalid target track' };
    }

    const originalStart = clipboard[0].startTime;
    let pastedCount = 0;

    clipboard.forEach(clipData => {
        const newClip = {
            ...clipData,
            id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: startTime === 0 ? clipData.startTime : (clipData.startTime - originalStart + startTime)
        };
        delete newClip.sourceTrackId;
        track.timelineClips.push(newClip);
        pastedCount++;
    });

    // Sort timeline clips by start time
    track.timelineClips.sort((a, b) => a.startTime - b.startTime);

    localRenderTimeline();
    console.log(`[TimelineClipOperations] Pasted ${pastedCount} clips to track ${trackId}`);

    return { success: true, pastedCount, message: `Pasted ${pastedCount} clip(s)` };
}

/**
 * Delete multiple clips from timeline
 * @param {Array} clipIds - Array of clip ID strings
 * @returns {object} Result object with success and deletedCount
 */
export function deleteTimelineClips(clipIds) {
    if (!clipIds || clipIds.length === 0) {
        return { success: false, message: 'No clips selected' };
    }

    const editableClipIds = clipIds.filter(clipId => !localIsClipLocked(clipId));
    if (editableClipIds.length === 0) {
        localAppServices.notifyClipLocked?.('delete');
        return { success: false, message: 'Selected clips are locked' };
    }
    if (editableClipIds.length !== clipIds.length) localAppServices.notifyClipLocked?.('delete');

    const tracks = localGetTracks();
    let deletedCount = 0;

    editableClipIds.forEach(clipId => {
        for (const track of tracks) {
            if (track.timelineClips) {
                const idx = track.timelineClips.findIndex(c => c.id === clipId);
                if (idx !== -1) {
                    track.timelineClips.splice(idx, 1);
                    deletedCount++;
                    break;
                }
            }
        }
    });

    if (deletedCount > 0) {
        localRenderTimeline();
        console.log(`[TimelineClipOperations] Deleted ${deletedCount} clips`);
    }

    return { success: true, deletedCount, message: `Deleted ${deletedCount} clip(s)` };
}

/**
 * Duplicate multiple clips on the timeline
 * @param {Array} clipIds - Array of clip ID strings
 * @param {number} offset - Time offset for duplicated clips (default: 1 second)
 * @returns {object} Result object with success and duplicatedCount
 */
export function duplicateTimelineClips(clipIds, offset = 1) {
    if (!clipIds || clipIds.length === 0) {
        return { success: false, message: 'No clips selected' };
    }

    const editableClipIds = clipIds.filter(clipId => !localIsClipLocked(clipId));
    if (editableClipIds.length === 0) {
        localAppServices.notifyClipLocked?.('duplicate');
        return { success: false, message: 'Selected clips are locked' };
    }
    if (editableClipIds.length !== clipIds.length) localAppServices.notifyClipLocked?.('duplicate');

    const tracks = localGetTracks();
    const newClipIds = [];

    editableClipIds.forEach(clipId => {
        for (const track of tracks) {
            const clip = track.timelineClips?.find(c => c.id === clipId);
            if (clip) {
                const newClip = {
                    ...JSON.parse(JSON.stringify(clip)),
                    id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    startTime: clip.startTime + offset,
                    name: `${clip.name} (copy)`
                };
                track.timelineClips.push(newClip);
                newClipIds.push(newClip.id);
                break;
            }
        }
    });

    if (newClipIds.length > 0) {
        // Sort timeline clips by start time
        tracks.forEach(track => {
            if (track.timelineClips) {
                track.timelineClips.sort((a, b) => a.startTime - b.startTime);
            }
        });
        localRenderTimeline();
        console.log(`[TimelineClipOperations] Duplicated ${newClipIds.length} clips`);
    }

    return { success: true, duplicatedCount: newClipIds.length, newClipIds, message: `Duplicated ${newClipIds.length} clip(s)` };
}
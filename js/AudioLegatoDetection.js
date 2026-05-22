/**
 * Audio Legato Detection
 * Automatically detect and link consecutive audio events in audio clips
 * for visual grouping and intelligent editing
 */

let localAppServices = {};
let legatoGroups = [];
let isInitialized = false;

/**
 * Initialize the legato detection module
 */
export function initAudioLegatoDetection(services) {
    localAppServices = services;
    isInitialized = true;
    legatoGroups = [];
    console.log('[AudioLegatoDetection] Initialized');
}

/**
 * Detect legato groups in an audio buffer
 * Legato = consecutive onsets/transients that are close in time
 * @param {AudioBuffer} buffer - Audio buffer to analyze
 * @param {Object} options - Detection options
 * @returns {Array} Array of legato groups
 */
export function detectLegatoGroups(buffer, options = {}) {
    if (!buffer) {
        console.error('[AudioLegatoDetection] No buffer provided');
        return [];
    }

    const {
        threshold = 0.3,        // Energy threshold for transient detection
        minInterval = 0.05,    // Minimum seconds between events
        maxInterval = 0.5,     // Maximum seconds for legato linking
        windowSize = 0.01      // Analysis window in seconds
    } = options;

    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);
    const windowSamples = Math.floor(windowSize * sampleRate);
    const minIntervalSamples = Math.floor(minInterval * sampleRate);
    const maxIntervalSamples = Math.floor(maxInterval * sampleRate);

    // Step 1: Find all transients/onsets
    const events = [];
    let lastEvent = -minIntervalSamples;
    let prevEnergy = 0;

    for (let i = windowSamples; i < channelData.length - windowSamples; i += windowSamples) {
        let energy = 0;
        for (let j = 0; j < windowSamples; j++) {
            energy += channelData[i - windowSamples + j] ** 2;
        }
        energy = Math.sqrt(energy / windowSamples);

        const energyDiff = energy - prevEnergy;

        if (energyDiff > threshold && i - lastEvent > minIntervalSamples) {
            events.push({
                sample: i,
                time: i / sampleRate,
                strength: energyDiff,
                energy: energy
            });
            lastEvent = i;
        }

        prevEnergy = energy * 0.9;
    }

    console.log(`[AudioLegatoDetection] Found ${events.length} events`);

    // Step 2: Group consecutive events that are close together (legato)
    legatoGroups = [];
    let currentGroup = null;

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const prevEvent = i > 0 ? events[i - 1] : null;

        if (!currentGroup) {
            // Start new group
            currentGroup = {
                id: `legato-${legatoGroups.length}`,
                events: [event],
                startTime: event.time,
                endTime: event.time,
                duration: 0
            };
        } else if (prevEvent) {
            const gap = event.sample - prevEvent.sample;

            if (gap <= maxIntervalSamples) {
                // Add to current group (legato)
                currentGroup.events.push(event);
                currentGroup.endTime = event.time;
            } else {
                // Close current group, start new one
                currentGroup.duration = currentGroup.endTime - currentGroup.startTime;
                if (currentGroup.events.length > 1) {
                    legatoGroups.push(currentGroup);
                }
                currentGroup = {
                    id: `legato-${legatoGroups.length}`,
                    events: [event],
                    startTime: event.time,
                    endTime: event.time,
                    duration: 0
                };
            }
        }
    }

    // Don't forget the last group
    if (currentGroup && currentGroup.events.length > 1) {
        currentGroup.duration = currentGroup.endTime - currentGroup.startTime;
        legatoGroups.push(currentGroup);
    }

    console.log(`[AudioLegatoDetection] Created ${legatoGroups.length} legato groups`);
    return legatoGroups;
}

/**
 * Get all detected legato groups
 */
export function getLegatoGroups() {
    return legatoGroups;
}

/**
 * Get legato groups for a specific track and clip
 */
export function getLegatoGroupsForClip(trackId, clipId) {
    return legatoGroups.filter(g => g.trackId === trackId && g.clipId === clipId);
}

/**
 * Link two consecutive notes in an audio clip as legato
 */
export function linkAsLegato(trackId, clipId, event1Time, event2Time) {
    const group = {
        id: `legato-manual-${Date.now()}`,
        trackId: trackId,
        clipId: clipId,
        events: [
            { time: event1Time },
            { time: event2Time }
        ],
        startTime: event1Time,
        endTime: event2Time,
        duration: event2Time - event1Time,
        manual: true
    };
    legatoGroups.push(group);
    console.log(`[AudioLegatoDetection] Manually linked events at ${event1Time}s and ${event2Time}s`);
    return group;
}

/**
 * Unlink/break a legato group
 */
export function unlinkLegato(groupId) {
    const index = legatoGroups.findIndex(g => g.id === groupId);
    if (index >= 0) {
        legatoGroups.splice(index, 1);
        console.log(`[AudioLegatoDetection] Unlinked group ${groupId}`);
        return true;
    }
    return false;
}

/**
 * Open the legato detection panel for a track
 */
export function openLegatoDetectionPanel(trackId) {
    const windowId = `legato-detection-${trackId}`;
    const existingWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (existingWindows.has(windowId)) {
        const win = existingWindows.get(windowId);
        win.restore();
        return win;
    }

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = `legatoContent-${trackId}`;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const options = {
        width: 400,
        height: 350,
        minWidth: 300,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(windowId, `Legato Detection - ${track.name}`, contentContainer, options);

    if (win?.element) {
        setTimeout(() => renderLegatoPanel(trackId), 50);
    }

    return win;
}

/**
 * Render the legato panel content
 */
function renderLegatoPanel(trackId) {
    const container = document.getElementById(`legatoContent-${trackId}`);
    if (!container) return;

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;

    // Get audio clips from track
    const clips = track.timelineClips || [];

    let html = `
        <div class="mb-4 text-sm text-gray-400">
            Auto-detect linked consecutive notes in audio clips for easier editing.
        </div>
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-300 mb-2">Detection Settings</h3>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-500 block mb-1">Max Gap (seconds)</label>
                    <input type="number" id="legatoMaxGap" value="0.3" step="0.05" min="0.1" max="2" 
                           class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white">
                </div>
                <div>
                    <label class="text-xs text-gray-500 block mb-1">Energy Threshold</label>
                    <input type="number" id="legatoThreshold" value="0.3" step="0.05" min="0.1" max="1" 
                           class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white">
                </div>
            </div>
        </div>
    `;

    if (clips.length > 0) {
        html += `
            <div class="mb-4">
                <h3 class="text-sm font-semibold text-gray-300 mb-2">Audio Clips</h3>
                <div class="space-y-2 max-h-40 overflow-y-auto">
        `;

        for (const clip of clips) {
            html += `
                <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-white">${clip.name || clip.id}</span>
                    </div>
                    <button class="detect-legato-btn px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded" 
                            data-clip-id="${clip.id}">
                        Detect
                    </button>
                </div>
            `;
        }

        html += `</div></div>`;
    }

    // Show detected groups
    if (legatoGroups.length > 0) {
        html += `
            <div>
                <h3 class="text-sm font-semibold text-gray-300 mb-2">Detected Groups (${legatoGroups.length})</h3>
                <div class="space-y-2 max-h-40 overflow-y-auto">
        `;

        for (const group of legatoGroups) {
            html += `
                <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400">${group.events.length} notes</span>
                        <span class="text-xs text-gray-500">${group.startTime.toFixed(2)}s - ${group.endTime.toFixed(2)}s</span>
                    </div>
                    <button class="unlink-legato-btn px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded" 
                            data-group-id="${group.id}">
                        Unlink
                    </button>
                </div>
            `;
        }

        html += `</div></div>`;
    } else {
        html += `
            <div class="text-center py-8 text-gray-500">
                <p>No legato groups detected yet.</p>
                <p class="text-xs mt-2">Click "Detect" on a clip to analyze it.</p>
            </div>
        `;
    }

    container.innerHTML = html;

    // Setup event handlers
    container.querySelectorAll('.detect-legato-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const clipId = btn.dataset.clipId;
            const clip = clips.find(c => c.id === clipId);
            if (clip && clip.audioBuffer) {
                const maxGap = parseFloat(document.getElementById('legatoMaxGap')?.value || 0.3);
                const threshold = parseFloat(document.getElementById('legatoThreshold')?.value || 0.3);

                detectLegatoGroups(clip.audioBuffer, {
                    maxInterval: maxGap,
                    threshold: threshold
                });

                // Tag groups with track/clip info
                legatoGroups.forEach(g => {
                    g.trackId = trackId;
                    g.clipId = clipId;
                });

                localAppServices.showNotification?.(`Detected ${legatoGroups.length} legato groups`, 2000);
                renderLegatoPanel(trackId);
            } else {
                localAppServices.showNotification?.('No audio buffer in clip', 2000);
            }
        });
    });

    container.querySelectorAll('.unlink-legato-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const groupId = btn.dataset.groupId;
            if (unlinkLegato(groupId)) {
                renderLegatoPanel(trackId);
            }
        });
    });
}

console.log('[AudioLegatoDetection] Module loaded');
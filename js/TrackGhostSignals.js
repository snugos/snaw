// js/TrackGhostSignals.js - Show faint visual overlay of other tracks' waveforms for visual reference
import { getTracksState, getTrackByIdState } from './state.js';

let localAppServices = {};
let ghostSignalConfig = new Map(); // trackId -> { enabled: boolean, opacity: number, color: string }
let ghostSignalPanel = null;

// Default ghost signal settings
const DEFAULT_OPACITY = 0.15;
const DEFAULT_COLOR = '#ffffff';

export function initTrackGhostSignals(appServices) {
    localAppServices = appServices || {};
    console.log('[TrackGhostSignals] Initialized');
}

/**
 * Enable or disable ghost signal for a track
 * @param {number} trackId - The track ID to show ghost signal for
 * @param {boolean} enabled - Enable/disable
 */
export function setGhostSignalEnabled(trackId, enabled) {
    if (!ghostSignalConfig.has(trackId)) {
        ghostSignalConfig.set(trackId, { enabled: false, opacity: DEFAULT_OPACITY, color: DEFAULT_COLOR });
    }
    const config = ghostSignalConfig.get(trackId);
    config.enabled = !!enabled;
    console.log(`[TrackGhostSignals] Track ${trackId} ghost signal: ${enabled ? 'ON' : 'OFF'}`);
}

/**
 * Set ghost signal opacity for a track
 * @param {number} trackId - The track ID
 * @param {number} opacity - Opacity 0-1
 */
export function setGhostSignalOpacity(trackId, opacity) {
    if (!ghostSignalConfig.has(trackId)) {
        ghostSignalConfig.set(trackId, { enabled: false, opacity: DEFAULT_OPACITY, color: DEFAULT_COLOR });
    }
    ghostSignalConfig.get(trackId).opacity = Math.max(0.05, Math.min(0.5, parseFloat(opacity) || DEFAULT_OPACITY));
}

/**
 * Set ghost signal color for a track
 * @param {number} trackId - The track ID
 * @param {string} color - Hex color string
 */
export function setGhostSignalColor(trackId, color) {
    if (!ghostSignalConfig.has(trackId)) {
        ghostSignalConfig.set(trackId, { enabled: false, opacity: DEFAULT_OPACITY, color: DEFAULT_COLOR });
    }
    ghostSignalConfig.get(trackId).color = color || DEFAULT_COLOR;
}

/**
 * Get ghost signal configuration for a track
 * @param {number} trackId - The track ID
 * @returns {object} Ghost signal config
 */
export function getGhostSignalConfig(trackId) {
    if (!ghostSignalConfig.has(trackId)) {
        ghostSignalConfig.set(trackId, { enabled: false, opacity: DEFAULT_OPACITY, color: DEFAULT_COLOR });
    }
    return { ...ghostSignalConfig.get(trackId) };
}

/**
 * Get all tracks that have ghost signals enabled
 * @returns {Array} Array of track IDs with ghost signals enabled
 */
export function getEnabledGhostSignals() {
    const enabled = [];
    ghostSignalConfig.forEach((config, trackId) => {
        if (config.enabled) {
            enabled.push({ trackId, ...config });
        }
    });
    return enabled;
}

/**
 * Toggle ghost signal for a track
 * @param {number} trackId - The track ID
 * @returns {boolean} New enabled state
 */
export function toggleGhostSignal(trackId) {
    if (!ghostSignalConfig.has(trackId)) {
        ghostSignalConfig.set(trackId, { enabled: false, opacity: DEFAULT_OPACITY, color: DEFAULT_COLOR });
    }
    const config = ghostSignalConfig.get(trackId);
    config.enabled = !config.enabled;
    console.log(`[TrackGhostSignals] Track ${trackId} ghost signal toggled: ${config.enabled ? 'ON' : 'OFF'}`);
    return config.enabled;
}

/**
 * Render ghost signals (faint waveforms) on the timeline canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} timelineTop - Y position where timeline starts
 * @param {number} pixelsPerSecond - Pixels per second scale
 * @param {number} playheadPosition - Current playhead position
 * @param {number} scrollLeft - Scroll offset in pixels
 */
export function renderGhostSignalsOnCanvas(ctx, timelineTop, pixelsPerSecond, playheadPosition, scrollLeft) {
    const enabledGhosts = getEnabledGhostSignals();
    if (enabledGhosts.length === 0) return;

    const tracks = getTracksState();
    const trackHeight = localAppServices.getTrackHeight ? localAppServices.getTrackHeight() : 80;

    enabledGhosts.forEach(ghost => {
        const sourceTrack = tracks.find(t => t.id === ghost.trackId);
        if (!sourceTrack || !sourceTrack.timelineClips || sourceTrack.timelineClips.length === 0) return;

        // Draw ghost waveform for each clip in the source track
        sourceTrack.timelineClips.forEach(clip => {
            if (!clip.audioBuffer) return;

            const clipX = (clip.start - scrollLeft / pixelsPerSecond) * pixelsPerSecond;
            const clipWidth = clip.duration * pixelsPerSecond;

            // Skip if completely off-screen
            if (clipX + clipWidth < 0 || clipX > ctx.canvas.width) return;

            // Calculate which track lane to draw in (we draw ghost in the track that is "receiving" the ghost)
            // For simplicity, we'll render ghosts in a dedicated ghost track layer
            // The actual position is determined by the ghost's own timeline position

            ctx.save();
            ctx.globalAlpha = ghost.opacity;

            // Draw simplified waveform representation
            const peaks = getClipWaveformPeaks(clip, Math.max(10, Math.floor(clipWidth / 3)));
            if (!peaks || peaks.length === 0) {
                ctx.restore();
                return;
            }

            const barWidth = Math.max(1, clipWidth / peaks.length);
            const centerY = timelineTop + 40; // Center of track height
            const maxHeight = trackHeight * 0.6;

            ctx.fillStyle = ghost.color;

            peaks.forEach((peak, i) => {
                const x = clipX + i * barWidth;
                const barHeight = peak * maxHeight;

                // Draw mirrored waveform
                ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight * 2);
            });

            ctx.restore();
        });
    });
}

/**
 * Get waveform peaks for a clip
 * @param {object} clip - Audio clip object
 * @param {number} targetPeaks - Number of peak points
 * @returns {Float32Array|null} Peak data
 */
function getClipWaveformPeaks(clip, targetPeaks = 100) {
    if (!clip.audioBuffer) return null;

    const buffer = clip.audioBuffer;
    const channelData = buffer.getChannelData ? buffer.getChannelData(0) : null;
    if (!channelData) return null;

    const samplesPerPeak = Math.max(1, Math.floor(channelData.length / targetPeaks));
    const peaks = new Float32Array(targetPeaks);

    for (let i = 0; i < targetPeaks; i++) {
        const start = i * samplesPerPeak;
        const end = Math.min(start + samplesPerPeak, channelData.length);
        let max = 0;

        for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
        }
        peaks[i] = max;
    }

    return peaks;
}

/**
 * Open the ghost signals control panel
 */
export function openGhostSignalsPanel(savedState = null) {
    if (ghostSignalPanel && document.body.contains(ghostSignalPanel)) {
        ghostSignalPanel.remove();
        ghostSignalPanel = null;
    }

    ghostSignalPanel = document.createElement('div');
    ghostSignalPanel.id = 'ghost-signals-window';
    ghostSignalPanel.className = 'fixed bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-2xl z-[10000]';
    ghostSignalPanel.style.cssText = `
        width: 340px;
        max-height: 480px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', sans-serif;
    `;

    renderGhostSignalsContent();
    document.body.appendChild(ghostSignalPanel);

    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

function renderGhostSignalsContent() {
    if (!ghostSignalPanel) return;

    const tracks = getTracksState();

    let tracksList = tracks.map(track => {
        const config = getGhostSignalConfig(track.id);
        const hasAudioClips = track.timelineClips && track.timelineClips.some(c => c.audioBuffer);
        const clipCount = track.timelineClips ? track.timelineClips.length : 0;

        return `
            <div class="ghost-track-item flex items-center justify-between p-2 bg-[#252525] rounded mb-2 border border-[#3a3a3a]" data-track-id="${track.id}">
                <div class="flex items-center gap-2 flex-1">
                    <input type="checkbox" class="ghost-enable-checkbox w-4 h-4 accent-blue-400 cursor-pointer" data-track-id="${track.id}" ${config.enabled ? 'checked' : ''} ${!hasAudioClips ? 'disabled title="No audio clips"' : ''}>
                    <div class="w-3 h-3 rounded" style="background-color: ${track.color || '#666'}"></div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm text-[#e0e0e0] truncate">${track.name}</div>
                        <div class="text-xs text-[#888]">${clipCount} clip${clipCount !== 1 ? 's' : ''} ${!hasAudioClips ? ' (no audio)' : ''}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="range" min="5" max="50" value="${Math.round(config.opacity * 100)}" 
                        class="ghost-opacity-slider w-16 h-1 accent-blue-400 cursor-pointer" data-track-id="${track.id}" title="Opacity">
                    <span class="text-xs text-[#888] w-6">${Math.round(config.opacity * 100)}%</span>
                </div>
            </div>
        `;
    }).join('');

    if (tracks.length === 0) {
        tracksList = `
            <div class="text-center py-6 text-[#666]">
                <div class="text-2xl mb-2">📊</div>
                <div class="text-sm">No tracks available</div>
            </div>
        `;
    }

    ghostSignalPanel.innerHTML = `
        <div class="flex items-center justify-between p-3 border-b border-[#3a3a3a] bg-[#252525] rounded-t-lg">
            <h3 class="text-sm font-semibold text-[#e0e0e0] m-0">👻 Track Ghost Signals</h3>
            <button id="close-ghost-signals-btn" class="w-6 h-6 flex items-center justify-center bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[#a0a0a0] hover:text-[#e0e0e0] text-lg leading-none">&times;</button>
        </div>
        <div class="p-3 border-b border-[#3a3a3a] bg-[#1a1a1a]">
            <p class="text-xs text-[#888] mb-0">Show faint waveform overlays from other tracks for visual reference while mixing.</p>
        </div>
        <div class="p-3 flex-1 overflow-y-auto" id="ghost-signals-tracks-list">
            ${tracksList}
        </div>
        <div class="p-3 border-t border-[#3a3a3a] bg-[#252525] rounded-b-lg">
            <div class="flex items-center justify-between">
                <span class="text-xs text-[#888]">Active: ${getEnabledGhostSignals().length} track(s)</span>
                <button id="clear-all-ghost-signals" class="px-3 py-1 text-xs bg-[#8b1a1a] hover:bg-[#a02020] text-[#ff9999] rounded border border-[#6b1010]">Clear All</button>
            </div>
        </div>
    `;

    // Attach event listeners
    const closeBtn = ghostSignalPanel.querySelector('#close-ghost-signals-btn');
    closeBtn.addEventListener('click', closeGhostSignalsPanel);

    const clearAllBtn = ghostSignalPanel.querySelector('#clear-all-ghost-signals');
    clearAllBtn.addEventListener('click', () => {
        ghostSignalConfig.clear();
        renderGhostSignalsContent();
        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    });

    // Enable/disable checkboxes
    ghostSignalPanel.querySelectorAll('.ghost-enable-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId);
            setGhostSignalEnabled(trackId, e.target.checked);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        });
    });

    // Opacity sliders
    ghostSignalPanel.querySelectorAll('.ghost-opacity-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = parseInt(e.target.dataset.trackId);
            setGhostSignalOpacity(trackId, e.target.value / 100);
            e.target.nextElementSibling.textContent = `${e.target.value}%`;
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        });
    });
}

function handleOutsideClick(e) {
    if (ghostSignalPanel && !ghostSignalPanel.contains(e.target)) {
        closeGhostSignalsPanel();
    }
}

export function closeGhostSignalsPanel() {
    if (ghostSignalPanel) {
        ghostSignalPanel.remove();
        ghostSignalPanel = null;
        document.removeEventListener('click', handleOutsideClick);
    }
}

/**
 * Get count of active ghost signals
 */
export function getGhostSignalCount() {
    return getEnabledGhostSignals().length;
}
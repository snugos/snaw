/**
 * ExportSelection - Export selected tracks or loop region to audio file
 * Feature #10: Export Selection
 * Feature: Export Region Selection - export a specific time region (between two markers, custom range, or loop region) instead of the full project
 */
import { getTracksState, getTrackByIdState, getLoopRegion, getTimelineMarkers } from './state.js';

let panelInstance = null;
let localAppServices = {};

/**
 * Initialize the Export Selection module
 * @param {object} services - App services
 */
export function initExportSelection(services) {
    localAppServices = services;
    console.log('[ExportSelection] Initialized');
}

/**
 * Open the export selection panel
 */
export function openExportSelectionPanel() {
    if (panelInstance) {
        panelInstance.remove();
        panelInstance = null;
        return;
    }

    const tracks = getTracksState() || [];
    const audioTracks = tracks.filter(t =>
        t.type === 'Synth' || t.type === 'Sampler' ||
        t.type === 'DrumSampler' || t.type === 'Audio' ||
        t.type === 'InstrumentSampler'
    );

    if (audioTracks.length === 0) {
        localAppServices.showNotification?.('No tracks available to export', 2000);
        return;
    }

    const loopRegion = getLoopRegion();
    const loopEnabled = loopRegion?.enabled || false;
    const loopStart = loopRegion?.start || 0;
    const loopEnd = loopRegion?.end || 16;

    const timelineMarkers = getTimelineMarkers() || [];
    const markersEnabled = timelineMarkers.length >= 2;
    const markerOptions = timelineMarkers.map(m =>
        `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} @ ${formatTime(m.position)}</option>`
    ).join('');

    const panel = document.createElement('div');
    panel.id = 'exportSelectionPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e1e1e;
        border: 2px solid #444;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 460px;
        max-width: 540px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        font-family: 'Inter', sans-serif;
    `;

    const tracksCheckboxes = audioTracks.map((track, idx) => `
        <label class="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer">
            <input type="checkbox" class="export-track-check w-4 h-4" data-track-id="${track.id}" ${idx === 0 ? 'checked' : ''}>
            <span class="text-sm text-gray-200">${escapeHtml(track.name || `Track ${track.id}`)}</span>
            <span class="text-xs text-gray-500 ml-auto">${track.type}</span>
        </label>
    `).join('');

    panel.innerHTML = `
        <div style="color: #e0e0e0; font-size: 18px; font-weight: 600; margin-bottom: 20px;">
            Export Selection
        </div>

        <!-- Track Selection -->
        <div style="margin-bottom: 16px;">
            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">
                Select tracks to export:
            </div>
            <div style="background: #252525; border-radius: 4px; max-height: 200px; overflow-y: auto;">
                ${tracksCheckboxes}
            </div>
            <button id="selectAllExport" style="margin-top: 8px; font-size: 11px; color: #666; text-decoration: underline; background: none; border: none; cursor: pointer;">
                Select All
            </button>
            <button id="deselectAllExport" style="margin-top: 8px; margin-left: 12px; font-size: 11px; color: #666; text-decoration: underline; background: none; border: none; cursor: pointer;">
                Deselect All
            </button>
        </div>

        <!-- Region Selection (Feature: Export Region Selection) -->
        <div style="margin-bottom: 16px; background: #252525; border-radius: 4px; padding: 12px;">
            <div style="color: #aaa; font-size: 12px; margin-bottom: 8px; font-weight: 600;">
                Time Region
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportRegionMode" value="full" class="export-region-radio" checked>
                    <span class="text-sm text-gray-200">Full project</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportRegionMode" value="loop" class="export-region-radio" ${!loopEnabled ? 'disabled' : ''}>
                    <span class="text-sm text-gray-200" style="${!loopEnabled ? 'opacity: 0.5;' : ''}">Loop region</span>
                    <span class="text-xs text-gray-500 ml-auto">${loopEnabled ? `${formatTime(loopStart)} - ${formatTime(loopEnd)}` : '(no loop set)'}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportRegionMode" value="markers" class="export-region-radio" ${!markersEnabled ? 'disabled' : ''}>
                    <span class="text-sm text-gray-200" style="${!markersEnabled ? 'opacity: 0.5;' : ''}">Between two markers</span>
                    <span class="text-xs text-gray-500 ml-auto">${markersEnabled ? `(${timelineMarkers.length} markers)` : '(need 2+ markers)'}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="exportRegionMode" value="custom" class="export-region-radio">
                    <span class="text-sm text-gray-200">Custom time range</span>
                </label>
            </div>

            <!-- Marker pickers (hidden unless "Between two markers" is chosen) -->
            <div id="exportMarkerRegion" style="display: none; margin-top: 10px; padding: 8px; background: #1e1e1e; border-radius: 4px;">
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                    <span class="text-xs text-gray-400" style="min-width: 50px;">Start:</span>
                    <select id="exportStartMarker" style="flex: 1; padding: 4px 6px; background: #2a2a2a; border: 1px solid #444; border-radius: 3px; color: #e0e0e0; font-size: 12px;">
                        ${markerOptions}
                    </select>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="text-xs text-gray-400" style="min-width: 50px;">End:</span>
                    <select id="exportEndMarker" style="flex: 1; padding: 4px 6px; background: #2a2a2a; border: 1px solid #444; border-radius: 3px; color: #e0e0e0; font-size: 12px;">
                        ${markerOptions}
                    </select>
                </div>
            </div>

            <!-- Custom range inputs (hidden unless "Custom time range" is chosen) -->
            <div id="exportCustomRegion" style="display: none; margin-top: 10px; padding: 8px; background: #1e1e1e; border-radius: 4px;">
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                    <span class="text-xs text-gray-400" style="min-width: 50px;">Start:</span>
                    <input id="exportCustomStart" type="number" step="0.1" min="0" value="0" style="flex: 1; padding: 4px 6px; background: #2a2a2a; border: 1px solid #444; border-radius: 3px; color: #e0e0e0; font-size: 12px;">
                    <span class="text-xs text-gray-500">sec</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="text-xs text-gray-400" style="min-width: 50px;">End:</span>
                    <input id="exportCustomEnd" type="number" step="0.1" min="0" value="16" style="flex: 1; padding: 4px 6px; background: #2a2a2a; border: 1px solid #444; border-radius: 3px; color: #e0e0e0; font-size: 12px;">
                    <span class="text-xs text-gray-500">sec</span>
                </div>
            </div>
        </div>

        <!-- Format Selection -->
        <div style="margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                Format
            </label>
            <select id="exportFormatSelect" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="wav" selected>WAV (Uncompressed)</option>
                <option value="mp3">MP3 (Compressed)</option>
                <option value="flac">FLAC (Lossless)</option>
            </select>
        </div>

        <!-- Sample Rate Selection -->
        <div style="margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                Sample Rate
            </label>
            <select id="exportSampleRateSelect" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="44100">44100 Hz (CD Quality)</option>
                <option value="48000" selected>48000 Hz (Video Standard)</option>
                <option value="96000">96000 Hz (High Resolution)</option>
                <option value="22050">22050 Hz (Voice Quality)</option>
            </select>
        </div>

        <!-- MP3 Options -->
        <div id="exportMp3Options" style="display: none; margin-bottom: 16px;">
            <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 6px;">
                MP3 Bitrate
            </label>
            <select id="exportMp3Bitrate" style="
                width: 100%;
                padding: 8px 12px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="128">128 kbps</option>
                <option value="192">192 kbps</option>
                <option value="256" selected>256 kbps</option>
                <option value="320">320 kbps</option>
            </select>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="exportSelectionBtn" style="
                flex: 1;
                padding: 12px;
                background: #4a9eff;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                font-size: 14px;
            ">
                Export
            </button>
            <button id="exportSelectionCancel" style="
                flex: 1;
                padding: 12px;
                background: #333;
                border: none;
                border-radius: 6px;
                color: #ccc;
                font-weight: 500;
                cursor: pointer;
                font-size: 14px;
            ">
                Cancel
            </button>
        </div>
    `;

    document.body.appendChild(panel);
    panelInstance = panel;

    // Default the marker end-select to the 2nd marker if we have at least 2
    if (timelineMarkers.length >= 2) {
        const endSel = panel.querySelector('#exportEndMarker');
        if (endSel) endSel.value = timelineMarkers[1].id;
    }

    // Event handlers
    panel.querySelector('#selectAllExport')?.addEventListener('click', () => {
        panel.querySelectorAll('.export-track-check').forEach(cb => cb.checked = true);
    });

    panel.querySelector('#deselectAllExport')?.addEventListener('click', () => {
        panel.querySelectorAll('.export-track-check').forEach(cb => cb.checked = false);
    });

    panel.querySelector('#exportFormatSelect')?.addEventListener('change', (e) => {
        const mp3Options = panel.querySelector('#exportMp3Options');
        if (mp3Options) {
            mp3Options.style.display = e.target.value === 'mp3' ? 'block' : 'none';
        }
    });

    // Region-mode radio change handler: show the appropriate sub-panel
    const updateRegionPanels = () => {
        const mode = panel.querySelector('.export-region-radio:checked')?.value || 'full';
        const markerPanel = panel.querySelector('#exportMarkerRegion');
        const customPanel = panel.querySelector('#exportCustomRegion');
        if (markerPanel) markerPanel.style.display = mode === 'markers' ? 'block' : 'none';
        if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
    };
    panel.querySelectorAll('.export-region-radio').forEach(r => {
        r.addEventListener('change', updateRegionPanels);
    });
    updateRegionPanels();

    panel.querySelector('#exportSelectionBtn')?.addEventListener('click', () => {
        performExport();
    });

    panel.querySelector('#exportSelectionCancel')?.addEventListener('click', () => {
        closePanel();
    });
}

function closePanel() {
    if (panelInstance) {
        panelInstance.remove();
        panelInstance = null;
    }
}

/**
 * Resolve the region to (start, end) seconds based on the panel's selected mode.
 * Returns null if the chosen mode is unavailable (e.g. no markers / no loop).
 */
function resolveRegionFromPanel() {
    const mode = document.querySelector('.export-region-radio:checked')?.value || 'full';

    if (mode === 'full') {
        return null; // null means "full project" (caller falls back to clip-driven max)
    }

    if (mode === 'loop') {
        const loop = getLoopRegion();
        if (!loop?.enabled) return null;
        return { start: Math.max(0, parseFloat(loop.start) || 0), end: Math.max(parseFloat(loop.end) || 0, parseFloat(loop.start) || 0) };
    }

    if (mode === 'markers') {
        const startId = document.querySelector('#exportStartMarker')?.value;
        const endId = document.querySelector('#exportEndMarker')?.value;
        const all = getTimelineMarkers() || [];
        const startM = all.find(m => m.id === startId);
        const endM = all.find(m => m.id === endId);
        if (!startM || !endM) return null;
        const start = Math.min(startM.position, endM.position);
        const end = Math.max(startM.position, endM.position);
        return { start, end, startName: startM.name, endName: endM.name };
    }

    if (mode === 'custom') {
        const s = Math.max(0, parseFloat(document.querySelector('#exportCustomStart')?.value) || 0);
        let e = parseFloat(document.querySelector('#exportCustomEnd')?.value) || 0;
        if (e <= s) e = s + 0.1;
        return { start: s, end: e };
    }

    return null;
}

/**
 * Perform the export based on selections
 */
async function performExport() {
    const selectedTrackIds = [];
    document.querySelectorAll('.export-track-check:checked').forEach(cb => {
        selectedTrackIds.push(parseInt(cb.dataset.trackId, 10));
    });

    if (selectedTrackIds.length === 0) {
        localAppServices.showNotification?.('Please select at least one track', 2000);
        return;
    }

    const region = resolveRegionFromPanel();
    const format = document.querySelector('#exportFormatSelect')?.value || 'wav';
    const sampleRate = parseInt(document.querySelector('#exportSampleRateSelect')?.value || '48000', 10);
    const bitrate = parseInt(document.querySelector('#exportMp3Bitrate')?.value || '256', 10);

    closePanel();

    let regionLabel = '';
    if (region) {
        regionLabel = ` (${formatTime(region.start)} - ${formatTime(region.end)})`;
    }
    localAppServices.showNotification?.(`Exporting ${selectedTrackIds.length} track(s)${regionLabel}...`, 2000);

    try {
        // Build options
        const options = {
            trackIds: selectedTrackIds,
            region, // null = full project; {start, end} = custom region
            format,
            sampleRate,
            bitrate
        };

        // Call the appropriate export function
        if (typeof window.performExportSelection === 'function') {
            await window.performExportSelection(options);
        } else if (typeof window.exportStems === 'function') {
            // Fallback to stem exporter
            await window.exportStems(selectedTrackIds, options);
        } else {
            // Simple fallback: export as single mixed file
            await exportSelectedTracks(options);
        }

        localAppServices.showNotification?.('Export completed!', 2000);
    } catch (err) {
        console.error('[ExportSelection] Export failed:', err);
        localAppServices.showNotification?.(`Export failed: ${err.message}`, 3000);
    }
}

/**
 * Export selected tracks to audio file
 * @param {object} options - Export options
 */
async function exportSelectedTracks(options) {
    const { trackIds, region, format, sampleRate } = options;

    if (typeof Tone === 'undefined') {
        throw new Error('Audio engine not available');
    }

    const tracks = trackIds.map(id => getTrackByIdState(id)).filter(Boolean);
    if (tracks.length === 0) {
        throw new Error('No valid tracks to export');
    }

    // Get duration
    let renderStart = 0;
    let duration = 60; // Default
    if (region) {
        renderStart = Math.max(0, parseFloat(region.start) || 0);
        const end = Math.max(renderStart + 0.1, parseFloat(region.end) || renderStart + 0.1);
        // Render the full window [0, end] and slice to [start, end] after render
        // so the exported audio actually contains the requested time region.
        duration = end;
    } else {
        // Calculate max duration from clips
        tracks.forEach(track => {
            if (track.timelineClips) {
                track.timelineClips.forEach(clip => {
                    const clipEnd = clip.start + (clip.duration || 0);
                    if (clipEnd > duration) duration = clipEnd;
                });
            }
        });
    }

    const offlineCtx = new Tone.OfflineContext(1, duration, sampleRate);

    // Create offline audio rendering
    const masterGain = new Tone.Gain(1).toDestination();

    // Mix selected tracks into offline context
    for (const track of tracks) {
        if (!track.outputNode) continue;
        track.outputNode.connect(masterGain);
    }

    // Render
    const buffer = await offlineCtx.render();
    const audioBuffer = buffer.get()?.get()?.get ? buffer.get().get().get() : buffer;

    if (!audioBuffer || !audioBuffer.numberOfChannels) {
        throw new Error('Failed to render audio buffer');
    }

    // Trim the rendered buffer to the requested region window.
    // The OfflineContext always renders from t=0, so if a region is selected
    // we slice out the [renderStart, renderStart + (region.end - region.start)]
    // window so the exported file actually contains that time range.
    let exportBuffer = audioBuffer;
    if (region) {
        const startSample = Math.min(audioBuffer.length, Math.max(0, Math.floor(renderStart * sampleRate)));
        const regionDuration = Math.max(0, (parseFloat(region.end) || 0) - (parseFloat(region.start) || 0));
        const regionLengthSamples = Math.max(1, Math.floor(regionDuration * sampleRate));
        const endSample = Math.min(audioBuffer.length, startSample + regionLengthSamples);
        if (startSample > 0 || endSample < audioBuffer.length) {
            try {
                const ctx = new OfflineAudioContext(
                    audioBuffer.numberOfChannels,
                    Math.max(1, endSample - startSample),
                    sampleRate
                );
                const src = ctx.createBufferSource();
                // Re-create a sliced copy of the original buffer for the source
                const sliced = ctx.createBuffer(
                    audioBuffer.numberOfChannels,
                    Math.max(1, endSample - startSample),
                    sampleRate
                );
                for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                    const srcData = audioBuffer.getChannelData(ch);
                    const dstData = sliced.getChannelData(ch);
                    for (let i = 0; i < dstData.length; i++) {
                        dstData[i] = srcData[startSample + i] || 0;
                    }
                }
                src.buffer = sliced;
                src.connect(ctx.destination);
                src.start(0);
                const trimmed = await ctx.startRendering();
                exportBuffer = trimmed;
            } catch (sliceErr) {
                console.warn('[ExportSelection] Region trim failed, exporting full render:', sliceErr);
                exportBuffer = audioBuffer;
            }
        }
    }

    // Convert to desired format
    let blob;
    if (format === 'wav') {
        blob = encodeWav(exportBuffer, sampleRate);
    } else if (format === 'mp3') {
        blob = encodeMp3(exportBuffer, options.bitrate || 256);
    } else if (format === 'flac') {
        blob = encodeFlac(exportBuffer);
    } else {
        blob = encodeWav(exportBuffer, sampleRate);
    }

    // Build a descriptive filename (include start time when a region is selected)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const regionSuffix = region ? `-${renderStart.toFixed(1)}s` : '';
    const filename = `snugos-export${regionSuffix}-${ts}.${format}`;
    downloadBlob(blob, filename);
}

/**
 * Format seconds as a human-readable m:ss.x label
 */
function formatTime(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(s / 60);
    const secs = s - mins * 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Minimal HTML-escape for user-controlled strings (track names, marker names)
 */
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/**
 * Encode AudioBuffer to WAV blob
 */
function encodeWav(audioBuffer, sampleRate) {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleSize = 16;
    const byteRate = sampleRate * numChannels * (sampleSize / 8);
    const blockAlign = numChannels * (sampleSize / 8);
    const dataSize = length * numChannels * (sampleSize / 8);
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, sampleSize, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Interleave channels
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
        channels.push(audioBuffer.getChannelData(c));
    }
    
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Placeholder encoders for MP3/FLAC (would use lamejs and flac.js in full impl)
function encodeMp3(audioBuffer, bitrate) {
    console.warn('[ExportSelection] MP3 encoding not fully implemented, using WAV');
    return encodeWav(audioBuffer, audioBuffer.sampleRate);
}

function encodeFlac(audioBuffer) {
    console.warn('[ExportSelection] FLAC encoding not fully implemented, using WAV');
    return encodeWav(audioBuffer, audioBuffer.sampleRate);
}

console.log('[ExportSelection] Module loaded');
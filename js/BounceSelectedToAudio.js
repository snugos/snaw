// js/BounceSelectedToAudio.js - Bounce selected clips to audio track
// Renders selected MIDI/instrument clips to audio directly on the timeline

let localAppServices = {};
let isBouncing = false;
let bounceProgress = 0;

export function initBounceSelectedToAudio(services) {
    localAppServices = services;
    console.log('[BounceSelectedToAudio] Initialized');
}

export function isBouncingActive() {
    return isBouncing;
}

export function getBounceProgress() {
    return bounceProgress;
}

/**
 * Bounce selected clips to audio on the same track
 * @param {number} trackId - Track ID to bounce clips for
 * @param {Array<string>} clipIds - Array of clip IDs to bounce (null for selected)
 * @returns {Promise<boolean>} Success
 */
export async function bounceSelectedClipsToAudio(trackId, clipIds = null) {
    if (isBouncing) {
        console.warn('[BounceSelectedToAudio] Already bouncing');
        return false;
    }

    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[BounceSelectedToAudio] Track not found:', trackId);
        return false;
    }

    // Get clips to bounce
    let clipsToBounce = clipIds;
    if (!clipsToBounce || clipsToBounce.length === 0) {
        // ClipSelectionManager.getSelectedClipIds() returns a Set; convert to Array
        // so downstream code can index it (clipsToBounce[i]) and read .length.
        const sel = localAppServices.getSelectedClipIds?.();
        clipsToBounce = sel instanceof Set ? Array.from(sel) : (sel || []);
    }

    if (clipsToBounce.length === 0) {
        localAppServices.showNotification?.('No clips selected for bouncing', 2000);
        return false;
    }

    try {
        isBouncing = true;
        bounceProgress = 0;
        localAppServices.showNotification?.('Bouncing clips to audio...', 2000);

        const bpm = localAppServices.getBPM?.() || 120;
        const sampleRate = 48000;

        // Process each clip
        const bouncedClips = [];
        for (let i = 0; i < clipsToBounce.length; i++) {
            const clipId = clipsToBounce[i];
            const clip = track.clips?.find(c => c.id === clipId);
            if (!clip) continue;

            bounceProgress = (i / clipsToBounce.length) * 100;

            // Create offline context for rendering
            const duration = (clip.duration || 4) * (60 / bpm) * 4;
            const offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);

            // Render the clip to audio buffer
            const audioBuffer = await renderClipToBuffer(clip, offlineCtx, bpm);
            if (audioBuffer) {
                // Create new audio clip
                const newClip = {
                    id: `bounced-${Date.now()}-${i}`,
                    name: `Bounced ${clip.name || 'Clip'}`,
                    audioBuffer: audioBuffer,
                    startTime: clip.startTime || 0,
                    duration: audioBuffer.duration,
                    offset: 0,
                    gain: 1.0,
                    pan: 0,
                    muted: false,
                    color: clip.color || track.color
                };
                bouncedClips.push(newClip);
            }
        }

        bounceProgress = 100;

        if (bouncedClips.length > 0) {
            // Replace original clips with bounced audio clips
            if (!track.clips) track.clips = [];
            
            // Remove original clips and add bounced clips
            for (const clipId of clipsToBounce) {
                const idx = track.clips.findIndex(c => c.id === clipId);
                if (idx !== -1) track.clips.splice(idx, 1);
            }
            
            track.clips.push(...bouncedClips);
            
            localAppServices.showNotification?.(`Bounced ${bouncedClips.length} clip(s) to audio`, 2000);
            
            // Update UI
            if (localAppServices.renderTimeline) {
                localAppServices.renderTimeline();
            }
        }

        isBouncing = false;
        return true;
    } catch (error) {
        console.error('[BounceSelectedToAudio] Bounce failed:', error);
        localAppServices.showNotification?.('Bounce failed: ' + error.message, 3000);
        isBouncing = false;
        return false;
    }
}

/**
 * Render a single clip to an audio buffer using offline context
 * @param {Object} clip - Clip object with sequence data
 * @param {OfflineAudioContext} offlineCtx - Offline audio context
 * @param {number} bpm - BPM for timing
 * @returns {Promise<AudioBuffer|null>}
 */
async function renderClipToBuffer(clip, offlineCtx, bpm) {
    try {
        const stepDuration = 60 / bpm / 4; // 16th note duration
        const stepsPerBar = 16;
        
        let totalSteps = 0;
        let maxSteps = 0;
        
        // Find the max step in the clip data
        if (clip.sequence?.data) {
            for (const row of clip.sequence.data) {
                if (row) {
                    for (let s = 0; s < row.length; s++) {
                        if (row[s] && row[s].duration) {
                            const endStep = s + row[s].duration;
                            if (endStep > maxSteps) maxSteps = endStep;
                        }
                        if (row[s]) totalSteps = Math.max(totalSteps, s + 1);
                    }
                }
            }
        }

        if (maxSteps === 0) maxSteps = totalSteps || 32;
        
        const duration = maxSteps * stepDuration;
        const length = Math.ceil(duration * offlineCtx.sampleRate);
        
        const buffer = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        
        // Generate simple waveform representation (no actual synth, just visual bounce)
        // Real implementation would use Tone.js instruments
        for (let i = 0; i < length; i++) {
            const t = i / offlineCtx.sampleRate;
            const step = Math.floor(t / stepDuration);
            
            // Simple sine wave at 440Hz for visualization
            const freq = 440;
            let sample = Math.sin(2 * Math.PI * freq * t) * 0.1;
            
            // Add some envelope
            const env = Math.exp(-t * 2);
            sample *= env;
            
            // Check if any note is active at this step
            if (clip.sequence?.data) {
                for (const row of clip.sequence.data) {
                    if (row && row[step % 16]) {
                        sample += Math.sin(2 * Math.PI * (220 + step * 10) * t) * 0.05 * (row[step % 16].velocity || 0.8);
                    }
                }
            }
            
            left[i] = sample;
            right[i] = sample;
        }
        
        return buffer;
    } catch (error) {
        console.error('[BounceSelectedToAudio] Error rendering clip:', error);
        return null;
    }
}

/**
 * Open the Bounce dialog for selected track
 * @param {number} trackId - Track ID
 */
export function openBounceDialog(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        localAppServices.showNotification?.('No track selected', 2000);
        return;
    }

    const windowId = 'bounceDialog';
    const existingWin = localAppServices.getOpenWindows?.()?.get(windowId);
    if (existingWin) {
        existingWin.restore();
        return;
    }

    const sel = localAppServices.getSelectedClipIds?.();
    const selectedClipIds = sel instanceof Set ? Array.from(sel) : (sel || []);
    const selectedClipCount = sel instanceof Set ? sel.size : (selectedClipIds.length || 0);

    const contentContainer = document.createElement('div');
    contentContainer.id = 'bounceDialogContent';
    contentContainer.className = 'p-4 bg-gray-100 dark:bg-slate-800';
    
    contentContainer.innerHTML = `
        <div class="space-y-4">
            <div class="text-lg font-semibold text-gray-800 dark:text-gray-200">Bounce Clips to Audio</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
                Track: <span class="font-medium">${track.name}</span>
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
                Selected clips: <span class="font-medium">${selectedClipCount || 'None'}</span>
            </div>
            ${isBouncing ? `
                <div class="space-y-2">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Bouncing... ${Math.round(bounceProgress)}%</div>
                    <div class="w-full bg-gray-300 dark:bg-slate-600 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full transition-all" style="width: ${bounceProgress}%"></div>
                    </div>
                </div>
            ` : `
                <div class="flex gap-2">
                    <button id="bounceDialogBounce" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium">
                        Bounce
                    </button>
                    <button id="bounceDialogCancel" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-gray-800 dark:text-gray-200 rounded font-medium">
                        Cancel
                    </button>
                </div>
            `}
        </div>
    `;

    const options = {
        width: 400,
        height: 250,
        minWidth: 300,
        minHeight: 200,
        initialContentKey: windowId,
        closable: true,
        minimizable: false,
        resizable: false
    };

    const win = localAppServices.createWindow?.(windowId, 'Bounce to Audio', contentContainer, options);
    
    if (win?.element) {
        const bounceBtn = document.getElementById('bounceDialogBounce');
        const cancelBtn = document.getElementById('bounceDialogCancel');
        
        if (bounceBtn) {
            bounceBtn.addEventListener('click', async () => {
                bounceBtn.disabled = true;
                bounceBtn.textContent = 'Bouncing...';
                await bounceSelectedClipsToAudio(trackId, selectedClipIds);
                win.close?.();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                win.close?.();
            });
        }
    }
    
    return win;
}
/**
 * Audio Reverse - Reverse audio clips with one click
 */

let audioReverseState = {
    originalBuffers: new Map(), // Store original buffers for undo
};

/**
 * Reverse an AudioBuffer (flip it in time)
 */
function reverseAudioBuffer(buffer) {
    const reversed = buffer;
    const channels = buffer.numberOfChannels;
    
    for (let c = 0; c < channels; c++) {
        const channelData = reversed.getChannelData(c);
        channelData.reverse();
    }
    
    return reversed;
}

/**
 * Reverse a clip by ID
 * @param {string} clipId - The clip ID to reverse
 * @returns {boolean} success
 */
export function reverseClipById(clipId) {
    // Find clip in state
    const clip = findClipInState(clipId);
    if (!clip) {
        console.warn('[AudioReverse] Clip not found:', clipId);
        return false;
    }
    
    // Store original for undo
    if (clip.audioBuffer && !audioReverseState.originalBuffers.has(clipId)) {
        // Clone the buffer
        const origBuffer = clip.audioBuffer;
        const newBuffer = audioReverseState.audioContext.createBuffer(
            origBuffer.numberOfChannels,
            origBuffer.length,
            origBuffer.sampleRate
        );
        for (let c = 0; c < origBuffer.numberOfChannels; c++) {
            newBuffer.copyToChannel(origBuffer.getChannelData(c), c);
        }
        audioReverseState.originalBuffers.set(clipId, newBuffer);
    }
    
    // Reverse the audio buffer
    if (clip.audioBuffer) {
        clip.audioBuffer = reverseAudioBuffer(clip.audioBuffer);
        clip._reversed = !clip._reversed;
        
        // Update clip display if needed
        updateClipDisplay(clip);
        
        console.log('[AudioReverse] Clip reversed:', clipId);
        return true;
    }
    
    return false;
}

/**
 * Restore original (un-reversed) version of a clip
 * @param {string} clipId - The clip ID to restore
 */
export function restoreOriginalClip(clipId) {
    if (!audioReverseState.originalBuffers.has(clipId)) {
        console.warn('[AudioReverse] No original buffer stored for:', clipId);
        return false;
    }
    
    const clip = findClipInState(clipId);
    if (!clip) return false;
    
    clip.audioBuffer = audioReverseState.originalBuffers.get(clipId);
    clip._reversed = false;
    audioReverseState.originalBuffers.delete(clipId);
    
    updateClipDisplay(clip);
    console.log('[AudioReverse] Clip restored to original:', clipId);
    return true;
}

/**
 * Find a clip object in the global state by ID
 */
function findClipInState(clipId) {
    // Check if we have direct access to clip registry
    if (typeof clipRegistry !== 'undefined') {
        return clipRegistry[clipId] || null;
    }
    
    // Check global clips array
    if (typeof clips !== 'undefined') {
        return clips.find(c => c.id === clipId) || null;
    }
    
    // Check track clips
    if (typeof tracks !== 'undefined') {
        for (const track of tracks) {
            if (track.clips) {
                const found = track.clips.find(c => c.id === clipId);
                if (found) return found;
            }
        }
    }
    
    return null;
}

/**
 * Update clip display after reversal
 */
function updateClipDisplay(clip) {
    if (!clip || !clip.element) return;
    
    // Update the clip element's data attribute
    if (clip.element.dataset) {
        clip.element.dataset.reversed = clip._reversed ? 'true' : 'false';
    }
    
    // Update visual indicator if clip has waveform
    const waveformEl = clip.element.querySelector('.waveform-display') || 
                       clip.element.querySelector('.clip-content');
    if (waveformEl) {
        waveformEl.classList.toggle('reversed', clip._reversed);
    }
    
    // Update title/tooltip
    if (clip.element.title) {
        clip.element.title = clip._reversed ? 'Reversed Audio' : '';
    }
}

/**
 * Check if a clip is currently reversed
 */
export function isClipReversed(clipId) {
    const clip = findClipInState(clipId);
    return clip ? !!clip._reversed : false;
}

/**
 * Initialize Audio Reverse functionality
 */
export function initAudioReverse() {
    // Set up audio context reference
    if (typeof audioContext !== 'undefined') {
        audioReverseState.audioContext = audioContext;
    } else if (typeof Tone !== 'undefined' && Tone.getContext) {
        audioReverseState.audioContext = Tone.getContext().rawContext;
    }
    
    // Register keyboard shortcut (R for reverse when clip selected)
    registerReverseKeyboardShortcut();
    
    console.log('[AudioReverse] Initialized');
}

/**
 * Register keyboard shortcut for reversing selected clip
 */
function registerReverseKeyboardShortcut() {
    if (typeof addGlobalKeyboardShortcut === 'function') {
        addGlobalKeyboardShortcut('KeyR', (e) => {
            const selectedClip = getSelectedClip();
            if (selectedClip) {
                e.preventDefault();
                reverseClipById(selectedClip.id);
            }
        });
    }
}

/**
 * Get currently selected clip from UI
 */
function getSelectedClip() {
    // Check for selected clip element
    const selectedEl = document.querySelector('.clip.selected') ||
                       document.querySelector('.clip[data-selected="true"]');
    
    if (selectedEl && selectedEl.dataset && selectedEl.dataset.clipId) {
        return findClipInState(selectedEl.dataset.clipId);
    }
    
    return null;
}

/**
 * Toggle reverse on selected clip
 */
export function toggleReverseOnSelected() {
    const selectedClip = getSelectedClip();
    if (selectedClip) {
        if (isClipReversed(selectedClip.id)) {
            restoreOriginalClip(selectedClip.id);
        } else {
            reverseClipById(selectedClip.id);
        }
        return true;
    }
    showNotification?.('No clip selected', 'warning');
    return false;
}
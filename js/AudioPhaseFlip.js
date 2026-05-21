// js/AudioPhaseFlip.js - Flip the phase of audio clips by 180 degrees
// This module provides functionality to invert the waveform of any audio clip

export function initAudioPhaseFlip(appServices) {
    console.log("[AudioPhaseFlip] Initialized");
}

// Invert the audio buffer samples (multiply by -1) to flip phase
export function flipAudioBufferPhase(audioBuffer) {
    if (!audioBuffer || !audioBuffer.loaded) {
        console.warn("[AudioPhaseFlip] Invalid or unloaded audio buffer");
        return false;
    }
    
    try {
        const channelCount = audioBuffer.numberOfChannels;
        for (let ch = 0; ch < channelCount; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] = -channelData[i];
            }
        }
        return true;
    } catch (e) {
        console.error("[AudioPhaseFlip] Error flipping phase:", e);
        return false;
    }
}

// Toggle phase flip state on a clip
export function toggleClipPhaseFlip(clipId, audioContext) {
    const state = getState();
    const clip = state.clips?.find(c => c.id === clipId);
    if (!clip) {
        console.warn("[AudioPhaseFlip] Clip not found:", clipId);
        return false;
    }
    
    // Toggle flipped state
    clip.phaseInverted = !clip.phaseInverted;
    
    // If we have an audio buffer and it should be flipped, apply the inversion
    if (clip.audioBuffer && clip.phaseInverted) {
        return flipAudioBufferPhase(clip.audioBuffer);
    }
    
    return true;
}

export function isClipPhaseInverted(clipId) {
    const state = getState();
    const clip = state.clips?.find(c => c.id === clipId);
    return clip?.phaseInverted || false;
}

export function openAudioPhaseFlipPanel(clipId) {
    const inverted = isClipPhaseInverted(clipId);
    showNotification?.(`Clip phase is currently ${inverted ? 'INVERTED' : 'normal'}`, 2000);
}

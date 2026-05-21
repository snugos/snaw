// js/AudioPhaseFlip.js - Flip the phase of audio clips by 180 degrees
// This module provides functionality to invert the waveform of any audio clip

import { getTracksState, getTrackByIdState } from './state.js';

let localAppServices = {};

export function initAudioPhaseFlip(appServices) {
    localAppServices = appServices || {};
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

// Toggle phase flip state on a clip
export function toggleClipPhaseFlip(clipId) {
    const { clip, track } = findClipById(clipId);
    if (!clip) {
        console.warn("[AudioPhaseFlip] Clip not found:", clipId);
        return false;
    }
    
    // Toggle flipped state
    clip.phaseInverted = !clip.phaseInverted;
    
    // If we have an audio buffer and it should be flipped, apply the inversion
    if (clip.audioBuffer && clip.phaseInverted) {
        const result = flipAudioBufferPhase(clip.audioBuffer);
        if (result && localAppServices.showNotification) {
            localAppServices.showNotification(`Phase inverted for clip`, 1500);
        }
        return result;
    }
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Phase reset to normal for clip`, 1500);
    }
    return true;
}

export function isClipPhaseInverted(clipId) {
    const { clip } = findClipById(clipId);
    return clip?.phaseInverted || false;
}

export function openAudioPhaseFlipPanel(clipId) {
    const inverted = isClipPhaseInverted(clipId);
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Clip phase is currently ${inverted ? 'INVERTED' : 'normal'}`, 2000);
    }
}

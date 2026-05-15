// js/AudioClipHoverPreview.js - Preview audio clips on hover
// Hover over an audio clip to hear a 2-second preview of the content

let localAppServices = {};
let hoverPreviewPlayer = null;
let currentPreviewClipId = null;
let hoverTimeout = null;
const PREVIEW_DURATION = 2; // seconds
const HOVER_DELAY = 300; // ms before starting preview

/**
 * Initialize the Audio Clip Hover Preview module
 * @param {object} services - App services from main.js
 */
export function initAudioClipHoverPreview(services) {
    localAppServices = services;
    
    // Attach hover listeners after a delay to let UI initialize
    setTimeout(() => {
        attachHoverListeners();
    }, 1000);
    
    console.log('[AudioClipHoverPreview] Initialized');
}

/**
 * Attach hover event listeners to audio clips
 */
function attachHoverListeners() {
    document.addEventListener('mouseover', (e) => {
        const clipElement = e.target.closest('[data-clip-id]');
        if (!clipElement) return;
        
        const clipId = clipElement.dataset.clipId;
        const trackId = clipElement.dataset.trackId;
        
        if (clipId && trackId) {
            // Clear any existing hover timeout
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            
            // Start hover timeout to begin preview
            hoverTimeout = setTimeout(() => {
                startPreview(trackId, clipId);
            }, HOVER_DELAY);
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        const clipElement = e.target.closest('[data-clip-id]');
        if (!clipElement) return;
        
        // Clear hover timeout
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        
        // Stop preview on mouse out
        stopPreview();
    });
}

/**
 * Start audio preview for a clip
 */
function startPreview(trackId, clipId) {
    // Don't restart if already previewing this clip
    if (currentPreviewClipId === clipId) return;
    
    stopPreview();
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;
    
    // Check if it's an audio clip
    if (clip.type !== 'audio' && !clip.audioBuffer && !clip.dbKey) {
        return;
    }
    
    currentPreviewClipId = clipId;
    
    // Get audio buffer
    const getAudioBuffer = async () => {
        if (clip.audioBuffer) {
            return clip.audioBuffer;
        }
        if (clip.dbKey && localAppServices.getAudio) {
            const blob = await localAppServices.getAudio(clip.dbKey);
            if (blob) {
                const arrayBuffer = await blob.arrayBuffer();
                return await Tone.context.decodeAudioData(arrayBuffer);
            }
        }
        return null;
    };
    
    getAudioBuffer().then(buffer => {
        if (!buffer || currentPreviewClipId !== clipId) return;
        
        // Create preview player
        if (typeof Tone !== 'undefined') {
            hoverPreviewPlayer = new Tone.Player(buffer);
            hoverPreviewPlayer.connect(Tone.getDestination());
            hoverPreviewPlayer.loop = false;
            hoverPreviewPlayer.playbackRate = 1;
            
            // Calculate start position (from clip offset or 0)
            const startOffset = clip.offset || 0;
            
            // Play for PREVIEW_DURATION
            hoverPreviewPlayer.start(Tone.now(), startOffset, PREVIEW_DURATION);
            
            console.log(`[AudioClipHoverPreview] Playing preview for clip ${clipId}`);
        }
    });
}

/**
 * Stop the current preview
 */
function stopPreview() {
    if (hoverPreviewPlayer) {
        hoverPreviewPlayer.stop();
        hoverPreviewPlayer.dispose();
        hoverPreviewPlayer = null;
    }
    currentPreviewClipId = null;
}

// Export for access
export function isPreviewPlaying() {
    return hoverPreviewPlayer !== null && currentPreviewClipId !== null;
}

export function getCurrentPreviewClipId() {
    return currentPreviewClipId;
}

// Expose to window
window.isAudioPreviewPlaying = isPreviewPlaying;
window.getCurrentPreviewClipId = getCurrentPreviewClipId;
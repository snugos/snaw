// js/ClipProbability.js - Set random chance for each clip to play
// Adds generative variations by skipping clips probabilistically during playback

let localAppServices = {};
let probabilityMenuInitialized = false;

/**
 * Initialize clip probability system
 * @param {object} services - App services
 */
export function initClipProbability(services) {
    localAppServices = services;
    
    if (probabilityMenuInitialized) return;
    
    // Hook into clip context menu
    if (typeof addMenuItem === 'function') {
        addMenuItem({
            id: 'clipProbability',
            label: 'Clip Probability',
            icon: '🎲',
            action: 'openClipProbabilityPanel',
            category: 'clip'
        });
    }
    
    // Listen for menu action
    document.addEventListener('clipMenuAction', (e) => {
        if (e.detail?.action === 'openClipProbabilityPanel') {
            openClipProbabilityPanel(e.detail.clipId, e.detail.trackId);
        }
    });
    
    probabilityMenuInitialized = true;
    console.log('[ClipProbability] Initialized');
}

/**
 * Open probability panel for a clip
 * @param {string} clipId - Clip ID
 * @param {string} trackId - Track ID
 */
export function openClipProbabilityPanel(clipId, trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;
    
    // Get or create probability value
    const probability = clip.probability ?? 100;
    
    // Create modal
    const existingModal = document.getElementById('clipProbabilityModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'clipProbabilityModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: #1a1a2e; border: 1px solid #333; border-radius: 8px; padding: 24px; min-width: 320px; max-width: 400px;">
            <h3 style="margin: 0 0 20px 0; color: #fff; font-size: 16px;">Clip Probability</h3>
            <p style="color: #888; margin: 0 0 16px 0; font-size: 13px;">
                Set the chance (0-100%) that this clip will play during timeline playback.
            </p>
            <div style="margin-bottom: 20px;">
                <input type="range" id="probabilitySlider" min="0" max="100" value="${probability}" 
                    style="width: 100%; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; color: #666; font-size: 12px;">
                    <span>0% (never)</span>
                    <span id="probabilityValue" style="color: #4a9eff; font-size: 18px; font-weight: bold;">${probability}%</span>
                    <span>100% (always)</span>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="probabilityResetBtn" style="padding: 8px 16px; background: #333; color: #888; border: none; border-radius: 4px; cursor: pointer;">Reset to 100%</button>
                <button id="probabilityCloseBtn" style="padding: 8px 16px; background: #4a9eff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Done</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event handlers
    const slider = modal.querySelector('#probabilitySlider');
    const valueDisplay = modal.querySelector('#probabilityValue');
    
    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        valueDisplay.textContent = val + '%';
    });
    
    slider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        clip.probability = val;
        console.log(`[ClipProbability] Set clip ${clipId} probability to ${val}%`);
    });
    
    modal.querySelector('#probabilityResetBtn').addEventListener('click', () => {
        clip.probability = 100;
        slider.value = 100;
        valueDisplay.textContent = '100%';
    });
    
    modal.querySelector('#probabilityCloseBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

/**
 * Check if a clip should play based on its probability
 * @param {object} clip - Timeline clip object
 * @returns {boolean} - True if clip should play
 */
export function shouldClipPlay(clip) {
    if (!clip) return true;
    
    const probability = clip.probability ?? 100;
    if (probability >= 100) return true;
    if (probability <= 0) return false;
    
    return Math.random() * 100 < probability;
}

/**
 * Get probability for a clip
 * @param {object} clip - Timeline clip object
 * @returns {number} - Probability 0-100
 */
export function getClipProbability(clip) {
    return clip?.probability ?? 100;
}

/**
 * Set probability for a clip
 * @param {object} clip - Timeline clip object
 * @param {number} probability - Probability 0-100
 */
export function setClipProbability(clip, probability) {
    if (clip) {
        clip.probability = Math.max(0, Math.min(100, Math.round(probability)));
    }
}

// Export for access
window.shouldClipPlay = shouldClipPlay;
window.getClipProbability = getClipProbability;
window.setClipProbability = setClipProbability;

console.log('[ClipProbability] Module loaded');
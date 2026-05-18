// js/ProjectAutoNaming.js - Smart naming for clips and tracks
// Provides automatic naming based on content type, timing, and context

/**
 * Generate smart clip name based on context
 * @param {Object} options - Naming options
 * @returns {string} Generated name
 */
export function generateClipName(options = {}) {
    const {
        type = 'audio',           // 'audio' | 'midi' | 'sequence'
        trackName = 'Track',
        index = 1,
        timestamp = null,
        duration = 0,
        tempo = 120,
        hasEffects = false,
        color = null
    } = options;

    const date = timestamp ? formatTimestamp(timestamp) : formatTimestamp(Date.now());
    const counter = index.toString().padStart(2, '0');
    
    // Determine prefix based on type
    let prefix = 'Clip';
    if (type === 'audio') prefix = 'Audio';
    else if (type === 'midi') prefix = 'MIDI';
    else if (type === 'sequence') prefix = 'Seq';
    
    // Add duration-based descriptor if notable
    let durationDesc = '';
    if (duration > 0) {
        const bars = Math.round((duration * tempo) / 240);
        if (bars >= 1) {
            durationDesc = bars === 1 ? '1bar' : `${bars}bars`;
        }
    }
    
    // Build name components
    const components = [prefix];
    
    if (durationDesc) {
        components.push(durationDesc);
    }
    
    components.push(counter);
    
    // Add effect indicator
    if (hasEffects) {
        components.push('FX');
    }
    
    return components.join(' ');
}

/**
 * Generate smart track name based on creation context
 * @param {Object} options - Naming options
 * @returns {string} Generated name
 */
export function generateTrackName(options = {}) {
    const {
        type = 'Audio',           // 'Audio' | 'Synth' | 'Drums' | 'Sampler' | 'MIDI'
        index = 1,
        hasInput = false,
        isArmed = false
    } = options;

    const counter = index.toString().padStart(2, '0');
    
    // Base names for common track types
    const typeNames = {
        'Audio': 'Audio Track',
        'Synth': 'Synth Track',
        'Drums': 'Drums',
        'Sampler': 'Sampler',
        'MIDI': 'MIDI Track',
        'Bus': 'Bus'
    };
    
    const baseName = typeNames[type] || `${type} Track`;
    
    // If more than one of this type, append counter
    if (index > 1 || type === 'Audio' || type === 'MIDI') {
        const name = index > 1 ? `${baseName} ${counter}` : baseName;
        return name;
    }
    
    return baseName;
}

/**
 * Format timestamp for use in names
 * @param {number} ts - Timestamp in ms
 * @returns {string} Formatted string like "Apr27_1430"
 */
export function formatTimestamp(ts) {
    const d = new Date(ts);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${month}${day}_${hours}${mins}`;
}

/**
 * Generate a unique clip name that doesn't conflict with existing names
 * @param {Array} existingClips - Array of existing clip objects
 * @param {Object} options - Naming options
 * @returns {string} Unique name
 */
export function generateUniqueClipName(existingClips, options = {}) {
    const baseName = generateClipName(options);
    let name = baseName;
    let counter = 1;
    
    // Check for conflicts and increment if needed
    while (existingClips.some(c => c.name === name)) {
        counter++;
        name = `${baseName} ${counter}`;
    }
    
    return name;
}

/**
 * Update all unnamed clips in a project with smart names
 * @param {Array} tracks - Array of track objects
 * @returns {number} Number of clips renamed
 */
export function autoNameUnnamedClips(tracks) {
    let renamed = 0;
    
    tracks.forEach(track => {
        if (!track.timelineClips) return;
        
        let audioIndex = 0;
        let midiIndex = 0;
        let seqIndex = 0;
        
        track.timelineClips.forEach(clip => {
            // Only auto-name if clip has default naming pattern
            const isDefaultName = !clip.name || 
                clip.name.startsWith('Recording') || 
                clip.name.startsWith('Clip') ||
                clip.name.startsWith('Audio') ||
                clip.name === 'Untitled';
            
            if (isDefaultName) {
                let index;
                let type = clip.type || 'audio';
                
                if (type === 'audio') {
                    index = ++audioIndex;
                } else if (type === 'midi') {
                    index = ++midiIndex;
                } else {
                    index = ++seqIndex;
                }
                
                clip.name = generateClipName({
                    type,
                    trackName: track.name,
                    index,
                    timestamp: clip.timestamp || Date.now(),
                    duration: clip.duration || 0
                });
                renamed++;
            }
        });
    });
    
    return renamed;
}

// Export singleton instance
export const projectAutoNaming = {
    generateClipName,
    generateTrackName,
    formatTimestamp,
    generateUniqueClipName,
    autoNameUnnamedClips
};

console.log('[ProjectAutoNaming] Module loaded');
// js/ClipFadePresets.js - Clip Fade Preset Management
import { showNotification } from './utils.js';

let clipFadePresets = {};
const DEFAULT_PRESETS = [
    { 
        id: 'linear_in', 
        name: 'Linear In', 
        curve: t => t,
        description: 'Linear fade in'
    },
    { 
        id: 'linear_out', 
        name: 'Linear Out', 
        curve: t => 1 - t,
        description: 'Linear fade out'
    },
    { 
        id: 'exponential_in', 
        name: 'Exponential In', 
        curve: t => t * t,
        description: 'Slow start, fast finish'
    },
    { 
        id: 'exponential_out', 
        name: 'Exponential Out', 
        curve: t => 1 - (1 - t) * (1 - t),
        description: 'Fast start, slow finish'
    },
    { 
        id: 's_curve_in', 
        name: 'S-Curve In', 
        curve: t => t * t * (3 - 2 * t),
        description: 'Smooth ease-in'
    },
    { 
        id: 's_curve_out', 
        name: 'S-Curve Out', 
        curve: t => t > 0.5 ? 1 - Math.pow(-2 * t + 2, 2) / 2 : Math.pow(2 * t, 2) / 2,
        description: 'Smooth ease-out'
    },
    { 
        id: 'logarithmic_in', 
        name: 'Logarithmic In', 
        curve: t => Math.log(1 + 9 * t) / Math.log(10),
        description: 'Very slow start, accelerate'
    },
    { 
        id: 'logarithmic_out', 
        name: 'Logarithmic Out', 
        curve: t => 1 - Math.log(1 + 9 * (1 - t)) / Math.log(10),
        description: 'Fast start, very slow finish'
    }
];

export function getClipFadePresets() {
    return { ...clipFadePresets };
}

export function getDefaultClipFadePresets() {
    return [...DEFAULT_PRESETS];
}

export function getClipFadePresetById(id) {
    return clipFadePresets[id] || DEFAULT_PRESETS.find(p => p.id === id) || null;
}

export function addClipFadePreset(name, curveFunction, description = '') {
    if (!name || !name.trim()) return false;
    const id = name.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    clipFadePresets[id] = {
        id,
        name: name.trim(),
        curve: curveFunction,
        description: description || 'Custom preset'
    };
    console.log(`[ClipFadePresets] Added preset: ${name}`);
    return id;
}

export function removeClipFadePreset(id) {
    if (DEFAULT_PRESETS.find(p => p.id === id)) {
        console.warn(`[ClipFadePresets] Cannot remove built-in preset: ${id}`);
        return false;
    }
    if (clipFadePresets[id]) {
        delete clipFadePresets[id];
        console.log(`[ClipFadePresets] Removed preset: ${id}`);
        return true;
    }
    return false;
}

export function applyClipFadePreset(clipId, presetId, fadeType = 'out') {
    const preset = getClipFadePresetById(presetId);
    if (!preset) {
        console.warn(`[ClipFadePresets] Preset not found: ${presetId}`);
        return false;
    }

    if (typeof window !== 'undefined' && window.state) {
        const clip = window.state.getAudioClipById?.(clipId) || window.getAudioClip?.(clipId);
        if (clip) {
            const fadeTypeKey = fadeType === 'in' ? 'fadeInCurve' : 'fadeOutCurve';
            clip[fadeTypeKey] = preset.curve;
            console.log(`[ClipFadePresets] Applied ${preset.name} to clip ${clipId} as ${fadeType}`);
            return true;
        }
    }
    console.warn(`[ClipFadePresets] Clip not found: ${clipId}`);
    return false;
}

export function initClipFadePresets() {
    console.log('[ClipFadePresets] Initialized with', Object.keys(clipFadePresets).length + DEFAULT_PRESETS.length, 'presets');
}

if (typeof module !== 'undefined' && module.hot) module.hot.accept();
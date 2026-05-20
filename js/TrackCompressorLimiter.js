// js/TrackCompressorLimiter.js - Combined Compressor and Limiter Effect
// A single effect combining compression for dynamics control followed by limiting for peak control

import { Tone } from './lib/Tone.min.js';

class TrackCompressorLimiter extends Tone.Limiter {
    constructor(initialParams = {}) {
        const ceiling = initialParams.ceiling !== undefined ? initialParams.ceiling : -0.3;
        super(ceiling);
        
        // Compressor stage - comes before limiter in the signal chain
        this._compressor = new Tone.Compressor({
            threshold: initialParams.threshold !== undefined ? initialParams.threshold : -18,
            ratio: initialParams.ratio !== undefined ? initialParams.ratio : 4,
            attack: initialParams.attack !== undefined ? initialParams.attack : 0.003,
            release: initialParams.release !== undefined ? initialParams.release : 0.25,
            knee: initialParams.knee !== undefined ? initialParams.knee : 6
        });
        
        // Makeup gain to compensate for compression
        this._makeupGain = new Tone.Gain(initialParams.makeup !== undefined ? initialParams.makeup : 1);
        
        // Connect: input -> compressor -> makeup -> limiter -> output
        this._compressor.connect(this._makeupGain);
        this._makeupGain.connect(this);
        
        // Store params for automation
        this._threshold = initialParams.threshold ?? -18;
        this._ratio = initialParams.ratio ?? 4;
        this._attack = initialParams.attack ?? 0.003;
        this._release = initialParams.release ?? 0.25;
        this._knee = initialParams.knee ?? 6;
        this._makeup = initialParams.makeup ?? 1;
    }
    
    static getEffectDescription() {
        return {
            type: 'TrackCompressorLimiter',
            description: 'Combined compressor and brick-wall limiter for cohesive dynamics control',
            parameters: [
                { name: 'threshold', label: 'Threshold', type: 'float', defaultValue: -18, minValue: -60, maxValue: 0, unit: 'dB', automatable: true },
                { name: 'ratio', label: 'Ratio', type: 'float', defaultValue: 4, minValue: 1, maxValue: 20, unit: ':1', automatable: true },
                { name: 'attack', label: 'Attack', type: 'float', defaultValue: 0.003, minValue: 0.001, maxValue: 0.1, unit: 's', automatable: true },
                { name: 'release', label: 'Release', type: 'float', defaultValue: 0.25, minValue: 0.01, maxValue: 1, unit: 's', automatable: true },
                { name: 'knee', label: 'Knee', type: 'float', defaultValue: 6, minValue: 0, maxValue: 12, unit: 'dB', automatable: true },
                { name: 'makeup', label: 'Makeup', type: 'float', defaultValue: 1, minValue: 0.5, maxValue: 4, unit: 'x', automatable: false },
                { name: 'ceiling', label: 'Ceiling', type: 'float', defaultValue: -0.3, minValue: -6, maxValue: 0, unit: 'dB', automatable: false },
            ]
        };
    }
    
    getCompressor() { return this._compressor; }
    
    getParameter(valueName) {
        switch (valueName) {
            case 'threshold': return this._compressor.threshold;
            case 'ratio': return this._compressor.ratio;
            case 'attack': return this._compressor.attack;
            case 'release': return this._compressor.release;
            case 'knee': return this._compressor.knee;
            case 'makeup': return this._makeupGain.gain;
            case 'ceiling': return this.threshold;
            default: return null;
        }
    }
    
    setParameter(valueName, value) {
        switch (valueName) {
            case 'threshold':
                this._compressor.threshold.value = value;
                this._threshold = value;
                break;
            case 'ratio':
                this._compressor.ratio.value = value;
                this._ratio = value;
                break;
            case 'attack':
                this._compressor.attack.value = value;
                this._attack = value;
                break;
            case 'release':
                this._compressor.release.value = value;
                this._release = value;
                break;
            case 'knee':
                this._compressor.knee.value = value;
                this._knee = value;
                break;
            case 'makeup':
                this._makeupGain.gain.value = value;
                this._makeup = value;
                break;
            case 'ceiling':
                this.threshold.value = value;
                break;
        }
    }
    
    dispose() {
        this._compressor.dispose();
        this._makeupGain.dispose();
        return super.dispose();
    }
}

// --- Registration ---

let localAppServices = {};

export function initTrackCompressorLimiter(appServices) {
    localAppServices = appServices || {};
    console.log('[TrackCompressorLimiter] Initialized');
    
    // Register effect with effectsRegistry if available
    if (localAppServices.registerEffect) {
        localAppServices.registerEffect('TrackCompressorLimiter', {
            displayName: 'Compressor-Limiter',
            toneClass: 'TrackCompressorLimiter',
            params: [
                { key: 'threshold', label: 'Threshold', type: 'knob', min: -60, max: 0, step: 1, defaultValue: -18, decimals: 0, displaySuffix: 'dB', isSignal: true },
                { key: 'ratio', label: 'Ratio', type: 'knob', min: 1, max: 20, step: 0.5, defaultValue: 4, decimals: 1, displaySuffix: ':1', isSignal: false },
                { key: 'attack', label: 'Attack', type: 'knob', min: 1, max: 100, step: 1, defaultValue: 3, decimals: 0, displaySuffix: 'ms', isSignal: false },
                { key: 'release', label: 'Release', type: 'knob', min: 10, max: 1000, step: 10, defaultValue: 250, decimals: 0, displaySuffix: 'ms', isSignal: false },
                { key: 'knee', label: 'Knee', type: 'knob', min: 0, max: 12, step: 0.5, defaultValue: 6, decimals: 1, displaySuffix: 'dB', isSignal: false },
                { key: 'makeup', label: 'Makeup', type: 'knob', min: 0.5, max: 4, step: 0.1, defaultValue: 1, decimals: 1, displaySuffix: 'x', isSignal: false },
                { key: 'ceiling', label: 'Ceiling', type: 'knob', min: -6, max: 0, step: 0.1, defaultValue: -0.3, decimals: 1, displaySuffix: 'dB', isSignal: false },
            ]
        });
        console.log('[TrackCompressorLimiter] Registered with effectsRegistry');
    }
}

// Export for use
export { TrackCompressorLimiter };
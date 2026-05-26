// js/TempoSyncLFO.js - Tempo-Synced LFO for Effect Modulation
// Provides LFO modulation synced to BPM for filter/amp/effect modulation

class TempoSyncLFO {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this._tempo = options.tempo || 120;
        this._rateDivision = options.rateDivision || '1/4';
        this._waveform = options.waveform || 'sine';
        this._depth = options.depth !== undefined ? options.depth : 1.0;
        this._phase = options.phase || 0;
        this._isRunning = false;
        this._offset = options.offset || 0; // Time offset in beats
        
        // Rate divisions mapping to BPM multipliers
        this._divisions = {
            '1/1': 0.25,    // Whole note = 1 cycle per 4 beats
            '1/2': 0.5,     // Half note = 1 cycle per 2 beats  
            '1/4': 1.0,     // Quarter note = 1 cycle per beat
            '1/8': 2.0,     // Eighth note = 2 cycles per beat
            '1/16': 4.0,    // Sixteenth note = 4 cycles per beat
            '1/32': 8.0,    // Thirty-second note = 8 cycles per beat
            '2/1': 0.125,   // Double whole = 1 cycle per 8 beats
            '4/1': 0.0625,  // Quad whole = 1 cycle per 16 beats
        };
        
        // Create LFO oscillator
        this._lfo = audioContext.createOscillator();
        this._lfo.type = this._waveform;
        this._lfo.frequency.value = this._calculateFrequency();
        
        // Create gain for depth control
        this._depthGain = audioContext.createGain();
        this._depthGain.gain.value = this._depth;
        
        // Create output gain for bipolar signal
        this._outputGain = audioContext.createGain();
        this._outputGain.gain.value = 1.0;
        
        // Connect LFO -> depth -> output
        this._lfo.connect(this._depthGain);
        this._depthGain.connect(this._outputGain);
        
        // Connected parameters storage
        this._connectedParams = [];
        
        // Start time tracking
        this._startTime = 0;
    }
    
    _calculateFrequency() {
        // Frequency = (BPM / 60) * division multiplier / 4
        // At 120 BPM, 1/4 note = 2 Hz (2 cycles per second = 1 per beat)
        return (this._tempo / 60) * (this._divisions[this._rateDivision] || 1.0);
    }
    
    /**
     * Start the LFO
     */
    start() {
        if (!this._isRunning) {
            this._lfo.start();
            this._isRunning = true;
            this._startTime = this.audioContext.currentTime;
        }
    }
    
    /**
     * Stop the LFO
     */
    stop() {
        if (this._isRunning) {
            this._lfo.stop();
            this._isRunning = false;
        }
    }
    
    /**
     * Connect LFO output to an AudioParam for modulation
     * @param {AudioParam} param - The parameter to modulate
     * @param {number} intensity - Modulation intensity (0-1), default 1
     */
    connectToParam(param, intensity = 1) {
        if (!param) return;
        
        // Create a gain node for this connection to control intensity
        const intensityGain = this.audioContext.createGain();
        intensityGain.gain.value = intensity;
        
        this._depthGain.connect(intensityGain);
        intensityGain.connect(param);
        
        this._connectedParams.push({ param, intensityGain });
    }
    
    /**
     * Disconnect from a specific parameter
     * @param {AudioParam} param - The parameter to disconnect
     */
    disconnectFromParam(param) {
        const index = this._connectedParams.findIndex(cp => cp.param === param);
        if (index !== -1) {
            const { intensityGain } = this._connectedParams[index];
            this._depthGain.disconnect(intensityGain);
            intensityGain.disconnect(param);
            this._connectedParams.splice(index, 1);
        }
    }
    
    /**
     * Disconnect from all parameters
     */
    disconnectAll() {
        this._connectedParams.forEach(({ param, intensityGain }) => {
            this._depthGain.disconnect(intensityGain);
            intensityGain.disconnect(param);
        });
        this._connectedParams = [];
    }
    
    /**
     * Set the tempo (BPM)
     * @param {number} bpm - Tempo in beats per minute
     */
    setTempo(bpm) {
        this._tempo = Math.max(20, Math.min(300, bpm));
        this._lfo.frequency.setTargetAtTime(
            this._calculateFrequency(), 
            this.audioContext.currentTime, 
            0.01
        );
    }
    
    /**
     * Get current tempo
     */
    getTempo() {
        return this._tempo;
    }
    
    /**
     * Set the rate division
     * @param {string} division - Rate division (e.g., '1/4', '1/8', '1/16')
     */
    setRateDivision(division) {
        if (this._divisions[division] !== undefined) {
            this._rateDivision = division;
            this._lfo.frequency.setTargetAtTime(
                this._calculateFrequency(),
                this.audioContext.currentTime,
                0.01
            );
        }
    }
    
    /**
     * Get current rate division
     */
    getRateDivision() {
        return this._rateDivision;
    }
    
    /**
     * Get available rate divisions
     */
    getAvailableDivisions() {
        return Object.keys(this._divisions);
    }
    
    /**
     * Set LFO waveform type
     * @param {string} type - Waveform type ('sine', 'triangle', 'square', 'sawtooth')
     */
    setWaveform(type) {
        const validTypes = ['sine', 'triangle', 'square', 'sawtooth', 'sawtooth reverse'];
        if (validTypes.includes(type)) {
            this._waveform = type;
            this._lfo.type = type;
        }
    }
    
    /**
     * Get current waveform
     */
    getWaveform() {
        return this._waveform;
    }
    
    /**
     * Get available waveforms
     */
    getAvailableWaveforms() {
        return ['sine', 'triangle', 'square', 'sawtooth', 'sawtooth reverse'];
    }
    
    /**
     * Set modulation depth (0-1)
     * @param {number} depth - Depth value
     */
    setDepth(depth) {
        this._depth = Math.max(0, Math.min(1, depth));
        this._depthGain.gain.setTargetAtTime(this._depth, this.audioContext.currentTime, 0.01);
    }
    
    /**
     * Get modulation depth
     */
    getDepth() {
        return this._depth;
    }
    
    /**
     * Set phase offset (0-360 degrees)
     * @param {number} degrees - Phase in degrees
     */
    setPhase(degrees) {
        this._phase = degrees % 360;
        const radians = (this._phase * Math.PI) / 180;
        this._lfo.phasesetValueAtTime(radians, this.audioContext.currentTime);
    }
    
    /**
     * Get current phase offset
     */
    getPhase() {
        return this._phase;
    }
    
    /**
     * Get output node for direct connection
     */
    getOutput() {
        return this._outputGain;
    }
    
    /**
     * Get modulation output (before output gain)
     */
    getModulationOutput() {
        return this._depthGain;
    }
    
    /**
     * Get current settings
     */
    getSettings() {
        return {
            tempo: this._tempo,
            rateDivision: this._rateDivision,
            waveform: this._waveform,
            depth: this._depth,
            phase: this._phase,
            isRunning: this._isRunning,
            frequency: this._lfo.frequency.value,
            connectedParamsCount: this._connectedParams.length
        };
    }
    
    /**
     * Restore settings from a previous state
     * @param {object} settings - Settings object from getSettings()
     */
    restoreSettings(settings) {
        if (settings.tempo !== undefined) this.setTempo(settings.tempo);
        if (settings.rateDivision !== undefined) this.setRateDivision(settings.rateDivision);
        if (settings.waveform !== undefined) this.setWaveform(settings.waveform);
        if (settings.depth !== undefined) this.setDepth(settings.depth);
        if (settings.phase !== undefined) this.setPhase(settings.phase);
    }
    
    /**
     * Dispose and clean up resources
     */
    dispose() {
        this.disconnectAll();
        this._lfo.disconnect();
        this._depthGain.disconnect();
        this._outputGain.disconnect();
        if (this._isRunning) {
            this._lfo.stop();
        }
    }
}

// Export for use in other modules
export { TempoSyncLFO };
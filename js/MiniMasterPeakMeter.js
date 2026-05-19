/**
 * Mini Master Peak Meter
 * Small visual peak meter in the transport bar
 */

let meterInstance = null;
let animationFrameId = null;

class MiniMasterPeakMeter {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.analyser = null;
        this.element = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        // Find audio context from Tone.js or window
        if (window.Tone && window.Tone.context) {
            this.audioContext = window.Tone.context;
        } else if (window.audioContext) {
            this.audioContext = window.audioContext;
        } else {
            console.log('[MiniMasterPeakMeter] No audio context found, waiting...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // Find master gain - look in window or Tone nodes
        if (window.masterGainNode) {
            this.masterGain = window.masterGainNode;
        } else if (window.Tone && window.Tone.meter) {
            this.masterGain = window.Tone.meter();
        } else {
            console.log('[MiniMasterPeakMeter] Master gain not found');
            return;
        }

        this.isInitialized = true;
        this.createElement();
        this.startMeterLoop();
    }

    createElement() {
        // Create meter element for transport bar
        const meter = document.createElement('div');
        meter.id = 'mini-master-peak-meter';
        meter.innerHTML = `
            <span class="text-xs text-gray-400 mr-1">Peak:</span>
            <div class="mini-peak-bar-container" style="width: 60px; height: 8px; background: #1a1a1a; border-radius: 2px; overflow: hidden; display: inline-block; vertical-align: middle;">
                <div class="mini-peak-bar" style="height: 100%; width: 0%; background: linear-gradient(to right, #22c55e, #eab308, #ef4444); transition: width 0.05s;"></div>
            </div>
            <span class="mini-peak-value text-xs text-gray-400 ml-1" style="min-width: 40px; display: inline-block;">-∞ dB</span>
        `;
        meter.style.cssText = 'display: flex; align-items: center; margin-left: 8px;';

        // Find the transport bar or use the play button's parent
        const playBtn = document.getElementById('playBtnGlobal');
        if (playBtn && playBtn.parentElement) {
            playBtn.parentElement.insertBefore(meter, playBtn.nextSibling);
            this.element = meter;
            console.log('[MiniMasterPeakMeter] Element added to transport bar');
        } else {
            console.log('[MiniMasterPeakMeter] Transport bar not found');
        }
    }

    startMeterLoop() {
        const update = () => {
            if (!this.masterGain) {
                animationFrameId = requestAnimationFrame(update);
                return;
            }

            let peak = -60;

            try {
                if (typeof this.masterGain.getValue === 'function') {
                    const val = this.masterGain.getValue();
                    if (Array.isArray(val)) {
                        peak = Math.max(...val);
                    } else if (typeof val === 'number') {
                        peak = val;
                    }
                } else if (typeof this.masterGain.value === 'number') {
                    peak = this.masterGain.value;
                } else if (this.analyser) {
                    const data = new Float32Array(this.analyser.fftSize);
                    this.analyser.getFloatTimeDomainData(data);
                    let max = 0;
                    for (let i = 0; i < data.length; i++) {
                        const abs = Math.abs(data[i]);
                        if (abs > max) max = abs;
                    }
                    peak = 20 * Math.log10(max + 0.0001);
                }
            } catch (e) {
                // ignore
            }

            // Update UI
            if (this.element) {
                const bar = this.element.querySelector('.mini-peak-bar');
                const value = this.element.querySelector('.mini-peak-value');
                if (bar && value) {
                    const pct = Math.max(0, Math.min(100, ((peak + 60) / 60) * 100));
                    bar.style.width = `${pct}%`;
                    
                    if (peak > -3) {
                        bar.style.background = '#ef4444';
                        value.style.color = '#ef4444';
                    } else if (peak > -12) {
                        bar.style.background = 'linear-gradient(to right, #22c55e, #eab308)';
                        value.style.color = '#eab308';
                    } else {
                        bar.style.background = 'linear-gradient(to right, #22c55e, #eab308, #ef4444)';
                        value.style.color = '#9ca3af';
                    }
                    
                    value.textContent = peak > -99 ? `${peak.toFixed(1)} dB` : '-∞ dB';
                }
            }

            animationFrameId = requestAnimationFrame(update);
        };

        animationFrameId = requestAnimationFrame(update);
    }

    destroy() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Export for use
export function initMiniMasterPeakMeter() {
    if (meterInstance) return meterInstance;
    meterInstance = new MiniMasterPeakMeter();
    meterInstance.init();
    return meterInstance;
}

export function destroyMiniMasterPeakMeter() {
    if (meterInstance) {
        meterInstance.destroy();
        meterInstance = null;
    }
}

// Auto-init when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initMiniMasterPeakMeter());
    } else {
        setTimeout(() => initMiniMasterPeakMeter(), 100);
    }
}
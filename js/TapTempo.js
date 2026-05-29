// BPM Tap Detector - Tap to set tempo
// Averages the last N taps to determine BPM

const TapTempo = (() => {
    let taps = [];
    const MAX_TAPS = 8;
    let tapTimeout = null;
    const TIMEOUT_MS = 3000; // Reset if no tap within 3 seconds

    let indicatorElement = null;
    let bpmDisplayElement = null;

    function createVisualIndicator() {
        if (indicatorElement) return;
        
        // Create indicator container
        indicatorElement = document.createElement('div');
        indicatorElement.id = 'tapTempoIndicator';
        indicatorElement.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 30px;
            width: 120px;
            padding: 12px;
            background: rgba(20, 20, 25, 0.95);
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            color: #e0e0e0;
            font-family: 'Inter', sans-serif;
            z-index: 9999;
            display: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        indicatorElement.innerHTML = `
            <div style="font-size: 10px; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Tap Tempo</div>
            <div id="tapTempoBpmDisplay" style="font-size: 28px; font-weight: 700; color: #00d4aa; text-align: center; line-height: 1;">---</div>
            <div style="font-size: 10px; color: #666; margin-top: 4px; text-align: center;">BPM</div>
            <div id="tapTempoTapsDisplay" style="font-size: 11px; color: #555; margin-top: 8px; text-align: center;">Tap to start</div>
            <div style="display: flex; gap: 4px; margin-top: 10px; justify-content: center;">
                <div class="tap-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #333; transition: background 0.1s;"></div>
                <div class="tap-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #333; transition: background 0.1s;"></div>
                <div class="tap-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #333; transition: background 0.1s;"></div>
                <div class="tap-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #333; transition: background 0.1s;"></div>
            </div>
            <div style="font-size: 9px; color: #444; margin-top: 8px; text-align: center;">Press T or click transport</div>
        `;
        
        document.body.appendChild(indicatorElement);
        bpmDisplayElement = document.getElementById('tapTempoBpmDisplay');
    }

    function showIndicator() {
        if (!indicatorElement) createVisualIndicator();
        indicatorElement.style.display = 'block';
        // Auto-hide after 5 seconds of no taps
        if (tapTimeout) clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => { hideIndicator(); }, 5000);
    }

    function hideIndicator() {
        if (indicatorElement) {
            indicatorElement.style.display = 'none';
        }
    }

    function pulseIndicator() {
        if (!indicatorElement) return;
        const dots = indicatorElement.querySelectorAll('.tap-dot');
        dots.forEach(dot => {
            dot.style.background = '#00d4aa';
            setTimeout(() => { dot.style.background = '#333'; }, 150);
        });
    }

    function updateDisplay(bpm, tapCount) {
        if (!bpmDisplayElement) return;
        if (tapCount < 2) {
            bpmDisplayElement.textContent = '---';
            bpmDisplayElement.parentElement.nextElementSibling.textContent = 'Tap to start';
        } else {
            bpmDisplayElement.textContent = Math.round(bpm);
        }
        const tapsDisplay = document.getElementById('tapTempoTapsDisplay');
        if (tapsDisplay) {
            if (tapCount === 0) tapsDisplay.textContent = 'Tap to start';
            else if (tapCount < 2) tapsDisplay.textContent = `${tapCount} tap`;
            else tapsDisplay.textContent = `${tapCount} taps avg`;
        }
    }

    function addTap(bpm = 120) {
        const now = Date.now();
        
        showIndicator();
        pulseIndicator();
        
        // Clear old timeout
        if (tapTimeout) clearTimeout(tapTimeout);
        
        // Reset if too long since last tap
        if (taps.length > 0 && now - taps[taps.length - 1] > TIMEOUT_MS) {
            taps = [];
        }
        
        taps.push(now);
        
        // Keep only last MAX_TAPS
        if (taps.length > MAX_TAPS) {
            taps.shift();
        }
        
        // Set timeout to reset
        tapTimeout = setTimeout(() => { 
            taps = []; 
            updateDisplay(bpm, 0);
        }, TIMEOUT_MS);
        
        // Need at least 2 taps to calculate
        if (taps.length < 2) {
            updateDisplay(bpm, taps.length);
            return bpm;
        }
        
        // Calculate average interval
        let totalInterval = 0;
        for (let i = 1; i < taps.length; i++) {
            totalInterval += taps[i] - taps[i - 1];
        }
        const avgInterval = totalInterval / (taps.length - 1);
        
        // Convert ms to BPM
        const detectedBpm = Math.round(60000 / avgInterval);
        
        // Clamp to reasonable range
        const clampedBpm = Math.max(20, Math.min(300, detectedBpm));
        updateDisplay(clampedBpm, taps.length);
        
        return clampedBpm;
    }
    
    function reset() {
        taps = [];
        if (tapTimeout) clearTimeout(tapTimeout);
        tapTimeout = null;
        updateDisplay(120, 0);
    }
    
    function getTapCount() {
        return taps.length;
    }
    
    function getLastInterval() {
        if (taps.length < 2) return null;
        return taps[taps.length - 1] - taps[taps.length - 2];
    }

    function getCurrentBpm() {
        if (taps.length < 2) return null;
        let totalInterval = 0;
        for (let i = 1; i < taps.length; i++) {
            totalInterval += taps[i] - taps[i - 1];
        }
        const avgInterval = totalInterval / (taps.length - 1);
        return Math.round(60000 / avgInterval);
    }
    
    return { addTap, reset, getTapCount, getLastInterval, getCurrentBpm, showIndicator, hideIndicator };
})();

// Export for use
window.TapTempo = TapTempo;
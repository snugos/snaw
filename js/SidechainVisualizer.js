// js/SidechainVisualizer.js - Real-time sidechain signal visualization

let localAppServices = {};

/**
 * Initialize the Sidechain Visualizer
 * @param {object} services - App services
 */
export function initSidechainVisualizer(services) {
    localAppServices = services;
    console.log('[SidechainVisualizer] Initialized');
}

/**
 * Open the Sidechain Visualizer panel
 */
export function openSidechainVisualizerPanel() {
    const windowId = 'sidechainVisualizer';
    
    // Check if already open
    const existingWindow = document.getElementById(`sidechain-visualizer-panel`);
    if (existingWindow) {
        existingWindow.remove();
    }
    
    // Get tracks
    const tracks = localAppServices.getTracks?.() || [];
    const sidechainTracks = tracks.filter(t => {
        return t.effects && t.effects.some(e => e.type === 'SidechainCompressor' || e.sidechain === 'track');
    });
    
    // Create panel
    const panel = document.createElement('div');
    panel.id = 'sidechain-visualizer-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-height: 80vh;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 12px;
        color: white;
        font-family: system-ui;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div style="padding: 16px 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 600;">🔊 Sidechain Visualizer</h2>
            <button id="close-sidechain-viz" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        
        <div style="padding: 16px 20px;">
            <div style="margin-bottom: 16px;">
                <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #888;">Sidechain Trigger Signal</h3>
                <canvas id="sidechain-trigger-canvas" style="width: 100%; height: 80px; background: #0a0a14; border-radius: 6px; border: 1px solid #333;"></canvas>
            </div>
            
            <div id="sidechain-tracks-list" style="max-height: 400px; overflow-y: auto;">
                ${sidechainTracks.length > 0 ? sidechainTracks.map(track => `
                    <div class="sidechain-track-item" data-track-id="${track.id}" style="
                        background: #0a0a14;
                        border: 1px solid #333;
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 10px;
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600; font-size: 14px;">${track.name || 'Track ' + track.id}</span>
                            <span class="sidechain-status" style="
                                font-size: 11px;
                                padding: 3px 8px;
                                border-radius: 4px;
                                background: #333;
                                color: #888;
                            ">Inactive</span>
                        </div>
                        <canvas class="track-sidechain-canvas" data-track-id="${track.id}" style="
                            width: 100%;
                            height: 40px;
                            background: #111;
                            border-radius: 4px;
                        "></canvas>
                    </div>
                `).join('') : `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="margin: 0 0 8px 0;">No tracks with sidechain compression</p>
                        <p style="margin: 0; font-size: 12px;">Add a Sidechain Compressor effect to a track to see it here</p>
                    </div>
                `}
            </div>
            
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
                <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #888;">Setup Instructions</h3>
                <div style="font-size: 12px; color: #666; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">1. Add a track with audio (e.g., a kick drum)</p>
                    <p style="margin: 0 0 8px 0;">2. Add the "Sidechain Compressor" effect to another track</p>
                    <p style="margin: 0;">3. The sidechain signal will trigger the compressor, creating the pumping effect</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    panel.querySelector('#close-sidechain-viz').addEventListener('click', () => {
        panel.remove();
    });
    
    // Escape to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Start visualization
    if (sidechainTracks.length > 0) {
        startSidechainVisualization(sidechainTracks);
    }
}

/**
 * Start real-time sidechain visualization
 * @param {Array} tracks - Tracks with sidechain
 */
function startSidechainVisualization(tracks) {
    const triggerCanvas = document.getElementById('sidechain-trigger-canvas');
    const triggerCtx = triggerCanvas?.getContext('2d');
    
    // Set canvas resolution
    if (triggerCanvas) {
        triggerCanvas.width = triggerCanvas.offsetWidth * window.devicePixelRatio;
        triggerCanvas.height = triggerCanvas.offsetHeight * window.devicePixelRatio;
        triggerCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    // Get audio context
    const audioCtx = localAppServices.getAudioContext?.();
    if (!audioCtx) return;
    
    // Create analysers for each track and the trigger bus
    const analysers = new Map();
    
    // Get sidechain bus node
    const getSidechainBus = localAppServices.getSidechainBusNode?.();
    
    if (getSidechainBus) {
        const triggerAnalyser = audioCtx.createAnalyser();
        triggerAnalyser.fftSize = 256;
        triggerAnalyser.smoothingTimeConstant = 0.8;
        
        try {
            getSidechainBus.connect(triggerAnalyser);
        } catch (e) {
            console.log('[SidechainVisualizer] Could not connect to sidechain bus');
        }
        
        analysers.set('trigger', triggerAnalyser);
    }
    
    // Animation loop
    let animationFrame;
    
    function draw() {
        if (!document.getElementById('sidechain-visualizer-panel')) {
            cancelAnimationFrame(animationFrame);
            return;
        }
        
        const width = triggerCanvas?.offsetWidth || 560;
        const height = triggerCanvas?.offsetHeight || 80;
        
        // Draw trigger waveform
        if (triggerCtx && analysers.has('trigger')) {
            const analyser = analysers.get('trigger');
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            analyser.getByteTimeDomainData(dataArray);
            
            // Clear
            triggerCtx.fillStyle = '#0a0a14';
            triggerCtx.fillRect(0, 0, width, height);
            
            // Draw center line
            triggerCtx.strokeStyle = '#333';
            triggerCtx.lineWidth = 1;
            triggerCtx.beginPath();
            triggerCtx.moveTo(0, height / 2);
            triggerCtx.lineTo(width, height / 2);
            triggerCtx.stroke();
            
            // Draw waveform
            triggerCtx.strokeStyle = '#00ff88';
            triggerCtx.lineWidth = 2;
            triggerCtx.beginPath();
            
            const sliceWidth = width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;
                
                if (i === 0) {
                    triggerCtx.moveTo(x, y);
                } else {
                    triggerCtx.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            triggerCtx.stroke();
            
            // Check if there's signal (for status)
            let hasSignal = false;
            for (let i = 0; i < bufferLength; i++) {
                if (Math.abs(dataArray[i] - 128) > 5) {
                    hasSignal = true;
                    break;
                }
            }
            
            // Update status indicator
            const statusEl = document.querySelector('.sidechain-status');
            if (statusEl) {
                if (hasSignal) {
                    statusEl.textContent = 'Active';
                    statusEl.style.background = '#10b981';
                    statusEl.style.color = 'white';
                } else {
                    statusEl.textContent = 'Inactive';
                    statusEl.style.background = '#333';
                    statusEl.style.color = '#888';
                }
            }
        }
        
        // Draw track waveforms
        document.querySelectorAll('.track-sidechain-canvas').forEach(canvas => {
            const ctx = canvas.getContext('2d');
            const trackId = canvas.dataset.trackId;
            
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            
            // Get track analyser
            let analyser = analysers.get(trackId);
            if (!analyser) {
                const track = localAppServices.getTrackById?.(trackId);
                if (track?.outputNode) {
                    analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    try {
                        track.outputNode.connect(analyser);
                        analysers.set(trackId, analyser);
                    } catch (e) {
                        // ignore
                    }
                }
            }
            
            if (analyser) {
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteTimeDomainData(dataArray);
                
                // Clear
                ctx.fillStyle = '#111';
                ctx.fillRect(0, 0, w, h);
                
                // Draw waveform
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                
                const sliceWidth = w / bufferLength;
                let x = 0;
                
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * h) / 2;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    
                    x += sliceWidth;
                }
                
                ctx.stroke();
            }
        });
        
        animationFrame = requestAnimationFrame(draw);
    }
    
    draw();
    
    // Cleanup on panel close
    const cleanup = () => {
        cancelAnimationFrame(animationFrame);
        analysers.forEach(a => a.disconnect?.());
        analysers.clear();
    };
    
    // Watch for panel removal
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node.id === 'sidechain-visualizer-panel') {
                    cleanup();
                    observer.disconnect();
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true });
}

export default {
    initSidechainVisualizer,
    openSidechainVisualizerPanel
};
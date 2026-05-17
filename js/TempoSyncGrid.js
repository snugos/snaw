// js/TempoSyncGrid.js - Tempo-synchronized grid lines
// Grid lines automatically re-render and sync to tempo changes in real-time

let localAppServices = {};
let gridCanvas = null;
let gridCtx = null;
let isInitialized = false;
let lastBpm = 120;
let animationFrameId = null;

// Grid settings
const GRID_BAR_COLOR = '#3b82f6';
const GRID_BEAT_COLOR = '#60a5fa';
const GRID_SUBBEAT_COLOR = '#93c5fd';
const GRID_BACKGROUND = '#1a1a2e';

export function initTempoSyncGrid(appServices) {
    localAppServices = appServices || {};
    
    // Create a dedicated canvas element for the tempo-synced grid overlay
    // Try to find existing timeline canvas first
    gridCanvas = document.getElementById('tempoSyncGridCanvas');
    if (!gridCanvas) {
        gridCanvas = document.createElement('canvas');
        gridCanvas.id = 'tempoSyncGridCanvas';
        gridCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        `;
        
        // Try to append to timeline area
        const timelineArea = document.getElementById('timelineArea') || 
                           document.querySelector('.timeline-area') ||
                           document.querySelector('. ArrangementView');
        if (timelineArea) {
            timelineArea.style.position = 'relative';
            timelineArea.appendChild(gridCanvas);
        }
    }
    
    gridCtx = gridCanvas.getContext('2d');
    isInitialized = true;
    
    // Set initial size
    if (gridCanvas.parentElement) {
        const rect = gridCanvas.parentElement.getBoundingClientRect();
        gridCanvas.width = rect.width || 800;
        gridCanvas.height = rect.height || 100;
    }
    
    // Initial sync
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        lastBpm = Tone.Transport.bpm.value;
        syncGridToTempo(lastBpm);
        startBpmSync();
    }
    
    console.log('[TempoSyncGrid] Grid canvas initialized');
    return gridCanvas;
}

function startBpmSync() {
    if (animationFrameId) return;
    
    function checkBpm() {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            const currentBpm = Tone.Transport.bpm.value;
            if (Math.abs(currentBpm - lastBpm) > 0.01) {
                lastBpm = currentBpm;
                syncGridToTempo(currentBpm);
            }
        }
        animationFrameId = requestAnimationFrame(checkBpm);
    }
    
    checkBpm();
}

export function syncGridToTempo(bpm) {
    if (!gridCtx || !gridCanvas) return;
    
    const width = gridCanvas.width;
    const height = gridCanvas.height;
    
    if (width <= 0 || height <= 0) return;
    
    // Calculate grid spacing based on BPM
    // At 120 BPM, one beat = 0.5 seconds
    const beatDuration = 60 / bpm; // seconds per beat
    const barDuration = beatDuration * 4; // assuming 4/4 time
    
    // Assume 4 bars visible in the timeline width
    const totalSeconds = barDuration * 4;
    const pixelsPerSecond = width / totalSeconds;
    const pixelsPerBeat = pixelsPerSecond * beatDuration;
    const pixelsPerBar = pixelsPerBeat * 4;
    
    // Clear canvas
    gridCtx.clearRect(0, 0, width, height);
    
    // Draw sub-beat lines (lightest)
    gridCtx.strokeStyle = GRID_SUBBEAT_COLOR;
    gridCtx.lineWidth = 0.5;
    gridCtx.setLineDash([2, 4]);
    
    const subBeatInterval = pixelsPerBeat / 4;
    for (let x = subBeatInterval; x < width; x += subBeatInterval) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
        gridCtx.stroke();
    }
    
    // Draw beat lines
    gridCtx.strokeStyle = GRID_BEAT_COLOR;
    gridCtx.lineWidth = 1;
    gridCtx.setLineDash([]);
    
    for (let x = pixelsPerBeat; x < width; x += pixelsPerBeat) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
        gridCtx.stroke();
    }
    
    // Draw bar lines (darkest, most prominent)
    gridCtx.strokeStyle = GRID_BAR_COLOR;
    gridCtx.lineWidth = 2;
    
    for (let x = pixelsPerBar; x < width; x += pixelsPerBar) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
        gridCtx.stroke();
    }
    
    // Draw BPM indicator text in corner
    gridCtx.fillStyle = GRID_BAR_COLOR;
    gridCtx.font = 'bold 12px monospace';
    gridCtx.fillText(`${bpm.toFixed(1)} BPM`, 10, 20);
}

export function setGridCanvas(canvas) {
    if (canvas && canvas.getContext) {
        gridCanvas = canvas;
        gridCtx = canvas.getContext('2d');
        isInitialized = true;
    }
}

export function getCurrentBpm() {
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        return Tone.Transport.bpm.value;
    }
    return lastBpm;
}

export function cleanup() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    gridCtx = null;
    gridCanvas = null;
    isInitialized = false;
}

// Export for window access
window.TempoSyncGrid = {
    initTempoSyncGrid,
    syncGridToTempo,
    setGridCanvas,
    getCurrentBpm,
    cleanup
};
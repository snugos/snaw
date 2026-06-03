// js/TapTempoStdDev.js - BPM Tap Tempo Standard Deviation Indicator
// Shows standard deviation of tap tempo values for consistency feedback

let localAppServices = {};
let stdDevElement = null;
const AVG_TAP_COUNT = 5;

/**
 * Initialize the Tap Tempo StdDev module
 * @param {Object} services - App services
 */
export function initTapTempoStdDev(services) {
    localAppServices = services;
    console.log('[TapTempoStdDev] Initialized');
    
    // Create the std dev display element in the transport bar
    setupStdDevDisplay();
    
    // Connect to TapHistoryUI for tap data
    connectToTapHistory();
}

/**
 * Create and insert the standard deviation display element
 */
function setupStdDevDisplay() {
    // Check if already exists
    const existing = document.getElementById('tapStdDevDisplay');
    if (existing) {
        stdDevElement = existing;
        return;
    }
    
    // Find where to insert - after tapAvgDisplay
    const tapAvgDisplay = document.getElementById('tapAvgDisplay');
    if (!tapAvgDisplay) {
        console.warn('[TapTempoStdDev] tapAvgDisplay element not found');
        return;
    }
    
    // Create std dev display span
    stdDevElement = document.createElement('span');
    stdDevElement.id = 'tapStdDevDisplay';
    stdDevElement.className = 'text-xs px-2 py-1 bg-[#282828] rounded border border-[#4a4a4a] font-mono';
    stdDevElement.style.display = 'none';
    stdDevElement.title = 'Tap tempo consistency (lower = more consistent)';
    
    // Insert after tapAvgDisplay
    tapAvgDisplay.parentNode.insertBefore(stdDevElement, tapAvgDisplay.nextSibling);
    
    console.log('[TapTempoStdDev] StdDev display element created');
}

/**
 * Connect to TapHistoryUI to get tap data and update display
 */
function connectToTapHistory() {
    // Poll for updates when TapHistoryUI has new data
    setInterval(() => {
        updateStdDevDisplay();
    }, 500);
}

/**
 * Calculate standard deviation of tap BPM values
 * @param {Array} taps - Array of { bpm, timestamp }
 * @returns {number} Standard deviation or 0
 */
function calculateStdDev(taps) {
    if (taps.length < 2) return 0;
    
    // Calculate mean
    const sum = taps.reduce((acc, t) => acc + t.bpm, 0);
    const mean = sum / taps.length;
    
    // Calculate variance
    const squaredDiffs = taps.map(t => Math.pow(t.bpm - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, d) => acc + d, 0) / taps.length;
    
    // Return standard deviation
    return Math.sqrt(avgSquaredDiff);
}

/**
 * Get tap data from TapHistoryUI
 * @returns {Array} Array of { bpm, timestamp }
 */
function getTapData() {
    if (window.TapHistoryUI && window.TapHistoryUI.getTapHistory) {
        return window.TapHistoryUI.getTapHistory();
    }
    return [];
}

/**
 * Update the standard deviation display
 */
function updateStdDevDisplay() {
    if (!stdDevElement) return;
    
    const taps = getTapData();
    if (taps.length < 3) {
        stdDevElement.style.display = 'none';
        return;
    }
    
    // Get last N taps for rolling std dev
    const recentTaps = taps.slice(-AVG_TAP_COUNT);
    const stdDev = calculateStdDev(recentTaps);
    
    // Format: "σ: 2.3" (sigma symbol for std dev)
    const stdDevRounded = stdDev.toFixed(1);
    
    // Color coding based on consistency
    let colorClass = 'text-gray-400';
    if (stdDev < 2) {
        colorClass = 'text-green-400'; // Very consistent
    } else if (stdDev < 5) {
        colorClass = 'text-yellow-400'; // Moderate consistency
    } else {
        colorClass = 'text-red-400'; // Inconsistent
    }
    
    stdDevElement.textContent = `σ: ${stdDevRounded}`;
    stdDevElement.className = `text-xs px-2 py-1 bg-[#282828] rounded border border-[#4a4a4a] font-mono ${colorClass}`;
    stdDevElement.style.display = 'inline';
}

// Export for external use
window.TapTempoStdDev = {
    initTapTempoStdDev,
    updateStdDevDisplay,
    calculateStdDev
};
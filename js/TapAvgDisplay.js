// js/TapAvgDisplay.js - BPM Tap Average Display
// Shows rolling average of last N tap tempo values in transport bar

let localAppServices = {};
let tapAvgElement = null;
const AVG_TAP_COUNT = 5; // Average of last 5 taps

/**
 * Initialize the Tap Avg Display module
 * @param {Object} services - App services from main.js
 */
export function initTapAvgDisplay(services) {
    localAppServices = services || {};
    console.log('[TapAvgDisplay] Initialized');
    
    // Get the display element
    tapAvgElement = document.getElementById('tapAvgDisplay');
    
    // Connect to global TapTempo if available
    if (typeof window.TapTempo !== 'undefined') {
        const originalAddTap = window.TapTempo.addTap.bind(window.TapTempo);
        window.TapTempo.addTap = function(bpm) {
            const result = originalAddTap(bpm);
            // Update display when a new tap is recorded
            updateTapAvgFromHistory();
            return result;
        };
    }
}

/**
 * Update the tap average display from TapHistoryUI if available
 */
export function updateTapAvgFromHistory() {
    if (!tapAvgElement) {
        tapAvgElement = document.getElementById('tapAvgDisplay');
    }
    if (!tapAvgElement) return;
    
    // Try to get average from TapHistoryUI
    let avgBpm = null;
    
    if (window.TapHistoryUI && window.TapHistoryUI.getAverageTap) {
        avgBpm = window.TapHistoryUI.getAverageTap(AVG_TAP_COUNT);
    }
    
    if (avgBpm !== null && avgBpm > 0) {
        tapAvgElement.textContent = `Avg: ${avgBpm}`;
        tapAvgElement.style.display = 'inline';
    } else {
        // Hide if no valid average
        tapAvgElement.style.display = 'none';
    }
}

/**
 * Show the average display with a specific value
 * @param {number} bpm - The BPM value to display
 */
export function showTapAvg(bpm) {
    if (!tapAvgElement) {
        tapAvgElement = document.getElementById('tapAvgDisplay');
    }
    if (!tapAvgElement) return;
    
    if (bpm && bpm > 0) {
        tapAvgElement.textContent = `Avg: ${Math.round(bpm)}`;
        tapAvgElement.style.display = 'inline';
    }
}

/**
 * Hide the average display
 */
export function hideTapAvg() {
    if (tapAvgElement) {
        tapAvgElement.style.display = 'none';
    }
}

// Export for use
window.TapAvgDisplay = {
    initTapAvgDisplay,
    updateTapAvgFromHistory,
    showTapAvg,
    hideTapAvg
};
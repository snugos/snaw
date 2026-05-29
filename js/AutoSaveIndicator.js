/**
 * js/AutoSaveIndicator.js - Show last auto-save time in status bar
 * Visual indicator showing when project was last auto-saved
 */

let localAppServices = {};
let indicatorElement = null;
let updateIntervalId = null;
const UPDATE_INTERVAL_MS = 30000; // Update every 30 seconds

/**
 * Initialize the auto-save indicator
 * @param {Object} appServices - App services from main.js
 */
export function initAutoSaveIndicator(appServices) {
    localAppServices = appServices || {};
    console.log('[AutoSaveIndicator] Initialized');
    
    // Create the indicator element if it doesn't exist
    createIndicator();
    
    // Start periodic update
    startPeriodicUpdate();
    
    // Listen for auto-save events
    window.addEventListener('snugos-autosave', handleAutoSaveEvent);
}

/**
 * Create the indicator DOM element
 */
function createIndicator() {
    if (indicatorElement) return;
    
    indicatorElement = document.createElement('div');
    indicatorElement.id = 'auto-save-indicator';
    indicatorElement.className = 'flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 bg-transparent rounded cursor-default';
    indicatorElement.title = 'Auto-save status';
    
    updateDisplay();
    
    // Try to add to a status bar or transport area
    const transportBar = document.querySelector('#transport-bar, .transport-bar, #global-controls, .global-controls');
    if (transportBar) {
        transportBar.appendChild(indicatorElement);
    } else {
        // Fallback: add to document body temporarily
        indicatorElement.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:9999;';
        document.body.appendChild(indicatorElement);
    }
}

/**
 * Update the indicator display with current auto-save time
 */
function updateDisplay() {
    if (!indicatorElement) return;
    
    const lastSaveTime = getLastSaveTime();
    
    if (lastSaveTime <= 0) {
        indicatorElement.innerHTML = `
            <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full bg-slate-500"></div>
                <span>Not saved</span>
            </div>
        `;
        return;
    }
    
    const now = Date.now();
    const elapsed = now - lastSaveTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    let timeText;
    if (hours > 0) {
        timeText = `${hours}h ${minutes % 60}m ago`;
    } else if (minutes > 0) {
        timeText = `${minutes}m ${seconds % 60}s ago`;
    } else if (seconds > 10) {
        timeText = `${seconds}s ago`;
    } else {
        timeText = 'Just saved';
    }
    
    // Color based on how recent
    let dotColor = 'bg-green-500';
    if (elapsed > 5 * 60 * 1000) {
        dotColor = 'bg-yellow-500'; // 5+ minutes
    }
    if (elapsed > 15 * 60 * 1000) {
        dotColor = 'bg-orange-500'; // 15+ minutes
    }
    
    indicatorElement.innerHTML = `
        <div class="flex items-center gap-1" title="Last auto-save: ${new Date(lastSaveTime).toLocaleTimeString()}">
            <div class="w-2 h-2 rounded-full ${dotColor}"></div>
            <span>${timeText}</span>
        </div>
    `;
}

/**
 * Get the last save time from state
 */
function getLastSaveTime() {
    // Try state module first
    const stateModule = localAppServices.stateModule || {};
    if (typeof stateModule.getLastAutoSaveTime === 'function') {
        return stateModule.getLastAutoSaveTime();
    }
    
    // Fallback: check localStorage for auto-save timestamp
    try {
        const savedState = localStorage.getItem('snugos_autosave_state');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            return parsed._autosaveTimestamp || 0;
        }
    } catch (e) {
        // Ignore
    }
    
    return 0;
}

/**
 * Handle auto-save event from the system
 */
function handleAutoSaveEvent(event) {
    updateDisplay();
}

/**
 * Start periodic update of the display
 */
function startPeriodicUpdate() {
    if (updateIntervalId) return;
    
    updateIntervalId = setInterval(() => {
        updateDisplay();
    }, UPDATE_INTERVAL_MS);
    
    // Also update right away
    updateDisplay();
}

/**
 * Stop periodic updates
 */
function stopPeriodicUpdate() {
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
}

/**
 * Show a notification about the last save
 */
export function showSaveStatus() {
    const lastSaveTime = getLastSaveTime();
    
    if (lastSaveTime <= 0) {
        localAppServices.showNotification?.('Project has not been auto-saved yet', 2000);
        return;
    }
    
    const saveDate = new Date(lastSaveTime);
    localAppServices.showNotification?.(`Last auto-save: ${saveDate.toLocaleTimeString()}`, 2000);
}

/**
 * Get the save status for external use
 */
export function getSaveStatus() {
    return {
        lastSaveTime: getLastSaveTime(),
        isindicatorVisible: !!indicatorElement
    };
}

// Expose on window for global access
window.openAutoSaveIndicator = () => {
    showSaveStatus();
};

window.getAutoSaveIndicator = () => ({
    updateDisplay,
    showSaveStatus,
    getSaveStatus
});

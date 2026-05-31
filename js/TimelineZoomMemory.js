// js/TimelineZoomMemory.js - Remember zoom level per project
// Saves and restores timeline zoom level with project data

let localAppServices = {};
const STORAGE_KEY = 'snaw_timeline_zoom';
const DEFAULT_ZOOM = 1.0;

export function initTimelineZoomMemory(services) {
    localAppServices = services;
    console.log('[TimelineZoomMemory] Initialized');
    
    // Load saved zoom from localStorage
    const savedZoom = loadZoomFromStorage();
    if (savedZoom && savedZoom !== DEFAULT_ZOOM) {
        // Apply to adaptive grid if available
        if (typeof setZoomLevel === 'function') {
            setZoomLevel(savedZoom);
        }
        localAppServices.showNotification?.(`Restored timeline zoom: ${Math.round(savedZoom * 100)}%`, 2000);
    }
    
    // Hook into zoom changes to save them
    setupZoomChangeHook();
    
    // Hook into project save/load
    setupProjectHooks();
}

function loadZoomFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.zoom || DEFAULT_ZOOM;
        }
    } catch (e) {
        console.warn('[TimelineZoomMemory] Failed to load zoom from storage:', e);
    }
    return DEFAULT_ZOOM;
}

function saveZoomToStorage(zoom) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            zoom: zoom,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('[TimelineZoomMemory] Failed to save zoom to storage:', e);
    }
}

function setupZoomChangeHook() {
    // Hook into AdaptiveGrid zoom changes if available
    if (typeof setZoomLevel === 'function') {
        const originalSetZoomLevel = setZoomLevel;
        
        // We can't easily wrap the function since it's exported directly
        // But we can monitor the localStorage key that AdaptiveGrid uses
        // Alternatively, we can add our own zoom control to the UI
        
        // Add a zoom display/control to the timeline if not already present
        addZoomControlToUI();
    }
    
    // Add keyboard shortcuts for zoom
    document.addEventListener('keydown', (e) => {
        // Ctrl+Plus - Zoom in
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            adjustZoom(1.25);
        }
        // Ctrl+Minus - Zoom out
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            adjustZoom(0.8);
        }
        // Ctrl+0 - Reset zoom
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            resetZoom();
        }
    });
}

function addZoomControlToUI() {
    // Check if already added
    if (document.getElementById('timelineZoomControl')) return;
    
    // Find timeline header area
    const timelineHeader = document.querySelector('.timeline-header, .timeline-ruler, [class*="timeline"]');
    if (!timelineHeader) return;
    
    const container = document.createElement('div');
    container.id = 'timelineZoomControl';
    container.className = 'flex items-center gap-1 ml-2 text-xs';
    container.innerHTML = `
        <button id="timelineZoomOut" class="px-1 py-0.5 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" title="Zoom Out (Ctrl+-)">−</button>
        <span id="timelineZoomLevel" class="w-10 text-center font-mono">100%</span>
        <button id="timelineZoomIn" class="px-1 py-0.5 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" title="Zoom In (Ctrl++)">+</button>
        <button id="timelineZoomReset" class="px-1 py-0.5 bg-gray-300 dark:bg-slate-700 hover:bg-gray-400 dark:hover:bg-slate-600 rounded" title="Reset Zoom (Ctrl+0)">⟲</button>
    `;
    
    timelineHeader.appendChild(container);
    
    // Attach events
    document.getElementById('timelineZoomOut')?.addEventListener('click', () => adjustZoom(0.8));
    document.getElementById('timelineZoomIn')?.addEventListener('click', () => adjustZoom(1.25));
    document.getElementById('timelineZoomReset')?.addEventListener('click', resetZoom);
}

function adjustZoom(factor) {
    const currentZoom = getCurrentZoomValue();
    const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor));
    applyZoom(newZoom);
}

function resetZoom() {
    applyZoom(DEFAULT_ZOOM);
    localAppServices.showNotification?.('Timeline zoom reset to 100%', 1500);
}

function getCurrentZoomValue() {
    // Try to get zoom from AdaptiveGrid
    if (typeof getCurrentZoom === 'function') {
        return getCurrentZoom();
    }
    // Fallback: parse from UI
    const zoomDisplay = document.getElementById('timelineZoomLevel');
    if (zoomDisplay) {
        const text = zoomDisplay.textContent.replace('%', '');
        return parseInt(text) / 100 || DEFAULT_ZOOM;
    }
    return DEFAULT_ZOOM;
}

function applyZoom(zoom) {
    // Apply to AdaptiveGrid if available
    if (typeof setZoomLevel === 'function') {
        setZoomLevel(zoom);
    }
    
    // Update display
    const zoomDisplay = document.getElementById('timelineZoomLevel');
    if (zoomDisplay) {
        zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
    }
    
    // Save to storage
    saveZoomToStorage(zoom);
}

function setupProjectHooks() {
    // Hook into project save - already handled via localStorage
    // Hook into project load to restore zoom
    const originalLoadProject = localAppServices.loadProjectInternal;
    if (originalLoadProject) {
        localAppServices.loadProjectInternal = function(...args) {
            const result = originalLoadProject.apply(this, args);
            // After loading, restore zoom
            setTimeout(() => {
                const savedZoom = loadZoomFromStorage();
                if (savedZoom !== DEFAULT_ZOOM && typeof setZoomLevel === 'function') {
                    setZoomLevel(savedZoom);
                }
            }, 500);
            return result;
        };
    }
}

// Export for use by other modules
export function getStoredZoom() {
    return loadZoomFromStorage();
}

export function saveZoom(zoom) {
    saveZoomToStorage(zoom);
}
// js/ClipboardHistoryManager.js - Clipboard History for Clips
// Maintains a history stack of copied/cut clips for re-pasting multiple items

let localAppServices = {};
let clipboardHistory = []; // Stack of { clips: [], trackId, mode: 'copy'|'cut', timestamp }
const MAX_HISTORY = 10;
let isVisible = false;
let panelEl = null;

/**
 * Initialize the clipboard history manager
 * @param {Object} services - App services from main.js
 */
export function initClipboardHistoryManager(services) {
    localAppServices = services || {};
    console.log('[ClipboardHistoryManager] Initialized');
    
    // Listen for copy/cut shortcuts to capture clips
    document.addEventListener('keydown', handleKeyboardShortcut);
}

/**
 * Handle keyboard shortcuts for clipboard operations
 * @param {KeyboardEvent} e
 */
function handleKeyboardShortcut(e) {
    // Ctrl+C = Copy selected clips
    if (e.ctrlKey && e.key === 'c') {
        const selectedClips = getSelectedClipsInfo();
        if (selectedClips.length > 0) {
            e.preventDefault();
            addToClipboardHistory(selectedClips, 'copy');
            localAppServices.showNotification?.(`Copied ${selectedClips.length} clip(s)`, 1500);
        }
    }
    
    // Ctrl+X = Cut selected clips
    if (e.ctrlKey && e.key === 'x') {
        const selectedClips = getSelectedClipsInfo();
        if (selectedClips.length > 0) {
            e.preventDefault();
            addToClipboardHistory(selectedClips, 'cut');
            localAppServices.showNotification?.(`Cut ${selectedClips.length} clip(s)`, 1500);
        }
    }
    
    // Ctrl+Shift+V = Show clipboard history panel
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        togglePanel();
    }
    
    // Ctrl+V = Paste from last clipboard entry
    if (e.ctrlKey && e.key === 'v' && !e.shiftKey) {
        if (clipboardHistory.length > 0) {
            e.preventDefault();
            pasteFromHistory(clipboardHistory.length - 1);
        }
    }
}

/**
 * Get currently selected clips info
 * @returns {Array} Array of { clipId, trackId, clipData }
 */
function getSelectedClipsInfo() {
    const result = [];
    const selectedEls = document.querySelectorAll('.timeline-clip.selected');
    
    selectedEls.forEach(el => {
        const clipId = el.dataset.clipId;
        const trackId = parseInt(el.dataset.trackId);
        const track = localAppServices.getTrackById?.(parseInt(trackId));
        
        if (track && track.timelineClips) {
            const clip = track.timelineClips.find(c => c.id === clipId);
            if (clip) {
                result.push({
                    clipId,
                    trackId,
                    clipData: JSON.parse(JSON.stringify(clip))
                });
            }
        }
    });
    
    return result;
}

/**
 * Add clips to clipboard history
 * @param {Array} clipsInfo - Array of clip info objects
 * @param {string} mode - 'copy' or 'cut'
 */
function addToClipboardHistory(clipsInfo, mode) {
    if (clipsInfo.length === 0) return;
    
    // Use first clip's track as reference
    const trackId = clipsInfo[0].trackId;
    
    clipboardHistory.push({
        clips: clipsInfo,
        trackId,
        mode,
        timestamp: Date.now()
    });
    
    // Keep only MAX_HISTORY entries
    if (clipboardHistory.length > MAX_HISTORY) {
        clipboardHistory.shift();
    }
    
    updatePanelDisplay();
}

/**
 * Paste clips from a specific history entry
 * @param {number} index - History index to paste from
 */
function pasteFromHistory(index) {
    if (index < 0 || index >= clipboardHistory.length) return;
    
    const entry = clipboardHistory[index];
    
    // For each clip in the entry, create a copy
    entry.clips.forEach(clipInfo => {
        const track = localAppServices.getTrackById?.(clipInfo.trackId);
        if (!track) return;
        
        const newClipId = `audioclip_${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newClip = {
            ...JSON.parse(JSON.stringify(clipInfo.clipData)),
            id: newClipId,
            name: `${clipInfo.clipData.name} (paste)`,
            startTime: clipInfo.clipData.startTime + 0.1 // Offset slightly
        };
        
        track.timelineClips.push(newClip);
        
        // If cut mode, remove original clip
        if (entry.mode === 'cut') {
            const idx = track.timelineClips.findIndex(c => c.id === clipInfo.clipId);
            if (idx > -1) {
                track.timelineClips.splice(idx, 1);
            }
        }
    });
    
    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }
    
    const action = entry.mode === 'cut' ? 'Cut & pasted' : 'Pasted';
    localAppServices.showNotification?.(`${action} ${entry.clips.length} clip(s)`, 1500);
    
    closePanel();
}

/**
 * Toggle the clipboard history panel visibility
 */
function togglePanel() {
    isVisible = !isVisible;
    
    if (isVisible) {
        showPanel();
    } else {
        closePanel();
    }
}

/**
 * Show the clipboard history panel
 */
function showPanel() {
    if (panelEl) {
        panelEl.style.display = 'block';
        updatePanelDisplay();
        return;
    }
    
    panelEl = document.createElement('div');
    panelEl.id = 'clipboard-history-panel';
    panelEl.innerHTML = getPanelHTML();
    document.body.appendChild(panelEl);
    
    // Add event listeners
    panelEl.addEventListener('click', handlePanelClick);
    
    updatePanelDisplay();
}

/**
 * Close the clipboard history panel
 */
function closePanel() {
    isVisible = false;
    if (panelEl) {
        panelEl.style.display = 'none';
    }
}

/**
 * Get the HTML for the panel
 * @returns {string}
 */
function getPanelHTML() {
    return `
        <div class="clipboard-history-header">
            <span>📋 Clipboard History</span>
            <button class="close-btn" data-action="close">✕</button>
        </div>
        <div class="clipboard-history-list"></div>
        <div class="clipboard-history-footer">
            <span class="text-xs text-gray-500">Ctrl+Shift+V to toggle</span>
        </div>
        <style>
            #clipboard-history-panel {
                position: fixed;
                bottom: 80px;
                right: 20px;
                width: 280px;
                background: #1e1e1e;
                border: 1px solid #404040;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .clipboard-history-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                border-bottom: 1px solid #404040;
                font-size: 13px;
                font-weight: 600;
                color: #fff;
            }
            .clipboard-history-header .close-btn {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 6px;
            }
            .clipboard-history-header .close-btn:hover {
                color: #fff;
            }
            .clipboard-history-list {
                max-height: 300px;
                overflow-y: auto;
            }
            .clipboard-history-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #2a2a2a;
                transition: background 0.15s;
            }
            .clipboard-history-item:hover {
                background: #2a2a2a;
            }
            .clipboard-history-item .item-header {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                color: #ccc;
                margin-bottom: 4px;
            }
            .clipboard-history-item .item-clips {
                font-size: 11px;
                color: #888;
            }
            .clipboard-history-item .item-mode {
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 500;
            }
            .clipboard-history-item .item-mode.copy {
                background: #2563eb;
                color: #fff;
            }
            .clipboard-history-item .item-mode.cut {
                background: #dc2626;
                color: #fff;
            }
            .clipboard-history-footer {
                padding: 8px 12px;
                border-top: 1px solid #404040;
                text-align: center;
            }
            .clipboard-history-empty {
                padding: 20px;
                text-align: center;
                color: #666;
                font-size: 12px;
            }
        </style>
    `;
}

/**
 * Update the panel display with current history
 */
function updatePanelDisplay() {
    if (!panelEl) return;
    
    const listEl = panelEl.querySelector('.clipboard-history-list');
    if (!listEl) return;
    
    if (clipboardHistory.length === 0) {
        listEl.innerHTML = '<div class="clipboard-history-empty">No clipboard history yet.<br>Copy or cut clips with Ctrl+C / Ctrl+X</div>';
        return;
    }
    
    listEl.innerHTML = clipboardHistory.map((entry, index) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const clipNames = entry.clips.map(c => c.clipData.name || 'Untitled').slice(0, 3).join(', ');
        const more = entry.clips.length > 3 ? ` +${entry.clips.length - 3} more` : '';
        
        return `
            <div class="clipboard-history-item" data-index="${index}">
                <div class="item-header">
                    <span class="item-mode ${entry.mode}">${entry.mode.toUpperCase()}</span>
                    <span>${time}</span>
                </div>
                <div class="item-clips">${clipNames}${more}</div>
            </div>
        `;
    }).join('');
}

/**
 * Handle clicks on the panel
 * @param {MouseEvent} e
 */
function handlePanelClick(e) {
    const action = e.target.dataset.action;
    if (action === 'close') {
        closePanel();
        return;
    }
    
    const item = e.target.closest('.clipboard-history-item');
    if (item) {
        const index = parseInt(item.dataset.index);
        pasteFromHistory(index);
    }
}

/**
 * Get the current clipboard history
 * @returns {Array}
 */
export function getClipboardHistory() {
    return [...clipboardHistory];
}

/**
 * Clear clipboard history
 */
export function clearClipboardHistory() {
    clipboardHistory = [];
    updatePanelDisplay();
}

/**
 * Check if clipboard history has items
 * @returns {boolean}
 */
export function hasClipboardHistory() {
    return clipboardHistory.length > 0;
}
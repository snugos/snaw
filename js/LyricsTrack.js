// js/LyricsTrack.js - Lyrics Track Timeline
// Display lyrics synced to the timeline for vocal recording/visualization

let localAppServices = {};
let lyrics = []; // Array of { id, text, startTime, duration, isActive }
let isEnabled = false;
let currentLyricIndex = -1;
const LYRICS_PANEL_ID = 'lyricsTrackContent';
const LYRICS_HEIGHT = 40; // Height of lyrics display area in pixels

/**
 * Initialize Lyrics Track module
 * @param {Object} appServices - Application services from main.js
 */
export function initLyricsTrack(appServices) {
    localAppServices = appServices || {};
    console.log('[LyricsTrack] Module initialized');
}

/**
 * Get all lyrics
 * @returns {Array} Copy of lyrics array
 */
export function getLyrics() {
    return JSON.parse(JSON.stringify(lyrics));
}

/**
 * Add a lyric line
 * @param {string} text - Lyric text
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds (optional, default 2s)
 * @returns {string|null} Lyric ID or null
 */
export function addLyric(text, startTime, duration = 2.0) {
    if (!text || typeof text !== 'string') {
        console.warn('[LyricsTrack] Invalid lyric text');
        return null;
    }
    
    const id = `lyric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    lyrics.push({
        id,
        text: text.trim(),
        startTime: Math.max(0, parseFloat(startTime) || 0),
        duration: Math.max(0.1, parseFloat(duration) || 2.0),
        isActive: false
    });
    
    // Sort by start time
    lyrics.sort((a, b) => a.startTime - b.startTime);
    
    console.log(`[LyricsTrack] Added lyric "${text}" at ${startTime}s`);
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Add lyric');
    }
    
    return id;
}

/**
 * Update a lyric
 * @param {string} lyricId
 * @param {Object} updates - Fields to update (text, startTime, duration)
 * @returns {boolean}
 */
export function updateLyric(lyricId, updates) {
    const lyric = lyrics.find(l => l.id === lyricId);
    if (!lyric) {
        console.warn(`[LyricsTrack] Lyric ${lyricId} not found`);
        return false;
    }
    
    if (updates.text !== undefined) lyric.text = updates.text.trim();
    if (updates.startTime !== undefined) lyric.startTime = Math.max(0, parseFloat(updates.startTime) || 0);
    if (updates.duration !== undefined) lyric.duration = Math.max(0.1, parseFloat(updates.duration) || 2.0);
    
    lyrics.sort((a, b) => a.startTime - b.startTime);
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Update lyric');
    }
    
    return true;
}

/**
 * Remove a lyric
 * @param {string} lyricId
 * @returns {boolean}
 */
export function removeLyric(lyricId) {
    const idx = lyrics.findIndex(l => l.id === lyricId);
    if (idx === -1) {
        console.warn(`[LyricsTrack] Lyric ${lyricId} not found`);
        return false;
    }
    
    lyrics.splice(idx, 1);
    console.log(`[LyricsTrack] Removed lyric ${lyricId}`);
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Remove lyric');
    }
    
    return true;
}

/**
 * Clear all lyrics
 */
export function clearAllLyrics() {
    lyrics = [];
    currentLyricIndex = -1;
    updateLyricsDisplay();
    console.log('[LyricsTrack] Cleared all lyrics');
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Clear all lyrics');
    }
}

/**
 * Import lyrics from text (one line per lyric, space-separated start times optional)
 * Format: "Hello world" or "Hello world @1.5" (with start time)
 * @param {string} text - Multi-line text
 * @param {number} defaultDuration - Default duration per line
 */
export function importLyricsText(text, defaultDuration = 2.0) {
    if (!text) return;
    
    const lines = text.split('\n').filter(line => line.trim());
    let currentTime = 0;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Check for explicit start time: "Hello @1.5"
        const atMatch = trimmed.match(/^(.+?)\s+@(\d+\.?\d*)$/);
        if (atMatch) {
            addLyric(atMatch[1], parseFloat(atMatch[2]), defaultDuration);
        } else {
            addLyric(trimmed, currentTime, defaultDuration);
            currentTime += defaultDuration;
        }
    });
    
    console.log(`[LyricsTrack] Imported ${lines.length} lyric lines`);
}

/**
 * Get current lyric based on playback position
 * @param {number} currentTime - Current playback time in seconds
 * @returns {Object|null}
 */
export function getCurrentLyric(currentTime) {
    const active = lyrics.find(l => 
        currentTime >= l.startTime && currentTime < l.startTime + l.duration
    );
    return active || null;
}

/**
 * Update display based on current playback time
 * @param {number} currentTime - Current playback time in seconds
 */
export function updateCurrentLyric(currentTime) {
    const newIndex = lyrics.findIndex(l => 
        currentTime >= l.startTime && currentTime < l.startTime + l.duration
    );
    
    if (newIndex !== currentLyricIndex) {
        // Deactivate all
        lyrics.forEach(l => l.isActive = false);
        
        // Activate new
        if (newIndex >= 0 && newIndex < lyrics.length) {
            lyrics[newIndex].isActive = true;
        }
        
        currentLyricIndex = newIndex;
        updateLyricsDisplay();
    }
}

/**
 * Enable/disable lyrics track display
 * @param {boolean} enabled
 */
export function setLyricsTrackEnabled(enabled) {
    isEnabled = !!enabled;
    updateLyricsDisplay();
    console.log(`[LyricsTrack] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Check if lyrics track is enabled
 * @returns {boolean}
 */
export function isLyricsTrackEnabled() {
    return isEnabled;
}

/**
 * Open lyrics panel window
 */
export function openLyricsTrackPanel() {
    const windowId = 'lyricsTrackPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = LYRICS_PANEL_ID;
    contentContainer.className = 'p-0 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';
    contentContainer.innerHTML = getLyricsPanelHTML();
    
    const options = {
        width: 600,
        height: 400,
        minWidth: 400,
        minHeight: 300,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Lyrics Track', contentContainer, options);
    if (win?.element) {
        setupLyricsPanelEvents(contentContainer);
    }
    
    return win;
}

/**
 * Get HTML for lyrics panel
 * @returns {string}
 */
function getLyricsPanelHTML() {
    const lyricsList = lyrics.map(l => `
        <div class="lyric-item flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700" data-id="${l.id}">
            <span class="lyric-time text-xs text-gray-500 w-16">${l.startTime.toFixed(2)}s</span>
            <span class="lyric-text flex-1 ${l.isActive ? 'text-blue-600 font-bold' : 'text-gray-700 dark:text-gray-300'}">${l.text}</span>
            <button class="lyric-edit-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Edit</button>
            <button class="lyric-delete-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
        </div>
    `).join('');
    
    return `
        <div class="flex flex-col h-full">
            <div class="lyrics-toolbar p-2 bg-gray-200 dark:bg-slate-700 flex items-center gap-2 border-b border-gray-300 dark:border-gray-600">
                <button id="lyricsAddBtn" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">+ Add Lyric</button>
                <button id="lyricsImportBtn" class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">Import Text</button>
                <button id="lyricsClearBtn" class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Clear All</button>
                <div class="flex-1"></div>
                <button id="lyricsPlayBtn" class="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600">▶ Play Lyrics</button>
            </div>
            <div id="lyricsListContainer" class="flex-1 overflow-y-auto p-2 space-y-1">
                ${lyrics.length > 0 ? lyricsList : '<p class="text-gray-500 text-center py-4">No lyrics yet. Add some!</p>'}
            </div>
            <div class="lyrics-input-area p-2 bg-gray-200 dark:bg-slate-700 border-t border-gray-300 dark:border-gray-600">
                <div class="flex gap-2">
                    <input id="lyricsTextInput" type="text" placeholder="Enter lyric text..." class="flex-1 px-2 py-1 border rounded text-sm">
                    <input id="lyricsTimeInput" type="number" placeholder="Start" step="0.1" min="0" class="w-20 px-2 py-1 border rounded text-sm">
                    <input id="lyricsDurationInput" type="number" placeholder="Dur" step="0.1" min="0.1" value="2" class="w-16 px-2 py-1 border rounded text-sm">
                    <button id="lyricsAddSubmitBtn" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Add</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup event handlers for lyrics panel
 * @param {HTMLElement} container 
 */
function setupLyricsPanelEvents(container) {
    // Add button
    container.querySelector('#lyricsAddBtn')?.addEventListener('click', () => {
        const textInput = container.querySelector('#lyricsTextInput');
        const timeInput = container.querySelector('#lyricsTimeInput');
        const durationInput = container.querySelector('#lyricsDurationInput');
        
        const text = textInput?.value?.trim();
        if (!text) return;
        
        const startTime = parseFloat(timeInput?.value) || 0;
        const duration = parseFloat(durationInput?.value) || 2.0;
        
        addLyric(text, startTime, duration);
        textInput.value = '';
        timeInput.value = '';
        container.querySelector('#lyricsListContainer').innerHTML = getLyricsPanelHTML().match(/<div id="lyricsListContainer"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
        setupLyricsPanelEvents(container);
    });
    
    // Submit on Enter
    container.querySelector('#lyricsTextInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            container.querySelector('#lyricsAddBtn')?.click();
        }
    });
    
    // Import button - simple prompt for multi-line text
    container.querySelector('#lyricsImportBtn')?.addEventListener('click', () => {
        const text = prompt('Paste lyrics (one line per lyric, optionally use @time for specific start time):\n\nExample:\nHello world\nHello world @1.5\nNice to meet you');
        if (text) {
            importLyricsText(text, 2.0);
            refreshLyricsList(container);
        }
    });
    
    // Clear all
    container.querySelector('#lyricsClearBtn')?.addEventListener('click', () => {
        if (confirm('Clear all lyrics?')) {
            clearAllLyrics();
            refreshLyricsList(container);
        }
    });
    
    // Play lyrics - just highlight and show
    container.querySelector('#lyricsPlayBtn')?.addEventListener('click', () => {
        if (lyrics.length === 0) return;
        // Jump to first lyric
        const firstTime = lyrics[0].startTime;
        if (localAppServices.seekPlayback) {
            localAppServices.seekPlayback(firstTime);
        }
    });
    
    // Delete buttons
    container.querySelectorAll('.lyric-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.lyric-item');
            const id = item?.dataset?.id;
            if (id && confirm('Delete this lyric?')) {
                removeLyric(id);
                refreshLyricsList(container);
            }
        });
    });
    
    // Edit buttons
    container.querySelectorAll('.lyric-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.lyric-item');
            const id = item?.dataset?.id;
            const lyric = lyrics.find(l => l.id === id);
            if (!lyric) return;
            
            const newText = prompt('Edit lyric text:', lyric.text);
            const newTime = parseFloat(prompt('Edit start time:', lyric.startTime)) || lyric.startTime;
            const newDuration = parseFloat(prompt('Edit duration:', lyric.duration)) || lyric.duration;
            
            if (newText !== null) {
                updateLyric(id, { text: newText, startTime: newTime, duration: newDuration });
                refreshLyricsList(container);
            }
        });
    });
}

/**
 * Refresh the lyrics list in panel
 * @param {HTMLElement} container 
 */
function refreshLyricsList(container) {
    const listContainer = container.querySelector('#lyricsListContainer');
    if (listContainer) {
        listContainer.innerHTML = lyrics.map(l => `
            <div class="lyric-item flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700" data-id="${l.id}">
                <span class="lyric-time text-xs text-gray-500 w-16">${l.startTime.toFixed(2)}s</span>
                <span class="lyric-text flex-1 ${l.isActive ? 'text-blue-600 font-bold' : 'text-gray-700 dark:text-gray-300'}">${l.text}</span>
                <button class="lyric-edit-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Edit</button>
                <button class="lyric-delete-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4">No lyrics yet. Add some!</p>';
        
        setupLyricsPanelEvents(container);
    }
}

/**
 * Update the lyrics display in timeline (called during playback)
 */
function updateLyricsDisplay() {
    // Find or create lyrics display element in timeline
    let display = document.getElementById('lyricsTimelineDisplay');
    
    if (!isEnabled) {
        if (display) display.style.display = 'none';
        return;
    }
    
    if (!display) {
        // Create lyrics display area below timeline ruler
        const ruler = document.querySelector('.timeline-ruler') || document.querySelector('#timelineRuler');
        if (ruler) {
            display = document.createElement('div');
            display.id = 'lyricsTimelineDisplay';
            display.className = 'lyrics-timeline-display';
            display.style.cssText = `
                height: ${LYRICS_HEIGHT}px;
                background: linear-gradient(90deg, rgba(168,85,247,0.1), rgba(168,85,247,0.2));
                border-bottom: 2px solid rgba(168,85,247,0.5);
                position: relative;
                cursor: pointer;
                display: flex;
                align-items: center;
                overflow: hidden;
            `;
            ruler.parentElement?.insertBefore(display, ruler.nextSibling);
        }
    }
    
    if (display) {
        display.style.display = 'flex';
        
        // Render lyric highlights
        const currentTime = localAppServices.getPlaybackPosition ? localAppServices.getPlaybackPosition() : 0;
        const pixelsPerSecond = 100; // Approximate, should match timeline
        
        display.innerHTML = lyrics.map(l => {
            const left = l.startTime * pixelsPerSecond;
            const width = l.duration * pixelsPerSecond;
            return `
                <div class="lyric-highlight" data-id="${l.id}" style="
                    position: absolute;
                    left: ${left}px;
                    width: ${width}px;
                    height: 100%;
                    background: ${l.isActive ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.2)'};
                    border-left: 2px solid rgba(168,85,247,0.8);
                    display: flex;
                    align-items: center;
                    padding: 0 4px;
                    overflow: hidden;
                    font-size: 11px;
                    color: ${l.isActive ? '#fff' : 'rgba(255,255,255,0.7)'};
                    font-weight: ${l.isActive ? 'bold' : 'normal'};
                    text-overflow: ellipsis;
                    white-space: nowrap;
                " title="${l.text}">${l.text}</div>
            `;
        }).join('');
        
        // Update active lyric text
        const activeLyric = getCurrentLyric(currentTime);
        if (activeLyric) {
            display.title = activeLyric.text;
        }
    }
}

/**
 * Export lyrics data for serialization
 * @returns {Array}
 */
export function exportLyricsData() {
    return lyrics.map(l => ({
        text: l.text,
        startTime: l.startTime,
        duration: l.duration
    }));
}

/**
 * Import lyrics data from serialized format
 * @param {Array} data 
 */
export function importLyricsData(data) {
    if (!Array.isArray(data)) return;
    
    lyrics = data.map(l => ({
        id: `lyric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: l.text || '',
        startTime: l.startTime || 0,
        duration: l.duration || 2.0,
        isActive: false
    }));
    
    lyrics.sort((a, b) => a.startTime - b.startTime);
    currentLyricIndex = -1;
    updateLyricsDisplay();
    console.log(`[LyricsTrack] Imported ${lyrics.length} lyrics`);
}
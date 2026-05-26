// js/MixerChannelStripPresets.js - Save/load complete channel strip settings
// Allows saving gain, pan, EQ, sends, and effects for each track channel

let localAppServices = {};
let currentPresetName = '';
let presetDialog = null;

/**
 * Initialize the channel strip presets module
 * @param {object} services - App services
 */
export function initMixerChannelStripPresets(services) {
    localAppServices = services;
    console.log('[MixerChannelStripPresets] Initialized');
}

/**
 * Open the Channel Strip Presets panel
 */
export function openMixerChannelStripPresetsPanel() {
    const windowId = 'mixerChannelStripPresets';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderChannelStripPresetsContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'mixerChannelStripPresetsContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 450, 
        height: 550, 
        minWidth: 380, 
        minHeight: 450,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Channel Strip Presets', contentContainer, options);
    
    if (win?.element) {
        renderChannelStripPresetsContent();
    }
    
    return win;
}

/**
 * Render the channel strip presets content
 */
function renderChannelStripPresetsContent() {
    const container = document.getElementById('mixerChannelStripPresetsContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    const presetNames = getChannelStripPresetNames();
    
    let html = `
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mixer Channel Strip Presets</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Save and load complete mixer channel settings for tracks.
            </p>
        </div>
        
        <!-- Preset Management -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex gap-2 mb-3">
                <input type="text" id="channelStripPresetName" placeholder="Preset name..." 
                    class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <button id="saveChannelStripPresetBtn" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Save
                </button>
            </div>
            
            <div class="mb-2">
                <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Load Preset</label>
                <select id="channelStripPresetSelect" class="w-full p-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    <option value="">-- Select preset --</option>
                    ${presetNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                </select>
            </div>
            
            ${presetNames.length > 0 ? `
                <div class="flex gap-2 mt-2">
                    <button id="loadChannelStripPresetBtn" class="flex-1 px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                        Load
                    </button>
                    <button id="deleteChannelStripPresetBtn" class="px-3 py-2 text-xs bg-red-500 text-white rounded hover:bg-red-600">
                        Delete
                    </button>
                </div>
            ` : ''}
        </div>
        
        <!-- Track Selection -->
        <div class="mb-4">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Apply To Track</label>
            <select id="channelStripTargetTrack" class="w-full p-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                ${tracks.map(t => `<option value="${t.id}">${t.name || 'Track ' + t.id}</option>`).join('')}
            </select>
        </div>
        
        <!-- What to Save/Load -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Settings to Save</h4>
            <div class="space-y-2">
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludeVolume" checked class="w-4 h-4">
                    Volume
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludePan" checked class="w-4 h-4">
                    Pan
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludeMute" checked class="w-4 h-4">
                    Mute State
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludeSolo" checked class="w-4 h-4">
                    Solo State
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludeEffects" checked class="w-4 h-4">
                    Effects Chain
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludeSends" checked class="w-4 h-4">
                    Send Levels
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" id="csIncludeColor" checked class="w-4 h-4">
                    Track Color
                </label>
            </div>
        </div>
        
        <!-- Info -->
        <div class="text-xs text-gray-400 dark:text-gray-500 text-center">
            ${presetNames.length} preset(s) saved
        </div>
    `;
    
    container.innerHTML = html;
    
    // Attach event listeners
    const saveBtn = container.querySelector('#saveChannelStripPresetBtn');
    saveBtn?.addEventListener('click', () => {
        const nameInput = container.querySelector('#channelStripPresetName');
        const presetName = nameInput?.value?.trim();
        if (!presetName) {
            localAppServices.showNotification?.('Enter a preset name', 2000);
            return;
        }
        saveChannelStripPreset(presetName);
        renderChannelStripPresetsContent();
    });
    
    const loadBtn = container.querySelector('#loadChannelStripPresetBtn');
    loadBtn?.addEventListener('click', () => {
        const select = container.querySelector('#channelStripPresetSelect');
        const presetName = select?.value;
        const trackId = parseInt(container.querySelector('#channelStripTargetTrack')?.value, 10);
        if (!presetName) {
            localAppServices.showNotification?.('Select a preset to load', 2000);
            return;
        }
        applyChannelStripPreset(presetName, trackId);
    });
    
    const deleteBtn = container.querySelector('#deleteChannelStripPresetBtn');
    deleteBtn?.addEventListener('click', () => {
        const select = container.querySelector('#channelStripPresetSelect');
        const presetName = select?.value;
        if (!presetName) {
            localAppServices.showNotification?.('Select a preset to delete', 2000);
            return;
        }
        deleteChannelStripPreset(presetName);
        renderChannelStripPresetsContent();
    });
}

/**
 * Get all saved preset names
 * @returns {string[]} Preset names
 */
function getChannelStripPresetNames() {
    const stored = localStorage.getItem('mixerChannelStripPresets');
    if (!stored) return [];
    try {
        const data = JSON.parse(stored);
        return Object.keys(data).sort();
    } catch {
        return [];
    }
}

/**
 * Save current channel strip settings as a preset
 * @param {string} presetName - Name for the preset
 */
function saveChannelStripPreset(presetName) {
    if (!presetName?.trim()) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    if (tracks.length === 0) {
        localAppServices.showNotification?.('No tracks to save', 2000);
        return;
    }
    
    // Get the first track as template (or selected track if available)
    const targetTrack = localAppServices.getSelectedTrackId?.() 
        ? tracks.find(t => t.id === localAppServices.getSelectedTrackId())
        : tracks[0];
    
    if (!targetTrack) {
        localAppServices.showNotification?.('No target track found', 2000);
        return;
    }
    
    // Gather settings from UI checkboxes
    const container = document.getElementById('mixerChannelStripPresetsContent');
    const includeVolume = container?.querySelector('#csIncludeVolume')?.checked ?? true;
    const includePan = container?.querySelector('#csIncludePan')?.checked ?? true;
    const includeMute = container?.querySelector('#csIncludeMute')?.checked ?? true;
    const includeSolo = container?.querySelector('#csIncludeSolo')?.checked ?? true;
    const includeEffects = container?.querySelector('#csIncludeEffects')?.checked ?? true;
    const includeSends = container?.querySelector('#csIncludeSends')?.checked ?? true;
    const includeColor = container?.querySelector('#csIncludeColor')?.checked ?? true;
    
    const presetData = {
        name: presetName.trim(),
        createdAt: new Date().toISOString(),
        settings: {
            volume: includeVolume ? (targetTrack.previousVolumeBeforeMute ?? targetTrack.volume ?? 0.7) : null,
            pan: includePan ? (targetTrack.pan ?? 0) : null,
            isMuted: includeMute ? (targetTrack.isMuted ?? false) : null,
            isSoloed: includeSolo ? (targetTrack.isSoloed ?? false) : null,
            color: includeColor ? (targetTrack.color || '#3b82f6') : null,
            effects: includeEffects ? (targetTrack.activeEffects || []).map(e => ({
                id: e.id,
                type: e.type,
                params: e.params ? JSON.parse(JSON.stringify(e.params)) : {}
            })) : [],
            sends: includeSends ? gatherSendSettings(targetTrack) : []
        }
    };
    
    // Get existing presets
    let presets = {};
    const stored = localStorage.getItem('mixerChannelStripPresets');
    if (stored) {
        try {
            presets = JSON.parse(stored);
        } catch {}
    }
    
    presets[presetName.trim()] = presetData;
    localStorage.setItem('mixerChannelStripPresets', JSON.stringify(presets));
    
    localAppServices.showNotification?.(`Preset "${presetName.trim()}" saved`, 2000);
    console.log(`[MixerChannelStripPresets] Saved preset: ${presetName.trim()}`);
}

/**
 * Gather send settings from a track
 * @param {object} track - Track object
 * @returns {Array} Send settings
 */
function gatherSendSettings(track) {
    const sends = [];
    if (track.sends) {
        for (const send of track.sends) {
            sends.push({
                busId: send.busId || send.targetTrackId,
                amount: send.amount ?? 0,
                pan: send.pan ?? 0,
                enabled: send.enabled ?? true
            });
        }
    }
    return sends;
}

/**
 * Apply a saved preset to a track
 * @param {string} presetName - Preset to apply
 * @param {number} trackId - Track ID to apply to
 */
function applyChannelStripPreset(presetName, trackId) {
    const stored = localStorage.getItem('mixerChannelStripPresets');
    if (!stored) {
        localAppServices.showNotification?.('No presets found', 2000);
        return;
    }
    
    let presets;
    try {
        presets = JSON.parse(stored);
    } catch {
        localAppServices.showNotification?.('Error loading presets', 2000);
        return;
    }
    
    const preset = presets[presetName];
    if (!preset) {
        localAppServices.showNotification?.(`Preset "${presetName}" not found`, 2000);
        return;
    }
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        localAppServices.showNotification?.('Target track not found', 2000);
        return;
    }
    
    const settings = preset.settings;
    
    // Apply volume
    if (settings.volume !== null && localAppServices.setTrackVolume) {
        localAppServices.setTrackVolume(trackId, settings.volume);
    }
    
    // Apply pan
    if (settings.pan !== null && localAppServices.setTrackPan) {
        localAppServices.setTrackPan(trackId, settings.pan);
    }
    
    // Apply mute
    if (settings.isMuted !== null && localAppServices.setTrackMute) {
        if (settings.isMuted) localAppServices.setTrackMute(trackId, true);
        else localAppServices.setTrackUnmute?.(trackId);
    }
    
    // Apply solo
    if (settings.isSoloed !== null && localAppServices.setTrackSolo) {
        if (settings.isSoloed) localAppServices.setTrackSolo(trackId, true);
        else localAppServices.setTrackUnsolo?.(trackId);
    }
    
    // Apply color
    if (settings.color !== null && localAppServices.setTrackColor) {
        localAppServices.setTrackColor(trackId, settings.color);
    }
    
    // Apply effects chain
    if (settings.effects && settings.effects.length > 0 && localAppServices.setTrackEffectsChain) {
        localAppServices.setTrackEffectsChain(trackId, settings.effects);
    }
    
    // Apply sends
    if (settings.sends && settings.sends.length > 0 && localAppServices.setTrackSends) {
        localAppServices.setTrackSends(trackId, settings.sends);
    }
    
    // Update UI
    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(trackId, 'channelStripPresetApplied');
    }
    if (localAppServices.renderMixer) {
        localAppServices.renderMixer?.();
    }
    
    localAppServices.showNotification?.(`Applied preset "${presetName}"`, 2000);
    console.log(`[MixerChannelStripPresets] Applied preset "${presetName}" to track ${trackId}`);
}

/**
 * Delete a saved preset
 * @param {string} presetName - Preset to delete
 */
function deleteChannelStripPreset(presetName) {
    let presets = {};
    const stored = localStorage.getItem('mixerChannelStripPresets');
    if (stored) {
        try {
            presets = JSON.parse(stored);
        } catch {}
    }
    
    if (presets[presetName]) {
        delete presets[presetName];
        localStorage.setItem('mixerChannelStripPresets', JSON.stringify(presets));
        localAppServices.showNotification?.(`Deleted preset "${presetName}"`, 2000);
        console.log(`[MixerChannelStripPresets] Deleted preset: ${presetName}`);
    }
}

/**
 * Export all presets as JSON
 * @returns {string} JSON string of all presets
 */
export function exportChannelStripPresets() {
    const stored = localStorage.getItem('mixerChannelStripPresets');
    return stored || '{}';
}

/**
 * Import presets from JSON
 * @param {string} jsonString - JSON string of presets
 */
export function importChannelStripPresets(jsonString) {
    try {
        const imported = JSON.parse(jsonString);
        if (typeof imported === 'object' && imported !== null) {
            localStorage.setItem('mixerChannelStripPresets', JSON.stringify(imported));
            localAppServices.showNotification?.(`Imported ${Object.keys(imported).length} presets`, 2000);
        }
    } catch (e) {
        console.error('[MixerChannelStripPresets] Import error:', e);
        localAppServices.showNotification?.('Import failed', 2000);
    }
}
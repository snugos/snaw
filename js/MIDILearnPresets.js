/**
 * js/MIDILearnPresets.js - Save and recall MIDI Learn mappings for different hardware setups
 * Allows users to save complete MIDI CC mapping configurations as reusable presets
 */

let localAppServices = {};
let currentPanelWindow = null;

/**
 * Initialize MIDI Learn Presets module
 * @param {object} services - App services
 */
export function initMIDILearnPresets(services) {
    localAppServices = services;
    
    // Add menu item to access MIDI Learn Presets
    if (typeof addMenuItem === 'function') {
        addMenuItem({
            id: 'midiLearnPresets',
            label: 'MIDI Learn Presets',
            icon: '💾',
            action: 'openMIDILearnPresets',
            category: 'midi'
        });
    }
    
    // Listen for menu action
    document.addEventListener('menuAction', (e) => {
        if (e.detail?.action === 'openMIDILearnPresets') {
            openMIDILearnPresetsPanel();
        }
    });
    
    console.log('[MIDILearnPresets] Initialized');
}

/**
 * Open MIDI Learn Presets panel
 */
export function openMIDILearnPresetsPanel() {
    if (currentPanelWindow && !currentPanelWindow.isDestroyed) {
        currentPanelWindow.focus();
        return currentPanelWindow;
    }
    
    const presets = getSavedPresets();
    const currentMappings = localAppServices.getMidiMappings?.() || {};
    const mappingCount = Object.keys(currentMappings).length;
    
    const content = `
        <div style="padding: 14px; min-width: 320px; max-height: 480px; overflow-y: auto;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: var(--foreground, #f5f1e8);">
                💾 MIDI Learn Presets
            </div>
            
            <div style="font-size: 11px; color: var(--muted, #aaa39a); margin-bottom: 12px;">
                Current mappings: <span style="color: var(--accent, #d8a657);">${mappingCount}</span>
            </div>
            
            <div style="margin-bottom: 16px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #ccc;">Save Current Mappings</div>
                <div class="flex gap-2">
                    <input type="text" id="presetNameInput" placeholder="Preset name..." 
                        style="flex: 1; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 13px;">
                    <button id="savePresetBtn" style="padding: 8px 16px; background: #4ade80; color: #000; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
                        Save
                    </button>
                </div>
            </div>
            
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #ccc;">
                Saved Presets (${presets.length})
            </div>
            
            <div id="presetsList" style="max-height: 280px; overflow-y: auto;">
                ${presets.length === 0 ? '<div style="color: #666; font-size: 12px; text-align: center; padding: 20px;">No presets saved yet</div>' : ''}
                ${presets.map((preset, index) => `
                    <div class="preset-item" data-index="${index}" style="padding: 10px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-weight: 600; color: var(--accent, #d8a657);">${escapeHtml(preset.name)}</span>
                            <span style="font-size: 11px; color: #666;">${preset.mappings} mappings</span>
                        </div>
                        <div style="font-size: 10px; color: #555; margin-bottom: 8px;">
                            Saved: ${preset.date}
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="load-preset-btn" data-index="${index}" style="flex: 1; padding: 6px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">
                                Load
                            </button>
                            <button class="export-preset-btn" data-index="${index}" style="padding: 6px 10px; background: #444; color: #fff; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">
                                Export
                            </button>
                            <button class="delete-preset-btn" data-index="${index}" style="padding: 6px 10px; background: #dc2626; color: #fff; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">
                                Delete
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button id="exportAllPresetsBtn" style="width: 100%; padding: 8px; background: #444; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    Export All Presets
                </button>
            </div>
        </div>
    `;
    
    const SnugWindow = localAppServices.SnugWindow || window.SnugWindow;
    if (!SnugWindow) {
        console.warn('[MIDILearnPresets] SnugWindow not available');
        return;
    }
    
    currentPanelWindow = new SnugWindow(
        'midi-learn-presets',
        'MIDI Learn Presets',
        content,
        { width: 360, height: 520 },
        localAppServices
    );
    
    currentPanelWindow.onClose = () => {
        currentPanelWindow = null;
    };
    
    // Add event listeners
    setTimeout(() => {
        const saveBtn = document.getElementById('savePresetBtn');
        const nameInput = document.getElementById('presetNameInput');
        const exportAllBtn = document.getElementById('exportAllPresetsBtn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const name = nameInput?.value?.trim();
                if (!name) {
                    localAppServices.showNotification?.('Please enter a preset name', 'warning');
                    return;
                }
                saveCurrentMappingsAsPreset(name);
                // Refresh panel
                openMIDILearnPresetsPanel();
            });
        }
        
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', () => exportAllPresets());
        }
        
        // Preset item buttons
        document.querySelectorAll('.load-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                loadPreset(index);
            });
        });
        
        document.querySelectorAll('.export-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                exportSinglePreset(index);
            });
        });
        
        document.querySelectorAll('.delete-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                deletePreset(index);
                openMIDILearnPresetsPanel();
            });
        });
    }, 100);
    
    return currentPanelWindow;
}

/**
 * Get saved presets from localStorage
 */
function getSavedPresets() {
    try {
        const stored = localStorage.getItem('snawMIDILearnPresets');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('[MIDILearnPresets] Error loading presets:', e);
        return [];
    }
}

/**
 * Save presets to localStorage
 */
function savePresets(presets) {
    try {
        localStorage.setItem('snawMIDILearnPresets', JSON.stringify(presets));
    } catch (e) {
        console.warn('[MIDILearnPresets] Error saving presets:', e);
    }
}

/**
 * Save current MIDI mappings as a preset
 * @param {string} name - Preset name
 */
function saveCurrentMappingsAsPreset(name) {
    const mappings = localAppServices.getMidiMappings?.() || {};
    const mappingList = Object.entries(mappings).map(([key, value]) => {
        // Create a simplified representation for the preset
        return {
            key: key,
            type: value.type,
            targetId: value.targetId,
            paramPath: value.paramPath,
            cc: value.cc,
            channel: value.channel,
            min: value.min,
            max: value.max
        };
    });
    
    const preset = {
        name: name,
        mappings: mappingList.length,
        date: new Date().toLocaleString(),
        data: mappingList
    };
    
    const presets = getSavedPresets();
    presets.push(preset);
    savePresets(presets);
    
    localAppServices.showNotification?.(`Saved preset "${name}" with ${mappingList.length} mappings`, 'success');
}

/**
 * Load a preset by index
 * @param {number} index - Preset index
 */
function loadPreset(index) {
    const presets = getSavedPresets();
    if (index < 0 || index >= presets.length) {
        localAppServices.showNotification?.('Preset not found', 'error');
        return;
    }
    
    const preset = presets[index];
    
    // Convert preset data back to mappings format
    const mappings = {};
    preset.data.forEach(item => {
        mappings[item.key] = {
            type: item.type,
            targetId: item.targetId,
            paramPath: item.paramPath,
            min: item.min ?? 0,
            max: item.max ?? 1
        };
        // Restore CC and channel if they exist
        if (item.cc !== undefined) mappings[item.key].cc = item.cc;
        if (item.channel !== undefined) mappings[item.key].channel = item.channel;
    });
    
    if (localAppServices.setMidiMappings) {
        localAppServices.setMidiMappings(mappings);
    }
    
    // Refresh MIDI learn indicators
    if (typeof refreshLearnableElements === 'function') {
        refreshLearnableElements();
    }
    if (typeof highlightMappedParameters === 'function') {
        highlightMappedParameters();
    }
    
    localAppServices.showNotification?.(`Loaded preset "${preset.name}" with ${preset.mappings} mappings`, 'success');
}

/**
 * Export a single preset as JSON file
 * @param {number} index - Preset index
 */
function exportSinglePreset(index) {
    const presets = getSavedPresets();
    if (index < 0 || index >= presets.length) return;
    
    const preset = presets[index];
    const json = JSON.stringify(preset, null, 2);
    
    downloadFile(`${preset.name.replace(/[^a-z0-9]/gi, '_')}_midi_preset.json`, json, 'application/json');
    localAppServices.showNotification?.(`Exported "${preset.name}"`, 'success');
}

/**
 * Export all presets as JSON file
 */
function exportAllPresets() {
    const presets = getSavedPresets();
    if (presets.length === 0) {
        localAppServices.showNotification?.('No presets to export', 'warning');
        return;
    }
    
    const json = JSON.stringify(presets, null, 2);
    downloadFile('all_midi_presets.json', json, 'application/json');
    localAppServices.showNotification?.(`Exported ${presets.length} presets`, 'success');
}

/**
 * Delete a preset by index
 * @param {number} index - Preset index
 */
function deletePreset(index) {
    const presets = getSavedPresets();
    if (index < 0 || index >= presets.length) return;
    
    const name = presets[index].name;
    presets.splice(index, 1);
    savePresets(presets);
    localAppServices.showNotification?.(`Deleted preset "${name}"`, 'info');
}

/**
 * Download a file
 */
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
}
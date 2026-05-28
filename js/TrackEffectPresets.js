// js/TrackEffectPresets.js - Save/load effect chain presets per track
// Allows saving and loading effect chain configurations for individual tracks

let localAppServices = {};
let currentTrackId = null;

/**
 * Initialize the track effect presets module
 * @param {object} services - App services
 */
export function initTrackEffectPresets(services) {
    localAppServices = services;
    console.log('[TrackEffectPresets] Initialized');
}

/**
 * Open the Effect Presets panel for a specific track
 * @param {number} trackId - Track ID
 */
export function openTrackEffectPresetsPanel(trackId) {
    currentTrackId = trackId;
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[TrackEffectPresets] Track not found:', trackId);
        return;
    }

    const windowId = `trackEffectPresets-${trackId}`;
    const existingWin = localAppServices.getOpenWindows?.()?.get(windowId);
    if (existingWin) {
        existingWin.restore();
        renderEffectPresetsContent(track);
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = `trackEffectPresetsContent-${trackId}`;
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 420,
        height: 480,
        minWidth: 350,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, `FX Presets: ${track.name || 'Track'}`, contentContainer, options);

    if (win?.element) {
        renderEffectPresetsContent(track);
    }
}

/**
 * Render the effect presets content for a track
 * @param {object} track - Track object
 */
function renderEffectPresetsContent(track) {
    const container = document.getElementById(`trackEffectPresetsContent-${track.id}`);
    if (!container) return;

    const presets = track.getAvailableEffectPresets?.() || [];

    container.innerHTML = `
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Track Effect Presets</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Save and load effect chain configurations for "${track.name || 'this track'}".
            </p>
            <div class="text-xs text-gray-400 dark:text-gray-500">
                ${track.activeEffects?.length || 0} effect(s) currently on track
            </div>
        </div>

        <!-- Current Effects -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Current Effects</h4>
            ${track.activeEffects?.length > 0 ? `
                <div class="space-y-1">
                    ${track.activeEffects.map((e, i) => `
                        <div class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                            <span class="text-gray-400">${i + 1}.</span>
                            <span class="font-medium">${e.type || 'Effect'}</span>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="text-xs text-gray-400 dark:text-gray-500 italic">No effects on track</div>
            `}
        </div>

        <!-- Save Preset -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Save New Preset</h4>
            <div class="flex gap-2">
                <input type="text" id="effectPresetNameInput" placeholder="Preset name..."
                    class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <button id="saveEffectPresetBtn" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    Save
                </button>
            </div>
        </div>

        <!-- Load Preset -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Load Preset</h4>
            <select id="effectPresetSelect" class="w-full p-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200 mb-2">
                <option value="">-- Select preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name} (${p.effectsCount} fx)</option>`).join('')}
            </select>
            ${presets.length > 0 ? `
                <div class="flex gap-2">
                    <button id="loadEffectPresetBtn" class="flex-1 px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                        Load
                    </button>
                    <button id="deleteEffectPresetBtn" class="px-3 py-2 text-xs bg-red-500 text-white rounded hover:bg-red-600">
                        Delete
                    </button>
                </div>
            ` : `
                <div class="text-xs text-gray-400 dark:text-gray-500 italic">No presets saved yet</div>
            `}
        </div>

        <!-- Preset List -->
        ${presets.length > 0 ? `
            <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Saved Presets</h4>
                <div class="space-y-1 max-h-[120px] overflow-y-auto">
                    ${presets.map(p => {
                        const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '';
                        return `
                            <div class="flex items-center justify-between text-xs p-1 hover:bg-gray-100 dark:hover:bg-slate-600 rounded">
                                <span class="text-gray-700 dark:text-gray-300">${p.name}</span>
                                <span class="text-gray-400 text-[10px]">${date}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : ''}
    `;

    // Add event listeners
    const saveBtn = document.getElementById('saveEffectPresetBtn');
    const nameInput = document.getElementById('effectPresetNameInput');
    const selectEl = document.getElementById('effectPresetSelect');
    const loadBtn = document.getElementById('loadEffectPresetBtn');
    const deleteBtn = document.getElementById('deleteEffectPresetBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const presetName = nameInput?.value?.trim();
            if (!presetName) {
                localAppServices.showNotification?.('Please enter a preset name', 1500);
                return;
            }
            if (track.activeEffects?.length === 0) {
                localAppServices.showNotification?.('No effects to save', 1500);
                return;
            }
            const result = track.saveEffectPreset(presetName);
            if (result) {
                nameInput.value = '';
                renderEffectPresetsContent(track);
            }
        });
    }

    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn?.click();
            }
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const presetName = selectEl?.value;
            if (!presetName) {
                localAppServices.showNotification?.('Please select a preset', 1500);
                return;
            }
            const success = track.loadEffectPreset(presetName);
            if (success) {
                renderEffectPresetsContent(track);
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const presetName = selectEl?.value;
            if (!presetName) {
                localAppServices.showNotification?.('Please select a preset to delete', 1500);
                return;
            }
            if (!confirm(`Delete preset "${presetName}"?`)) return;

            const presetKey = `snugos_effect_preset_${track.id}_${presetName.replace(/\s+/g, '_')}`;
            localStorage.removeItem(presetKey);
            localAppServices.showNotification?.(`Preset "${presetName}" deleted`, 1500);
            renderEffectPresetsContent(track);
        });
    }
}

// Export for manual initialization
export { openTrackEffectPresetsPanel };

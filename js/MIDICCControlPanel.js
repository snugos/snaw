/**
 * MIDI CC Learn Panel - Visual panel to assign and manage MIDI CC to virtual parameter mappings
 * 
 * Provides a dedicated window for:
 * - Viewing all MIDI CC mappings
 * - Adding new mappings via learn mode
 * - Removing mappings
 * - Visual indicators on mapped controls
 */

let midiCCPanelWindow = null;
let localAppServices = {};

// Initialize the panel module
export function initMIDICCControlPanel(appServices) {
    localAppServices = appServices || {};
    console.log('[MIDICCControlPanel] Initialized');
}

// Open the MIDI CC Control Panel
export function openMIDICCControlPanel() {
    const windowId = 'midiCCControlPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMIDICCControlPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'midiCCControlPanelContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900 overflow-y-auto';

    const options = {
        width: 550,
        height: 600,
        minWidth: 450,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, '🎛️ MIDI CC Control Panel', contentContainer, options);
    if (win?.element) {
        midiCCPanelWindow = win;
        renderMIDICCControlPanelContent();
    }

    return win;
}

// Render the panel content
function renderMIDICCControlPanelContent() {
    const container = document.getElementById('midiCCControlPanelContent');
    if (!container) return;

    const mappings = localAppServices.getMidiMappings ? localAppServices.getMidiMappings() : {};
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const learnModeActive = localAppServices.isMidiLearnActive ? localAppServices.isMidiLearnActive() : false;
    const mappedIndicatorsVisible = localAppServices.areMappedIndicatorsVisible ? localAppServices.areMappedIndicatorsVisible() : false;

    // Build mappings list
    let mappingsListHtml = '';
    const mappingKeys = Object.keys(mappings);

    if (mappingKeys.length === 0) {
        mappingsListHtml = `
            <div class="text-gray-500 text-sm text-center py-8 border border-dashed border-gray-600 rounded">
                <div class="text-4xl mb-2">🎹</div>
                <p>No MIDI CC mappings yet</p>
                <p class="text-xs mt-1">Right-click any slider/knob to assign MIDI CC</p>
            </div>
        `;
    } else {
        mappingKeys.forEach(key => {
            const mapping = mappings[key];
            const isActive = localAppServices.isMappingActive ? localAppServices.isMappingActive(key) : false;
            
            // Get target name
            let targetName = 'Master';
            let targetColor = '#888';
            if (mapping.type === 'track' && mapping.targetId) {
                const track = tracks.find(t => t.id === mapping.targetId);
                if (track) {
                    targetName = track.name;
                    targetColor = track.color || '#888';
                }
            } else if (mapping.type === 'effect' && mapping.targetId) {
                targetName = `Effect ${mapping.targetId}`;
            }

            // Get CC number and channel from key
            const ccMatch = key.match(/cc(\d+)/i);
            const channelMatch = key.match(/channel(\d+)/i);
            const ccNum = ccMatch ? ccMatch[1] : '?';
            const channel = channelMatch ? parseInt(channelMatch[1]) + 1 : 1;

            mappingsListHtml += `
                <div class="flex items-center justify-between p-3 mb-2 rounded bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors" data-mapping-key="${key}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded flex items-center justify-center ${isActive ? 'bg-green-600' : 'bg-slate-700'} text-white font-bold">
                            ${ccNum}
                        </div>
                        <div>
                            <div class="text-white text-sm font-medium">${mapping.label || targetName}</div>
                            <div class="text-gray-400 text-xs">Ch ${channel} → ${mapping.paramPath}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white test-mapping-btn" data-key="${key}" title="Test this mapping">
                            Test
                        </button>
                        <button class="px-2 py-1 text-xs rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 remove-mapping-btn" data-key="${key}" title="Remove mapping">
                            ✕
                        </button>
                    </div>
                </div>
            `;
        });
    }

    // Build instructions
    const instructionsHtml = `
        <div class="mb-3 p-3 bg-slate-800/50 rounded border border-slate-700">
            <h4 class="text-white text-sm font-medium mb-2">How to create MIDI CC mappings:</h4>
            <ol class="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Find any slider or knob (volume, pan, effect parameters)</li>
                <li>Right-click on it and select "Assign MIDI CC..."</li>
                <li>Move a knob on your MIDI controller</li>
                <li>The mapping is saved automatically</li>
            </ol>
        </div>
    `;

    // Status section
    const statusHtml = `
        <div class="mb-3 flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700">
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Learn Mode:</span>
                    <button id="toggleLearnModeBtn" class="px-3 py-1 text-xs rounded font-medium ${learnModeActive ? 'bg-red-600 text-white' : 'bg-slate-700 text-gray-300'} hover:opacity-80">
                        ${learnModeActive ? '● Active' : '○ Inactive'}
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Show Indicators:</span>
                    <button id="toggleIndicatorsBtn" class="px-3 py-1 text-xs rounded font-medium ${mappedIndicatorsVisible ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300'} hover:opacity-80">
                        ${mappedIndicatorsVisible ? '● Visible' : '○ Hidden'}
                    </button>
                </div>
            </div>
            <div class="text-xs text-gray-500">
                ${mappingKeys.length} mapping${mappingKeys.length !== 1 ? 's' : ''}
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-white font-medium text-lg">MIDI CC Mappings</h3>
            <div class="flex gap-2">
                <button id="refreshMappingsBtn" class="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white" title="Refresh">
                    ↻
                </button>
                <button id="clearAllMappingsBtn" class="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded text-white font-medium ${mappingKeys.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${mappingKeys.length === 0 ? 'disabled' : ''}>
                    Clear All
                </button>
            </div>
        </div>
        
        ${statusHtml}
        ${instructionsHtml}
        
        <div class="flex-1 overflow-y-auto">
            <div class="text-xs text-gray-500 mb-2">Active Mappings</div>
            <div id="mappingsList" class="mb-3">
                ${mappingsListHtml}
            </div>
        </div>
        
        <div class="mt-3 pt-3 border-t border-slate-700">
            <div class="flex items-center justify-between">
                <div class="text-xs text-gray-500">
                    <span class="text-green-400">●</span> Active learn mode
                </div>
                <button id="openMappingsWindowBtn" class="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white">
                    CC Grid View
                </button>
            </div>
        </div>
    `;

    // Attach event listeners
    setupMIDICCControlPanelEvents(container);
}

// Setup event handlers
function setupMIDICCControlPanelEvents(container) {
    // Toggle Learn Mode button
    const learnBtn = container.querySelector('#toggleLearnModeBtn');
    if (learnBtn) {
        learnBtn.addEventListener('click', () => {
            if (localAppServices.setMidiLearnMode) {
                const currentMode = localAppServices.isMidiLearnActive ? localAppServices.isMidiLearnActive() : false;
                localAppServices.setMidiLearnMode(!currentMode);
            }
            renderMIDICCControlPanelContent();
        });
    }

    // Toggle Indicators button
    const indicatorsBtn = container.querySelector('#toggleIndicatorsBtn');
    if (indicatorsBtn) {
        indicatorsBtn.addEventListener('click', () => {
            if (localAppServices.toggleMappedIndicators) {
                localAppServices.toggleMappedIndicators();
            }
            renderMIDICCControlPanelContent();
        });
    }

    // Refresh button
    const refreshBtn = container.querySelector('#refreshMappingsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (localAppServices.refreshLearnableElements) {
                localAppServices.refreshLearnableElements();
            }
            renderMIDICCControlPanelContent();
        });
    }

    // Clear All button
    const clearBtn = container.querySelector('#clearAllMappingsBtn');
    if (clearBtn && !clearBtn.disabled) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all MIDI CC mappings? This cannot be undone.')) {
                if (localAppServices.clearMidiMappings) {
                    localAppServices.clearMidiMappings();
                }
                renderMIDICCControlPanelContent();
            }
        });
    }

    // Open Mappings Window button
    const mappingsWindowBtn = container.querySelector('#openMappingsWindowBtn');
    if (mappingsWindowBtn) {
        mappingsWindowBtn.addEventListener('click', () => {
            if (localAppServices.openMidiMappingsPanel) {
                localAppServices.openMidiMappingsPanel();
            }
        });
    }

    // Remove mapping buttons
    container.querySelectorAll('.remove-mapping-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            if (key && localAppServices.removeMidiMapping) {
                localAppServices.removeMidiMapping(key);
                renderMIDICCControlPanelContent();
            }
        });
    });

    // Test mapping buttons
    container.querySelectorAll('.test-mapping-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            if (key && localAppServices.testMidiMapping) {
                localAppServices.testMidiMapping(key);
            }
        });
    });
}

// Update the panel (called when mappings change)
export function updateMIDICCControlPanel() {
    const container = document.getElementById('midiCCControlPanelContent');
    if (container) {
        renderMIDICCControlPanelContent();
    }
}

// Get the panel window
export function getMIDICCControlPanelWindow() {
    return midiCCPanelWindow;
}
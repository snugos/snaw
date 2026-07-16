// js/TrackContextMenu.js - Right-click context menu for track lanes
// Adds "Duplicate Track" and other track actions to the timeline

let localAppServices = {};
let contextMenuListenersInitialized = false;

/**
 * Download a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Initialize the track context menu module
 * @param {object} services - App services
 */
export function initTrackContextMenu(services) {
    localAppServices = services;
    
    if (contextMenuListenersInitialized) return;
    
    // Use delegated events on desktop to catch track lane right-clicks
    document.addEventListener('contextmenu', handleTrackContextMenu);
    
    contextMenuListenersInitialized = true;
    console.log('[TrackContextMenu] Initialized - track lane right-click menu enabled');
}

/**
 * Handle right-click context menu on track lanes
 * @param {MouseEvent} e
 */
function handleTrackContextMenu(e) {
    const trackLane = e.target.closest('.timeline-track-lane');
    
    if (!trackLane) return;
    
    const trackId = trackLane.dataset.trackId;
    if (!trackId) return;
    
    // Don't show menu if clicking on a clip (let ClipContextMenu handle that)
    if (e.target.closest('[data-clip-id]')) return;
    
    e.preventDefault();
    showTrackContextMenu(e.clientX, e.clientY, parseInt(trackId));
}

/**
 * Show context menu for a track
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @param {number} trackId - Track ID
 */
function showTrackContextMenu(x, y, trackId) {
    // Remove any existing context menu
    closeTrackContextMenu();
    
    // Get track info
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    const trackName = track.name || 'Unnamed Track';
    const trackType = track.type || 'Unknown';
    const isFrozen = track.frozen && track.frozenAudioBlob;
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'track-context-menu';
    menu.className = 'fixed bg-gray-900 border border-gray-600 rounded shadow-lg z-[10000] py-1 min-w-[200px]';
    menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 300)}px`;
    
    let freezeMenuItems = '';
    if (isFrozen) {
        freezeMenuItems = `
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="exportFrozen" data-track-id="${trackId}">
                <span class="w-4">📤</span>
                <span>Export Frozen Audio</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="unfreeze" data-track-id="${trackId}">
                <span class="w-4">🔥</span>
                <span>Unfreeze Track</span>
            </button>
        `;
    } else {
        freezeMenuItems = `
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="freeze" data-track-id="${trackId}">
                <span class="w-4">❄️</span>
                <span>Freeze Track</span>
            </button>
        `;
    }
    
    menu.innerHTML = `
        <div class="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
            ${escapeHtml(trackName)} <span class="text-gray-500">(${trackType})</span>
        </div>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="duplicate" data-track-id="${trackId}">
            <span class="w-4">📋</span>
            <span>Duplicate Track</span>
            <span class="ml-auto text-xs text-gray-500">Ctrl+D</span>
        </button>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="duplicateOffset" data-track-id="${trackId}">
            <span class="w-4">📅</span>
            <span>Duplicate with Offset</span>
            <span class="ml-auto text-xs text-gray-500">Ctrl+Shift+D</span>
        </button>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="rename" data-track-id="${trackId}">
            <span class="w-4">✏️</span>
            <span>Rename Track</span>
        </button>
        <div class="border-t border-gray-700 mt-1 pt-1">
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="color" data-track-id="${trackId}">
                <span class="w-4">🎨</span>
                <span>Change Color</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="toggleVisibility" data-track-id="${trackId}">
                <span class="w-4">${track.isVisible === false ? '◉' : '◌'}</span>
                <span>${track.isVisible === false ? 'Show Track' : 'Hide Track'}</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="snapResolution" data-track-id="${trackId}">
                <span class="w-4">⌗</span>
                <span>Snap Resolution</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="height" data-track-id="${trackId}">
                <span class="w-4">📏</span>
                <span>Adjust Height</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="channelStripPresets" data-track-id="${trackId}">
                <span class="w-4">💾</span>
                <span>Channel Strip Presets</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="effectPresets" data-track-id="${trackId}">
                <span class="w-4">🎛️</span>
                <span>Effect Presets</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="velocityCurve" data-track-id="${trackId}">
                <span class="w-4">📊</span>
                <span>Velocity Response</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="humanizeVelocityMenu" data-track-id="${trackId}">
                <span class="w-4">🎲</span>
                <span>Humanize Velocity</span>
                <span class="ml-auto text-xs text-gray-500">▸</span>
            </button>
            <div id="humanizeVelocitySubmenu-${trackId}" class="hidden bg-gray-800 rounded mt-1 mb-1">
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="humanizeVelocity" data-amount="0.05" data-track-id="${trackId}">Subtle (±5%)</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="humanizeVelocity" data-amount="0.15" data-track-id="${trackId}">Medium (±15%)</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="humanizeVelocity" data-amount="0.30" data-track-id="${trackId}">Heavy (±30%)</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="humanizeVelocity" data-amount="0.50" data-track-id="${trackId}">Wild (±50%)</button>
            </div>
            ${trackType !== 'Audio' ? `
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="trillNotesMenu" data-track-id="${trackId}">
                <span class="w-4">🎵</span>
                <span>Trill Notes</span>
                <span class="ml-auto text-xs text-gray-500">▸</span>
            </button>
            <div id="trillNotesSubmenu-${trackId}" class="hidden bg-gray-800 rounded mt-1 mb-1">
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="trillNotes" data-direction="up" data-taps="6" data-interval="2" data-track-id="${trackId}">Trill Up (±2 st, 6 taps)</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="trillNotes" data-direction="down" data-taps="6" data-interval="2" data-track-id="${trackId}">Trill Down (±2 st, 6 taps)</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="trillNotes" data-direction="both" data-taps="8" data-interval="2" data-track-id="${trackId}">Trill Both (±2 st, 8 taps)</button>
            </div>
            ` : ''}
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="toggleEffectsBypass" data-track-id="${trackId}">
                <span class="w-4">⏸</span>
                <span>${(() => { try { return track.getEffectsBypassed && track.getEffectsBypassed() ? 'Re-enable Effects' : 'Bypass All Effects'; } catch(e) { return 'Bypass All Effects'; } })()}</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="markRoleMenu" data-track-id="${trackId}">
                <span class="w-4">🏷️</span>
                <span>Mark as Role...</span>
                <span class="ml-auto text-xs text-gray-500">▶</span>
            </button>
            <div id="markRoleSubmenu-${trackId}" class="hidden pl-6 bg-gray-800">
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="none" data-track-id="${trackId}">
                    <span class="w-4">⚪</span>
                    <span>Unclassified</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="bass" data-track-id="${trackId}">
                    <span class="w-4">🔊</span>
                    <span>Bass</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="drums" data-track-id="${trackId}">
                    <span class="w-4">🥁</span>
                    <span>Drums</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="vocal" data-track-id="${trackId}">
                    <span class="w-4">🎤</span>
                    <span>Vocal</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="guitar" data-track-id="${trackId}">
                    <span class="w-4">🎸</span>
                    <span>Guitar</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="keys" data-track-id="${trackId}">
                    <span class="w-4">🎹</span>
                    <span>Keys</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="synth" data-track-id="${trackId}">
                    <span class="w-4">🎛️</span>
                    <span>Synth</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="fx" data-track-id="${trackId}">
                    <span class="w-4">✨</span>
                    <span>FX</span>
                </button>
                <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="setRole" data-role="other" data-track-id="${trackId}">
                    <span class="w-4">🎵</span>
                    <span>Other</span>
                </button>
                <div class="border-t border-gray-700 mt-1 pt-1">
                    <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="openRolePanel" data-track-id="${trackId}">
                        <span class="w-4">📋</span>
                        <span>Open Role Panel...</span>
                    </button>
                </div>
            </div>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="trackNote" data-track-id="${trackId}">
                <span class="w-4">📝</span>
                <span>Add/Edit Track Note</span>
            </button>
        </div>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="insertSilenceMenu" data-track-id="${trackId}">
                <span class="w-4">⏳</span>
                <span>Insert Silence Here...</span>
                <span class="ml-auto text-xs text-gray-500">▸</span>
            </button>
            <div id="insertSilenceSubmenu-${trackId}" class="hidden bg-gray-800 rounded mt-1 mb-1">
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="insertSilence" data-bars="1" data-track-id="${trackId}">1 Bar</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="insertSilence" data-bars="2" data-track-id="${trackId}">2 Bars</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="insertSilence" data-bars="4" data-track-id="${trackId}">4 Bars</button>
                <button class="w-full text-left px-6 py-1.5 text-sm text-white hover:bg-gray-700" data-action="insertSilence" data-bars="8" data-track-id="${trackId}">8 Bars</button>
            </div>
        <div class="border-t border-gray-700 mt-1 pt-1">
            ${freezeMenuItems}
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="bounce" data-track-id="${trackId}">
                <span class="w-4">🎛️</span>
                <span>Bounce Track to WAV</span>
            </button>
            ${trackType !== 'Audio' ? `
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="exportMidi" data-track-id="${trackId}">
                <span class="w-4">🎹</span>
                <span>Export to MIDI</span>
            </button>
            ` : ''}
        </div>
        <div class="border-t border-gray-700 mt-1 pt-1">
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="importTrack" data-track-id="${trackId}">
                <span class="w-4">📥</span>
                <span>Import Track</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="exportTrack" data-track-id="${trackId}">
                <span class="w-4">📤</span>
                <span>Export Track</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="delete" data-track-id="${trackId}">
                <span class="w-4">🗑️</span>
                <span>Delete Track</span>
                <span class="ml-auto text-xs text-gray-500">Del</span>
            </button>
        </div>
    `;
    
    // Add event listeners
    menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            const tId = parseInt(e.currentTarget.dataset.trackId);

            // Submenu parent toggles its submenu and does NOT close the menu
            if (action === 'humanizeVelocityMenu') {
                e.stopPropagation();
                const sub = menu.querySelector(`#humanizeVelocitySubmenu-${tId}`);
                if (sub) sub.classList.toggle('hidden');
                return;
            }
            if (action === 'trillNotesMenu') {
                e.stopPropagation();
                const sub = menu.querySelector(`#trillNotesSubmenu-${tId}`);
                if (sub) sub.classList.toggle('hidden');
                return;
            }
            if (action === 'markRoleMenu') {
                e.stopPropagation();
                const sub = menu.querySelector(`#markRoleSubmenu-${tId}`);
                if (sub) sub.classList.toggle('hidden');
                return;
            }
            if (action === 'insertSilenceMenu') {
                e.stopPropagation();
                const sub = menu.querySelector(`#insertSilenceSubmenu-${tId}`);
                if (sub) sub.classList.toggle('hidden');
                return;
            }

            handleTrackAction(action, tId, e.currentTarget);
            closeTrackContextMenu();
        });
    });
    
    document.body.appendChild(menu);
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', closeTrackContextMenu, { once: true });
    }, 10);
}

/**
 * Close the track context menu
 */
function closeTrackContextMenu() {
    const menu = document.getElementById('track-context-menu');
    if (menu) menu.remove();
}

/**
 * Handle track action from context menu
 * @param {string} action - Action to perform
 * @param {number} trackId - Track ID
 * @param {HTMLElement} btn - Button element
 */
function handleTrackAction(action, trackId, btn) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    switch (action) {
        case 'duplicate':
            if (localAppServices.duplicateTrack) {
                localAppServices.duplicateTrack(trackId);
                localAppServices.showNotification?.('Track duplicated', 1500);
            } else if (localAppServices.createTrack) {
                // Fallback: create a new track with same settings
                const newTrack = localAppServices.createTrack(track.type, {
                    name: `${track.name || 'Track'} (Copy)`,
                    volume: track.volume,
                    pan: track.pan,
                    muted: track.muted,
                    soloed: false,
                    armed: false
                });
                if (newTrack) {
                    localAppServices.showNotification?.('Track duplicated', 1500);
                    if (localAppServices.renderTracks) localAppServices.renderTracks();
                }
            }
            break;
            
        case 'duplicateOffset':
            if (localAppServices.openDuplicateOffsetDialog) {
                localAppServices.openDuplicateOffsetDialog(trackId);
            } else {
                // Fallback to default offset
                if (localAppServices.duplicateTrackWithOffset) {
                    localAppServices.duplicateTrackWithOffset(trackId, 4);
                    localAppServices.showNotification?.('Track duplicated (+4s offset)', 1500);
                } else {
                    localAppServices.showNotification?.('Offset duplicate not available', 2000);
                }
            }
            break;
            
        case 'rename':
            const newName = prompt('Enter new track name:', track.name || '');
            if (newName !== null && newName.trim()) {
                if (localAppServices.updateTrackUI) {
                    localAppServices.updateTrackUI(trackId, 'name', newName.trim());
                }
                track.name = newName.trim();
                localAppServices.showNotification?.('Track renamed', 1500);
                if (localAppServices.renderTracks) localAppServices.renderTracks();
            }
            break;
            
        case 'color':
            if (localAppServices.openTrackColorPanel) {
                localAppServices.openTrackColorPanel(trackId);
            } else {
                // Built-in color picker
                const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
                const colorName = prompt(`Choose color for "${track.name}":\n\n${colors.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nEnter number (1-8):`, '');
                const colorIndex = parseInt(colorName) - 1;
                if (colorIndex >= 0 && colorIndex < colors.length) {
                    track.color = colors[colorIndex];
                    if (localAppServices.renderTracks) localAppServices.renderTracks();
                    localAppServices.showNotification?.('Track color changed', 1500);
                }
            }
            break;

        case 'toggleVisibility':
            if (localAppServices.toggleTrackVisibility) {
                localAppServices.toggleTrackVisibility(trackId);
            } else {
                track.isVisible = track.isVisible === false;
                localAppServices.renderTimeline?.();
                localAppServices.updateMixerChannelStripPanel?.();
            }
            break;

        case 'snapResolution':
            if (localAppServices.openTrackSnapResolutionPanel) {
                localAppServices.openTrackSnapResolutionPanel(trackId);
            } else {
                localAppServices.showNotification?.('Snap resolution panel not available', 2000);
            }
            break;
            
        case 'height':
            const heights = { Small: 60, Medium: 100, Large: 150, XL: 200 };
            const heightName = prompt(`Choose height for "${track.name}":\n\n${Object.keys(heights).map((k, i) => `${i + 1}. ${k}`).join('\n')}\n\nEnter number (1-4):`, '');
            const heightIndex = parseInt(heightName) - 1;
            const heightKeys = Object.keys(heights);
            if (heightIndex >= 0 && heightIndex < heightKeys.length) {
                const newHeight = heights[heightKeys[heightIndex]];
                if (localAppServices.setTrackHeight) {
                    localAppServices.setTrackHeight(trackId, newHeight);
                }
                localAppServices.showNotification?.(`Track height set to ${heightKeys[heightIndex]}`, 1500);
                if (localAppServices.renderTracks) localAppServices.renderTracks();
            }
            break;
            
        case 'channelStripPresets':
            if (localAppServices.openMixerChannelStripPresetsPanel) {
                localAppServices.openMixerChannelStripPresetsPanel();
            } else {
                localAppServices.showNotification?.('Channel Strip Presets not available', 2000);
            }
            break;

        case 'effectPresets':
            if (localAppServices.openTrackEffectPresetsPanel) {
                localAppServices.openTrackEffectPresetsPanel(trackId);
            } else {
                localAppServices.showNotification?.('Effect Presets not available', 2000);
            }
            break;

        case 'toggleEffectsBypass':
            // Plugin Bypass Per-Track (v0.3.73) - toggle the entire effect chain on/off
            if (track.toggleEffectsBypassed) {
                track.toggleEffectsBypassed(true);
                const bypassed = track.getEffectsBypassed && track.getEffectsBypassed();
                localAppServices.showNotification?.(
                    bypassed ? `Bypassed all effects on ${track.name} (dry signal)` : `Re-enabled effects on ${track.name}`,
                    2000
                );
                // Refresh UI elements that show the bypass state
                if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'effectsBypassChanged');
                if (localAppServices.renderMixerChannelStripContent) localAppServices.renderMixerChannelStripContent();
            } else {
                localAppServices.showNotification?.('Bypass not available on this track', 2000);
            }
            break;

        case 'velocityCurve':
            if (localAppServices.openTrackVelocityCurvePanel) {
                localAppServices.openTrackVelocityCurvePanel(trackId);
            } else {
                localAppServices.showNotification?.('Velocity Response not available', 2000);
            }
            break;

        case 'humanizeVelocity': {
            if (track.type === 'Audio') {
                localAppServices.showNotification?.('Humanize is only available for sequencer tracks', 2000);
                break;
            }
            const rawAmount = parseFloat(btn?.dataset?.amount);
            const HUMANIZE_VELOCITY_MIN_AMOUNT = 0.01;
            const HUMANIZE_VELOCITY_MAX_AMOUNT = 0.5;
            const HUMANIZE_VELOCITY_DEFAULT_AMOUNT = 0.15;
            const allowedAmounts = [0.05, 0.15, 0.3, 0.5];
            let amount = Number.isFinite(rawAmount) ? rawAmount : HUMANIZE_VELOCITY_DEFAULT_AMOUNT;
            if (!allowedAmounts.includes(amount)) {
                // Snap unknown amount to the closest preset
                allowedAmounts.sort((a, b) => Math.abs(a - amount) - Math.abs(b - amount));
                amount = allowedAmounts[0];
            }
            amount = Math.min(HUMANIZE_VELOCITY_MAX_AMOUNT, Math.max(HUMANIZE_VELOCITY_MIN_AMOUNT, amount));
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Humanize Velocity (±${Math.round(amount * 100)}%) on ${track.name || 'Track'}`);
            }
            const affected = track.humanizeVelocity ? track.humanizeVelocity(amount) : 0;
            if (affected > 0) {
                if (typeof track.recreateToneSequence === 'function') {
                    try { track.recreateToneSequence(true); } catch (e) { /* noop */ }
                }
                if (localAppServices.updateTrackUI) {
                    localAppServices.updateTrackUI(trackId, 'sequencerContentChanged');
                }
                localAppServices.showNotification?.(`Humanized ${affected} note(s) (±${Math.round(amount * 100)}%)`, 2000);
            } else {
                localAppServices.showNotification?.('No notes to humanize', 1500);
            }
            break;
        }

        case 'trillNotes': {
            if (track.type === 'Audio') {
                localAppServices.showNotification?.('Trill is only available for sequencer tracks', 2000);
                break;
            }
            const tapsRaw = parseFloat(btn?.dataset?.taps);
            const intervalRaw = parseFloat(btn?.dataset?.interval);
            const direction = btn?.dataset?.direction || 'up';
            const taps = Number.isFinite(tapsRaw) ? tapsRaw : 6;
            const interval = Number.isFinite(intervalRaw) ? intervalRaw : 2;
            const velocityFactor = 0.95;
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Trill Notes (${direction}, ${taps} taps, ±${interval} st) on ${track.name || 'Track'}`);
            }
            const affected = track.trillNotes ? track.trillNotes(taps, interval, velocityFactor, direction, true) : 0;
            if (affected > 0) {
                if (typeof track.recreateToneSequence === 'function') {
                    try { track.recreateToneSequence(true); } catch (e) { /* noop */ }
                }
                if (localAppServices.updateTrackUI) {
                    localAppServices.updateTrackUI(trackId, 'sequencerContentChanged');
                }
                localAppServices.showNotification?.(`Trilled ${affected} note(s) (${direction})`, 2000);
            } else {
                localAppServices.showNotification?.('No notes to trill', 1500);
            }
            break;
        }

        case 'trackNote':
            if (localAppServices.openNoteForTrack) {
                localAppServices.openNoteForTrack(trackId);
            } else if (window.openNoteForTrack) {
                window.openNoteForTrack(trackId);
            } else if (localAppServices.openNoteForCurrentTrack) {
                localAppServices.openNoteForCurrentTrack();
            } else {
                localAppServices.showNotification?.('Track Notes not available', 2000);
            }
            break;

        case 'insertSilence': {
            // Insert N bars of silence at the current playhead on this track.
            // Shifts every clip whose startTime >= playheadTime by +silenceSeconds,
            // creating an empty gap at the playhead position.
            const barsRaw = parseFloat(btn?.dataset?.bars);
            const bars = Number.isFinite(barsRaw) && barsRaw > 0 ? barsRaw : 1;
            const bpm = (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.bpm && typeof Tone.Transport.bpm.value === 'number' && Tone.Transport.bpm.value > 0)
                ? Tone.Transport.bpm.value
                : 120;
            const secondsPerBeat = 60 / bpm;
            const secondsPerBar = secondsPerBeat * 4; // 4/4 assumed
            const silenceSeconds = bars * secondsPerBar;
            const playheadSeconds = (typeof Tone !== 'undefined' && Tone.Transport && typeof Tone.Transport.seconds === 'number')
                ? Tone.Transport.seconds
                : 0;

            if (!Array.isArray(track.timelineClips)) {
                localAppServices.showNotification?.('No clips on this track', 1500);
                break;
            }

            // Peek at how many clips would shift before mutating anything. If none would shift,
            // bail early without capturing undo (matches humanizeVelocity / trillNotes: capture
            // happens only when the action will actually mutate state).
            const candidateClipCount = track.timelineClips.reduce((n, clip) =>
                (clip && typeof clip.startTime === 'number' && clip.startTime >= playheadSeconds - 1e-6) ? n + 1 : n, 0);

            if (candidateClipCount === 0) {
                localAppServices.showNotification?.(`No clips to shift (nothing starts after the playhead)`, 2000);
                break;
            }

            // Capture undo state BEFORE mutating clip.startTime so undo restores the pre-shift
            // positions. Matches the pattern used by humanizeVelocity / trillNotes in this same
            // file (capture first, mutate second). Without this reorder, undoing an Insert Silence
            // action silently no-ops because the captured state == live state.
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Insert ${bars} bar(s) of silence on ${track.name || 'Track'}`);
            }

            const shiftedClips = [];
            for (const clip of track.timelineClips) {
                if (clip && typeof clip.startTime === 'number' && clip.startTime >= playheadSeconds - 1e-6) {
                    clip.startTime = clip.startTime + silenceSeconds;
                    shiftedClips.push(clip.name || clip.id || 'clip');
                }
            }

            // Keep timelineClips sorted by startTime so downstream rendering is consistent.
            if (typeof track.timelineClips.sort === 'function') {
                track.timelineClips.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
            }

            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            localAppServices.showNotification?.(`Inserted ${bars} bar(s) of silence — shifted ${shiftedClips.length} clip(s)`, 2500);
            break;
        }
            
        case 'freeze':
            if (track.freeze) {
                localAppServices.showNotification?.('Freezing track...', 1500);
                track.freeze().then(() => {
                    localAppServices.showNotification?.('Track frozen successfully', 2000);
                    if (localAppServices.renderTracks) localAppServices.renderTracks();
                }).catch(err => {
                    console.error('[TrackContextMenu] Freeze error:', err);
                    localAppServices.showNotification?.('Freeze failed: ' + err.message, 3000);
                });
            } else {
                localAppServices.showNotification?.('Freeze not available for this track type', 2000);
            }
            break;
            
        case 'unfreeze':
            if (track.unfreeze) {
                localAppServices.showNotification?.('Unfreezing track...', 1500);
                track.unfreeze().then(() => {
                    localAppServices.showNotification?.('Track unfrozen successfully', 2000);
                    if (localAppServices.renderTracks) localAppServices.renderTracks();
                }).catch(err => {
                    console.error('[TrackContextMenu] Unfreeze error:', err);
                    localAppServices.showNotification?.('Unfreeze failed: ' + err.message, 3000);
                });
            } else {
                localAppServices.showNotification?.('Unfreeze not available', 2000);
            }
            break;
            
        case 'exportFrozen':
            if (track.frozenAudioBlob) {
                const filename = `${track.name || 'Track-' + trackId}_frozen.wav`;
                downloadBlob(track.frozenAudioBlob, filename);
                localAppServices.showNotification?.('Frozen audio exported', 2000);
            } else {
                localAppServices.showNotification?.('No frozen audio to export', 2000);
            }
            break;
            
        case 'bounce':
            if (localAppServices.bounceTrackToAudio) {
                localAppServices.showNotification?.('Bouncing track to WAV...', 1500);
                const result = await localAppServices.bounceTrackToAudio(trackId, {
                    download: true,
                    createNewTrack: false,
                    returnBlob: false
                });
                if (result && result.success) {
                    localAppServices.showNotification?.('Track bounced to WAV', 2000);
                } else {
                    localAppServices.showNotification?.('Bounce failed', 2000);
                }
            } else {
                localAppServices.showNotification?.('Bounce not available for this track type', 2000);
            }
            break;
            
        case 'exportMidi':
            if (localAppServices.exportTrackToMIDI) {
                localAppServices.exportTrackToMIDI(trackId);
            } else {
                localAppServices.showNotification?.('MIDI export not available', 2000);
            }
            break;
            
        case 'importTrack':
            triggerTrackImport();
            break;
            
        case 'exportTrack':
            exportTrackToFile(trackId);
            break;

        case 'setRole':
            if (typeof btn?.dataset?.role === 'string' && track) {
                const newRole = btn.dataset.role;
                if (typeof track.setRole === 'function') {
                    track.setRole(newRole, true);
                } else {
                    track.role = newRole;
                    if (localAppServices.captureStateForUndo) {
                        localAppServices.captureStateForUndo(`Set role on ${track.name}`);
                    }
                }
                const label = (window.TRACK_ROLE_LABELS && window.TRACK_ROLE_LABELS[newRole]) || newRole;
                localAppServices.showNotification?.(`Role set to ${label}`, 1500);
                if (localAppServices.renderTracks) localAppServices.renderTracks();
            }
            break;

        case 'openRolePanel':
            if (localAppServices.openTrackRolePanel) {
                localAppServices.openTrackRolePanel(trackId);
            } else {
                localAppServices.showNotification?.('Track Role Panel not available', 2000);
            }
            break;

        case 'delete':
            if (confirm(`Delete track "${track.name || 'Unnamed Track'}"?`)) {
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo('Delete track');
                }
                if (localAppServices.removeTrack) {
                    localAppServices.removeTrack(trackId);
                    localAppServices.showNotification?.('Track deleted', 1500);
                }
            }
            break;
    }
}


/**
 * Export a track to a JSON file for sharing
 * @param {number} trackId - Track ID to export
 */
function exportTrackToFile(trackId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
        console.warn('[TrackContextMenu] Track not found for export');
        return false;
    }
    
    const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        track: {
            name: track.name,
            type: track.type,
            color: track.color,
            volume: track.volume,
            pan: track.pan,
            mute: track.isMuted,
            solo: track.isSoloed,
            synthParams: track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : null,
            samplerSettings: track.samplerAudioData ? JSON.parse(JSON.stringify(track.samplerAudioData)) : null,
            instrumentSamplerSettings: track.instrumentSamplerSettings ? JSON.parse(JSON.stringify(track.instrumentSamplerSettings)) : null,
            drumSamplerPads: track.drumSamplerPads ? JSON.parse(JSON.stringify(track.drumSamplerPads)) : null,
            effects: track.activeEffects ? track.activeEffects.map(e => ({
                type: e.type,
                params: e.params ? JSON.parse(JSON.stringify(e.params)) : {}
            })) : [],
            steps: track.steps ? JSON.parse(JSON.stringify(track.steps)) : null,
            sendLevels: track.sendLevels ? JSON.parse(JSON.stringify(track.sendLevels)) : {},
            lyrics: track.lyrics ? JSON.parse(JSON.stringify(track.lyrics)) : []
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = `${track.name.replace(/[^a-z0-9]/gi, '_')}_track.json`;
    downloadBlob(blob, filename);
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Exported track "${track.name}"`, 2000);
    }
    
    return true;
}

/**
 * Import a track from a JSON file
 * @param {File} file - The JSON file to import
 */
function importTrackFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.track) {
                throw new Error('Invalid track file format');
            }
            
            const trackData = data.track;
            
            if (localAppServices.createTrack) {
                const newTrack = localAppServices.createTrack(trackData.type || 'Synth', {
                    name: trackData.name || 'Imported Track',
                    color: trackData.color,
                    volume: trackData.volume,
                    pan: trackData.pan,
                    muted: trackData.mute,
                    synthParams: trackData.synthParams,
                    samplerAudioData: trackData.samplerSettings,
                    instrumentSamplerSettings: trackData.instrumentSamplerSettings,
                    drumSamplerPads: trackData.drumSamplerPads,
                    activeEffects: trackData.effects,
                    steps: trackData.steps,
                    sendLevels: trackData.sendLevels,
                    lyrics: trackData.lyrics
                });
                
                if (newTrack) {
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification(`Imported track "${trackData.name}"`, 2000);
                    }
                    if (localAppServices.renderTracks) {
                        localAppServices.renderTracks();
                    }
                }
            }
        } catch (err) {
            console.error('[TrackContextMenu] Failed to import track:', err);
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Failed to import track: ' + err.message, 3000);
            }
        }
    };
    reader.readAsText(file);
}

function createImportInput() {
    if (document.getElementById('trackImportInput')) return;
    const input = document.createElement('input');
    input.id = 'trackImportInput';
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importTrackFromFile(file);
            e.target.value = '';
        }
    });
    document.body.appendChild(input);
}

function triggerTrackImport() {
    createImportInput();
    const input = document.getElementById('trackImportInput');
    if (input) input.click();
}

/**
 * Escape HTML for safe display
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Export for manual initialization
export { showTrackContextMenu, closeTrackContextMenu };
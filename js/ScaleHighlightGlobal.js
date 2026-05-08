/**
 * js/ScaleHighlightGlobal.js - Global Scale Highlight Mode
 * 
 * Extends scale highlighting beyond piano roll to show scale notes
 * across all MIDI tracks and views, with a floating info panel.
 */

import { getScalePresets, getScalePresetById, getCurrentScaleSettings, setScale, setRootNote, setScaleHighlightEnabled, isNoteInScale, getNoteScaleClass } from './ScaleHighlightMode.js';

let localAppServices = {};
let globalPanel = null;
let isPanelVisible = false;

// Current global state
let globalEnabled = false;

/**
 * Initialize the Global Scale Highlight module
 * @param {Object} services - App services from main.js
 */
export function initScaleHighlightGlobal(services) {
    localAppServices = services || {};
    console.log('[ScaleHighlightGlobal] Initialized');
}

/**
 * Check if global scale highlighting is enabled
 * @returns {boolean}
 */
export function isGlobalScaleHighlightEnabled() {
    return globalEnabled;
}

/**
 * Toggle global scale highlighting on/off
 */
export function toggleGlobalScaleHighlight() {
    globalEnabled = !globalEnabled;
    setScaleHighlightEnabled(globalEnabled);
    
    if (globalEnabled) {
        showGlobalPanel();
        applyGlobalHighlights();
    } else {
        hideGlobalPanel();
        clearGlobalHighlights();
    }
    
    localAppServices.showNotification?.(
        globalEnabled ? 'Scale Highlight Global: ON' : 'Scale Highlight Global: OFF',
        1500
    );
    
    return globalEnabled;
}

/**
 * Set the scale for global highlighting
 * @param {string} scaleId - Scale preset ID
 */
export function setGlobalScale(scaleId) {
    setScale(scaleId);
    if (globalEnabled) {
        applyGlobalHighlights();
        updatePanelDisplay();
    }
}

/**
 * Set the root note for global highlighting
 * @param {number} rootNote - Root note (0-11 for C through B)
 */
export function setGlobalRootNote(rootNote) {
    setRootNote(rootNote);
    if (globalEnabled) {
        applyGlobalHighlights();
        updatePanelDisplay();
    }
}

/**
 * Show the global scale highlight panel
 */
export function showGlobalPanel() {
    if (globalPanel) {
        globalPanel.style.display = 'block';
        isPanelVisible = true;
        return;
    }
    
    globalPanel = document.createElement('div');
    globalPanel.id = 'scaleHighlightGlobalPanel';
    globalPanel.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        width: 220px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid #6366f1;
        border-radius: 10px;
        padding: 14px;
        z-index: 9990;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #e0e0e0;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
    `;
    
    updatePanelContent();
    document.body.appendChild(globalPanel);
    isPanelVisible = true;
}

/**
 * Hide the global scale highlight panel
 */
export function hideGlobalPanel() {
    if (globalPanel) {
        globalPanel.style.display = 'none';
        isPanelVisible = false;
    }
}

/**
 * Update the panel display
 */
function updatePanelDisplay() {
    if (globalPanel) {
        updatePanelContent();
    }
}

/**
 * Update the panel content HTML
 */
function updatePanelContent() {
    if (!globalPanel) return;
    
    const settings = getCurrentScaleSettings();
    const presets = getScalePresets();
    const currentPreset = presets[settings.scale] || presets.major;
    
    // Build root note options
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let rootNoteOptions = noteNames.map((name, idx) => 
        `<option value="${idx}" ${idx === settings.rootNote ? 'selected' : ''}>${name}</option>`
    ).join('');
    
    // Build scale options
    let scaleOptions = Object.entries(presets).map(([id, scale]) => 
        `<option value="${id}" ${id === settings.scale ? 'selected' : ''}>${scale.name}</option>`
    ).join('');
    
    // Render scale notes as colored blocks
    let scaleNotesHtml = noteNames.map((name, idx) => {
        const inScale = currentPreset.intervals.includes(idx);
        const isRoot = idx === settings.rootNote;
        
        let bgClass = 'bg-gray-700';
        if (inScale) {
            bgClass = isRoot ? 'bg-purple-600' : 'bg-indigo-600';
        }
        
        return `<div class="w-5 h-5 ${bgClass} rounded text-center text-[8px] font-bold text-white" title="${name}${inScale ? ' (in scale)' : ''}">${name}</div>`;
    }).join('');
    
    globalPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #444; padding-bottom: 10px;">
            <span style="font-weight: 600; color: #a5b4fc; font-size: 13px;">🎹 Scale Highlight Global</span>
            <button id="scaleGlobalCloseBtn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px; line-height: 1; padding: 0;">&times;</button>
        </div>
        
        <div style="margin-bottom: 12px;">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="scaleGlobalEnabled" ${globalEnabled ? 'checked' : ''} 
                       class="w-4 h-4 rounded accent-indigo-500">
                <span style="font-weight: 500; color: #e0e0e0;">Enable Scale Highlight</span>
            </label>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; color: #888; font-size: 10px; margin-bottom: 4px;">Root Note</label>
            <select id="scaleGlobalRoot" class="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                ${rootNoteOptions}
            </select>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; color: #888; font-size: 10px; margin-bottom: 4px;">Scale Type</label>
            <select id="scaleGlobalType" class="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                ${scaleOptions}
            </select>
        </div>
        
        <div style="margin-bottom: 10px;">
            <div style="color: #888; font-size: 10px; margin-bottom: 4px;">Scale Notes (C = root)</div>
            <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                ${scaleNotesHtml}
            </div>
        </div>
        
        <div style="padding: 8px; background: #222; border-radius: 6px; margin-bottom: 10px;">
            <div style="color: #aaa; font-size: 11px; text-align: center;">
                ${currentPreset.name}
            </div>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="scaleGlobalToggleBtn" 
                    class="flex-1 py-2 px-3 text-sm font-medium rounded ${globalEnabled ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white">
                ${globalEnabled ? 'Disable' : 'Enable'}
            </button>
            <button id="scaleGlobalHelpBtn" 
                    class="py-2 px-3 text-sm bg-gray-700 hover:bg-gray-600 rounded text-white"
                    title="Scale highlight shows which notes are in the selected scale across all piano keys">
                ?
            </button>
        </div>
    `;
    
    // Attach event listeners
    globalPanel.querySelector('#scaleGlobalCloseBtn').addEventListener('click', () => {
        hideGlobalPanel();
    });
    
    globalPanel.querySelector('#scaleGlobalEnabled').addEventListener('change', (e) => {
        globalEnabled = e.target.checked;
        setScaleHighlightEnabled(globalEnabled);
        if (globalEnabled) {
            applyGlobalHighlights();
        } else {
            clearGlobalHighlights();
        }
        updatePanelContent();
    });
    
    globalPanel.querySelector('#scaleGlobalRoot').addEventListener('change', (e) => {
        setGlobalRootNote(parseInt(e.target.value, 10));
    });
    
    globalPanel.querySelector('#scaleGlobalType').addEventListener('change', (e) => {
        setGlobalScale(e.target.value);
    });
    
    globalPanel.querySelector('#scaleGlobalToggleBtn').addEventListener('click', () => {
        toggleGlobalScaleHighlight();
    });
    
    globalPanel.querySelector('#scaleGlobalHelpBtn').addEventListener('click', () => {
        localAppServices.showNotification?.(
            'Scale Highlight Global: Shows which notes match the selected scale. Notes in scale are highlighted purple/blue, notes outside are orange.',
            4000
        );
    });
}

/**
 * Apply global scale highlights to all piano key elements in the UI
 */
function applyGlobalHighlights() {
    if (!globalEnabled) return;
    
    const settings = getCurrentScaleSettings();
    if (!settings.enabled) return;
    
    // Find and highlight all piano key elements
    document.querySelectorAll('.piano-key, [data-pitch], [data-display-pitch], .key-element').forEach(el => {
        // Try to get MIDI note from element
        const pitch = parseInt(el.dataset.pitch || el.dataset.displayPitch || el.dataset.note);
        if (!isNaN(pitch)) {
            const scaleClass = getNoteScaleClass(pitch, 0.8);
            
            // Apply scale-based background color
            if (scaleClass.bgClass.includes('purple')) {
                el.style.backgroundColor = 'rgba(147, 51, 234, 0.8)';
            } else if (scaleClass.bgClass.includes('blue')) {
                el.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
            } else if (scaleClass.bgClass.includes('cyan')) {
                el.style.backgroundColor = 'rgba(6, 182, 212, 0.8)';
            } else if (scaleClass.bgClass.includes('orange')) {
                el.style.backgroundColor = 'rgba(234, 88, 12, 0.8)';
                el.style.borderLeft = '2px solid #ef4444';
            }
            
            el.dataset.scaleHighlighted = 'true';
        }
    });
    
    // Trigger updates in Piano Roll Editor if open
    if (localAppServices.updatePianoRollEditor) {
        localAppServices.updatePianoRollEditor();
    }
    
    console.log('[ScaleHighlightGlobal] Applied global scale highlights');
}

/**
 * Clear all global scale highlights
 */
function clearGlobalHighlights() {
    // Remove all scale highlight styling
    document.querySelectorAll('[data-scale-highlighted="true"]').forEach(el => {
        el.style.backgroundColor = '';
        el.style.borderLeft = '';
        el.dataset.scaleHighlighted = 'false';
    });
    
    // Trigger updates in Piano Roll Editor if open
    if (localAppServices.updatePianoRollEditor) {
        localAppServices.updatePianoRollEditor();
    }
    
    console.log('[ScaleHighlightGlobal] Cleared global scale highlights');
}

/**
 * Open the global scale highlight panel
 */
export function openScaleHighlightGlobalPanel() {
    showGlobalPanel();
}

/**
 * Get the current scale info for display
 * @returns {Object} Scale info
 */
export function getGlobalScaleInfo() {
    const settings = getCurrentScaleSettings();
    const preset = getScalePresetById(settings.scale);
    
    return {
        enabled: globalEnabled,
        scale: settings.scale,
        rootNote: settings.rootNote,
        scaleName: preset?.name || 'Unknown',
        description: preset?.description || ''
    };
}
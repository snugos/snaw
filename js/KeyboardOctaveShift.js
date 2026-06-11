// js/KeyboardOctaveShift.js - Quick octave up/down buttons for MIDI keyboard input
// Adds UI buttons for octave shift control and visual feedback

let localAppServices = {};
let currentOctaveShift = 0;
const MIN_OCTAVE_SHIFT = -2;
const MAX_OCTAVE_SHIFT = 2;
const DEFAULT_OCTAVE_SHIFT = 0;

export function initKeyboardOctaveShift(services) {
    localAppServices = services;
    console.log('[KeyboardOctaveShift] Initialized');
    
    // Add octave shift UI to the header or transport area
    setupOctaveShiftUI();
    
    // Register keyboard shortcuts for z/x octave shift
    setupOctaveShiftKeyboard();
}

function setupOctaveShiftUI() {
    // Check if UI already exists
    const existingUI = document.getElementById('octaveShiftContainer');
    if (existingUI) return;
    
    // Find the transport or header area to append octave controls
    const transportArea = localAppServices.uiElementsCache?.playBtnGlobal?.parentElement?.parentElement;
    if (!transportArea) {
        console.warn('[KeyboardOctaveShift] Transport area not found');
        return;
    }
    
    // Create octave shift container
    const container = document.createElement('div');
    container.id = 'octaveShiftContainer';
    container.className = 'flex items-center gap-1 ml-2';
    container.innerHTML = `
        <span class="text-xs text-gray-500 dark:text-gray-400 mr-1">Oct:</span>
        <button id="octaveShiftDown" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded text-gray-700 dark:text-gray-300 font-mono" title="Octave Down (Z)">−</button>
        <span id="octaveShiftValue" class="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 w-6 text-center">${currentOctaveShift >= 0 ? '+' : ''}${currentOctaveShift}</span>
        <button id="octaveShiftUp" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded text-gray-700 dark:text-gray-300 font-mono" title="Octave Up (X)">+</button>
    `;
    
    // Append after the transport buttons
    transportArea.appendChild(container);
    
    // Add event listeners
    const downBtn = document.getElementById('octaveShiftDown');
    const upBtn = document.getElementById('octaveShiftUp');
    const valueDisplay = document.getElementById('octaveShiftValue');
    
    if (downBtn) {
        downBtn.addEventListener('click', () => {
            currentOctaveShift = Math.max(MIN_OCTAVE_SHIFT, currentOctaveShift - 1);
            updateOctaveShiftDisplay(valueDisplay);
            showOctaveNotification();
        });
    }
    
    if (upBtn) {
        upBtn.addEventListener('click', () => {
            currentOctaveShift = Math.min(MAX_OCTAVE_SHIFT, currentOctaveShift + 1);
            updateOctaveShiftDisplay(valueDisplay);
            showOctaveNotification();
        });
    }
}

function updateOctaveShiftDisplay(displayElement) {
    if (displayElement) {
        displayElement.textContent = currentOctaveShift >= 0 ? `+${currentOctaveShift}` : `${currentOctaveShift}`;
    }
}

function showOctaveNotification() {
    localAppServices.showNotification?.(`Octave: ${currentOctaveShift >= 0 ? '+' : ''}${currentOctaveShift}`, 1000);
}

function setupOctaveShiftKeyboard() {
    // Keyboard shortcuts for octave shift are handled in eventHandlers.js
    // This function can be used to sync state if needed
    if (typeof getCurrentOctaveShift === 'function') {
        currentOctaveShift = getCurrentOctaveShift();
    }
}

export function getCurrentOctaveShift() {
    return currentOctaveShift;
}

export function setOctaveShift(value) {
    currentOctaveShift = Math.max(MIN_OCTAVE_SHIFT, Math.min(MAX_OCTAVE_SHIFT, value));
    const displayElement = document.getElementById('octaveShiftValue');
    updateOctaveShiftDisplay(displayElement);
    showOctaveNotification();
    return currentOctaveShift;
}

export function resetOctaveShift() {
    return setOctaveShift(DEFAULT_OCTAVE_SHIFT);
}

export function incrementOctaveShift() {
    return setOctaveShift(currentOctaveShift + 1);
}

export function decrementOctaveShift() {
    return setOctaveShift(currentOctaveShift - 1);
}

export function isOctaveShiftAtMinimum() {
    return currentOctaveShift <= MIN_OCTAVE_SHIFT;
}

export function isOctaveShiftAtMaximum() {
    return currentOctaveShift >= MAX_OCTAVE_SHIFT;
}
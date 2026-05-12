// js/TapTempoSettings.js - Tap Tempo Settings Panel
// Provides a floating panel to configure Tap Tempo behavior

let localAppServices = {};

// Panel state
let panelVisible = false;
let panelElement = null;

/**
 * Initialize the Tap Tempo Settings module.
 * @param {Object} services - App services from main.js
 */
export function initTapTempoSettings(services) {
    localAppServices = services || {};
    console.log('[TapTempoSettings] Initialized.');
}

/**
 * Toggle the settings panel visibility.
 */
export function toggleTapTempoSettings() {
    if (panelVisible) {
        closeTapTempoSettings();
    } else {
        openTapTempoSettings();
    }
}

/**
 * Open the Tap Tempo Settings panel.
 */
export function openTapTempoSettings() {
    if (panelElement) {
        panelElement.remove();
        panelElement = null;
    }

    panelElement = document.createElement('div');
    panelElement.id = 'tap-tempo-settings-panel';
    panelElement.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid #555;
        border-radius: 8px;
        padding: 14px 18px;
        color: #eee;
        font-family: system-ui, sans-serif;
        font-size: 12px;
        z-index: 10000;
        min-width: 200px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;

    // Dynamically import the settings to avoid circular deps
    import('./AudioTapTempo.js').then(m => {
        renderPanel(m);
    });
    
    document.body.appendChild(panelElement);
    panelVisible = true;
}

/**
 * Render the panel contents.
 * @param {Object} tapModule - AudioTapTempo module
 */
function renderPanel(tapModule) {
    if (!panelElement) return;

    const currentMaxTaps = tapModule.getMaxTapsSetting();
    const currentTimeout = tapModule.getTimeoutMsSetting();

    panelElement.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 12px; font-size: 13px;">Tap Tempo Settings</div>
        
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <label style="color: #aaa; flex: 1;">Max Taps:</label>
            <select id="tap-settings-max-taps" style="background: #2a2a2a; border: 1px solid #444; color: #eee; padding: 3px 6px; border-radius: 4px; cursor: pointer;">
                ${[2,4,8,12,16,20,24,32].map(n =>
                    `<option value="${n}" ${n === currentMaxTaps ? 'selected' : ''}>${n}</option>`
                ).join('')}
            </select>
        </div>
        
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <label style="color: #aaa; flex: 1;">Reset Timeout:</label>
            <select id="tap-settings-timeout" style="background: #2a2a2a; border: 1px solid #444; color: #eee; padding: 3px 6px; border-radius: 4px; cursor: pointer;">
                ${[1000,2000,3000,4000,5000,6000,8000,10000].map(ms => {
                    const label = ms >= 1000 ? `${ms/1000}s` : `${ms}ms`;
                    return `<option value="${ms}" ${ms === currentTimeout ? 'selected' : ''}>${label}</option>`;
                }).join('')}
            </select>
        </div>
        
        <div style="display: flex; justify-content: flex-end;">
            <button id="tap-settings-close" style="
                padding: 5px 14px;
                background: #333;
                border: 1px solid #555;
                border-radius: 4px;
                color: #aaa;
                font-size: 11px;
                cursor: pointer;
            ">Close</button>
        </div>
    `;

    document.getElementById('tap-settings-max-taps').addEventListener('change', (e) => {
        tapModule.setMaxTapsSetting(parseInt(e.target.value));
    });

    document.getElementById('tap-settings-timeout').addEventListener('change', (e) => {
        tapModule.setTimeoutMsSetting(parseInt(e.target.value));
    });

    document.getElementById('tap-settings-close').addEventListener('click', closeTapTempoSettings);
}

/**
 * Close the Tap Tempo Settings panel.
 */
export function closeTapTempoSettings() {
    if (panelElement) {
        panelElement.remove();
        panelElement = null;
    }
    panelVisible = false;
}
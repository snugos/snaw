/**
 * Track Solo Chain - Mute all tracks except a chain of connected tracks
 */
import { getTracksState, getTrackByIdState } from './state.js';

let originalMuteStates = new Map();
let soloChainActive = false;
let soloChainTrackIds = [];

export function isSoloChainActive() { return soloChainActive; }

export function getSoloChainTrackIds() { return [...soloChainTrackIds]; }

export function toggleSoloChain(trackId) {
    if (!soloChainActive) {
        activateSoloChain();
    }
    
    const idx = soloChainTrackIds.indexOf(trackId);
    if (idx !== -1) {
        soloChainTrackIds.splice(idx, 1);
    } else {
        soloChainTrackIds.push(trackId);
    }
    
    applySoloChain();
    
    if (soloChainTrackIds.length === 0) {
        deactivateSoloChain();
    }
}

export function activateSoloChain() {
    if (soloChainActive) return;
    
    const tracks = getTracksState();
    originalMuteStates.clear();
    soloChainTrackIds = [];
    
    tracks.forEach(t => {
        originalMuteStates.set(t.id, t.muted);
        if (!t.muted) t.muted = true;
    });
    
    soloChainActive = true;
    
    const btn = document.getElementById('trackSoloChainBtnGlobal');
    if (btn) btn.classList.add('active');
    
    if (typeof showSafeNotification === 'function') {
        showSafeNotification('Solo Chain activated - click tracks to add to chain', 2000);
    }
}

export function deactivateSoloChain() {
    if (!soloChainActive) return;
    
    const tracks = getTracksState();
    tracks.forEach(t => {
        const orig = originalMuteStates.get(t.id);
        if (orig !== undefined) t.muted = orig;
    });
    
    originalMuteStates.clear();
    soloChainTrackIds = [];
    soloChainActive = false;
    
    const btn = document.getElementById('trackSoloChainBtnGlobal');
    if (btn) btn.classList.remove('active');
    
    if (typeof showSafeNotification === 'function') {
        showSafeNotification('Solo Chain deactivated', 1500);
    }
}

export function applySoloChain() {
    if (!soloChainActive) return;
    
    const tracks = getTracksState();
    tracks.forEach(t => {
        t.muted = !soloChainTrackIds.includes(t.id);
    });
}

export function clearSoloChain() {
    soloChainTrackIds = [];
    applySoloChain();
}

let panelOpen = false;

export function openSoloChainPanel() {
    if (panelOpen) {
        closeSoloChainPanel();
        return;
    }
    
    const tracks = getTracksState();
    
    const panel = document.createElement('div');
    panel.id = 'soloChainPanel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #1a1a2e;
        border: 1px solid #3a3a5e;
        border-radius: 8px;
        padding: 16px;
        z-index: 9999;
        min-width: 240px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: system-ui, -apple-system, sans-serif;
        color: #e0e0e0;
    `;
    
    const title = document.createElement('div');
    title.textContent = 'Solo Chain';
    title.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #fff;';
    panel.appendChild(title);
    
    const status = document.createElement('div');
    status.id = 'soloChainStatus';
    status.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 10px;';
    status.textContent = soloChainActive ? `Active - ${soloChainTrackIds.length} track(s) in chain` : 'Inactive';
    panel.appendChild(status);
    
    tracks.forEach(t => {
        const btn = document.createElement('button');
        btn.textContent = t.name || `Track ${t.id}`;
        const isInChain = soloChainTrackIds.includes(t.id);
        btn.style.cssText = `
            display: block;
            width: 100%;
            padding: 8px 12px;
            margin-bottom: 6px;
            background: ${isInChain ? '#4a4a8a' : '#2a2a4a'};
            border: 1px solid ${isInChain ? '#6a6aaa' : '#3a3a6a'};
            border-radius: 4px;
            color: ${t.muted ? '#666' : '#fff'};
            font-size: 12px;
            cursor: pointer;
            text-align: left;
        `;
        
        btn.addEventListener('click', () => {
            toggleSoloChain(t.id);
            btn.style.background = soloChainTrackIds.includes(t.id) ? '#4a4a8a' : '#2a2a4a';
            btn.style.borderColor = soloChainTrackIds.includes(t.id) ? '#6a6aaa' : '#3a3a6a';
            updatePanelStatus();
        });
        
        panel.appendChild(btn);
    });
    
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
    
    const deactivateBtn = document.createElement('button');
    deactivateBtn.textContent = 'Deactivate';
    deactivateBtn.style.cssText = 'flex: 1; padding: 8px; background: #3a2a2a; border: 1px solid #5a3a3a; border-radius: 4px; color: #ff8888; cursor: pointer;';
    deactivateBtn.addEventListener('click', () => {
        deactivateSoloChain();
        closeSoloChainPanel();
    });
    btnRow.appendChild(deactivateBtn);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'flex: 1; padding: 8px; background: #2a2a3a; border: 1px solid #3a3a5a; border-radius: 4px; color: #aaa; cursor: pointer;';
    closeBtn.addEventListener('click', closeSoloChainPanel);
    btnRow.appendChild(closeBtn);
    
    panel.appendChild(btnRow);
    
    const closeX = document.createElement('button');
    closeX.textContent = '✕';
    closeX.style.cssText = 'position: absolute; top: 8px; right: 10px; background: none; border: none; color: #888; font-size: 16px; cursor: pointer;';
    closeX.addEventListener('click', closeSoloChainPanel);
    panel.appendChild(closeX);
    
    document.body.appendChild(panel);
    panelOpen = true;
    
    function updatePanelStatus() {
        const s = document.getElementById('soloChainStatus');
        if (s) s.textContent = soloChainActive ? `Active - ${soloChainTrackIds.length} track(s) in chain` : 'Inactive';
    }
}

export function closeSoloChainPanel() {
    const panel = document.getElementById('soloChainPanel');
    if (panel) {
        panel.remove();
        panelOpen = false;
    }
}

// Expose to window for eventHandlers.js integration
window.openSoloChainPanel = openSoloChainPanel;
window.toggleSoloChain = toggleSoloChain;
window.isSoloChainActive = isSoloChainActive;
window.deactivateSoloChain = deactivateSoloChain;
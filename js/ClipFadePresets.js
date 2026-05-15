/**
 * js/ClipFadePresets.js - Clip Fade Presets feature
 * Save and apply common fade in/out curves (linear, exponential, S-curve, etc.)
 */

let localAppServices = {};
let fadePresets = {
    'Linear': { fadeIn: 'linear', fadeOut: 'linear', durationIn: 0.15, durationOut: 0.15 },
    'Exponential': { fadeIn: 'exponential', fadeOut: 'exponential', durationIn: 0.2, durationOut: 0.2 },
    'S-Curve': { fadeIn: 's-curve', fadeOut: 's-curve', durationIn: 0.18, durationOut: 0.18 },
    'Quick': { fadeIn: 'quick', fadeOut: 'quick', durationIn: 0.08, durationOut: 0.08 },
    'Slow': { fadeIn: 'slow', fadeOut: 'slow', durationIn: 0.35, durationOut: 0.35 }
};
let currentPanelWindow = null;

export function initClipFadePresets(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipFadePresets] Module initialized');
}

export function openClipFadePresetsPanel() {
    if (currentPanelWindow && !currentPanelWindow.isDestroyed) {
        currentPanelWindow.focus();
        return;
    }

    const presetsHTML = Object.entries(fadePresets).map(([name, preset]) => `
        <div class="fade-preset-item" data-preset="${name}" style="padding: 10px; margin: 6px 0; background: rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer; transition: background 0.15s; border: 1px solid rgba(255,255,255,0.1);" 
             onmouseover="this.style.background='rgba(255,255,255,0.15)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            <div style="font-weight: 600; color: var(--accent, #d8a657);">${name}</div>
            <div style="font-size: 11px; color: var(--muted, #aaa39a); margin-top: 4px;">
                <span style="color: #4ade80;">In:</span> ${preset.fadeIn} (${preset.durationIn}s) &nbsp;
                <span style="color: #f87171;">Out:</span> ${preset.fadeOut} (${preset.durationOut}s)
            </div>
        </div>
    `).join('');

    const content = `
        <div style="padding: 14px; min-width: 260px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: var(--foreground, #f5f1e8);">🎚 Clip Fade Presets</div>
            <div style="font-size: 11px; color: var(--muted, #aaa39a); margin-bottom: 10px;">
                Select a preset to apply to the selected clip
            </div>
            <div id="fade-presets-list" style="max-height: 320px; overflow-y: auto;">
                ${presetsHTML}
            </div>
        </div>
    `;

    const SnugWindow = localAppServices.SnugWindow || window.SnugWindow;
    if (!SnugWindow) {
        console.warn('[ClipFadePresets] SnugWindow not available');
        return;
    }

    currentPanelWindow = new SnugWindow(
        'clip-fade-presets',
        'Fade Presets',
        content,
        { width: 270, height: 420 },
        localAppServices
    );
    currentPanelWindow.onClose = () => { currentPanelWindow = null; };

    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('.fade-preset-item').forEach(item => {
            item.addEventListener('click', () => applyFadePreset(item.dataset.preset));
        });
    }, 100);
}

function applyFadePreset(presetName) {
    const preset = fadePresets[presetName];
    if (!preset) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const selectedTrackId = localAppServices.getActiveSequencerTrackId ? localAppServices.getActiveSequencerTrackId() : null;

    if (!selectedTrackId) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Select a track with a clip first', 'warning');
        }
        return;
    }

    const track = tracks.find(t => t.id === selectedTrackId);
    if (!track || !track.timelineClips || track.timelineClips.length === 0) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('No clip on selected track to apply fade', 'warning');
        }
        return;
    }

    const clip = track.timelineClips[track.timelineClips.length - 1];

    if (typeof track.setClipFade === 'function') {
        track.setClipFade(clip.id, preset.durationIn, preset.durationOut);
    }

    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Applied ${presetName} fade`, 2000);
    }

    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }
}

export function closeClipFadePresetsPanel() {
    if (currentPanelWindow && !currentPanelWindow.isDestroyed) {
        currentPanelWindow.close();
        currentPanelWindow = null;
    }
}

export function addFadePreset(name, fadeInType, fadeOutType, durationIn = 0.15, durationOut = 0.15) {
    if (name && fadeInType && fadeOutType) {
        fadePresets[name] = { fadeIn: fadeInType, fadeOut: fadeOutType, durationIn, durationOut };
        console.log(`[ClipFadePresets] Added preset: ${name}`);
    }
}

export function getFadePresets() {
    return { ...fadePresets };
}

export function getClipFadeMenuItems(services = {}, clip = null) {
    const items = Object.keys(fadePresets).map(name => ({
        label: name,
        action: () => {
            const preset = fadePresets[name];
            if (clip && typeof clip.setClipFade === 'function') {
                clip.setClipFade(clip.id, preset.durationIn, preset.durationOut);
            } else if (services.getActiveSequencerTrackId) {
                const trackId = services.getActiveSequencerTrackId();
                const tracks = services.getTracks ? services.getTracks() : [];
                const track = tracks.find(t => t.id === trackId);
                if (track && track.timelineClips && track.timelineClips.length > 0) {
                    const targetClip = track.timelineClips[track.timelineClips.length - 1];
                    if (typeof track.setClipFade === 'function') {
                        track.setClipFade(targetClip.id, preset.durationIn, preset.durationOut);
                    }
                }
            }
            if (services.showNotification) services.showNotification(`Applied ${name} fade`, 1500);
            if (services.renderTimeline) services.renderTimeline();
        }
    }));
    return {
        label: 'Clip Fade Presets',
        submenu: items
    };
}

export function getClipFadeMenuItemsSimple(clip = null) {
    return Object.keys(fadePresets).map(name => ({
        label: name,
        action: () => {
            const preset = fadePresets[name];
            if (clip && typeof clip.setClipFade === 'function') {
                clip.setClipFade(clip.id, preset.durationIn, preset.durationOut);
            }
        }
    }));
}

export function applyFadePresetToClip(clipId, presetName, trackId = null) {
    const preset = fadePresets[presetName];
    if (!preset) return false;

    let track = null;
    if (trackId) {
        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        track = tracks.find(t => t.id === trackId);
    } else {
        const selectedTrackId = localAppServices.getActiveSequencerTrackId ? localAppServices.getActiveSequencerTrackId() : null;
        if (selectedTrackId) {
            const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
            track = tracks.find(t => t.id === selectedTrackId);
        }
    }

    if (!track) return false;

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return false;

    if (typeof track.setClipFade === 'function') {
        track.setClipFade(clip.id, preset.durationIn, preset.durationOut);
        return true;
    }
    return false;
}

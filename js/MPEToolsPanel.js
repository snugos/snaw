// js/MPEToolsPanel.js - MPE (Musical Polyphonic Expression) Tools Panel
// Per-note pitch bend, timbre, and pressure for expressive MIDI performance

import { getTracksState, getTrackByIdState } from './state.js';

let mpePanelEl = null;
let refreshInterval = null;

export function openMPEToolsPanel() {
    if (mpePanelEl) {
        mpePanelEl.remove();
        mpePanelEl = null;
        clearInterval(refreshInterval);
        return;
    }

    mpePanelEl = document.createElement('div');
    mpePanelEl.id = 'mpeToolsPanel';
    mpePanelEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #3a3a5a;
        border-radius: 12px;
        padding: 20px;
        min-width: 480px;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        color: #e0e0f0;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    document.body.appendChild(mpePanelEl);
    renderMPEPanel();
    refreshInterval = setInterval(() => {
        if (mpePanelEl) renderMPEPanel();
    }, 500);
}

function renderMPEPanel() {
    if (!mpePanelEl) return;
    const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
    const synthTracks = tracks.filter(t => t.type === 'Synth');

    let trackRows = synthTracks.map(track => {
        const mpe = track.mpeSettings;
        const enabled = mpe?.enabled ?? false;
        const pitchRange = mpe?.pitchRange ?? 48;
        const activeNotes = mpe?.activeNotes ? Array.from(mpe.activeNotes.entries()).map(([note, vid]) => {
            const voice = mpe.voices?.get(vid);
            const pb = voice?.pitchBend ?? 0;
            const tb = voice?.timbre ?? 0.5;
            const pr = voice?.pressure ?? 0;
            return `<div style="display:inline-flex;gap:4px;margin:2px;padding:3px 6px;background:#2a2a4a;border-radius:4px;font-size:11px;">
                <span style="color:#7af;">N${note}</span>
                <span style="color:#fa7;">PB:${pb.toFixed(2)}</span>
                <span style="color:#7fa;">TB:${tb.toFixed(2)}</span>
                <span style="color:#a7f;">PR:${pr.toFixed(2)}</span>
            </div>`;
        }).join('') || '<span style="color:#666;font-size:11px;">none</span>';

        return `
        <div style="background:#252540;border-radius:8px;padding:12px;margin-bottom:10px;" data-track-id="${track.id}">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <span style="flex:1;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.name || 'Synth Track ' + track.id}</span>
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
                    <input type="checkbox" class="mpeEnableCb" data-track-id="${track.id}" ${enabled ? 'checked' : ''}>
                    <span style="color:#8cf;">Enable MPE</span>
                </label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <label style="font-size:12px;color:#888;">Pitch Range:</label>
                <select class="mpePitchRangeSel" data-track-id="${track.id}" style="padding:4px 8px;background:#333;border:1px solid #555;color:#fff;border-radius:4px;">
                    <option value="12" ${pitchRange === 12 ? 'selected' : ''}>±12 semitones</option>
                    <option value="24" ${pitchRange === 24 ? 'selected' : ''}>±24 semitones</option>
                    <option value="48" ${pitchRange === 48 ? 'selected' : ''}>±48 semitones</option>
                    <option value="96" ${pitchRange === 96 ? 'selected' : ''}>±96 semitones</option>
                </select>
            </div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">Active Notes:</div>
            <div style="min-height:24px;line-height:1.4;">${activeNotes}</div>
        </div>`;
    }).join('');

    if (synthTracks.length === 0) {
        trackRows = `<div style="text-align:center;padding:30px;color:#666;font-size:13px;">
            No Synth tracks found.<br>Add a synth track to use MPE features.
        </div>`;
    }

    mpePanelEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
                <h3 style="margin:0;font-size:18px;font-weight:600;">🎹 MPE Tools</h3>
                <p style="margin:4px 0 0;font-size:11px;color:#888;">Per-note pitch bend, timbre & pressure</p>
            </div>
            <button id="closeMPEPanel" style="background:#333;border:none;color:#fff;padding:6px 12px;cursor:pointer;border-radius:6px;font-size:13px;">×</button>
        </div>
        <div id="mpeTrackList">${trackRows}</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #3a3a5a;font-size:11px;color:#666;text-align:center;">
            MPE = Musical Polyphonic Expression · Learn more at rogerlinn.com
        </div>
    `;

    // Attach event listeners
    mpePanelEl.querySelector('#closeMPEPanel')?.addEventListener('click', () => {
        mpePanelEl?.remove();
        mpePanelEl = null;
        clearInterval(refreshInterval);
    });

    mpePanelEl.querySelectorAll('.mpeEnableCb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const trackId = e.target.dataset.trackId;
            const track = typeof getTrackByIdState === 'function' ? getTrackByIdState(trackId) : null;
            if (track) {
                if (e.target.checked) {
                    track.initMPESupport?.({ pitchRange: track.mpeSettings?.pitchRange || 48 });
                }
            }
        });
    });

    mpePanelEl.querySelectorAll('.mpePitchRangeSel').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const trackId = e.target.dataset.trackId;
            const range = parseInt(e.target.value, 10);
            const track = typeof getTrackByIdState === 'function' ? getTrackByIdState(trackId) : null;
            if (track?.mpeSettings) {
                track.mpeSettings.pitchRange = range;
            }
        });
    });
}

// Expose globally for inline event handlers
window.openMPEToolsPanel = openMPEToolsPanel;

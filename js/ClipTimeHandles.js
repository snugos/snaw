// js/ClipTimeHandles.js - Show mm:ss start/end timecode on every clip
// Adds a small overlay to each clip element with its position and length in the timeline.
// Works alongside AudioClipLabeling and any other overlay feature.

const OVERLAY_CLASS = 'clip-time-overlay';
let localAppServices = null;

function formatTimecode(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const totalCs = Math.round(seconds * 100);
    const minutes = Math.floor(totalCs / 6000);
    const remainingCs = totalCs - minutes * 6000;
    const wholeSeconds = Math.floor(remainingCs / 100);
    const cs = remainingCs - wholeSeconds * 100;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(wholeSeconds).padStart(2, '0');
    const cc = String(cs).padStart(2, '0');
    return `${mm}:${ss}.${cc}`;
}

function getClipStart(clip) {
    if (clip && Number.isFinite(clip.startTime)) return clip.startTime;
    if (clip && Number.isFinite(clip.start)) return clip.start;
    if (clip && Number.isFinite(clip.time)) return clip.time;
    return 0;
}

function getClipDuration(clip) {
    if (clip && Number.isFinite(clip.duration)) return clip.duration;
    if (clip && Number.isFinite(clip.length)) return clip.length;
    if (clip && Number.isFinite(clip.endTime) && Number.isFinite(clip.startTime)) {
        return clip.endTime - clip.startTime;
    }
    return 0;
}

function applyOverlayToClipElement(clipEl, clip) {
    if (!clipEl) return;
    let overlay = clipEl.querySelector(`:scope > .${OVERLAY_CLASS}`);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = OVERLAY_CLASS;
        // Keep the overlay from intercepting pointer events so the clip
        // stays draggable / clickable.
        overlay.style.pointerEvents = 'none';
        overlay.style.position = 'absolute';
        overlay.style.right = '4px';
        overlay.style.bottom = '2px';
        overlay.style.padding = '1px 4px';
        overlay.style.borderRadius = '3px';
        overlay.style.background = 'rgba(0, 0, 0, 0.55)';
        overlay.style.color = '#f5f5f5';
        overlay.style.font = '10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace';
        overlay.style.letterSpacing = '0.02em';
        overlay.style.whiteSpace = 'nowrap';
        clipEl.appendChild(overlay);
    }
    const start = getClipStart(clip);
    const dur = getClipDuration(clip);
    const end = start + dur;
    overlay.textContent = `${formatTimecode(start)} → ${formatTimecode(end)}`;
}

function applyOverlaysToAllClips() {
    const getTracks = typeof localAppServices?.getTracks === 'function'
        ? localAppServices.getTracks
        : null;
    if (!getTracks) return;
    let tracks;
    try { tracks = getTracks(); } catch (e) { return; }
    if (!Array.isArray(tracks)) return;

    for (const track of tracks) {
        const clips = Array.isArray(track?.timelineClips) ? track.timelineClips : [];
        for (const clip of clips) {
            const el = document.querySelector(`.timeline-clip[data-clip-id="${clip.id}"]`);
            if (el) applyOverlayToClipElement(el, clip);
        }
    }
}

export function initClipTimeHandles(appServices) {
    localAppServices = appServices || {};
    const originalRender = typeof localAppServices.renderTimeline === 'function'
        ? localAppServices.renderTimeline
        : null;
    if (originalRender && !originalRender.__snawClipTimeHandlesWrapped) {
        const wrapped = function (...args) {
            try { return originalRender.apply(this, args); }
            finally { applyOverlaysToAllClips(); }
        };
        wrapped.__snawClipTimeHandlesWrapped = true;
        localAppServices.renderTimeline = wrapped;
    }
    // Also re-apply on the next frame so clips rendered before init still get overlays.
    setTimeout(applyOverlaysToAllClips, 0);
    console.log('[ClipTimeHandles] Initialized');
}

export function refreshClipTimeHandles() {
    applyOverlaysToAllClips();
}

export { formatTimecode };

console.log('[ClipTimeHandles] Module loaded');

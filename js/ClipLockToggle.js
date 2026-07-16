let localAppServices = {};
let renderWrapped = false;
let listenersInitialized = false;

function getTracks() {
    try {
        return typeof localAppServices.getTracks === 'function' ? localAppServices.getTracks() || [] : [];
    } catch (_) {
        return [];
    }
}

function findClip(clipId) {
    const id = String(clipId);
    for (const track of getTracks()) {
        const clip = (track.timelineClips || []).find(item => String(item.id) === id);
        if (clip) return { track, clip };
    }
    return null;
}

export function isClipLocked(clipId) {
    return findClip(clipId)?.clip?.locked === true;
}

export function notifyClipLocked(action = 'modify') {
    localAppServices.showNotification?.(`Clip is locked; ${action} blocked`, 1800);
    return false;
}

export function setClipLocked(clipId, locked) {
    const found = findClip(clipId);
    if (!found) return false;
    const next = !!locked;
    if (found.clip.locked === next) return true;
    localAppServices.captureStateForUndo?.(`${next ? 'Lock' : 'Unlock'} clip`);
    found.clip.locked = next;
    localAppServices.renderTimeline?.();
    setTimeout(refreshLockedClipStyles, 0);
    localAppServices.showNotification?.(`Clip ${next ? 'locked' : 'unlocked'}`, 1500);
    return true;
}

export function toggleClipLock(clipId) {
    return setClipLocked(clipId, !isClipLocked(clipId));
}

function refreshLockedClipStyles() {
    if (typeof document === 'undefined') return;
    for (const track of getTracks()) {
        for (const clip of track.timelineClips || []) {
            const element = document.querySelector(`.timeline-clip[data-clip-id="${clip.id}"]`);
            if (!element) continue;
            const locked = clip.locked === true;
            element.classList.toggle('snaw-clip-locked', locked);
            element.dataset.clipLocked = locked ? 'true' : 'false';
            element.setAttribute('aria-label', `${clip.name || 'Clip'}${locked ? ' (locked)' : ''}`);
            let badge = element.querySelector('.snaw-clip-lock-badge');
            if (locked && !badge) {
                badge = document.createElement('span');
                badge.className = 'snaw-clip-lock-badge';
                badge.textContent = '🔒';
                badge.setAttribute('aria-label', 'Locked clip');
                badge.style.cssText = 'position:absolute;top:2px;right:3px;z-index:8;font-size:11px;line-height:1;pointer-events:none;';
                element.appendChild(badge);
            } else if (!locked && badge) {
                badge.remove();
            }
        }
    }
}

function addLockStyles() {
    if (typeof document === 'undefined' || document.getElementById('snaw-clip-lock-styles')) return;
    const style = document.createElement('style');
    style.id = 'snaw-clip-lock-styles';
    style.textContent = '.snaw-clip-locked { box-shadow: inset 0 0 0 2px rgba(250, 204, 21, 0.8); }';
    document.head.appendChild(style);
}

function guardContextMenuAction(event) {
    const button = event.target.closest?.('#clip-context-menu button');
    if (!button) return;
    const action = button.dataset.action;
    const isFadePreset = button.classList.contains('fade-preset-btn');
    const protectedAction = isFadePreset || ['reverse', 'flipPhase', 'startOffset', 'clipGain', 'stretch', 'delete', 'group'].includes(action);
    if (protectedAction && isClipLocked(button.dataset.clipId)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notifyClipLocked(action === 'delete' ? 'delete' : 'modify');
    }
}

function guardLockedDelete(event) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const target = event.target;
    if (target?.matches?.('input, textarea, select') || target?.isContentEditable) return;
    const selected = localAppServices.getSelectedClipIds?.() || [];
    const ids = selected instanceof Set ? Array.from(selected) : (Array.isArray(selected) ? selected : []);
    if (ids.some(isClipLocked)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notifyClipLocked('delete');
    }
}

function guardLockedReverse(event) {
    if (event.target?.matches?.('input, textarea, select') || event.target?.isContentEditable) return;
    if (!['r', 'f'].includes(String(event.key).toLowerCase())) return;
    const selected = document.querySelector('.timeline-clip.selected');
    if (selected?.dataset.clipId && isClipLocked(selected.dataset.clipId)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notifyClipLocked(String(event.key).toLowerCase() === 'r' ? 'reverse' : 'modify');
    }
}

function guardLockedResize(event) {
    if (event.button !== 0) return;
    const clip = event.target.closest?.('[data-clip-id]');
    const overlayTarget = event.target.closest?.('#stretchHandleOverlay');
    if (overlayTarget) return;
    if (!clip || !isClipLocked(clip.dataset.clipId)) return;
    const isEdgeTarget = event.target.closest?.('.clip-fade-handle, .fade-handle');
    if (!isEdgeTarget) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notifyClipLocked('resize');
}

export function initClipLockToggle(appServices = {}) {
    localAppServices = appServices;
    addLockStyles();
    localAppServices.getClipLockState = isClipLocked;
    localAppServices.isClipLocked = isClipLocked;
    localAppServices.setClipLocked = setClipLocked;
    localAppServices.toggleClipLock = toggleClipLock;
    localAppServices.notifyClipLocked = notifyClipLocked;
    localAppServices.refreshClipLockStyles = refreshLockedClipStyles;

    if (!renderWrapped && typeof localAppServices.renderTimeline === 'function') {
        const originalRender = localAppServices.renderTimeline;
        const wrappedRender = function (...args) {
            const result = originalRender.apply(this, args);
            setTimeout(refreshLockedClipStyles, 0);
            return result;
        };
        wrappedRender.__snawClipLockWrapped = true;
        localAppServices.renderTimeline = wrappedRender;
        renderWrapped = true;
    }

    if (!listenersInitialized && typeof window !== 'undefined') {
        window.addEventListener('click', guardContextMenuAction, true);
        window.addEventListener('keydown', guardLockedDelete, true);
        window.addEventListener('keydown', guardLockedReverse, true);
        window.addEventListener('mousedown', guardLockedResize, true);
        listenersInitialized = true;
    }
    setTimeout(refreshLockedClipStyles, 0);
    console.log('[ClipLockToggle] Initialized');
}

export function refreshClipLockStyles() {
    refreshLockedClipStyles();
}

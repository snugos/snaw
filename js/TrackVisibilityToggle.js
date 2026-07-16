let localAppServices = {};
let initialized = false;
let observer = null;

function getTracks() {
    return localAppServices.getTracks?.() || [];
}

function getTrack(trackId) {
    return getTracks().find(track => String(track.id) === String(trackId)) || null;
}

function getTrackRoots(trackId) {
    return Array.from(document.querySelectorAll('.timeline-track-lane, .track-lane, .track-strip'))
        .filter(element => String(element.dataset.trackId) === String(trackId));
}

function getVisibilityButtonLabel(track) {
    return track?.isVisible === false ? 'Show track' : 'Hide track';
}

function decorateTrackRoot(root, track) {
    if (!root || root.dataset.trackVisibilityDecorated === 'true') return;
    const anchor = root.matches('.track-strip')
        ? root.querySelector('.text-center') || root
        : root.querySelector('.track-header') || root;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-visibility-toggle';
    button.dataset.trackId = String(track.id);
    button.title = `${getVisibilityButtonLabel(track)} without changing audio`;
    button.setAttribute('aria-label', button.title);
    button.textContent = track.isVisible === false ? '◌' : '◉';
    anchor.appendChild(button);
    root.dataset.trackVisibilityDecorated = 'true';
}

function getShowAllButton() {
    let button = document.getElementById('trackVisibilityShowAll');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'trackVisibilityShowAll';
    button.type = 'button';
    button.className = 'track-visibility-show-all';
    button.textContent = 'Show all';
    button.title = 'Show all hidden tracks';
    button.addEventListener('click', showAllTracksInternal);
    const desktop = document.getElementById('desktop') || document.body;
    desktop.appendChild(button);
    return button;
}

function updateShowAllButton() {
    const hiddenCount = getTracks().filter(track => track && track.isVisible === false).length;
    const button = getShowAllButton();
    button.hidden = hiddenCount === 0;
    button.textContent = hiddenCount > 0 ? `Show all (${hiddenCount})` : 'Show all';
}

function syncVisibility() {
    const tracks = getTracks();
    tracks.forEach(track => {
        if (!track) return;
        getTrackRoots(track.id).forEach(root => {
            decorateTrackRoot(root, track);
            root.hidden = track.isVisible === false;
        });
    });
    updateShowAllButton();
}

function refresh() {
    localAppServices.renderTimeline?.();
    localAppServices.updateMixerChannelStripPanel?.();
    syncVisibility();
}

function setTrackVisibilityInternal(trackId, visible, fromInteraction = true) {
    const track = getTrack(trackId);
    if (!track || typeof visible !== 'boolean' || track.isVisible === visible) return false;
    if (fromInteraction) localAppServices.captureStateForUndo?.(`${visible ? 'Show' : 'Hide'} track "${track.name || trackId}"`);
    track.isVisible = visible;
    refresh();
    localAppServices.showNotification?.(`${visible ? 'Showing' : 'Hiding'} track "${track.name || trackId}"`, 1500);
    return true;
}

function toggleTrackVisibilityInternal(trackId) {
    const track = getTrack(trackId);
    if (!track) return false;
    return setTrackVisibilityInternal(trackId, track.isVisible === false, true);
}

function showAllTracksInternal() {
    const hiddenTracks = getTracks().filter(track => track && track.isVisible === false);
    if (hiddenTracks.length === 0) return false;
    localAppServices.captureStateForUndo?.('Show all tracks');
    hiddenTracks.forEach(track => { track.isVisible = true; });
    refresh();
    localAppServices.showNotification?.(`Showing all ${hiddenTracks.length} hidden track${hiddenTracks.length === 1 ? '' : 's'}`, 1500);
    return true;
}

function handleClick(event) {
    const button = event.target.closest?.('.track-visibility-toggle');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggleTrackVisibilityInternal(button.dataset.trackId);
}

export function initTrackVisibilityToggle(services) {
    localAppServices = services || {};
    if (initialized) {
        syncVisibility();
        return;
    }
    document.addEventListener('click', handleClick, true);
    observer = new MutationObserver(() => syncVisibility());
    observer.observe(document.body, { childList: true, subtree: true });
    initialized = true;
    syncVisibility();
}

export function setTrackVisibility(trackId, visible, fromInteraction = true) {
    return setTrackVisibilityInternal(trackId, visible, fromInteraction);
}

export function toggleTrackVisibility(trackId) {
    return toggleTrackVisibilityInternal(trackId);
}

export function showAllTracks() {
    return showAllTracksInternal();
}

export function getHiddenTrackIds() {
    return getTracks().filter(track => track?.isVisible === false).map(track => track.id);
}

if (typeof window !== 'undefined') {
    window.TrackVisibilityToggle = {
        initTrackVisibilityToggle,
        setTrackVisibility,
        toggleTrackVisibility,
        showAllTracks,
        getHiddenTrackIds,
        syncVisibility
    };
}

// js/TrackScrollToCenter.js - Scroll track into center of arrangement view
// Small quality-of-life feature for DAW workflow

let appServicesRef = null;
let scrollTrackToCenterFn = null;

function initTrackScrollToCenter(as) {
    appServicesRef = as;
    scrollTrackToCenterFn = scrollTrackToCenter;
    console.log('[TrackScrollToCenter] Module initialized');
}

function scrollTrackToCenter(trackId) {
    if (!trackId) return;

    // Find the track lane element
    const trackLane = document.querySelector(`[data-track-id="${trackId}"]`);
    if (!trackLane) {
        console.warn(`[TrackScrollToCenter] Track lane not found for id: ${trackId}`);
        return;
    }

    // Find the arrangement/timeline scroll container
    const scrollContainer = document.querySelector('#arrangement-scroll, #timeline-scroll, .arrangement-view, .timeline-container');
    if (!scrollContainer) {
        console.warn('[TrackScrollToCenter] Scroll container not found');
        return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const laneRect = trackLane.getBoundingClientRect();

    // Calculate centered position
    const scrollTop = laneRect.top - containerRect.top + scrollContainer.scrollTop - (containerRect.height / 2) + (laneRect.height / 2);

    scrollContainer.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
    });
}

function openTrackScrollToCenterPanel() {
    if (appServicesRef?.showNotification) {
        appServicesRef.showNotification('Ctrl+Shift+Click any track to scroll it to center', 3000);
    }
}

// Export the scroll function for use by event handlers
function getScrollToCenterFn() {
    return scrollTrackToCenter;
}

export { initTrackScrollToCenter, openTrackScrollToCenterPanel, scrollTrackToCenter, getScrollToCenterFn };
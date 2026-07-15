let localAppServices = {};
let initialized = false;
let popoverTimer = null;

function isTypingTarget(target) {
    return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function getTransport() {
    return typeof Tone !== 'undefined' && Tone.Transport ? Tone.Transport : null;
}

function getCurrentTime() {
    const transport = getTransport();
    if (transport && Number.isFinite(transport.seconds)) return Math.max(0, transport.seconds);
    if (typeof localAppServices.getCurrentTime === 'function') {
        const time = Number(localAppServices.getCurrentTime());
        if (Number.isFinite(time)) return Math.max(0, time);
    }
    return 0;
}

function isPlaying() {
    const transport = getTransport();
    return transport ? transport.state === 'started' : false;
}

function getMarkers() {
    if (typeof localAppServices.getRenderedTimelineMarkers === 'function') {
        return localAppServices.getRenderedTimelineMarkers() || [];
    }
    return [];
}

function jumpToMarker(marker) {
    if (!marker) return;
    const time = Math.max(0, Number(marker?.time) || 0);
    const transport = getTransport();
    if (transport) transport.seconds = time;
    if (typeof localAppServices.jumpToTime === 'function') localAppServices.jumpToTime(time);
    if (typeof localAppServices.updatePlayheadPosition === 'function') {
        localAppServices.updatePlayheadPosition(time);
    }
    if (typeof localAppServices.showNotification === 'function') {
        localAppServices.showNotification(`Jumped to ${marker.name}`, 1000);
    }
}

function closePopover() {
    if (typeof document === 'undefined') return;
    if (popoverTimer) {
        clearTimeout(popoverTimer);
        popoverTimer = null;
    }
    document.getElementById('quickMarkerPopover')?.remove();
}

function showPopover(message = '') {
    if (typeof document === 'undefined' || !document.body) return;
    closePopover();
    const markers = getMarkers().sort((a, b) => a.time - b.time);
    const popover = document.createElement('div');
    popover.id = 'quickMarkerPopover';
    popover.style.cssText = 'position:fixed;top:44px;right:14px;z-index:20000;width:220px;padding:10px;background:#111827;color:#f9fafb;border:1px solid #374151;border-radius:7px;box-shadow:0 10px 28px rgba(0,0,0,.4);font:12px system-ui,sans-serif;';
    const rows = markers.slice(-6).reverse().map(marker => {
        const row = document.createElement('button');
        row.type = 'button';
        row.dataset.markerId = marker.id;
        row.textContent = `${marker.name}  ${Number(marker.time || 0).toFixed(1)}s`;
        row.style.cssText = 'display:block;width:100%;padding:5px 6px;text-align:left;color:#e5e7eb;background:transparent;border:0;border-radius:4px;cursor:pointer;';
        row.addEventListener('mouseenter', () => { row.style.background = '#1f2937'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
        row.addEventListener('click', () => { jumpToMarker(marker); closePopover(); });
        return row;
    });
    const heading = document.createElement('div');
    heading.textContent = message || 'Quick markers';
    heading.style.cssText = 'font-weight:600;color:#93c5fd;margin-bottom:5px;';
    popover.appendChild(heading);
    if (rows.length) rows.forEach(row => popover.appendChild(row));
    else {
        const empty = document.createElement('div');
        empty.textContent = 'No markers yet';
        empty.style.color = '#9ca3af';
        popover.appendChild(empty);
    }
    document.body.appendChild(popover);
    popoverTimer = setTimeout(closePopover, 3500);
}

function addMarker() {
    const time = Math.round(getCurrentTime() * 10) / 10;
    const existing = getMarkers().find(marker => Math.abs(Number(marker.time) - time) < 0.05);
    if (existing) {
        showPopover(`${existing.name} already here`);
        return existing;
    }
    const marker = typeof localAppServices.addRenderedTimelineMarker === 'function'
        ? localAppServices.addRenderedTimelineMarker(time)
        : null;
    if (marker) {
        localAppServices.showNotification?.(`${marker.name} at ${time.toFixed(1)}s`, 1200);
        showPopover('Marker added');
    }
    return marker;
}

function removeLastMarker() {
    const markers = getMarkers().sort((a, b) => a.time - b.time);
    const marker = markers[markers.length - 1];
    if (!marker) {
        showPopover('No markers to remove');
        return false;
    }
    const removed = typeof localAppServices.removeRenderedTimelineMarker === 'function'
        ? localAppServices.removeRenderedTimelineMarker(marker.id)
        : false;
    if (removed) {
        localAppServices.showNotification?.(`Removed ${marker.name}`, 1200);
        showPopover('Marker removed');
    }
    return removed;
}

export function handleQuickMarkerKey(event) {
    if (!event || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (typeof document !== 'undefined' && isTypingTarget(document.activeElement))) return false;
    if (String(event.key).toLowerCase() !== 'm') return false;
    if (!event.shiftKey && !isPlaying()) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.shiftKey) removeLastMarker();
    else addMarker();
    return true;
}

function handleKeydown(event) {
    handleQuickMarkerKey(event);
}

export function initQuickMarkerSet(appServices) {
    if (initialized) return;
    initialized = true;
    localAppServices = appServices || {};
    if (typeof document !== 'undefined') document.addEventListener('keydown', handleKeydown, true);
    if (typeof window !== 'undefined') {
        window.openQuickMarkerPopover = () => showPopover();
        window.quickMarkerSet = { addMarker, removeLastMarker, showPopover };
    }
    console.log('[QuickMarkerSet] Initialized');
}

export function openQuickMarkerPopover() {
    showPopover();
}

export function getQuickMarkerSetState() {
    return { markers: getMarkers().map(marker => ({ ...marker })) };
}

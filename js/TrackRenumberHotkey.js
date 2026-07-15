let localAppServices = {};
let selectedTrackId = null;
let activeEditor = null;
let initialized = false;

function notify(message, duration = 1800) {
    const services = localAppServices || {};
    if (typeof services.showSafeNotification === 'function') services.showSafeNotification(message, duration);
    else if (typeof services.showNotification === 'function') services.showNotification(message, duration);
}

function getTracks() {
    const tracks = localAppServices.getTracks?.() || localAppServices.getTracksState?.() || [];
    return Array.isArray(tracks) ? tracks : [];
}

function getSelectedTrack() {
    const tracks = getTracks();
    if (selectedTrackId != null) {
        const selected = tracks.find(track => String(track?.id) === String(selectedTrackId));
        if (selected) return selected;
    }
    const activeId = localAppServices.getActiveSequencerTrackIdState?.();
    return activeId == null ? null : tracks.find(track => String(track?.id) === String(activeId)) || null;
}

function findTrackElement(trackId) {
    const selectors = [
        `.track-strip[data-track-id="${trackId}"]`,
        `.timeline-track-lane[data-track-id="${trackId}"]`,
        `.track-header[data-track-id="${trackId}"]`,
        `[data-track-id="${trackId}"]`
    ];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

function closeEditor() {
    if (activeEditor?.element?.isConnected) activeEditor.element.remove();
    activeEditor = null;
}

function refreshVisibleTrackOrder(tracks) {
    const orderedIds = tracks.map(track => String(track.id));
    const parents = new Set();
    document.querySelectorAll('[data-track-id]').forEach(element => {
        if (element.dataset.trackId !== 'master' && element.parentElement) parents.add(element.parentElement);
    });
    parents.forEach(parent => {
        const children = Array.from(parent.children).filter(element => {
            const id = element.dataset?.trackId;
            return id != null && id !== 'master' && orderedIds.includes(String(id));
        });
        if (children.length < 2) return;
        const byId = new Map(children.map(element => [String(element.dataset.trackId), element]));
        orderedIds.forEach(id => {
            const element = byId.get(id);
            if (element) parent.appendChild(element);
        });
    });
    tracks.forEach((track, index) => {
        document.querySelectorAll(`[data-track-id="${track.id}"]`).forEach(element => {
            element.querySelector('.track-number-label')?.replaceChildren(document.createTextNode(String(index + 1)));
            element.querySelector('.track-name-label, .track-name, .text-xs.font-medium.text-white')?.replaceChildren(document.createTextNode(track.name || ''));
        });
    });
}

function applyRenumber(track, positionInput, nameInput) {
    const tracks = getTracks();
    const oldIndex = tracks.findIndex(item => String(item?.id) === String(track.id));
    if (oldIndex < 0) return;

    const requestedPosition = Number.parseInt(positionInput.value, 10);
    const targetIndex = Math.max(0, Math.min(tracks.length - 1, (Number.isFinite(requestedPosition) ? requestedPosition : oldIndex + 1) - 1));
    const nextName = String(nameInput.value || '').trim();
    const nameChanged = nextName.length > 0 && nextName !== track.name;

    if (targetIndex === oldIndex && !nameChanged) {
        closeEditor();
        return;
    }

    const capture = localAppServices.captureStateForUndo
        || localAppServices.stateModule?.captureStateForUndo;
    if (typeof capture === 'function') {
        capture(nameChanged
            ? `Renumber and rename track "${track.name}"`
            : `Renumber track "${track.name}"`);
    }

    if (nameChanged) track.name = nextName;
    if (targetIndex !== oldIndex) {
        const [moved] = tracks.splice(oldIndex, 1);
        tracks.splice(targetIndex, 0, moved);
    }

    selectedTrackId = track.id;
    closeEditor();
    refreshVisibleTrackOrder(tracks);
    localAppServices.updateTrackUI?.(track.id, 'trackRenumbered');
    localAppServices.updateMixerWindow?.();
    localAppServices.renderTimeline?.();
    notify(`Track "${track.name}" moved to ${targetIndex + 1}`, 1500);
}

function openEditor(track) {
    closeEditor();
    const anchor = findTrackElement(track.id);
    if (!anchor) {
        notify('Open the mixer and select a track first', 1800);
        return;
    }

    const tracks = getTracks();
    const currentPosition = tracks.findIndex(item => String(item?.id) === String(track.id)) + 1;
    const editor = document.createElement('div');
    editor.className = 'track-renumber-editor flex flex-col gap-2 mt-2 p-2 rounded border border-cyan-500 bg-gray-900';
    editor.setAttribute('data-track-renumber-editor', 'true');

    const positionInput = document.createElement('input');
    positionInput.type = 'number';
    positionInput.min = '1';
    positionInput.max = String(Math.max(1, tracks.length));
    positionInput.value = String(currentPosition);
    positionInput.title = 'Track position';
    positionInput.className = 'track-renumber-position w-full px-2 py-1 text-xs rounded bg-gray-800 text-white border border-gray-600';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = track.name || '';
    nameInput.maxLength = 120;
    nameInput.title = 'Track name';
    nameInput.className = 'track-renumber-name w-full px-2 py-1 text-xs rounded bg-gray-800 text-white border border-gray-600';

    const actions = document.createElement('div');
    actions.className = 'flex gap-1 justify-end';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.className = 'px-2 py-1 text-xs rounded bg-gray-700 text-gray-200';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Apply';
    save.className = 'px-2 py-1 text-xs rounded bg-cyan-600 text-white';
    actions.append(cancel, save);
    editor.append(positionInput, nameInput, actions);
    anchor.appendChild(editor);

    const submit = () => applyRenumber(track, positionInput, nameInput);
    cancel.addEventListener('click', closeEditor);
    save.addEventListener('click', submit);
    editor.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); submit(); }
        if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
    });
    activeEditor = { element: editor };
    nameInput.focus();
    nameInput.select();
}

function handleSelection(event) {
    const target = event.target;
    const element = target?.closest?.('[data-track-id]');
    if (!element || element.dataset.trackId === 'master') return;
    const track = getTracks().find(item => String(item?.id) === String(element.dataset.trackId));
    if (track) selectedTrackId = track.id;
}

function handleKeydown(event) {
    if (event.repeat || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== 'r' && event.key !== 'R') return;
    const target = event.target;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable) return;
    const track = getSelectedTrack();
    if (!track) {
        notify('Select a track first', 1500);
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditor(track);
}

export function initTrackRenumberHotkey(appServices) {
    localAppServices = appServices || {};
    if (initialized || typeof document === 'undefined') return;
    document.addEventListener('mousedown', handleSelection);
    document.addEventListener('keydown', handleKeydown, true);
    initialized = true;
    console.log('[TrackRenumberHotkey] Initialized - Shift+R renumbers the selected track');
}

export function isTrackRenumberHotkeyInitialized() {
    return initialized;
}

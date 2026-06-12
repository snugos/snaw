// js/QuickVolumeRamp.js - Quick Volume Ramp Panel
// Feature: Apply quick fade in / fade out / fade in-out volume automation
// to any track in just a couple of clicks.

let localAppServices = {};
let quickVolumeRampWindow = null;

function getCurrentTimeSeconds() {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            return Tone.Transport.seconds || 0;
        }
    } catch (e) { /* no-op */ }
    if (localAppServices.getCurrentTime) {
        try { return localAppServices.getCurrentTime() || 0; } catch (e) { /* no-op */ }
    }
    if (localAppServices.getCurrentTimelinePosition) {
        try { return localAppServices.getCurrentTimelinePosition() || 0; } catch (e) { /* no-op */ }
    }
    return 0;
}

export function initQuickVolumeRamp(services) {
    localAppServices = services || {};
    console.log('[QuickVolumeRamp] Initialized');
}

export function openQuickVolumeRampPanel(savedState = null) {
    const windowId = 'quickVolumeRamp';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const openWindows = getOpenWindows();

    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        if (win.restore) win.restore();
        renderQuickVolumeRampContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'quickVolumeRampContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200';

    const options = {
        width: 480,
        height: 360,
        minWidth: 380,
        minHeight: 280,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    if (savedState) {
        Object.assign(options, {
            x: parseInt(savedState.left, 10),
            y: parseInt(savedState.top, 10),
            width: parseInt(savedState.width, 10),
            height: parseInt(savedState.height, 10),
            zIndex: savedState.zIndex,
            isMinimized: savedState.isMinimized
        });
    }

    const win = localAppServices.createWindow?.(windowId, 'Quick Volume Ramp', contentContainer, options);
    if (win?.element) {
        renderQuickVolumeRampContent();
    }
    return win;
}

function renderQuickVolumeRampContent() {
    const container = document.getElementById('quickVolumeRampContent');
    if (!container) return;

    const tracks = (localAppServices.getTracksState
        ? localAppServices.getTracksState()
        : (localAppServices.getTracks ? localAppServices.getTracks() : [])
    ) || [];

    const playhead = getCurrentTimeSeconds();

    if (tracks.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <p class="text-sm">No tracks available.</p>
                <p class="text-xs mt-1">Add a track first, then open this panel to add a fade.</p>
            </div>
        `;
        return;
    }

    const trackOptions = tracks.map(t =>
        `<option value="${t.id}">${escapeHtml(t.name || ('Track ' + t.id))}</option>`
    ).join('');

    container.innerHTML = `
        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 text-xs text-gray-600 dark:text-gray-400">
            <strong class="text-gray-800 dark:text-gray-200">Quick Volume Ramp</strong> applies linear
            volume automation to the selected track. Use it to add quick fade-ins, fade-outs, or both.
            Playhead is currently at <span class="font-mono text-blue-600 dark:text-blue-400">${playhead.toFixed(2)}s</span>.
        </div>

        <div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Track</label>
            <select id="qvrTrackSelect" class="w-full p-1.5 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded">
                ${trackOptions}
            </select>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start (s)</label>
                <input id="qvrStartTime" type="number" min="0" step="0.1" value="${playhead.toFixed(2)}"
                    class="w-full p-1.5 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded font-mono">
            </div>
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End (s)</label>
                <input id="qvrEndTime" type="number" min="0" step="0.1" value="${(playhead + 4).toFixed(2)}"
                    class="w-full p-1.5 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded font-mono">
            </div>
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Volume (0-1)</label>
                <input id="qvrStartVol" type="number" min="0" max="1" step="0.01" value="0"
                    class="w-full p-1.5 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded font-mono">
            </div>
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Volume (0-1)</label>
                <input id="qvrEndVol" type="number" min="0" max="1" step="0.01" value="1"
                    class="w-full p-1.5 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded font-mono">
            </div>
        </div>

        <div class="flex flex-wrap gap-2 mb-3">
            <button id="qvrFadeInBtn" class="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">Fade In (0 → 1)</button>
            <button id="qvrFadeOutBtn" class="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600">Fade Out (1 → 0)</button>
            <button id="qvrFadeInOutBtn" class="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Fade In-Out (0 → 1 → 0)</button>
            <button id="qvrCustomRampBtn" class="px-3 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">Apply Custom Ramp</button>
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-slate-600">
            <button id="qvrClearVolBtn" class="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600">Clear Volume Automation</button>
            <span id="qvrStatus" class="text-xs text-gray-500 dark:text-gray-400"></span>
        </div>
    `;

    wireQuickVolumeRampEvents(container, tracks);
}

function wireQuickVolumeRampEvents(container, tracks) {
    const trackSelect = container.querySelector('#qvrTrackSelect');
    const startTimeEl = container.querySelector('#qvrStartTime');
    const endTimeEl = container.querySelector('#qvrEndTime');
    const startVolEl = container.querySelector('#qvrStartVol');
    const endVolEl = container.querySelector('#qvrEndVol');
    const statusEl = container.querySelector('#qvrStatus');

    const findTrack = (id) => {
        const tid = parseInt(id, 10);
        return tracks.find(t => t.id === tid);
    };

    const getValues = () => {
        const trackId = parseInt(trackSelect.value, 10);
        const startTime = Math.max(0, parseFloat(startTimeEl.value) || 0);
        const endTime = Math.max(startTime + 0.01, parseFloat(endTimeEl.value) || (startTime + 1));
        const startVol = Math.max(0, Math.min(1, parseFloat(startVolEl.value) || 0));
        const endVol = Math.max(0, Math.min(1, parseFloat(endVolEl.value) || 0));
        return { trackId, track: findTrack(trackId), startTime, endTime, startVol, endVol };
    };

    const applyPoints = (points) => {
        const { track } = getValues();
        if (!track || typeof track.addAutomationPoint !== 'function') {
            setStatus('Track not found or automation not supported', true);
            return false;
        }
        for (const p of points) {
            track.addAutomationPoint('volume', p.time, p.value, p.curveType || 'linear');
        }
        setStatus(`Added ${points.length} point(s) to ${track.name}`, false);
        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        return true;
    };

    const setStatus = (msg, isError) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.className = `text-xs ${isError ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`;
        setTimeout(() => {
            if (statusEl.textContent === msg) {
                statusEl.textContent = '';
                statusEl.className = 'text-xs text-gray-500 dark:text-gray-400';
            }
        }, 2500);
    };

    container.querySelector('#qvrFadeInBtn')?.addEventListener('click', () => {
        const v = getValues();
        // If start vol not set, use 0
        startVolEl.value = 0;
        endVolEl.value = 1;
        applyPoints([
            { time: v.startTime, value: 0, curveType: 'linear' },
            { time: v.endTime, value: 1, curveType: 'linear' }
        ]);
    });

    container.querySelector('#qvrFadeOutBtn')?.addEventListener('click', () => {
        const v = getValues();
        startVolEl.value = 1;
        endVolEl.value = 0;
        applyPoints([
            { time: v.startTime, value: 1, curveType: 'linear' },
            { time: v.endTime, value: 0, curveType: 'linear' }
        ]);
    });

    container.querySelector('#qvrFadeInOutBtn')?.addEventListener('click', () => {
        const v = getValues();
        const mid = v.startTime + (v.endTime - v.startTime) / 2;
        startVolEl.value = 0;
        endVolEl.value = 0;
        applyPoints([
            { time: v.startTime, value: 0, curveType: 'linear' },
            { time: mid, value: 1, curveType: 'linear' },
            { time: v.endTime, value: 0, curveType: 'linear' }
        ]);
    });

    container.querySelector('#qvrCustomRampBtn')?.addEventListener('click', () => {
        const v = getValues();
        applyPoints([
            { time: v.startTime, value: v.startVol, curveType: 'linear' },
            { time: v.endTime, value: v.endVol, curveType: 'linear' }
        ]);
    });

    container.querySelector('#qvrClearVolBtn')?.addEventListener('click', () => {
        const { track } = getValues();
        if (!track) {
            setStatus('Track not found', true);
            return;
        }
        if (track.automation) {
            const had = (track.automation.volume || []).length;
            track.automation.volume = [];
            setStatus(`Cleared ${had} volume point(s) from ${track.name}`, false);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        } else {
            setStatus('No automation to clear', true);
        }
    });
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export function toggleQuickVolumeRampPanel() {
    if (quickVolumeRampWindow && quickVolumeRampWindow.element && !quickVolumeRampWindow.isMinimized) {
        quickVolumeRampWindow.close?.();
        quickVolumeRampWindow = null;
        return;
    }
    quickVolumeRampWindow = openQuickVolumeRampPanel();
}

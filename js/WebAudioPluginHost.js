// js/WebAudioPluginHost.js - WebAudio Plugin Host for SnugOS DAW
// Feature: VST-style plugin support via AudioWorklet. Lets the user load a
// remote AudioWorkletProcessor module by URL, instantiate an AudioWorkletNode,
// and insert it into a track's effect chain. Supports bypass, remove, and
// bidirectional parameter automation via the worklet's AudioParam set + port
// postMessage protocol.

let localAppServices = {};

// Module-level cache of worklet URLs already registered with audioWorklet.addModule().
// Map<url, true> prevents re-registering the same module across tracks.
const _loadedWorkletUrls = new Map();

// In-memory catalog of plugin instances keyed by pluginId.
// Map<pluginId, { workletNode, workletUrl, processorName, params, bypassed, trackId, messageLog }>
const _loadedPlugins = new Map();

// WINDOW_ID used by the panel.
const WINDOW_ID = 'webAudioPluginHost';
const PANEL_CONTENT_ID = 'webAudioPluginHostContent';

let isPanelOpen = false;

// -------------------------------------------------------------
// Worklet loading
// -------------------------------------------------------------

/**
 * Resolve a usable AudioContext + audioWorklet from Tone.js.
 * @returns {{rawContext: AudioContext|null, audioWorklet: BaseAudioContext.audioWorklet|null}}
 */
function _resolveContext() {
    try {
        if (typeof Tone === 'undefined' || !Tone.context) {
            return { rawContext: null, audioWorklet: null };
        }
        const raw = Tone.context.rawContext || Tone.context;
        const aw = raw && raw.audioWorklet ? raw.audioWorklet : null;
        return { rawContext: raw, audioWorklet: aw };
    } catch (e) {
        console.warn('[WebAudioPluginHost] Failed to resolve audio context:', e);
        return { rawContext: null, audioWorklet: null };
    }
}

/**
 * Load (or return cached) worklet module via audioWorklet.addModule().
 * @param {string} url
 * @returns {Promise<boolean>} true on success.
 */
async function _ensureWorkletLoaded(url) {
    if (!url) return false;
    if (_loadedWorkletUrls.has(url)) return true;
    const { audioWorklet } = _resolveContext();
    if (!audioWorklet) {
        console.error('[WebAudioPluginHost] audioWorklet API not available on context');
        return false;
    }
    try {
        await audioWorklet.addModule(url);
        _loadedWorkletUrls.set(url, true);
        console.log(`[WebAudioPluginHost] Registered worklet module: ${url}`);
        return true;
    } catch (err) {
        console.error(`[WebAudioPluginHost] Failed to addModule(${url}):`, err);
        return false;
    }
}

/**
 * Discover the AudioParam names exposed by a worklet node (for the parameter
 * automation UI). AudioWorkletNode exposes a Map of name -> AudioParam on
 * `.parameters`. We snapshot the keys once, since parameter names are static
 * for a given processor.
 */
function _discoverParamDescriptors(workletNode) {
    const params = [];
    try {
        if (!workletNode || !workletNode.parameters) return params;
        workletNode.parameters.forEach((audioParam, name) => {
            if (!audioParam) return;
            params.push({
                id: name,
                label: name,
                min: typeof audioParam.minValue === 'number' ? audioParam.minValue : 0,
                max: typeof audioParam.maxValue === 'number' ? audioParam.maxValue : 1,
                defaultValue: typeof audioParam.defaultValue === 'number' ? audioParam.defaultValue : audioParam.value,
                value: audioParam.value
            });
        });
    } catch (e) {
        console.warn('[WebAudioPluginHost] Could not enumerate AudioParams:', e);
    }
    return params;
}

/**
 * Load a plugin into the given track.
 * @param {number|string} trackId - Target track ID.
 * @param {string} workletUrl - URL of an AudioWorkletProcessor module.
 * @param {string} processorName - The processor's `registerProcessor` name.
 * @returns {Promise<string|null>} The plugin ID, or null on failure.
 */
export async function loadWorkletPlugin(trackId, workletUrl, processorName) {
    if (!trackId) {
        console.warn('[WebAudioPluginHost] loadWorkletPlugin called without trackId');
        return null;
    }
    if (!workletUrl || !processorName) {
        console.warn('[WebAudioPluginHost] loadWorkletPlugin called without workletUrl/processorName');
        return null;
    }

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.warn(`[WebAudioPluginHost] Track ${trackId} not found`);
        if (localAppServices.showNotification) localAppServices.showNotification(`Track ${trackId} not found`, 2500);
        return null;
    }

    const loaded = await _ensureWorkletLoaded(workletUrl);
    if (!loaded) {
        if (localAppServices.showNotification) localAppServices.showNotification('Failed to load worklet module (see console)', 3500);
        return null;
    }

    const { rawContext } = _resolveContext();
    if (!rawContext) {
        if (localAppServices.showNotification) localAppServices.showNotification('Audio context unavailable', 2500);
        return null;
    }

    let workletNode;
    try {
        workletNode = new AudioWorkletNode(rawContext, processorName, {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });
    } catch (err) {
        console.error(`[WebAudioPluginHost] Failed to construct AudioWorkletNode(${processorName}):`, err);
        if (localAppServices.showNotification) localAppServices.showNotification(`Failed to instantiate ${processorName}`, 3500);
        return null;
    }

    const pluginId = `wp-${trackId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const params = _discoverParamDescriptors(workletNode);

    const entry = {
        id: pluginId,
        workletNode,
        workletUrl,
        processorName,
        params,
        bypassed: false,
        trackId,
        bypassGain: null,
        messageLog: [],
        // The "toneNode" the Track's existing effect-chain machinery expects.
        toneNode: workletNode,
        type: 'WorkletPlugin'
    };

    // Wire message handling (latency, parameter, error messages).
    if (workletNode.port && typeof workletNode.port.onmessage === 'function') {
        workletNode.port.onmessage = (event) => {
            try {
                const data = event.data || {};
                if (data.type === 'latency') {
                    entry.latency = data.value;
                } else if (data.type === 'parameter' && data.paramId) {
                    const p = entry.params.find(x => x.id === data.paramId);
                    if (p) p.value = data.value;
                } else if (data.type === 'error') {
                    console.error(`[WebAudioPluginHost] Worklet error from ${processorName}:`, data.message);
                    entry.messageLog.push({ ts: Date.now(), message: data.message });
                } else {
                    entry.messageLog.push({ ts: Date.now(), message: JSON.stringify(data).slice(0, 200) });
                }
            } catch (e) {
                console.warn('[WebAudioPluginHost] Failed to handle worklet message:', e);
            }
        };
    }

    // Send a friendly "init" message so processors can announce themselves.
    try { workletNode.port.postMessage({ type: 'init', pluginId }); } catch (e) { /* not all processors speak the protocol */ }

    // For bypass: insert as the LAST node in activeEffects, but route through a passthrough
    // gain node that we can zero when bypassed. The cleanest approach is to just zero
    // the worklet's output with a manual connect->gain->disconnect when bypassing, but
    // simpler is: track.bypass flag flips a gain to 0/1. We use the param automation
    // approach for processors that expose a `bypass` AudioParam, else we disconnect.
    entry._applyBypass = function (bypassed) {
        try {
            // Try the "bypass" AudioParam first (if the processor provides one).
            if (workletNode.parameters && workletNode.parameters.get('bypass')) {
                const p = workletNode.parameters.get('bypass');
                p.setValueAtTime(bypassed ? 1 : 0, rawContext.currentTime);
                return;
            }
            // Otherwise, send a port message.
            workletNode.port.postMessage({ type: 'bypass', value: bypassed ? 1 : 0 });
        } catch (e) {
            console.warn('[WebAudioPluginHost] _applyBypass failed:', e);
        }
    };

    _loadedPlugins.set(pluginId, entry);

    // Push into the track's activeEffects so rebuildEffectChain wires it.
    if (Array.isArray(track.activeEffects)) {
        track.activeEffects.push({
            id: pluginId,
            type: 'WorkletPlugin',
            toneNode: workletNode,
            params: {},
            _isWorklet: true,
            _workletEntry: entry
        });
        if (typeof track.rebuildEffectChain === 'function') {
            try { track.rebuildEffectChain(); } catch (e) { console.error('[WebAudioPluginHost] rebuildEffectChain failed:', e); }
        }
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'effectsListChanged');
    }

    if (localAppServices.showNotification) localAppServices.showNotification(`Loaded ${processorName} on ${track.name || ('Track ' + trackId)}`, 2500);
    return pluginId;
}

/**
 * Remove a worklet plugin from its track and dispose of it.
 * @param {string} pluginId
 * @returns {boolean}
 */
export function removeWorkletPlugin(pluginId) {
    const entry = _loadedPlugins.get(pluginId);
    if (!entry) return false;
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(entry.trackId) : null;

    if (track && Array.isArray(track.activeEffects)) {
        const idx = track.activeEffects.findIndex(e => e.id === pluginId);
        if (idx > -1) {
            track.activeEffects.splice(idx, 1);
            if (typeof track.rebuildEffectChain === 'function') {
                try { track.rebuildEffectChain(); } catch (e) { console.warn('[WebAudioPluginHost] rebuild on remove failed:', e); }
            }
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(entry.trackId, 'effectsListChanged');
        }
    }

    try {
        if (entry.workletNode) {
            try { entry.workletNode.port.postMessage({ type: 'dispose' }); } catch (e) { /* noop */ }
            try { entry.workletNode.disconnect(); } catch (e) { /* noop */ }
        }
    } catch (e) {
        console.warn('[WebAudioPluginHost] Dispose error:', e);
    }

    _loadedPlugins.delete(pluginId);
    if (localAppServices.showNotification) localAppServices.showNotification(`Removed plugin ${entry.processorName}`, 2000);
    return true;
}

/**
 * Toggle bypass on/off.
 * @param {string} pluginId
 * @param {boolean} [bypassed] - if undefined, toggles
 * @returns {boolean|null} new bypass state, or null on failure
 */
export function bypassWorkletPlugin(pluginId, bypassed) {
    const entry = _loadedPlugins.get(pluginId);
    if (!entry) return null;
    const next = typeof bypassed === 'boolean' ? bypassed : !entry.bypassed;
    entry.bypassed = next;
    if (typeof entry._applyBypass === 'function') entry._applyBypass(next);
    return next;
}

/**
 * Set an AudioParam value on a worklet plugin by parameter name.
 * @param {string} pluginId
 * @param {string} paramId
 * @param {number} value
 * @returns {boolean}
 */
export function setWorkletParam(pluginId, paramId, value) {
    const entry = _loadedPlugins.get(pluginId);
    if (!entry || !entry.workletNode) return false;
    try {
        if (entry.workletNode.parameters && entry.workletNode.parameters.get(paramId)) {
            const ap = entry.workletNode.parameters.get(paramId);
            ap.setValueAtTime(Number(value), entry.workletNode.context?.currentTime || 0);
            const p = entry.params.find(x => x.id === paramId);
            if (p) p.value = Number(value);
            return true;
        }
        // Fallback: port message
        entry.workletNode.port.postMessage({ type: 'parameter', paramId, value: Number(value) });
        return true;
    } catch (e) {
        console.warn('[WebAudioPluginHost] setWorkletParam failed:', e);
        return false;
    }
}

/**
 * Return a snapshot of the loaded plugin registry for the UI.
 */
export function getLoadedWorkletPlugins() {
    return Array.from(_loadedPlugins.values()).map(e => ({
        id: e.id,
        trackId: e.trackId,
        workletUrl: e.workletUrl,
        processorName: e.processorName,
        bypassed: e.bypassed,
        params: e.params.slice(),
        messageCount: e.messageLog.length
    }));
}

export function isWorkletPluginLoaded(pluginId) {
    return _loadedPlugins.has(pluginId);
}

// -------------------------------------------------------------
// Init
// -------------------------------------------------------------

export function initWebAudioPluginHost(services) {
    localAppServices = services || {};
    console.log('[WebAudioPluginHost] Initialized');
}

// -------------------------------------------------------------
// Panel UI
// -------------------------------------------------------------

const PRESET_WORKLETS = [
    {
        label: '— Built-in examples —',
        url: '',
        processor: ''
    }
];

export function openWebAudioPluginHostPanel() {
    if (isPanelOpen && localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(WINDOW_ID)) {
            const win = openWindows.get(WINDOW_ID);
            if (win && typeof win.restore === 'function') win.restore();
            renderPanelContent();
            return win;
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = PANEL_CONTENT_ID;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white overflow-y-auto';

    const options = {
        width: 480,
        height: 540,
        minWidth: 360,
        minHeight: 380,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(WINDOW_ID, 'WebAudio Plugin Host', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

export function isWebAudioPluginHostPanelOpen() {
    return isPanelOpen;
}

function _trackOptions() {
    const tracks = (localAppServices.getTracksState?.() || []).filter(Boolean);
    if (tracks.length === 0) return '<option value="">(no tracks yet — create one first)</option>';
    return tracks.map(t => `<option value="${t.id}">${(t.name || ('Track ' + t.id))} [${t.type || '?'}]</option>`).join('');
}

function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;
    const presetsHtml = PRESET_WORKLETS.map(p => `<option value="${p.url}|${p.processor}">${p.label}</option>`).join('');
    const pluginListHtml = renderPluginList();

    container.innerHTML = `
        <div class="mb-3 text-sm text-gray-300">
            Load AudioWorklet processors by URL and insert them into a track's effect chain. The worklet must register its processor with the name you supply. The host passes parameter updates through AudioParam.setValueAtTime and ports.
        </div>

        <label class="block text-xs text-gray-400 mb-1" for="wpTrackSelect">Target Track</label>
        <select id="wpTrackSelect" class="w-full mb-3 px-2 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm">
            ${_trackOptions()}
        </select>

        <label class="block text-xs text-gray-400 mb-1" for="wpPreset">Preset Worklet</label>
        <select id="wpPreset" class="w-full mb-3 px-2 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm">
            ${presetsHtml}
        </select>

        <label class="block text-xs text-gray-400 mb-1" for="wpUrl">Worklet URL (.js module)</label>
        <input id="wpUrl" type="text" placeholder="https://example.com/processor.js" class="w-full mb-3 px-2 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm font-mono" />

        <label class="block text-xs text-gray-400 mb-1" for="wpProcessor">Processor Name (registerProcessor)</label>
        <input id="wpProcessor" type="text" placeholder="my-processor" class="w-full mb-3 px-2 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm font-mono" />

        <div class="flex items-center gap-3 mb-4">
            <button id="wpLoadBtn" class="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold">Load Plugin</button>
            <button id="wpRefreshBtn" class="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">Refresh</button>
        </div>

        <div class="text-xs uppercase tracking-wide text-gray-400 mb-2">Loaded Plugins</div>
        <div id="wpPluginList" class="flex-1 min-h-0 overflow-y-auto bg-gray-800 border border-gray-700 rounded p-2 space-y-2">
            ${pluginListHtml}
        </div>
    `;

    const trackSelect = container.querySelector('#wpTrackSelect');
    const presetSelect = container.querySelector('#wpPreset');
    const urlInput = container.querySelector('#wpUrl');
    const procInput = container.querySelector('#wpProcessor');
    const loadBtn = container.querySelector('#wpLoadBtn');
    const refreshBtn = container.querySelector('#wpRefreshBtn');
    const listDiv = container.querySelector('#wpPluginList');

    presetSelect.addEventListener('change', () => {
        const v = presetSelect.value;
        if (!v) return;
        const [url, processor] = v.split('|');
        if (url) urlInput.value = url;
        if (processor) procInput.value = processor;
    });

    loadBtn.addEventListener('click', async () => {
        const trackId = parseInt(trackSelect.value, 10);
        const url = urlInput.value.trim();
        const processor = procInput.value.trim();
        if (!trackId || !url || !processor) {
            if (localAppServices.showNotification) localAppServices.showNotification('Track, URL and processor name are all required', 2500);
            return;
        }
        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading…';
        const id = await loadWorkletPlugin(trackId, url, processor);
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load Plugin';
        if (id) renderPluginListInto(listDiv);
    });

    refreshBtn.addEventListener('click', () => renderPluginListInto(listDiv));

    renderPluginListInto(listDiv);
}

function renderPluginList() {
    const plugins = getLoadedWorkletPlugins();
    if (plugins.length === 0) {
        return '<div class="text-sm text-gray-400 italic p-2">No worklet plugins loaded yet.</div>';
    }
    return plugins.map(p => pluginCardHtml(p)).join('');
}

function pluginCardHtml(p) {
    const paramsHtml = p.params.length === 0
        ? '<div class="text-xs text-gray-500 italic">No AudioParams exposed by this worklet.</div>'
        : p.params.map(param => `
            <div class="flex items-center gap-2 mb-1">
                <label class="text-xs text-gray-300 w-24 truncate font-mono" title="${param.id}">${param.label}</label>
                <input type="range" min="${param.min}" max="${param.max}" step="0.001" value="${param.value}" data-plugin-id="${p.id}" data-param-id="${param.id}" class="wpParamRange flex-1" />
                <input type="number" step="0.001" value="${param.value}" data-plugin-id="${p.id}" data-param-id="${param.id}" class="wpParamNum w-20 px-1 py-0.5 rounded bg-gray-900 border border-gray-700 text-white text-xs font-mono" />
            </div>
        `).join('');
    const trackName = (() => {
        const t = localAppServices.getTrackById ? localAppServices.getTrackById(p.trackId) : null;
        return t ? (t.name || ('Track ' + p.trackId)) : ('Track ' + p.trackId);
    })();
    const bypassLabel = p.bypassed ? 'Bypassed' : 'Active';
    const bypassClass = p.bypassed ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-emerald-600 hover:bg-emerald-500';

    return `
        <div class="bg-gray-900 border border-gray-700 rounded p-3" data-plugin-id="${p.id}">
            <div class="flex items-start justify-between gap-2 mb-1">
                <div>
                    <div class="text-sm font-semibold text-white">${escapeHtml(p.processorName)}</div>
                    <div class="text-xs text-gray-400">on <span class="text-amber-400">${escapeHtml(trackName)}</span></div>
                    <div class="text-xs text-gray-500 font-mono truncate" title="${escapeHtml(p.workletUrl)}">${escapeHtml(p.workletUrl)}</div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button class="wpBypassBtn px-2 py-1 rounded text-xs text-white ${bypassClass}" data-plugin-id="${p.id}">${bypassLabel}</button>
                    <button class="wpRemoveBtn px-2 py-1 rounded text-xs text-white bg-red-700 hover:bg-red-600" data-plugin-id="${p.id}">Remove</button>
                </div>
            </div>
            <div class="mt-2">
                ${paramsHtml}
            </div>
        </div>
    `;
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderPluginListInto(container) {
    if (!container) return;
    container.innerHTML = renderPluginList();
    container.querySelectorAll('.wpBypassBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.pluginId;
            bypassWorkletPlugin(id);
            renderPluginListInto(container);
        });
    });
    container.querySelectorAll('.wpRemoveBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.pluginId;
            removeWorkletPlugin(id);
            renderPluginListInto(container);
        });
    });
    container.querySelectorAll('.wpParamRange, .wpParamNum').forEach(input => {
        input.addEventListener('input', () => {
            const id = input.dataset.pluginId;
            const pid = input.dataset.paramId;
            const value = parseFloat(input.value);
            setWorkletParam(id, pid, value);
            // Keep the paired input in sync
            const paired = container.querySelectorAll(`input[data-plugin-id="${id}"][data-param-id="${pid}"]`);
            paired.forEach(el => { if (el !== input) el.value = value; });
        });
    });
}
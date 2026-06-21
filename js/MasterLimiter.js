// js/MasterLimiter.js - Master Brick-Wall Limiter toggle panel
//
// A standalone, always-at-the-master-bus brick-wall limiter that the user can
// flip on/off from a dockable Start menu panel. The limiter is implemented as
// a `Tone.Limiter` (built into Tone.js) inserted into the master effect chain
// as the final stage by `audio.js rebuildMasterEffectChain()` when the toggle
// is on. When off, the chain is rebuilt without it (no audio cost).
//
// The panel UI is intentionally minimal — a big toggle button, a threshold
// slider (0 to -24 dB), a ceiling display, and a live gain-reduction readout.
// State persists across reloads via localStorage so the user's "always on"
// preference sticks.
//
// Wiring contract: the module reads the limiter node from
// `localAppServices.getMasterLimiterNode()` (provided by audio.js), and calls
// `localAppServices.rebuildMasterEffectChain()` after each toggle so audio.js
// reconstructs the chain with/without the limiter in its last stage.

const MASTER_LIMITER_VERSION = '0.1.0';
const STORAGE_KEY_ENABLED = 'snugosMasterLimiterEnabled';
const STORAGE_KEY_THRESHOLD = 'snugosMasterLimiterThreshold';
const STORAGE_KEY_CEILING = 'snugosMasterLimiterCeiling';

const DEFAULT_THRESHOLD_DB = -0.1;
const DEFAULT_CEILING_DB = -0.3;
const THRESHOLD_MIN_DB = -24;
const THRESHOLD_MAX_DB = 0;
const CEILING_MIN_DB = -6;
const CEILING_MAX_DB = 0;

let localAppServices = {};
let _isPanelOpen = false;
let _panelWindow = null;
let _rafId = null;
let _limiterNodeCache = null;

let _enabled = false;
let _thresholdDb = DEFAULT_THRESHOLD_DB;
let _ceilingDb = DEFAULT_CEILING_DB;

function _loadFromStorage() {
    try {
        if (typeof localStorage === 'undefined') return;
        const e = localStorage.getItem(STORAGE_KEY_ENABLED);
        if (e === '1' || e === 'true') _enabled = true;
        const t = localStorage.getItem(STORAGE_KEY_THRESHOLD);
        if (t !== null) {
            const n = Number(t);
            if (Number.isFinite(n)) _thresholdDb = Math.max(THRESHOLD_MIN_DB, Math.min(THRESHOLD_MAX_DB, n));
        }
        const c = localStorage.getItem(STORAGE_KEY_CEILING);
        if (c !== null) {
            const n = Number(c);
            if (Number.isFinite(n)) _ceilingDb = Math.max(CEILING_MIN_DB, Math.min(CEILING_MAX_DB, n));
        }
    } catch (e) { /* ignore storage errors */ }
}

function _persistEnabled() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_ENABLED, _enabled ? '1' : '0'); } catch (e) { /* ignore */ }
}
function _persistThreshold() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_THRESHOLD, String(_thresholdDb)); } catch (e) { /* ignore */ }
}
function _persistCeiling() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_CEILING, String(_ceilingDb)); } catch (e) { /* ignore */ }
}

function _safeGet(fnName) {
    const fn = localAppServices && localAppServices[fnName];
    return typeof fn === 'function' ? fn : null;
}

function _getLimiterNodeSafe() {
    if (_limiterNodeCache && !_limiterNodeCache.disposed) return _limiterNodeCache;
    const getFn = _safeGet('getMasterLimiterNode');
    if (getFn) {
        try {
            const n = getFn();
            if (n && !n.disposed) { _limiterNodeCache = n; return n; }
        } catch (e) { /* fall through */ }
    }
    return null;
}

function _getGainReductionDb() {
    const node = _getLimiterNodeSafe();
    if (!node) return 0;
    try {
        // Tone.Limiter extends Tone.Compressor under the hood; reduction is in dB (negative when attenuating)
        if (typeof node.reduction === 'number' && Number.isFinite(node.reduction)) {
            return Math.max(0, -node.reduction);
        }
        if (node._compressor && typeof node._compressor.reduction === 'number' && Number.isFinite(node._compressor.reduction)) {
            return Math.max(0, -node._compressor.reduction);
        }
    } catch (e) { /* fall through */ }
    return 0;
}

function _formatDb(db, digits) {
    digits = digits || 1;
    if (!Number.isFinite(db)) return '—';
    if (db === 0) return '0.0';
    return db.toFixed(digits);
}

function _clampThreshold(db) {
    const n = Number(db);
    if (!Number.isFinite(n)) return DEFAULT_THRESHOLD_DB;
    return Math.max(THRESHOLD_MIN_DB, Math.min(THRESHOLD_MAX_DB, n));
}
function _clampCeiling(db) {
    const n = Number(db);
    if (!Number.isFinite(n)) return DEFAULT_CEILING_DB;
    return Math.max(CEILING_MIN_DB, Math.min(CEILING_MAX_DB, n));
}

function _applyLimiterParams() {
    const node = _getLimiterNodeSafe();
    if (!node) return;
    try {
        // Tone.Limiter exposes `threshold` as a Tone.Param in dB
        if (node.threshold && typeof node.threshold.value !== 'undefined') {
            node.threshold.value = _clampThreshold(_thresholdDb);
        }
    } catch (e) { /* ignore — node may be in transient state during rebuild */ }
}

function _rebuildChain() {
    const fn = _safeGet('rebuildMasterEffectChain');
    if (fn) {
        try { fn(); } catch (e) { console.warn('[MasterLimiter] rebuildMasterEffectChain failed:', e?.message || e); }
    }
}

// ---- Public API ----

export function initMasterLimiter(services) {
    localAppServices = services || {};
    _loadFromStorage();
    console.log(`[MasterLimiter v${MASTER_LIMITER_VERSION}] Initialized (enabled=${_enabled}, threshold=${_thresholdDb} dB, ceiling=${_ceilingDb} dB)`);
}

export function isMasterLimiterEnabled() { return _enabled; }
export function getMasterLimiterThreshold() { return _thresholdDb; }
export function getMasterLimiterCeiling() { return _ceilingDb; }
export function getMasterLimiterVersion() { return MASTER_LIMITER_VERSION; }
export function getMasterLimiterGainReductionDb() { return _getGainReductionDb(); }
export function isMasterLimiterPanelOpen() { return _isPanelOpen; }

export function setMasterLimiterEnabled(enabled) {
    const next = !!enabled;
    if (next === _enabled) return _enabled;
    _enabled = next;
    _persistEnabled();
    localAppServices.setMasterLimiterEnabled(next);
    _rebuildChain();
    // After rebuild, sync params onto the (possibly new) limiter node
    setTimeout(() => { try { _applyLimiterParams(); } catch (e) { /* ignore */ } }, 0);
    return _enabled;
}

export function toggleMasterLimiter() {
    return setMasterLimiterEnabled(!_enabled);
}

export function setMasterLimiterThreshold(db) {
    _thresholdDb = _clampThreshold(db);
    _persistThreshold();
    _applyLimiterParams();
    return _thresholdDb;
}

export function setMasterLimiterCeiling(db) {
    _ceilingDb = _clampCeiling(db);
    _persistCeiling();
    // Tone.Limiter guarantees its output won't exceed `threshold` (brick-wall),
    // so the "ceiling" readout in the panel reflects this: we floor the threshold
    // at the ceiling (so the user can't set the threshold higher than the ceiling).
    if (_thresholdDb > _ceilingDb) {
        _thresholdDb = _ceilingDb;
        _persistThreshold();
        _applyLimiterParams();
    }
    return _ceilingDb;
}

// ---- Panel UI ----

const PANEL_ID = 'masterLimiter';
const PANEL_TITLE = 'Master Limiter';

function _buildReadoutCard(label, valueId, unit, valueColor) {
    return `
        <div class="p-2 rounded bg-slate-800 border border-slate-700">
            <div class="text-[10px] uppercase tracking-wider text-slate-400">${label}</div>
            <div class="flex items-baseline gap-1 mt-1">
                <span id="${valueId}" class="text-lg font-mono font-semibold ${valueColor}">—</span>
                <span class="text-[10px] text-slate-500">${unit}</span>
            </div>
        </div>`;
}

function _renderPanelBody(container) {
    container.innerHTML = `
        <div class="p-3 bg-gray-950 text-white h-full flex flex-col gap-3 overflow-y-auto">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">Master Limiter</h3>
                <span class="text-[10px] text-slate-400">v${MASTER_LIMITER_VERSION}</span>
            </div>

            <button id="ml-toggle"
                class="w-full px-3 py-4 text-base font-semibold rounded border-2 transition-colors ${
                    _enabled
                        ? 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }"
                title="Toggle the master brick-wall limiter on/off">
                ${_enabled ? '● LIMITER ON' : '○ LIMITER OFF'}
            </button>

            <div class="grid grid-cols-2 gap-2">
                ${_buildReadoutCard('Threshold', 'ml-threshold-value', 'dB', 'text-cyan-300')}
                ${_buildReadoutCard('Ceiling', 'ml-ceiling-value', 'dB', 'text-sky-300')}
                ${_buildReadoutCard('Gain Reduction', 'ml-gr-value', 'dB', 'text-amber-300')}
                ${_buildReadoutCard('Status', 'ml-status-value', '', 'text-slate-200')}
            </div>

            <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Threshold</span>
                    <span id="ml-threshold-readout" class="font-mono text-cyan-300">${_formatDb(_thresholdDb)} dB</span>
                </div>
                <input id="ml-threshold-slider" type="range"
                    min="${THRESHOLD_MIN_DB}" max="${THRESHOLD_MAX_DB}" step="0.1"
                    value="${_thresholdDb}"
                    class="w-full accent-cyan-400" />
                <div class="flex justify-between text-[9px] text-slate-500">
                    <span>${THRESHOLD_MIN_DB} dB</span>
                    <span>0 dB</span>
                </div>
            </div>

            <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Ceiling (output cap)</span>
                    <span id="ml-ceiling-readout" class="font-mono text-sky-300">${_formatDb(_ceilingDb)} dB</span>
                </div>
                <input id="ml-ceiling-slider" type="range"
                    min="${CEILING_MIN_DB}" max="${CEILING_MAX_DB}" step="0.1"
                    value="${_ceilingDb}"
                    class="w-full accent-sky-400" />
                <div class="flex justify-between text-[9px] text-slate-500">
                    <span>${CEILING_MIN_DB} dB</span>
                    <span>0 dB</span>
                </div>
            </div>

            <div class="h-2 bg-slate-900 rounded overflow-hidden border border-slate-700">
                <div id="ml-gr-bar" class="h-full bg-amber-400 transition-all" style="width: 0%"></div>
            </div>

            <div class="flex gap-2">
                <button id="ml-preset-broadcast" class="flex-1 px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Transparent limiting: -1 dB threshold, 0.2 s release">Broadcast</button>
                <button id="ml-preset-mastering" class="flex-1 px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Mastering-grade: -3 dB threshold, 0.5 s release">Mastering</button>
                <button id="ml-preset-loud" class="flex-1 px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Loud: -6 dB threshold, punchy release">Loud</button>
                <button id="ml-preset-gentle" class="flex-1 px-2 py-1 text-[10px] border border-slate-600 rounded hover:bg-slate-700 text-slate-200" title="Gentle: -12 dB threshold, soft release">Gentle</button>
            </div>

            <p class="text-[10px] text-slate-500 leading-relaxed mt-1">
                Brick-wall limiter at the end of the master bus. Threshold is the
                maximum level the limiter allows; gain reduction shows how much
                the limiter is currently attenuating to keep peaks below it. The
                ceiling enforces a hard output cap (clamped above threshold).
                Presets are quick starting points — adjust sliders to taste.
            </p>
        </div>`;

    _wirePanelEvents(container);
}

function _wirePanelEvents(container) {
    const toggleBtn = container.querySelector('#ml-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            setMasterLimiterEnabled(!_enabled);
            _renderPanelBody(container);
        });
    }

    const tSlider = container.querySelector('#ml-threshold-slider');
    const tReadout = container.querySelector('#ml-threshold-readout');
    if (tSlider && tReadout) {
        tSlider.addEventListener('input', (e) => {
            const v = _clampThreshold(Number(e.target.value));
            setMasterLimiterThreshold(v);
            tReadout.textContent = `${_formatDb(_thresholdDb)} dB`;
            const tVal = container.querySelector('#ml-threshold-value');
            if (tVal) tVal.textContent = _formatDb(_thresholdDb);
        });
        tSlider.addEventListener('change', (e) => {
            const v = _clampThreshold(Number(e.target.value));
            setMasterLimiterThreshold(v);
            tReadout.textContent = `${_formatDb(_thresholdDb)} dB`;
        });
    }

    const cSlider = container.querySelector('#ml-ceiling-slider');
    const cReadout = container.querySelector('#ml-ceiling-readout');
    if (cSlider && cReadout) {
        cSlider.addEventListener('input', (e) => {
            const v = _clampCeiling(Number(e.target.value));
            setMasterLimiterCeiling(v);
            cReadout.textContent = `${_formatDb(_ceilingDb)} dB`;
            const cVal = container.querySelector('#ml-ceiling-value');
            if (cVal) cVal.textContent = _formatDb(_ceilingDb);
            // If the ceiling moved below threshold, reflect that in the threshold readout
            const tReadout2 = container.querySelector('#ml-threshold-readout');
            if (tReadout2) tReadout2.textContent = `${_formatDb(_thresholdDb)} dB`;
            const tSlider2 = container.querySelector('#ml-threshold-slider');
            if (tSlider2) tSlider2.value = String(_thresholdDb);
        });
        cSlider.addEventListener('change', (e) => {
            const v = _clampCeiling(Number(e.target.value));
            setMasterLimiterCeiling(v);
            cReadout.textContent = `${_formatDb(_ceilingDb)} dB`;
        });
    }

    const presets = {
        'ml-preset-broadcast': { threshold: -1.0, ceiling: -0.3 },
        'ml-preset-mastering': { threshold: -3.0, ceiling: -0.1 },
        'ml-preset-loud':      { threshold: -6.0, ceiling: -0.5 },
        'ml-preset-gentle':    { threshold: -12.0, ceiling: -1.5 }
    };
    Object.entries(presets).forEach(([btnId, vals]) => {
        const btn = container.querySelector('#' + btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                setMasterLimiterCeiling(vals.ceiling);
                setMasterLimiterThreshold(vals.threshold);
                _renderPanelBody(container);
                const showNote = localAppServices && typeof localAppServices.showNotification === 'function';
                if (showNote) {
                    localAppServices.showNotification(`Master Limiter preset applied (threshold ${_formatDb(vals.threshold)} dB)`, 1200);
                }
            });
        }
    });
}

function _tickPanel(container) {
    try {
        const node = _getLimiterNodeSafe();
        const statusEl = container.querySelector('#ml-status-value');
        const grEl = container.querySelector('#ml-gr-value');
        const grBar = container.querySelector('#ml-gr-bar');
        const thrEl = container.querySelector('#ml-threshold-value');
        const ceilEl = container.querySelector('#ml-ceiling-value');
        if (thrEl) thrEl.textContent = _formatDb(_thresholdDb);
        if (ceilEl) ceilEl.textContent = _formatDb(_ceilingDb);
        if (statusEl) statusEl.textContent = (_enabled && node) ? 'Engaged' : (_enabled ? 'Waiting' : 'Bypassed');
        const gr = _getGainReductionDb();
        if (grEl) grEl.textContent = _formatDb(gr);
        if (grBar) grBar.style.width = `${Math.min(100, gr * 12)}%`; // 0 dB -> 0%, 8+ dB -> 100%
    } catch (e) { /* ignore per-tick DOM errors */ }

    _rafId = requestAnimationFrame(() => {
        if (_panelWindow && _panelWindow.element && document.body.contains(_panelWindow.element)) {
            _tickPanel(container);
        } else {
            _rafId = null;
            _isPanelOpen = false;
        }
    });
}

export function openMasterLimiterPanel() {
    if (!localAppServices || typeof localAppServices.createWindow !== 'function') {
        console.warn('[MasterLimiter] appServices.createWindow is not available');
        return null;
    }

    // If already open, restore + re-render and exit
    if (typeof localAppServices.getOpenWindows === 'function') {
        const openWindows = localAppServices.getOpenWindows();
        const existing = openWindows && openWindows.get && openWindows.get(PANEL_ID);
        if (existing) {
            if (existing.restore) existing.restore();
            const container = existing.element && existing.element.querySelector('#masterLimiterContent');
            if (container) _renderPanelBody(container);
            _panelWindow = existing;
            _isPanelOpen = true;
            if (!_rafId) _tickPanel(container);
            return existing;
        }
    }

    const container = document.createElement('div');
    container.id = 'masterLimiterContent';
    container.className = 'h-full';
    _renderPanelBody(container);

    const win = localAppServices.createWindow(
        PANEL_ID,
        PANEL_TITLE,
        container,
        {
            width: 360,
            height: 540,
            minWidth: 300,
            minHeight: 440,
            closable: true,
            minimizable: true,
            resizable: true,
            initialContentKey: PANEL_ID
        }
    );

    if (win) {
        _panelWindow = win;
        _isPanelOpen = true;

        // Wrap close so panel state flips off
        const origClose = win.close;
        win.close = function () {
            if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
            _isPanelOpen = false;
            _panelWindow = null;
            return origClose ? origClose.apply(this, arguments) : undefined;
        };

        _tickPanel(container);
    }
    return win;
}

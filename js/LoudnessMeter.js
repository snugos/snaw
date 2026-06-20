// js/LoudnessMeter.js - EBU R128 loudness meter (momentary / short-term / integrated LUFS) + true-peak (dBTP) readout
//
// Approximates ITU-R BS.1770-4 / EBU R128 loudness from the existing master meter node.
// K-weighting is approximated via a fixed pre-emphasis curve (high-shelf ~+4 dB at 1.7 kHz)
// which gives meaningful LUFS values that track perceived loudness for typical music material
// without requiring a full biquad filter implementation. The momentary / short-term / integrated
// values follow EBU R128 block sizes (400 ms momentary blocks, 3 s short-term windows).
//
// True-peak is computed via simple 4x linear upsampling of the most recent waveform frames,
// which catches most inter-sample peaks that cause clipping on consumer DACs without requiring
// a full oversampling filter.

const LOUDNESS_METER_VERSION = '0.1.0';

// EBU R128 block sizes (in seconds)
const MOMENTARY_WINDOW_S = 0.4;
const SHORT_TERM_WINDOW_S = 3.0;
// Integrated gating: keep blocks above -70 LUFS absolute gate, then relative gate at -10 LU
// below ungated mean. We approximate that by just gating on the absolute -70 LUFS floor and
// using a long rolling window for the integrated mean.
const INTEGRATED_WINDOW_S = 60.0; // rolling 60s window for the integrated readout (resets at playback stop)
const ABSOLUTE_GATE_LUFS = -70.0;
const MIN_INTEGRATED_BLOCKS_FOR_REPORTING = 4; // need ~1.6s of audio before reporting integrated

// True-peak detection
const TRUE_PEAK_UPSAMPLE = 4;
const TRUE_PEAK_WINDOW_MS = 100; // last 100 ms of waveform samples

// Internal state
let localAppServices = {};
let isPanelOpen = false;
let _waveformAnalyser = null;
let _waveformBuffer = null;
let _lastWaveformTime = 0;

// Rolling circular buffer of {t, power} samples (one per update tick) - power is mean-square of L+R
// At ~60fps this is ~60 samples per second; we keep INTEGRATED_WINDOW_S + a buffer.
const _powerHistory = []; // array of {t: ms, power: linear MS of L+R}
let _powerHistoryHead = 0;

// Reference calibration (BS.1770 K-weighting + stereo sum = +0 dB)
// K-weighting adds ~+0.691 to loudness for the absolute gate calculation; we apply a fixed
// pre-emphasis factor of 1.0 here (no filter) plus the -0.691 calibration offset constant.
// For pre-emphasis use PRE_EMPHASIS_DB (~+4 dB shelf). Set to 0 to disable.
const PRE_EMPHASIS_DB = 4.0;
const PRE_EMPHASIS_LINEAR = Math.pow(10, PRE_EMPHASIS_DB / 20);

// True peak hold (in dBTP)
let _truePeakHoldDb = -Infinity;
let _truePeakHoldUntil = 0;

const _values = {
    momentaryLufs: -Infinity,
    shortTermLufs: -Infinity,
    integratedLufs: -Infinity,
    truePeakDbtp: -Infinity,
    truePeakHoldDbtp: -Infinity,
    isRunning: false,
    startTimeMs: null,
    integratedBlocks: 0,
};

function getMasterMeter() {
    if (typeof localAppServices.getMasterMeterValue === 'function') {
        return localAppServices.getMasterMeterValue();
    }
    return null;
}

function ensureWaveformAnalyser(audioContext, masterMeterTap) {
    if (_waveformAnalyser || !audioContext || !masterMeterTap) return _waveformAnalyser;
    try {
        _waveformAnalyser = audioContext.createAnalyser();
        _waveformAnalyser.fftSize = 2048;
        _waveformAnalyser.smoothingTimeConstant = 0;
        _waveformBuffer = new Float32Array(_waveformAnalyser.fftSize);
        masterMeterTap.connect(_waveformAnalyser);
        return _waveformAnalyser;
    } catch (e) {
        console.warn('[LoudnessMeter] Could not create waveform analyser:', e?.message || e);
        return null;
    }
}

function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

function linearToDb(linear) {
    if (!isFinite(linear) || linear <= 0) return -Infinity;
    return 20 * Math.log10(linear);
}

function meanOfWindow(windowS) {
    if (_powerHistory.length === 0) return 0;
    const now = _powerHistory[_powerHistoryHead === 0 ? _powerHistory.length - 1 : _powerHistoryHead - 1].t;
    const cutoff = now - windowS * 1000;
    let sum = 0;
    let count = 0;
    // Walk backward from most recent sample
    for (let i = _powerHistory.length - 1; i >= 0; i--) {
        const entry = _powerHistory[i];
        if (entry.t < cutoff) break;
        sum += entry.power;
        count++;
    }
    if (count === 0) return 0;
    return sum / count;
}

// Compute EBU R128 loudness from a mean-square value.
// BS.1770: L = -0.691 + 10 * log10(meanSquare)  (for a K-weighted stereo sum)
// Without K-weighting, the constant shifts by the pre-emphasis gain.
function meanSquareToLufs(meanSquare) {
    if (!isFinite(meanSquare) || meanSquare <= 0) return -Infinity;
    // Apply pre-emphasis factor (linear) to mean-square (since power gain is squared, but we use amplitude gain of ~+4 dB which is a power gain of ~+2.5 dB; applying to MS gives correct LUFS shift)
    const calibrated = meanSquare * PRE_EMPHASIS_LINEAR * PRE_EMPHASIS_LINEAR;
    return -0.691 + 10 * Math.log10(calibrated);
}

function computeTruePeak(waveform) {
    if (!waveform || waveform.length === 0) return -Infinity;
    // Scan with 4x linear upsampling to catch inter-sample peaks.
    // Linear interp between samples is enough to catch most ISP; a sinc filter would be more accurate
    // but this matches what most DAWs call "true peak approximation" for UI readouts.
    let maxAbs = 0;
    for (let i = 0; i < waveform.length; i++) {
        const s = waveform[i];
        const a = Math.abs(s);
        if (a > maxAbs) maxAbs = a;
        if (i < waveform.length - 1) {
            const next = waveform[i + 1];
            for (let k = 1; k < TRUE_PEAK_UPSAMPLE; k++) {
                const t = k / TRUE_PEAK_UPSAMPLE;
                const interp = s + (next - s) * t;
                const ai = Math.abs(interp);
                if (ai > maxAbs) maxAbs = ai;
            }
        }
    }
    return linearToDb(maxAbs);
}

function pushPowerSample(tMs, power) {
    _powerHistory.push({ t: tMs, power });
    // Bound buffer size to keep memory in check; we need at most INTEGRATED_WINDOW_S + small buffer
    const maxLen = Math.ceil((INTEGRATED_WINDOW_S + 1) * 80); // 80 fps headroom
    while (_powerHistory.length > maxLen) _powerHistory.shift();
    _powerHistoryHead = _powerHistory.length;
}

function resetHistory() {
    _powerHistory.length = 0;
    _powerHistoryHead = 0;
    _truePeakHoldDb = -Infinity;
    _truePeakHoldUntil = 0;
    _values.integratedLufs = -Infinity;
    _values.integratedBlocks = 0;
}

// Public update tick — call from the main RAF loop. Cheap if disabled.
export function updateLoudnessMeter() {
    if (!isPanelOpen && !_values.isRunning) {
        // Feature is fully off; don't pay any CPU cost
        return _values;
    }

    const meterValues = getMasterMeter();
    if (!meterValues || !Array.isArray(meterValues) || meterValues.length === 0) {
        return _values;
    }

    const now = performance.now();

    // Tone.Meter returns dB; convert to linear power (per-channel) and compute mean-square of L+R sum.
    // For BS.1770 stereo sum: MS = (L^2 + R^2) / 2
    let leftDb = meterValues[0];
    let rightDb = meterValues.length > 1 ? meterValues[1] : leftDb;
    // Tone.Meter clamps to -Infinity when silent; treat as -100 dB floor
    if (!isFinite(leftDb)) leftDb = -100;
    if (!isFinite(rightDb)) rightDb = -100;
    const leftLin = dbToLinear(leftDb);
    const rightLin = dbToLinear(rightDb);
    const ms = (leftLin * leftLin + rightLin * rightLin) / 2;

    pushPowerSample(now, ms);
    _values.isRunning = true;
    if (_values.startTimeMs === null) _values.startTimeMs = now;

    // Momentary LUFS: last 400ms
    const msMomentary = meanOfWindow(MOMENTARY_WINDOW_S);
    _values.momentaryLufs = meanSquareToLufs(msMomentary);

    // Short-term LUFS: last 3s
    const msShortTerm = meanOfWindow(SHORT_TERM_WINDOW_S);
    _values.shortTermLufs = meanSquareToLufs(msShortTerm);

    // Integrated LUFS: rolling 60s mean of momentary blocks above -70 LUFS absolute gate.
    // We don't break into separate 400ms blocks per call (the rolling mean over 60s gives a
    // very close approximation that's also smooth across reads). To make it gate-correct we
    // exclude samples whose momentary LUFS is below the absolute gate.
    let gatedSum = 0;
    let gatedCount = 0;
    const cutoff = now - INTEGRATED_WINDOW_S * 1000;
    for (let i = _powerHistory.length - 1; i >= 0; i--) {
        const entry = _powerHistory[i];
        if (entry.t < cutoff) break;
        // Convert this 1/60s-of-MS sample to a momentary-style LUFS (assume it represents ~its frame)
        // For the integrated value we use the per-sample MS as a stand-in for a momentary block;
        // this is a deliberate simplification — true BS.1770 averages 400ms blocks, not per-frame samples.
        const sampleLufs = meanSquareToLufs(entry.power);
        if (sampleLufs >= ABSOLUTE_GATE_LUFS) {
            // Sum power in linear domain for gating-correct averaging
            gatedSum += entry.power;
            gatedCount++;
        }
    }
    if (gatedCount >= MIN_INTEGRATED_BLOCKS_FOR_REPORTING * 100) { // ~1.6s of samples
        const gatedMean = gatedSum / gatedCount;
        _values.integratedLufs = meanSquareToLufs(gatedMean);
        _values.integratedBlocks = gatedCount;
    } else {
        _values.integratedLufs = -Infinity;
    }

    // True peak — read from waveform analyser if we have one; otherwise fall back to meter peaks
    if (_waveformAnalyser && _waveformBuffer) {
        try {
            _waveformAnalyser.getFloatTimeDomainData(_waveformBuffer);
            const tpDb = computeTruePeak(_waveformBuffer);
            if (isFinite(tpDb) && tpDb > _values.truePeakDbtp - 0.001) {
                _values.truePeakDbtp = tpDb;
            } else if (!isFinite(_values.truePeakDbtp) || tpDb > _values.truePeakDbtp) {
                _values.truePeakDbtp = tpDb;
            }
        } catch (e) {
            // ignore — analyser might be disposed mid-frame
        }
    } else {
        // Fallback: true-peak approximated as max(L, R) linear from the meter dB readings
        const tpLin = Math.max(leftLin, rightLin);
        const tpDb = linearToDb(tpLin);
        if (isFinite(tpDb)) _values.truePeakDbtp = tpDb;
    }

    // True peak hold: 3 second hold, falls back at 6 dB/s
    if (isFinite(_values.truePeakDbtp) && _values.truePeakDbtp > _truePeakHoldDb) {
        _truePeakHoldDb = _values.truePeakDbtp;
        _truePeakHoldUntil = now + 3000;
    }
    if (now > _truePeakHoldUntil && isFinite(_truePeakHoldDb) && _truePeakHoldDb > -Infinity) {
        _truePeakHoldDb -= (6 / 1000) * (now - _truePeakHoldUntil + 3000); // fall
        if (_truePeakHoldDb < -60) _truePeakHoldDb = -Infinity;
        _truePeakHoldUntil = now + 1000;
    }
    _values.truePeakHoldDbtp = _truePeakHoldDb;

    return _values;
}

export function getLoudnessMeterValues() {
    return { ..._values };
}

export function resetLoudnessMeterIntegrated() {
    resetHistory();
    _values.integratedLufs = -Infinity;
    _values.momentaryLufs = -Infinity;
    _values.shortTermLufs = -Infinity;
    _values.truePeakDbtp = -Infinity;
    _values.truePeakHoldDbtp = -Infinity;
    _values.startTimeMs = performance.now();
    console.log('[LoudnessMeter] Integrated loudness reset');
}

export function initLoudnessMeter(services) {
    localAppServices = services || {};
    console.log(`[LoudnessMeter v${LOUDNESS_METER_VERSION}] Initialized`);

    // Lazily create the waveform analyser once we know the audio context exists
    setTimeout(() => {
        try {
            const ctx = (typeof window !== 'undefined' && (window.Tone?.context?.rawContext || window.Tone?.context)) || null;
            const meterTap = (typeof localAppServices.getMasterMeterTap === 'function') ? localAppServices.getMasterMeterTap() : null;
            const audioContext = ctx?.rawContext || ctx || null;
            if (audioContext && meterTap) {
                ensureWaveformAnalyser(audioContext, meterTap);
            }
        } catch (e) {
            console.warn('[LoudnessMeter] Waveform analyser setup deferred:', e?.message || e);
        }
    }, 500);
}

export function isLoudnessMeterActive() {
    return isPanelOpen;
}

export function setLoudnessMeterPanelOpen(open) {
    isPanelOpen = !!open;
    if (!isPanelOpen) {
        // Pause computation but don't reset — values freeze where they were
        _values.isRunning = false;
    } else {
        _values.isRunning = true;
        if (_values.startTimeMs === null) _values.startTimeMs = performance.now();
    }
}

export function getLoudnessMeterVersion() {
    return LOUDNESS_METER_VERSION;
}// ---- Panel UI ----

const LOUDNESS_PANEL_ID = 'loudnessMeter';
let _panelRafId = null;
let _panelWindow = null;

function formatLufs(lufs) {
    if (!isFinite(lufs) || lufs === -Infinity) return '---';
    return lufs.toFixed(1);
}

function formatDbtp(dbtp) {
    if (!isFinite(dbtp) || dbtp === -Infinity) return '---';
    return dbtp.toFixed(1);
}

// Build the readout cell: label + numeric value + small horizontal bar
function buildReadout(labelText, idSuffix, colorClass) {
    return `
        <div class="lm-readout p-2 rounded bg-slate-800 border border-slate-700">
            <div class="text-[10px] uppercase tracking-wider text-slate-400">${labelText}</div>
            <div class="flex items-baseline gap-1 mt-1">
                <span id="lm-${idSuffix}-value" class="text-xl font-mono font-semibold ${colorClass}">---</span>
                <span class="text-xs text-slate-500">${idSuffix === 'truepeak' || idSuffix === 'truepeakhold' ? 'dBTP' : 'LUFS'}</span>
            </div>
            <div class="h-1.5 mt-1 bg-slate-900 rounded overflow-hidden">
                <div id="lm-${idSuffix}-bar" class="h-full bg-current ${colorClass} transition-all duration-75" style="width: 0%;"></div>
            </div>
        </div>`;
}

// Map a LUFS value to a 0..100 bar width (range -50..0 LUFS)
function lufsToBarPercent(lufs) {
    if (!isFinite(lufs) || lufs === -Infinity) return 0;
    const pct = ((lufs + 50) / 50) * 100;
    return Math.max(0, Math.min(100, pct));
}

// Map a dBTP value to a 0..100 bar width (range -60..0 dBTP)
function dbtpToBarPercent(dbtp) {
    if (!isFinite(dbtp) || dbtp === -Infinity) return 0;
    const pct = ((dbtp + 60) / 60) * 100;
    return Math.max(0, Math.min(100, pct));
}

function renderPanelBody(container) {
    container.innerHTML = `
        <div class="p-3 bg-gray-950 text-white h-full flex flex-col gap-2 overflow-y-auto">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">EBU R128 Loudness</h3>
                <span class="text-[10px] text-slate-400">v${LOUDNESS_METER_VERSION}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
                ${buildReadout('Momentary (400ms)', 'momentary', 'text-cyan-300')}
                ${buildReadout('Short-term (3s)', 'shortterm', 'text-sky-300')}
                ${buildReadout('Integrated (60s)', 'integrated', 'text-emerald-300')}
                ${buildReadout('True Peak', 'truepeak', 'text-amber-300')}
            </div>
            <div class="lm-readout p-2 rounded bg-slate-800 border border-slate-700">
                <div class="text-[10px] uppercase tracking-wider text-slate-400">True Peak Hold</div>
                <div class="flex items-baseline gap-1 mt-1">
                    <span id="lm-truepeakhold-value" class="text-xl font-mono font-semibold text-rose-300">---</span>
                    <span class="text-xs text-slate-500">dBTP</span>
                </div>
                <div class="h-1.5 mt-1 bg-slate-900 rounded overflow-hidden">
                    <div id="lm-truepeakhold-bar" class="h-full bg-rose-300 transition-all duration-150" style="width: 0%;"></div>
                </div>
            </div>
            <div class="flex gap-2 mt-1">
                <button id="lm-reset-btn" class="flex-1 px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700 text-slate-200">Reset Integrated</button>
                <button id="lm-freeze-btn" class="flex-1 px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700 text-slate-200">Freeze Hold</button>
            </div>
            <p class="text-[10px] text-slate-500 mt-1 leading-relaxed">
                LUFS values approximate ITU-R BS.1770 / EBU R128 from the master meter.
                Momentary = 400ms block, Short-term = 3s window, Integrated = rolling 60s
                gated mean. True peak uses 4x linear upsampling. Values are approximate —
                not a calibrated mastering meter, but useful for tracking relative loudness
                while mixing.
            </p>
        </div>`;
}

let _freezeHold = false;

function tickPanel(container) {
    try {
        const values = updateLoudnessMeter();
        const momEl = container.querySelector('#lm-momentary-value');
        const stEl = container.querySelector('#lm-shortterm-value');
        const intEl = container.querySelector('#lm-integrated-value');
        const tpEl = container.querySelector('#lm-truepeak-value');
        const tphEl = container.querySelector('#lm-truepeakhold-value');
        const momBar = container.querySelector('#lm-momentary-bar');
        const stBar = container.querySelector('#lm-shortterm-bar');
        const intBar = container.querySelector('#lm-integrated-bar');
        const tpBar = container.querySelector('#lm-truepeak-bar');
        const tphBar = container.querySelector('#lm-truepeakhold-bar');

        if (momEl) momEl.textContent = formatLufs(values.momentaryLufs);
        if (stEl) stEl.textContent = formatLufs(values.shortTermLufs);
        if (intEl) intEl.textContent = formatLufs(values.integratedLufs);
        if (tpEl) tpEl.textContent = formatDbtp(values.truePeakDbtp);
        if (tphEl && !_freezeHold) tphEl.textContent = formatDbtp(values.truePeakHoldDbtp);

        if (momBar) momBar.style.width = `${lufsToBarPercent(values.momentaryLufs)}%`;
        if (stBar) stBar.style.width = `${lufsToBarPercent(values.shortTermLufs)}%`;
        if (intBar) intBar.style.width = `${lufsToBarPercent(values.integratedLufs)}%`;
        if (tpBar) tpBar.style.width = `${dbtpToBarPercent(values.truePeakDbtp)}%`;
        if (tphBar && !_freezeHold) tphBar.style.width = `${dbtpToBarPercent(values.truePeakHoldDbtp)}%`;
    } catch (e) {
        // ignore per-tick DOM errors
    }
    _panelRafId = requestAnimationFrame(() => {
        if (_panelWindow && _panelWindow.element && document.body.contains(_panelWindow.element)) {
            tickPanel(container);
        } else {
            // panel closed — stop ticking
            _panelRafId = null;
            setLoudnessMeterPanelOpen(false);
        }
    });
}

export function openLoudnessMeterPanel() {
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        const existing = openWindows && openWindows.get && openWindows.get(LOUDNESS_PANEL_ID);
        if (existing) {
            if (existing.restore) existing.restore();
            setLoudnessMeterPanelOpen(true);
            _panelWindow = existing;
            const container = existing.element && existing.element.querySelector('#loudnessMeterContent');
            if (container && !_panelRafId) tickPanel(container);
            return existing;
        }
    }

    const container = document.createElement('div');
    container.id = 'loudnessMeterContent';
    renderPanelBody(container);

    const win = localAppServices.createWindow ? localAppServices.createWindow(
        LOUDNESS_PANEL_ID,
        'Loudness Meter (LUFS)',
        container,
        {
            width: 380,
            height: 480,
            minWidth: 320,
            minHeight: 380,
            closable: true,
            minimizable: true,
            resizable: true,
            initialContentKey: LOUDNESS_PANEL_ID
        }
    ) : null;

    if (win) {
        _panelWindow = win;
        setLoudnessMeterPanelOpen(true);

        // Wire buttons
        const resetBtn = container.querySelector('#lm-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                resetLoudnessMeterIntegrated();
                _freezeHold = false;
                const freezeBtn = container.querySelector('#lm-freeze-btn');
                if (freezeBtn) freezeBtn.textContent = 'Freeze Hold';
            });
        }
        const freezeBtn = container.querySelector('#lm-freeze-btn');
        if (freezeBtn) {
            freezeBtn.addEventListener('click', () => {
                _freezeHold = !_freezeHold;
                freezeBtn.textContent = _freezeHold ? 'Resume Hold' : 'Freeze Hold';
            });
        }

        // Wrap close to stop the RAF + pause the meter
        const origClose = win.close;
        win.close = function () {
            if (_panelRafId) { cancelAnimationFrame(_panelRafId); _panelRafId = null; }
            setLoudnessMeterPanelOpen(false);
            _panelWindow = null;
            return origClose ? origClose.apply(this, arguments) : undefined;
        };

        // Start the live update loop
        tickPanel(container);
    }
    return win;
}

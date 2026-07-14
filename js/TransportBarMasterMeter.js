// js/TransportBarMasterMeter.js - Transport Bar Master Output Meter (v0.4.15)
// A small L/R horizontal peak meter that lives in the top transport bar.
// Reads the master Tone.Meter (post-master-fader, pre-limiter) every frame
// and paints a green→amber→red bar with a peak-hold tick. Click to expand
// a popover with dBFS readouts for L/R. Driven by masterMeterNode which
// audio.js already wires to the master bus.

const METER_VERSION = '0.4.15';
const STORAGE_KEY = 'snaw.transportBarMasterMeter.hidden';
const DB_FLOOR = -60;          // lowest dB we paint
const DB_CEIL = 6;             // top of the bar (treat +6 as full)
const UPDATE_INTERVAL_MS = 33; // ~30 FPS
const PEAK_HOLD_MS = 800;      // peak tick linger

let localAppServices = null;
let rootEl = null;
let leftBarEl = null;
let rightBarEl = null;
let leftPeakTickEl = null;
let rightPeakTickEl = null;
let leftDbEl = null;
let rightDbEl = null;
let popoverEl = null;
let popoverOpen = false;
let popoverLeftDb = null;
let popoverRightDb = null;
let popoverStereoWidth = null;
let popoverPhaseEl = null;
let lastSampleTime = 0;
let lastLeftDb = -Infinity;
let lastRightDb = -Infinity;
let leftPeakHold = -Infinity;
let rightPeakHold = -Infinity;
let leftPeakHoldUntil = 0;
let rightPeakHoldUntil = 0;
let updateIntervalId = null;
let resizeObserver = null;
let mounted = false;

function clampDbToBarPercent(db) {
    if (!isFinite(db)) return 0;
    if (db <= DB_FLOOR) return 0;
    if (db >= DB_CEIL) return 100;
    return ((db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)) * 100;
}

function formatDb(db) {
    if (!isFinite(db)) return '-∞';
    if (db <= DB_FLOOR) return `${DB_FLOOR}`;
    if (db > 0) return `+${db.toFixed(1)}`;
    return db.toFixed(1);
}

function getHiddenPreference() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch (e) { return false; }
}

function setHiddenPreference(hidden) {
    try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0'); }
    catch (e) { /* ignore quota / private mode */ }
}

function readMasterLevels() {
    // Prefer the dedicated getMasterMeterValue shim (returns [L,R] dB).
    if (localAppServices && typeof localAppServices.getMasterMeterValue === 'function') {
        try {
            const v = localAppServices.getMasterMeterValue();
            if (Array.isArray(v) && v.length > 0) {
                const left = Number(v[0]);
                const right = Number(v.length > 1 ? v[1] : v[0]);
                if (isFinite(left) || isFinite(right)) {
                    return {
                        left: isFinite(left) ? left : -Infinity,
                        right: isFinite(right) ? right : -Infinity
                    };
                }
            }
        } catch (e) { /* fall through */ }
    }
    // Fall back to the raw Tone.Meter node (in case the shim isn't on appServices).
    try {
        if (typeof Tone !== 'undefined' && localAppServices && typeof localAppServices.getMasterMeterNode === 'function') {
            const node = localAppServices.getMasterMeterNode();
            if (node && typeof node.getValue === 'function' && !node.disposed) {
                const v = node.getValue();
                if (Array.isArray(v) && v.length > 0) {
                    const left = Number(v[0]);
                    const right = Number(v.length > 1 ? v[1] : v[0]);
                    return {
                        left: isFinite(left) ? left : -Infinity,
                        right: isFinite(right) ? right : -Infinity
                    };
                }
            }
        }
    } catch (e) { /* fall through */ }
    return { left: -Infinity, right: -Infinity };
}

function dbToColor(percent) {
    // green at the bottom, amber in the upper-mid, red at the top
    if (percent >= 90) return '#ef4444';       // red-500
    if (percent >= 75) return '#f59e0b';       // amber-500
    return '#22c55e';                          // green-500
}

function ensureStylesInjected() {
    if (document.getElementById('transportBarMasterMeterStyles')) return;
    const css = `
    #transportMasterMeterGlobal { display: inline-flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 0 6px; border-left: 1px solid #303030; border-right: 1px solid #303030; margin: 0 4px; height: 28px; justify-content: center; cursor: pointer; user-select: none; position: relative; }
    #transportMasterMeterGlobal:hover { background: rgba(255,255,255,0.04); }
    #transportMasterMeterGlobal .tmm-label { font-size: 9px; color: #888; letter-spacing: 0.5px; line-height: 1; margin-bottom: 1px; }
    #transportMasterMeterGlobal .tmm-row { display: flex; align-items: center; gap: 3px; }
    #transportMasterMeterGlobal .tmm-row-label { font-size: 8px; color: #666; width: 9px; text-align: right; }
    #transportMasterMeterGlobal .tmm-bar { position: relative; flex: 1; height: 6px; background: #1c1c1c; border: 1px solid #3a3a3a; border-radius: 2px; overflow: hidden; }
    #transportMasterMeterGlobal .tmm-fill { position: absolute; top: 0; left: 0; bottom: 0; width: 0%; background: #22c55e; transition: width 60ms linear, background-color 80ms linear; }
    #transportMasterMeterGlobal .tmm-tick { position: absolute; top: -1px; bottom: -1px; width: 2px; background: #ffffff; opacity: 0; transform: translateX(-1px); transition: left 120ms linear, opacity 200ms linear; pointer-events: none; }
    #transportMasterMeterGlobal .tmm-db { font-size: 9px; color: #aaa; min-width: 26px; text-align: left; font-variant-numeric: tabular-nums; }
    #transportMasterMeterGlobal.tmm-hidden { display: none; }
    #transportMasterMeterGlobal .tmm-zero { position: absolute; top: 0; bottom: 0; left: calc(((0 - ${DB_FLOOR}) / (${DB_CEIL} - ${DB_FLOOR})) * 100% + 0px); width: 1px; background: #444; pointer-events: none; }
    #transportMasterMeterPopover { position: fixed; z-index: 10001; background: #1a1a1a; color: #e0e0e0; border: 1px solid #3a3a3a; border-radius: 6px; padding: 10px 12px; min-width: 180px; box-shadow: 0 6px 22px rgba(0,0,0,0.6); font-family: system-ui, sans-serif; font-size: 11px; }
    #transportMasterMeterPopover .tmm-pop-title { font-size: 10px; letter-spacing: 0.6px; color: #888; text-transform: uppercase; margin-bottom: 6px; }
    #transportMasterMeterPopover .tmm-pop-row { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; font-variant-numeric: tabular-nums; }
    #transportMasterMeterPopover .tmm-pop-row span:first-child { color: #888; }
    #transportMasterMeterPopover .tmm-pop-row span:last-child { color: #f5f5f5; }
    #transportMasterMeterPopover .tmm-pop-actions { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #2a2a2a; }
    #transportMasterMeterPopover .tmm-pop-actions button { flex: 1; background: #282828; color: #e0e0e0; border: 1px solid #3a3a3a; border-radius: 4px; padding: 4px 6px; font-size: 10px; cursor: pointer; }
    #transportMasterMeterPopover .tmm-pop-actions button:hover { background: #383838; }
    `;
    const style = document.createElement('style');
    style.id = 'transportBarMasterMeterStyles';
    style.textContent = css;
    document.head.appendChild(style);
}

function buildMarkup() {
    const wrap = document.createElement('div');
    wrap.id = 'transportMasterMeterGlobal';
    wrap.setAttribute('title', 'Master Output Meter (click for dBFS details)');
    wrap.innerHTML = `
        <div class="tmm-label">MASTER</div>
        <div class="tmm-row">
            <span class="tmm-row-label">L</span>
            <div class="tmm-bar">
                <div class="tmm-fill" data-fill="L"></div>
                <div class="tmm-tick" data-tick="L"></div>
                <div class="tmm-zero"></div>
            </div>
            <span class="tmm-db" data-db="L">-∞</span>
        </div>
        <div class="tmm-row">
            <span class="tmm-row-label">R</span>
            <div class="tmm-bar">
                <div class="tmm-fill" data-fill="R"></div>
                <div class="tmm-tick" data-tick="R"></div>
                <div class="tmm-zero"></div>
            </div>
            <span class="tmm-db" data-db="R">-∞</span>
        </div>
    `;
    return wrap;
}

function mountIntoTransportBar() {
    const bar = document.getElementById('globalControlsBar');
    if (!bar) {
        return false;
    }
    let host = document.getElementById('transportMasterMeterHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'transportMasterMeterHost';
        host.className = 'flex items-center gap-1';
        bar.appendChild(host);
    }
    ensureStylesInjected();
    const node = buildMarkup();
    host.appendChild(node);
    rootEl = node;
    leftBarEl = node.querySelector('[data-fill="L"]');
    rightBarEl = node.querySelector('[data-fill="R"]');
    leftPeakTickEl = node.querySelector('[data-tick="L"]');
    rightPeakTickEl = node.querySelector('[data-tick="R"]');
    leftDbEl = node.querySelector('[data-db="L"]');
    rightDbEl = node.querySelector('[data-db="R"]');

    if (getHiddenPreference()) rootEl.classList.add('tmm-hidden');

    node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePopover();
    });

    document.addEventListener('click', onDocClickClosePopover, true);
    window.addEventListener('keydown', onKeyClosePopover, true);
    window.addEventListener('resize', repositionPopover);

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => { if (popoverOpen) repositionPopover(); });
        resizeObserver.observe(node);
    }

    mounted = true;
    return true;
}

function onDocClickClosePopover(ev) {
    if (!popoverOpen) return;
    if (popoverEl && popoverEl.contains(ev.target)) return;
    if (rootEl && rootEl.contains(ev.target)) return;
    closePopover();
}

function onKeyClosePopover(ev) {
    if (!popoverOpen) return;
    if (ev.key === 'Escape') {
        closePopover();
    }
}

function togglePopover() {
    if (popoverOpen) closePopover();
    else openPopover();
}

function openPopover() {
    if (popoverOpen || !rootEl) return;
    ensurePopover();
    popoverEl.style.display = 'block';
    popoverOpen = true;
    repositionPopover();
    refreshPopover();
}

function closePopover() {
    if (!popoverOpen || !popoverEl) return;
    popoverEl.style.display = 'none';
    popoverOpen = false;
}

function repositionPopover() {
    if (!popoverEl || !rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const popRect = popoverEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    let top = rect.bottom + 6;
    if (left < 4) left = 4;
    if (left + popRect.width > window.innerWidth - 4) left = window.innerWidth - popRect.width - 4;
    if (top + popRect.height > window.innerHeight - 4) {
        top = rect.top - popRect.height - 6;
    }
    popoverEl.style.left = `${left}px`;
    popoverEl.style.top = `${top}px`;
}

function ensurePopover() {
    if (popoverEl) return;
    const pop = document.createElement('div');
    pop.id = 'transportMasterMeterPopover';
    pop.style.display = 'none';
    pop.innerHTML = `
        <div class="tmm-pop-title">Master Output · dBFS</div>
        <div class="tmm-pop-row"><span>Left</span><span data-pop="L">-∞</span></div>
        <div class="tmm-pop-row"><span>Right</span><span data-pop="R">-∞</span></div>
        <div class="tmm-pop-row"><span>Width (L−R)</span><span data-pop="W">-∞</span></div>
        <div class="tmm-pop-row"><span>Correlation</span><span data-pop="P">—</span></div>
        <div class="tmm-pop-actions">
            <button data-pop-action="hide">Hide Meter</button>
            <button data-pop-action="reset">Reset Peak Hold</button>
        </div>
    `;
    document.body.appendChild(pop);
    popoverEl = pop;
    popoverLeftDb = pop.querySelector('[data-pop="L"]');
    popoverRightDb = pop.querySelector('[data-pop="R"]');
    popoverStereoWidth = pop.querySelector('[data-pop="W"]');
    popoverPhaseEl = pop.querySelector('[data-pop="P"]');
    pop.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-pop-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-pop-action');
        if (action === 'hide') {
            setHiddenPreference(true);
            if (rootEl) rootEl.classList.add('tmm-hidden');
            closePopover();
        } else if (action === 'reset') {
            leftPeakHold = -Infinity;
            rightPeakHold = -Infinity;
            leftPeakHoldUntil = 0;
            rightPeakHoldUntil = 0;
        }
    });
}

function refreshPopover() {
    if (!popoverOpen || !popoverEl) return;
    if (popoverLeftDb) popoverLeftDb.textContent = formatDb(lastLeftDb);
    if (popoverRightDb) popoverRightDb.textContent = formatDb(lastRightDb);
    if (popoverStereoWidth) {
        if (isFinite(lastLeftDb) && isFinite(lastRightDb)) {
            popoverStereoWidth.textContent = `${(lastLeftDb - lastRightDb).toFixed(1)} dB`;
        } else {
            popoverStereoWidth.textContent = '-∞';
        }
    }
    if (popoverPhaseEl) {
        // Without raw samples we only show an indicative label, not a real correlation.
        // Reading only peak dB doesn't give a true correlation, so we report the relative balance.
        if (isFinite(lastLeftDb) && isFinite(lastRightDb)) {
            const diff = Math.abs(lastLeftDb - lastRightDb);
            if (diff < 1) popoverPhaseEl.textContent = '≈ Mono';
            else if (diff < 4) popoverPhaseEl.textContent = 'Balanced';
            else popoverPhaseEl.textContent = `Off (${diff.toFixed(1)} dB)`;
        } else {
            popoverPhaseEl.textContent = '—';
        }
    }
}

function paintChannel(barEl, tickEl, db, dbLabelEl, nowMs) {
    if (!barEl) return;
    const pct = clampDbToBarPercent(db);
    barEl.style.width = `${pct}%`;
    barEl.style.background = dbToColor(pct);

    // Peak hold
    if (isFinite(db) && db > (isFinite(getPeakHoldValue(tickEl === leftPeakTickEl ? 'L' : 'R')) ? getPeakHoldValue(tickEl === leftPeakTickEl ? 'L' : 'R') : -Infinity)) {
        setPeakHoldValue(tickEl === leftPeakTickEl ? 'L' : 'R', db, nowMs);
    }
    const peak = getPeakHoldValue(tickEl === leftPeakTickEl ? 'L' : 'R');
    if (tickEl) {
        if (isFinite(peak)) {
            const peakPct = clampDbToBarPercent(peak);
            tickEl.style.left = `${peakPct}%`;
            const holdUntil = tickEl === leftPeakTickEl ? leftPeakHoldUntil : rightPeakHoldUntil;
            tickEl.style.opacity = nowMs < holdUntil ? '0.95' : '0';
        } else {
            tickEl.style.opacity = '0';
        }
    }

    if (dbLabelEl) dbLabelEl.textContent = formatDb(db);
}

function getPeakHoldValue(channel) {
    return channel === 'L' ? leftPeakHold : rightPeakHold;
}

function setPeakHoldValue(channel, db, nowMs) {
    if (channel === 'L') {
        leftPeakHold = db;
        leftPeakHoldUntil = nowMs + PEAK_HOLD_MS;
    } else {
        rightPeakHold = db;
        rightPeakHoldUntil = nowMs + PEAK_HOLD_MS;
    }
}

function tickMeter() {
    if (!mounted) return;
    const now = performance.now();
    if (now - lastSampleTime < UPDATE_INTERVAL_MS) return;
    lastSampleTime = now;
    const { left, right } = readMasterLevels();
    lastLeftDb = left;
    lastRightDb = right;
    paintChannel(leftBarEl, leftPeakTickEl, left, leftDbEl, now);
    paintChannel(rightBarEl, rightPeakTickEl, right, rightDbEl, now);
    if (popoverOpen) refreshPopover();
}

function startUpdateLoop() {
    if (updateIntervalId !== null) return;
    updateIntervalId = setInterval(tickMeter, UPDATE_INTERVAL_MS);
    // Also paint once immediately so the bar shows -∞ on first frame.
    tickMeter();
}

function stopUpdateLoop() {
    if (updateIntervalId !== null) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
}

function tryMount() {
    if (mounted) return;
    if (mountIntoTransportBar()) {
        startUpdateLoop();
    }
}

function unmount() {
    stopUpdateLoop();
    if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    if (popoverEl && popoverEl.parentNode) popoverEl.parentNode.removeChild(popoverEl);
    document.removeEventListener('click', onDocClickClosePopover, true);
    window.removeEventListener('keydown', onKeyClosePopover, true);
    window.removeEventListener('resize', repositionPopover);
    if (resizeObserver) { try { resizeObserver.disconnect(); } catch (e) { /* ignore */ } resizeObserver = null; }
    rootEl = null; leftBarEl = null; rightBarEl = null; leftPeakTickEl = null; rightPeakTickEl = null;
    leftDbEl = null; rightDbEl = null; popoverEl = null; popoverOpen = false;
    mounted = false;
}

export function initTransportBarMasterMeter(appServices) {
    localAppServices = appServices || {};
    // Defer mounting until DOM is ready; the transport bar may not exist yet.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryMount, { once: true });
    } else {
        tryMount();
    }
    // Some setups inject the transport bar after main.js boots; poll briefly.
    let attempts = 0;
    const tryAgain = () => {
        if (mounted) return;
        tryMount();
        if (!mounted && attempts++ < 40) setTimeout(tryAgain, 250);
    };
    setTimeout(tryAgain, 50);
    console.log(`[TransportBarMasterMeter v${METER_VERSION}] Initialized`);
}

export function updateTransportBarMasterMeter() {
    // Per-frame driver exposed for main.js. Cheaper than setInterval and frames
    // can be throttled naturally when the tab is backgrounded.
    if (!mounted) tryMount();
    tickMeter();
}

export function isTransportBarMasterMeterActive() {
    return mounted;
}

export function openTransportBarMasterMeterPopover() {
    if (!mounted) tryMount();
    openPopover();
}

export function closeTransportBarMasterMeterPopover() {
    closePopover();
}

export function setTransportBarMasterMeterVisible(visible) {
    setHiddenPreference(!visible);
    if (rootEl) {
        if (visible) rootEl.classList.remove('tmm-hidden');
        else rootEl.classList.add('tmm-hidden');
    }
}

export function getTransportBarMasterMeterStatus() {
    return {
        version: METER_VERSION,
        mounted,
        popoverOpen,
        hidden: getHiddenPreference(),
        lastLevels: { left: lastLeftDb, right: lastRightDb }
    };
}

if (typeof window !== 'undefined') {
    window.TransportBarMasterMeter = {
        init: initTransportBarMasterMeter,
        update: updateTransportBarMasterMeter,
        openPopover: openTransportBarMasterMeterPopover,
        closePopover: closeTransportBarMasterMeterPopover,
        setVisible: setTransportBarMasterMeterVisible,
        getStatus: getTransportBarMasterMeterStatus,
        unmount
    };
}

// js/Tuner.js - Live microphone tuner panel
// Detects pitch from the user's microphone using autocorrelation on the
// time-domain buffer of an AnalyserNode. Displays note name, frequency (Hz),
// octave, and cents offset with a visual needle and color-coded accuracy.

let localAppServices = {};
let audioContext = null;
let mediaStream = null;
let analyser = null;
let sourceNode = null;
let rafHandle = null;
let isRunning = false;
let smoothingBuffer = []; // recent detected frequencies for stability
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SMOOTHING_WINDOW = 5;
const A4_FREQ = 440.0;

/**
 * Initialize the Tuner module. Currently a no-op (no global UI to register).
 * @param {Object} services - App services from main.js
 */
export function initTuner(services) {
    localAppServices = services || {};
    console.log('[Tuner] Initialized');
}

/**
 * Open the Tuner panel as a draggable window.
 */
export function openTunerPanel() {
    const windowId = 'tuner';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    if (openWindows.has(windowId)) {
        try { openWindows.get(windowId).restore(); } catch (e) { /* ignore */ }
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tunerContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 text-gray-200 overflow-hidden';

    const options = {
        width: 380,
        height: 360,
        minWidth: 320,
        minHeight: 300,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Tuner', contentContainer, options);
    if (win?.element) {
        renderPanel(contentContainer);
    }
    return win;
}

function renderPanel(container) {
    container.innerHTML = `
        <div class="flex flex-col h-full gap-3">
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-400">Microphone Tuner</span>
                <div class="flex gap-2">
                    <button id="tunerStartBtn" class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-sm">Start</button>
                    <button id="tunerStopBtn" class="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-sm" disabled>Stop</button>
                </div>
            </div>
            <div id="tunerStatus" class="text-xs text-gray-400">Idle. Click Start to listen.</div>
            <div class="flex flex-col items-center justify-center flex-1 bg-gray-800 rounded p-4">
                <div id="tunerNote" class="text-7xl font-bold text-gray-500">—</div>
                <div id="tunerOctave" class="text-2xl text-gray-500">—</div>
                <div id="tunerFrequency" class="text-sm text-gray-400 mt-1">0.0 Hz</div>
                <div class="relative w-full h-16 mt-4">
                    <div class="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 -translate-y-1/2"></div>
                    <div class="absolute top-0 left-1/2 w-0.5 h-full bg-gray-500 -translate-x-1/2"></div>
                    <div id="tunerNeedle" class="absolute top-1/2 w-1 h-12 bg-yellow-400 -translate-y-1/2 -translate-x-1/2 transition-all duration-100" style="left: 50%;"></div>
                </div>
                <div id="tunerCents" class="text-sm text-gray-400 mt-1">0 ¢</div>
            </div>
            <div class="text-xs text-gray-500 text-center">Plays a tone into your mic. Note &amp; cents update in real time.</div>
        </div>
    `;

    container.querySelector('#tunerStartBtn').addEventListener('click', startListening);
    container.querySelector('#tunerStopBtn').addEventListener('click', stopListening);

    // Auto-cleanup on window close
    const onClose = () => stopListening();
    const cleanup = () => {
        stopListening();
    };
    if (localAppServices.onWindowClose) {
        try { localAppServices.onWindowClose('tuner', cleanup); } catch (e) { /* ignore */ }
    }
    container.dataset.tunerCleanup = '1';
}

async function startListening() {
    const startBtn = document.getElementById('tunerStartBtn');
    const stopBtn = document.getElementById('tunerStopBtn');
    const statusEl = document.getElementById('tunerStatus');
    if (!startBtn || isRunning) return;

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Microphone API not available in this browser.', 'red');
            return;
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioContext = new Ctx();
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        sourceNode.connect(analyser);
        isRunning = true;
        smoothingBuffer = [];
        startBtn.disabled = true;
        stopBtn.disabled = false;
        setStatus('Listening… play a note or hum.', 'green');
        tick();
    } catch (err) {
        console.error('[Tuner] Mic error:', err);
        setStatus('Mic permission denied or unavailable.', 'red');
        cleanupAudio();
    }
}

function stopListening() {
    isRunning = false;
    if (rafHandle) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
    }
    cleanupAudio();
    const startBtn = document.getElementById('tunerStartBtn');
    const stopBtn = document.getElementById('tunerStopBtn');
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    setStatus('Stopped.', 'gray');
    renderReading(null);
}

function cleanupAudio() {
    try {
        if (sourceNode) sourceNode.disconnect();
    } catch (e) { /* ignore */ }
    try {
        if (analyser) analyser.disconnect();
    } catch (e) { /* ignore */ }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
    }
    sourceNode = null;
    analyser = null;
    mediaStream = null;
    audioContext = null;
}

function tick() {
    if (!isRunning || !analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, audioContext.sampleRate);
    if (freq && freq > 20 && freq < 5000) {
        smoothingBuffer.push(freq);
        if (smoothingBuffer.length > SMOOTHING_WINDOW) smoothingBuffer.shift();
        const avg = smoothingBuffer.reduce((a, b) => a + b, 0) / smoothingBuffer.length;
        renderReading(avg);
    } else {
        renderReading(null);
    }
    rafHandle = requestAnimationFrame(tick);
}

function renderReading(freq) {
    const noteEl = document.getElementById('tunerNote');
    const octEl = document.getElementById('tunerOctave');
    const freqEl = document.getElementById('tunerFrequency');
    const needleEl = document.getElementById('tunerNeedle');
    const centsEl = document.getElementById('tunerCents');
    if (!noteEl) return;

    if (!freq) {
        noteEl.textContent = '—';
        noteEl.className = noteEl.className.replace(/text-(green|red|yellow|gray)-500/, 'text-gray-500');
        if (octEl) octEl.textContent = '—';
        if (freqEl) freqEl.textContent = '0.0 Hz';
        if (needleEl) needleEl.style.left = '50%';
        if (centsEl) centsEl.textContent = '0 ¢';
        return;
    }

    const { noteName, octave, cents } = freqToNote(freq);
    noteEl.textContent = noteName;
    if (octEl) octEl.textContent = octave >= 0 ? String(octave) : '—';
    if (freqEl) freqEl.textContent = `${freq.toFixed(1)} Hz`;
    if (needleEl) {
        // Clamp needle to ±50 cents visible range, full width maps to ±100
        const clamped = Math.max(-50, Math.min(50, cents));
        const pct = 50 + clamped; // 0..100
        needleEl.style.left = `${pct}%`;
        const absCents = Math.abs(cents);
        let color = 'bg-yellow-400';
        if (absCents < 5) color = 'bg-green-500';
        else if (absCents > 20) color = 'bg-red-500';
        needleEl.className = needleEl.className.replace(/bg-(green|red|yellow)-\d+/, color);
    }
    if (centsEl) {
        const sign = cents > 0 ? '+' : cents < 0 ? '' : '';
        centsEl.textContent = `${sign}${cents.toFixed(0)} ¢`;
        const absCents = Math.abs(cents);
        let color = 'text-gray-400';
        if (absCents < 5) color = 'text-green-400';
        else if (absCents > 20) color = 'text-red-400';
        centsEl.className = `text-sm mt-1 ${color}`;
    }
    const absCents = Math.abs(cents);
    let noteColor = 'text-gray-300';
    if (absCents < 5) noteColor = 'text-green-400';
    else if (absCents < 20) noteColor = 'text-yellow-400';
    else if (absCents > 20) noteColor = 'text-red-400';
    noteEl.className = noteEl.className.replace(/text-(green|red|yellow|gray)-\d+/, noteColor);
}

function setStatus(msg, color) {
    const statusEl = document.getElementById('tunerStatus');
    if (!statusEl) return;
    statusEl.textContent = msg;
    const colorMap = {
        green: 'text-green-400',
        red: 'text-red-400',
        gray: 'text-gray-400',
        yellow: 'text-yellow-400'
    };
    statusEl.className = `text-xs ${colorMap[color] || 'text-gray-400'}`;
}

/**
 * Convert a frequency (Hz) into a note name, octave, and cents offset from
 * the nearest equal-tempered semitone (A4 = 440 Hz reference).
 * @param {number} freq
 * @returns {{noteName: string, octave: number, cents: number}}
 */
export function freqToNote(freq) {
    const semitonesFromA4 = 12 * Math.log2(freq / A4_FREQ);
    const nearest = Math.round(semitonesFromA4);
    const cents = Math.round((semitonesFromA4 - nearest) * 100);
    // MIDI 69 = A4. NOTE_NAMES index 9 = A
    const midi = 69 + nearest;
    const noteIdx = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return { noteName: NOTE_NAMES[noteIdx], octave, cents };
}

/**
 * Autocorrelation pitch detector. Returns fundamental frequency in Hz, or
 * null if no clear pitch is detected (silent / noisy buffer).
 * @param {Float32Array} buf - time-domain samples in [-1, 1]
 * @param {number} sampleRate
 * @returns {number|null}
 */
export function autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        const v = buf[i];
        rms += v * v;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return null; // too quiet

    // Trim silence from edges to improve detection on short plucks
    let r1 = 0;
    let r2 = SIZE - 1;
    const THRESHOLD = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buf[i]) < THRESHOLD) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buf[SIZE - i]) < THRESHOLD) { r2 = SIZE - i; break; }
    }
    const trimmed = buf.subarray(r1, r2);
    const N = trimmed.length;
    if (N < 32) return null;

    const c = new Float32Array(N);
    for (let lag = 0; lag < N; lag++) {
        let sum = 0;
        for (let i = 0; i < N - lag; i++) {
            sum += trimmed[i] * trimmed[i + lag];
        }
        c[lag] = sum;
    }

    // Find first positive peak after lag 0
    let d = 0;
    while (d < N - 1 && c[d] > c[d + 1]) d++;

    let maxVal = -1;
    let maxPos = -1;
    for (let i = d; i < N; i++) {
        if (c[i] > maxVal) {
            maxVal = c[i];
            maxPos = i;
        }
    }
    if (maxPos <= 0) return null;
    // Parabolic interpolation for sub-sample accuracy
    let T0 = maxPos;
    const x1 = c[T0 - 1] || c[T0];
    const x2 = c[T0];
    const x3 = c[T0 + 1] || c[T0];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    const freq = sampleRate / T0;
    if (!isFinite(freq) || freq <= 0) return null;
    return freq;
}

// Expose on window for ad-hoc debugging / global lookup
if (typeof window !== 'undefined') {
    window.Tuner = {
        initTuner,
        openTunerPanel,
        freqToNote,
        autoCorrelate
    };
}

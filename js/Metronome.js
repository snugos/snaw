// js/Metronome.js - Metronome with audio click and visual beat indication
// Provides a simple metronome with adjustable tempo, time signature, and audio/visual feedback

let metronomeInterval = null;
let currentBeat = 0;
let isRunning = false;

// Click Track Volume Slider (v0.3.77) - panel-side volume control.
import { renderClickTrackVolumePanelSlider, getClickTrackVolume, setClickTrackVolume } from './ClickTrackVolumeSlider.js';

// Audio context for click sounds (lazy init)
let audioContext = null;

function getAudioContext() {
    if (!audioContext && typeof AudioContext !== 'undefined') {
        audioContext = new AudioContext();
    }
    return audioContext;
}

// Sound types for metronome
const SOUND_TYPES = ['classic', 'wooden', 'electronic', 'voice'];
const SOUND_LABELS = {
    'classic': 'Classic',
    'wooden': 'Wooden Block',
    'electronic': 'Electronic',
    'voice': 'Voice Count'
};

// Generate a click sound using Tone.js if available, otherwise Web Audio
// Supports multiple sound types: classic, wooden, electronic, voice
export function playClick(accent = false, soundType = 'classic') {
    const settings = getMetronomeSettings();
    const type = soundType || settings.soundType || 'classic';
    const volume = settings.volume !== undefined ? settings.volume : 0.5;
    
    try {
        // Voice count - use SpeechSynthesis for "1, 2, 3, 4"
        if (type === 'voice') {
            if (typeof window.speechSynthesis !== 'undefined') {
                const utterance = new SpeechSynthesisUtterance(accent ? '1' : (currentBeat % settings.numerator + 1).toString());
                utterance.volume = volume;
                utterance.rate = 1.2;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
            return;
        }
        
        // Web Audio approach for synthesized sounds
        const ctx = getAudioContext();
        if (!ctx) return;
        
        let frequency, oscType, attackTime, decayTime, sustainLevel, releaseTime;
        
        switch (type) {
            case 'wooden':
                // Lower, warmer click like a wood block
                frequency = accent ? 600 : 400;
                oscType = 'triangle';
                attackTime = 0.002;
                decayTime = 0.08;
                sustainLevel = 0.3;
                releaseTime = 0.05;
                break;
            case 'electronic':
                // Clean, sharp digital beep
                frequency = accent ? 1200 : 1000;
                oscType = 'square';
                attackTime = 0.001;
                decayTime = 0.03;
                sustainLevel = 0.1;
                releaseTime = 0.02;
                break;
            case 'classic':
            default:
                // Default balanced click
                frequency = accent ? 1000 : 800;
                oscType = 'sine';
                attackTime = 0.002;
                decayTime = 0.05;
                sustainLevel = 0.2;
                releaseTime = 0.03;
                break;
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        osc.type = oscType;
        
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + attackTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel * volume, 0.001), now + attackTime + decayTime);
        gain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime + releaseTime);
        
        osc.start(now);
        osc.stop(now + attackTime + decayTime + releaseTime + 0.01);
        
        // Also try Tone.js if available for better quality
        if (typeof Tone !== 'undefined') {
            try {
                const toneOsc = new Tone.Oscillator(frequency, oscType).toDestination();
                const toneEnv = new Tone.AmplitudeEnvelope({
                    attack: attackTime,
                    decay: decayTime,
                    sustain: sustainLevel,
                    release: releaseTime
                }).release;
                toneOsc.connect(toneEnv);
                toneEnv.toDestination();
                toneOsc.volume.value = Tone.gainToDb(volume);
                toneOsc.start();
                toneOsc.stop(Tone.now() + attackTime + decayTime + releaseTime + 0.01);
            } catch (e) {
                // Fall back to Web Audio
            }
        }
    } catch (e) {
        // Silently fail if audio not available
    }
}

function tick() {
    const settings = getMetronomeSettings();
    const totalBeats = settings.numerator;
    
    currentBeat = (currentBeat % totalBeats) + 1;
    const isAccent = currentBeat === 1;
    
    if (settings.audioEnabled) {
        playClick(isAccent, settings.soundType);
    }
    
    updateVisualBeat(currentBeat, isAccent, totalBeats);
    
    if (settings.cpuSaver && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {}, { timeout: 5 });
    }
}

function updateVisualBeat(beat, isAccent, total) {
    const indicator = document.getElementById('metronomeBeatIndicator');
    if (!indicator) return;
    
    indicator.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${i === beat ? (isAccent ? '#ef4444' : '#f97316') : '#374151'};
            box-shadow: ${i === beat ? (isAccent ? '0 0 8px #ef4444' : '0 0 8px #f97316') : 'none'};
            transition: all 0.1s ease;
        `;
        indicator.appendChild(dot);
    }
}

function getMetronomeSettings() {
    const globalState = window.state || {};
    return {
        bpm: globalState.metronomeBPM || 120,
        numerator: globalState.metronomeTimeSigTop || 4,
        denominator: globalState.metronomeTimeSigBottom || 4,
        audioEnabled: globalState.metronomeAudioEnabled !== false,
        visualEnabled: globalState.metronomeVisualEnabled !== false,
        cpuSaver: globalState.metronomeCpuSaver || false,
        soundType: globalState.metronomeSoundType || 'classic',
        volume: globalState.metronomeVolume !== undefined ? globalState.metronomeVolume : 0.5,
    };
}

export function setMetronomeSoundType(type) {
    if (SOUND_TYPES.includes(type)) {
        if (window.state) window.state.metronomeSoundType = type;
    }
}

export function getMetronomeSoundType() {
    return getMetronomeSettings().soundType;
}

export function startMetronome() {
    if (isRunning) return;
    
    const settings = getMetronomeSettings();
    const intervalMs = (60 / settings.bpm) * 1000;
    
    isRunning = true;
    currentBeat = 0;
    
    // Immediate first tick
    tick();
    
    metronomeInterval = setInterval(tick, intervalMs);
    updateMetronomeUI(true);
}

export function stopMetronome() {
    if (!isRunning) return;
    
    isRunning = false;
    if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
    }
    updateMetronomeUI(false);
}

export function toggleMetronome() {
    if (isRunning) {
        stopMetronome();
    } else {
        startMetronome();
    }
    return isRunning;
}

export function setMetronomeBPM(bpm) {
    bpm = Math.max(20, Math.min(300, bpm));
    if (window.state) window.state.metronomeBPM = bpm;
    
    if (isRunning) {
        stopMetronome();
        startMetronome();
    }
}

export function setMetronomeTimeSignature(top, bottom) {
    if (window.state) {
        window.state.metronomeTimeSigTop = top;
        window.state.metronomeTimeSigBottom = bottom;
    }
    if (isRunning) {
        stopMetronome();
        startMetronome();
    }
}

function updateMetronomeUI(running) {
    const btn = document.getElementById('metronomeToggle');
    const indicator = document.getElementById('metronomeBeatIndicator');
    if (btn) {
        btn.textContent = running ? 'Stop' : 'Start';
        btn.className = running 
            ? 'px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded'
            : 'px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded';
    }
}

/**
 * Opens the Metronome panel window.
 */
export function openMetronomePanel(savedState = null) {
    const windowId = 'metronome';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMetronomeContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'metronomeContent';
    contentContainer.className = 'p-4 h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-800';

    const options = { width: 300, height: 280, minWidth: 250, minHeight: 220, initialContentKey: windowId, closable: true, minimizable: true, resizable: false };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Metronome', contentContainer, options);
    if (win?.element) {
        renderMetronomeContent();
    }
    return win;
}

function renderMetronomeContent() {
    const container = document.getElementById('metronomeContent');
    if (!container) return;
    
    const settings = getMetronomeSettings();
    const bpm = settings.bpm;
    const top = settings.numerator;
    const bottom = settings.denominator;
    
    container.innerHTML = `
        <div class="flex flex-col items-center gap-4 w-full">
            <div id="metronomeBeatIndicator" class="flex items-center justify-center gap-2 p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm min-h-[40px] w-full">
            </div>
            
            <div class="text-center">
                <div id="metronomeBPMDisplay" class="text-4xl font-bold text-gray-800 dark:text-white">${bpm}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">BPM</div>
            </div>
            
            <div class="flex items-center gap-3">
                <button id="metronomeMinus10" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">-10</button>
                <button id="metronomeMinus1" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">-1</button>
                <button id="metronomeBPMInput" class="px-3 py-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded text-sm font-mono">${bpm}</button>
                <button id="metronomePlus1" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">+1</button>
                <button id="metronomePlus10" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">+10</button>
            </div>
            
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 dark:text-gray-300">Time Sig:</label>
                <select id="metronomeTimeSigTop" class="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-sm">
                    ${[2,3,4,5,6,7,8,9,12].map(n => `<option value="${n}" ${n === top ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
                <span class="text-gray-500">/</span>
                <select id="metronomeTimeSigBottom" class="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-sm">
                    ${[2,4,8,16].map(n => `<option value="${n}" ${n === bottom ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
            </div>
            
            <div class="flex items-center gap-3">
                <button id="metronomeToggle" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded shadow-sm">
                    Start
                </button>
                <button id="metronomeTap" class="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded shadow-sm">
                    Tap
                </button>
            </div>
            
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="metronomeAudioEnabled" ${settings.audioEnabled ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                <span class="text-xs text-gray-600 dark:text-gray-300">Audio Click</span>
            </label>
            
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 dark:text-gray-300">Sound:</label>
                <select id="metronomeSoundType" class="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-sm">
                    ${SOUND_TYPES.map(t => `<option value="${t}" ${settings.soundType === t ? 'selected' : ''}>${SOUND_LABELS[t]}</option>`).join('')}
                </select>
            </div>

            <div id="metronomeClickVolumeContainer" class="w-full px-2"></div>
        </div>
    `;
    
    // Attach event listeners
    document.getElementById('metronomeToggle')?.addEventListener('click', () => {
        toggleMetronome();
        renderMetronomeContent();
    });
    
    document.getElementById('metronomeMinus10')?.addEventListener('click', () => {
        setMetronomeBPM(bpm - 10);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomeMinus1')?.addEventListener('click', () => {
        setMetronomeBPM(bpm - 1);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomePlus1')?.addEventListener('click', () => {
        setMetronomeBPM(bpm + 1);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomePlus10')?.addEventListener('click', () => {
        setMetronomeBPM(bpm + 10);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomeTimeSigTop')?.addEventListener('change', (e) => {
        setMetronomeTimeSignature(parseInt(e.target.value), bottom);
    });
    
    document.getElementById('metronomeTimeSigBottom')?.addEventListener('change', (e) => {
        setMetronomeTimeSignature(top, parseInt(e.target.value));
    });
    
    document.getElementById('metronomeAudioEnabled')?.addEventListener('change', (e) => {
        if (window.state) window.state.metronomeAudioEnabled = e.target.checked;
    });
    
    document.getElementById('metronomeSoundType')?.addEventListener('change', (e) => {
        setMetronomeSoundType(e.target.value);
    });

    // Click Track Volume Slider (v0.3.77) - panel-side row.
    const clickVolContainer = document.getElementById('metronomeClickVolumeContainer');
    if (clickVolContainer && typeof renderClickTrackVolumePanelSlider === 'function') {
        renderClickTrackVolumePanelSlider(clickVolContainer);
    }
    
    // Tap tempo
    let tapTimes = [];
    document.getElementById('metronomeTap')?.addEventListener('click', () => {
        const now = Date.now();
        tapTimes.push(now);
        if (tapTimes.length > 4) tapTimes.shift();
        if (tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < tapTimes.length; i++) {
                intervals.push(tapTimes[i] - tapTimes[i-1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const newBPM = Math.round(60000 / avgInterval);
            if (newBPM >= 20 && newBPM <= 300) {
                setMetronomeBPM(newBPM);
                renderMetronomeContent();
            }
        }
    });
}

// Auto-initialize visual beats on first render
setTimeout(() => {
    updateVisualBeat(0, false, getMetronomeSettings().numerator);
}, 100);
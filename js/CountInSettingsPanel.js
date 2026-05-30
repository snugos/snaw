// js/CountInSettingsPanel.js - Count-In Settings Panel for SnugOS DAW
// Configure count-in bars, sound, and visual countdown

let localAppServices = {};
let countInSettings = {
    bars: 1,
    soundEnabled: true,
    visualCountdown: true,
    accentFirstBeat: true,
    volume: 0.8
};

export function initCountInSettingsPanel(services) {
    localAppServices = services || {};
    loadSettings();
    console.log('[CountInSettingsPanel] Initialized');
}

function loadSettings() {
    try {
        const stored = localStorage.getItem('snugosCountInSettings');
        if (stored) {
            countInSettings = { ...countInSettings, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('[CountInSettingsPanel] Error loading settings:', e);
    }
}

function saveSettings() {
    try {
        localStorage.setItem('snugosCountInSettings', JSON.stringify(countInSettings));
    } catch (e) {
        console.warn('[CountInSettingsPanel] Error saving settings:', e);
    }
}

export function getCountInSettings() {
    return { ...countInSettings };
}

export function setCountInBars(bars) {
    countInSettings.bars = Math.max(0, Math.min(4, parseInt(bars) || 0));
    saveSettings();
    return countInSettings.bars;
}

export function setCountInSoundEnabled(enabled) {
    countInSettings.soundEnabled = !!enabled;
    saveSettings();
}

export function setCountInVisualCountdown(enabled) {
    countInSettings.visualCountdown = !!enabled;
    saveSettings();
}

export function setCountInAccentFirstBeat(enabled) {
    countInSettings.accentFirstBeat = !!enabled;
    saveSettings();
}

export function setCountInVolume(volume) {
    countInSettings.volume = Math.max(0, Math.min(1, volume));
    saveSettings();
}

export function openCountInSettingsPanel() {
    const windowId = 'countInSettings';
    const getOpenWindows = localAppServices.getOpenWindows?.() || new Map();

    if (getOpenWindows.has(windowId)) {
        const win = getOpenWindows.get(windowId);
        win.restore();
        renderCountInContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'countInSettingsContent';
    contentContainer.className = 'p-4 bg-gray-100 dark:bg-slate-800 h-full overflow-y-auto';

    const options = {
        width: 380, height: 350, minWidth: 320, minHeight: 280,
        initialContentKey: windowId, closable: true, minimizable: true, resizable: true
    };

    const win = localAppServices.createWindow?.(windowId, 'Count-In Settings', contentContainer, options);
    if (win?.element) {
        renderCountInContent();
    }
    return win;
}

function renderCountInContent() {
    const container = document.getElementById('countInSettingsContent');
    if (!container) return;

    container.innerHTML = `
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Configure the count-in that plays before recording starts.
        </div>

        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Count-In Bars</span>
                <select id="countInBarsSelect" class="bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded px-2 py-1 text-sm">
                    <option value="0" ${countInSettings.bars === 0 ? 'selected' : ''}>Off</option>
                    <option value="1" ${countInSettings.bars === 1 ? 'selected' : ''}>1 Bar</option>
                    <option value="2" ${countInSettings.bars === 2 ? 'selected' : ''}>2 Bars</option>
                    <option value="4" ${countInSettings.bars === 4 ? 'selected' : ''}>4 Bars</option>
                </select>
            </div>
            <p class="text-xs text-gray-500">Number of bars to count before recording begins</p>
        </div>

        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="space-y-3">
                <label class="flex items-center justify-between cursor-pointer">
                    <div>
                        <span class="text-sm text-gray-700 dark:text-gray-300">Sound</span>
                        <p class="text-xs text-gray-500">Play metronome clicks during count-in</p>
                    </div>
                    <input type="checkbox" id="countInSoundEnabled" ${countInSettings.soundEnabled ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                    <div>
                        <span class="text-sm text-gray-700 dark:text-gray-300">Visual Countdown</span>
                        <p class="text-xs text-gray-500">Show count numbers on screen</p>
                    </div>
                    <input type="checkbox" id="countInVisualEnabled" ${countInSettings.visualCountdown ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                    <div>
                        <span class="text-sm text-gray-700 dark:text-gray-300">Accent First Beat</span>
                        <p class="text-xs text-gray-500">Use louder sound on downbeat</p>
                    </div>
                    <input type="checkbox" id="countInAccentEnabled" ${countInSettings.accentFirstBeat ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                </label>
            </div>
        </div>

        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-700 dark:text-gray-300">Volume</span>
                <span id="countInVolumeValue" class="text-xs text-gray-500">${Math.round(countInSettings.volume * 100)}%</span>
            </div>
            <input type="range" id="countInVolumeSlider" min="0" max="100" value="${Math.round(countInSettings.volume * 100)}" class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
        </div>

        <div class="p-3 bg-gray-200 dark:bg-slate-600 rounded">
            <div class="flex items-center justify-between">
                <span class="text-xs text-gray-600 dark:text-gray-400">Preview</span>
                <button id="countInPreviewBtn" class="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded font-medium" ${countInSettings.bars === 0 ? 'disabled' : ''}>
                    Play Count-In
                </button>
            </div>
        </div>
    `;

    // Event listeners
    container.querySelector('#countInBarsSelect')?.addEventListener('change', (e) => {
        setCountInBars(parseInt(e.target.value));
        localAppServices.showNotification?.(`Count-in set to ${e.target.value === '0' ? 'off' : e.target.value + ' bar(s)'}, 1500);
    });

    container.querySelector('#countInSoundEnabled')?.addEventListener('change', (e) => {
        setCountInSoundEnabled(e.target.checked);
    });

    container.querySelector('#countInVisualEnabled')?.addEventListener('change', (e) => {
        setCountInVisualCountdown(e.target.checked);
    });

    container.querySelector('#countInAccentEnabled')?.addEventListener('change', (e) => {
        setCountInAccentFirstBeat(e.target.checked);
    });

    container.querySelector('#countInVolumeSlider')?.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value, 10) / 100;
        setCountInVolume(vol);
        container.querySelector('#countInVolumeValue').textContent = `${Math.round(vol * 100)}%`;
    });

    container.querySelector('#countInPreviewBtn')?.addEventListener('click', async () => {
        if (countInSettings.bars === 0) return;
        const { playCountIn } = await import('./CountInAudio.js');
        const tempo = localAppServices.getTempoState?.() || 120;
        playCountIn(() => {
            localAppServices.showNotification?.('Count-in preview complete', 1000);
        }, tempo);
    });
}
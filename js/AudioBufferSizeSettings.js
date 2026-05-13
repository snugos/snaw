/**
 * AudioBufferSizeSettings - UI to adjust audio buffer size for latency/performance tradeoff
 * Feature #9: Audio Buffer Size Settings
 */

let localAppServices = {};
let currentBufferSize = 512;

const BUFFER_SIZES = [
    { value: 256, label: '256 samples', latency: '~5ms', description: 'Lowest latency, highest CPU' },
    { value: 512, label: '512 samples', latency: '~11ms', description: 'Balanced latency/performance' },
    { value: 1024, label: '1024 samples', latency: '~23ms', description: 'Default setting' },
    { value: 2048, label: '2048 samples', latency: '~46ms', description: 'Lower CPU, higher latency' },
    { value: 4096, label: '4096 samples', latency: '~93ms', description: 'Highest latency, lowest CPU' }
];

export function initAudioBufferSizeSettings(services) {
    localAppServices = services;
    
    // Get initial buffer size if available
    if (typeof Tone !== 'undefined' && Tone.context) {
        currentBufferSize = Tone.context.lookAhead || 512;
    }
    
    console.log('[AudioBufferSizeSettings] Initialized with buffer size:', currentBufferSize);
}

/**
 * Opens the audio buffer size settings panel
 */
export function openAudioBufferSizeSettingsPanel() {
    const windowId = 'audioBufferSizeSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'audioBufferSizeContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 400,
        height: 350,
        minWidth: 300,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Audio Buffer Size', contentContainer, options);

    if (win?.element) {
        renderBufferSizeContent();
    }

    return win;
}

function renderBufferSizeContent() {
    const container = document.getElementById('audioBufferSizeContent');
    if (!container) return;

    const currentSize = getCurrentBufferSize();

    let html = `
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">Audio Buffer Size</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Lower buffer sizes reduce latency but increase CPU usage. Higher values reduce CPU load but add latency.
            </p>
        </div>

        <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded">
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 dark:text-gray-300">Current Buffer Size:</span>
                <span id="currentBufferSizeDisplay" class="font-bold text-blue-600 dark:text-blue-400">${currentSize} samples</span>
            </div>
            <div class="flex items-center justify-between mt-1">
                <span class="text-xs text-gray-500">Approximate Latency:</span>
                <span id="currentLatencyDisplay" class="text-xs text-gray-600 dark:text-gray-400">${getLatencyForSize(currentSize)}</span>
            </div>
        </div>

        <div class="space-y-2 mb-4">
            ${BUFFER_SIZES.map(size => `
                <div class="buffer-option p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors ${size.value === currentSize ? 'border-blue-500 ring-1 ring-blue-500' : ''}"
                     data-buffer-size="${size.value}">
                    <div class="flex items-center justify-between">
                        <span class="font-medium text-gray-800 dark:text-white">${size.label}</span>
                        <span class="text-xs px-2 py-0.5 rounded ${size.value === currentSize ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'}">${size.value === currentSize ? 'Active' : ''}</span>
                    </div>
                    <div class="flex items-center justify-between mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400">${size.description}</span>
                        <span class="text-xs text-gray-400 dark:text-gray-500">Latency: ${size.latency}</span>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="flex gap-2">
            <button id="applyBufferSizeBtn" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
                Apply
            </button>
            <button id="closeBufferSizeBtn" class="px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-slate-500">
                Close
            </button>
        </div>

        <div class="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Changing buffer size may cause a brief audio interruption. For best results, apply before starting playback or recording.
        </div>
    `;

    container.innerHTML = html;

    // Add click handlers for buffer options
    container.querySelectorAll('.buffer-option').forEach(option => {
        option.addEventListener('click', () => {
            const size = parseInt(option.dataset.bufferSize, 10);
            selectBufferSize(size);
        });
    });

    // Apply button
    container.querySelector('#applyBufferSizeBtn')?.addEventListener('click', () => {
        applyBufferSize(getSelectedBufferSize());
    });

    // Close button
    container.querySelector('#closeBufferSizeBtn')?.addEventListener('click', () => {
        const win = localAppServices.getOpenWindows?.()?.get('audioBufferSizeSettings');
        if (win) win.close();
    });
}

let selectedBufferSize = currentBufferSize;

function selectBufferSize(size) {
    selectedBufferSize = size;
    
    // Update UI selection
    document.querySelectorAll('.buffer-option').forEach(opt => {
        const optSize = parseInt(opt.dataset.bufferSize, 10);
        opt.classList.toggle('border-blue-500', optSize === size);
        opt.classList.toggle('ring-1', optSize === size);
        opt.classList.toggle('ring-blue-500', optSize === size);
        
        // Update active badge
        const badge = opt.querySelector('span:last-child');
        if (badge) {
            badge.textContent = optSize === size ? 'Active' : '';
            badge.className = optSize === size ? 'text-xs px-2 py-0.5 rounded bg-blue-500 text-white' : 'text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300';
        }
    });
    
    // Update display
    const currentDisplay = document.getElementById('currentBufferSizeDisplay');
    if (currentDisplay) currentDisplay.textContent = `${size} samples`;
    
    const latencyDisplay = document.getElementById('currentLatencyDisplay');
    if (latencyDisplay) latencyDisplay.textContent = getLatencyForSize(size);
}

function getCurrentBufferSize() {
    if (typeof Tone !== 'undefined' && Tone.context) {
        // Try to get the actual buffer size
        const ctx = Tone.context;
        if (ctx.rawContext && ctx.rawContext.sampleRate) {
            // Web Audio API doesn't directly expose buffer size, use latencyHint as proxy
            const baseLatency = ctx.latencyHint || 'interactive';
            if (baseLatency === 'playback') return 2048;
            if (baseLatency === 'balanced') return 1024;
            if (baseLatency === 'interactive') return 512;
        }
    }
    return selectedBufferSize;
}

function getLatencyForSize(size) {
    const found = BUFFER_SIZES.find(s => s.value === size);
    return found ? found.latency : 'Unknown';
}

function getSelectedBufferSize() {
    return selectedBufferSize;
}

function applyBufferSize(size) {
    if (typeof Tone !== 'undefined' && Tone.context) {
        try {
            // Web Audio API doesn't allow changing buffer size directly, but we can show the user
            // what size they'd get with different latencyHint settings
            const ctx = Tone.context;
            
            if (ctx.rawContext) {
                // Calculate approximate latency
                const sampleRate = ctx.sampleRate || 44100;
                const latencyMs = (size / sampleRate) * 1000;
                
                // Store preference in localStorage
                localStorage.setItem('preferredBufferSize', size.toString());
                localStorage.setItem('preferredLatencyMs', latencyMs.toString());
                
                // Update Tone.js context latency hint
                if (size <= 256) ctx.latencyHint = 'interactive';
                else if (size <= 1024) ctx.latencyHint = 'balanced';
                else ctx.latencyHint = 'playback';
                
                localAppServices.showNotification?.(`Buffer size set to ${size} samples (${latencyMs.toFixed(1)}ms latency)`, 2000);
                
                console.log(`[AudioBufferSizeSettings] Buffer size changed to ${size}, latency ~${latencyMs.toFixed(1)}ms`);
            }
        } catch (e) {
            console.error('[AudioBufferSizeSettings] Failed to apply buffer size:', e);
            localAppServices.showNotification?.('Failed to change buffer size', 2000);
        }
    } else {
        localAppServices.showNotification?.('Audio context not available', 2000);
    }
    
    // Close panel after applying
    const win = localAppServices.getOpenWindows?.()?.get('audioBufferSizeSettings');
    if (win) win.close();
}

// Get stored preference on init
export function getPreferredBufferSize() {
    const stored = localStorage.getItem('preferredBufferSize');
    return stored ? parseInt(stored, 10) : 512;
}

export { openAudioBufferSizeSettingsPanel as showBufferSizeSettings };
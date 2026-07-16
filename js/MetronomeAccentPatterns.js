const STORAGE_KEY = 'snaw_metronome_accent_pattern';
const DEFAULT_PATTERN = [true, false, false, false];
const PATTERNS = [
    { id: 'downbeat', name: 'Downbeat', pattern: [true, false, false, false], label: '1---' },
    { id: 'one-three', name: 'One & Three', pattern: [true, false, true, false], label: '1-3-' },
    { id: 'two-four', name: 'Two & Four', pattern: [false, true, false, true], label: '-2-4' },
    { id: 'all', name: 'All Beats', pattern: [true, true, true, true], label: '1234' }
];

let accentPattern = [...DEFAULT_PATTERN];
let initialized = false;
let transportButton = null;
let notification = null;

function samePattern(left, right) {
    return Array.isArray(left) && left.length === right.length && left.every((value, index) => !!value === right[index]);
}

function loadPattern() {
    if (typeof localStorage === 'undefined') return;
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        const storedPattern = Array.isArray(saved) ? saved : saved?.pattern;
        if (Array.isArray(storedPattern) && storedPattern.length === 4) {
            accentPattern = storedPattern.map(Boolean);
        }
    } catch (_) {
        accentPattern = [...DEFAULT_PATTERN];
    }
}

function persistPattern() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accentPattern));
    } catch (_) {
    }
}

function getCurrentPreset() {
    return PATTERNS.find((preset) => samePattern(preset.pattern, accentPattern)) || {
        name: 'Custom',
        label: accentPattern.map((accent, index) => accent ? String(index + 1) : '-').join('')
    };
}

function updateTransportButton() {
    if (!transportButton) return;
    const preset = getCurrentPreset();
    transportButton.textContent = `Accent: ${preset.label}`;
    transportButton.title = `Metronome accent pattern: ${preset.name}. Click to cycle patterns.`;
    transportButton.setAttribute('aria-label', `Metronome accent pattern ${preset.name}, ${preset.label}. Click to cycle patterns.`);
}

export function isBeatAccented(beatNumber, totalBeats = 4) {
    if (!initialized) {
        loadPattern();
        initialized = true;
    }
    const normalizedBeat = Math.max(1, Number(beatNumber) || 1);
    const index = (Math.floor(normalizedBeat) - 1) % accentPattern.length;
    return !!accentPattern[index];
}

export function getAccentPattern() {
    if (!initialized) {
        loadPattern();
        initialized = true;
    }
    return [...accentPattern];
}

export function getAccentPatternPresets() {
    return PATTERNS.map((preset) => ({ ...preset, pattern: [...preset.pattern] }));
}

export function setAccentPattern(pattern) {
    if (!Array.isArray(pattern) || pattern.length !== 4) return false;
    accentPattern = pattern.map(Boolean);
    initialized = true;
    persistPattern();
    updateTransportButton();
    return true;
}

export function cycleAccentPattern() {
    const currentIndex = PATTERNS.findIndex((preset) => samePattern(preset.pattern, accentPattern));
    const next = PATTERNS[(currentIndex + 1 + PATTERNS.length) % PATTERNS.length];
    setAccentPattern(next.pattern);
    notification?.(`Metronome accents: ${next.name}`, 1500);
    return [...next.pattern];
}

export function initMetronomeAccentPatterns(appServices = {}) {
    if (initialized && transportButton?.isConnected) {
        updateTransportButton();
        return;
    }
    loadPattern();
    initialized = true;
    notification = typeof appServices.showNotification === 'function' ? appServices.showNotification : null;
    transportButton = document.getElementById('metronomeAccentToggleBtnGlobal');
    if (transportButton && !transportButton.dataset.accentPatternBound) {
        transportButton.dataset.accentPatternBound = 'true';
        transportButton.addEventListener('click', cycleAccentPattern);
    }
    updateTransportButton();
}

if (typeof window !== 'undefined') {
    window.MetronomeAccentPatterns = {
        initMetronomeAccentPatterns,
        isBeatAccented,
        getAccentPattern,
        getAccentPatternPresets,
        setAccentPattern,
        cycleAccentPattern
    };
}

export default {
    initMetronomeAccentPatterns,
    isBeatAccented,
    getAccentPattern,
    getAccentPatternPresets,
    setAccentPattern,
    cycleAccentPattern
};

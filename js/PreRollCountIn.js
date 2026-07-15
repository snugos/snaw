let localAppServices = {};
let enabled = false;
let running = false;

function loadSetting() {
    try {
        enabled = localStorage.getItem('snugosPreRollCountIn') === '1';
    } catch (_) {
        enabled = false;
    }
}

function saveSetting() {
    try {
        localStorage.setItem('snugosPreRollCountIn', enabled ? '1' : '0');
    } catch (_) {}
}

function updateButton() {
    const button = document.getElementById('preRollCountInBtn');
    if (!button) return;
    button.textContent = `Pre-roll: ${enabled ? 'On' : 'Off'}`;
    button.classList.toggle('playing', enabled);
    button.setAttribute('aria-pressed', String(enabled));
}

export function initPreRollCountIn(services) {
    localAppServices = services || {};
    loadSetting();
    const button = document.getElementById('preRollCountInBtn');
    if (button && !button.dataset.preRollBound) {
        button.dataset.preRollBound = '1';
        button.addEventListener('click', () => {
            enabled = !enabled;
            saveSetting();
            updateButton();
            localAppServices.showNotification?.(`Pre-roll count-in ${enabled ? 'enabled' : 'disabled'}`, 1200);
        });
    }
    updateButton();
}

export function isPreRollCountInEnabled() {
    return enabled;
}

export function runPreRollCountIn(onComplete) {
    if (!enabled || running) {
        onComplete?.();
        return;
    }
    running = true;
    const bpm = Number(typeof Tone !== 'undefined' && Tone.Transport?.bpm?.value) || 120;
    const playFixedCountIn = localAppServices.playFixedCountIn;
    if (typeof playFixedCountIn !== 'function') {
        running = false;
        onComplete?.();
        return;
    }
    localAppServices.showNotification?.('Pre-roll: one bar click-in', 1200);
    try {
        playFixedCountIn(() => {
            running = false;
            onComplete?.();
        }, bpm, 1);
    } catch (error) {
        running = false;
        localAppServices.showNotification?.('Pre-roll unavailable; starting recording.', 1500);
        onComplete?.();
    }
}

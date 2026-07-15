const STORAGE_KEY = 'snaw_recent_project_files';
const MAX_ENTRIES = 5;
const SUBMENU_ID = 'recentProjectFilesSubmenu';

let localAppServices = {};

function normalizeName(name) {
    if (typeof name !== 'string') return '';
    const trimmed = name.trim();
    return trimmed.length > 160 ? trimmed.slice(0, 157) + '...' : trimmed;
}

function readEntries() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(entry => {
            if (typeof entry === 'string') return { name: normalizeName(entry), source: 'recent', timestamp: 0 };
            return {
                name: normalizeName(entry?.name),
                source: entry?.source === 'loaded' ? 'loaded' : 'saved',
                timestamp: Number(entry?.timestamp) || 0
            };
        }).filter(entry => entry.name).slice(0, MAX_ENTRIES);
    } catch (_) {
        return [];
    }
}

function writeEntries(entries) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    } catch (_) {
        return false;
    }
    return true;
}

function notify(message, duration = 2200) {
    try {
        localAppServices.showNotification?.(message, duration);
    } catch (_) {}
}

function formatDate(timestamp) {
    if (!timestamp) return 'Recent project file';
    try {
        return new Date(timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
        return 'Recent project file';
    }
}

function renderRecentProjectFiles() {
    const submenu = document.getElementById(SUBMENU_ID);
    if (!submenu) return;
    submenu.replaceChildren();
    const entries = readEntries();

    if (!entries.length) {
        const empty = document.createElement('li');
        empty.className = 'recent-project-empty';
        empty.textContent = 'No recent project files';
        submenu.appendChild(empty);
    } else {
        entries.forEach(entry => {
            const item = document.createElement('li');
            item.className = 'recent-project-entry';
            item.textContent = entry.name;
            item.title = `${entry.source === 'loaded' ? 'Loaded' : 'Saved'} ${formatDate(entry.timestamp)}`;
            item.addEventListener('click', (event) => {
                event.stopPropagation();
                notify(`Recent file: ${entry.name}. Use Load Project to choose it again.`);
            });
            submenu.appendChild(item);
        });

        const separator = document.createElement('li');
        separator.className = 'recent-project-separator';
        separator.setAttribute('aria-hidden', 'true');
        submenu.appendChild(separator);

        const clear = document.createElement('li');
        clear.className = 'recent-project-clear';
        clear.textContent = 'Clear Recent';
        clear.addEventListener('click', (event) => {
            event.stopPropagation();
            clearRecentProjectFiles();
        });
        submenu.appendChild(clear);
    }
}

export function getRecentProjectFiles() {
    return readEntries().map(entry => ({ ...entry }));
}

export function recordRecentProjectFile(name, source = 'saved') {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;
    const entries = readEntries().filter(entry => entry.name.toLowerCase() !== normalizedName.toLowerCase());
    entries.unshift({
        name: normalizedName,
        source: source === 'loaded' ? 'loaded' : 'saved',
        timestamp: Date.now()
    });
    const saved = writeEntries(entries);
    renderRecentProjectFiles();
    return saved;
}

export function clearRecentProjectFiles() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    renderRecentProjectFiles();
    notify('Recent project files cleared.', 1800);
}

export function initRecentProjectFileHistory(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    renderRecentProjectFiles();
    if (typeof window !== 'undefined') {
        window.getRecentProjectFiles = getRecentProjectFiles;
        window.clearRecentProjectFiles = clearRecentProjectFiles;
    }
}

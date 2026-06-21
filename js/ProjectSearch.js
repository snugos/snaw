// js/ProjectSearch.js - Global search across the project for SnugOS DAW
// Open a panel that searches every track name, every clip name, and every
// per-track note for a substring. Clicking a result scrolls the matching
// track into view and flashes a highlight on the matched track header.
// Search is case-insensitive and runs entirely in memory against the live
// track list (no separate persistence — the live state IS the source of truth).

const PANEL_ID = 'project-search-panel';
const MAX_RESULTS_PER_KIND = 50;
const HIGHLIGHT_DURATION_MS = 1500;

let localAppServices = {};
let panel = null;
let searchQuery = '';
let lastResults = null;

function safeTracks() {
    try {
        if (localAppServices && typeof localAppServices.getAllTracks === 'function') {
            const t = localAppServices.getAllTracks();
            return Array.isArray(t) ? t : [];
        }
        if (typeof getTracksState === 'function') return getTracksState() || [];
    } catch (e) { /* ignore */ }
    return [];
}

function safeNotes() {
    try {
        if (typeof window !== 'undefined' && typeof window.getAllNotes === 'function') {
            return window.getAllNotes() || [];
        }
        if (localAppServices && typeof localAppServices.getAllTrackNotes === 'function') {
            return localAppServices.getAllTrackNotes() || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function matches(haystack, needle) {
    if (!needle) return true;
    if (haystack === null || haystack === undefined) return false;
    return String(haystack).toLowerCase().indexOf(needle) !== -1;
}

function buildResults(query) {
    const q = String(query || '').toLowerCase().trim();
    const tracks = safeTracks();
    const notes = safeNotes();
    const trackResults = [];
    const clipResults = [];
    const noteResults = [];

    tracks.forEach((track) => {
        if (!track) return;
        const id = track.id != null ? String(track.id) : null;
        const name = track.name || '';
        const type = track.type || '';
        if (!q || matches(name, q) || matches(type, q)) {
            trackResults.push({
                kind: 'track',
                trackId: id,
                trackName: name,
                trackType: type,
                snippet: name,
                matchField: q && matches(type, q) && !matches(name, q) ? `type: ${type}` : null
            });
        }
        const clips = Array.isArray(track.timelineClips) ? track.timelineClips : [];
        clips.forEach((clip) => {
            if (!clip) return;
            const cName = clip.name || '';
            const cType = clip.type || '';
            if (!q || matches(cName, q) || matches(cType, q)) {
                clipResults.push({
                    kind: 'clip',
                    trackId: id,
                    trackName: name,
                    clipId: clip.id != null ? String(clip.id) : null,
                    clipName: cName,
                    clipType: cType,
                    snippet: cName || `(unnamed ${cType || 'clip'})`,
                    matchField: q && matches(cType, q) && !matches(cName, q) ? `type: ${cType}` : null
                });
            }
        });
    });

    notes.forEach((entry) => {
        if (!entry) return;
        const text = entry.text || '';
        if (!q || matches(text, q)) {
            let resolvedName = entry.trackName || null;
            if (!resolvedName && entry.trackId != null) {
                const t = tracks.find(tr => String(tr.id) === String(entry.trackId));
                if (t) resolvedName = t.name;
            }
            noteResults.push({
                kind: 'note',
                trackId: entry.trackId != null ? String(entry.trackId) : null,
                trackName: resolvedName || entry.trackId,
                snippet: text,
                color: entry.color || '#3b82f6',
                timestamp: entry.timestamp || null
            });
        }
    });

    const truncated =
        (trackResults.length > MAX_RESULTS_PER_KIND) ||
        (clipResults.length > MAX_RESULTS_PER_KIND) ||
        (noteResults.length > MAX_RESULTS_PER_KIND);

    return {
        query: q,
        tracks: trackResults.slice(0, MAX_RESULTS_PER_KIND),
        clips: clipResults.slice(0, MAX_RESULTS_PER_KIND),
        notes: noteResults.slice(0, MAX_RESULTS_PER_KIND),
        totalCount: trackResults.length + clipResults.length + noteResults.length,
        truncated
    };
}

function highlightTrack(trackId) {
    if (!trackId) return;
    let el = document.querySelector(`[data-track-id="${trackId}"]`);
    if (!el) {
        el = document.querySelector(`.phase-track[data-track-id="${trackId}"]`);
    }
    if (!el) {
        try {
            const tracks = safeTracks();
            const t = tracks.find(tr => String(tr.id) === String(trackId));
            if (t && t.name) {
                const candidates = document.querySelectorAll('[data-track-id]');
                candidates.forEach((node) => {
                    const header = node.querySelector('.track-header, .track-name, .track-info');
                    if (header && header.textContent && header.textContent.indexOf(t.name) !== -1) {
                        el = node;
                    }
                });
            }
        } catch (e) { /* ignore */ }
    }
    if (!el) return;
    const original = el.style.boxShadow;
    el.style.transition = 'box-shadow 0.2s ease';
    el.style.boxShadow = '0 0 0 3px #fbbf24, 0 0 18px rgba(251, 191, 36, 0.6)';
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
    setTimeout(() => {
        try {
            el.style.boxShadow = original || '';
        } catch (e) { /* ignore */ }
    }, HIGHLIGHT_DURATION_MS);
}

function jumpToResult(result) {
    if (!result || !result.trackId) {
        if (localAppServices && typeof localAppServices.showNotification === 'function') {
            localAppServices.showNotification('No track to jump to', 1500);
        }
        return;
    }
    highlightTrack(result.trackId);
    if (localAppServices && typeof localAppServices.showNotification === 'function') {
        const label = result.kind === 'clip'
            ? `Clip: ${result.clipName || result.clipType || 'clip'}`
            : result.kind === 'note'
                ? 'Track note'
                : 'Track';
        localAppServices.showNotification(`Jumped to: ${result.trackName || result.trackId} · ${label}`, 1500);
    }
}

function truncateSnippet(text, maxLen) {
    const s = String(text == null ? '' : text);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + '…';
}

function makeResultCard(result, query) {
    const wrap = document.createElement('div');
    wrap.className = 'ps-result';
    wrap.style.cssText = [
        'background:#1a1a2e',
        'border-radius:6px',
        'padding:8px 10px',
        'cursor:pointer',
        'transition:background 0.1s',
        'display:flex',
        'flex-direction:column',
        'gap:3px'
    ].join(';');
    wrap.addEventListener('mouseenter', () => { wrap.style.background = '#22223a'; });
    wrap.addEventListener('mouseleave', () => { wrap.style.background = '#1a1a2e'; });
    wrap.addEventListener('click', () => jumpToResult(result));

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';

    const label = document.createElement('span');
    label.style.cssText = 'color:#fff;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
    if (result.kind === 'clip') {
        label.textContent = `${result.trackName || 'Track'} → ${result.clipName || '(unnamed clip)'}`;
    } else if (result.kind === 'note') {
        label.textContent = `${result.trackName || 'Track'} · note`;
    } else {
        label.textContent = result.trackName || `Track ${result.trackId}`;
    }
    top.appendChild(label);

    const badge = document.createElement('span');
    badge.style.cssText = [
        'font-size:10px',
        'padding:2px 6px',
        'border-radius:3px',
        'background:#333',
        'color:#ccc',
        'flex-shrink:0'
    ].join(';');
    if (result.kind === 'clip') {
        badge.textContent = result.clipType || 'clip';
        badge.style.background = '#1d3a5f';
        badge.style.color = '#7dd3fc';
    } else if (result.kind === 'note') {
        badge.textContent = 'note';
        badge.style.background = (result.color || '#3b82f6');
        badge.style.color = '#fff';
    } else {
        badge.textContent = result.trackType || 'track';
        badge.style.background = '#3a2a5e';
        badge.style.color = '#c4b5fd';
    }
    top.appendChild(badge);
    wrap.appendChild(top);

    if (result.matchField) {
        const meta = document.createElement('div');
        meta.textContent = result.matchField;
        meta.style.cssText = 'color:#888;font-size:10px;';
        wrap.appendChild(meta);
    } else if (result.kind === 'note' && result.snippet) {
        const snippet = document.createElement('div');
        snippet.textContent = truncateSnippet(result.snippet, 140);
        snippet.style.cssText = 'color:#bbb;font-size:11px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;';
        wrap.appendChild(snippet);
    }

    return wrap;
}

function renderSection(container, title, items, kind, query) {
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #222;padding-bottom:4px;';
    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    header.appendChild(titleEl);
    const countEl = document.createElement('span');
    countEl.textContent = `${items.length} match${items.length === 1 ? '' : 'es'}`;
    countEl.style.cssText = 'color:#666;font-size:10px;text-transform:none;letter-spacing:0;';
    header.appendChild(countEl);
    section.appendChild(header);

    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = `No ${kind} matches`;
        empty.style.cssText = 'color:#555;font-size:11px;font-style:italic;padding:4px 0 8px;';
        section.appendChild(empty);
    } else {
        items.forEach((item) => section.appendChild(makeResultCard(item, query)));
    }
    container.appendChild(section);
}

function renderResults(container, results) {
    container.innerHTML = '';
    if (!results.query) {
        const hint = document.createElement('div');
        hint.textContent = 'Type to search track names, clip names, and track notes.';
        hint.style.cssText = 'color:#666;text-align:center;padding:24px 12px;font-size:12px;line-height:1.5;';
        container.appendChild(hint);
        return;
    }
    if (results.totalCount === 0) {
        const empty = document.createElement('div');
        empty.textContent = `No matches for "${results.query}".`;
        empty.style.cssText = 'color:#666;text-align:center;padding:24px 12px;font-size:12px;';
        container.appendChild(empty);
        return;
    }
    renderSection(container, 'Tracks', results.tracks, 'track', results.query);
    renderSection(container, 'Clips', results.clips, 'clip', results.query);
    renderSection(container, 'Notes', results.notes, 'note', results.query);
    if (results.truncated) {
        const note = document.createElement('div');
        note.textContent = `Showing first ${MAX_RESULTS_PER_KIND} of each kind.`;
        note.style.cssText = 'color:#666;font-size:10px;text-align:center;padding:6px;font-style:italic;';
        container.appendChild(note);
    }
}

function refreshResults() {
    if (!panel) return;
    lastResults = buildResults(searchQuery);
    const list = panel.querySelector('.ps-list');
    const counter = panel.querySelector('.ps-counter');
    if (list) renderResults(list, lastResults);
    if (counter) {
        counter.textContent = searchQuery
            ? `${lastResults.totalCount} result${lastResults.totalCount === 1 ? '' : 's'}`
            : `${safeTracks().length} tracks · ${safeTracks().reduce((n, t) => n + (Array.isArray(t && t.timelineClips) ? t.timelineClips.length : 0), 0)} clips`;
    }
}

export function initProjectSearch(services) {
    localAppServices = services || {};
    console.log('[ProjectSearch] Initialized');
}

export function searchProject(query) {
    return buildResults(query);
}

export function isProjectSearchPanelOpen() {
    return !!panel;
}

export function setProjectSearchPanelOpen(open) {
    if (open) openProjectSearchPanel();
    else closeProjectSearchPanel();
}

export function openProjectSearchPanel() {
    if (panel) {
        panel.remove();
        panel = null;
        return;
    }

    const wrap = document.createElement('div');
    wrap.id = PANEL_ID;
    wrap.style.cssText = [
        'position:fixed',
        'right:20px',
        'top:80px',
        'width:380px',
        'max-height:540px',
        'background:#0f0f1a',
        'border:1px solid #333',
        'border-radius:8px',
        'padding:14px',
        'z-index:9000',
        'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
        'display:flex',
        'flex-direction:column',
        'gap:10px',
        'color:#fff',
        'font-family:inherit'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    const title = document.createElement('h3');
    title.textContent = 'Project Search';
    title.style.cssText = 'color:#fff;margin:0;font-size:15px;font-weight:600;';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => {
        wrap.remove();
        panel = null;
    });
    header.appendChild(closeBtn);
    wrap.appendChild(header);

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search tracks, clips, notes…';
    search.value = searchQuery || '';
    search.style.cssText = [
        'width:100%',
        'padding:9px 10px',
        'background:#1a1a2e',
        'border:1px solid #333',
        'border-radius:4px',
        'color:#fff',
        'font-size:13px',
        'box-sizing:border-box',
        'font-family:inherit',
        'outline:none'
    ].join(';');
    search.addEventListener('focus', () => { search.style.borderColor = '#3b82f6'; });
    search.addEventListener('blur', () => { search.style.borderColor = '#333'; });
    search.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        refreshResults();
    });
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (searchQuery) {
                searchQuery = '';
                search.value = '';
                refreshResults();
            } else {
                wrap.remove();
                panel = null;
            }
            e.stopPropagation();
        } else if (e.key === 'Enter') {
            const first = wrap.querySelector('.ps-result');
            if (first) first.click();
        }
    });
    wrap.appendChild(search);

    const counter = document.createElement('div');
    counter.className = 'ps-counter';
    counter.style.cssText = 'color:#666;font-size:11px;';
    wrap.appendChild(counter);

    const list = document.createElement('div');
    list.className = 'ps-list';
    list.style.cssText = 'display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1;min-height:140px;padding-right:2px;';
    wrap.appendChild(list);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#555;border-top:1px solid #222;padding-top:8px;';
    const hint = document.createElement('span');
    hint.textContent = 'Enter jumps to first · Esc clears/closes';
    footer.appendChild(hint);
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.style.cssText = 'background:#222;border:1px solid #333;color:#ccc;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;';
    refreshBtn.addEventListener('click', () => refreshResults());
    footer.appendChild(refreshBtn);
    wrap.appendChild(footer);

    document.body.appendChild(wrap);
    panel = wrap;
    refreshResults();
    setTimeout(() => { try { search.focus(); search.select(); } catch (e) { /* ignore */ } }, 30);
}

export function closeProjectSearchPanel() {
    if (panel) {
        panel.remove();
        panel = null;
    }
}

if (typeof window !== 'undefined') {
    window.initProjectSearch = initProjectSearch;
    window.searchProject = searchProject;
    window.openProjectSearchPanel = openProjectSearchPanel;
    window.closeProjectSearchPanel = closeProjectSearchPanel;
    window.isProjectSearchPanelOpen = isProjectSearchPanelOpen;
    window.setProjectSearchPanelOpen = setProjectSearchPanelOpen;
    window.projectSearch = {
        init: initProjectSearch,
        search: searchProject,
        openPanel: openProjectSearchPanel,
        closePanel: closeProjectSearchPanel,
        isOpen: isProjectSearchPanelOpen,
        setOpen: setProjectSearchPanelOpen
    };
}

console.log('[ProjectSearch] Module loaded');

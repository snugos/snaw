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
            noteResults.push({
                kind: 'note',
                trackId: entry.trackId != null ? String(entry.trackId) : null,
                trackName: entry.trackName || entry.trackId,
                snippet: text,
                color: entry.color || '#3b82f6',
                timestamp: entry.timestamp || null
            });
        }
    });

    return {
        query: q,
        tracks: trackResults.slice(0, MAX_RESULTS_PER_KIND),
        clips: clipResults.slice(0, MAX_RESULTS_PER_KIND),
        notes: noteResults.slice(0, MAX_RESULTS_PER_KIND),
        totalCount: trackResults.length + clipResults.length + noteResults.length,
        truncated: (trackResults.length + clipResults.length + noteResults.length) >
                   (Math.min(trackResults.length, MAX_RESULTS_PER_KIND) +
                    Math.min(clipResults.length, MAX_RESULTS_PER_KIND) +
                    Math.min(noteResults.length, MAX_RESULTS_PER_KIND))
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
                const all = document.querySelectorAll('[data-track-id]');
                all.forEach((node) => {
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
            setTimeout(() => { el.style.boxShadow = original || ''; }, 250);
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
            ? `Clip: ${result.clipName || result.clipType}`
            : result.kind === 'note'
                ? 'Track note'
                : 'Track';
        localAppServices.showNotification(`Jumped to: ${result.trackName} · ${label}`, 1500);
    }
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderResultItem(result) {
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
    label.style.cssText = 'color:#fff;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
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

    if (result.kind === 'note' && result.snippet) {
        const snip = document.createElement('div');
        snip.textContent = result.snippet.length > 160
            ? result.snippet.slice(0, 160) + '…'
            : result.snippet;
        snip.style.cssText = 'color:#bbb;font-size:11px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;';
        wrap.appendChild(snip);
    } else if (result.matchField) {
        const meta = document.createElement('div');
        meta.textContent = result.matchField;
        meta.style.cssText = 'color:#666;font-size:10px;font-style:italic;';
        wrap.appendChild(meta);
    }

    return wrap;
}

function renderResults(container, results) {
    container.innerHTML = '';
    if (!results.query) {
        const empty = document.createElement('div');
        empty.textContent = 'Type to search across all tracks, clips, and notes.';
        empty.style.cssText = 'color:#666;text-align:center;padding:24px 12px;font-size:12px;';
        container.appendChild(empty);
        return;
    }
    if (results.totalCount === 0) {
        const empty = document.createElement('div');
        empty.textContent = `No matches for "${results.query}".`;
        empty.style.cssText = 'color:#666;text-align:center;padding:24px 12px;font-size:12px;';
        container.appendChild(empty);
        return;
    }

    const sections = [
        { key: 'tracks', title: 'Tracks', results: results.tracks, color: '#a78bfa' },
        { key: 'clips', title: 'Clips', results: results.clips, color: '#60a5fa' },
        { key: 'notes', title: 'Notes', results: results.notes, color: '#fbbf24' }
    ];
    sections.forEach((section) => {
        if (!section.results.length) return;
        const heading = document.createElement('div');
        heading.textContent = `${section.title} (${section.results.length})`;
        heading.style.cssText = `color:${section.color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:6px 0 4px 2px;`;
        container.appendChild(heading);
        section.results.forEach((r) => {
            container.appendChild(renderResultItem(r));
        });
    });

    if (results.truncated) {
        const more = document.createElement('div');
        more.textContent = '…results truncated. Refine your search to see more.';
        more.style.cssText = 'color:#888;text-align:center;font-size:11px;font-style:italic;margin-top:8px;';
        container.appendChild(more);
    }
}

function renderPanelContent() {
    if (!panel) return;
    const list = panel.querySelector('.ps-list');
    if (!list) return;
    const results = buildResults(searchQuery);
    lastResults = results;
    renderResults(list, results);

    const counter = panel.querySelector('.ps-counter');
    if (counter) {
        const tracks = safeTracks().length;
        const noteCount = safeNotes().length;
        if (!searchQuery) {
            counter.textContent = `${tracks} track(s), ${noteCount} note(s)`;
        } else {
            counter.textContent = `${results.totalCount} match${results.totalCount === 1 ? '' : 'es'}`;
        }
    }
}

export function openProjectSearchPanel() {
    if (panel) {
        closeProjectSearchPanel();
        return;
    }

    const container = document.createElement('div');
    container.id = PANEL_ID;
    container.style.cssText = [
        'position:fixed',
        'right:20px',
        'top:80px',
        'width:380px',
        'max-height:540px',
        'background:#0f0f1a',
        'border:1px solid #333',
        'border-radius:8px',
        'padding:14px',
        'z-index:9050',
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
    closeBtn.addEventListener('click', () => closeProjectSearchPanel());
    header.appendChild(closeBtn);
    container.appendChild(header);

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search tracks, clips, notes…';
    search.value = searchQuery || '';
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.style.cssText = [
        'width:100%',
        'padding:9px 10px',
        'background:#1a1a2e',
        'border:1px solid #333',
        'border-radius:4px',
        'color:#fff',
        'font-size:13px',
        'box-sizing:border-box',
        'font-family:inherit'
    ].join(';');
    let searchTimer = null;
    search.addEventListener('input', (e) => {
        const value = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchQuery = value;
            renderPanelContent();
        }, 80);
    });
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimer);
            searchQuery = search.value;
            renderPanelContent();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeProjectSearchPanel();
        }
    });
    container.appendChild(search);

    const list = document.createElement('div');
    list.className = 'ps-list';
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;overflow-y:auto;flex:1;min-height:160px;padding-right:2px;';
    container.appendChild(list);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#666;border-top:1px solid #222;padding-top:8px;';
    const counter = document.createElement('span');
    counter.className = 'ps-counter';
    counter.textContent = '';
    footer.appendChild(counter);

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px;';

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.style.cssText = 'background:#222;border:1px solid #333;color:#ccc;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;';
    refreshBtn.addEventListener('click', () => renderPanelContent());
    buttons.appendChild(refreshBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'background:#222;border:1px solid #333;color:#ccc;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;';
    clearBtn.addEventListener('click', () => {
        searchQuery = '';
        search.value = '';
        renderPanelContent();
        search.focus();
    });
    buttons.appendChild(clearBtn);

    footer.appendChild(buttons);
    container.appendChild(footer);

    document.body.appendChild(container);
    panel = container;
    renderPanelContent();
    setTimeout(() => search.focus(), 30);
}

export function closeProjectSearchPanel() {
    if (panel) {
        panel.remove();
        panel = null;
    }
}

export function isProjectSearchPanelActive() {
    return panel !== null;
}

export function initProjectSearch(services) {
    localAppServices = services || {};
}

export function searchProject(query) {
    return buildResults(query);
}

if (typeof window !== 'undefined') {
    window.initProjectSearch = initProjectSearch;
    window.openProjectSearchPanel = openProjectSearchPanel;
    window.closeProjectSearchPanel = closeProjectSearchPanel;
    window.isProjectSearchPanelActive = isProjectSearchPanelActive;
    window.searchProject = searchProject;
    window.projectSearch = {
        init: initProjectSearch,
        open: openProjectSearchPanel,
        close: closeProjectSearchPanel,
        isActive: isProjectSearchPanelActive,
        search: searchProject
    };
}

console.log('[ProjectSearch] Module loaded');

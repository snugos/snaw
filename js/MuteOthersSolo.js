// js/MuteOthersSolo.js - Mute-Others Solo Shortcut
// Press Shift+S on the active sequencer track to solo ONLY that track
// and temporarily mute every other track. Pressing Shift+S again
// restores each track's previous mute state and unsoloes the active track.
//
// Pattern follows the established module style:
//   - IIFE with `use strict`
//   - init(appServices) wiring
//   - window exports for diagnostics / direct calls
//   - state is held in module-local variables, not in localStorage
//     (a fresh "memento" is taken each time Shift+S engages)

    'use strict';

    // Module-local state. `appServices` is set in init().
    let appServices = null;
    let isInitialized = false;

    // When Shift+S engages, we snapshot the per-track mute state and
    // which track (if any) was already soloed. Shift+S again restores it.
    // `null` means "no active solo-isolation session".
    let snapshot = null;

    function getActiveTrackId() {
        if (!appServices) return null;
        if (typeof appServices.getActiveSequencerTrackId === 'function') {
            return appServices.getActiveSequencerTrackId();
        }
        if (typeof appServices.getActiveSequencerTrackIdState === 'function') {
            return appServices.getActiveSequencerTrackIdState();
        }
        return null;
    }

    function getTracks() {
        if (!appServices) return [];
        if (typeof appServices.getTracks === 'function') return appServices.getTracks();
        if (Array.isArray(appServices.tracks)) return appServices.tracks;
        return [];
    }

    function setTrackMuted(track, muted) {
        if (typeof track.setMuted === 'function') {
            track.setMuted(muted);
            return;
        }
        track.isMuted = !!muted;
    }

    function setTrackSoloed(track, soloed) {
        if (typeof track.setSoloed === 'function') {
            track.setSoloed(soloed);
            return;
        }
        track.solo = !!soloed;
    }

    function restoreSnapshot() {
        if (!snapshot) return;
        const tracks = getTracks();
        tracks.forEach(track => {
            const prev = snapshot.mutes[track.id];
            if (prev !== undefined) setTrackMuted(track, prev);
        });
        const soloedTrack = tracks.find(t => t.id === snapshot.soloedTrackId);
        if (soloedTrack) setTrackSoloed(soloedTrack, snapshot.soloedState);
        snapshot = null;
    }

    function engageIsolation() {
        const tracks = getTracks();
        const activeId = getActiveTrackId();
        if (!activeId) {
            if (appServices && typeof appServices.showNotification === 'function') {
                appServices.showNotification('No active track selected for mute-others solo', 1800);
            }
            return;
        }
        const active = tracks.find(t => t.id === activeId);
        if (!active) return;

        // Take a snapshot of every track's current mute state and the active
        // track's current solo state so we can restore exactly what was there.
        const mutes = {};
        tracks.forEach(t => { mutes[t.id] = !!t.isMuted; });
        snapshot = {
            activeId,
            mutes,
            soloedTrackId: activeId,
            soloedState: !!active.solo
        };

        if (appServices && typeof appServices.captureStateForUndo === 'function') {
            appServices.captureStateForUndo('Mute-others solo: ' + (active.name || 'track'));
        }

        // Mute everyone else, solo the active track.
        tracks.forEach(track => {
            if (track.id === activeId) {
                setTrackMuted(track, false);
                setTrackSoloed(track, true);
            } else {
                setTrackMuted(track, true);
            }
        });

        if (appServices && typeof appServices.showNotification === 'function') {
            appServices.showNotification(
                'Soloed "' + (active.name || 'track') + '" — Shift+S to restore',
                1800
            );
        }
        if (appServices && typeof appServices.renderTimeline === 'function') {
            appServices.renderTimeline();
        }
    }

    function toggleMuteOthers() {
        if (snapshot) {
            restoreSnapshot();
            if (appServices && typeof appServices.showNotification === 'function') {
                appServices.showNotification('Restored all track mutes', 1500);
            }
            if (appServices && typeof appServices.renderTimeline === 'function') {
                appServices.renderTimeline();
            }
        } else {
            engageIsolation();
        }
    }

    function handleKeydown(event) {
        // Ignore if the user is typing into an editable surface.
        const target = event.target;
        if (target && (target.tagName === 'INPUT' ||
                       target.tagName === 'TEXTAREA' ||
                       target.tagName === 'SELECT' ||
                       target.isContentEditable)) {
            return;
        }

        // Shift+S (any case). Reject if other modifier keys are held.
        if ((event.key === 'S' || event.key === 's') &&
            event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            toggleMuteOthers();
        }
    }

    /**
     * Initialize the Mute-Others Solo Shortcut feature.
     * @param {object} services - The main appServices object from main.js
     */
    function init(services) {
        if (isInitialized) return;
        appServices = services || {};
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeydown);
        }
        isInitialized = true;
        console.log('[MuteOthersSolo] Initialized - press Shift+S on the active track to mute-others solo');
    }

    // Exported API for main.js (named imports) and window (for diagnostics).
    // `isActive` was previously defined as an arrow function inline in this object
    // (`isActive: () => snapshot !== null`); converting the module from IIFE to ESM
    // required promoting it to a real function declaration so the named export works.
    function isActive() {
        return snapshot !== null;
    }

    const exported = {
        init,
        toggleMuteOthers,
        isActive
    };

    if (typeof window !== 'undefined') {
        window.MuteOthersSolo = exported;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exported;
    }

// `initMuteOthersSolo` alias matches the named import in main.js (line 18).
// Without this alias, `import { initMuteOthersSolo } from './MuteOthersSolo.js'`
// resolves to undefined and the Shift+S feature silently fails to wire up.
const initMuteOthersSolo = init;
export { init, initMuteOthersSolo, toggleMuteOthers, isActive };

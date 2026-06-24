// js/eventHandlers.js - Global Event Listeners and Input Handling Module
import * as Constants from './constants.js';
import { showNotification, showConfirmationDialog, createContextMenu } from './utils.js';
import { parseMidiFile, midiNotesToSequenceData, encodeSequenceToMidi, midiToNoteName, noteNameToMidi } from './midiUtils.js';
import { openClipStartOffsetPanel } from './ClipStartOffset.js';
import { playCountIn, isCountInActive, getCountInBars } from './CountInAudio.js';
import {
    getTracksState as getTracks,
    getTrackByIdState as getTrackById,
    captureStateForUndoInternal as captureStateForUndo,
    setSoloedTrackIdState as setSoloedTrackId,
    getSoloedTrackIdState as getSoloedTrackId,
    getSoloMode,
    setSoloMode,
    toggleSoloMode,
    getSoloedTrackIds,
    setSoloedTrackIds,
    addSoloedTrackId,
    removeSoloedTrackId,
    isTrackSoloedInChain,
    setArmedTrackIdState as setArmedTrackId,
    getArmedTrackIdState as getArmedTrackId,
    setActiveSequencerTrackIdState as setActiveSequencerTrackId,
    setIsRecordingState as setIsRecording,
    isTrackRecordingState as isTrackRecording,
    setRecordingTrackIdState as setRecordingTrackId,
    getRecordingTrackIdState as getRecordingTrackId,
    getRecordingStartTimeState as getRecordingStartTime,
    removeTrackFromStateInternal as coreRemoveTrackFromState,
    getPlaybackModeState,
    setPlaybackModeState,
    getMidiAccessState, 
    getActiveMIDIInputState,
    // Loop Region State
    getLoopRegionEnabled, setLoopRegionEnabled, setLoopRegionStart, setLoopRegionEnd,
    // Metronome State
    getMetronomeEnabled, setMetronomeEnabled, getMetronomeVolume, setMetronomeVolume,
    getAdaptiveMetronomeEnabled, setAdaptiveMetronomeEnabled, recordNoteTiming,
    // Group Edit State
    getSelectedNotes, getSelectedNotesCount, getActiveSequenceIdForSelection,
    setSelectedNotes, addSelectedNote, removeSelectedNote, toggleSelectedNote,
    clearSelectedNotes, isSelectedNote, deleteSelectedNotes, duplicateSelectedNotes,
    moveSelectedNotes, quantizeSelectedNotes,
    deleteTimelineClips, duplicateTimelineClips,
    setSelectedNotesVelocity, setSelectedNotesGate, humanizeSelectedNotes,
    copySelectedNotes, cutSelectedNotes, pasteNotes,
    moveSelectedClips, groupEditClips, copySelectedClips, cutSelectedClips, pasteClips,
    getNotesClipboard, getClipsClipboard,
    // Mute Groups
    handleMuteGroupExclusiveUnmute
} from './state.js';

let localAppServices = {};
let transportKeepAliveBufferSource = null;
let silentKeepAliveBuffer = null;
let _hoveredEffectId = null; // Tracks which effect is currently hovered in effects rack
let _hoveredEffectTrack = null; // The track that owns the hovered effect

// --- MIDI CC Learn / Mapping System ---
let _midiCCMappings = {}; // { targetId: { cc, channel, min, max } }
let _midiCCLearnActive = null; // { targetId, paramPath, trackId, defaultMin, defaultMax }

// Serialization keys for project save/load
const MIDI_CC_MAPPINGS_STORAGE_KEY = 'midiCCMappings';
const MIDI_CC_LEARN_ACTIVE_STORAGE_KEY = 'midiCCLearnActive';

export function getMidiCCMappings() { return _midiCCMappings; }
export function getMidiCCLearnActive() { return _midiCCLearnActive; }

export function clearMidiCCMappings() { _midiCCMappings = {}; }
export function removeMidiCCMapping(targetId) { delete _midiCCMappings[targetId]; }
export function setMidiCCMapping(targetId, mapping) { _midiCCMappings[targetId] = mapping; }
export function getMidiCCMapping(targetId) { return _midiCCMappings[targetId] || null; }

// Persist CC mappings to a plain object for project save/load
export function getMidiCCMappingsForProject() {
    return Object.keys(_midiCCMappings).map(key => ({
        targetId: key,
        cc: _midiCCMappings[key].cc,
        channel: _midiCCMappings[key].channel,
        min: _midiCCMappings[key].min,
        max: _midiCCMappings[key].max
    }));
}

// Restore CC mappings from a project data array
export function loadMidiCCMappingsFromProject(mappingsData) {
    _midiCCMappings = {};
    if (Array.isArray(mappingsData)) {
        for (const entry of mappingsData) {
            if (entry && typeof entry.targetId === 'string' && typeof entry.cc === 'number') {
                _midiCCMappings[entry.targetId] = {
                    cc: entry.cc,
                    channel: entry.channel !== undefined ? entry.channel : 0,
                    min: entry.min !== undefined ? entry.min : 0,
                    max: entry.max !== undefined ? entry.max : 1
                };
            }
        }
    }
    console.log(`[MIDI CC] Loaded ${Object.keys(_midiCCMappings).length} CC mappings from project.`);
}

// Apply CC value to a mapped target
function applyMidiCCMapping(targetId, ccValue, channel) {
    const mapping = _midiCCMappings[targetId];
    if (!mapping || mapping.channel !== channel) return;
    const normalized = ccValue / 127;
    const value = mapping.min + normalized * (mapping.max - mapping.min);
    if (localAppServices.applyMidiCCToKnob) {
        localAppServices.applyMidiCCToKnob(targetId, value);
    }
}

// Start CC learn mode for a knob/control target
export function startMidiCCLearn(targetId, paramPath, trackId, defaultMin, defaultMax) {
    _midiCCLearnActive = { targetId, paramPath, trackId, defaultMin: defaultMin !== undefined ? defaultMin : 0, defaultMax: defaultMax !== undefined ? defaultMax : 1 };
    if (localAppServices.showNotification) localAppServices.showNotification("MIDI CC Learn: Move a controller to assign, Esc to cancel.", 5000);
    console.log(`[MIDI CC Learn] Started for target: ${targetId}, param: ${paramPath}`);
}

// Cancel CC learn mode
export function cancelMidiCCLearn() {
    if (_midiCCLearnActive) {
        console.log(`[MIDI CC Learn] Cancelled for target: ${_midiCCLearnActive.targetId}`);
        _midiCCLearnActive = null;
    }
}

// Called by handleMIDIMessage when a CC message is received
function handleCCLearnMessage(cc, channel) {
    if (!_midiCCLearnActive) return;
    const mapping = {
        cc: cc,
        channel: channel,
        min: _midiCCLearnActive.defaultMin,
        max: _midiCCLearnActive.defaultMax
    };
    _midiCCMappings[_midiCCLearnActive.targetId] = mapping;
    if (localAppServices.showNotification) localAppServices.showNotification(`MIDI CC ${cc} (ch ${channel+1}) mapped to this control.`, 3000);
    console.log(`[MIDI CC Learn] Mapped CC ${cc} (ch ${channel+1}) to target: ${_midiCCLearnActive.targetId}`);
    _midiCCLearnActive = null;
}

export function getHoveredEffectId() { return _hoveredEffectId; }
export function getHoveredEffectTrack() { return _hoveredEffectTrack; }
export function setHoveredEffect(effectId, track) { _hoveredEffectId = effectId; _hoveredEffectTrack = track; }
export function clearHoveredEffect() { _hoveredEffectId = null; _hoveredEffectTrack = null; }

export function initializeEventHandlersModule(appServicesFromMain) {
    localAppServices = appServicesFromMain || {}; 
    if (!localAppServices.setPlaybackMode && setPlaybackModeState) {
        localAppServices.setPlaybackMode = setPlaybackModeState;
    }
    if (!localAppServices.getPlaybackMode && getPlaybackModeState) {
        localAppServices.getPlaybackMode = getPlaybackModeState;
    }
}

export let currentlyPressedComputerKeys = {};
let currentOctaveShift = 0;
const MIN_OCTAVE_SHIFT = -2;
const MAX_OCTAVE_SHIFT = 2;

export function initializePrimaryEventListeners(appContext) {
    if (!appContext) {
        console.error('[EventHandlers initializePrimaryEventListeners] appContext is required but was not provided!');
        return;
    }
    const services = appContext;
    const uiCache = services.uiElementsCache || {};
    console.log('[EventHandlers initializePrimaryEventListeners] Initializing. uiCache keys:', Object.keys(uiCache));

    try {
        if (uiCache.startButton) {
            uiCache.startButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (uiCache.startMenu) {
                    uiCache.startMenu.classList.toggle('hidden');
                } else {
                    console.error('[EventHandlers] Start Menu (uiCache.startMenu) not found when Start Button clicked!');
                }
            });
        } else {
            console.warn('[EventHandlers initializePrimaryEventListeners] Start Button (uiCache.startButton) NOT found in uiCache!');
        }

        if (uiCache.desktop) {
            uiCache.desktop.addEventListener('click', () => {
                if (uiCache.startMenu && !uiCache.startMenu.classList.contains('hidden')) {
                    uiCache.startMenu.classList.add('hidden');
                }
                const activeContextMenu = document.querySelector('.context-menu#snug-context-menu');
                if (activeContextMenu) {
                    activeContextMenu.remove();
                }
            });

            uiCache.desktop.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const menuItems = [
                    { label: "Add Synth Track", action: () => { if(localAppServices.addTrack) localAppServices.addTrack('Synth', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Slicer Sampler Track", action: () => { if(localAppServices.addTrack) localAppServices.addTrack('Sampler', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Sampler (Pads)", action: () => { if(localAppServices.addTrack) localAppServices.addTrack('DrumSampler', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Instrument Sampler Track", action: () => { if(localAppServices.addTrack) localAppServices.addTrack('InstrumentSampler', {_isUserActionPlaceholder: true}); } },
                    { label: "Add Audio Track", action: () => { if(localAppServices.addTrack) localAppServices.addTrack('Audio', {_isUserActionPlaceholder: true}); } },
                    { separator: true },
                    { label: "Open Sound Browser", action: () => { if(localAppServices.openSoundBrowserWindow) localAppServices.openSoundBrowserWindow(); } },
                    { label: "Open Timeline", action: () => { if(localAppServices.openTimelineWindow) localAppServices.openTimelineWindow(); } },
                    { label: "Open Global Controls", action: () => { if(localAppServices.openGlobalControlsWindow) localAppServices.openGlobalControlsWindow(); } },
                    { label: "Open Mixer", action: () => { if(localAppServices.openMixerWindow) localAppServices.openMixerWindow(); } },
                    { label: "Open Master Effects", action: () => { if(localAppServices.openMasterEffectsRackWindow) localAppServices.openMasterEffectsRackWindow(); } },
                    { label: "Random Pattern Generator", action: () => { if(localAppServices.openRandomPatternGeneratorPanel) localAppServices.openRandomPatternGeneratorPanel(); } },
                    { label: "CPU Monitor", action: () => { if(localAppServices.openCpuMonitorPanel) localAppServices.openCpuMonitorPanel(); } },
                    { label: "Spectrum Analyzer", action: () => { if(localAppServices.openSpectrumAnalyzerPanel) localAppServices.openSpectrumAnalyzerPanel(); } },
                    { label: "Mixdown Visualizer", action: () => { if(localAppServices.openMixdownVisualizerPanel) localAppServices.openMixdownVisualizerPanel(); } },
                    { label: "Headphone Mix", action: () => { if(localAppServices.openHeadphoneMixPanel) localAppServices.openHeadphoneMixPanel(); } },
                    { label: "Sidechain Visualizer", action: () => { if(localAppServices.openSidechainVisualizerPanel) localAppServices.openSidechainVisualizerPanel(); } },
                    { label: "Phase Invert", action: () => { if(localAppServices.openPhaseInvertButtonPanel) localAppServices.openPhaseInvertButtonPanel(); } },
                    { label: "Phase Correlation Meter", action: () => { if(localAppServices.openPhaseCorrelationMeterPanel) localAppServices.openPhaseCorrelationMeterPanel(); } },
                    { label: "MIDI Velocity Curve", action: () => { if(localAppServices.openMIDIVelocityCurvePanel) localAppServices.openMIDIVelocityCurvePanel(); } },
                    { label: "Chord Voicing Panel", action: () => { if(window.openChordVoicingPanel) window.openChordVoicingPanel(); } },
                    { label: "Keyboard Shortcuts", action: () => { if(localAppServices.openKeyBindingsPanel) localAppServices.openKeyBindingsPanel(); } },
                    { label: "Project Notes", action: () => { if(localAppServices.openProjectNotesPanel) localAppServices.openProjectNotesPanel(); } },
                    { label: "Drum Map Editor", action: () => { if(localAppServices.openDrumMapEditorPanel) localAppServices.openDrumMapEditorPanel(); } },
                    { label: "Group Edit Panel", action: () => { if(localAppServices.openGroupEditPanel) localAppServices.openGroupEditPanel('notes'); } },
                    { separator: true },
                    { label: "Upload Custom Background (Image/Video)", action: () => { if(localAppServices.triggerCustomBackgroundUpload) localAppServices.triggerCustomBackgroundUpload(); } },
                    { label: "Remove Custom Background", action: () => { 
                        if(localAppServices.removeCustomDesktopBackground) {
                            localAppServices.removeCustomDesktopBackground();
                        } else if(window.removeCustomDesktopBackground) {
                            window.removeCustomDesktopBackground();
                        } else {
                            showNotification?.('Desktop background feature not available', 'warning');
                        }
                    } },
                    { label: "Stretch Quality", action: () => { if(localAppServices.openStretchQualityPanel) localAppServices.openStretchQualityPanel(); } },
                    { label: "MPE Tools", action: () => { if(window.openMPEToolsPanel) window.openMPEToolsPanel(); } },
                    { separator: true },
                    { label: "Loopback Audio Routing", action: () => { if(localAppServices.openLoopbackRoutingPanel) localAppServices.openLoopbackRoutingPanel(); } },
                    { separator: true },
                    { label: "Track Export Solo", action: () => { if(localAppServices.openTrackExportSoloPanel) localAppServices.openTrackExportSoloPanel(); } },
                    { label: "Track Solo Chain", action: () => { if(localAppServices.openSoloChainPanel) localAppServices.openSoloChainPanel(); } },
                    { label: "Track Send Routing", action: () => { if(localAppServices.openTrackSendRoutingPanel) localAppServices.openTrackSendRoutingPanel(); } },
                    { label: "Scroll Track to Center", action: () => { if(localAppServices.showNotification) localAppServices.showNotification('Ctrl+Shift+Click any track to scroll it to center', 3000); } },
                    { label: "Toggle Full Screen", action: toggleFullScreen }
                ];
                if (typeof createContextMenu === 'function') {
                    createContextMenu(e, menuItems, services);
                } else {
                    console.error("[EventHandlers] createContextMenu function not available.");
                }
            });
        } else {
             console.warn('[EventHandlers initializePrimaryEventListeners] Desktop element (uiCache.desktop) NOT found in uiCache!');
        }

        const menuActions = {
            menuAddSynthTrack: () => {
                console.log('[Menu] Add Synth Track clicked');
                try {
                    localAppServices.addTrack?.('Synth', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Add Synth Track error:', e); }
            },
            menuAddSamplerTrack: () => {
                console.log('[Menu] Add Sampler Track clicked');
                try {
                    localAppServices.addTrack?.('Sampler', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Add Sampler error:', e); }
            },
            menuAddDrumSamplerTrack: () => {
                console.log('[Menu] Add Drum Sampler clicked');
                try {
                    localAppServices.addTrack?.('DrumSampler', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Drum Sampler error:', e); }
            },
            menuAddInstrumentSamplerTrack: () => {
                console.log('[Menu] Add Instrument Sampler clicked');
                try {
                    localAppServices.addTrack?.('InstrumentSampler', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Instrument Sampler error:', e); }
            },
            menuAddAudioTrack: () => {
                console.log('[Menu] Add Audio Track clicked');
                try {
                    localAppServices.addTrack?.('Audio', {_isUserActionPlaceholder: true});
                } catch(e) { console.error('[Menu] Audio Track error:', e); }
            },
            menuOpenSoundBrowser: () => {
                console.log('[Menu] Sound Browser clicked');
                try {
                    localAppServices.openSoundBrowserWindow?.();
                } catch(e) { console.error('[Menu] Sound Browser error:', e); }
            },
            menuOpenTimeline: () => {
                console.log('[Menu] Timeline clicked');
                try {
                    localAppServices.openTimelineWindow?.();
                } catch(e) { console.error('[Menu] Timeline error:', e); }
            },
            menuOpenGlobalControls: () => {
                console.log('[Menu] Global Controls clicked');
                try {
                    localAppServices.openGlobalControlsWindow?.();
                } catch(e) { console.error('[Menu] Global Controls error:', e); }
            },
            menuOpenMixer: () => {
                console.log('[Menu] Mixer clicked');
                try {
                    localAppServices.openMixerWindow?.();
                } catch(e) { console.error('[Menu] Mixer error:', e); }
            },
            menuLoopbackAudio: () => {
                console.log('[Menu] Loopback Audio clicked');
                try {
                    if (typeof toggleLoopbackPanel === 'function') {
                        toggleLoopbackPanel();
                    }
                } catch(e) { console.error('[Menu] Loopback Audio error:', e); }
            },
            menuMixerSnapshots: () => {
                console.log('[Menu] Mixer Snapshots clicked');
                try {
                    localAppServices.openMixerSnapshotPanel?.(localAppServices);
                } catch(e) { console.error('[Menu] Mixer Snapshots error:', e); }
            },
            menuOpenPianoRoll: () => {
                console.log('[Menu] Piano Roll Editor clicked');
                try {
                    localAppServices.openPianoRollEditor?.();
                } catch(e) { console.error('[Menu] Piano Roll Editor error:', e); }
            },
            menuOpenMasterEffects: () => {
                console.log('[Menu] Master Effects clicked');
                try {
                    localAppServices.openMasterEffectsRackWindow?.();
                } catch(e) { console.error('[Menu] Master Effects error:', e); }
            },
            menuOpenMidiMappings: () => {
                console.log('[Menu] MIDI Mappings clicked');
                try {
                    localAppServices.openMidiMappingsPanel?.();
                } catch(e) { console.error('[Menu] MIDI Mappings error:', e); }
            },
            menuOpenMIDArpeggiator: () => {
                console.log('[Menu] MIDI Arpeggiator clicked');
                try {
                    localAppServices.openMIDArpeggiatorPanel?.();
                } catch(e) { console.error('[Menu] MIDI Arpeggiator error:', e); }
            },
            menuChordMemory: () => {
                console.log('[Menu] Chord Memory clicked');
                try {
                    localAppServices.openChordMemoryPanel?.();
                } catch(e) { console.error('[Menu] Chord Memory error:', e); }
            },
            menuChordProgressionBuilder: () => {
                console.log('[Menu] Chord Progression Builder clicked');
                try {
                    localAppServices.openChordProgressionBuilderPanel?.();
                } catch(e) { console.error('[Menu] Chord Progression Builder error:', e); }
            },
            menuChordVoicingModes: () => {
                console.log('[Menu] Chord Voicing Modes clicked');
                try {
                    if (typeof openChordVoicingPanel === 'function') {
                        openChordVoicingPanel();
                    } else {
                        import('./ChordVoicingModes.js').then(m => {
                            if (m.openChordVoicingPanel) m.openChordVoicingPanel();
                        }).catch(e => console.error('[Menu] Chord Voicing Modes error:', e));
                    }
                } catch(e) { console.error('[Menu] Chord Voicing Modes error:', e); }
            },
            menuMidiChordPlayer: () => {
                console.log('[Menu] MIDI Chord Player clicked');
                try {
                    localAppServices.openMIDIChordPlayerPanel?.();
                } catch(e) { console.error('[Menu] MIDI Chord Player error:', e); }
            },
            menuGuitarTabEditor: () => {
                console.log('[Menu] Guitar Tab Editor clicked');
                try {
                    localAppServices.openGuitarTabEditor?.();
                } catch(e) { console.error('[Menu] Guitar Tab Editor error:', e); }
            },
            menuAIComposition: () => {
                console.log('[Menu] AI Composition Assistant clicked');
                try {
                    localAppServices.openAICompositionPanel?.();
                } catch(e) { console.error('[Menu] AI Composition error:', e); }
            },
            menuRhythmCoach: () => {
                console.log('[Menu] Rhythm Coach clicked');
                try {
                    localAppServices.openRhythmCoachPanel?.();
                } catch(e) { console.error('[Menu] Rhythm Coach error:', e); }
            },
            menuModularRouting: () => {
                console.log('[Menu] Modular Routing clicked');
                try {
                    localAppServices.openModularRoutingPanel?.();
                } catch(e) { console.error('[Menu] Modular Routing error:', e); }
            },
            menuTempoAutomation: () => {
                console.log('[Menu] Tempo Automation clicked');
                try {
                    localAppServices.openTempoAutomationPanel?.();
                } catch(e) { console.error('[Menu] Tempo Automation error:', e); }
            },
            menuTrackGroups: () => {
                console.log('[Menu] Track Groups clicked');
                try {
                    localAppServices.openTrackGroupsPanel?.();
                } catch(e) { console.error('[Menu] Track Groups error:', e); }
            },
            menuTrackColorPalette: () => {
                console.log("[Menu] Track Color Palette clicked");
                try {
                    localAppServices.openTrackColorPalettePanel?.();
                } catch(e) { console.error("[Menu] Track Color Palette error:", e); }
            },
            menuTrackColorPanel: () => {
                console.log("[Menu] Track Color Panel clicked");
                try {
                    const tracks = localAppServices.getTracksState?.() || [];
                    if (tracks.length > 0) {
                        localAppServices.openTrackColorPanel?.(tracks[0].id);
                    } else {
                        localAppServices.showNotification?.('No tracks available', 2000);
                    }
                } catch(e) { console.error("[Menu] Track Color Panel error:", e); }
            },
            menuTrackRolePanel: () => {
                console.log("[Menu] Track Role Panel clicked");
                try {
                    const tracks = localAppServices.getTracksState?.() || [];
                    if (tracks.length > 0) {
                        localAppServices.openTrackRolePanel?.(tracks[0].id);
                    } else {
                        localAppServices.showNotification?.('No tracks available', 2000);
                    }
                } catch(e) { console.error("[Menu] Track Role Panel error:", e); }
            },
            menuTrackNoiseGate: () => {
                console.log("[Menu] Track Noise Gate clicked");
                try {
                    if (typeof window.openNoiseGatePanel === 'function') {
                        window.openNoiseGatePanel();
                    } else {
                        // Fallback: import and call directly
                        import('./TrackNoiseGate.js').then(m => {
                            if (m.openNoiseGatePanel) m.openNoiseGatePanel();
                        }).catch(e => console.error('[Menu] Track Noise Gate import error:', e));
                    }
                } catch(e) { console.error("[Menu] Track Noise Gate error:", e); }
            },
            menuTrackIconPicker: () => {
                console.log("[Menu] Track Icon Picker clicked");
                try {
                    const tracks = localAppServices.getTracksState?.() || [];
                    if (tracks.length > 0) {
                        localAppServices.openTrackIconPickerPanel?.(tracks[0].id);
                    } else {
                        localAppServices.showNotification?.('No tracks available', 2000);
                    }
                } catch(e) { console.error("[Menu] Track Icon Picker error:", e); }
            },
            menuClipOpacity: () => {
                console.log("[Menu] Clip Opacity clicked");
                try {
                    localAppServices.openClipOpacityPanel?.();
                } catch(e) { console.error("[Menu] Clip Opacity error:", e); }
            },
            menuClipStartOffset: () => {
                console.log("[Menu] Clip Start Offset clicked");
                try {
                    // Open panel for first selected clip if any
                    if (localAppServices.getSelectedClipIds) {
                        const ids = localAppServices.getSelectedClipIds();
                        if (ids && ids.size > 0) {
                            const firstClipId = ids.values().next().value;
                            openClipStartOffsetPanel(firstClipId);
                            return;
                        }
                    }
                    // Fallback: show notification
                    localAppServices.showNotification?.('Right-click a clip and select "Start Offset" to adjust its start point', 3000);
                } catch(e) { console.error("[Menu] Clip Start Offset error:", e); }
            },
            menuQuickRename: () => {
                console.log("[Menu] Quick Rename clicked");
                // Quick Rename uses double-click on track/clip names - just show notification
                localAppServices.showNotification?.('Double-click any track or clip name to rename it inline!', 2500);
            },
            menuMuteGroups: () => {
                console.log("[Menu] Mute Groups clicked");
                try { localAppServices.openMuteGroupsPanel?.(); } catch(e) { console.error("[Menu] Mute Groups error:", e); }
            },
            menuTrackMuteAutomation: () => {
                console.log('[Menu] Track Mute Automation clicked');
                try { localAppServices.openTrackMuteAutomationPanel?.(); } catch(e) { console.error('[Menu] Track Mute Automation error:', e); }
            },
            menuScaleHint: () => {
                console.log('[Menu] Scale Hint Overlay clicked');
                try {
                    localAppServices.openScaleHintPanel?.();
                } catch(e) { console.error('[Menu] Scale Hint Overlay error:', e); }
            },
            menuScaleLock: () => {
                console.log('[Menu] Scale Lock clicked');
                try {
                    localAppServices.openScaleLockPanel?.();
                } catch(e) { console.error('[Menu] Scale Lock error:', e); }
            },
            menuScaleQuantize: () => {
                console.log('[Menu] Scale Quantize clicked');
                try {
                    if (window.openScaleQuantizePanel) window.openScaleQuantizePanel();
                } catch(e) { console.error('[Menu] Scale Quantize error:', e); }
            },
            menuAutoKeyDetection: () => {
                console.log('[Menu] Auto Key Detection clicked');
                try {
                    if (window.openAutoKeyDetectionPanel) window.openAutoKeyDetectionPanel();
                    else {
                        import('./AutoKeyDetection.js').then(m => {
                            if (m.openAutoKeyDetectionPanel) m.openAutoKeyDetectionPanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Auto Key Detection error:', e); }
            },
            menuMicroTuning: () => {
                console.log('[Menu] Micro Tuning clicked');
                try {
                    localAppServices.openMicroTuningPanel?.();
                } catch(e) { console.error('[Menu] Micro Tuning error:', e); }
            },
            menuTuner: () => {
                console.log('[Menu] Tuner clicked');
                try {
                    localAppServices.openTunerPanel?.();
                } catch(e) { console.error('[Menu] Tuner error:', e); }
            },
            menuGrooveTemplates: () => {
                console.log('[Menu] Groove Templates clicked');
                try {
                    localAppServices.openGrooveTemplatesPanel?.();
                } catch(e) { console.error('[Menu] Groove Templates error:', e); }
            },
            menuGrooveExtractor: () => {
                console.log('[Menu] Groove Extractor clicked');
                try {
                    localAppServices.openGrooveExtractorPanel?.();
                } catch(e) { console.error('[Menu] Groove Extractor error:', e); }
            },
            menuRhythmRandomizer: () => {
                console.log('[Menu] Rhythm Randomizer clicked');
                try {
                    localAppServices.openRhythmRandomizerPanel?.();
                } catch(e) { console.error('[Menu] Rhythm Randomizer error:', e); }
            },
            menuPatternChains: () => {
                console.log('[Menu] Pattern Chains clicked');
                try {
                    localAppServices.openPatternChainsPanel?.();
                } catch(e) { console.error('[Menu] Pattern Chains error:', e); }
            },
            menuAutomationLanes: () => {
                console.log('[Menu] Automation Lanes clicked');
                try {
                    localAppServices.openAutomationLanesPanel?.();
                } catch(e) { console.error('[Menu] Automation Lanes error:', e); }
            },
            menuUndo: () => { console.log('[Menu] Undo clicked'); localAppServices.undoLastAction?.(); },
            menuRedo: () => { console.log('[Menu] Redo clicked'); localAppServices.redoLastAction?.(); },
            menuOpenHistory: () => { console.log('[Menu] History Panel clicked'); localAppServices.openUndoHistoryPanel?.(); },
            menuCountInSettings: () => {
                console.log('[Menu] Count-In Settings clicked');
                try {
                    localAppServices.openCountInSettingsPanel?.();
                } catch(e) { console.error('[Menu] Count-In Settings error:', e); }
            },
            menuSaveProject: () => { console.log('[Menu] Save clicked'); localAppServices.saveProject?.(); },
            menuLoadProject: () => { console.log('[Menu] Load clicked'); localAppServices.loadProject?.(); },
            menuExportWav: () => { console.log('[Menu] Export clicked'); localAppServices.exportToWav?.(); },
            menuExportRegion: () => { console.log('[Menu] Export Region clicked'); try { localAppServices.openExportSelectionPanel?.(); } catch(e) { console.error('[Menu] Export Region error:', e); } },
            menuExportMidi: () => { console.log('[Menu] Export MIDI clicked'); localAppServices.exportToMidi?.(); },
            menuExportStems: () => { console.log('[Menu] Export Stems clicked'); localAppServices.showStemExportDialog?.(); },
            menuVideoExport: () => { console.log('[Menu] Video Export clicked'); localAppServices.openVideoExportPanel?.(); },
            menuProjectTemplates: () => { console.log('[Menu] Project Templates clicked'); localAppServices.openProjectTemplatesPanel?.(); },
            menuExportPresets: () => { console.log('[Menu] Export Presets clicked'); localAppServices.openExportPresetsPanel?.(); },
            menuTrackTemplates: () => { console.log('[Menu] Track Templates clicked'); localAppServices.openTrackTemplatesPanel?.(); },
            menuScrubPreview: () => {
                console.log('[Menu] Scrub Preview clicked');
                try {
                    if (window.openScrubPreviewPanel) {
                        window.openScrubPreviewPanel();
                    } else {
                        import('./PlayheadScrubPreview.js').then(m => {
                            if (m.initPlayheadScrubPreview) m.initPlayheadScrubPreview(localAppServices);
                            if (m.openScrubPreviewPanel) m.openScrubPreviewPanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Scrub Preview error:', e); }
            },
            menuToggleFullScreen: () => { console.log('[Menu] Fullscreen clicked'); toggleFullScreen(); },
            menuTetris: () => window.open("https://snugos.github.io/app/tetris.html", "_blank"),
            menuClipReverse: () => {
                console.log('[Menu] Clip Reverse clicked');
                try {
                    // Get first track and open clip reverse panel
                    const tracks = localAppServices.getTracks?.() || [];
                    if (tracks.length > 0) {
                        localAppServices.openClipReversePanel?.(tracks[0].id);
                    } else {
                        localAppServices.showNotification?.('No tracks available. Create a track first.', 2000);
                    }
                } catch(e) { console.error('[Menu] Clip Reverse error:', e); }
            },
            menuQuickVolumeRamp: () => {
                console.log("[Menu] Quick Volume Ramp clicked");
                try {
                    if (localAppServices.openQuickVolumeRampPanel) {
                        localAppServices.openQuickVolumeRampPanel();
                    } else {
                        localAppServices.showNotification?.("Quick Volume Ramp not available", 2000);
                    }
                } catch(e) { console.error("[Menu] Quick Volume Ramp error:", e); }
            },
            menuClipStretchMarkers: () => {
                console.log('[Menu] Clip Stretch Markers clicked');
                try {
                    const tracks = localAppServices.getTracks?.() || [];
                    if (tracks.length > 0) {
                        const audioTrack = tracks.find(t => t.type === 'Audio');
                        if (audioTrack && audioTrack.timelineClips?.length > 0) {
                            if (window.openClipStretchMarkersPanel) {
                                window.openClipStretchMarkersPanel(audioTrack.id, audioTrack.timelineClips[0].id);
                            } else {
                                import('./ClipStretchMarkers.js').then(m => {
                                    if (m.toggleClipStretchMarkers) {
                                        m.toggleClipStretchMarkers(audioTrack, audioTrack.timelineClips[0].id, true);
                                    }
                                });
                            }
                        } else {
                            localAppServices.showNotification?.('No audio clips available. Add an audio clip first.', 2000);
                        }
                    } else {
                        localAppServices.showNotification?.('No tracks available. Create a track first.', 2000);
                    }
                } catch(e) { console.error('[Menu] Clip Stretch Markers error:', e); }
            },
            menuTimelineMarkers: () => {
                console.log('[Menu] Timeline Markers clicked');
                try {
                    if (window.openTimelineMarkersPanel) {
                        window.openTimelineMarkersPanel();
                    }
                } catch(e) { console.error('[Menu] Timeline Markers error:', e); }
            },
            menuAutoBeatSync: () => {
                console.log('[Menu] Auto-Beat Sync clicked');
                try {
                    localAppServices.openAutoBeatSyncPanel?.();
                } catch(e) { console.error('[Menu] Auto-Beat Sync error:', e); }
            },
            menuLyricsDisplay: () => {
                console.log('[Menu] Lyrics Display clicked');
                try {
                    localAppServices.openLyricsPanel?.();
                } catch(e) { console.error('[Menu] Lyrics Display error:', e); }
            },
            menuAudioTapTempo: () => {
                console.log('[Menu] Audio Tap Tempo clicked');
                try {
                    localAppServices.openAudioTapTempoPanel?.();
                } catch(e) { console.error('[Menu] Audio Tap Tempo error:', e); }
            },
            menuAITempoSuggestion: () => {
                console.log('[Menu] AI Tempo Suggestion clicked');
                try {
                    if (localAppServices.openAITempoSuggestionPanel) {
                        localAppServices.openAITempoSuggestionPanel();
                    }
                } catch(e) { console.error('[Menu] AI Tempo Suggestion error:', e); }
            },
            menuTapHistory: () => {
                console.log('[Menu] Tap History clicked');
                try {
                    if (window.TapHistoryUI && window.TapHistoryUI.showPanel) {
                        window.TapHistoryUI.showPanel();
                    } else {
                        import('./TapHistoryUI.js').then(m => {
                            if (m.initTapHistoryUI) m.initTapHistoryUI(localAppServices);
                            if (m.showPanel) m.showPanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Tap History error:', e); }
            },
            menuTapVisual: () => {
                console.log('[Menu] Tap Tempo Visual clicked');
                try {
                    if (window.TapTempoVisual && window.TapTempoVisual.toggleVisualPanel) {
                        window.TapTempoVisual.toggleVisualPanel();
                    } else {
                        import('./TapTempoVisual.js').then(m => {
                            if (m.initTapTempoVisual) m.initTapTempoVisual(localAppServices);
                            if (m.toggleVisualPanel) m.toggleVisualPanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Tap Tempo Visual error:', e); }
            },
            menuHeadroomMeter: () => {
                console.log('[Menu] Track Headroom Meter clicked');
                try {
                    if (window.openTrackHeadroomMeterPanel) {
                        window.openTrackHeadroomMeterPanel();
                    }
                } catch(e) { console.error('[Menu] Track Headroom Meter error:', e); }
            },
            menuHeadphoneMix: () => {
                console.log('[Menu] Headphone Mix clicked');
                try {
                    localAppServices.openTrackHeadphoneMixPanel?.();
                } catch(e) { console.error('[Menu] Headphone Mix error:', e); }
            },
            menuLoopRegionPresets: () => {
                console.log('[Menu] Loop Region Presets clicked');
                try {
                    if (window.openLoopRegionPresetsPanel) {
                        window.openLoopRegionPresetsPanel();
                    } else {
                        import('./LoopRegionPresets.js').then(m => {
                            if (m.initLoopRegionPresets) m.initLoopRegionPresets(localAppServices);
                            if (m.openLoopRegionPresetsPanel) m.openLoopRegionPresetsPanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Loop Region Presets error:', e); }
            },
            menuLoopRegionQuickSet: () => {
                console.log('[Menu] Loop Region Quick Set clicked');
                try {
                    localAppServices.openLoopRegionQuickSetSettings?.();
                } catch(e) { console.error('[Menu] Loop Region Quick Set error:', e); }
            },
            menuLoopUntilMarker: () => {
                console.log('[Menu] Loop Until Marker clicked');
                try {
                    if (typeof localAppServices.openLoopUntilMarkerPanel === 'function') {
                        localAppServices.openLoopUntilMarkerPanel();
                    } else {
                        import('./LoopUntilMarker.js').then(m => {
                            if (m.openLoopUntilMarkerPanel) m.openLoopUntilMarkerPanel();
                        }).catch(e => console.error('[Menu] Loop Until Marker dynamic import error:', e));
                    }
                } catch(e) { console.error('[Menu] Loop Until Marker error:', e); }
            },
            menuLoopPracticeTrainer: () => {
                console.log('[Menu] Loop Practice Trainer clicked');
                try {
                    localAppServices.openLoopPracticeTrainerPanel?.();
                } catch(e) { console.error('[Menu] Loop Practice Trainer error:', e); }
            },
            menuTrackNotes: () => {
                console.log('[Menu] Track Notes clicked');
                try {
                    localAppServices.openTrackNotesPanel?.();
                } catch(e) { console.error('[Menu] Track Notes error:', e); }
            },
            menuOneShotPreviewPad: () => {
                console.log('[Menu] One-Shot Preview Pad clicked');
                try {
                    localAppServices.openOneShotPreviewPadPanel?.();
                } catch(e) { console.error('[Menu] One-Shot Preview Pad error:', e); }
            },
            menuBounceToTrack: () => {
                console.log('[Menu] Bounce To Track clicked');
                try {
                    localAppServices.openBounceToTrackPanel?.();
                } catch(e) { console.error('[Menu] Bounce To Track error:', e); }
            },
            menuWaveformVisualizer: () => {
                console.log('[Menu] Waveform Visualizer clicked');
                try {
                    localAppServices.openWaveformVisualizerPanel?.();
                } catch(e) { console.error('[Menu] Waveform Visualizer error:', e); }
            },
            menuAudioRecording: () => {
                console.log('[Menu] Audio Recording clicked');
                try {
                    localAppServices.openAudioRecordingPanel?.();
                } catch(e) { console.error('[Menu] Audio Recording error:', e); }
            },
            menuDrumKitPieceSelector: () => {
                console.log('[Menu] Drum Kit Piece Selector clicked');
                try {
                    localAppServices.openDrumKitPieceSelectorPanel?.();
                } catch(e) { console.error('[Menu] Drum Kit Piece Selector error:', e); }
            },
            menuLoudnessMeter: () => {
                console.log('[Menu] Loudness Meter clicked');
                try {
                    localAppServices.openLoudnessMeterPanel?.();
                } catch(e) { console.error('[Menu] Loudness Meter error:', e); }
            },
            menuSendsOverview: () => {
                console.log('[Menu] Sends Overview clicked');
                try {
                    localAppServices.openSendsOverviewPanel?.();
                } catch(e) { console.error('[Menu] Sends Overview error:', e); }
            },
            menuProjectSearch: () => {
                console.log('[Menu] Project Search clicked');
                try {
                    localAppServices.openProjectSearchPanel?.();
                } catch(e) { console.error('[Menu] Project Search error:', e); }
            },
            menuMasterLimiter: () => {
                console.log('[Menu] Master Limiter clicked');
                try {
                    localAppServices.openMasterLimiterPanel?.();
                } catch(e) { console.error('[Menu] Master Limiter error:', e); }
            },
            menuMixBusGroupPresets: () => {
                console.log('[Menu] Mix-Bus Group Presets clicked');
                try {
                    localAppServices.openMixBusGroupPresetsPanel?.();
                } catch(e) { console.error('[Menu] Mix-Bus Group Presets error:', e); }
            },
            menuWebAudioPluginHost: () => {
                console.log('[Menu] WebAudio Plugin Host clicked');
                try {
                    localAppServices.openWebAudioPluginHostPanel?.();
                } catch(e) { console.error('[Menu] WebAudio Plugin Host error:', e); }
            },
            menuLoopRegionSnap: () => {
                console.log('[Menu] Loop Region Snap clicked');
                try {
                    localAppServices.openLoopSnapPanel?.();
                } catch(e) { console.error('[Menu] Loop Region Snap error:', e); }
            },
            menuTempoRamper: () => {
                console.log('[Menu] Tempo Ramper clicked');
                try {
                    localAppServices.openTempoRamperPanel?.();
                } catch(e) { console.error('[Menu] Tempo Ramper error:', e); }
            },
            menuTempoRamperVisual: () => {
                console.log('[Menu] Tempo Ramper Visual clicked');
                try {
                    localAppServices.openTempoRamperVisual?.();
                } catch(e) { console.error('[Menu] Tempo Ramper Visual error:', e); }
            },
            menuTempoForecast: () => {
                console.log('[Menu] Tempo Forecast clicked');
                try {
                    if (window.openTempoForecastOverlay) {
                        window.openTempoForecastOverlay();
                    } else {
                        import('./TempoForecastOverlay.js').then(m => {
                            if (m.initTempoForecastOverlay) m.initTempoForecastOverlay(localAppServices);
                            if (m.openTempoForecastOverlay) m.openTempoForecastOverlay();
                        });
                    }
                } catch(e) { console.error('[Menu] Tempo Forecast error:', e); }
            },
            menuAutoThreshold: () => {
                console.log('[Menu] Auto Threshold clicked');
                try {
                    if (window.openAutoThresholdPanel) {
                        window.openAutoThresholdPanel();
                    } else {
                        import('./AutoDuckingThreshold.js').then(m => {
                            if (m.initAutoDuckingThreshold) m.initAutoDuckingThreshold(localAppServices);
                            if (m.openAutoThresholdPanel) {
                                // Default to first track if available
                                const tracks = localAppServices.getTracks?.() || [];
                                m.openAutoThresholdPanel(tracks.length > 0 ? tracks[0].id : 0);
                            }
                        });
                    }
                } catch(e) { console.error('[Menu] Auto Threshold error:', e); }
            },
            menuBeatDetective: () => {
                console.log('[Menu] Beat Detective clicked');
                try {
                    localAppServices.openBeatDetectivePanel?.();
                } catch(e) { console.error('[Menu] Beat Detective error:', e); }
            },
            menuCpuPerformance: () => {
                console.log('[Menu] CPU Performance Mode clicked');
                try {
                    if (window.cpuPerformanceMode) {
                        window.cpuPerformanceMode.toggle();
                    }
                } catch(e) { console.error('[Menu] CPU Performance error:', e); }
            },
            menuPlaybackRate: () => {
                console.log('[Menu] Playback Rate clicked');
                try {
                    if (window.PlaybackRateShifter && window.PlaybackRateShifter.openPanel) {
                        window.PlaybackRateShifter.openPanel();
                    }
                } catch(e) { console.error('[Menu] Playback Rate error:', e); }
            },
            menuAudioDucker: () => {
                console.log('[Menu] Audio Ducker clicked');
                try {
                    if (window.AudioDucker && window.AudioDucker.toggleAudioDuckerPanel) {
                        window.AudioDucker.toggleAudioDuckerPanel();
                    } else {
                        import('./AudioDucker.js').then(m => {
                            if (m.initAudioDucker) m.initAudioDucker(localAppServices);
                            if (m.toggleAudioDuckerPanel) m.toggleAudioDuckerPanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Audio Ducker error:', e); }
            },
            menuSidechainAttackShape: () => {
                console.log('[Menu] Sidechain Attack Shape clicked');
                try {
                    if (window.SidechainAttackShape && window.SidechainAttackShape.openSidechainAttackShapePanel) {
                        window.SidechainAttackShape.openSidechainAttackShapePanel();
                    } else {
                        import('./SidechainAttackShape.js').then(m => {
                            if (m.initSidechainAttackShape) m.initSidechainAttackShape(localAppServices);
                            if (m.openSidechainAttackShapePanel) m.openSidechainAttackShapePanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Sidechain Attack Shape error:', e); }
            },
            menuAdaptiveGrid: () => {
                console.log('[Menu] Adaptive Grid clicked');
            },
            menuTempoSyncGrid: () => {
                console.log("[Menu] Tempo Sync Grid clicked");
                try {
                    if (window.TempoSyncGrid && window.TempoSyncGrid.initTempoSyncGrid) {
                        window.TempoSyncGrid.initTempoSyncGrid(localAppServices);
                    } else {
                        import("./TempoSyncGrid.js").then(m => {
                            if (m.initTempoSyncGrid) m.initTempoSyncGrid(localAppServices);
                        });
                    }
                } catch(e) { console.error("[Menu] Tempo Sync Grid error:", e); }
            },
            menuTrackFreeze: () => {
                console.log('[Menu] Track Freeze clicked');
                try {
                    if (window.TrackFreeze && window.TrackFreeze.openTrackFreezePanel) {
                        window.TrackFreeze.openTrackFreezePanel();
                    } else {
                        import('./TrackFreeze.js').then(m => {
                            if (m.initTrackFreeze) m.initTrackFreeze(localAppServices);
                            if (m.openTrackFreezePanel) m.openTrackFreezePanel();
                        });
                    }
                } catch(e) { console.error('[Menu] Track Freeze error:', e); }
            },
            menuGhostNotesPreview: () => {
                console.log('[Menu] Ghost Notes Preview clicked');
                try {
                    if (window.ghostNotesPreview) {
                        // Get the selected drum track or first drum track
                        const tracks = window.tracks || [];
                        const drumTrack = tracks.find(t => t.type === 'DrumSampler');
                        if (drumTrack) {
                            window.ghostNotesPreview.openPanel(drumTrack.id);
                        } else {
                            window.appServices?.showNotification?.('No Drum Sampler track found', 3000);
                        }
                    }
                } catch(e) { console.error('[Menu] Ghost Notes Preview error:', e); }
            },
            menuNoteLengthDefault: () => {
                console.log('[Menu] Note Length Default clicked');
                try {
                    import('./NoteLengthDefault.js').then(m => {
                        if (m.initNoteLengthDefault) m.initNoteLengthDefault(localAppServices);
                        if (m.openNoteLengthPanel) m.openNoteLengthPanel();
                    });
                } catch(e) { console.error('[Menu] Note Length Default error:', e); }
            },
            menuPitchDriftCorrection: () => {
                console.log('[Menu] Pitch Drift Correction clicked');
                try {
                    openPitchDriftCorrectionPanel();
                } catch(e) { console.error('[Menu] Pitch Drift Correction error:', e); }
            },
        };

        for (const menuItemId in menuActions) {
            if (uiCache[menuItemId]) {
                uiCache[menuItemId].addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log(`[Menu] CLICK FIRED: ${menuItemId}`);
                    menuActions[menuItemId]();
                    if (uiCache.startMenu) uiCache.startMenu.classList.add('hidden');
                });
            } else {
                console.warn(`[Menu] NOT FOUND: ${menuItemId}`);
            }
        }

        if (uiCache.loadProjectInput) {
            uiCache.loadProjectInput.addEventListener('change', (e) => {
                if (localAppServices.handleProjectFileLoad) {
                    localAppServices.handleProjectFileLoad(e);
                } else {
                    console.error("[EventHandlers] handleProjectFileLoad service not available.");
                }
            });
        } else {
            console.warn("[EventHandlers] Load project input (uiCache.loadProjectInput) not found.");
        }
    } catch (error) {
        console.error("[EventHandlers initializePrimaryEventListeners] Error during initialization:", error);
        showNotification("Error setting up primary interactions. Some UI might not work.", 5000);
    }
}

export function attachGlobalControlEvents(elements) {
    if (!elements) {
        console.error('[EventHandlers attachGlobalControlEvents] Elements object is null or undefined.');
        return;
    }
    const { playBtnGlobal, recordBtnGlobal, stopBtnGlobal, tempoGlobalInput, tempoNudgeDown, tempoNudgeUp, tempoFineNudgeDown, tempoFineNudgeUp, midiInputSelectGlobal, midiOutputSelectGlobal, playbackModeToggleBtnGlobal, midiLearnBtnGlobal, tapBtnGlobal, tapHistoryBtn, tapVisualBtn, tapSettingsBtn, loopToggleBtnGlobal, loopStartInput, loopEndInput, metronomeToggleBtnGlobal, metronomeVolumeSlider, metronomeVolumeDisplay, metronomeVolumeControl, performanceMonitorBtn, autoSaveToggleBtn, beatLfoToggleBtnGlobal, scaleSelectGlobal, keySelectGlobal, scaleNotesDisplay, stretchQualityBtn } = elements;
    // Helper function to toggle play/pause icons
    function setPlayButtonState(isPlaying) {
        if (!playBtnGlobal) return;
        const playIcon = playBtnGlobal.querySelector('.play-icon');
        const pauseIcon = playBtnGlobal.querySelector('.pause-icon');
        if (isPlaying) {
            playBtnGlobal.classList.add('playing');
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
        } else {
            playBtnGlobal.classList.remove('playing');
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        }
    }
    // Initialize to stopped state
    setPlayButtonState(false);

    // === Loop Region Controls ===
    if (loopToggleBtnGlobal) {
        // Update loop button state from current state
        const updateLoopButtonState = () => {
            const loopEnabled = typeof getLoopRegionEnabled === 'function' ? getLoopRegionEnabled() : false;
            loopToggleBtnGlobal.textContent = loopEnabled ? 'Loop: On' : 'Loop: Off';
            loopToggleBtnGlobal.classList.toggle('playing', loopEnabled);
        };
        updateLoopButtonState();
        loopToggleBtnGlobal.addEventListener('click', async () => {
            const currentEnabled = typeof getLoopRegionEnabled === 'function' ? getLoopRegionEnabled() : false;
            if (typeof setLoopRegionEnabled === 'function') {
                setLoopRegionEnabled(!currentEnabled);
                updateLoopButtonState();
                showNotification(`Loop region ${!currentEnabled ? 'enabled' : 'disabled'}`, 1500);
                
                // If enabling, initialize audio context if needed and start scheduling
                if (!currentEnabled) {
                    if (localAppServices.initAudioContextAndMasterMeter) {
                        await localAppServices.initAudioContextAndMasterMeter(true);
                    }
                    // Start metronome scheduling if transport is running
                    if (typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
                        startMetronomeScheduling('4n');
                    }
                } else {
                    // If disabling, stop metronome scheduling
                    stopMetronomeScheduling();
                }
            }
        });
    }
    // === End Loop Region Controls ===

    // === Metronome Controls ===
    if (metronomeToggleBtnGlobal) {
        const updateMetronomeButtonState = () => {
            const metronomeEnabled = typeof getMetronomeEnabled === 'function' ? getMetronomeEnabled() : false;
            metronomeToggleBtnGlobal.textContent = metronomeEnabled ? '🔔 Metronome' : '🔲 Metronome';
            metronomeToggleBtnGlobal.classList.toggle('playing', metronomeEnabled);
        };
        updateMetronomeButtonState();

        metronomeToggleBtnGlobal.addEventListener('click', async () => {
            const currentEnabled = typeof getMetronomeEnabled === 'function' ? getMetronomeEnabled() : false;
            if (typeof setMetronomeEnabled === 'function') {
                setMetronomeEnabled(!currentEnabled);
                updateMetronomeButtonState();
                showNotification(`Metronome ${!currentEnabled ? 'enabled' : 'disabled'}`, 1500);
                
                // If enabling, initialize audio context if needed and start scheduling
                if (!currentEnabled) {
                    if (localAppServices.initAudioContextAndMasterMeter) {
                        await localAppServices.initAudioContextAndMasterMeter(true);
                    }
                    // Start metronome scheduling if transport is running
                    if (typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
                        startMetronomeScheduling('4n');
                    }
                } else {
                    // If disabling, stop metronome scheduling
                    stopMetronomeScheduling();
                }
            }
        });
    }
    // === End Metronome Controls ===

    // === Metronome Volume Control ===
    if (metronomeVolumeSlider) {
        // Initialize slider value from state
        if (typeof getMetronomeVolume === 'function') {
            const vol = getMetronomeVolume();
            metronomeVolumeSlider.value = Math.round(vol * 100);
            if (metronomeVolumeDisplay) metronomeVolumeDisplay.textContent = Math.round(vol * 100) + '%';
        }

        metronomeVolumeSlider.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value) / 100;
            if (typeof setMetronomeVolume === 'function') {
                setMetronomeVolume(vol);
            }
            if (metronomeVolumeDisplay) metronomeVolumeDisplay.textContent = e.target.value + '%';
        });

        metronomeVolumeSlider.addEventListener('change', (e) => {
            const vol = parseInt(e.target.value) / 100;
            if (typeof setMetronomeVolume === 'function') {
                setMetronomeVolume(vol);
            }
            // Sync to audio engine
            if (typeof playMetronomeClick === 'function') {
                playMetronomeClick(true);
            }
        });
    }
    // === End Metronome Volume Control ===

    // === Performance Monitor Button ===
    if (performanceMonitorBtn) {
        performanceMonitorBtn.addEventListener('click', () => {
            if (typeof openPerformancePanel === 'function') openPerformancePanel();
        });
    }
    // === End Performance Monitor Button ===

    // === Audio Stretching Quality Toggle Button ===
    if (stretchQualityBtn) {
        stretchQualityBtn.addEventListener('click', () => {
            if (typeof openAudioStretchQualityPanel === 'function') {
                openAudioStretchQualityPanel();
            } else if (localAppServices.openStretchQualityPanel) {
                localAppServices.openStretchQualityPanel();
            } else {
                showNotification?.('Audio stretch quality panel not available', 'warning');
            }
        });
    }
    // === End Audio Stretching Quality Button ===

    // === Auto-Save Toggle Button ===
    if (autoSaveToggleBtn) {
        autoSaveToggleBtn.addEventListener('click', () => {
            if (localAppServices.toggleAutoSave) {
                localAppServices.toggleAutoSave();
            } else if (localAppServices.showNotification) {
                localAppServices.showNotification('Auto-save toggle not available', 2000);
            }
        });
    }
    // === End Auto-Save Toggle Button ===

    // === Beat-Synced LFO Button ===
    if (beatLfoToggleBtnGlobal) {
        beatLfoToggleBtnGlobal.addEventListener('click', () => {
            if (localAppServices.openBeatSyncedLFOPanel) {
                localAppServices.openBeatSyncedLFOPanel();
            } else if (localAppServices.showNotification) {
                localAppServices.showNotification('Beat-Synced LFO not available', 2000);
            }
        });
    }
    // === End Beat-Synced LFO Button ===

    // === Tempo Sync Visualizer Button ===
    const tempoSyncToggleBtnGlobal = document.getElementById('tempoSyncToggleBtnGlobal');
    if (tempoSyncToggleBtnGlobal) {
        tempoSyncToggleBtnGlobal.addEventListener('click', () => {
            if (localAppServices.openTempoSyncVisualizerPanel) {
                localAppServices.openTempoSyncVisualizerPanel();
            } else if (localAppServices.showNotification) {
                localAppServices.showNotification('Tempo Sync Visualizer not available', 2000);
            }
        });
    }
    // === End Tempo Sync Visualizer Button ===

    // === Snap Grid Button ===
    const snapGridToggleBtnGlobal = document.getElementById('snapGridToggleBtnGlobal');
    if (snapGridToggleBtnGlobal) {
        snapGridToggleBtnGlobal.addEventListener('click', () => {
            if (localAppServices.openSnapGridPanel) {
                localAppServices.openSnapGridPanel();
            } else if (localAppServices.showNotification) {
                localAppServices.showNotification('Snap Grid not available', 2000);
            }
        });
    }
    // === End Snap Grid Button ===

    // === Phase Correlation Meter Button ===
    const phaseCorrToggleBtnGlobal = document.getElementById('phaseCorrToggleBtnGlobal');
    if (phaseCorrToggleBtnGlobal) {
        phaseCorrToggleBtnGlobal.addEventListener('click', () => {
            if (localAppServices.openPhaseCorrelationMeterPanel) {
                localAppServices.openPhaseCorrelationMeterPanel();
            } else if (localAppServices.showNotification) {
                localAppServices.showNotification('Phase Correlation Meter not available', 2000);
            }
        });
    }
    // === End Phase Correlation Meter Button ===

    // === Audio Stretch Quality Button ===
    if (stretchQualityBtn) {
        stretchQualityBtn.addEventListener('click', () => {
            if (typeof openAudioStretchQualityPanel === 'function') {
                openAudioStretchQualityPanel();
            } else {
                showNotification?.('Audio stretch quality panel not available', 'warning');
            }
        });
    }
    // === End Audio Stretch Quality Button ===

    // === Track Solo Chain Button ===
    const trackSoloChainBtnGlobal = document.getElementById('trackSoloChainBtnGlobal');
    if (trackSoloChainBtnGlobal) {
        trackSoloChainBtnGlobal.addEventListener('click', () => {
            if (window.openSoloChainPanel) {
                window.openSoloChainPanel();
            } else if (localAppServices.showNotification) {
                localAppServices.showNotification('Track Solo Chain not available', 2000);
            }
        });
    }
    // === End Track Solo Chain Button ===

    // === Solo Mode Toggle Button ===
    const soloModeToggleBtn = document.getElementById('soloModeToggleBtn');
    if (soloModeToggleBtn) {
        // Update button text based on current mode
        const updateBtnText = () => {
            const mode = getSoloMode();
            soloModeToggleBtn.textContent = `Solo: ${mode === 'exclusive' ? 'Excl' : 'Chain'}`;
        };
        updateBtnText();

        soloModeToggleBtn.addEventListener('click', () => {
            toggleSoloMode();
            updateBtnText();
            const mode = getSoloMode();
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Solo mode: ${mode === 'exclusive' ? 'Exclusive (one track)' : 'Chain (multiple tracks)'}`, 1500);
            }
        });
    }
    // === End Solo Mode Toggle Button ===

    // === Snap Resolution Button ===
    const snapResolutionBtn = document.getElementById('snapResolutionBtn');
    if (snapResolutionBtn) {
        snapResolutionBtn.addEventListener('click', () => {
            import('./TimelineSnapResolution.js').then(module => {
                if (module.initTimelineSnapResolution) {
                    module.initTimelineSnapResolution(localAppServices);
                }
                if (module.openSnapResolutionPanel) {
                    module.openSnapResolutionPanel();
                }
            }).catch(err => console.error('[EventHandlers] Failed to load TimelineSnapResolution:', err));
        });
    }
    // === End Snap Resolution Button ===

    // === Note Length Default Button ===
    const noteLengthBtn = document.getElementById('noteLengthBtn');
    if (noteLengthBtn) {
        noteLengthBtn.addEventListener('click', () => {
            import('./NoteLengthDefault.js').then(module => {
                if (module.initNoteLengthDefault) {
                    module.initNoteLengthDefault(localAppServices);
                }
                if (module.openNoteLengthPanel) {
                    module.openNoteLengthPanel();
                }
            }).catch(err => console.error('[EventHandlers] Failed to load NoteLengthDefault:', err));
        });
    }
    // === End Note Length Default Button ===

    // === Scale/Key Selector Controls ===
    function updateScaleNotesDisplay() {
        if (!scaleSelectGlobal || !keySelectGlobal || !scaleNotesDisplay) return;
        const scaleId = scaleSelectGlobal.value;
        const keyRoot = keySelectGlobal.value;
        const scaleObj = Constants.AVAILABLE_SCALES.find(s => s.id === scaleId);
        if (scaleObj) {
            const notes = Constants.getScaleNotes(keyRoot, scaleObj.intervals);
            scaleNotesDisplay.textContent = notes.join(' - ');
        }
    }

    if (scaleSelectGlobal) {
        scaleSelectGlobal.addEventListener('change', () => {
            updateScaleNotesDisplay();
            if (localAppServices.setGlobalScale) {
                localAppServices.setGlobalScale(scaleSelectGlobal.value);
            }
        });
    }

    if (keySelectGlobal) {
        keySelectGlobal.addEventListener('change', () => {
            updateScaleNotesDisplay();
            if (localAppServices.setGlobalKey) {
                localAppServices.setGlobalKey(keySelectGlobal.value);
            }
        });
    }

    if (scaleNotesDisplay) {
        updateScaleNotesDisplay();
    }
    // === End Scale/Key Controls ===

    if (playBtnGlobal) {
        playBtnGlobal.addEventListener('click', async () => {
            try {
                if (!localAppServices.initAudioContextAndMasterMeter) {
                    console.error("initAudioContextAndMasterMeter service not available.");
                    showNotification("Audio system error.", 3000); return;
                }
                const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
                if (!audioReady) {
                    showNotification("Audio context not ready. Please interact with the page.", 3000);
                    return;
                }

                const transport = Tone.Transport;
                console.log(`[EventHandlers Play/Resume] Clicked. Transport state: ${transport.state}, time: ${transport.seconds.toFixed(2)}`);

                const tracks = getTracks();
                tracks.forEach(track => { if (typeof track.stopPlayback === 'function') track.stopPlayback(); });
                transport.cancel(0);

                if (transportKeepAliveBufferSource && !transportKeepAliveBufferSource.disposed) {
                    try { transportKeepAliveBufferSource.stop(0); transportKeepAliveBufferSource.dispose(); } catch (e) {}
                    transportKeepAliveBufferSource = null;
                }

                if (transport.state === 'stopped' || transport.state === 'paused') {
                    const wasPaused = transport.state === 'paused';
                    const startTime = wasPaused ? transport.seconds : 0;
                    if (!wasPaused) transport.position = 0;

                    console.log(`[EventHandlers Play/Resume] Starting/Resuming from ${startTime.toFixed(2)}s.`);
                    
                    // Get loop region settings from state
                    const loopRegion = typeof getLoopRegion === 'function' ? getLoopRegion() : { enabled: false, start: 0, end: 16 };
                    
                    transport.loop = loopRegion.enabled;
                    transport.loopStart = loopRegion.start;
                    transport.loopEnd = loopRegion.end;
                    console.log(`[EventHandlers Play/Resume] Loop region: ${loopRegion.enabled ? 'enabled' : 'disabled'} (${loopRegion.start}s - ${loopRegion.end}s)`);
                    
                    if (!silentKeepAliveBuffer && Tone.context) {
                        try {
                            silentKeepAliveBuffer = Tone.context.createBuffer(1, 1, Tone.context.sampleRate);
                            silentKeepAliveBuffer.getChannelData(0)[0] = 0;
                        } catch (e) { console.error("Error creating silent buffer:", e); silentKeepAliveBuffer = null; }
                    }
                    if (silentKeepAliveBuffer) {
                        transportKeepAliveBufferSource = new Tone.BufferSource(silentKeepAliveBuffer).toDestination();
                        transportKeepAliveBufferSource.loop = true;
                        transportKeepAliveBufferSource.start(Tone.now() + 0.02, 0, transport.loopEnd);
                    }

                    for (const track of tracks) {
                        if (typeof track.schedulePlayback === 'function') {
                            await track.schedulePlayback(startTime, transport.loopEnd);
                        }
                    }
                    transport.start(Tone.now() + 0.05, startTime);
                    
                    // Start metronome if enabled
                    if (getMetronomeEnabled()) {
                        startMetronomeScheduling('4n');
                    }
                    
                    playBtnGlobal.textContent = 'Pause';
                    playBtnGlobal.classList.add('playing');
                } else { 
                    console.log(`[EventHandlers Play/Resume] Pausing transport.`);
                    transport.pause();
                    playBtnGlobal.textContent = 'Play';
                    playBtnGlobal.classList.remove('playing');
                }
            } catch (error) {
                console.error("[EventHandlers Play/Pause] Error:", error);
                showNotification(`Error during playback: ${error.message}`, 4000);
                if (playBtnGlobal) {
                    playBtnGlobal.textContent = 'Play';
                    playBtnGlobal.classList.remove('playing');
                }
            }
        });
    } else { console.warn("[EventHandlers] playBtnGlobal not found in provided elements."); }

    if (stopBtnGlobal) {
        stopBtnGlobal.addEventListener('click', () => {
            console.log("[EventHandlers StopAll] Stop All button clicked.");
            if (localAppServices.panicStopAllAudio) {
                localAppServices.panicStopAllAudio();
            } else {
                console.error("[EventHandlers StopAll] panicStopAllAudio service not available.");
                if (typeof Tone !== 'undefined') {
                    Tone.Transport.stop();
                    Tone.Transport.cancel(0);
                    // Stop metronome when transport stops
                    stopMetronomeScheduling();
                }
                const playButton = localAppServices.uiElementsCache?.playBtnGlobal;
                if(playButton) {
                    playButton.textContent = 'Play';
                    playButton.classList.remove('playing');
                }
                showNotification("Emergency stop executed (minimal).", 2000);
            }
        });
    } else {
        console.warn("[EventHandlers] stopBtnGlobal not found in provided elements.");
    }

    if (panicBtnGlobal) {
        // Visual flash on the button when clicked, so the user gets a strong
        // visual confirmation that the panic fired (in addition to the
        // notification toast).
        panicBtnGlobal.addEventListener('click', () => {
            console.log("[EventHandlers Panic] MIDI Panic button clicked.");
            if (localAppServices.panicStopAllAudio) {
                localAppServices.panicStopAllAudio();
            } else {
                console.error("[EventHandlers Panic] panicStopAllAudio service not available.");
                if (typeof Tone !== 'undefined') {
                    Tone.Transport.stop();
                    Tone.Transport.cancel(0);
                    stopMetronomeScheduling();
                }
            }
            // Brief red flash on the button itself for unmistakable feedback
            panicBtnGlobal.classList.add('!bg-[#ff3030]');
            setTimeout(() => panicBtnGlobal.classList.remove('!bg-[#ff3030]'), 180);
            if (typeof showNotification === 'function') {
                showNotification("MIDI Panic: All audio stopped, All-Notes-Off sent.", 2000);
            } else if (typeof showSafeNotification === 'function') {
                showSafeNotification("MIDI Panic: All audio stopped, All-Notes-Off sent.", 2000);
            }
        });
    } else {
        console.warn("[EventHandlers] panicBtnGlobal not found in provided elements.");
    }

    if (recordBtnGlobal) {
        recordBtnGlobal.addEventListener('click', async () => {
            try {
                if (!localAppServices.initAudioContextAndMasterMeter) {
                    console.error("initAudioContextAndMasterMeter service not available.");
                    showNotification("Audio system error.", 3000); return;
                }
                const audioReady = await localAppServices.initAudioContextAndMasterMeter(true);
                if (!audioReady) { showNotification("Audio context not ready.", 3000); return; }

                const isCurrentlyRec = isTrackRecording();
                const trackToRecordId = getArmedTrackId();
                const trackToRecord = trackToRecordId !== null ? getTrackById(trackToRecordId) : null;

                if (!isCurrentlyRec) {
                    if (!trackToRecord) { showNotification("No track armed for recording.", 2000); return; }
                    let recordingInitialized = false;
                    if (trackToRecord.type === 'Audio') {
                        if (localAppServices.startAudioRecording) {
                            recordingInitialized = await localAppServices.startAudioRecording(trackToRecord, trackToRecord.isMonitoringEnabled);
                        } else { console.error("[EventHandlers] startAudioRecording service not available."); showNotification("Recording service unavailable.", 3000); }
                    } else { recordingInitialized = true; } 

                    if (recordingInitialized) {
                        // Count-in before recording
                        const { getCountInBars } = await import('./CountInAudio.js');
                        const countBars = getCountInBars();
                        if (countBars > 0) {
                            // Play count-in, callback will start recording
                            const bpm = Tone.Transport.bpm.value;
                            await playCountIn(async () => {
                                setIsRecording(true);
                                setRecordingTrackId(trackToRecord.id);
                                if (Tone.Transport.state !== 'started') { Tone.Transport.cancel(0); Tone.Transport.position = 0; }
                                setRecordingStartTime(Tone.Transport.seconds);
                                if (Tone.Transport.state !== 'started') Tone.Transport.start(); 
                                if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(true);
                                showNotification(`Recording started for ${trackToRecord.name}.`, 2000);
                            }, bpm);
                            return;
                        }
                        // No count-in, start immediately
                        setIsRecording(true);
                        setRecordingTrackId(trackToRecord.id);
                        if (Tone.Transport.state !== 'started') { Tone.Transport.cancel(0); Tone.Transport.position = 0; }
                        setRecordingStartTime(Tone.Transport.seconds);
                        if (Tone.Transport.state !== 'started') Tone.Transport.start(); 
                        if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(true);
                        showNotification(`Recording started for ${trackToRecord.name}.`, 2000);
                    } else { showNotification(`Failed to initialize recording for ${trackToRecord.name}.`, 3000); }
                } else { 
                    if (localAppServices.stopAudioRecording && getRecordingTrackId() !== null && getTrackById(getRecordingTrackId())?.type === 'Audio') {
                        await localAppServices.stopAudioRecording();
                    } 
                    setIsRecording(false);
                    const previouslyRecordingTrackId = getRecordingTrackId();
                    setRecordingTrackId(null);
                    if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(false);
                    const prevTrack = previouslyRecordingTrackId !== null ? getTrackById(previouslyRecordingTrackId) : null;
                    showNotification(`Recording stopped${prevTrack ? ` for ${prevTrack.name}` : ''}.`, 2000);
                }
            } catch (error) {
                console.error("[EventHandlers Record] Error:", error);
                showNotification(`Error during recording: ${error.message}`, 4000);
                if (localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(false); 
                setIsRecording(false); setRecordingTrackId(null); 
            }
        });
    } else { console.warn("[EventHandlers] recordBtnGlobal not found."); }

    if (tempoGlobalInput) {
        tempoGlobalInput.addEventListener('input', (e) => {
            try {
                const newTempo = parseFloat(e.target.value);
                if (!isNaN(newTempo) && newTempo >= Constants.MIN_TEMPO && newTempo <= Constants.MAX_TEMPO) {
                    Tone.Transport.bpm.value = newTempo;
                    if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
                }
            } catch (error) { console.error("[EventHandlers Tempo Input] Error:", error); }
        });
        tempoGlobalInput.addEventListener('change', () => { 
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Set Tempo to ${Tone.Transport.bpm.value.toFixed(1)}`);
            }
        });
        // Double-click to open fine-tune panel
        tempoGlobalInput.addEventListener('dblclick', () => {
            if (localAppServices.openTempoFineTunePanel) {
                localAppServices.openTempoFineTunePanel();
            } else {
                showNotification('Tempo: ' + Tone.Transport.bpm.value.toFixed(1) + ' BPM', 2000);
            }
        });
    } else { console.warn("[EventHandlers] tempoGlobalInput not found."); }

    // Tempo Nudge Buttons
    if (tempoNudgeDown) {
        tempoNudgeDown.addEventListener("click", (event) => {
            if (event.altKey) {
                const newTempo = Constants.DEFAULT_TEMPO;
                Tone.Transport.bpm.value = newTempo;
                if (tempoGlobalInput) tempoGlobalInput.value = newTempo.toFixed(1);
                if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
                localAppServices.captureStateForUndo?.(`Tempo reset to ${newTempo}`);
                return;
            }
            const step = event.shiftKey ? 1.0 : 0.1;
            const newTempo = Math.max(Constants.MIN_TEMPO, Tone.Transport.bpm.value - step);
            Tone.Transport.bpm.value = newTempo;
            if (tempoGlobalInput) tempoGlobalInput.value = newTempo.toFixed(1);
            if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            localAppServices.captureStateForUndo?.(`Tempo to ${newTempo.toFixed(1)}`);
        });
    }
    if (tempoNudgeUp) {
        tempoNudgeUp.addEventListener("click", (event) => {
            if (event.altKey) {
                const newTempo = Constants.DEFAULT_TEMPO;
                Tone.Transport.bpm.value = newTempo;
                if (tempoGlobalInput) tempoGlobalInput.value = newTempo.toFixed(1);
                if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
                localAppServices.captureStateForUndo?.(`Tempo reset to ${newTempo}`);
                return;
            }
            const step = event.shiftKey ? 1.0 : 0.1;
            const newTempo = Math.min(Constants.MAX_TEMPO, Tone.Transport.bpm.value + step);
            Tone.Transport.bpm.value = newTempo;
            if (tempoGlobalInput) tempoGlobalInput.value = newTempo.toFixed(1);
            if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            localAppServices.captureStateForUndo?.(`Tempo to ${newTempo.toFixed(1)}`);
        });
    }

    // Fine BPM Nudge handlers (+/- 0.01)
    if (tempoFineNudgeDown) {
        tempoFineNudgeDown.addEventListener("mousedown", () => {
            if (window.BPMNudge?.startBPMNudge) {
                window.BPMNudge.startBPMNudge(-1, window.BPMNudge.NUDGE_STEP_FINE);
            }
        });
        tempoFineNudgeDown.addEventListener("mouseup", () => {
            if (window.BPMNudge?.stopBPMNudge) window.BPMNudge.stopBPMNudge();
        });
        tempoFineNudgeDown.addEventListener("mouseleave", () => {
            if (window.BPMNudge?.stopBPMNudge) window.BPMNudge.stopBPMNudge();
        });
        tempoFineNudgeDown.addEventListener("click", () => {
            if (window.BPMNudge?.nudgeBPMFineDown) window.BPMNudge.nudgeBPMFineDown();
        });
    }
    if (tempoFineNudgeUp) {
        tempoFineNudgeUp.addEventListener("mousedown", () => {
            if (window.BPMNudge?.startBPMNudge) {
                window.BPMNudge.startBPMNudge(1, window.BPMNudge.NUDGE_STEP_FINE);
            }
        });
        tempoFineNudgeUp.addEventListener("mouseup", () => {
            if (window.BPMNudge?.stopBPMNudge) window.BPMNudge.stopBPMNudge();
        });
        tempoFineNudgeUp.addEventListener("mouseleave", () => {
            if (window.BPMNudge?.stopBPMNudge) window.BPMNudge.stopBPMNudge();
        });
        tempoFineNudgeUp.addEventListener("click", () => {
            if (window.BPMNudge?.nudgeBPMFineUp) window.BPMNudge.nudgeBPMFineUp();
        });
    }


    if (midiInputSelectGlobal) {
        midiInputSelectGlobal.addEventListener('change', (e) => {
            if (localAppServices.selectMIDIInput) localAppServices.selectMIDIInput(e.target.value);
            else console.error("[EventHandlers] selectMIDIInput service not available.");
        });
    } else { console.warn("[EventHandlers] midiInputSelectGlobal not found."); }

    // MIDI Output dropdown
    if (midiOutputSelectGlobal) {
        midiOutputSelectGlobal.addEventListener('change', (e) => {
            const deviceId = e.target.value;
            if (localAppServices.selectMidiOutput) {
                localAppServices.selectMidiOutput(deviceId);
            } else if (localAppServices.getMidiOutputDevices && localAppServices.getActiveMidiOutputState) {
                // Fallback: find device by id and use state functions directly
                const devices = localAppServices.getMidiOutputDevices();
                const device = devices.find(d => d.id === deviceId);
                if (localAppServices.showNotification) {
                    localAppServices.showNotification(device ? `MIDI Output: ${device.name} selected.` : 'MIDI Output cleared.', 2000);
                }
            }
        });
    } else { console.warn("[EventHandlers] midiOutputSelectGlobal not found."); }

    if (playbackModeToggleBtnGlobal) {
        playbackModeToggleBtnGlobal.addEventListener('click', () => {
            try {
                const currentGetMode = localAppServices.getPlaybackMode || getPlaybackModeState;
                const currentSetMode = localAppServices.setPlaybackMode || setPlaybackModeState;
                if (currentGetMode && currentSetMode) {
                    const currentMode = currentGetMode();
                    const newMode = currentMode === 'sequencer' ? 'timeline' : 'sequencer';
                    currentSetMode(newMode); 
                } else {
                    console.warn("[EventHandlers PlaybackModeToggle] getPlaybackMode or setPlaybackMode service not available.");
                }
            } catch (error) { console.error("[EventHandlers PlaybackModeToggle] Error:", error); }
        });
    } else { console.warn("[EventHandlers] playbackModeToggleBtnGlobal not found."); }

    // MIDI Learn button handler
    if (midiLearnBtnGlobal) {
        midiLearnBtnGlobal.addEventListener('click', () => {
            try {
                const currentMode = localAppServices.getMidiLearnMode ? localAppServices.getMidiLearnMode() : false;
                const newMode = !currentMode;
                
                if (localAppServices.setMidiLearnMode) {
                    localAppServices.setMidiLearnMode(newMode);
                }
                
                // Update button visual state
                if (newMode) {
                    midiLearnBtnGlobal.classList.add('playing');
                    midiLearnBtnGlobal.textContent = 'Learning...';
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('MIDI Learn: Move a CC knob to map it', 3000);
                    }
                } else {
                    midiLearnBtnGlobal.classList.remove('playing');
                    midiLearnBtnGlobal.textContent = 'Learn';
                    // Highlight currently mapped parameters with pulsing indicators
                    if (localAppServices.toggleMappedIndicators) {
                        localAppServices.toggleMappedIndicators();
                        const shown = localAppServices.areMappedIndicatorsVisible?.() ?? false;
                        if (localAppServices.showNotification) {
                            localAppServices.showNotification(shown ? 'MIDI mapped indicators shown' : 'MIDI mapped indicators hidden', 1500);
                        }
                    }
                }
            } catch (error) {
                console.error('[EventHandlers midiLearnBtnGlobal] Error:', error);
            }
        });
    }

    // Tap Tempo button handler
    if (tapBtnGlobal) {
        tapBtnGlobal.addEventListener('click', async () => {
            try {
                const { handleTapTempo } = await import('./ui.js');
                const tappedBpm = handleTapTempo();
                if (tappedBpm !== null) {
                    Tone.Transport.bpm.value = tappedBpm;
                    if (tempoGlobalInput) {
                        tempoGlobalInput.value = tappedBpm.toFixed(1);
                    }
                    if (localAppServices.updateTaskbarTempoDisplay) {
                        localAppServices.updateTaskbarTempoDisplay(tappedBpm);
                    }
                    tapBtnGlobal.style.backgroundColor = '#3a3a3a';
                    setTimeout(() => { tapBtnGlobal.style.backgroundColor = ''; }, 100);
                }
                // Show visual tap tempo indicator
                if (window.TapTempo) {
                    window.TapTempo.addTap(tappedBpm || 120);
                }
            } catch (error) {
                console.error("[EventHandlers TapTempo] Error:", error);
            }
        });
    }

    // Tap History button handler
    if (tapHistoryBtn) {
        tapHistoryBtn.addEventListener('click', () => {
            if (window.TapHistoryUI && window.TapHistoryUI.toggleHistoryPanel) {
                window.TapHistoryUI.toggleHistoryPanel();
            } else {
                // Try dynamic import
                import('./TapHistoryUI.js').then(module => {
                    if (module.initTapHistoryUI) module.initTapHistoryUI(localAppServices);
                    if (module.toggleHistoryPanel) module.toggleHistoryPanel();
                }).catch(err => console.error('[EventHandlers] Failed to load TapHistoryUI:', err));
            }
        });
    }

    // Tap Visual button handler
    if (tapVisualBtn) {
        tapVisualBtn.addEventListener('click', () => {
            if (window.TapTempoVisual && window.TapTempoVisual.toggleVisualPanel) {
                window.TapTempoVisual.toggleVisualPanel();
            } else {
                // Try dynamic import
                import('./TapTempoVisual.js').then(module => {
                    if (module.initTapTempoVisual) module.initTapTempoVisual(localAppServices);
                    if (module.toggleVisualPanel) module.toggleVisualPanel();
                }).catch(err => console.error('[EventHandlers] Failed to load TapTempoVisual:', err));
            }
        });
    }

    // Tap Settings button handler
    if (tapSettingsBtn) {
        tapSettingsBtn.addEventListener('click', () => {
            import('./TapTempoSettings.js').then(module => {
                if (module.initTapTempoSettings) module.initTapTempoSettings(localAppServices);
                if (module.toggleTapTempoSettings) module.toggleTapTempoSettings();
            }).catch(err => console.error('[EventHandlers] Failed to load TapTempoSettings:', err));
        });
    }

    // Initialize Tap Avg Display
    if (window.TapAvgDisplay && window.TapAvgDisplay.initTapAvgDisplay) {
        window.TapAvgDisplay.initTapAvgDisplay(localAppServices);
    } else {
        import('./TapAvgDisplay.js').then(module => {
            if (module.initTapAvgDisplay) module.initTapAvgDisplay(localAppServices);
        }).catch(err => console.error('[EventHandlers] Failed to load TapAvgDisplay:', err));
    }

    // Initialize Tap Tempo StdDev Display
    if (window.TapTempoStdDev && window.TapTempoStdDev.initTapTempoStdDev) {
        window.TapTempoStdDev.initTapTempoStdDev(localAppServices);
    } else {
        import('./TapTempoStdDev.js').then(module => {
            if (module.initTapTempoStdDev) module.initTapTempoStdDev(localAppServices);
        }).catch(err => console.error('[EventHandlers] Failed to load TapTempoStdDev:', err));
    }
}


export function setupMIDI() {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess()
            .then(onMIDISuccess, onMIDIFailure)
            .catch(onMIDIFailure); 
    } else {
        console.warn("WebMIDI is not supported in this browser.");
        showNotification("WebMIDI not supported. Cannot use MIDI devices.", 3000);
    }
}

function onMIDISuccess(midiAccess) {
    if (localAppServices.setMidiAccess) {
        localAppServices.setMidiAccess(midiAccess);
    } else {
        console.error("[EventHandlers onMIDISuccess] setMidiAccess service not available.");
    }

    const inputs = midiAccess.inputs.values();
    const selectElement = localAppServices.uiElementsCache?.midiInputSelectGlobal;

    if (!selectElement) {
        console.warn("[EventHandlers onMIDISuccess] MIDI input select element not found in uiCache.");
        return;
    }

    selectElement.innerHTML = '<option value="">No MIDI Input</option>'; 
    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
        if (input.value) {
            const option = document.createElement('option');
            option.value = input.value.id;
            option.textContent = input.value.name || `Unknown MIDI Device ${input.value.id.slice(-4)}`;
            selectElement.appendChild(option);
        }
    }

    const activeMIDIId = getActiveMIDIInputState()?.id; 
    if (activeMIDIId) {
        selectElement.value = activeMIDIId;
    }

    // Populate MIDI output devices dropdown
    if (localAppServices.uiElementsCache?.midiOutputSelectGlobal) {
        const outputSelect = localAppServices.uiElementsCache.midiOutputSelectGlobal;
        outputSelect.innerHTML = '<option value="">No MIDI Output</option>';
        const outputs = midiAccess.outputs.values();
        for (let output = outputs.next(); output && !output.done; output = outputs.next()) {
            if (output.value) {
                const option = document.createElement('option');
                option.value = output.value.id;
                option.textContent = output.value.name || `Unknown MIDI Device ${output.value.id.slice(-4)}`;
                outputSelect.appendChild(option);
            }
        }
        // Restore selected output
        const activeOutput = localAppServices.getActiveMidiOutputState?.();
        if (activeOutput?.id) {
            outputSelect.value = activeOutput.id;
        }
    }

    midiAccess.onstatechange = (event) => {
        console.log(`[MIDI] State change: ${event.port.name}, State: ${event.port.state}, Type: ${event.port.type}`);
        setupMIDI(); 
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`MIDI device ${event.port.name} ${event.port.state}.`, 2500);
        }
    };
}

function onMIDIFailure(msg) {
    console.error(`[MIDI] Failed to get MIDI access - ${msg}`);
    showNotification(`Failed to access MIDI devices: ${msg.toString()}`, 4000);
}

export function selectMIDIInput(deviceId, silent = false) {
    try {
        const midi = getMidiAccessState(); 
        const currentActiveInput = getActiveMIDIInputState(); 

        if (currentActiveInput && typeof currentActiveInput.close === 'function') {
            currentActiveInput.onmidimessage = null; 
            try {
                currentActiveInput.close();
            } catch (e) {
                console.warn(`[MIDI] Error closing previously active input "${currentActiveInput.name}":`, e.message);
            }
        }

        if (deviceId && midi && midi.inputs) {
            const input = midi.inputs.get(deviceId);
            if (input) {
                input.open().then((port) => {
                    port.onmidimessage = handleMIDIMessage;
                    if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(port);
                    if (!silent && localAppServices.showNotification) localAppServices.showNotification(`MIDI Input: ${port.name} selected.`, 2000);
                    console.log(`[MIDI] Input selected: ${port.name}`);
                }).catch(err => {
                    console.error(`[MIDI] Error opening port ${input.name}:`, err);
                    if (!silent && localAppServices.showNotification) localAppServices.showNotification(`Error opening MIDI port: ${input.name}`, 3000);
                    if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(null); 
                });
            } else {
                if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(null);
                if (!silent && deviceId !== "" && localAppServices.showNotification) showNotification("Selected MIDI input not found.", 2000);
                console.warn(`[MIDI] Input with ID ${deviceId} not found.`);
            }
        } else {
            if (localAppServices.setActiveMIDIInput) localAppServices.setActiveMIDIInput(null);
            if (!silent && deviceId !== "" && localAppServices.showNotification) showNotification("MIDI input disconnected.", 2000);
        }
    } catch (error) {
        console.error("[EventHandlers selectMIDIInput] Error:", error);
        if (!silent && localAppServices.showNotification) localAppServices.showNotification("Error selecting MIDI input.", 3000);
    }
}

async function handleMIDIMessage(message) {
    try {
        const [status, data1, data2] = message.data;
        const command = status & 0xF0; // Extract command (upper 4 bits)
        const channel = status & 0x0F; // Extract channel (lower 4 bits)
        const note = data1;
        const velocity = data2;
        
        const armedTrackId = getArmedTrackId();
        const armedTrack = armedTrackId !== null ? getTrackById(armedTrackId) : null;
        const midiIndicator = localAppServices.uiElementsCache?.midiIndicatorGlobal;

        if (midiIndicator) {
            midiIndicator.classList.add('active');
            setTimeout(() => midiIndicator.classList.remove('active'), 100);
        }

        // Handle MIDI Learn mode
        if (localAppServices.getMidiLearnMode && localAppServices.getMidiLearnMode()) {
            // In learn mode - capture CC messages for mapping
            if (command === 176) { // CC message
                const ccNumber = note;
                const ccValue = velocity;
                const learnTarget = localAppServices.getMidiLearnTarget ? localAppServices.getMidiLearnTarget() : null;
                
                if (learnTarget) {
                    // Create the mapping
                    if (localAppServices.addMidiMapping) {
                        localAppServices.addMidiMapping(ccNumber, channel, learnTarget);
                    }
                    
                    // Exit learn mode
                    if (localAppServices.setMidiLearnMode) {
                        localAppServices.setMidiLearnMode(false);
                    }
                    
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification(`Mapped CC${ccNumber} to ${learnTarget.paramPath}`, 2000);
                    }
                    
                    console.log(`[MIDI Learn] Mapped CC${ccNumber} ch${channel} to:`, learnTarget);
                    return;
                }
            }
        }

        // Handle CC messages for mapped parameters
        if (command === 176) { // CC message (176 = 0xB0)
            const ccNumber = note;
            const ccValue = velocity; // 0-127
            const normalizedValue = ccValue / 127; // 0-1
            const channelNum = channel;
            
            // Update CC visualizer
            if (localAppServices.updateCcVisualizerValue) {
                localAppServices.updateCcVisualizerValue(ccNumber, channelNum, normalizedValue);
            }
            
            // Record CC if recording is enabled
            if (localAppServices.getCcRecordingEnabled && localAppServices.getCcRecordingEnabled()) {
                const recordingStartTime = localAppServices.getCcRecordingStartTime ? localAppServices.getCcRecordingStartTime() : 0;
                const currentTime = Tone.Transport.seconds;
                const relativeTime = currentTime - recordingStartTime;
                
                if (relativeTime >= 0) {
                    const ccKey = `cc${ccNumber}_channel${channelNum}`;
                    if (localAppServices.addCcRecordingPoint) {
                        localAppServices.addCcRecordingPoint(ccKey, relativeTime, normalizedValue);
                    }
                }
            }
            
            // Check if this CC is mapped to something
            const mapping = localAppServices.getMidiMappingForCC ? localAppServices.getMidiMappingForCC(ccNumber, channel) : null;
            
            if (mapping) {
                applyMidiMapping(mapping, normalizedValue);
                return;
            }
        }

        // Handle Note On/Off for armed track
        if (!armedTrack) return;

        // Check MIDI channel filtering for armed track
        if (armedTrack.midiChannel !== 0 && armedTrack.midiChannel !== (channel + 1)) {
            // Track is set to a specific MIDI channel, but this message is on a different channel
            return;
        }

        const isNoteOn = command === 144 && velocity > 0;
        const isNoteOff = command === 128 || (command === 144 && velocity === 0);

        // Handle different track types
        if (armedTrack.type === 'DrumSampler') {
            // DrumSampler: MIDI notes 36-43 map to pads 0-7
            const padIndex = note - Constants.samplerMIDINoteStart;
            if (padIndex >= 0 && padIndex < Constants.numDrumSamplerPads) {
                const player = armedTrack.drumPadPlayers[padIndex];
                const padData = armedTrack.drumSamplerPads[padIndex];
                if (player && !player.disposed && player.loaded && padData) {
                    if (isNoteOn) {
                        player.volume.value = Tone.gainToDb((padData.volume || 0.7) * (velocity / 127) * 0.7);
                        player.playbackRate = Math.pow(2, (padData.pitchShift || 0) / 12);
                        player.start(Tone.now());
                    }
                }
            }
        } else if (armedTrack.type === 'InstrumentSampler') {
            // InstrumentSampler: uses toneSampler with chromatic mapping
            if (armedTrack.toneSampler && !armedTrack.toneSampler.disposed && armedTrack.toneSampler.loaded) {
                const freq = Tone.Frequency(note, "midi").toNote();
                if (isNoteOn) {
                    // Apply velocity curve if available
                    let vel = velocity / 127;
                    try {
                        const { applyVelocityCurveToInput } = await import('./TrackVelocityCurve.js');
                        vel = applyVelocityCurveToInput(armedTrack.id, vel);
                    } catch (e) { /* module not loaded, use raw velocity */ }
                    armedTrack.toneSampler.triggerAttack(freq, Tone.now(), vel);
                } else if (isNoteOff) {
                    armedTrack.toneSampler.triggerRelease(freq, Tone.now() + 0.05);
                }
            }
        } else if (armedTrack.type === 'Synth') {
            // Synth: uses instrument.triggerAttack/triggerRelease
            if (armedTrack.instrument && !armedTrack.instrument.disposed) {
                const freq = Tone.Frequency(note, "midi").toNote();
                if (isNoteOn) {
                    if (typeof armedTrack.instrument.triggerAttack === 'function') {
                        // Apply velocity curve if available
                        let vel = velocity / 127;
                        try {
                            const { applyVelocityCurveToInput } = await import('./TrackVelocityCurve.js');
                            vel = applyVelocityCurveToInput(armedTrack.id, vel);
                        } catch (e) { /* module not loaded, use raw velocity */ }
                        armedTrack.instrument.triggerAttack(freq, Tone.now(), vel);
                    }
                } else if (isNoteOff) {
                    if (typeof armedTrack.instrument.triggerRelease === 'function') {
                        armedTrack.instrument.triggerRelease(freq, Tone.now() + 0.05);
                    }
                }
            }
        }
    } catch (error) {
        console.error("[EventHandlers handleMIDIMessage] Error:", error, "Message Data:", message.data);
    }
}

/**
 * Applies a MIDI mapping to control a parameter.
 */
function applyMidiMapping(mapping, normalizedValue) {
    const { type, targetId, paramPath, min, max } = mapping;
    const actualValue = min + (normalizedValue * (max - min));
    
    try {
        if (type === 'master') {
            // Master parameter
            if (paramPath === 'volume') {
                if (localAppServices.setActualMasterVolume) {
                    localAppServices.setActualMasterVolume(actualValue);
                }
            } else if (paramPath.startsWith('effects.')) {
                // Master effect parameter: effects.0.wet
                const parts = paramPath.split('.');
                const effectIndex = parseInt(parts[1], 10);
                const paramName = parts[2];
                const masterEffects = localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : [];
                if (masterEffects[effectIndex]) {
                    if (localAppServices.updateMasterEffectParam) {
                        localAppServices.updateMasterEffectParam(masterEffects[effectIndex].id, paramName, actualValue);
                    }
                }
            }
        } else if (type === 'track' && targetId !== null) {
            // Track parameter
            const track = getTrackById(targetId);
            if (!track) return;
            
            if (paramPath === 'volume') {
                track.setVolume(actualValue, false);
            } else if (paramPath === 'pan') {
                track.setPan(actualValue, false);
            } else if (paramPath.startsWith('effects.')) {
                // Track effect parameter: effects.0.wet
                const parts = paramPath.split('.');
                const effectIndex = parseInt(parts[1], 10);
                const paramName = parts[2];
                const trackEffects = track.effects || [];
                if (trackEffects[effectIndex] && trackEffects[effectIndex].params) {
                    trackEffects[effectIndex].params[paramName] = actualValue;
                    if (trackEffects[effectIndex].toneNode && trackEffects[effectIndex].toneNode[paramName]) {
                        trackEffects[effectIndex].toneNode[paramName].value = actualValue;
                    }
                }
            }
        }
    } catch (error) {
        console.error('[MIDI Mapping] Error applying mapping:', error);
    }
}

const keyToMIDIMap = Constants.computerKeySynthMap || { 
    'a': 48, 'w': 49, 's': 50, 'e': 51, 'd': 52, 'f': 53, 't': 54, 'g': 55, 'y': 56, 'h': 57, 'u': 58, 'j': 59, 'k': 60
};


if (typeof document !== 'undefined') {
document.addEventListener('keydown', (event) => {
    try {
        if (event.repeat) return;
        const key = event.key.toLowerCase();
        const kbdIndicator = localAppServices.uiElementsCache?.keyboardIndicatorGlobal;

        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            if (key === 'escape') activeEl.blur();
            return; 
        }
        if (event.metaKey || event.ctrlKey) {
            if (!( (event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y'))) { 
                 return;
            }
        }

        if (key === 'z' && (event.ctrlKey || event.metaKey)) {
            if (localAppServices.undoLastAction) localAppServices.undoLastAction();
            return;
        }
        if (key === 'y' && (event.ctrlKey || event.metaKey)) {
             if (localAppServices.redoLastAction) localAppServices.redoLastAction();
            return;
        }
        if (key === 'z' && !(event.ctrlKey || event.metaKey)) {
            currentOctaveShift = Math.max(MIN_OCTAVE_SHIFT, currentOctaveShift - 1);
            if (localAppServices.showNotification) localAppServices.showNotification(`Octave: ${currentOctaveShift}`, 1000);
            return;
        }
        if (key === 'x' && !(event.ctrlKey || event.metaKey)) {
            currentOctaveShift = Math.min(MAX_OCTAVE_SHIFT, currentOctaveShift + 1);
            if (localAppServices.showNotification) localAppServices.showNotification(`Octave: ${currentOctaveShift}`, 1000);
            return;
        }
        if (key === ' ' && !(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'))) { 
            event.preventDefault(); 
            const playBtn = localAppServices.uiElementsCache?.playBtnGlobal;
            if (playBtn) playBtn.click();
            return;
        }
        if (key === 'Enter' && !(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'))) { 
            event.preventDefault(); 
            const recordBtn = localAppServices.uiElementsCache?.recordBtnGlobal;
            if (recordBtn) recordBtn.click();
            return;
        }
        if (key === 'Escape' || key === 'esc') {
            // Stop and reset transport first
            if (localAppServices.stopAndResetTransport) {
                localAppServices.stopAndResetTransport();
            } else if (localAppServices.panicStopAllAudio) {
                localAppServices.panicStopAllAudio();
            }
            // Then close all windows
            const allWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : [];
            allWindows.forEach(w => { if (w.close) w.close(); });
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === 'p' || key === 'P')) {
            // MIDI Panic: stop all audio + send All-Notes-Off on all 16 MIDI channels
            event.preventDefault();
            console.log("[EventHandlers Panic] Ctrl+Shift+P triggered.");
            if (localAppServices.panicStopAllAudio) {
                localAppServices.panicStopAllAudio();
            } else if (typeof Tone !== 'undefined') {
                Tone.Transport.stop();
                Tone.Transport.cancel(0);
                if (typeof stopMetronomeScheduling === 'function') stopMetronomeScheduling();
            }
            // Visual flash on the panic button if present
            const panicBtn = localAppServices.uiElementsCache?.panicBtnGlobal;
            if (panicBtn) {
                panicBtn.classList.add('!bg-[#ff3030]');
                setTimeout(() => panicBtn.classList.remove('!bg-[#ff3030]'), 180);
            }
            if (typeof localAppServices.showNotification === 'function') {
                localAppServices.showNotification("MIDI Panic: All audio stopped, All-Notes-Off sent.", 2000);
            } else if (typeof showNotification === 'function') {
                showNotification("MIDI Panic: All audio stopped, All-Notes-Off sent.", 2000);
            }
            return;
        }
        if (key === 'arrowleft') {
            const currentTempo = Tone.Transport.bpm.value;
            const step = event.shiftKey ? 1.0 : 0.1;
            const newTempo = Math.max(Constants.MIN_TEMPO, currentTempo - step);
            Tone.Transport.bpm.value = newTempo;
            if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            const input = localAppServices.uiElementsCache?.tempoGlobalInput;
            if (input) input.value = newTempo.toFixed(1);
            return;
        }
        if (key === 'arrowright') {
            const currentTempo = Tone.Transport.bpm.value;
            const step = event.shiftKey ? 1.0 : 0.1;
            const newTempo = Math.min(Constants.MAX_TEMPO, currentTempo + step);
            Tone.Transport.bpm.value = newTempo;
            if (localAppServices.updateTaskbarTempoDisplay) localAppServices.updateTaskbarTempoDisplay(newTempo);
            const input = localAppServices.uiElementsCache?.tempoGlobalInput;
            if (input) input.value = newTempo.toFixed(1);
            return;
        }
        // Q key - Open Smart Quantize Panel
        if (key === 'q' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.openSmartQuantizePanel) {
                localAppServices.openSmartQuantizePanel();
            }
            return;
        }
        // T key - Tap Tempo (register a tap AND trigger visual indicator)
        if (key === 't' && !(event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            const tapBtn = localAppServices.uiElementsCache?.tapBtnGlobal;
            if (tapBtn) {
                tapBtn.click();
            } else if (window.TapTempo) {
                // Fallback: at least show the visual indicator
                window.TapTempo.showIndicator();
            }
            return;
        }
        // E key - Toggle bypass on hovered/focused effect in effects rack
        if (key === 'e' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.getHoveredEffectId && localAppServices.toggleTrackEffectBypass && localAppServices.getTrackWithHoveredEffect) {
                const effectId = localAppServices.getHoveredEffectId();
                if (effectId) {
                    const track = localAppServices.getTrackWithHoveredEffect(effectId);
                    if (track) {
                        track.toggleEffectBypass(effectId);
                        return;
                    }
                }
            }
            // Fallback: try master effects rack
            if (localAppServices.toggleMasterEffectBypass && localAppServices.getHoveredEffectId) {
                const effectId = localAppServices.getHoveredEffectId();
                if (effectId) {
                    localAppServices.toggleMasterEffectBypass(effectId);
                    return;
                }
            }
        }
        // Delete key handler - delete selected clips or notes
        if (key === 'delete' || key === 'backspace') {
            event.preventDefault();
            
            // Check for selected timeline clips
            if (localAppServices.getSelectedClipIds) {
                const selectedClipIds = localAppServices.getSelectedClipIds();
                if (selectedClipIds && selectedClipIds.length > 0) {
                    captureStateForUndo(`Delete ${selectedClipIds.length} clip(s)`);
                    const result = deleteTimelineClips(Array.from(selectedClipIds));
                    if (result.success && result.deletedCount > 0) {
                        if (localAppServices.showNotification) {
                            localAppServices.showNotification(`Deleted ${result.deletedCount} clip(s)`, 1500);
                        }
                        if (localAppServices.clearClipSelections) {
                            localAppServices.clearClipSelections();
                        }
                        if (localAppServices.renderTimeline) {
                            localAppServices.renderTimeline();
                        }
                    }
                    return;
                }
            }
            
            // Check for selected piano roll notes
            const selectedNotesCount = getSelectedNotesCount();
            if (selectedNotesCount > 0) {
                captureStateForUndo(`Delete ${selectedNotesCount} note(s)`);
                const result = deleteSelectedNotes();
                if (result.success && result.deletedCount > 0) {
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification(`Deleted ${result.deletedCount} note(s)`, 1500);
                    }
                    if (localAppServices.updateTrackUI) {
                        const seqId = getActiveSequenceIdForSelection();
                        if (seqId && localAppServices.getTrackWithSequence) {
                            const track = localAppServices.getTrackWithSequence(seqId);
                            if (track) {
                                localAppServices.updateTrackUI(track.id, 'sequencerContentChanged');
                            }
                        }
                    }
                }
                return;
            }
            
            return;
        }
        // Ctrl+B - Bounce selected clips to audio
        if (key === 'b' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            
            const selectedClipIds = localAppServices.getSelectedClipIds?.() || [];
            if (selectedClipIds.length === 0) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('No clips selected. Select clips first.', 2000);
                }
                return;
            }
            
            // Get the track that contains the selected clips
            const tracks = localAppServices.getTracks?.() || [];
            let targetTrackId = null;
            for (const track of tracks) {
                if (track.clips?.some(c => selectedClipIds.includes(c.id))) {
                    targetTrackId = track.id;
                    break;
                }
            }
            
            if (targetTrackId) {
                if (localAppServices.openBounceDialog) {
                    localAppServices.openBounceDialog(targetTrackId);
                } else if (localAppServices.bounceSelectedClipsToAudio) {
                    localAppServices.bounceSelectedClipsToAudio(targetTrackId, selectedClipIds);
                } else {
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification('Bounce feature not available', 2000);
                    }
                }
            }
            return;
        }
        // Ctrl+D - Duplicate selected clips or notes
        if (key === 'd' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            
            // Check for selected timeline clips
            if (localAppServices.getSelectedClipIds) {
                const selectedClipIds = localAppServices.getSelectedClipIds();
                if (selectedClipIds && selectedClipIds.length > 0) {
                    captureStateForUndo(`Duplicate ${selectedClipIds.length} clip(s)`);
                    const result = duplicateTimelineClips(Array.from(selectedClipIds));
                    if (result.success && result.duplicatedCount > 0) {
                        if (localAppServices.showNotification) {
                            localAppServices.showNotification(`Duplicated ${result.duplicatedCount} clip(s)`, 1500);
                        }
                        // Select the new clips
                        const newClipIds = result.newClips.map(c => c.clip.id);
                        if (localAppServices.setSelectedClipIds) {
                            localAppServices.setSelectedClipIds(newClipIds);
                        }
                        if (localAppServices.renderTimeline) {
                            localAppServices.renderTimeline();
                        }
                    }
                    return;
                }
            }
            
            // Check for selected piano roll notes
            const selectedNotesCount = getSelectedNotesCount();
            if (selectedNotesCount > 0) {
                captureStateForUndo(`Duplicate ${selectedNotesCount} note(s)`);
                const result = duplicateSelectedNotes();
                if (result.success && result.duplicatedCount > 0) {
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification(`Duplicated ${result.duplicatedCount} note(s)`, 1500);
                    }
                    if (localAppServices.updateTrackUI) {
                        const seqId = getActiveSequenceIdForSelection();
                        if (seqId && localAppServices.getTrackWithSequence) {
                            const track = localAppServices.getTrackWithSequence(seqId);
                            if (track) {
                                localAppServices.updateTrackUI(track.id, 'sequencerContentChanged');
                            }
                        }
                    }
                }
                return;
            }
            
            return;
        }
        if (key === 'm' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.toggleMute) localAppServices.toggleMute(-1);
            return;
        }
        if (key === 's' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.toggleSolo) localAppServices.toggleSolo(-1);
            return;
        }
        if (key === 'r' && !(event.ctrlKey || event.metaKey)) {
            if (localAppServices.toggleRecordArm) localAppServices.toggleRecordArm(-1);
            return;
        }
        // L key - Toggle loop region
        if (key === 'l' && !(event.ctrlKey || event.metaKey)) {
            const currentEnabled = typeof getLoopRegionEnabled === 'function' ? getLoopRegionEnabled() : false;
            if (typeof setLoopRegionEnabled === 'function') {
                setLoopRegionEnabled(!currentEnabled);
                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Loop region ${!currentEnabled ? 'enabled' : 'disabled'}`, 1500);
                }
            }
            return;
        }
        // F2 key - Track Rename Hotkey
        if (event.key === 'F2' || (event.key === 'F2')) {
            event.preventDefault();
            if (localAppServices.handleTrackRenameKey) {
                localAppServices.handleTrackRenameKey();
            } else if (typeof handleTrackRenameKey === 'function') {
                handleTrackRenameKey();
            } else {
                import('./TrackRenameHotkey.js').then(m => {
                    if (m.handleTrackRenameKey) m.handleTrackRenameKey();
                });
            }
            return;
        }
        // ? key - Open keyboard shortcuts panel
        if (event.key === '?' || event.key === '/') {
            if (event.shiftKey) {
                event.preventDefault();
                if (localAppServices.openKeyboardShortcutsPanel) {
                    localAppServices.openKeyboardShortcutsPanel();
                }
                return;
            }
        }
        
        const midNote = keyToMIDIMap[key];
        if (midNote !== undefined) {
            if (localAppServices.uiElementsCache?.keyboardIndicatorGlobal) {
                localAppServices.uiElementsCache.keyboardIndicatorGlobal.textContent = key.toUpperCase();
                localAppServices.uiElementsCache.keyboardIndicatorGlobal.style.fill = 'var(--theme-keyboard-key-active, #00ff88)';
                setTimeout(() => {
                    if (localAppServices.uiElementsCache?.keyboardIndicatorGlobal) {
                        localAppServices.uiElementsCache.keyboardIndicatorGlobal.textContent = key.toUpperCase();
                        localAppServices.uiElementsCache.keyboardIndicatorGlobal.style.fill = ''; 
                    }
                }, 100);
            }
            if (localAppServices.handleComputerKeyOn) localAppServices.handleComputerKeyOn(midNote + (currentOctaveShift * 12));
            return;
        }
    } catch (error) {
        console.error("[EventHandlers keydown] Error:", error);
    }
});
}

if (typeof document !== 'undefined') {
document.addEventListener('keyup', (event) => {
    let armedTrack = null; 
    let midiNote = undefined;
    let freq = ''; 

    try {
        const key = event.key.toLowerCase();
        const kbdIndicator = localAppServices.uiElementsCache?.keyboardIndicatorGlobal;
        if (kbdIndicator) kbdIndicator.classList.remove('active');

        const armedTrackId = getArmedTrackId();
        armedTrack = armedTrackId !== null ? getTrackById(armedTrackId) : null; 

        if (!armedTrack || !armedTrack.instrument || typeof armedTrack.instrument.triggerRelease !== 'function' || armedTrack.instrument.disposed) {
            Object.keys(currentlyPressedComputerKeys).forEach(noteKey => delete currentlyPressedComputerKeys[noteKey]);
            return;
        }

        midiNote = keyToMIDIMap[event.key]; 
        if (midiNote === undefined && keyToMIDIMap[key]) midiNote = keyToMIDIMap[key]; 

        if (midiNote !== undefined && currentlyPressedComputerKeys[midiNote]) {
            const finalNote = midiNote + (currentOctaveShift * 12);
             if (finalNote >=0 && finalNote <= 127) { 
                freq = Tone.Frequency(finalNote, "midi").toNote(); 
                armedTrack.instrument.triggerRelease(freq, Tone.now()); 
            }
            delete currentlyPressedComputerKeys[midiNote];
        }
    } catch (error) {
        console.error("[EventHandlers Keyup] Error during specific note release:", error, 
            "Key:", event.key, 
            "Armed Track ID:", armedTrack ? armedTrack.id : 'N/A',
            "Instrument Type:", armedTrack && armedTrack.instrument ? armedTrack.instrument.name : 'N/A', 
            "Target Frequency:", freq,
            "Calculated MIDI Note:", midiNote
        );
        
        if (armedTrack && armedTrack.instrument && typeof armedTrack.instrument.releaseAll === 'function' && !armedTrack.instrument.disposed) {
            try {
                console.warn(`[EventHandlers Keyup] Forcing releaseAll on ${armedTrack.name} (instrument: ${armedTrack.instrument.name}) due to error on keyup for note ${freq || 'unknown'}.`);
                armedTrack.instrument.releaseAll(Tone.now());
            } catch (releaseAllError) {
                console.error("[EventHandlers Keyup] Error during emergency releaseAll:", releaseAllError);
            }
        }

        if (midiNote !== undefined && currentlyPressedComputerKeys[midiNote]) {
            delete currentlyPressedComputerKeys[midiNote];
        }
    }
});
}


// --- Track Control Handlers ---
export function handleTrackMute(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Mute: Track ${trackId} not found.`); return; }
        captureStateForUndo(`Toggle Mute for ${track.name}`);
        track.isMuted = !track.isMuted;
        track.applyMuteState();
        
        // Handle mute group exclusive mode - unmute others in group when this track is unmuted
        if (!track.isMuted) {
            handleMuteGroupExclusiveUnmute(trackId);
        }
        
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'muteChanged');
    } catch (error) { console.error(`[EventHandlers handleTrackMute] Error for track ${trackId}:`, error); }
}

export function handleTrackSolo(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Solo: Track ${trackId} not found.`); return; }
        const currentSoloed = getSoloedTrackId();
        const soloMode = getSoloMode();
        
        // Check if trying to unsolo a locked track
        if (track.isSoloed && track.soloLocked) {
            console.log(`[EventHandlers] Solo for track "${track.name}" is locked - cannot toggle off`);
            if (localAppServices.showNotification) localAppServices.showNotification('Solo is locked on this track', 1500);
            return;
        }
        
        captureStateForUndo(`Toggle Solo for ${track.name}`);
        
        if (soloMode === 'chain') {
            // Chain solo mode: multiple tracks can be soloed
            const chainSoloed = getSoloedTrackIds();
            const idx = chainSoloed.indexOf(trackId);
            
            if (idx !== -1) {
                // Track is currently soloed, remove it
                removeSoloedTrackId(trackId);
                track.isSoloed = false;
            } else {
                // Track is not soloed, add it
                addSoloedTrackId(trackId);
                track.isSoloed = true;
            }
            
            // Apply solo state to all tracks
            const allTracks = getTracks();
            allTracks.forEach(t => {
                if (t) {
                    t.isSoloed = isTrackSoloedInChain(t.id);
                    t.applySoloState();
                    if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                }
            });
            
            const soloCount = getSoloedTrackIds().length;
            if (localAppServices.showNotification) {
                if (soloCount > 0) {
                    localAppServices.showNotification(`Solo Chain: ${soloCount} track(s) soloed`, 1500);
                } else {
                    localAppServices.showNotification('Solo Chain: All tracks unsoloed', 1500);
                }
            }
        } else {
            // Exclusive solo mode: only one track at a time
            setSoloedTrackId(currentSoloed === trackId ? null : trackId);
            
            const tracks = getTracks();
            if (tracks && Array.isArray(tracks)) {
                tracks.forEach(t => {
                    if (t) {
                        t.isSoloed = (t.id === getSoloedTrackId());
                        t.applySoloState();
                        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
            
            if (localAppServices.showNotification) {
                const soloed = getSoloedTrackId();
                if (soloed !== null) {
                    const soloedTrack = getTrackById(soloed);
                    localAppServices.showNotification(`Solo: ${soloedTrack?.name || 'Track'}`, 1500);
                }
            }
        }
    } catch (error) { console.error(`[EventHandlers handleTrackSolo] Error for track ${trackId}:`, error); }
}

export function handleTrackSoloExclusive(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Exclusive Solo: Track ${trackId} not found.`); return; }
        const currentSoloed = getSoloedTrackId();
        const isCurrentlyExclusiveSoloed = currentSoloed === trackId && !track.isSoloed;
        
        captureStateForUndo(`Exclusive Solo for ${track.name}`);
        
        if (isCurrentlyExclusiveSoloed || currentSoloed !== trackId) {
            setSoloedTrackId(trackId);
            const tracks = getTracks();
            if (tracks && Array.isArray(tracks)) {
                tracks.forEach(t => {
                    if (t) {
                        t.isSoloed = (t.id === trackId);
                        t.applySoloState();
                        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
            if (localAppServices.showNotification) localAppServices.showNotification(`Exclusive Solo: ${track.name}`, 1500);
        } else {
            setSoloedTrackId(null);
            const tracks = getTracks();
            if (tracks && Array.isArray(tracks)) {
                tracks.forEach(t => {
                    if (t) {
                        t.isSoloed = false;
                        t.applySoloState();
                        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
            if (localAppServices.showNotification) localAppServices.showNotification('All tracks unsoloed.', 1500);
        }
    } catch (error) { console.error(`[EventHandlers handleTrackSoloExclusive] Error for track ${trackId}:`, error); }
}

export function handleTrackArm(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Arm: Track ${trackId} not found.`); return; }
        const currentArmedId = getArmedTrackId();
        const isCurrentlyArmed = currentArmedId === track.id;
        captureStateForUndo(`${isCurrentlyArmed ? "Disarm" : "Arm"} Track "${track.name}" for Input`);
        setArmedTrackId(isCurrentlyArmed ? null : track.id);

        const newArmedTrack = getTrackById(getArmedTrackId()); 
        const notificationMessage = newArmedTrack ? `${newArmedTrack.name} armed for input.` : "All tracks disarmed.";
        if (localAppServices.showNotification) {
            localAppServices.showNotification(notificationMessage, 1500);
        }
        if (localAppServices.updateTrackUI) {
            localAppServices.updateTrackUI(trackId, 'armChanged');
        }
    } catch (error) { console.error(`[EventHandlers handleTrackArm] Error for track ${trackId}:`, error); }
}

export function handleRemoveTrack(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Remove: Track ${trackId} not found.`); return; }
        if (typeof showConfirmationDialog !== 'function') {
            console.error("[EventHandlers] showConfirmationDialog function not available.");
            if (confirm(`Are you sure you want to remove track "${track.name}"? This can be undone.`)) {
                if (localAppServices.removeTrack) localAppServices.removeTrack(trackId);
                else coreRemoveTrackFromState(trackId); 
            }
            return;
        }
        showConfirmationDialog(
            'Confirm Delete Track',
            `Are you sure you want to remove track "${track.name}"? This can be undone.`,
            () => {
                if (localAppServices.removeTrack) {
                    localAppServices.removeTrack(trackId);
                } else {
                    console.warn("[EventHandlers] removeTrack service not available, calling coreRemoveTrackFromState.");
                    coreRemoveTrackFromState(trackId);
                }
            }
        );
    } catch (error) { console.error(`[EventHandlers handleRemoveTrack] Error for track ${trackId}:`, error); }
}

export function handleBounceTrack(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) {
            console.warn(`[EventHandlers] Bounce: Track ${trackId} not found.`);
            return;
        }
        
        // Check if track has content to bounce
        if (track.type === 'Audio' && (!track.timelineClips || track.timelineClips.length === 0)) {
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Track "${track.name}" has no audio clips to bounce.`, 3000);
            }
            return;
        }
        
        if (track.type !== 'Audio') {
            const activeSeq = track.getActiveSequence();
            if (!activeSeq || activeSeq.length === 0) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Track "${track.name}" has no notes to bounce.`, 3000);
                }
                return;
            }
        }
        
        // Open bounce dialog
        if (localAppServices.showBounceTrackDialog) {
            localAppServices.showBounceTrackDialog(trackId);
        } else {
            console.error("[EventHandlers] showBounceTrackDialog service not available.");
        }
    } catch (error) {
        console.error(`[EventHandlers handleBounceTrack] Error for track ${trackId}:`, error);
    }
}

export function handleDuplicateTrack(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) { console.warn(`[EventHandlers] Duplicate: Track ${trackId} not found.`); return; }
        if (localAppServices.duplicateTrack) {
            localAppServices.duplicateTrack(trackId);
        } else {
            console.warn("[EventHandlers] duplicateTrack service not available.");
        }
    } catch (error) { console.error(`[EventHandlers handleDuplicateTrack] Error for track ${trackId}:`, error); }
}

export function handleTrackFreeze(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) {
            console.warn(`[EventHandlers] Freeze: Track ${trackId} not found.`);
            return;
        }
        
        if (track.frozen) {
            // Unfreeze the track
            if (typeof track.unfreeze === 'function') {
                track.unfreeze();
            } else {
                console.warn("[EventHandlers] unfreeze method not available on track.");
            }
        } else {
            // Freeze the track
            if (typeof track.freeze === 'function') {
                track.freeze();
            } else {
                console.warn("[EventHandlers] freeze method not available on track.");
            }
        }
    } catch (error) { console.error(`[EventHandlers handleTrackFreeze] Error for track ${trackId}:`, error); }
}

export function handleTrackArchive(trackId) {
    try {
        const track = getTrackById(trackId);
        if (!track) {
            console.warn(`[EventHandlers] Archive: Track ${trackId} not found.`);
            return;
        }
        
        captureStateForUndo(`Toggle Archive for ${track.name}`);
        track.isArchived = !track.isArchived;
        
        if (track.isArchived) {
            // Stop playback and mute the track when archiving
            if (typeof track.stopPlayback === 'function') {
                track.stopPlayback();
            }
            if (!track.isMuted) {
                track.isMuted = true;
                track.applyMuteState();
            }
            console.log(`[EventHandlers] Archived track ${track.name}`);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Archived track: ${track.name}`, 2000);
            }
        } else {
            console.log(`[EventHandlers] Unarchived track ${track.name}`);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Unarchived track: ${track.name}`, 2000);
            }
        }
        
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(trackId, 'archiveChanged');
        if (localAppServices.updateMixerWindow) localAppServices.updateMixerWindow();
        if (localAppServices.renderTimeline) localAppServices.renderTimeline();
    } catch (error) { console.error(`[EventHandlers handleTrackArchive] Error for track ${trackId}:`, error); }
}

export function handleOpenTrackInspector(trackId) {
    if (localAppServices.openTrackInspectorWindow) {
        localAppServices.openTrackInspectorWindow(trackId);
    } else { console.error("[EventHandlers] openTrackInspectorWindow service not available."); }
}
export function handleOpenEffectsRack(trackId) {
    if (localAppServices.openTrackEffectsRackWindow) {
        localAppServices.openTrackEffectsRackWindow(trackId);
    } else { console.error("[EventHandlers] openTrackEffectsRackWindow service not available."); }
}
export function handleOpenSequencer(trackId) {
    if (localAppServices.openTrackSequencerWindow) {
        localAppServices.openTrackSequencerWindow(trackId);
    } else { console.error("[EventHandlers] openTrackSequencerWindow service not available."); }
}

function toggleFullScreen() {
    try {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                const message = `Error attempting to enable full-screen mode: ${err.message} (${err.name})`;
                if (localAppServices.showNotification) localAppServices.showNotification(message, 3000);
                else showNotification(message, 3000);
                console.error(message, err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    } catch (error) {
        console.error("[EventHandlers toggleFullScreen] Error:", error);
        if (localAppServices.showNotification) localAppServices.showNotification("Fullscreen toggle error.", 3000);
    }
}

export async function handleTimelineLaneDrop(event, targetTrackId, startTime, appServicesPassed) {
    const services = appServicesPassed || localAppServices;

    if (!services || !services.getTrackById || !services.showNotification || !services.captureStateForUndo || !services.renderTimeline) {
        console.error("Required appServices not available in handleTimelineLaneDrop");
        utilShowNotification("Internal error handling timeline drop.", 3000); 
        return;
    }

    const targetTrack = services.getTrackById(targetTrackId);
    if (!targetTrack) {
        services.showNotification("Target track not found for drop.", 3000);
        return;
    }

    const jsonDataString = event.dataTransfer.getData('application/json');
    const files = event.dataTransfer.files;

    try {
        if (jsonDataString) {
            const droppedData = JSON.parse(jsonDataString);
            if (droppedData.type === 'sequence-timeline-drag') {
                if (targetTrack.type === 'Audio') {
                    services.showNotification("Cannot place sequence clips on Audio tracks.", 3000);
                    return;
                }
                if (typeof targetTrack.addSequenceClipToTimeline === 'function') {
                    targetTrack.addSequenceClipToTimeline(droppedData.sourceSequenceId, startTime, droppedData.clipName);
                } else {
                    services.showNotification("Error: Track cannot accept sequence clips.", 3000);
                }
            } else if (droppedData.type === 'sound-browser-item') {
                if (targetTrack.type !== 'Audio') {
                    services.showNotification("Sound browser audio files can only be dropped onto Audio Track timeline lanes.", 3000);
                    return;
                }
                if (services.getAudioBlobFromSoundBrowserItem && typeof targetTrack.addExternalAudioFileAsClip === 'function') {
                    const audioBlob = await services.getAudioBlobFromSoundBrowserItem(droppedData);
                    if (audioBlob) {
                        targetTrack.addExternalAudioFileAsClip(audioBlob, startTime, droppedData.fileName);
                    } else {
                        services.showNotification(`Could not load audio for "${droppedData.fileName}".`, 3000);
                    }
                } else {
                     services.showNotification("Error: Cannot process sound browser item for timeline.", 3000);
                }
            } else {
                services.showNotification("Unrecognized item dropped on timeline.", 2000);
            }
        } else if (files && files.length > 0) {
            const file = files[0];
            if (targetTrack.type !== 'Audio') {
                services.showNotification("Audio files can only be dropped onto Audio Track timeline lanes.", 3000);
                return;
            }
            if (file.type.startsWith('audio/')) {
                if (typeof targetTrack.addExternalAudioFileAsClip === 'function') {
                    targetTrack.addExternalAudioFileAsClip(file, startTime, file.name);
                } else {
                    services.showNotification("Error: Track cannot accept audio file clips.", 3000);
                }
            } else {
                services.showNotification("Invalid file type. Please drop an audio file.", 3000);
            }
        } else {
            console.log("[EventHandlers handleTimelineLaneDrop] No recognized data in drop event for timeline.");
        }
    } catch (e) {
        console.error("[EventHandlers handleTimelineLaneDrop] Error processing dropped data:", e);
        services.showNotification("Error processing dropped item.", 3000);
    }
}

// --- MIDI File Import/Export Functions ---

export function handleMIDIDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
        console.log('[MIDI Drop] No files in drop event');
        return;
    }

    const file = files[0];
    const fileName = file.name.toLowerCase();

    // Check if it's a MIDI file
    if (!fileName.endsWith('.mid') && !fileName.endsWith('.midi') && file.type !== 'audio/midi' && file.type !== 'audio/x-midi') {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Please drop a .mid MIDI file.', 3000);
        }
        return;
    }

    console.log('[MIDI Drop] Processing MIDI file:', file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const arrayBuffer = e.target.result;
            const midiData = parseMidiFile(arrayBuffer);

            if (!midiData || !midiData.notes || midiData.notes.length === 0) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('No notes found in MIDI file.', 3000);
                }
                return;
            }

            // Get first non-audio track or create one
            let targetTrack = null;
            const tracks = getTracks();
            for (const t of tracks) {
                if (t.type !== 'Audio') {
                    targetTrack = t;
                    break;
                }
            }

            // If no track found, create a synth track
            if (!targetTrack && localAppServices.addTrack) {
                targetTrack = await localAppServices.addTrack('Synth', { _isUserActionPlaceholder: true });
            }

            if (!targetTrack) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('No suitable track found for MIDI import.', 3000);
                }
                return;
            }

            // Capture state for undo
            captureStateForUndo(`Import MIDI to ${targetTrack.name}`);

            // Get the active sequence
            const activeSeq = targetTrack.getActiveSequence();
            if (!activeSeq || !activeSeq.data) {
                if (localAppServices.showNotification) {
                    localAppServices.showNotification('Track has no sequence to export to.', 3000);
                }
                return;
            }

            // Convert MIDI notes to sequence data
            const targetSteps = activeSeq.length || Constants.defaultStepsPerBar;
            const sequenceData = midiNotesToSequenceData(midiData, targetSteps);

            // Apply to the track's sequence
            if (sequenceData && sequenceData.length > 0) {
                // Merge with existing sequence data
                const existingData = activeSeq.data || [];
                for (let row = 0; row < Math.min(sequenceData.length, existingData.length); row++) {
                    for (let step = 0; step < targetSteps; step++) {
                        if (sequenceData[row][step] && sequenceData[row][step].active) {
                            existingData[row][step] = sequenceData[row][step];
                        }
                    }
                }
                activeSeq.data = existingData;

                // Recreate the Tone.Sequence
                if (typeof targetTrack.recreateToneSequence === 'function') {
                    targetTrack.recreateToneSequence(true);
                }

                // Update UI
                if (localAppServices.updateTrackUI) {
                    localAppServices.updateTrackUI(targetTrack.id, 'sequencerContentChanged');
                }

                if (localAppServices.showNotification) {
                    localAppServices.showNotification(`Imported ${midiData.notes.length} notes to ${targetTrack.name}.`, 3000);
                }
            }
        } catch (error) {
            console.error('[MIDI Drop] Error parsing MIDI file:', error);
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Error parsing MIDI file: ' + error.message, 4000);
            }
        }
    };

    reader.onerror = (e) => {
        console.error('[MIDI Drop] FileReader error:', e);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Error reading MIDI file.', 3000);
        }
    };

    reader.readAsArrayBuffer(file);
}

export function handleMIDIDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
}

export function exportTrackToMIDI(trackId) {
    const track = getTrackById(trackId);
    if (!track) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Track not found.', 2000);
        }
        return null;
    }

    if (track.type === 'Audio') {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Audio tracks cannot be exported to MIDI.', 3000);
        }
        return null;
    }

    const activeSeq = track.getActiveSequence();
    if (!activeSeq || !activeSeq.data) {
        if (localAppServices.showNotification) {
            localAppServices.showNotification('No sequence data to export.', 3000);
        }
        return null;
    }

    try {
        const tempoBPM = Tone.Transport.bpm.value || 120;
        const midiBytes = encodeSequenceToMidi(activeSeq.data, activeSeq.length, {
            tempoBPM: tempoBPM,
            trackName: track.name,
            channel: 0
        });

        // Create blob and download
        const blob = new Blob([midiBytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.name.replace(/[^a-zA-Z0-9]/g, '_')}.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Exported ${track.name} to MIDI.`, 3000);
        }

        console.log('[MIDI Export] Exported track', track.name, 'with', activeSeq.length, 'steps');
        return true;
    } catch (error) {
        console.error('[MIDI Export] Error exporting track:', error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Error exporting to MIDI: ' + error.message, 4000);
        }
        return false;
    }
}

// Initialize MIDI drop zone on desktop
export function initializeMIDIDropZone(desktopElement) {
    if (!desktopElement) {
        console.warn('[MIDI DropZone] Desktop element not provided');
        return;
    }

    // Add MIDI drop listeners
    desktopElement.addEventListener('dragover', handleMIDIDragOver);
    desktopElement.addEventListener('drop', handleMIDIDrop);

    console.log('[MIDI DropZone] MIDI drop zone initialized on desktop');
}
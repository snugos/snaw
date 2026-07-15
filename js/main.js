// js/main.js - Main Application Logic Orchestrator

// --- Module Imports ---
import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
import { initTrackSwap, swapTwoTracks, clearTrackSwapSelection } from './TrackSwap.js';
import { AICompositionAssistant, openAICompositionPanel } from './AICompositionAssistant.js';
import { DrumPatternGenerator, initDrumPatternGenerator, getDrumGenerator, generateDrumPattern, DRUM_STYLES, COMPLEXITY_LEVELS as DRUM_COMPLEXITY_LEVELS } from './DrumPatternGenerator.js';
import { MelodyGenerator, initMelodyGenerator, getMelodyGenerator, generateMelody, MELODY_STYLES, MELODY_MOODS } from './MelodyGenerator.js';
import { initQuickActionsMenu, openQuickActionsMenu, closeQuickActionsMenu } from './QuickActionsMenu.js';
import { initTimelineMarkers, openTimelineMarkersPanel, addTimelineMarker as addRenderedTimelineMarker, removeTimelineMarker as removeRenderedTimelineMarker, getTimelineMarkers as getRenderedTimelineMarkers } from './TimelineMarkers.js';
import { initQuickMarkerSet, openQuickMarkerPopover } from './QuickMarkerSet.js';
import { initRecentProjectFileHistory, recordRecentProjectFile } from './RecentProjectFileHistory.js';
import { initMarkerAnnotations } from './MarkerAnnotations.js';
import { initPlayheadMarkerDrop, openPlayheadMarkerDropSettings } from './PlayheadMarkerDrop.js';
import { initTimelineRulerClick, openTimelineRulerClickSettings } from './TimelineRulerClick.js';
import { initTempoJumpMarkers } from './TempoJumpMarkers.js';
import { initMarkerColorPresets } from './MarkerColorPresets.js';
import { initMuteSelectedTracks } from './MuteSelectedTracks.js';
import { initMuteOthersSolo } from './MuteOthersSolo.js';
import { AIMasteringEnhancement, initAIMasteringEnhancement, openAIMasteringEnhancementPanel } from './AIMasteringEnhancement.js';
import { AudioStemExportEnhancement, initAudioStemExportEnhancement, openAudioStemExportEnhancementPanel } from './AudioStemExportEnhancement.js';
import { MIDIPatternVariationEnhancement, initMIDIPatternVariationEnhancement, openMIDIPatternVariationEnhancementPanel } from './MIDIPatternVariationEnhancement.js';
import { PluginPresetBrowser, initPluginPresetBrowser, openPluginPresetBrowserPanel } from './PluginPresetBrowser.js';
import { initVideoExportEnhancement, openVideoExportPanel } from './VideoExportEnhancement.js';
import { initCloudSyncEnhancement, openCloudSyncPanel } from './CloudSyncEnhancement.js';
import { initNotationExportEnhancement, openNotationExportPanel } from './NotationExportEnhancement.js';
import { initAudioRestorationSuite, openAudioRestorationPanel } from './AudioRestorationSuite.js';
import { openPitchDriftCorrectionPanel } from './PitchDriftCorrection.js';
import { initMIDIGuitarSupport, openMIDIGuitarPanel } from './MIDIGuitarSupport.js';
import { initSpatialAudioPanning, openSpatialAudioPanel } from './SpatialAudioPanning.js';
import { CollaborationSessionRecording, collaborationSessionRecording, initCollaborationSessionRecording, openCollaborationSessionPanel } from './CollaborationSessionRecording.js';
import { AIMixingSuggestions, aiMixingSuggestions, initAIMixingSuggestions } from './AIMixingSuggestions.js';
import { AITempoSuggestion, initAITempoSuggestion, openAITempoSuggestionPanel } from './AITempoSuggestion.js';
import { FrequencySpectrumMatching, frequencySpectrumMatching, initFrequencySpectrumMatching, openFrequencySpectrumMatchingPanel } from './FrequencySpectrumMatching.js';
import { SmartTrackGrouping, smartTrackGrouping, initSmartTrackGrouping, openSmartTrackGroupingPanel } from './SmartTrackGrouping.js';
import { AudioEventDetection, audioEventDetection, initAudioEventDetection, openAudioEventDetectionPanel } from './AudioEventDetection.js';
import { CrossTrackPitchAnalysis, crossTrackPitchAnalysis, initCrossTrackPitchAnalysis, openCrossTrackPitchAnalysisPanel } from './CrossTrackPitchAnalysis.js';
// New Feature Modules - Session 2026-04-24
import { initAudioLegatoDetection, detectLegatoGroups, openLegatoDetectionPanel } from './AudioLegatoDetection.js';
import { AICompositionVariations } from './AICompositionVariations.js';
import { HarmonicAnalysisEngine } from './HarmonicAnalysisEngine.js';
import { AudioStemSeparation } from './AudioStemSeparation.js';
import { MIDIToAudioConversion } from './MIDIToAudioConversion.js';
import { SmartFXChain } from './SmartFXChain.js';
import { MidiMonitor } from './MidiMonitor.js';
import { initMIDILearnWizard, openMIDILearnWizard } from './MIDILearnWizard.js';
import { initBulkAssign, startBulkAssign, stopBulkAssign, isBulkAssignActive } from './MIDILearnBulkAssign.js';
import { initMIDILearnPresets, openMIDILearnPresetsPanel } from './MIDILearnPresets.js';
import { AudioFingerprinting } from './AudioFingerprinting.js';
import { initAudioTapTempo } from './AudioTapTempo.js';
import { initAudioNormalizer, openAudioNormalizerPanel } from './AudioNormalizer.js';
import { initAudioFadePreset, openAudioFadePresetPanel } from './AudioFadePreset.js';
import { initAudioBufferQualityPresets, openBufferQualityPanel, getCurrentPreset, cycleToNextPreset, createQuickToggleButton } from './AudioBufferQualityPresets.js';
import { initClipFadeHandles, openClipFadeHandlesPanel } from './ClipFadeHandles.js';
import { openAudioStretchQualityPanel, openStretchQualityPanel, closeAudioStretchQualityPanel, getAudioStretchingQuality } from './AudioStretchQualityPanel.js';
import { initAudioStretching, openStretchPanel, quickStretchSelectedClip, applyStretchToClip, removeStretchFromClip, getStretchParamsForClip } from './AudioStretching.js';
import { initAutoScrollSync, toggleAutoScroll, autoScrollTimeline } from './AutoScrollSync.js';
import { initProjectRecoveryManager, createManualBackup, listBackups, restoreBackup, setRecoveryEnabled, getRecoveryStatus } from './ProjectRecoveryManager.js';
// Pattern Generation & Frequency Processing
import { AIPatternGenerator, getAIPatternGenerator, openAIPatternGeneratorPanel } from './AIPatternGenerator.js';
import { FrequencyBandSplitter, MultibandProcessor, getFrequencyBandSplitter, openFrequencyBandSplitterPanel } from './FrequencyBandSplitter.js';
// Performance & Workflow - Session 2026-04-26
import { openPerformanceTriggerPadsPanel, getPerformanceTriggerPads } from './PerformanceTriggerPads.js';
import { initTrackHeadphoneMix, openTrackHeadphoneMixPanel } from './TrackHeadphoneMix.js';
import { initTrackSendRouting, openTrackSendRoutingPanel } from './TrackSendRouting.js';
import { initTrackMuteAutomation, openTrackMuteAutomationPanel } from './TrackMuteAutomation.js';
import { openTrackDelayCompensationPanel, openLatencyCompensationPanel } from './TrackDelayCompensation.js';
import { initTrackReorderHotkeys, moveActiveTrackBy, isTrackReorderHotkeysInitialized } from './TrackReorderHotkeys.js'; // Track Reorder Hotkeys - Alt+ArrowUp/Down to move active track (v0.3.70)
import { initTrackRenumberHotkey } from './TrackRenumberHotkey.js';
import { openGrooveExtractorPanel } from './GrooveExtractor.js';
import { openStepSequencerView, initStepSequencerView } from './StepSequencerView.js';
import { initStepSequencerPatternLibrary, openStepSequencerPatternLibraryPanel, isStepSequencerPatternLibraryOpen, getDrumPatternList, getMelodicPatternList } from './StepSequencerPatternLibrary.js';
import { openPianoRollEditor, initPianoRollEditor, snapSelectedNotesToScale, updatePianoRollPanel } from './PianoRollEditor.js';
import { initPianoRollPitchBend, openPitchBendEditor, getPianoRollPitchBendWindow } from './PianoRollPitchBend.js';
import { initMidiVelocityEditor, openMidiVelocityEditorPanel, setSelectedNotesVelocity, applyVelocityRamp, applyVelocityRandom } from './MidiVelocityEditor.js';
import { initCCStepSequencer, openCCStepSequencer, getCCPatternData, setCCPatternData } from './CCStepSequencer.js';
import { initScaleHighlightMode, openScaleHighlightPanel, isNoteInScale, getNoteScaleClass, quantizeNoteToScale } from './ScaleHighlightMode.js';
import { initScaleHighlightGlobal, openScaleHighlightGlobalPanel, toggleGlobalScaleHighlight, setGlobalScale, setGlobalRootNote, isGlobalScaleHighlightEnabled } from './ScaleHighlightGlobal.js';
import { initAudioRecorder, startRecording, stopRecording, isRecordingActive, requestMicAccess, getRecordingStatus, cleanupRecording, openAudioRecordingPanel } from './AudioRecorder.js';
import { initBounceSelectedToAudio, bounceSelectedClipsToAudio, openBounceDialog } from './BounceSelectedToAudio.js';
import { initQuickBounce, quickBounce } from './QuickBounce.js'; // Quick Bounce (v0.3.78)
import { initKeyboardOctaveShift, getCurrentOctaveShift, setOctaveShift, resetOctaveShift } from './KeyboardOctaveShift.js';
import { initTimelineZoomMemory, getStoredZoom, saveZoom } from './TimelineZoomMemory.js';
import { initCountInAudio, setupCountInUI, playCountIn, isCountInActive } from './CountInAudio.js';
import { initCountInSettingsPanel, openCountInSettingsPanel, getCountInSettings, setCountInBars, setCountInSoundEnabled, setCountInVisualCountdown, setCountInAccentFirstBeat, setCountInVolume } from './CountInSettingsPanel.js';
import { initClipTimeHandles, refreshClipTimeHandles, formatTimecode } from './ClipTimeHandles.js'; // Clip Time Handles (v0.4.08) - mm:ss timecode overlay on each clip
import { initClipDragClone, getClipDragCloneVersion } from './ClipDragClone.js'; // Clip Drag Clone (v0.4.09) - Alt+drag to clone-paint clips on the timeline
import { initTrackNotesSidebar, openTrackNotesSidebar, getTrackNotesSidebarText, setTrackNotesSidebarText, removeTrackNotesSidebar } from './TrackNotesSidebar.js'; // Track Notes Sidebar (v0.4.10) - per-track 📝 button + inline textarea popover
import { initUndoToast, fireUndoToast, fireRedoToast, getUndoToastVersion } from './UndoToast.js'; // Undo Toast (v0.4.11) - styled ↶/↷ toast on undo/redo with action name
import { initMIDArpeggiatorPanel, openMIDArpeggiatorPanel } from './MIDArpeggiatorPanel.js';
import { initTrackTemplateLibrary, openTrackTemplateLibraryPanel, getTrackTemplateNames, getTrackTemplate, saveTrackTemplate, deleteTrackTemplate, exportTemplates, importTemplates } from './TrackTemplateLibrary.js';
import { initMixerChannelStripPresets, openMixerChannelStripPresetsPanel, exportChannelStripPresets, importChannelStripPresets } from './MixerChannelStripPresets.js';
import { initTrackEffectPresets, openTrackEffectPresetsPanel } from './TrackEffectPresets.js';
import { initTrackVelocityCurve, openTrackVelocityCurvePanel } from './TrackVelocityCurve.js';
import { showClipEnvelopeShaper } from './ClipEnvelopeShaper.js';
import { initEnvelopeIntegration } from './EnvelopeIntegration.js';
import { enableSoloChain, disableSoloChain, toggleTrackInChain, clearChain, getSoloedTrackIds, getIsActive } from './TrackSoloChain.js';
import { initLoopRegionQuickSet, openLoopRegionQuickSetSettings } from './LoopRegionQuickSet.js';
import { initLoopRegionMarkers, openLoopRegionMarkersPanel, addLoopRegionMarker } from './LoopRegionMarkers.js';
import { initLoopRegionSnap, openLoopSnapPanel, isLoopSnapEnabled, toggleLoopSnap, getSnapConfig } from './LoopRegionSnap.js';
import { initLoopRegionPresets, openLoopRegionPresetsPanel } from './LoopRegionPresets.js';
import { initLoopUntilMarker, openLoopUntilMarkerPanel, extendLoopToNextMarker, extendLoopToPreviousMarker, extendLoopToBothMarkers, setLoopUntilMarkerAutoEnabled, isLoopUntilMarkerAutoEnabled } from './LoopUntilMarker.js';
import { initLoopLengthDisplay, refreshLoopLengthDisplay } from './LoopLengthDisplay.js';
import { initAutoSaveIndicator, showSaveStatus, getSaveStatus } from './AutoSaveIndicator.js';
import { initAutoSaveCounter, getAutoSaveCounterStatus } from './AutoSaveCounter.js'; // v0.3.92
import { initProjectSessionTimer, refreshProjectSessionTimer, resetProjectSessionTimer, getProjectSessionTimerStatus } from './ProjectSessionTimer.js'; // v0.4.12 Project Session Timer (MM:SS, click to reset)
import { initTransportBarMasterMeter, updateTransportBarMasterMeter, isTransportBarMasterMeterActive, openTransportBarMasterMeterPopover, closeTransportBarMasterMeterPopover, setTransportBarMasterMeterVisible, getTransportBarMasterMeterStatus } from './TransportBarMasterMeter.js'; // v0.4.15 Transport Bar Master Output Meter (L/R horizontal peak meter in the transport bar)
import { initProjectSnapshotList, openProjectSnapshotListPanel, closeProjectSnapshotListPanel, toggleProjectSnapshotListPanel } from './ProjectSnapshotList.js'; // v0.4.15 Quick Project Snapshot List (last 5 snapshots with auto + manual capture)
import { initMIDIActivityLog, refreshMIDIActivityLog, setMIDIActivityLogVisible, toggleMIDIActivityLog } from './MIDIActivityLog.js';
import { initExportSelection, openExportSelectionPanel } from './ExportSelection.js';
import { initLyricsTrack, openLyricsTrackPanel, getLyrics, addLyric, importLyricsText, setLyricsTrackEnabled, getCurrentLyric } from './LyricsTrack.js';
import { openTempoRamperPanel } from './TempoRamperUI.js';
import { initTempoRamperVisual, openTempoRamperVisual } from './TempoRamperVisual.js';
import { initClipContextMenu } from './ClipContextMenu.js';
import { initClickTrackVolumeSlider } from './ClickTrackVolumeSlider.js'; // Click Track Volume Slider (v0.3.77)
import { initClipboardHistoryManager } from './ClipboardHistoryManager.js';
import { initClipSelectionManager } from './ClipSelectionManager.js';
// v0.4.01 Clip Volume Curve Presets - per-clip gain-envelope shape presets
import { initClipVolumeCurvePresets, openClipVolumeCurvePresetsPanel, applyVolumeCurvePresetToSelectedClip, getVolumeCurvePresetsList, registerVolumeCurvePresetMenuItem } from './ClipVolumeCurvePresets.js';
import { initClipFadePresets, openClipFadePresetsPanel, closeClipFadePresetsPanel, addFadePreset, getFadePresets, getClipFadeMenuItems, getClipFadeMenuItemsSimple, applyFadePresetToClip } from './ClipFadePresets.js';
import { initClipGroupManager } from './ClipGroupManager.js';
import { initTrackContextMenu } from './TrackContextMenu.js';
// Timeline Clip Operations
import { initTimelineClipOperations } from './TimelineClipOperations.js';
// Track Duplicate with Offset
import { initTrackDuplicateOffset, openDuplicateOffsetDialog, duplicateTrackWithOffset } from './TrackDuplicateOffset.js';
// Crossfade Loop Points
import { initCrossfadeLoopPoints, openCrossfadeLoopPointsPanel } from './CrossfadeLoopPoints.js';
// Tuner - live microphone pitch detection
import { initTuner, openTunerPanel } from './Tuner.js';
// Loop Practice Trainer - track loop iteration time-to-nail stats
import { initLoopPracticeTrainer, openLoopPracticeTrainerPanel, checkLoopPracticeTrainer, initLoopPracticeTrainerStateReferences, resetLoopPracticeTrainer, getLoopPracticeTrainerStats } from './LoopPracticeTrainer.js';
// Track Notes - per-track text notes (lyrics, mix notes, performance cues)
import { initTrackNotes, openNotesPanel as openTrackNotesPanel, openNoteForCurrentTrack, openNoteForTrack, refreshIndicators as refreshTrackNoteIndicators } from './TrackNotes.js';
// One-Shot Preview Pad - audition tracks without entering playback
import { initOneShotPreviewPad, initOneShotPreviewPadStateReferences, openOneShotPreviewPadPanel, previewTrackOneShot, stopTrackOneShotPreview, stopAllOneShotPreviews, isTrackPreviewing } from './OneShotPreviewPad.js';
// Bounce To Track - render track or selected clips to a new audio track
import { initBounceToTrack, openBounceToTrackPanel, bounceSelectedToTrack, isBounceToTrackActive, getLastBounceResult } from './BounceToTrack.js';
// Quick-Bounce Markers - mark two timeline points and render only the audio between them to a new audio track
import { initQuickBounceMarkers, openQuickBounceMarkersPanel, bounceTrackBetweenMarkers, getLastQuickBounce } from './QuickBounceMarkers.js';
// Waveform Visualizer - draw waveform thumbnails + zoomable waveform for selected audio clip
import { initWaveformVisualizer, openWaveformVisualizerPanel, isWaveformVisualizerActive } from './WaveformVisualizer.js';
// Drum Kit Piece Selector - quickly load curated synthesized drum kit pieces into pads of a Sampler (Pads) track
import { initDrumKitPieceSelector, openDrumKitPieceSelectorPanel, isDrumKitPieceSelectorActive, getDrumKitPieceList } from './DrumKitPieceSelector.js';
// Loudness Meter - EBU R128 LUFS + true-peak dBTP readout panel
import { initLoudnessMeter, openLoudnessMeterPanel, isLoudnessMeterActive, updateLoudnessMeter, resetLoudnessMeterIntegrated } from './LoudnessMeter.js';
import { initSendsOverviewPanel, openSendsOverviewPanel, isSendsOverviewPanelActive, getSendsOverviewVersion } from './SendsOverviewPanel.js';
// Project Search - global substring search across track names, clip names, and track notes
import { initProjectSearch, openProjectSearchPanel, isProjectSearchPanelOpen, searchProject } from './ProjectSearch.js';
// Master Limiter - brick-wall master limiter toggle (Tone.Limiter at the end of the master chain)
import { initMasterLimiter, openMasterLimiterPanel, isMasterLimiterEnabled } from './MasterLimiter.js';
// Toolbar Tooltips - custom hover tooltips for transport / status / taskbar / start-menu buttons
import { initToolbarTooltips, isToolbarTooltipsEnabled, setToolbarTooltipsEnabled, toggleToolbarTooltips, getToolbarTooltipsVersion, refreshToolbarTooltipTargets } from './ToolbarTooltips.js';
import { initMasterEffectsRack, openMasterEffectsRackWindow, renderMasterEffectsRackPanel } from './MasterEffectsRack.js';
// Mix-Bus Group Presets - save & re-apply whole-mix state across a set of tracks (volume, pan, mute/solo, color, effects, sends, detune)
import { initMixBusGroupPresets, openMixBusGroupPresetsPanel, listMixBusGroupPresets, getMixBusGroupPreset, captureMixBusGroupPreset, applyMixBusGroupPreset, deleteMixBusGroupPreset } from './MixBusGroupPresets.js';
// Performance Mode Recall - save & recall panel-layout snapshots (which panels are open/minimized) as named presets
import { initPerformanceModeRecall, openPerformanceModeRecallPanel, isPerformanceModeRecallPanelOpen, getPerformanceModeRecallVersion, registerWindowOpener as registerPerformanceModeWindowOpener, unregisterWindowOpener as unregisterPerformanceModeWindowOpener } from './PerformanceModeRecall.js';
// Guitar Tab Editor
import { initGuitarTabEditor, openGuitarTabEditor } from './GuitarTabEditor.js';
import { initTrackColorPanel, openTrackColorPanel } from './TrackColorPanel.js';
import { initAudioClipLabeling, openAudioClipLabelingPanel, isAudioClipLabelingActive, applyAudioClipLabelFromExternal, getAllAudioClipLabels } from './AudioClipLabeling.js';
import { initMidiFilePanel, openMidiFilePanel } from './MidiFilePanel.js';
import { initTrackRolePanel, openTrackRolePanel, getTracksByRole, getRoleSummary } from './TrackRolePanel.js';
import { initTrackSnapResolutionPanel, openTrackSnapResolutionPanel } from './TrackSnapResolutionPanel.js';
import { initTrackIconPicker, openTrackIconPickerPanel } from './TrackIconPicker.js';
import { initChordVoicingModes, openChordVoicingPanel } from './ChordVoicingModes.js';
import { initChordTriggerMode, toggleChordTriggerMode, openChordTriggerPanel, isChordTriggerEnabled, handleChordTriggerKeyDown, handleChordTriggerKeyUp, getChordKeyMappings, setChordKeyMapping } from './ChordTriggerMode.js';
import { initTrackFreezeQuickToggle } from './TrackFreezeQuickToggle.js';
import { initTrackFreezeCrossfade, onTrackHeaderRendered as tfCrossfadeHeaderRendered } from './TrackFreezeCrossfade.js';
import { initTrackLaneResize } from './TrackLaneResize.js';
import { initPerformanceMonitor, initPerformanceIndicator, openPerformancePanel, closePerformancePanel, getPerformanceSnapshot } from './PerformanceMonitor.js';
import { initUndoHistoryPanel, openUndoHistoryPanel } from './UndoHistoryPanel.js';
import { initArmToggleHistory } from './ArmToggleHistory.js';
import { initDuplicateTrackHotkey } from './DuplicateTrackHotkey.js';
import { initPerTrackMidiChannelDisplay } from './PerTrackMidiChannelDisplay.js';
import { initPerTrackGrooveTemplateSelector } from './PerTrackGrooveTemplateSelector.js';
import { initPerTrackMidiPanic } from './PerTrackMidiPanic.js'; // v0.4.00
import { initPerTrackMidiCCPresets, openPerTrackMidiCCPresetsPanel } from './PerTrackMidiCCPresets.js'; // v0.4.02
// Track Grouping by Instrument - 5 fixed instrument groups (Drums/Bass/Lead/FX/Other) + right-click submenu + dockable panel + per-track group badge (v0.4.04)
import { initTrackInstrumentGrouping, openTrackInstrumentGroupingPanel, isTrackInstrumentGroupingPanelOpen, getInstrumentGroups, getTracksByInstrumentGroup, getInstrumentGroupSummary, assignTrackToInstrumentGroup, unassignTrackFromInstrumentGroup, getInstrumentGroupContextMenuItems, closeTrackInstrumentGroupingPanel } from './TrackInstrumentGrouping.js'; // v0.4.04
import { initTempoHistoryGraph } from './TempoHistoryGraph.js'; // v0.3.95
import { initMidiChordDisplay, updateMidiChordLabels, toggleMidiChordDisplay, isMidiChordDisplayEnabled } from './MidiChordDisplay.js';
import { initSpectrumAnalyzer, openSpectrumAnalyzerPanel } from './SpectrumAnalyzer.js';
import { initBeatSyncedLFOPanel, openBeatSyncedLFOPanel } from './BeatSyncedLFOPanel.js';
import { initTempoSyncVisualizer, openTempoSyncVisualizerPanel } from './TempoSyncVisualizer.js';
import { initTrackCompressorVisualizer, openTrackCompressorVisualizer } from './TrackCompressorVisualizer.js';
// Phase Correlation Meter
import { initPhaseCorrelationMeter, openPhaseCorrelationMeterPanel } from './PhaseCorrelationMeter.js';
// Track Color Palette
import { initTrackColorPalette, openTrackColorPalettePanel } from './TrackColorPalette.js';
// Tempo Sync LFO - Tempo-synced LFO for effect modulation
import { initTempoSyncLFOPanel, openTempoSyncLFOPanel } from './TempoSyncLFOPanel.js';
// Track Scroll To Center
import { initTrackScrollToCenter, openTrackScrollToCenterPanel, getScrollToCenterFn } from './TrackScrollToCenter.js';
// Rhythm Randomizer
import { initRhythmRandomizer, openRhythmRandomizerPanel, getRhythmRandomizerSettings } from './RhythmRandomizer.js';
// Arrangement Snap Grid
import { initArrangementSnapGrid, openSnapGridPanel, getSnapValue, setSnapValue, snapTimeToGrid, toggleSnapEnabled, getSnapInfo } from './ArrangementSnapGrid.js';
// Timeline Snap Resolution
import { initTimelineSnapResolution, openSnapResolutionPanel, getSnapResolution, setSnapResolution, toggleSnapResolutionPanel } from './TimelineSnapResolution.js';
// Clip Ghost Trails
import { initClipGhostTrails, openGhostTrailsPanel, getGhostTrails, addGhostTrail, removeGhostTrail, clearAllGhostTrails, createGhostFromClip, renderGhostTrailsOnCanvas, getGhostTrailCount, exportGhostTrailsData, importGhostTrailsData } from './ClipGhostTrails.js';
// Track Ghost Signals - Show faint visual overlay of other tracks' waveforms for visual reference
import { initTrackGhostSignals, openGhostSignalsPanel, setGhostSignalEnabled, setGhostSignalOpacity, toggleGhostSignal, renderGhostSignalsOnCanvas, getGhostSignalCount } from './TrackGhostSignals.js';
// Time Signature Per Track - Allow different time signatures per track for polyrhythmic compositions
import { initTimeSignaturePerTrack, openTimeSignaturePanel, getTrackTimeSignature, setTrackTimeSignature, clearTrackTimeSignature, getBarDurationSeconds, exportTimeSignatures, importTimeSignatures } from './TimeSignaturePerTrack.js';
// Drum Replace - Analyze audio and replace drum hits with samples
import { initDrumReplace, openDrumReplacePanel } from './DrumReplace.js';
import { initDrumPatternSplitter, openDrumPatternSplitterPanel } from './DrumPatternSplitter.js';
// Clip Opacity
import { initClipOpacity, openClipOpacityPanel } from './ClipOpacity.js';
// Clip Gain Per Instance - Per-clip volume knob
import { initClipGainPerInstance, openClipGainPanel, getClipGain, setClipGain } from './ClipGainPerInstance.js';
// Clip Start Offset
import { initClipStartOffset, openClipStartOffsetPanel } from './ClipStartOffset.js';
// Clip Fade Presets

// Export for external use (menu integration)
export { getClipFadeMenuItems, getClipFadeMenuItemsSimple, applyFadePresetToClip };

// Clip Fade Presets panel opener (used by menus)

// Clip Loop Preview
import { initClipLoopPreview, toggleClipLoopPreview, deactivateClipLoopPreview, isClipInLoopPreview } from './ClipLoopPreview.js';
// Quick Rename
import { initQuickRename } from './QuickRename.js';
// Project Auto-Naming - Auto-name clips and tracks based on content type
import { ProjectAutoNaming } from './ProjectAutoNaming.js';
// Audio Clip Stretch Markers - Visual markers on stretched audio clips
import { initAudioClipStretchMarkers, openStretchMarkersPanel, drawStretchMarkers } from './AudioClipStretchMarkers.js';
// Clip Stretch With Handles - Drag clip edges to stretch/squash audio non-destructively
import { initClipStretchWithHandles } from './ClipStretchWithHandles.js';
// Audio Scrubbing Integration - Audible scrub through audio by dragging on the timeline
import { initAudioScrubbing, openScrubSettingsPanel, setScrubOnDragEnabled, isAudioScrubActive } from './AudioScrubbingIntegration.js';
// Audio Phase Flip - Invert the phase of audio clips by 180 degrees
import { initAudioPhaseFlip, flipAudioBufferPhase, toggleClipPhaseFlip, isClipPhaseInverted, openAudioPhaseFlipPanel } from './AudioPhaseFlip.js';
// Audio Waveform Annotation - Add text notes directly onto audio waveforms
import { initAudioWaveformAnnotation, openAnnotationPanel, addAnnotation, getAnnotations, renderAnnotationMarkers } from './AudioWaveformAnnotation.js';
// Waveform Visualization - Draw real-time waveform on audio clips in timeline
import { initWaveformVisualization, updateWaveformDisplay, renderTrackWaveforms } from './WaveformVisualization.js';
// Clip Reverse - Reverse audio clips with one click
import { initClipReverse, openClipReversePanel, reverseAudioClip, reverseMIDISequence, isClipReversed, isSequenceReversed } from './ClipReverse.js';
import { initQuickVolumeRamp, openQuickVolumeRampPanel, toggleQuickVolumeRampPanel } from './QuickVolumeRamp.js';
// WebAudio Plugin Host - Load AudioWorklet processors into track effect chains (VST-style plugins)
import { initWebAudioPluginHost, openWebAudioPluginHostPanel, loadWorkletPlugin, removeWorkletPlugin, bypassWorkletPlugin, setWorkletParam, getLoadedWorkletPlugins, isWorkletPluginLoaded } from './WebAudioPluginHost.js';
// Track Folder Collapse Memory - remember per-project which track folders are collapsed/expanded (v0.3.76)
import { initTrackFolderCollapseMemory, rememberFolderCollapse, recallFolderCollapse, applyRememberedCollapseToGroups, applyRememberedCollapseToStacks, clearCurrentProjectCollapseMemory } from './TrackFolderCollapseMemory.js';
// Sidechain Volume Envelope - Draw ducking curves on clips for sidechain effects
import { initSidechainVolumeEnvelope, openSidechainVolumeEnvelopePanel, getSidechainEnvelope } from './SidechainVolumeEnvelope.js';
// Sidechain Visualizer - Visual indicator for sidechain routing and ducking status
import { initSidechainVisualizer, openSidechainVisualizerPanel, triggerSidechainVisualizer, getDuckingLevel, resetDuckingIndicators } from './SidechainVisualizer.js';
// Effect panel imports - Session 2026-04-24
import { openTubeSaturationPanel } from './DynamicTubeSaturation.js';
import { openMultibandGatePanel } from './MultibandGate.js';
import { openTransientModulatorPanel } from './TransientModulator.js';
import { openStereoWidthControllerPanel } from './StereoWidthController.js';
import { openDynamicResonanceFilterPanel } from './DynamicResonanceFilter.js';
import { openVocalDoublerPanel } from './VocalDoubler.js';
import { SpectralCompressor, openSpectralCompressorPanel } from './SpectralCompressor.js';
import { HarmonicSynthesizer, openHarmonicSynthesizerPanel } from './HarmonicSynthesizer.js';
import { DynamicEQ, openDynamicEQPanel } from './DynamicEQ.js';
import { StereoImagerEnhancement, openStereoImagerEnhancementPanel } from './StereoImagerEnhancement.js';
import { MultibandSaturator, openMultibandSaturatorPanel } from './MultibandSaturator.js';
import { AutoPanner, openAutoPannerPanel } from './AutoPanner.js';
import { GranularProcessor, openGranularProcessorPanel } from './GranularProcessor.js';
import { ConvolutionReverb, openConvolutionReverbPanel } from './ConvolutionReverb.js';
import { FormantFilter, openFormantFilterPanel } from './FormantFilter.js';
import { RingModulator, openRingModulatorPanel } from './RingModulator.js';
import { FrequencyShifter, openFrequencyShifterPanel } from './FrequencyShifter.js';
import { EnvelopeGenerator, openEnvelopeGeneratorPanel } from './EnvelopeGenerator.js';
// Status bar display imports
import { initSampleRateDisplay, startSampleRateDisplayLoop } from './SampleRateDisplay.js';
import * as FeatureAdditions from './FeatureAdditions.js';
// getMimeTypeFromFilename is used by getAudioBlobFromSoundBrowserItem (line ~342) to
// build a File with the correct MIME type for the sound browser drop pipeline.
// getMasterMeterNode is used by the Loudness Meter panel to tap the master bus for
// true-peak analysis and to read the per-tick dB value for LUFS computation.
import { getMimeTypeFromFilename, getMasterMeterNode, getMasterLimiterNode, setMasterLimiterEnabled, setMasterLimiterThresholdDb, setMasterLimiterCeilingDb, getMasterLimiterReductionDb, getMasterLimiterThresholdDb, getMasterLimiterCeilingDb, isMasterLimiterEnabled as audioIsMasterLimiterEnabledImpl, setMasterEffectWet } from './audio.js';
// setupGenericDropZoneListeners is imported here but used via appServices by ui.js
import { showNotification as utilShowNotification, createContextMenu, createDropZoneHTML, setupGenericDropZoneListeners } from './utils.js';
import { openKeyboardShortcutsPanel } from './ui.js';
import {
    initializeEventHandlersModule, initializePrimaryEventListeners, initializeMIDIDropZone, setupMIDI, attachGlobalControlEvents,
    selectMIDIInput as eventSelectMIDIInput, 
    handleTrackMute as eventHandleTrackMute,
    handleTrackSolo as eventHandleTrackSolo,
    handleTrackSoloExclusive as eventHandleTrackSoloExclusive,
    handleTrackArm as eventHandleTrackArm,
    handleRemoveTrack as eventHandleRemoveTrack,
    handleTrackArchive as eventHandleTrackArchive,
    handleTrackFreeze as eventHandleTrackFreeze,
    handleDuplicateTrack as eventHandleDuplicateTrack,
    handleOpenTrackInspector as eventHandleOpenTrackInspector,
    handleOpenEffectsRack as eventHandleOpenEffectsRack,
    handleOpenSequencer as eventHandleOpenSequencer,
    handleTimelineLaneDrop,
    exportTrackToMIDI
} from './eventHandlers.js';
import {
    initializeStateModule,
    // State Getters
    getTracksState, getTrackByIdState, getOpenWindowsState, getWindowByIdState, getHighestZState,
    getMasterEffectsState, getMasterGainValueState,
    getMidiAccessState, getActiveMIDIInputState,
    getMidiOutputDevices, sendMidiNoteOn, sendMidiNoteOff, sendMidiCC, sendMidiAllNotesOff, sendMidiAllNotesOffOnChannel, selectMidiOutput, getActiveMidiOutputState,
    getLoadedZipFilesState, getSoundLibraryFileTreesState, getCurrentLibraryNameState,
    getCurrentSoundFileTreeState, getCurrentSoundBrowserPathState, getPreviewPlayerState,
    getClipboardDataState, getAutomationClipboardState, getArmedTrackIdState, getSoloedTrackIdState, isTrackRecordingState,
    getRecordingTrackIdState,
    getActiveSequencerTrackIdState, getUndoStackState, getRedoStackState, getUndoCount, getRedoCount, getPlaybackModeState,
    // State Setters
    addWindowToStoreState, removeWindowFromStoreState, setHighestZState, incrementHighestZState,
    setMasterEffectsState, setMasterGainValueState,
    setMidiAccessState, setActiveMIDIInputState,
    setLoadedZipFilesState,
    setSoundLibraryFileTreesState,
    setCurrentLibraryNameState, setCurrentSoundFileTreeState, setCurrentSoundBrowserPathState, setPreviewPlayerState,
    setClipboardDataState, setAutomationClipboardState, setArmedTrackIdState, setSoloedTrackIdState, setIsRecordingState,
    setRecordingTrackIdState, setRecordingStartTimeState, setActiveSequencerTrackIdState,
    setPlaybackModeState,
    addMasterEffectToState, removeMasterEffectFromState,
    updateMasterEffectParamInState, reorderMasterEffectInState, toggleMasterEffectBypass,
    // MIDI Learn
    getMidiLearnMode, setMidiLearnMode, getMidiLearnTarget, setMidiLearnTarget,
    getMidiMappings, addMidiMapping, removeMidiMapping, getMidiMappingForCC, clearAllMidiMappings,
    // Per-Track MIDI CC Presets (v0.4.02)
    getMidiMappingsForTrack, replaceMidiMappingsForTrack, applyMidiMappingPresetForTrack,
    // MIDI CC Visualizer
    getCcVisualizerValues, updateCcVisualizerValue,
    // Loop Region
    getLoopRegionEnabled, setLoopRegionEnabled, getLoopRegionStart, setLoopRegionStart, getLoopRegionEnd, setLoopRegionEnd, getLoopRegion,
    // Metronome
    getMetronomeEnabled, setMetronomeEnabled, getMetronomeVolume, setMetronomeVolume,
    // Core State Actions
    addTrackToStateInternal, removeTrackFromStateInternal, reorderTrackInState,
    captureStateForUndoInternal, undoLastActionInternal, redoLastActionInternal,
    gatherProjectDataInternal, reconstructDAWInternal, saveProjectInternal,
    loadProjectInternal, handleProjectFileLoadInternal,
    saveProjectTemplate, loadProjectTemplate, getProjectTemplateNames, getProjectTemplate, deleteProjectTemplate,
    // Auto-save (used by AutoSaveIndicator — must be reachable from appServices.stateModule)
    getLastAutoSaveTime,
    // Auto-save counter (v0.3.92)
    getAutoSaveCount, getAutoSaveCountToday,
    // Groove Presets (v0.3.94 — exposed for Per-Track Groove Template Selector)
    getGroovePresetsState,
    // Timeline Markers (v0.4.05 — used by MarkerAnnotations)
    getTimelineMarkers, removeTimelineMarker, updateTimelineMarker,
} from './state.js';

import {
    highlightMappedParameters, clearMappedIndicators, toggleMappedIndicators, areMappedIndicatorsVisible
} from './MIDILearnMode.js';

// --- showSafeNotification ---
// Module-level wrapper around the imported utilShowNotification. Many call sites
// in this file reference the bare `showSafeNotification(...)` name (e.g. inside
// removeCustomDesktopBackground, transport stop handlers, master-effect error
// paths). Without this wrapper, `typeof showSafeNotification === 'function'`
// evaluates to false everywhere, so those toasts never reach the user even
// though appServices.showSafeNotification exists. Mirrors the appServices method
// (line ~879) so both invocations stay consistent.
function showSafeNotification(message, duration) {
    try {
        if (typeof utilShowNotification === 'function') {
            utilShowNotification(message, duration);
        } else {
            console.warn('[showSafeNotification] utilShowNotification not available, logging to console:', message);
        }
    } catch (e) {
        console.error('[showSafeNotification] Error showing notification:', e, 'message was:', message);
    }
}

// --- currentDesktopVideoObjectUrl tracker ---
// Tracks the object URL issued for the currently-applied video desktop background
// so it can be revoked when the user uploads a new video, removes the background,
// or the page tears down. Without this, every video upload leaks one Blob for the
// lifetime of the tab (URL.createObjectURL pins the Blob until revoked or the
// document is unloaded).
let currentDesktopVideoObjectUrl = null;
// --- currentDesktopImageObjectUrl tracker ---
// Same hygiene for the IDB-fallback image path: when a large image is too big for
// localStorage, we route it through bgDb and issue a blob: URL for the runtime
// <img>. Track it so removeCustomDesktopBackground + a video switch can revoke it.
let currentDesktopImageObjectUrl = null;

// --- removeCustomDesktopBackground ---
// Properly defined at module level (hoisted) so it's accessible both as a method
// on appServices and as window.removeCustomDesktopBackground. Uses appServices.bgDb
// directly to avoid the broken `this.init()` arrow-function trap (in module scope,
// `this` is undefined, so `this.init()` would throw "Cannot read properties of
// undefined (reading 'init')" the moment the user clicks "Remove Custom Background").
async function removeCustomDesktopBackground() {
    const desktop = uiElementsCache?.desktop;
    const videoBg = document.getElementById('desktopVideoBg');

    try {
        // Clear localStorage
        localStorage.removeItem(DESKTOP_BACKGROUND_KEY);
        localStorage.removeItem(DESKTOP_BG_TYPE_KEY);

        // Clear desktop background styles
        if (desktop) {
            desktop.style.backgroundImage = '';
            desktop.style.backgroundColor = Constants.defaultDesktopBg || '#101010';
        }

        // Stop and clear video
        if (videoBg) {
            videoBg.pause();
            videoBg.src = '';
            videoBg.style.display = 'none';
        }

        // Revoke the previously-issued object URL so the underlying Blob can
        // be garbage-collected (matches the new currentDesktopVideoObjectUrl
        // tracker set by handleCustomBackgroundUpload and restoreDesktopBackground).
        if (currentDesktopVideoObjectUrl) {
            try { URL.revokeObjectURL(currentDesktopVideoObjectUrl); } catch (_) {}
            currentDesktopVideoObjectUrl = null;
        }
        // Same hygiene for the large-image IDB-fallback path: revoke the blob:
        // URL we issued and clear the IDB row.
        if (currentDesktopImageObjectUrl) {
            try { URL.revokeObjectURL(currentDesktopImageObjectUrl); } catch (_) {}
            currentDesktopImageObjectUrl = null;
        }

        // Remove from IndexedDB if present; localStorage and the visible UI are already cleared.
        try {
            await appServices.bgDb.remove('desktopVideo');
        } catch (dbErr) {
            console.warn("[removeCustomDesktopBackground] IndexedDB video delete failed (localStorage still cleared):", dbErr);
            if (typeof showSafeNotification === 'function') showSafeNotification("Local DB cleanup failed — background cleared anyway.", 2500);
        }
        try {
            await appServices.bgDb.remove('desktopImage');
        } catch (dbErr) {
            console.warn("[removeCustomDesktopBackground] IndexedDB image delete failed (localStorage still cleared):", dbErr);
        }

        console.log("[removeCustomDesktopBackground] Custom background removed.");
        if (typeof showSafeNotification === 'function') showSafeNotification("Custom background removed.", 2000);
    } catch (e) {
        console.error("Error removing custom desktop background:", e);
        if (typeof showSafeNotification === 'function') showSafeNotification("Failed to remove background.", 2000);
    }
}

const appServices = {
    // Event Handler Passthroughs
    selectMIDIInput: eventSelectMIDIInput, 
    selectMidiOutput: selectMidiOutput,
    handleTrackMute: eventHandleTrackMute,
    handleTrackSolo: eventHandleTrackSolo,
    handleTrackSoloExclusive: eventHandleTrackSoloExclusive,
    handleTrackArm: eventHandleTrackArm,
    // Plugin Bypass Per-Track (v0.3.73) - per-track effect-chain bypass toggle
    toggleTrackEffectsBypass: (trackId, fromInteraction = false) => {
        try {
            const track = getTrackByIdState(trackId);
            if (!track) { console.warn(`[appServices.toggleTrackEffectsBypass] Track ${trackId} not found.`); return; }
            if (typeof track.toggleEffectsBypassed === 'function') {
                track.toggleEffectsBypassed(fromInteraction === true);
            } else {
                console.warn(`[appServices.toggleTrackEffectsBypass] Track ${trackId} has no toggleEffectsBypassed method.`);
            }
        } catch (e) { console.error(`[appServices.toggleTrackEffectsBypass] Error for ${trackId}:`, e); }
    },
    setTrackEffectsBypass: (trackId, bypassed, fromInteraction = false) => {
        try {
            const track = getTrackByIdState(trackId);
            if (!track) { console.warn(`[appServices.setTrackEffectsBypass] Track ${trackId} not found.`); return; }
            if (typeof track.setEffectsBypassed === 'function') {
                track.setEffectsBypassed(bypassed, fromInteraction === true);
            } else {
                console.warn(`[appServices.setTrackEffectsBypass] Track ${trackId} has no setEffectsBypassed method.`);
            }
        } catch (e) { console.error(`[appServices.setTrackEffectsBypass] Error for ${trackId}:`, e); }
    },
    // addEffectToTrack: create a real Tone.js effect node and push it into a
    // track's activeEffects chain. Used by Mix-Bus Group Presets, project
    // templates, and track templates. Without this, callers fall through to a
    // fallback that pushes { toneNode: null } entries — effects appear in the
    // UI but produce silence. Returns the new effect id, or null on failure.
    addEffectToTrack: (trackId, effectType, params = {}) => {
        try {
            const track = getTrackByIdState(trackId);
            if (!track) { console.warn(`[appServices.addEffectToTrack] Track ${trackId} not found.`); return null; }
            const registry = appServices.effectsRegistryAccess;
            if (!registry || typeof registry.createEffectInstance !== 'function') {
                console.warn(`[appServices.addEffectToTrack] effectsRegistryAccess.createEffectInstance not available; cannot build real node for ${effectType}.`);
                return null;
            }
            const defaults = typeof registry.getEffectDefaultParams === 'function' ? registry.getEffectDefaultParams(effectType) : {};
            const mergedParams = Object.assign({}, defaults, params);
            const toneNode = registry.createEffectInstance(effectType, mergedParams);
            if (!toneNode) {
                console.warn(`[appServices.addEffectToTrack] createEffectInstance returned null for type "${effectType}".`);
                return null;
            }
            const effectId = `effect-${trackId}-${effectType}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            if (!Array.isArray(track.activeEffects)) track.activeEffects = [];
            track.activeEffects.push({
                id: effectId,
                type: effectType,
                toneNode: toneNode,
                params: JSON.parse(JSON.stringify(mergedParams))
            });
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructing && captureStateForUndoInternal) {
                captureStateForUndoInternal(`Add ${effectType} to ${track.name}`);
            }
            if (typeof track.rebuildEffectChain === 'function') {
                try { track.rebuildEffectChain(); } catch (rcErr) { console.warn(`[appServices.addEffectToTrack] rebuildEffectChain failed:`, rcErr); }
            }
            if (typeof appServices.updateTrackUI === 'function') {
                try { appServices.updateTrackUI(trackId, 'effectsListChanged'); } catch (uiErr) { /* non-fatal */ }
            }
            return effectId;
        } catch (e) {
            console.error(`[appServices.addEffectToTrack] Error for track ${trackId}, effect ${effectType}:`, e);
            return null;
        }
    },
    handleRemoveTrack: eventHandleRemoveTrack,
    handleTrackArchive: eventHandleTrackArchive,
    handleTrackFreeze: eventHandleTrackFreeze,
    handleDuplicateTrack: eventHandleDuplicateTrack,
    handleOpenTrackInspector: eventHandleOpenTrackInspector,
    handleOpenEffectsRack: eventHandleOpenEffectsRack,
    handleOpenSequencer: eventHandleOpenSequencer,
    handleTimelineLaneDrop: handleTimelineLaneDrop,
    exportTrackToMIDI: exportTrackToMIDI,
    attachGlobalControlEvents: attachGlobalControlEvents, // FIX: Expose for reconstruction

    getAudioBlobFromSoundBrowserItem: async (soundData) => {
        if (!soundData || !soundData.libraryName || !soundData.fullPath) {
            console.warn("[AppServices getAudioBlob] Invalid soundData:", soundData);
            return null;
        }
        const loadedZips = getLoadedZipFilesState(); 
        if (loadedZips?.[soundData.libraryName] && loadedZips[soundData.libraryName] !== "loading") {
            const zipEntry = loadedZips[soundData.libraryName].file(soundData.fullPath);
            if (zipEntry) {
                try {
                    const blob = await zipEntry.async("blob");
                    return new File([blob], soundData.fileName, { type: getMimeTypeFromFilename(soundData.fileName) });
                } catch (e) {
                    console.error("[AppServices getAudioBlob] Error getting blob from zipEntry:", e);
                    return null;
                }
            } else {
                console.warn(`[AppServices getAudioBlob] ZipEntry not found for ${soundData.fullPath} in ${soundData.libraryName}`);
            }
        } else {
            console.warn(`[AppServices getAudioBlob] Library ${soundData.libraryName} not loaded or is loading.`);
        }
        return null;
    },

    // --- Custom Background Helpers ---
    DESKTOP_BACKGROUND_KEY: 'snugosDesktopBackground',
    DESKTOP_BG_TYPE_KEY: 'snugosDesktopBgType',
    bgDb: {
        db: null,
        async init() {
            if (this.db) return this.db;
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('SnugOSBackgrounds', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => { this.db = request.result; resolve(this.db); };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('backgrounds')) {
                        db.createObjectStore('backgrounds');
                    }
                };
            });
        },
        async save(key, blob) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readwrite');
                const store = tx.objectStore('backgrounds');
                store.put(blob, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },
        async get(key) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readonly');
                const store = tx.objectStore('backgrounds');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        async remove(key) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readwrite');
                const store = tx.objectStore('backgrounds');
                store.delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }
    },
    // --- State module passthrough ---
    // Downstream modules (e.g. AutoSaveIndicator) look up state-only getters via
    // `appServices.stateModule.foo()`. Without this, AutoSaveIndicator's
    // `getLastSaveTime()` falls through to a localStorage key nothing writes to,
    // and the indicator permanently shows "Not saved" even after auto-save has
    // run. Exposing the imported state symbols here closes that gap.
    stateModule: {
        getLastAutoSaveTime: () => {
            try {
                if (typeof getLastAutoSaveTime === 'function') return getLastAutoSaveTime();
            } catch (_) { /* fall through to 0 */ }
            return 0;
        },
        // Auto-save counter (v0.3.92) — used by AutoSaveCounter module
        getAutoSaveCount: () => {
            try {
                if (typeof getAutoSaveCount === 'function') return getAutoSaveCount();
            } catch (_) { /* fall through to 0 */ }
            return 0;
        },
        getAutoSaveCountToday: () => {
            try {
                if (typeof getAutoSaveCountToday === 'function') return getAutoSaveCountToday();
            } catch (_) { /* fall through to 0 */ }
            return 0;
        },
        // Project Session Timer (v0.4.12) — MM:SS status bar timer with click-to-reset.
        resetProjectSessionTimer: () => {
            try {
                if (typeof resetProjectSessionTimer === 'function') resetProjectSessionTimer();
            } catch (e) { console.warn('[appServices.resetProjectSessionTimer] Error:', e); }
        },
        getProjectSessionTimerStatus: () => {
            try {
                if (typeof getProjectSessionTimerStatus === 'function') return getProjectSessionTimerStatus();
            } catch (_) { /* fall through */ }
            return null;
        },
        // Transport Bar Master Output Meter (v0.4.15) — L/R horizontal peak meter in the transport bar
        updateTransportBarMasterMeter: () => {
            try {
                if (typeof updateTransportBarMasterMeter === 'function') updateTransportBarMasterMeter();
            } catch (e) { console.warn('[appServices.updateTransportBarMasterMeter] Error:', e); }
        },
        isTransportBarMasterMeterActive: () => {
            try {
                if (typeof isTransportBarMasterMeterActive === 'function') return isTransportBarMasterMeterActive();
            } catch (_) { /* fall through */ }
            return false;
        },
        setTransportBarMasterMeterVisible: (visible) => {
            try {
                if (typeof setTransportBarMasterMeterVisible === 'function') setTransportBarMasterMeterVisible(visible);
            } catch (e) { console.warn('[appServices.setTransportBarMasterMeterVisible] Error:', e); }
        },
        openTransportBarMasterMeterPopover: () => {
            try {
                if (typeof openTransportBarMasterMeterPopover === 'function') openTransportBarMasterMeterPopover();
            } catch (e) { console.warn('[appServices.openTransportBarMasterMeterPopover] Error:', e); }
        },
        closeTransportBarMasterMeterPopover: () => {
            try {
                if (typeof closeTransportBarMasterMeterPopover === 'function') closeTransportBarMasterMeterPopover();
            } catch (e) { console.warn('[appServices.closeTransportBarMasterMeterPopover] Error:', e); }
        },
        getTransportBarMasterMeterStatus: () => {
            try {
                if (typeof getTransportBarMasterMeterStatus === 'function') return getTransportBarMasterMeterStatus();
            } catch (_) { /* fall through */ }
            return null;
        },
        // Quick Project Snapshot List (v0.4.15) — last 5 auto + manual snapshots
        openProjectSnapshotListPanel: () => {
            try {
                if (typeof openProjectSnapshotListPanel === 'function') openProjectSnapshotListPanel();
            } catch (e) { console.warn('[appServices.openProjectSnapshotListPanel] Error:', e); }
        },
        closeProjectSnapshotListPanel: () => {
            try {
                if (typeof closeProjectSnapshotListPanel === 'function') closeProjectSnapshotListPanel();
            } catch (e) { console.warn('[appServices.closeProjectSnapshotListPanel] Error:', e); }
        },
        toggleProjectSnapshotListPanel: () => {
            try {
                if (typeof toggleProjectSnapshotListPanel === 'function') toggleProjectSnapshotListPanel();
            } catch (e) { console.warn('[appServices.toggleProjectSnapshotListPanel] Error:', e); }
        },
        // Loop region passthroughs (v0.3.86 — LoopLengthDisplay)
        getLoopRegionEnabled: () => getLoopRegionEnabled(),
        setLoopRegionEnabled: (enabled) => setLoopRegionEnabled(enabled),
        getLoopRegionStart: () => getLoopRegionStart(),
        setLoopRegionStart: (start) => setLoopRegionStart(start),
        getLoopRegionEnd: () => getLoopRegionEnd(),
        setLoopRegionEnd: (end) => setLoopRegionEnd(end),
        getLoopRegion: () => getLoopRegion(),
        // captureStateForUndo passthrough (v0.3.93 PerTrackMidiChannelDisplay fix) — needed
        // so the v0.3.93 commitChannelChange() can pre-capture the undo state before the
        // track.setMidiChannel mutation. The 4 master-effect handlers in main.js (addMasterEffect,
        // removeMasterEffect, reorderMasterEffect, bypassMasterEffect) were already calling
        // `appServices.captureStateForUndo` (lines 935/955/972/984) but that property was never
        // defined on the appServices object — every master-effect undo capture was a silent
        // no-op. Adding the property here fixes both bugs at once. The state.js-level
        // captureStateForUndoInternal is the canonical implementation.
        captureStateForUndo: (description) => {
            try {
                if (typeof captureStateForUndoInternal === 'function') {
                    return captureStateForUndoInternal(description);
                }
            } catch (e) {
                console.warn('[Main appServices.captureStateForUndo] Error:', e);
            }
        },
        // Per-Track MIDI CC Presets (v0.4.02) — passthroughs so the
        // v0.4.02 module can read/write per-track mapping sets through
        // appServices.stateModule without importing state.js directly.
        getMidiMappingsForTrack: (trackId) => {
            try {
                if (typeof getMidiMappingsForTrack === 'function') return getMidiMappingsForTrack(trackId) || [];
            } catch (e) { /* fall through */ }
            return [];
        },
        replaceMidiMappingsForTrack: (trackId, newMappings) => {
            try {
                if (typeof replaceMidiMappingsForTrack === 'function') return replaceMidiMappingsForTrack(trackId, newMappings) || { removed: 0, added: 0 };
            } catch (e) { /* fall through */ }
            return { removed: 0, added: 0 };
        },
        applyMidiMappingPresetForTrack: (trackId, preset) => {
            try {
                if (typeof applyMidiMappingPresetForTrack === 'function') return applyMidiMappingPresetForTrack(trackId, preset) || { removed: 0, added: 0 };
            } catch (e) { /* fall through */ }
            return { removed: 0, added: 0 };
        },
    },

    removeCustomDesktopBackground, // Shorthand → module-level async function (uses appServices.bgDb.init())

    // --- Track access helpers ---
    // Modules (e.g. CrossfadeLoopPoints) need a stable way to resolve a Track by id.
    // Wraps the state-only getter so consumers don't need to import from state.js.
    getTrackById: (trackId) => {
        if (typeof getTrackByIdState === 'function') return getTrackByIdState(trackId);
        return null;
    },
    getTracks: () => {
        if (typeof getTracksState === 'function') return getTracksState();
        return [];
    },
    addRenderedTimelineMarker: (time, name = '', color = '#ff6b6b', note = '') => {
        try { return addRenderedTimelineMarker(time, name, color, note); }
        catch (e) { console.warn('[appServices.addRenderedTimelineMarker] failed:', e); return null; }
    },
    removeRenderedTimelineMarker: (id) => {
        try { return removeRenderedTimelineMarker(id); }
        catch (e) { console.warn('[appServices.removeRenderedTimelineMarker] failed:', e); return false; }
    },
    getRenderedTimelineMarkers: () => {
        try { return getRenderedTimelineMarkers(); }
        catch (e) { console.warn('[appServices.getRenderedTimelineMarkers] failed:', e); return []; }
    },
    // Timeline Markers (v0.4.05 — used by MarkerAnnotations)
    getTimelineMarkers: () => {
        try { return typeof getTimelineMarkers === 'function' ? getTimelineMarkers() : []; }
        catch (e) { console.warn('[appServices.getTimelineMarkers] failed:', e); return []; }
    },
    removeTimelineMarker: (id) => {
        try {
            if (typeof removeTimelineMarker === 'function') return removeTimelineMarker(id);
        } catch (e) { console.warn('[appServices.removeTimelineMarker] failed:', e); }
        return false;
    },
    updateTimelineMarker: (id, updates) => {
        try {
            if (typeof updateTimelineMarker === 'function') return updateTimelineMarker(id, updates);
        } catch (e) { console.warn('[appServices.updateTimelineMarker] failed:', e); }
        return null;
    },
    openQuickMarkerPopover,
    // Audio destination for short-lived preview players (loop preview, etc.).
    // Defaults to Tone.Destination; modules can override via appServices for routing.
    getPreviewDestination: () => {
        try { return (typeof Tone !== 'undefined' && Tone.Destination) ? Tone.Destination : null; }
        catch (e) { return null; }
    },
    // Audio blob lookup helper for preview utilities.
    getAudio: async (sourceId) => {
        if (!sourceId) return null;
        if (window.db && typeof window.db.getAudio === 'function') {
            try { return await window.db.getAudio(sourceId); } catch (e) { /* fall through */ }
        }
        if (typeof getAudioBlobFromSoundBrowserItem === 'function') {
            try { return await getAudioBlobFromSoundBrowserItem(sourceId); } catch (e) { /* fall through */ }
        }
        return null;
    },

    // --- Custom Background Helpers ---
    hasCustomBackground: () => {
        const hasLocalStorage = localStorage.getItem('snugosDesktopBackground') || localStorage.getItem('snugosDesktopBgType');
        if (hasLocalStorage) return true;
        return false; // IndexedDB check would be async, checked by caller if needed
    },
    updateBgStatusIndicator: () => {
        const indicator = document.getElementById('statusBgIndicator');
        if (!indicator) return;
        const hasBg = localStorage.getItem('snugosDesktopBackground') || localStorage.getItem('snugosDesktopBgType');
        if (hasBg) {
            indicator.classList.remove('hidden');
            indicator.classList.add('flex');
        } else {
            indicator.classList.add('hidden');
            indicator.classList.remove('flex');
        }
    },

    // MIDI Chord Player Services
    playMidiChord: (trackId, rootNote, octave, chordType, options = {}) => {
        const track = getTrackByIdState(trackId);
        if (!track) return null;
        
        const pattern = Constants.CHORD_PATTERNS[chordType];
        if (!pattern) {
            console.warn(`[MIDIChordPlayer] Unknown chord type: ${chordType}`);
            return null;
        }
        
        const rootSemitone = Constants.MIDI_CHORD_ROOT_NOTES.find(n => n.note === rootNote)?.semitone ?? 0;
        const rootMidi = (octave + 1) * 12 + rootSemitone;
        const notes = pattern.intervals.map(interval => rootMidi + interval);
        
        // Apply inversion if specified
        const inversion = options.inversion || 0;
        let invertedNotes = [...notes];
        if (inversion !== 0) {
            for (let i = 0; i < Math.abs(inversion); i++) {
                if (inversion > 0) {
                    // Move bottom note up an octave
                    const lowest = invertedNotes.shift();
                    invertedNotes.push(lowest + 12);
                } else {
                    // Move top note down an octave
                    const highest = invertedNotes.pop();
                    invertedNotes.unshift(highest - 12);
                }
            }
        }
        
        // Apply voicing
        const voicing = options.voicing || 'close';
        // For now, just use the notes as-is
        const velocity = options.velocity || 0.8;
        
        const now = Tone.now();
        const midiNotes = invertedNotes.map(n => ({
            pitch: n,
            freq: Tone.Frequency(n, 'midi').toFrequency()
        }));
        
        // Play all notes
        midiNotes.forEach(({ pitch, freq }) => {
            if (track.playNote) {
                track.playNote(pitch, now, undefined, velocity);
            } else if (track.instrument?.triggerAttack) {
                track.instrument.triggerAttack(freq, now, velocity);
            }
        });
        
        // Store active notes for later release
        track._activeChordNotes = invertedNotes;
        track._chordPlayerActive = true;
        
        return { notes: invertedNotes.map(n => Tone.Frequency(n, 'midi').toNote()), root: `${rootNote}${octave}` };
    },
    
    stopMidiChord: (trackId) => {
        const track = getTrackByIdState(trackId);
        if (!track || !track._chordPlayerActive) return;
        
        const now = Tone.now();
        const notes = track._activeChordNotes || [];
        
        notes.forEach(pitch => {
            if (track.releaseNote) {
                track.releaseNote(pitch, now);
            } else if (track.instrument?.triggerRelease) {
                const freq = Tone.Frequency(pitch, 'midi').toFrequency();
                track.instrument.triggerRelease(freq, now);
            }
        });
        
        track._chordPlayerActive = false;
        track._activeChordNotes = [];
    },
    
    getMidiChordPlayerSettings: () => {
        return localStorage.getItem('midiChordPlayerSettings') ? 
            JSON.parse(localStorage.getItem('midiChordPlayerSettings')) : 
            { chordType: 'major', inversion: 0, voicing: 'close', octave: 4, velocity: 0.8 };
    },
    
    setMidiChordPlayerSettings: (settings) => {
        localStorage.setItem('midiChordPlayerSettings', JSON.stringify(settings));
    },
    
    // Per-Track MIDI Panic (v0.4.00): stop audio + release notes + clear
    // active clip players for ONE specific track only. Mirrors the track-
    // specific half of panicStopAllAudio() but never touches other tracks
    // and never stops the global transport — the user wants to silence
    // one stuck track and keep the rest of the arrangement rolling.
    // Undo is NOT captured because this is a transient playback-state
    // fix (a button-pressed event), not a project-state mutation.
    panicStopTrackAudio: (trackId) => {
        console.log(`[AppServices] Per-Track MIDI Panic for track ${trackId} requested.`);
        if (trackId == null) return false;
        const track = (typeof getTrackByIdState === 'function') ? getTrackByIdState(trackId) : null;
        if (!track) {
            console.warn(`[AppServices] Per-Track Panic: track ${trackId} not found.`);
            return false;
        }
        if (typeof Tone === 'undefined') return false;
        const now = Tone.now();

        // 1) Call the track's own stopPlayback() — this stops/disposes
        //    timeline clip players, patternPlayerSequence, slicer
        //    mono player, and releases notes on Synth/InstrumentSampler/
        //    DrumSampler instruments. Same path the global panic uses
        //    for one track.
        if (typeof track.stopPlayback === 'function') {
            try { track.stopPlayback(); }
            catch (e) { console.warn(`[AppServices PerTrackPanic] stopPlayback failed for track ${trackId}:`, e); }
        }

        // 2) Aggressive gain ramp-down for synth types (matches the
        //    global panic behavior so a stuck note that wasn't already
        //    released by the instrument gets force-muted through the
        //    track's gainNode).
        if (track && (track.type === 'Synth' || track.type === 'InstrumentSampler') &&
            track.gainNode && track.gainNode.gain &&
            typeof track.gainNode.gain.cancelScheduledValues === 'function' &&
            typeof track.gainNode.gain.linearRampToValueAtTime === 'function' &&
            !track.gainNode.disposed) {
            try {
                track.gainNode.gain.cancelScheduledValues(now);
                track.gainNode.gain.linearRampToValueAtTime(0, now + 0.02);
            } catch (e) {
                console.warn(`[AppServices PerTrackPanic] gain ramp-down failed for track ${trackId}:`, e);
            }
        }

        // 3) Send All-Notes-Off on the track's MIDI channel. If the
        //    track is set to Omni (0), clear all 16 channels because
        //    we don't know which one the stuck note came in on. The
        //    helper is imported from state.js at the top of this file.
        try {
            const ch = (typeof track.getMidiChannel === 'function') ? track.getMidiChannel() : (track.midiChannel ?? 0);
            if (typeof sendMidiAllNotesOffOnChannel === 'function') {
                if (ch === 0) {
                    // Omni track — clear all 16 channels
                    let sent = 0;
                    for (let c = 1; c <= 16; c++) {
                        try { sent += sendMidiAllNotesOffOnChannel(c) ? 1 : 0; } catch (e) { /* non-fatal */ }
                    }
                    console.log(`[AppServices PerTrackPanic] Cleared MIDI Omni (${sent} channel(s)) for track ${trackId}.`);
                } else {
                    const sent = sendMidiAllNotesOffOnChannel(ch);
                    console.log(`[AppServices PerTrackPanic] Cleared MIDI ch ${ch} for track ${trackId}: ${sent ? 'sent' : 'no output'}.`);
                }
            }
        } catch (midiErr) {
            console.warn(`[AppServices PerTrackPanic] MIDI All-Notes-Off error for track ${trackId}:`, midiErr);
        }

        return true;
    },
    // MODIFICATION: Refined Panic Stop Service
    panicStopAllAudio: () => {
        console.log("[AppServices] Panic Stop All Audio requested.");
        
        if (typeof Tone !== 'undefined') {
            Tone.Transport.stop();
            Tone.Transport.cancel(0); 
        }

        // Reset play button state
        const playBtn = uiElementsCache.playBtnGlobal;
        if (playBtn) {
            playBtn.textContent = 'Play';
            playBtn.classList.remove('playing');
        }

        const tracks = getTracksState();
        if (tracks) {
            tracks.forEach(track => {
                if (track && typeof track.stopPlayback === 'function') {
                    try {
                        track.stopPlayback(); 
                    } catch (e) {
                        console.warn(`Error in track.stopPlayback() for track ${track.id}:`, e);
                    }
                }

                if (track && track.instrument && !track.instrument.disposed) {
                    if (typeof track.instrument.releaseAll === 'function') {
                        try {
                            track.instrument.releaseAll(Tone.now()); 
                        } catch (e) {
                            console.warn(`Error during instrument.releaseAll() for track ${track.id}:`, e);
                        }
                    }
                    // Aggressive gain ramp-down for synth types
                    if ((track.type === 'Synth' || track.type === 'InstrumentSampler') && 
                        track.gainNode && track.gainNode.gain && 
                        typeof track.gainNode.gain.cancelScheduledValues === 'function' &&
                        typeof track.gainNode.gain.linearRampToValueAtTime === 'function' &&
                        !track.gainNode.disposed) {
                        console.log(`[AppServices Panic] Ramping down gain for synth track ${track.id}`);
                        try {
                            track.gainNode.gain.cancelScheduledValues(Tone.now());
                            track.gainNode.gain.linearRampToValueAtTime(0, Tone.now() + 0.02); 
                        } catch (e) {
                            console.warn(`Error ramping down gain for track ${track.id}:`, e);
                        }
                    }
                }
                
                if (track && track.type === 'Sampler' && track.slicerIsPolyphonic && track.slicerMonoPlayer && track.slicerMonoEnvelope) {
                    if (track.slicerMonoPlayer.state === 'started' && !track.slicerMonoPlayer.disposed) {
                        try { track.slicerMonoPlayer.stop(Tone.now()); } catch(e) { console.warn("Error stopping mono slicer player during panic", e); }
                    }
                    if (!track.slicerMonoEnvelope.disposed) {
                        try { track.slicerMonoEnvelope.triggerRelease(Tone.now()); } catch(e) { console.warn("Error releasing mono slicer envelope during panic", e); }
                    }
                }
                if (track && track.type === 'DrumSampler' && track.drumPadPlayers) {
                    track.drumPadPlayers.forEach(player => {
                        if (player && player.state === 'started' && !player.disposed) {
                            try { player.stop(Tone.now()); } catch(e) { console.warn("Error stopping drum pad player during panic", e); }
                        }
                    });
                }
            });
        }

        // Send MIDI All Notes Off (CC 123) on all 16 channels to clear any
        // stuck/hanging notes on external MIDI hardware.
        try {
            const midiChannelsCleared = sendMidiAllNotesOff();
            if (midiChannelsCleared > 0) {
                console.log(`[AppServices Panic] Sent All Notes Off on ${midiChannelsCleared} MIDI channel(s).`);
            }
        } catch (midiPanicErr) {
            console.warn('[AppServices Panic] Error sending MIDI All Notes Off:', midiPanicErr);
        }

        console.log("All audio and transport stopped via panic.");
        showSafeNotification("All audio stopped.", 1500);
    },
    stopAndResetTransport: () => {
        console.log("[AppServices] Stop and Reset Transport requested.");
        // Stop all audio using panic
        appServices.panicStopAllAudio();
        // Reset transport position to start
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            Tone.Transport.position = 0;
            Tone.Transport.progress = 0;
        }
        // Reset play button to stopped state
        const playBtn = uiElementsCache.playBtnGlobal;
        if (playBtn) {
            playBtn.textContent = 'Play';
            playBtn.classList.remove('playing');
        }
        // Clear timeline position display
        if (uiElementsCache.timelinePositionDisplay) {
            uiElementsCache.timelinePositionDisplay.textContent = '0:00:000';
        }
        showSafeNotification("Transport stopped and reset.", 1500);
    },
    // END MODIFICATION

    updateTaskbarTempoDisplay: (tempo) => {
        if (uiElementsCache.taskbarTempoDisplay) {
            uiElementsCache.taskbarTempoDisplay.textContent = `${parseFloat(tempo).toFixed(1)} BPM`;
        } else { console.warn("Taskbar tempo display element not found in cache."); }
    },
    openStretchQualityPanel: () => {
        if (typeof openAudioStretchQualityPanel === 'function') openAudioStretchQualityPanel();
        else console.warn('openAudioStretchQualityPanel not available');
    },
    updateStretchQualityDisplay: () => {
        if (uiElementsCache.stretchQualityDisplay) {
            const quality = getAudioStretchingQuality();
            const label = quality === 'fast' ? 'Fast' : quality === 'high' ? 'High' : 'Balanced';
            uiElementsCache.stretchQualityDisplay.textContent = `${label}`;
        }
    },
    updateStretchQualityBtn: () => {
        if (uiElementsCache.stretchQualityBtn) {
            const quality = getAudioStretchingQuality();
            const label = quality === 'fast' ? 'Fast' : quality === 'high' ? 'High' : 'Balanced';
            uiElementsCache.stretchQualityBtn.textContent = `Stretch: ${label}`;
        }
    },
    updateUndoRedoButtonsUI: (undoState, redoState) => {
        if (uiElementsCache.menuUndo) {
            uiElementsCache.menuUndo.classList.toggle('disabled', !undoState);
            uiElementsCache.menuUndo.title = undoState ? `Undo: ${undoState.description || 'action'}` : 'Undo (Nothing to undo)';
        } else { console.warn("Undo menu item not found in cache."); }
        if (uiElementsCache.menuRedo) {
            uiElementsCache.menuRedo.classList.toggle('disabled', !redoState);
            uiElementsCache.menuRedo.title = redoState ? `Redo: ${redoState.description || 'action'}` : 'Redo (Nothing to redo)';
        } else { console.warn("Redo menu item not found in cache."); }
    },
    updateRecordButtonUI: (isRec) => {
        if (uiElementsCache.recordBtnGlobal) {
            uiElementsCache.recordBtnGlobal.textContent = isRec ? 'Stop Rec' : 'Record';
            uiElementsCache.recordBtnGlobal.classList.toggle('recording', isRec);
        } else { console.warn("Global record button not found in cache."); }
    },
    closeAllWindows: (isReconstruction = false) => {
        const openWindows = getOpenWindowsState();
        if (openWindows && typeof openWindows.forEach === 'function') {
            openWindows.forEach(win => {
                if (win && typeof win.close === 'function') win.close(isReconstruction);
            });
        }
        if (appServices.clearOpenWindowsMap) appServices.clearOpenWindowsMap();
    },
    clearOpenWindowsMap: () => {
        const map = getOpenWindowsState();
        if(map && typeof map.clear === 'function') map.clear();
    },
    closeAllTrackWindows: (trackIdToClose) => {
        console.log(`[Main appServices.closeAllTrackWindows] Called for trackId: ${trackIdToClose}`);
        const windowIdsToClose = [
            `trackInspector-${trackIdToClose}`, `effectsRack-${trackIdToClose}`, `sequencerWin-${trackIdToClose}`
        ];
        windowIdsToClose.forEach(winId => {
            const win = getWindowByIdState(winId);
            if (win && typeof win.close === 'function') {
                win.close(true); 
            }
        });
    },
    updateTrackUI: handleTrackUIUpdate, 
    setArmedTrackIdState: setArmedTrackIdState, // Used by ArmToggleHistory to undo a record-arm toggle without a full project-state restoration.
    updateTrackColor: (trackId, color) => {
        const track = getTrackByIdState(trackId);
        if (!track) return;
        if (captureStateForUndoInternal) captureStateForUndoInternal(`Change track color to ${color}`);
        track.color = color;
        if (typeof updateMixerWindow === 'function') updateMixerWindow();
        if (typeof renderTimeline === 'function') renderTimeline();
    },
    updateClipName: (clipId, newName) => {
        const tracks = getTracksState();
        for (const track of tracks) {
            const clip = track.timelineClips?.find(c => c.id === clipId);
            if (clip) {
                if (captureStateForUndoInternal) captureStateForUndoInternal(`Rename clip to "${newName}"`);
                clip.name = newName;
                if (typeof renderTimeline === 'function') renderTimeline();
                return true;
            }
        }
        return false;
    },
    createWindow: (id, title, content, options) => new SnugWindow(id, title, content, options, appServices),
    openWindowWithContent: (id, title, contentHTML, options) => {
        const win = new SnugWindow(id, title, contentHTML, options, appServices);
        return win;
    },
    uiElementsCache: uiElementsCache,
    saveProject: saveProjectInternal,
    loadProject: loadProjectInternal,
    handleProjectFileLoad: handleProjectFileLoadInternal,
    recordRecentProjectFile,


    addMasterEffect: async (effectType) => {
        try {
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Add ${effectType} to Master`);

            if (!appServices.effectsRegistryAccess?.getEffectDefaultParams) {
                console.error("effectsRegistryAccess.getEffectDefaultParams not available."); return;
            }
            const defaultParams = appServices.effectsRegistryAccess.getEffectDefaultParams(effectType);
            const effectIdInState = addMasterEffectToState(effectType, defaultParams);
            await addMasterEffectToAudio(effectIdInState, effectType, defaultParams);
            if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        } catch (error) {
            console.error(`[Main addMasterEffect] Error adding ${effectType}:`, error);
            showSafeNotification(`Failed to add master effect ${effectType}.`, 3000);
        }
    },
    removeMasterEffect: async (effectId) => {
        try {
            const effects = getMasterEffectsState();
            const effect = effects ? effects.find(e => e.id === effectId) : null;
            if (effect) {
                const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
                if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Remove ${effect.type} from Master`);
                removeMasterEffectFromState(effectId);
                await removeMasterEffectFromAudio(effectId);
                if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
            }
        } catch (error) {
            console.error(`[Main removeMasterEffect] Error removing ${effectId}:`, error);
            showSafeNotification("Failed to remove master effect.", 3000);
        }
    },
    updateMasterEffectParam: (effectId, paramPath, value) => {
        updateMasterEffectParamInState(effectId, paramPath, value);
        updateMasterEffectParamInAudio(effectId, paramPath, value);
    },
    reorderMasterEffect: (effectId, newIndex) => {
        try {
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Reorder Master effect`);
            reorderMasterEffectInState(effectId, newIndex);
            reorderMasterEffectInAudio(effectId, newIndex); 
            if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        } catch (error) {
            console.error(`[Main reorderMasterEffect] Error reordering ${effectId}:`, error);
            showSafeNotification("Failed to reorder master effect.", 3000);
        }
    },
    toggleMasterEffectBypass: (effectId) => {
        try {
            const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingDAW() : false;
            if (!isReconstructing && appServices.captureStateForUndo) appServices.captureStateForUndo(`Bypass Master effect`);
            toggleMasterEffectBypass(effectId);
            if (appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        } catch (error) {
            console.error(`[Main toggleMasterEffectBypass] Error toggling bypass for ${effectId}:`, error);
        }
    },
    setMasterEffectWet: (effectId, wetValue) => {
        try { setMasterEffectWet(effectId, wetValue); }
        catch (error) { console.error(`[Main setMasterEffectWet] Error setting wet for ${effectId}:`, error); }
    },
    setActualMasterVolume: (volumeValue) => {
        if (typeof getActualMasterGainNodeFromAudio === 'function') {
            const actualMasterNode = getActualMasterGainNodeFromAudio();
            if (actualMasterNode && actualMasterNode.gain && typeof actualMasterNode.gain.setValueAtTime === 'function') {
                try {
                    actualMasterNode.gain.setValueAtTime(volumeValue, Tone.now());
                } catch (e) { console.error("Error setting master volume via Tone:", e); }
            } else { console.warn("Master gain node or its gain property not available."); }
        } else { console.warn("getActualMasterGainNodeFromAudio service missing."); }
    },

    // --- Custom Background Functions ---
    DESKTOP_BACKGROUND_KEY: 'snugosDesktopBackground',
    DESKTOP_BG_TYPE_KEY: 'snugosDesktopBgType',
    bgDb: {
        db: null,
        async init() {
            if (this.db) return this.db;
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('SnugOSBackgrounds', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => { this.db = request.result; resolve(this.db); };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('backgrounds')) {
                        db.createObjectStore('backgrounds');
                    }
                };
            });
        },
        async save(key, blob) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readwrite');
                const store = tx.objectStore('backgrounds');
                store.put(blob, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },
        async get(key) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readonly');
                const store = tx.objectStore('backgrounds');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        async remove(key) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('backgrounds', 'readwrite');
                const store = tx.objectStore('backgrounds');
                store.delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }
    },

    triggerCustomBackgroundUpload: () => {
        if (uiElementsCache.customBgInput) uiElementsCache.customBgInput.click();
        else console.warn("Custom background input element not found in cache.");
    },
    removeCustomDesktopBackground,
    showSafeNotification: (message, duration) => {
        if (typeof utilShowNotification === 'function') {
            utilShowNotification(message, duration);
        } else {
            console.warn("showNotification utility not available, logging to console:", message);
        }
    },

    // Master Effect Presets
    saveMasterEffectPreset,
    loadMasterEffectPreset,
    getAvailableMasterEffectPresets,
    deleteMasterEffectPreset,

    // Clip Fade Presets (state-backed)
    getClipFadePresetsState,
    saveClipFadePreset,
    getClipFadePreset,
    getClipFadePresetNames,
    deleteClipFadePreset,
    applyClipFadePreset,

    // Groove Presets (state-backed, v0.3.94 — exposed for
    // Per-Track Groove Template Selector badge)
    getGroovePresetsState,

    // Per-Track MIDI CC Presets (v0.4.02 — exposes the
    // per-track CC panel + get/apply helpers to the rest of
    // the app). The panel itself does most of its own work
    // through `localAppServices.getTrackById`; this entry
    // point is what right-click context menus, future
    // hotkeys, and the start menu use to open the panel.)
    openPerTrackMidiCCPresetsPanel,
    getMidiMappingsForTrack: (trackId) => {
        if (typeof appServices !== 'undefined' && appServices.stateModule && typeof appServices.stateModule.getMidiMappingsForTrack === 'function') {
            return appServices.stateModule.getMidiMappingsForTrack(trackId) || [];
        }
        return [];
    },
    applyMidiMappingPresetForTrack: (trackId, preset) => {
        if (typeof appServices !== 'undefined' && appServices.stateModule && typeof appServices.stateModule.applyMidiMappingPresetForTrack === 'function') {
            return appServices.stateModule.applyMidiMappingPresetForTrack(trackId, preset) || { removed: 0, added: 0 };
        }
        return { removed: 0, added: 0 };
    },
    listPerTrackMidiCCPresets: () => {
        if (typeof window !== 'undefined' && typeof window.listPerTrackMidiCCPresets === 'function') {
            try { return window.listPerTrackMidiCCPresets() || []; } catch (e) { return []; }
        }
        return [];
    },

    effectsRegistryAccess: {
        AVAILABLE_EFFECTS: null, getEffectParamDefinitions: null,
        getEffectDefaultParams: null, synthEngineControlDefinitions: null,
    },
    getIsReconstructingDAW: () => appServices._isReconstructingDAW_flag === true, 
    _isReconstructingDAW_flag: false,
    _transportEventsInitialized_flag: false,
    getTransportEventsInitialized: () => appServices._transportEventsInitialized_flag,
    setTransportEventsInitialized: (value) => { appServices._transportEventsInitialized_flag = !!value; },
    updateTrackMeterUI: (trackId, level, isClipping) => {
        try {
            const inspectorWindow = getWindowByIdState(`trackInspector-${trackId}`);
            const mixerWindow = getWindowByIdState('mixer');
            if (inspectorWindow?.element && !inspectorWindow.isMinimized) {
                const meterBar = inspectorWindow.element.querySelector(`#trackMeterBar-${trackId}`);
                if (meterBar) {
                    meterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                    meterBar.classList.toggle('clipping', isClipping);
                }
            }
            if (mixerWindow?.element && !mixerWindow.isMinimized) {
                const meterBar = mixerWindow.element.querySelector(`#mixerTrackMeterBar-${trackId}`);
                if (meterBar) {
                    meterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                    meterBar.classList.toggle('clipping', isClipping);
                }
            }
        } catch (error) { console.warn(`[Main updateTrackMeterUI] Error for track ${trackId}:`, error); }
    },
    updateMasterEffectsRackUI: () => {
        try {
            const masterRackWindow = getWindowByIdState('masterEffectsRack');
            if (masterRackWindow?.element && !masterRackWindow.isMinimized) {
                const container = masterRackWindow.element.querySelector('#masterEffectsRackContent');
                if (container && typeof renderMasterEffectsRackPanel === 'function') {
                    renderMasterEffectsRackPanel(container);
                }
            }
        } catch (error) { console.warn("[Main updateMasterEffectsRackUI] Error:", error); }
    },
    onPlaybackModeChange: (newMode) => {
        console.log(`[Main appServices.onPlaybackModeChange] Called with newMode: ${newMode}`);
        if (uiElementsCache.playbackModeToggleBtnGlobal) {
            uiElementsCache.playbackModeToggleBtnGlobal.textContent = newMode === 'timeline' ? 'Mode: Timeline' : 'Mode: Sequencer';
            uiElementsCache.playbackModeToggleBtnGlobal.classList.toggle('active', newMode === 'timeline');
        } else {
            console.warn("[Main appServices.onPlaybackModeChange] Playback mode toggle button not found in UI cache.");
        }
        if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') appServices.renderTimeline();
    },
    openUndoHistoryPanel,
    openSpectrumAnalyzerPanel,
    openBeatSyncedLFOPanel,
    openTempoSyncVisualizerPanel,
    openSnapGridPanel,
    openPhaseCorrelationMeterPanel,
    openTrackColorPalettePanel,
    openTrackColorPanel,
    openTrackRolePanel,
    openAudioClipLabelingPanel,
    isAudioClipLabelingActive,
    applyAudioClipLabelFromExternal,
    getAllAudioClipLabels,
    openMidiFilePanel,
    refreshClipTimeHandles,
    formatTimecode,
    initClipDragClone,
    initTrackNotesSidebar,
    openTrackNotesSidebar,
    getTrackNotesSidebarText,
    setTrackNotesSidebarText,
    removeTrackNotesSidebar,
    initUndoToast,
    fireUndoToast,
    fireRedoToast,
    getUndoToastVersion,
    getTracksByRole,
    getRoleSummary,
    openCountInSettingsPanel,
    openTrackSnapResolutionPanel,
    openTempoSyncLFOPanel,
    openGuitarTabEditor,
    openSamplerLoopTrimPanel,
    openCrossfadeLoopPointsPanel,
    openTunerPanel,
    openLoopPracticeTrainerPanel,
    openTrackNotesPanel,
    openNoteForCurrentTrack,
    openNoteForTrack,
    refreshTrackNoteIndicators,
    openOneShotPreviewPadPanel,
    previewTrackOneShot,
    stopTrackOneShotPreview,
    stopAllOneShotPreviews,
    isTrackPreviewing,
    openBounceToTrackPanel,
    bounceSelectedToTrack,
    isBounceToTrackActive,
    getLastBounceResult,
    openQuickBounceMarkersPanel,
    bounceTrackBetweenMarkers,
    getLastQuickBounce,
    openWaveformVisualizerPanel,
    isWaveformVisualizerActive,
    openDrumKitPieceSelectorPanel,
    isDrumKitPieceSelectorActive,
    getDrumKitPieceList,
    openStepSequencerPatternLibraryPanel,
    isStepSequencerPatternLibraryOpen,
    getDrumPatternList,
    getMelodicPatternList,
    // Track Grouping by Instrument - 5 fixed groups + right-click submenu + dockable panel (v0.4.04)
    openTrackInstrumentGroupingPanel,
    isTrackInstrumentGroupingPanelOpen,
    closeTrackInstrumentGroupingPanel,
    getInstrumentGroups,
    getTracksByInstrumentGroup,
    getInstrumentGroupSummary,
    assignTrackToInstrumentGroup,
    unassignTrackFromInstrumentGroup,
    getInstrumentGroupContextMenuItems,
    openLoudnessMeterPanel,
    isLoudnessMeterActive,
    updateLoudnessMeter,
    resetLoudnessMeterIntegrated,
    // Sends Overview Panel - matrix view of all track → send bus levels
    openSendsOverviewPanel,
    isSendsOverviewPanelActive,
    getSendsOverviewVersion,
    // Project Search - substring search across track names, clip names, and track notes
    openProjectSearchPanel,
    isProjectSearchPanelOpen,
    searchProject,
    // Master Limiter - brick-wall limiter toggle panel
    openMasterLimiterPanel,
    isMasterLimiterEnabled,
    // Master Effects Rack - drag-to-reorder master FX UI (v0.3.81)
    openMasterEffectsRackWindow,
    // Mix-Bus Group Presets - save & re-apply whole-mix state across a set of tracks (v0.3.72)
    initMixBusGroupPresets,
    openMixBusGroupPresetsPanel,
    listMixBusGroupPresets,
    getMixBusGroupPreset,
    captureMixBusGroupPreset,
    applyMixBusGroupPreset,
    deleteMixBusGroupPreset,
    // Performance Mode Recall - save & recall panel-layout snapshots (which panels are open/minimized) as named presets
    initPerformanceModeRecall,
    openPerformanceModeRecallPanel,
    isPerformanceModeRecallPanelOpen,
    getPerformanceModeRecallVersion,
    registerPerformanceModeWindowOpener,
    unregisterPerformanceModeWindowOpener,
    // Master Limiter audio.js accessors — the MasterLimiter.js module calls these
    // to wire/unwire the limiter into the master effect chain (v0.3.65 — Master Limiter feature).
    getMasterLimiterNode,
    setMasterLimiterEnabled,
    setMasterLimiterThresholdDb,
    setMasterLimiterCeilingDb,
    getMasterLimiterReductionDb,
    getMasterLimiterThresholdDb,
    getMasterLimiterCeilingDb,
    audioIsMasterLimiterEnabled: audioIsMasterLimiterEnabledImpl,
    // Toolbar Tooltips - custom hover tooltips for toolbar buttons (v0.3.83)
    setToolbarTooltipsEnabled,
    isToolbarTooltipsEnabled,
    refreshToolbarTooltipTargets,
    // WebAudio Plugin Host - load AudioWorklet processors (VST-style plugins) by URL
    openWebAudioPluginHostPanel,
    initWebAudioPluginHost,
    loadWorkletPlugin,
    removeWorkletPlugin,
    bypassWorkletPlugin,
    setWorkletParam,
    getLoadedWorkletPlugins,
    isWorkletPluginLoaded,
    // Loudness Meter master-meter shims: the meter module expects a stereo [L,R] dB array
    // and a Web Audio tap node. The SnugOS master bus uses a single mono Tone.Meter, so
    // we duplicate the mono dB value across both channels and expose the Tone.Meter node
    // itself as the tap (Tone nodes can connect to raw AnalyserNodes).
    getMasterMeterValue: () => {
        try {
            const node = typeof getMasterMeterNode === 'function' ? getMasterMeterNode() : null;
            if (!node || node.disposed || typeof node.getValue !== 'function') return null;
            const v = node.getValue();
            const db = Array.isArray(v) ? (v.length > 1 ? v[1] : v[0]) : v;
            return [db, db];
        } catch (e) { return null; }
    },
    getMasterMeterTap: () => {
        try {
            return typeof getMasterMeterNode === 'function' ? getMasterMeterNode() : null;
        } catch (e) { return null; }
    },
    // --- Master effects state passthrough ---
    // v0.3.81 ships the Master Effects Rack UI and the audio chain
    // (rebuildMasterEffectChain in audio.js) but never wired the state getter
    // onto appServices. As a result every consumer site that reads
    // `localAppServices.getMasterEffects?.()` or
    // `localAppServices.getMasterEffectsState?.()` silently no-ops — the UI
    // always renders "No master effects yet" and adding a master effect
    // updates the state store but never rebuilds the audio chain. Both keys
    // are exposed so callers using either name (`getMasterEffects` in
    // PresetMorphing.js / audio.js / eventHandlers.js; `getMasterEffectsState`
    // in MasterEffectsRack.js / ui.js) resolve to the same state array.
    getMasterEffects: () => {
        try {
            const arr = typeof getMasterEffectsState === 'function' ? getMasterEffectsState() : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            console.warn('[appServices.getMasterEffects] Error reading state:', e);
            return [];
        }
    },
    getMasterEffectsState: () => {
        try {
            const arr = typeof getMasterEffectsState === 'function' ? getMasterEffectsState() : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            console.warn('[appServices.getMasterEffectsState] Error reading state:', e);
            return [];
        }
    },
    openDuplicateOffsetDialog,
    openTrackIconPickerPanel,
    openChordVoicingPanel,
    openChordTriggerPanel,
    openGhostTrailsPanel,
    openGhostSignalsPanel,
    openDrumReplacePanel,
    openDrumPatternSplitterPanel,
    openClipOpacityPanel,
    openClipFadePresetsPanel,
    openClipVolumeCurvePresetsPanel, // v0.4.01
    openClipFadeHandlesPanel,
    openStretchMarkersPanel,
    openPitchDriftCorrectionPanel,
    openTempoRamperPanel,
    openTempoRamperVisual,
    openLoopRegionQuickSetSettings,
    openLoopRegionMarkersPanel,
    openLoopRegionPresetsPanel,
    openLoopSnapPanel,
    openLoopUntilMarkerPanel,
    extendLoopToNextMarker,
    extendLoopToPreviousMarker,
    extendLoopToBothMarkers,
    setLoopUntilMarkerAutoEnabled,
    isLoopUntilMarkerAutoEnabled,
    refreshLoopLengthDisplay,
    refreshMIDIActivityLog,
    setMIDIActivityLogVisible,
    toggleMIDIActivityLog,
    openGrooveExtractorPanel,
    openSmartFXChainPanel,
    openTrackDelayCompensationPanel,
    openLatencyCompensationPanel,
    openLyricsTrackPanel,
    openMixerChannelStripPresetsPanel,
    openTrackEffectPresetsPanel,
    openTrackMuteAutomationPanel,
    openTrackVelocityCurvePanel,
    openExportSelectionPanel,
    openTimeSignaturePanel,
    toggleClipLoopPreview,
    deactivateClipLoopPreview,
    isClipInLoopPreview,
    openMidiMappingsPanel,
    openExportPresetsPanel,
    openAICompositionPanel,
    // New Feature Panels
    openRandomPatternGeneratorPanel,
    openCpuMonitorPanel,
    openKeyBindingsPanel,
    openKeyboardShortcutsPanel,
    openProjectNotesPanel,
    openDrumMapEditorPanel,
    openTimelineMarkersPanel,
    openPlayheadMarkerDropSettings,
    openTimelineRulerClickSettings,
    openGroupEditPanel,
    
    // Pattern Chains
    openPatternChainsPanel,
    
    // Quick Rename & Auto-Naming
    openQuickRenamePanel,
    initQuickRename,
    ProjectAutoNaming,
    
    // Micro Tuning
    getMicroTuningEnabled, setMicroTuningEnabled, getMicroTuningPreset, setMicroTuningPreset,
    getMicroTuningCents, setMicroTuningCents, getMicroTuningRootNote, setMicroTuningRootNote,
    getMicroTuningPresets, getMicroTuningPresetById, midiNoteToFrequencyWithMicroTuning, getMicroTuningFrequencyRatio,
    openMicroTuningPanel,
    
    // Track Templates
    getTrackTemplatesState, saveTrackTemplate, getTrackTemplate, getTrackTemplateNames, deleteTrackTemplate, applyTrackTemplate, renameTrackTemplate,
    
    // Instrument Rack
    openInstrumentRackPanel,
    updateInstrumentRackPanel,
    openMIDIChordPlayerPanel,

    // EQ Preset Library
    openEQPresetLibraryPanel,
    
    // Effect Panels - Session 2026-04-24
    openTubeSaturationPanel,
    openMultibandGatePanel,
    openTransientModulatorPanel,
    openStereoWidthControllerPanel,
    openDynamicResonanceFilterPanel,
    openVocalDoublerPanel,
    
    // New Effect Panels - Session 2026-04-24 (continued)
    openSpectralCompressorPanel,
    openHarmonicSynthesizerPanel,
    openDynamicEQPanel,
    openStereoImagerEnhancementPanel,
    openMultibandSaturatorPanel,
    openAutoPannerPanel,
    
    // New Effect Panels - Session 2026-04-24 (additional)
    openGranularProcessorPanel,
    openConvolutionReverbPanel,
    openFormantFilterPanel,
    openRingModulatorPanel,
    openFrequencyShifterPanel,
    openEnvelopeGeneratorPanel,
    
    
    // Performance & Workflow - Session 2026-04-26
    openPerformanceTriggerPadsPanel,
    getPerformanceTriggerPads,
    openTrackHeadphoneMixPanel,
    openTrackDelayCompensationPanel,
    openLatencyCompensationPanel,
    openGrooveExtractorPanel,
    openStepSequencerView,
    openPianoRollEditor,
    snapSelectedNotesToScale,
    updatePianoRollPanel,
    openPitchBendEditor,
    getPianoRollPitchBendWindow,
    openMidiVelocityEditorPanel,
    setSelectedNotesVelocity,
    applyVelocityRamp,
    applyVelocityRandom,
    openCCStepSequencer,
    openClipGainPanel,
    getCCPatternData,
    setCCPatternData,
    openScaleHighlightPanel,
    openScaleHighlightGlobalPanel,
    openRhythmRandomizerPanel,
    
    // Audio Recording
    initAudioRecorder,
    startRecording,
    stopRecording,
    isRecordingActive,
    requestMicAccess,
    getRecordingStatus,
    cleanupRecording,
    openAudioRecordingPanel,
    
    // Bounce Selected to Audio
    initBounceSelectedToAudio,
    bounceSelectedClipsToAudio,
    openBounceDialog,

    // Quick Bounce
    initQuickBounce,
    quickBounce,

    // Keyboard Octave Shift
    initKeyboardOctaveShift,
    getCurrentOctaveShift,
    setOctaveShift,
    resetOctaveShift,
    
    // Timeline Zoom Memory
    initTimelineZoomMemory,
    getStoredZoom,
    saveZoom,

    // Pattern Generation and Frequency Processing
    AIPatternGenerator,
    getAIPatternGenerator,
    openAIPatternGeneratorPanel,
    FrequencyBandSplitter,
    MultibandProcessor,
    getFrequencyBandSplitter,
    openFrequencyBandSplitterPanel,
    // AI Mastering Enhancement
    AIMasteringEnhancement,
    initAIMasteringEnhancement,
    openAIMasteringEnhancementPanel,
    
    // Audio Stem Export Enhancement
    AudioStemExportEnhancement,
    initAudioStemExportEnhancement,
    openAudioStemExportEnhancementPanel,
    
    // MIDI Pattern Variation Enhancement
    MIDIPatternVariationEnhancement,
    initMIDIPatternVariationEnhancement,
    openMIDIPatternVariationEnhancementPanel,
    
    // Plugin Preset Browser
    PluginPresetBrowser,
    initPluginPresetBrowser,
    openPluginPresetBrowserPanel,

    // Video Export Enhancement
    initVideoExportEnhancement,
    openVideoExportPanel,

    // Cloud Sync Enhancement
    initCloudSyncEnhancement,
    openCloudSyncPanel,
    
    // Notation Export Enhancement
    initNotationExportEnhancement,
    openNotationExportPanel,
    
    // Audio Restoration Suite
    initAudioRestorationSuite,
    openAudioRestorationPanel,
    
    // MIDI Guitar Support
    initMIDIGuitarSupport,
    openMIDIGuitarPanel,
    
    // Spatial Audio Panning
    initSpatialAudioPanning,
    openSpatialAudioPanel,

    // MIDI Learn Wizard
    openMIDILearnWizard,
    openMIDILearnPresetsPanel,

    // Collaboration Session Recording
    CollaborationSessionRecording,
    collaborationSessionRecording,
    initCollaborationSessionRecording,
    openCollaborationSessionPanel,
    
    // AI Mixing Suggestions
    AIMixingSuggestions,
    aiMixingSuggestions,
    initAIMixingSuggestions,
    openAICompositionPanel,
    
    // AI Tempo Suggestion
    AITempoSuggestion,
    initAITempoSuggestion,
    openAITempoSuggestionPanel,
    
    // Frequency Spectrum Matching
    FrequencySpectrumMatching,
    frequencySpectrumMatching,
    initFrequencySpectrumMatching,
    openFrequencySpectrumMatchingPanel,
    
    // Smart Track Grouping
    SmartTrackGrouping,
    smartTrackGrouping,
    initSmartTrackGrouping,
    openSmartTrackGroupingPanel,
    
    // Audio Event Detection
    AudioEventDetection,
    audioEventDetection,
    initAudioEventDetection,
    openAudioEventDetectionPanel,
    
    // Cross-Track Pitch Analysis
    CrossTrackPitchAnalysis,
    crossTrackPitchAnalysis,
    initCrossTrackPitchAnalysis,
    openCrossTrackPitchAnalysisPanel,

    // AI Composition Variations
    initAICompositionVariations,
    openAICompositionVariationsPanel,
    
    // Harmonic Analysis Engine
    initHarmonicAnalysisEngine,
    openHarmonicAnalysisPanel,
    
    // Audio Stem Separation
    initAudioStemSeparation,
    openAudioStemSeparationPanel,
    
    // Audio Tap Tempo
    openAudioTapTempoPanel,
    
    // Audio Normalizer
    openAudioNormalizerPanel,
    
    // Audio Stretch Quality
    openAudioStretchQualityPanel,
    
    // MIDI Arpeggiator
    openMIDArpeggiatorPanel,
    
    // Track Template Library
    openTrackTemplateLibraryPanel,
    
    // Clip Envelope Shaper
    showClipEnvelopeShaper,
    
    // Audio Phase Flip
    flipAudioBufferPhase,
    toggleClipPhaseFlip,
    isClipPhaseInverted,
    openAudioPhaseFlipPanel,
    
    // Audio Waveform Annotation
    openAnnotationPanel,
    addAnnotation,
    getAnnotations,
    renderAnnotationMarkers,
    
    // Clip Reverse
    openClipReversePanel,
    openQuickVolumeRampPanel,
    reverseAudioClip,
    reverseMIDISequence,
    isClipReversed,
    isSequenceReversed,
    
    // Sidechain Volume Envelope
    openSidechainVolumeEnvelopePanel,
    getSidechainEnvelope,
    
    // Sidechain Visualizer
    openSidechainVisualizerPanel,
    
    // Track Solo Chain
    enableSoloChain,
    disableSoloChain,
    toggleTrackInChain,
    clearChain,
    getSoloedTrackIds,
    getIsActive,
    openSoloChainPanel,
    
    // Beat Detective
    openBeatDetectivePanel,
    
    // MIDI to Audio Conversion
    initMIDIToAudioConversion,
    openMIDIToAudioPanel,
    
    // Smart FX Chain
    initSmartFXChain,
    openSmartFXChainPanel,

    // Sample Library Browser
    openSampleLibraryBrowserPanel,

    // Project Statistics
    openProjectStatisticsPanel,

    // AI Music Generation
    DrumPatternGenerator,
    initDrumPatternGenerator,
    getDrumGenerator,
    generateDrumPattern,
    DRUM_STYLES,
    MelodyGenerator,
    initMelodyGenerator,
    getMelodyGenerator,
    generateMelody,
    MELODY_STYLES,
    MELODY_MOODS,

    // FeatureAdditions exports
    ...FeatureAdditions,
    openSmartQuantizePanel,
    
    // Enhancement modules exports
    smartQuantizeEnhance: window.smartQuantizeEnhance,
    applyQuantizeStylePreset: window.applyQuantizeStylePreset,
    getQuantizeStylePresets: window.getQuantizeStylePresets,
    getQuantizeModes: window.getQuantizeModes,
    createCustomQuantizeTemplate: window.createCustomQuantizeTemplate,
    smartQuantizeEnhanceState: window.smartQuantizeEnhanceState,
    
    exportVisualizationImage: window.exportVisualizationImage,
    exportVisualizationSVG: window.exportVisualizationSVG,
    startVisualizationRecording: window.startVisualizationRecording,
    captureVisualizationFrame: window.captureVisualizationFrame,
    stopVisualizationRecording: window.stopVisualizationRecording,
    exportVisualizationWithWatermark: window.exportVisualizationWithWatermark,
    batchExportVisualization: window.batchExportVisualization,
    getExportFormats: window.getExportFormats,
    getQualityPresets: window.getQualityPresets,
    vizExportState: window.vizExportState,
    
    startPerformanceRecording: window.startPerformanceRecording,
    stopPerformanceRecording: window.stopPerformanceRecording,
    recordPerformanceEvent: window.recordPerformanceEvent,
    playPerformanceRecording: window.playPerformanceRecording,
    stopPerformancePlayback: window.stopPerformancePlayback,
    pausePerformancePlayback: window.pausePerformancePlayback,
    resumePerformancePlayback: window.resumePerformancePlayback,
    setPerformancePlaybackSpeed: window.setPerformancePlaybackSpeed,
    setPerformancePlaybackLoop: window.setPerformancePlaybackLoop,
    seekPerformancePlayback: window.seekPerformancePlayback,
    savePerformanceRecording: window.savePerformanceRecording,
    loadPerformanceRecording: window.loadPerformanceRecording,
    deletePerformanceRecording: window.deletePerformanceRecording,
    getPerformanceRecordings: window.getPerformanceRecordings,
    getPerformanceRecordingDetails: window.getPerformanceRecordingDetails,
    perfRecordState: window.perfRecordState,
    
    createClipAutomation: window.createClipAutomation,
    addAutomationPoint: window.addAutomationPoint,
    removeAutomationPoint: window.removeAutomationPoint,
    moveAutomationPoint: window.moveAutomationPoint,
    getAutomationValue: window.getAutomationValue,
    applyCurvePreset: window.applyCurvePreset,
    generateCurveAutomation: window.generateCurveAutomation,
    copyAutomation: window.copyAutomation,
    clearAutomation: window.clearAutomation,
    toggleAutomation: window.toggleAutomation,
    getAutomationCurve: window.getAutomationCurve,
    exportAutomation: window.exportAutomation,
    importAutomation: window.importAutomation,
    getAutomationTypes: window.getAutomationTypes,
    getCurvePresets: window.getCurvePresets,
    clipAutomationState: window.clipAutomationState,
    
    createTrackGroup: window.createTrackGroup,
    deleteTrackGroup: window.deleteTrackGroup,
    addTrackToGroup: window.addTrackToGroup,
    removeTrackFromGroup: window.removeTrackFromGroup,
    getTrackGroup: window.getTrackGroup,
    getGroupAncestry: window.getGroupAncestry,
    getGroupDescendants: window.getGroupDescendants,
    getAllGroupTracks: window.getAllGroupTracks,
    setGroupMute: window.setGroupMute,
    setGroupSolo: window.setGroupSolo,
    setGroupVolume: window.setGroupVolume,
    setGroupPan: window.setGroupPan,
    toggleGroupCollapse: window.toggleGroupCollapse,
    setGroupLinked: window.setGroupLinked,
    setGroupColor: window.setGroupColor,
    renameGroup: window.renameGroup,
    updateTrackGroup: window.updateTrackGroup,
    moveGroup: window.moveGroup,
    duplicateGroup: window.duplicateGroup,
    getGroupHierarchy: window.getGroupHierarchy,
    getAllGroups: window.getAllGroups,
    getGroupById: window.getGroupById,
    getGroupDepth: window.getGroupDepth,
    exportGroups: window.exportGroups,
    importGroups: window.importGroups,
    nestedGroupState: window.nestedGroupState,
    
    setStepProbability: window.setStepProbability,
    getEffectiveProbability: window.getEffectiveProbability,
    shouldStepPlay: window.shouldStepPlay,
    createConditionalRule: window.createConditionalRule,
    applyProbabilityPreset: window.applyProbabilityPreset,
    clearAllProbabilities: window.clearAllProbabilities,
    getProbabilityStatistics: window.getProbabilityStatistics,
    getConditionalRules: window.getConditionalRules,
    deleteConditionalRule: window.deleteConditionalRule,
    toggleConditionalRule: window.toggleConditionalRule,
    getRuleTypes: window.getRuleTypes,
    getProbabilityPresets: window.getProbabilityPresets,
    exportProbabilitySettings: window.exportProbabilitySettings,
    importProbabilitySettings: window.importProbabilitySettings,
    conditionalProbState: window.conditionalProbState,
    
    setComparisonSourceA: window.setComparisonSourceA,
    setComparisonSourceB: window.setComparisonSourceB,
    analyzeSourceSpectrum: window.analyzeSourceSpectrum,
    performSpectrumComparison: window.performSpectrumComparison,
    setComparisonMode: window.setComparisonMode,
    generateComparisonReport: window.generateComparisonReport,
    selectComparisonBand: window.selectComparisonBand,
    exportComparisonImage: window.exportComparisonImage,
    exportComparisonData: window.exportComparisonData,
    importComparisonSettings: window.importComparisonSettings,
    resetComparison: window.resetComparison,
    getComparisonModes: window.getComparisonModes,
    getFrequencyBands: window.getFrequencyBands,
    setComparisonFFTSize: window.setComparisonFFTSize,
    startContinuousComparison: window.startContinuousComparison,
    stopContinuousComparison: window.stopContinuousComparison,
    spectrumCompareState: window.spectrumCompareState,
    
    initEnhancedMIDIMonitor: window.initEnhancedMIDIMonitor,
    getAvailableInputs: window.getAvailableInputs,
    getAvailableOutputs: window.getAvailableOutputs,
    connectMIDIInput: window.connectMIDIInput,
    connectMIDIOutput: window.connectMIDIOutput,
    startMIDIMonitoring: window.startMIDIMonitoring,
    stopMIDIMonitoring: window.stopMIDIMonitoring,
    pauseMIDIMonitoring: window.pauseMIDIMonitoring,
    resumeMIDIMonitoring: window.resumeMIDIMonitoring,
    clearMIDIMessageLog: window.clearMIDIMessageLog,
    resetMIDIStatistics: window.resetMIDIStatistics,
    exportMIDIMessageLog: window.exportMIDIMessageLog,
    setMessageTypeFilter: window.setMessageTypeFilter,
    setChannelFilter: window.setChannelFilter,
    getMIDIMessageLog: window.getMIDIMessageLog,
    getMIDIStatistics: window.getMIDIStatistics,
    getMIDIFilters: window.getMIDIFilters,
    getMIDITransforms: window.getMIDITransforms,
    setMIDITransform: window.setMIDITransform,
    midiMonitorEnhanceState: window.midiMonitorEnhanceState,

    addNewTrack: async (type = "Synth", options = {}) => {
        try {
            const track = await addTrackToStateInternal(type, null, true);
            if (track && options.color) {
                track.color = options.color;
            }
            if (track && typeof renderTracks === "function") renderTracks();
            if (track && typeof renderTimeline === "function") renderTimeline();
            console.log("[Main addNewTrack] Created track:", track?.name);
            return track;
        } catch (error) {
            console.error("[Main addNewTrack] Error:", error);
            return null;
        }
    },

    triggerCustomBackgroundUpload: () => {
        if (uiElementsCache.customBgInput) uiElementsCache.customBgInput.click();
        else console.warn("Custom background input element not found in cache.");
    },
};

window.removeCustomDesktopBackground = appServices.removeCustomDesktopBackground;

// Keyboard shortcut: Ctrl/Cmd+Shift+B triggers custom background upload
if (typeof window !== 'undefined' && !window.__snawCustomBgShortcutBound) {
    window.__snawCustomBgShortcutBound = true;
    window.addEventListener('keydown', (e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            e.preventDefault();
            if (typeof appServices.triggerCustomBackgroundUpload === 'function') {
                appServices.triggerCustomBackgroundUpload();
            }
        }
    });
}

// Keyboard shortcut: Ctrl/Cmd+Alt+Shift+B removes the custom desktop background (v0.3.73)
if (typeof window !== 'undefined' && !window.__snawRemoveCustomBgShortcutBound) {
    window.__snawRemoveCustomBgShortcutBound = true;
    window.addEventListener('keydown', (e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && e.altKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            e.preventDefault();
            try {
                if (typeof appServices.removeCustomDesktopBackground === 'function') {
                    appServices.removeCustomDesktopBackground();
                } else if (typeof window.removeCustomDesktopBackground === 'function') {
                    window.removeCustomDesktopBackground();
                }
            } catch (err) {
                console.error('[snaw] Failed to remove custom background via shortcut:', err);
            }
        }
    });
}

async function handleCustomBackgroundUpload(event) {
    if (!event?.target?.files?.[0]) return;
    const file = event.target.files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
        if (typeof showSafeNotification === 'function') showSafeNotification("Invalid file type. Please select an image or video.", 3000);
        return;
    }

    const MAX_BG_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_BG_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (typeof showSafeNotification === 'function') showSafeNotification(`Background too large (${sizeMB} MB). Max 50 MB.`, 4000);
        return;
    }
    
    try {
        if (isImage) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataURL = e.target.result;
                // Try localStorage first (legacy / small images). If the encoded data:
                // URL is too big for the origin's localStorage quota, fall back to IDB
                // via bgDb (same path the video branch uses). This makes large wallpapers
                // (~4K JPG/PNG) work without a confusing "Could not save background" error.
                const probeKey = '__snugosDesktopBgProbe__';
                let usedFallback = false;
                try {
                    localStorage.setItem(probeKey, dataURL);
                    localStorage.removeItem(probeKey);
                    localStorage.setItem('snugosDesktopBackground', dataURL);
                    localStorage.setItem('snugosDesktopBgType', 'image');
                    // Defensive: revoke any prior image object URL (data: URLs aren't
                    // revokable but blob: ones are — matches the video path's hygiene).
                    if (currentDesktopImageObjectUrl) {
                        try { URL.revokeObjectURL(currentDesktopImageObjectUrl); } catch (_) {}
                        currentDesktopImageObjectUrl = null;
                    }
                } catch (quotaErr) {
                    // QuotaExceededError (or any other localStorage failure): fall through
                    // to IDB. We still keep a tiny marker in localStorage so legacy code
                    // can tell there *was* an image bg; the actual bytes live in bgDb.
                    usedFallback = true;
                    try {
                        if (currentDesktopImageObjectUrl) {
                            try { URL.revokeObjectURL(currentDesktopImageObjectUrl); } catch (_) {}
                            currentDesktopImageObjectUrl = null;
                        }
                        await bgDb.save('desktopImage', file);
                        const objectUrl = URL.createObjectURL(file);
                        currentDesktopImageObjectUrl = objectUrl;
                        localStorage.setItem('snugosDesktopBgType', 'image');
                        localStorage.setItem('snugosDesktopBackground', objectUrl);
                        await applyDesktopBackground(objectUrl, 'image');
                        if (typeof showSafeNotification === 'function') {
                            showSafeNotification("Image background applied (IDB fallback).", 2000);
                        }
                        if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
                        return;
                    } catch (idbErr) {
                        console.error("[bg upload] IDB fallback for image also failed:", idbErr);
                        if (typeof showSafeNotification === 'function') {
                            showSafeNotification("Could not save image background: " + idbErr.message, 4000);
                        }
                        return;
                    }
                }
                await applyDesktopBackground(dataURL, 'image');
                if (typeof showSafeNotification === 'function' && !usedFallback) {
                    showSafeNotification("Image background applied.", 2000);
                }
                if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
            };
            reader.readAsDataURL(file);
        } else if (isVideo) {
            if (typeof showSafeNotification === 'function') showSafeNotification("Processing video background...", 2000);
            await bgDb.save('desktopVideo', file);
            localStorage.setItem('snugosDesktopBgType', 'video');
            localStorage.removeItem('snugosDesktopBackground');
            // Defensive: revoke any previously-issued desktop-video object URL so the
            // prior video Blob isn't pinned in memory for the lifetime of the page.
            // Each upload creates a fresh Blob; without this, repeated uploads leak
            // one Blob per upload until the tab is closed.
            if (currentDesktopVideoObjectUrl) {
                try { URL.revokeObjectURL(currentDesktopVideoObjectUrl); } catch (_) { /* ignore */ }
                currentDesktopVideoObjectUrl = null;
            }
            currentDesktopVideoObjectUrl = URL.createObjectURL(file);
            await applyDesktopBackground(currentDesktopVideoObjectUrl, 'video');
            if (typeof showSafeNotification === 'function') showSafeNotification("Video background applied.", 2000);
            if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
        }
    } catch (error) {
        console.error("Error saving background:", error);
        if (typeof showSafeNotification === 'function') showSafeNotification("Could not save background: " + error.message, 4000);
    }
    
    if (event.target) event.target.value = null;
}

function handleTrackUIUpdate(trackId, reason, detail) {
    if (!getTrackByIdState) { console.warn("[Main UI Update] getTrackByIdState service not available."); return; }
    const track = getTrackByIdState(trackId);
    if (!track) {
        console.warn(`[Main UI Update] Track ${trackId} not found for reason: ${reason}`);
        return;
    }

    const getOpenWindowElement = (winId) => {
        if (!getWindowByIdState) return null;
        const win = getWindowByIdState(winId);
        return (win?.element && !win.isMinimized) ? win.element : null;
    };

    const inspectorElement = getOpenWindowElement(`trackInspector-${trackId}`);
    const effectsRackElement = getOpenWindowElement(`effectsRack-${trackId}`);
    const sequencerElement = getOpenWindowElement(`sequencerWin-${trackId}`);
    const mixerElement = getOpenWindowElement('mixer');

    try {
        switch(reason) {
            case 'muteChanged':
            case 'soloChanged':
            case 'armChanged':
                if (inspectorElement) {
                    const muteBtn = inspectorElement.querySelector(`#muteBtn-${track.id}`);
                    if (muteBtn) muteBtn.classList.toggle('muted', track.isMuted);
                    const soloBtn = inspectorElement.querySelector(`#soloBtn-${track.id}`);
                    if (soloBtn) soloBtn.classList.toggle('soloed', getSoloedTrackIdState() === track.id);
                    const armBtn = inspectorElement.querySelector(`#armInputBtn-${track.id}`);
                    if (armBtn) armBtn.classList.toggle('armed', getArmedTrackIdState() === track.id);
                }
                if (mixerElement && typeof updateMixerWindow === 'function') updateMixerWindow();
                break;
            case 'effectsListChanged':
                 if (effectsRackElement && typeof renderEffectsList === 'function') {
                    const listDiv = effectsRackElement.querySelector(`#effectsList-${track.id}`);
                    const controlsContainer = effectsRackElement.querySelector(`#effectControlsContainer-${track.id}`);
                    if (listDiv && controlsContainer) renderEffectsList(track, 'track', listDiv, controlsContainer);
                 }
                break;
            case 'effectsBypassChanged':
                // Re-render the mixer so the per-track B button reflects the new state.
                if (mixerElement && typeof updateMixerWindow === 'function') updateMixerWindow();
                if (typeof showSafeNotification === 'function') {
                    const label = (track.getEffectsBypassed && track.getEffectsBypassed()) ? 'bypassed (dry)' : 're-enabled (wet)';
                    showSafeNotification(`Effects ${label} on "${track.name}"`, 1500);
                }
                break;
            case 'midiChannelChanged':
                // (v0.3.93) Repaint the mixer so the per-track MIDI channel
                // badge updates in place. The badge lives in the same
                // track-strip HTML that updateMixerWindow re-renders, so
                // calling it is enough — the badge pulls the new value
                // from track.midiChannel on the next render.
                if (mixerElement && typeof updateMixerWindow === 'function') updateMixerWindow();
                if (typeof showSafeNotification === 'function') {
                    const ch = (track.midiChannel === 0) ? 'Omni' : `Ch ${track.midiChannel}`;
                    showSafeNotification(`"${track.name}" MIDI channel: ${ch}`, 1500);
                }
                break;
            case 'groovePresetChanged':
                // (v0.3.94) Repaint the mixer so the per-track Groove
                // badge updates in place. Mirrors the 'midiChannelChanged'
                // case above. The notification reads the new groove preset
                // directly from track.groovePreset so it stays accurate
                // even if the getter returns a different short label.
                if (mixerElement && typeof updateMixerWindow === 'function') updateMixerWindow();
                if (typeof showSafeNotification === 'function') {
                    const preset = track.getGroovePreset ? track.getGroovePreset() : (track.groovePreset || 'none');
                    const presets = (typeof appServices !== 'undefined' && appServices.getGroovePresets)
                        ? appServices.getGroovePresets()
                        : [];
                    const match = presets.find(p => p.id === preset);
                    const label = match ? match.name : (preset === 'none' ? 'None (Straight)' : preset);
                    showSafeNotification(`"${track.name}" groove: ${label}`, 1500);
                }
                break;
            case 'samplerLoaded':
            case 'instrumentSamplerLoaded':
                if (inspectorElement) {
                    if (track.type === 'Sampler' && typeof drawWaveform === 'function' && typeof renderSamplePads === 'function' && typeof updateSliceEditorUI === 'function') {
                        drawWaveform(track); renderSamplePads(track); updateSliceEditorUI(track);
                    } else if (track.type === 'InstrumentSampler' && typeof drawInstrumentWaveform === 'function') {
                        drawInstrumentWaveform(track);
                    }
                    const dzKey = track.type === 'Sampler' ? 'sampler' : 'instrumentsampler';
                    const dzContainer = inspectorElement.querySelector(`#dropZoneContainer-${track.id}-${dzKey}`);
                    const fileInputEl = dzContainer.querySelector(`#fileInput-${track.id}`);
                    const loadFn = appServices.loadSampleFile;
                    if (fileInputEl && loadFn) fileInputEl.onchange = (e) => loadFn(e, track.id, track.type);
                    const newDropZoneDiv = dzContainer.querySelector('.drop-zone');
                    if (newDropZoneDiv && typeof setupGenericDropZoneListeners === 'function') {
                        setupGenericDropZoneListeners(newDropZoneDiv, track.id, track.type, null, appServices.loadSoundFromBrowserToTarget, loadFn, appServices.getTrackById);
                    }
                }
                break;
            case 'drumPadLoaded':
                 if (inspectorElement && typeof updateDrumPadControlsUI === 'function' && typeof renderDrumSamplerPads === 'function') {
                    updateDrumPadControlsUI(track); renderDrumSamplerPads(track);
                 }
                break;
            case 'sequencerContentChanged':
                if (sequencerElement && typeof openTrackSequencerWindow === 'function') {
                    const seqWinInstance = getWindowByIdState(`sequencerWin-${trackId}`);
                    if(seqWinInstance) openTrackSequencerWindow(trackId, true, seqWinInstance.options);
                }
                if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') appServices.renderTimeline();
                break;
            case 'sampleLoadError':
                if (inspectorElement) {
                    console.warn(`[Main UI Update] sampleLoadError for track ${trackId}, detail: ${detail}. Inspector UI update for dropzone needed.`);
                    if (track.type === 'DrumSampler' && typeof detail === 'number' && typeof updateDrumPadControlsUI === 'function') {
                        updateDrumPadControlsUI(track); 
                    } else if ((track.type === 'Sampler' || track.type === 'InstrumentSampler')) {
                        const dzKey = track.type === 'Sampler' ? 'sampler' : 'instrumentsampler';
                        const dzContainer = inspectorElement.querySelector(`#dropZoneContainer-${track.id}-${dzKey}`);
                        const audioDataSource = track.type === 'Sampler' ? track.samplerAudioData : track.instrumentSamplerSettings;
                        const inputIdForError = track.type === 'Sampler' ? `fileInput-${track.id}` : `instrumentFileInput-${track.id}`;

                        if(dzContainer && audioDataSource) {
                            dzContainer.innerHTML = createDropZoneHTML(track.id, inputIdForError, track.type, null, {originalFileName: audioDataSource.fileName, status: 'error'});
                            const fileInputEl = dzContainer.querySelector(`#${inputIdForError}`);
                            const loadFn = appServices.loadSampleFile;
                            if (fileInputEl && loadFn) fileInputEl.onchange = (e) => loadFn(e, track.id, track.type);
                            const newDropZoneDiv = dzContainer.querySelector('.drop-zone');
                            if (newDropZoneDiv && typeof setupGenericDropZoneListeners === 'function') {
                               setupGenericDropZoneListeners(newDropZoneDiv, track.id, track.type, null, appServices.loadSoundFromBrowserToTarget, loadFn, appServices.getTrackById);
                            }
                        }
                    }
                }
                break;
            case 'trackRendered':
            case 'trackHeaderRendered':
                try {
                    if (typeof refreshTrackNoteIndicators === 'function') refreshTrackNoteIndicators();
                } catch (e) { console.warn('[TrackNotes] refresh failed:', e); }
                try {
                    if (typeof tfCrossfadeHeaderRendered === 'function') tfCrossfadeHeaderRendered(trackId);
                } catch (e) { console.warn('[TrackFreezeCrossfade] header render failed:', e); }
                break;
            default:
                console.warn(`[Main UI Update] Unhandled reason: ${reason} for track ${trackId}`);
        }
    } catch (error) {
        console.error(`[Main handleTrackUIUpdate] Error updating UI for track ${trackId}, reason ${reason}:`, error);
    }
}


console.log('[SnugOS] main.js loaded - version', Constants.APP_VERSION);
async function initializeSnugOS() {
    console.log("[Main initializeSnugOS] Initializing SnugOS...");

    try {
        // Cache UI elements - including the fixed global controls bar
        Object.keys(uiElementsCache).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                 uiElementsCache[key] = element;
            } else {
                if (['desktop', 'taskbar', 'notification-area', 'modal-container'].includes(key)) {
                    console.warn(`[Main initializeSnugOS] Critical UI Element ID "${key}" not found in DOM.`);
                }
            }
        });

        // The global controls are now in a fixed bar, not a window
        // Wire them up directly
        const globalElements = {
            playBtnGlobal: document.getElementById('playBtnGlobal'),
            recordBtnGlobal: document.getElementById('recordBtnGlobal'),
            stopBtnGlobal: document.getElementById('stopBtnGlobal'),
            panicBtnGlobal: document.getElementById('panicBtnGlobal'),
            tempoGlobalInput: document.getElementById('tempoGlobalInput'),
            quickMarkerBtnGlobal: document.getElementById('quickMarkerBtnGlobal'),
            midiInputSelectGlobal: document.getElementById('midiInputSelectGlobal'),
            midiOutputSelectGlobal: document.getElementById('midiOutputSelectGlobal'),
            masterMeterContainerGlobal: document.getElementById('masterMeterContainerGlobal'),
            masterMeterBarGlobal: document.getElementById('masterMeterBarGlobal'),
            midiIndicatorGlobal: document.getElementById('midiIndicatorGlobal'),
            keyboardIndicatorGlobal: document.getElementById('keyboardIndicatorGlobal'),
            playbackModeToggleBtnGlobal: document.getElementById('playbackModeToggleBtnGlobal'),
            metronomeToggleBtnGlobal: document.getElementById('metronomeToggleBtnGlobal'),
            metronomeVolumeSlider: document.getElementById('metronomeVolumeSlider'),
            metronomeVolumeDisplay: document.getElementById('metronomeVolumeDisplay'),
            metronomeVolumeControl: document.getElementById('metronomeVolumeControl'),
            beatLfoToggleBtnGlobal: document.getElementById('beatLfoToggleBtnGlobal'),
            performanceMonitorBtn: document.getElementById('performanceMonitorBtn'),
            stretchQualityBtn: document.getElementById('stretchQualityBtn'),
            scaleSelectGlobal: document.getElementById('scaleSelectGlobal'),
            keySelectGlobal: document.getElementById('keySelectGlobal'),
            scaleNotesDisplay: document.getElementById('scaleNotesDisplay'),
            customBgInput: document.getElementById('customBgInput')
        };
        
        // Add to cache
        Object.assign(uiElementsCache, globalElements);
        
        console.log("[Main initializeSnugOS] Global controls bar elements cached:", Object.keys(globalElements).filter(k => globalElements[k]));

        try {
            const effectsRegistry = await import('./effectsRegistry.js');
            if (appServices.effectsRegistryAccess) {
                appServices.effectsRegistryAccess.AVAILABLE_EFFECTS = effectsRegistry.AVAILABLE_EFFECTS || {};
                appServices.effectsRegistryAccess.getEffectParamDefinitions = effectsRegistry.getEffectParamDefinitions || (() => []);
                appServices.effectsRegistryAccess.getEffectDefaultParams = effectsRegistry.getEffectDefaultParams || (() => ({}));
                appServices.effectsRegistryAccess.createEffectInstance = effectsRegistry.createEffectInstance || null;
                appServices.effectsRegistryAccess.synthEngineControlDefinitions = effectsRegistry.synthEngineControlDefinitions || {};
                console.log("[Main initializeSnugOS] Effects registry dynamically imported and assigned.");
            } else {
                console.error("[Main initializeSnugOS] appServices.effectsRegistryAccess is not defined before assigning registry.");
            }
        } catch (registryError) {
            console.error("[Main initializeSnugOS] Failed to import effectsRegistry.js:", registryError);
            showSafeNotification("Critical error: Failed to load audio effects definitions.", 5000);
        }

        if (uiElementsCache.customBgInput) {
            uiElementsCache.customBgInput.addEventListener('change', handleCustomBackgroundUpload);
        }
        // Restore saved background (image or video)
        await restoreDesktopBackground();

        if (typeof initializeStateModule === 'function') initializeStateModule(appServices); else console.error("initializeStateModule is not a function");
        if (typeof initializeUIModule === 'function') initializeUIModule(appServices); else console.error("initializeUIModule is not a function");
        if (typeof initializeAudioModule === 'function') initializeAudioModule(appServices); else console.error("initializeAudioModule is not a function");
        if (typeof initializeEventHandlersModule === 'function') initializeEventHandlersModule(appServices); else console.error("initializeEventHandlersModule is not a function");
        if (typeof initPianoRollSequencer === 'function') initPianoRollSequencer(appServices); // Piano Roll Sequencer initialization
        if (typeof initScoreEditor === 'function') initScoreEditor(appServices); // Score Editor initialization
        if (typeof initClipReverse === 'function') initClipReverse(appServices); // Clip Reverse feature initialization
        if (typeof initQuickVolumeRamp === 'function') initQuickVolumeRamp(appServices); // Quick Volume Ramp feature initialization
        if (typeof initAudioLegatoDetection === 'function') initAudioLegatoDetection(appServices); // Audio Legato Detection initialization
        if (typeof initTrackSendRouting === 'function') initTrackSendRouting(appServices); // Track Send Routing initialization
        if (typeof initTrackMuteAutomation === 'function') initTrackMuteAutomation(appServices); // Track Mute Automation initialization
        if (typeof initTrackHeadphoneMix === 'function') initTrackHeadphoneMix(appServices); // Headphone Mix initialization
        if (typeof initTrackSoloChain === 'function') initTrackSoloChain(appServices); // Track Solo Chain initialization
        if (typeof initMetronomeVisual === 'function') initMetronomeVisual(appServices); // Metronome Visual Beat Indicator
        if (typeof initClickTrackVolumeSlider === 'function') initClickTrackVolumeSlider(appServices); // Click Track Volume Slider initialization (v0.3.77)
        if (typeof initTempoJumpMarkers === 'function') initTempoJumpMarkers(appServices); // Tempo Jump Markers initialization
        if (typeof initLoopRegionQuickSet === 'function') initLoopRegionQuickSet(appServices); // Loop Region Quick Set initialization
        if (typeof initLoopRegionMarkers === 'function') initLoopRegionMarkers(appServices); // Loop Region Markers initialization
        if (typeof initLoopRegionSnap === 'function') initLoopRegionSnap(appServices); // Loop Region Snap initialization
        if (typeof initLoopRegionPresets === 'function') initLoopRegionPresets(appServices); // Loop Region Presets initialization
        if (typeof initLoopUntilMarker === 'function') initLoopUntilMarker(appServices); // Loop Until Marker initialization
        if (typeof initLoopLengthDisplay === 'function') initLoopLengthDisplay(appServices); // Loop Length Display initialization (v0.3.86)
        if (typeof initMIDIActivityLog === 'function') initMIDIActivityLog(appServices); // MIDI Activity Log initialization (v0.3.88)
        if (typeof initAutoSaveIndicator === 'function') initAutoSaveIndicator(appServices); // Auto-save Indicator initialization
        if (typeof initAutoSaveCounter === 'function') initAutoSaveCounter(appServices); // Auto-save Counter (v0.3.92)
        if (typeof initProjectSessionTimer === 'function') initProjectSessionTimer(appServices); // Project Session Timer (v0.4.12) — MM:SS, click to reset
        if (typeof initTransportBarMasterMeter === 'function') initTransportBarMasterMeter(appServices); // Transport Bar Master Output Meter (v0.4.15) — L/R horizontal peak meter in the transport bar
        if (typeof initProjectSnapshotList === 'function') initProjectSnapshotList(appServices); // Quick Project Snapshot List (v0.4.15) — last 5 auto + manual snapshots
        if (typeof initRecentProjectFileHistory === 'function') initRecentProjectFileHistory(appServices); // Recent Project File History — last 5 saved/loaded names
        if (typeof initLyricsTrack === 'function') initLyricsTrack(appServices); // Lyrics Track initialization
        if (typeof initLyricsDisplay === 'function') initLyricsDisplay(appServices); // Lyrics Display Karaoke Mode
        if (typeof initTimeSignaturePerTrack === 'function') initTimeSignaturePerTrack(appServices); // Time Signature Per Track initialization
        if (typeof initClipContextMenu === 'function') initClipContextMenu(appServices); // Clip context menu with reverse
        if (typeof initClipboardHistoryManager === 'function') initClipboardHistoryManager(appServices); // Clipboard History Manager
        if (typeof initClipSelectionManager === 'function') initClipSelectionManager(appServices); // Clip selection manager initialization
        if (typeof initClipFadePresets === 'function') initClipFadePresets(appServices); // Clip Fade Presets initialization
        if (typeof initClipVolumeCurvePresets === 'function') initClipVolumeCurvePresets(appServices); // Clip Volume Curve Presets initialization (v0.4.01)
        if (typeof initClipGroupManager === 'function') initClipGroupManager(appServices); // Clip Group Manager
        if (typeof openStepSequencerView === 'function') initStepSequencerView(appServices); // Step Sequencer View initialization
        if (typeof initPianoRollEditor === 'function') initPianoRollEditor(appServices); // Piano Roll Editor initialization
        if (typeof initPianoRollPitchBend === 'function') initPianoRollPitchBend(appServices); // Piano Roll Pitch Bend initialization
        if (typeof initMidiVelocityEditor === 'function') initMidiVelocityEditor(appServices); // MIDI Velocity Editor initialization
        if (typeof initCCStepSequencer === 'function') initCCStepSequencer(appServices); // CC Step Sequencer initialization
        if (typeof initScaleHighlightMode === 'function') initScaleHighlightMode(appServices); // Scale Highlight Mode initialization
        if (typeof initScaleHighlightGlobal === 'function') initScaleHighlightGlobal(appServices); // Scale Highlight Global initialization
        if (typeof initTrackRenameHotkey === 'function') initTrackRenameHotkey(appServices); // Track Rename Hotkey initialization
        if (typeof initTrackRenumberHotkey === 'function') initTrackRenumberHotkey(appServices); // Track Renumber Shortcut
        if (typeof initQuickSliceTool === 'function') initQuickSliceTool(appServices);
        if (typeof initClipChopperGrid === 'function') initClipChopperGrid(appServices);
        if (typeof initClipChopperGridMenu === 'function') { initClipChopperGridMenu(); } // Quick Slice Tool - Shift+S to slice
        if (typeof initAudioRecorder === 'function') initAudioRecorder(appServices); // Audio Recorder initialization
        if (typeof initBounceSelectedToAudio === 'function') initBounceSelectedToAudio(appServices); // Bounce Selected to Audio initialization
        if (typeof initQuickBounce === 'function') initQuickBounce(appServices); // Quick Bounce initialization (v0.3.78)
        if (typeof initKeyboardOctaveShift === 'function') initKeyboardOctaveShift(appServices); // Keyboard Octave Shift - quick octave up/down
        if (typeof initTimelineZoomMemory === 'function') initTimelineZoomMemory(appServices); // Timeline Zoom Memory - remember zoom per project
        if (typeof initTrackFolderCollapseMemory === 'function') initTrackFolderCollapseMemory(appServices); // Track Folder Collapse Memory - remember per-project which track folders are collapsed/expanded (v0.3.76)
        if (typeof initCountInAudio === 'function') initCountInAudio(appServices); // Count-In Audio initialization
        if (typeof initCountInSettingsPanel === 'function') initCountInSettingsPanel(appServices); // Count-In Settings Panel initialization
        setTimeout(() => { if (typeof setupCountInUI === 'function') setupCountInUI(); }, 100); // Setup count-in UI controls
        if (typeof initMIDArpeggiatorPanel === 'function') initMIDArpeggiatorPanel(appServices); // MIDI Arpeggiator Panel initialization
        if (typeof initTrackTemplateLibrary === 'function') initTrackTemplateLibrary(appServices); // Track Template Library initialization
        if (typeof initExportSelection === 'function') initExportSelection(appServices); // Export Selection initialization
        if (typeof initProjectAutoNaming === 'function') initProjectAutoNaming(appServices); // Project Auto-Naming initialization
        
        if (typeof initDrumReplace === 'function') initDrumReplace(appServices); // Drum Replace initialization
        if (typeof initDrumPatternSplitter === 'function') initDrumPatternSplitter(appServices); // Drum Pattern Splitter initialization
        if (typeof initTrackContextMenu === 'function') initTrackContextMenu(appServices); // Track context menu with duplicate
        if (typeof initTrackSwap === 'function') initTrackSwap(appServices); // Track Swap - Ctrl+Right-click two tracks to swap
        if (typeof initTimelineClipOperations === 'function') initTimelineClipOperations(appServices); // Timeline Clip Operations (multi-select)
        if (typeof initTrackDuplicateOffset === 'function') initTrackDuplicateOffset(appServices); // Track Duplicate with Offset
        if (typeof initTrackColorPanel === 'function') initTrackColorPanel(appServices); // Track Color Panel initialization
        if (typeof initAudioClipLabeling === 'function') initAudioClipLabeling(appServices); // Audio Clip Labeling initialization
        if (typeof initMidiFilePanel === 'function') initMidiFilePanel(appServices); // MIDI File Import/Export initialization
        if (typeof initClipTimeHandles === 'function') initClipTimeHandles(appServices); // Clip Time Handles initialization
        if (typeof initClipDragClone === 'function') initClipDragClone(appServices); // Clip Drag Clone (v0.4.09) - Alt+drag to clone-paint
        if (typeof initTrackNotesSidebar === 'function') initTrackNotesSidebar(appServices); // Track Notes Sidebar (v0.4.10) - per-track 📝 button + inline textarea popover
        if (typeof initUndoToast === 'function') initUndoToast(appServices); // Undo Toast (v0.4.11) - styled ↶/↷ toast on undo/redo with action name
        if (typeof initTrackRolePanel === 'function') initTrackRolePanel(appServices); // Track Role Panel initialization
        if (typeof initTrackSnapResolutionPanel === 'function') initTrackSnapResolutionPanel(appServices); // Track Snap Resolution Panel initialization
        if (typeof initTrackScrollToCenter === 'function') initTrackScrollToCenter(appServices); // Track Scroll To Center initialization
        if (typeof initSamplerLoopTrim === 'function') initSamplerLoopTrim(appServices); // Sampler Loop Trim initialization
        if (typeof initCrossfadeLoopPoints === 'function') initCrossfadeLoopPoints(appServices); // Crossfade Loop Points initialization
        if (typeof initTuner === 'function') initTuner(appServices); // Tuner initialization
        if (typeof initTrackIconPicker === 'function') initTrackIconPicker(appServices); // Track Icon Picker initialization
        if (typeof initMixerChannelStripPresets === 'function') initMixerChannelStripPresets(appServices); // Mixer Channel Strip Presets initialization
        if (typeof initTrackEffectPresets === 'function') initTrackEffectPresets(appServices); // Track Effect Presets initialization
        if (typeof initTrackVelocityCurve === 'function') initTrackVelocityCurve(appServices); // Per-track Velocity Curve initialization
        if (typeof initChordVoicingModes === 'function') initChordVoicingModes(appServices); // Chord Voicing Modes initialization
        if (typeof initChordTriggerMode === 'function') initChordTriggerMode(appServices); // Chord Trigger Mode initialization
        if (typeof initRhythmRandomizer === 'function') initRhythmRandomizer(appServices); // Rhythm Randomizer initialization
        if (typeof initTrackFreezeQuickToggle === 'function') initTrackFreezeQuickToggle(appServices); // Track Freeze Quick Toggle - F key to freeze
        if (typeof initTrackFreezeCrossfade === 'function') initTrackFreezeCrossfade(appServices); // Track Freeze Crossfade - per-track fade in/out on freeze/unfreeze (v0.3.99)
        if (typeof initTrackLaneResize === 'function') initTrackLaneResize(appServices); // Track lane resize
        if (typeof initPerformanceMonitor === 'function') initPerformanceMonitor(); // Performance monitor initialization
        if (typeof initPerformanceIndicator === 'function') initPerformanceIndicator(); // Performance indicator initialization
        if (typeof initUndoHistoryPanel === 'function') initUndoHistoryPanel(); // Undo history panel initialization
        if (typeof initArmToggleHistory === 'function') initArmToggleHistory(appServices); // Arm Toggle History - dedicated undo for record-arm toggles (v0.3.89)
        if (typeof initDuplicateTrackHotkey === 'function') initDuplicateTrackHotkey(appServices); // Duplicate Track Hotkey - Shift+D duplicates selected/active track and places it directly under the source (v0.3.90)
        if (typeof initPerTrackMidiChannelDisplay === 'function') initPerTrackMidiChannelDisplay(appServices); // Per-Track MIDI Channel Display - small badge on each track header + click-to-change picker (v0.3.93)
        if (typeof initPerTrackGrooveTemplateSelector === 'function') initPerTrackGrooveTemplateSelector(appServices); // Per-Track Groove Template Selector - small 'Groove' badge per track + click-to-pick swing preset (v0.3.94)
        if (typeof initPerTrackMidiPanic === 'function') initPerTrackMidiPanic(appServices); // Per-Track MIDI Panic - small ⚠ button on each track strip + click-to-panic-this-track (v0.4.00)
        if (typeof initPerTrackMidiCCPresets === 'function') initPerTrackMidiCCPresets(appServices); // Per-Track MIDI CC Presets - 'CC' badge on each track header + dockable per-track panel for save/load/apply/delete/export of complete CC mapping sets (v0.4.02)
        if (typeof initTrackInstrumentGrouping === 'function') initTrackInstrumentGrouping(appServices); // Track Grouping by Instrument - 5 fixed groups (Drums/Bass/Lead/FX/Other) + right-click submenu + dockable panel (v0.4.04)
        if (typeof initTempoHistoryGraph === 'function') initTempoHistoryGraph(appServices); // Project Tempo History Graph - status-bar sparkline + click-to-expand popover with restore buttons (v0.3.95)
        if (typeof initGuitarTabEditor === 'function') initGuitarTabEditor(appServices); // Guitar Tab Editor initialization
        if (typeof initSpectrumAnalyzer === 'function') initSpectrumAnalyzer(appServices); // Spectrum Analyzer initialization
        if (typeof initBeatSyncedLFOPanel === 'function') initBeatSyncedLFOPanel(appServices); // Beat-synced LFO panel initialization
        if (typeof initTempoSyncLFOPanel === 'function') initTempoSyncLFOPanel(appServices); // Tempo Sync LFO panel initialization
        if (typeof initTempoSyncVisualizer === 'function') initTempoSyncVisualizer(appServices); // Tempo Sync Visualizer initialization
        if (typeof initPhaseCorrelationMeter === 'function') initPhaseCorrelationMeter(appServices); // Phase Correlation Meter initialization
        if (typeof initAutoBeatSync === 'function') initAutoBeatSync(appServices); // Auto-Beat Sync initialization
        if (typeof initTimelineMarkers === 'function') initTimelineMarkers(appServices); // Auto-Beat Sync initialization
        if (typeof initQuickMarkerSet === 'function') initQuickMarkerSet(appServices); // Quick Marker Set (M / Shift+M)
        if (typeof initMarkerAnnotations === 'function') initMarkerAnnotations(appServices); // Project Marker Annotations
        if (typeof initPlayheadMarkerDrop === 'function') initPlayheadMarkerDrop(appServices); // Playhead Marker Drop - double-click to add marker
        if (typeof initTimelineRulerClick === 'function') initTimelineRulerClick(appServices); // Timeline Ruler Click - click to jump playhead
        if (typeof initTempoJumpMarkers === 'function') initTempoJumpMarkers(appServices); // Tempo Jump Markers - click to set tempo jump point
        if (typeof initMarkerColorPresets === 'function') initMarkerColorPresets(appServices); // Marker Color Presets - semantic color picker for timeline markers
        if (typeof initMuteSelectedTracks === 'function') initMuteSelectedTracks(appServices); // Mute Selected Tracks - M to mute/unmute selected
        if (typeof initMuteOthersSolo === 'function') initMuteOthersSolo(appServices); // Mute-Others Solo - Shift+S soloes selected and temporarily mutes the rest, toggle to restore
        if (typeof initMidiChordDisplay === 'function') initMidiChordDisplay(appServices); // MIDI Chord Display initialization
        if (typeof initClipOpacity === 'function') initClipOpacity(appServices); // Clip Opacity initialization
        if (typeof initClipGainPerInstance === 'function') initClipGainPerInstance(appServices); // Clip Gain Per Instance initialization
        if (typeof initClipStartOffset === 'function') initClipStartOffset(appServices); // Clip Start Offset initialization
        if (typeof initClipLoopPreview === 'function') initClipLoopPreview(appServices); // Clip Loop Preview - double-click to loop
        if (typeof initClipGhostTrails === 'function') initClipGhostTrails(appServices); // Clip Ghost Trails initialization
        if (typeof initTrackGhostSignals === 'function') initTrackGhostSignals(appServices); // Track Ghost Signals initialization
        if (typeof initQuickRename === 'function') initQuickRename(appServices); // Quick Rename initialization
        if (typeof initBulkAssign === 'function') initBulkAssign(); // MIDI Bulk Assign initialization
        if (typeof initMIDILearnPresets === 'function') initMIDILearnPresets(appServices); // MIDI Learn Presets initialization
        if (typeof initBeatDetective === 'function') initBeatDetective(appServices); // Beat Detective initialization
        if (typeof initTransportLoopCount === 'function') initTransportLoopCount(appServices); // Transport Loop Count initialization
        if (window.TransportMemory && typeof window.TransportMemory.init === 'function') window.TransportMemory.init(); // Transport Memory restoration
        if (typeof initClipGainEnvelope === 'function') initClipGainEnvelope(appServices); // Clip Gain Envelope Core initialization
        if (typeof initClipGainEnvelopeEditor === 'function') initClipGainEnvelopeEditor(appServices); // Clip Gain Envelope Editor UI initialization
        if (typeof initClipGainEnvelopeQuick === 'function') initClipGainEnvelopeQuick(appServices); // Clip Gain Envelope Quick - double-click clip top to add points
        if (typeof initAudioClipHoverPreview === 'function') initAudioClipHoverPreview(appServices); // Audio Clip Hover Preview - hover to preview audio
        if (typeof initLoopCountStateReferences === 'function') initLoopCountStateReferences(
            () => getLoopRegionEnabled(),
            () => getLoopRegionStart(),
            () => getLoopRegionEnd()
        ); // Connect loop count to state functions
        if (typeof initLoopPracticeTrainer === 'function') initLoopPracticeTrainer(appServices); // Loop Practice Trainer initialization
        if (typeof initLoopPracticeTrainerStateReferences === 'function') initLoopPracticeTrainerStateReferences(
            () => getLoopRegionEnabled(),
            () => getLoopRegionStart(),
            () => getLoopRegionEnd()
        ); // Connect loop trainer to state functions
        if (typeof initTrackNotes === 'function') initTrackNotes(appServices); // Track Notes initialization
        // One-Shot Preview Pad: audition tracks without entering playback
        if (typeof initOneShotPreviewPad === 'function') initOneShotPreviewPad(appServices);
        if (typeof initOneShotPreviewPadStateReferences === 'function') initOneShotPreviewPadStateReferences(
            () => (typeof getTracksState === 'function' ? getTracksState() : []),
            () => (typeof getSoloedTrackIdState === 'function' ? getSoloedTrackIdState() : null)
        );
        // Bounce To Track initialization
        if (typeof initBounceToTrack === 'function') initBounceToTrack(appServices);
        // Quick-Bounce Markers initialization (v0.3.80)
        if (typeof initQuickBounceMarkers === 'function') initQuickBounceMarkers(appServices);
        // Waveform Visualizer initialization
        if (typeof initWaveformVisualizer === 'function') initWaveformVisualizer(appServices);
        // Drum Kit Piece Selector initialization
        if (typeof initDrumKitPieceSelector === 'function') initDrumKitPieceSelector(appServices);
        // Step Sequencer Pattern Library initialization
        if (typeof initStepSequencerPatternLibrary === 'function') initStepSequencerPatternLibrary(appServices);
        // Loudness Meter initialization (EBU R128 LUFS + true-peak dBTP)
        if (typeof initLoudnessMeter === 'function') initLoudnessMeter(appServices);
        // Sends Overview Panel initialization (track → send bus matrix)
        if (typeof initSendsOverviewPanel === 'function') initSendsOverviewPanel(appServices);
        // Project Search initialization (substring search across tracks/clips/notes)
        if (typeof initProjectSearch === 'function') initProjectSearch(appServices);
        // Master Limiter initialization (brick-wall limiter toggle)
        if (typeof initMasterLimiter === 'function') initMasterLimiter(appServices);
        // Toolbar Tooltips initialization (custom hover tooltips for toolbar buttons, v0.3.83)
        if (typeof initToolbarTooltips === 'function') initToolbarTooltips(appServices);
        // Master Effects Rack initialization (drag-to-reorder master FX UI, v0.3.81)
        if (typeof initMasterEffectsRack === 'function') initMasterEffectsRack(appServices);
        // Mix-Bus Group Presets initialization (v0.3.72)
        if (typeof initMixBusGroupPresets === 'function') initMixBusGroupPresets(appServices);
        // Performance Mode Recall initialization (v0.3.82 - save/recall panel layouts)
        if (typeof initPerformanceModeRecall === 'function') initPerformanceModeRecall(appServices);
        // Register openers for built-in panels so Performance Mode Recall can reopen them
        // (openers take no args and re-open the panel). Adding more is harmless — unknown
        // ids in a preset are simply logged and skipped, so this is safe across revisions.
        if (typeof registerPerformanceModeWindowOpener === 'function') {
            try { registerPerformanceModeWindowOpener('mixer', () => appServices.openMixerWindow?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('masterEffectsRack', () => appServices.openMasterEffectsRackWindow?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('masterLimiter', () => appServices.openMasterLimiterPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('loudnessMeter', () => appServices.openLoudnessMeterPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('sendsOverview', () => appServices.openSendsOverviewPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('pianoRollEditor', () => appServices.openPianoRollEditor?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('mixBusGroupPresets', () => appServices.openMixBusGroupPresetsPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('mixerChannelStripPresets', () => appServices.openMixerChannelStripPresetsPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('quickStack', () => appServices.openQuickStackPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('clickTrackVolume', () => appServices.openClickTrackVolumePanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('projectSearch', () => appServices.openProjectSearchPanel?.()); } catch (_) {}
            try { registerPerformanceModeWindowOpener('transportTimecode', () => appServices.openTransportTimecodeUI?.()); } catch (_) {}
        }
        // WebAudio Plugin Host initialization (load AudioWorklet processors into track chains)
        if (typeof initWebAudioPluginHost === 'function') initWebAudioPluginHost(appServices);
        // After the timeline renders existing tracks, paint note indicators for any
        // persisted notes that didn't get a 'trackRendered' callback (initial load).
        setTimeout(() => { try { if (typeof refreshTrackNoteIndicators === 'function') refreshTrackNoteIndicators(); } catch (e) { /* ignore */ } }, 800);
        if (typeof initAutoScrollSync === 'function') initAutoScrollSync(); // Auto-Scroll Sync initialization
        if (typeof initTrackLaneReorder === 'function') initTrackLaneReorder(appServices); // Track Lane Reorder initialization
        if (typeof enableTrackLaneReorder === 'function') enableTrackLaneReorder(); // Enable track lane drag-and-drop
        if (typeof initTrackReorderHotkeys === 'function') initTrackReorderHotkeys(appServices); // Track Reorder Hotkeys - Alt+ArrowUp/Down to move active track (v0.3.70)
        if (typeof initChordProgressionAssistant === 'function') initChordProgressionAssistant(appServices); // Chord Progression Assistant initialization
        if (typeof initLoopbackAudioRouting === 'function') initLoopbackAudioRouting(appServices); // Loopback Audio Routing initialization
        if (typeof initTempoSyncHelper === 'function') initTempoSyncHelper(appServices); // Tempo Sync Helper initialization
        if (typeof setupTempoSyncMenuItem === 'function') setupTempoSyncMenuItem(); // Add to start menu
        if (typeof initArrangementSnapGrid === 'function') initArrangementSnapGrid(appServices); // Arrangement Snap Grid initialization
        if (typeof initAudioNormalizer === 'function') initAudioNormalizer(); // Audio Normalizer initialization
        if (typeof initVelocityCurveEditor === 'function') initVelocityCurveEditor(appServices); // Velocity Curve Editor initialization
        if (typeof initTimelineSnapResolution === 'function') initTimelineSnapResolution(appServices); // Timeline Snap Resolution initialization
        if (typeof initTempoRamperVisual === 'function') initTempoRamperVisual(appServices); // Tempo Ramper Visual initialization
        if (typeof initSidechainVolumeEnvelope === 'function') initSidechainVolumeEnvelope(appServices); // Sidechain Volume Envelope initialization
        if (typeof initSidechainVisualizer === 'function') initSidechainVisualizer(appServices); // Sidechain Visualizer initialization
        if (typeof initAudioFadePreset === 'function') initAudioFadePreset(); // Audio Fade Presets initialization
        if (typeof initAudioBufferQualityPresets === 'function') initAudioBufferQualityPresets(appServices); // Audio Buffer Quality Presets - quick toggle between latency/quality
        if (typeof initClipFadeHandles === 'function') initClipFadeHandles(); // Clip Fade Handles initialization
        if (typeof initEnvelopeIntegration === 'function') initEnvelopeIntegration(); // Envelope Integration initialization
        if (typeof initAudioClipStretchMarkers === 'function') initAudioClipStretchMarkers(appServices); // Audio Clip Stretch Markers initialization
        if (typeof initAudioStretching === 'function') initAudioStretching(appServices); // Audio Stretching initialization
        if (typeof initClipStretchWithHandles === 'function') initClipStretchWithHandles(appServices); // Clip Stretch With Handles initialization
        if (typeof initAudioScrubbing === 'function') initAudioScrubbing(appServices); // Audio Scrubbing initialization - audible scrub on timeline drag
        if (typeof initAudioPhaseFlip === 'function') initAudioPhaseFlip(appServices); // Audio Phase Flip - invert clip phase by 180 degrees
        if (typeof initAudioWaveformAnnotation === 'function') initAudioWaveformAnnotation(appServices); // Audio Waveform Annotation - add notes on waveforms
        if (typeof initWaveformVisualization === 'function') initWaveformVisualization(appServices); // Waveform Visualization - draw waveform on audio clips
        
        if (typeof initializePrimaryEventListeners === 'function') {
             initializePrimaryEventListeners(appServices);
        } else { console.error("initializePrimaryEventListeners is not a function");}

        // Initialize MIDI drop zone on desktop for drag-and-drop .mid file import
        if (typeof initializeMIDIDropZone === 'function' && appServices.uiElementsCache?.desktop) {
            initializeMIDIDropZone(appServices.uiElementsCache.desktop);
        }

        if (typeof setupMIDI === 'function') setupMIDI(); else console.error("setupMIDI is not a function");

        if (Constants.soundLibraries && typeof fetchSoundLibrary === 'function') {
            Object.entries(Constants.soundLibraries).forEach(([name, url]) => fetchSoundLibrary(name, url, true)); 
        }

        if (appServices.openTimelineWindow && typeof appServices.openTimelineWindow === 'function') {
            appServices.openTimelineWindow();
        } else { console.warn("appServices.openTimelineWindow not available to open by default."); }

        requestAnimationFrame(updateMetersLoop);
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI(null, null);
        if (appServices.onPlaybackModeChange && typeof getPlaybackModeState === 'function') {
            appServices.onPlaybackModeChange(getPlaybackModeState());
        }

        showSafeNotification(`Welcome to SnugOS ${Constants.APP_VERSION}!`, 2500);
        
        // Initialize sample rate display in status bar
        initSampleRateDisplay();
        startSampleRateDisplayLoop();
        
        // Initialize performance monitor and indicator
        if (typeof initPerformanceMonitor === 'function') initPerformanceMonitor();
        if (typeof initPerformanceIndicator === 'function') initPerformanceIndicator();
        
        console.log(`[Main initializeSnugOS] SnugOS Version ${Constants.APP_VERSION} Initialized.`);

    } catch (initError) {
        console.error("CRITICAL ERROR during SnugOS Initialization:", initError);
        showSafeNotification("A critical error occurred during application startup. Please refresh.", 7000);
        const body = document.body;
        if (body) {
            body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif; color: #ccc; background-color: #101010; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1>Initialization Error</h1><p>SnugOS could not start due to a critical error. Please check the console for details and try refreshing the page.</p><p style="font-size: 0.8em; margin-top: 20px;">Error: ${initError.message}</p></div>`;
        }
    }
}

// Performance monitoring state
let snawSessionStartTime = performance.now();
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsValue = 60;
let cpuHistory = [];
const CPU_HISTORY_MAX_LENGTH = 50;

function updatePerformanceStats() {
    const now = performance.now();
    frameCount++;
    
    // Calculate FPS every second
    const elapsed = now - lastFrameTime;
    if (elapsed >= 1000) {
        fpsValue = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastFrameTime = now;
        
        // Update FPS display
        const fpsEl = document.getElementById('statusFpsValue');
        if (fpsEl) {
            fpsEl.textContent = fpsValue;
            // Color coding
            if (fpsValue >= 50) {
                fpsEl.className = 'text-green-400';
            } else if (fpsValue >= 30) {
                fpsEl.className = 'text-yellow-400';
            } else {
                fpsEl.className = 'text-red-400';
            }
        }
        
        // Estimate CPU load (rough approximation based on frame time)
        const cpuLoad = Math.min(100, Math.max(0, 100 - (fpsValue / 60 * 100)));
        cpuHistory.push(cpuLoad);
        if (cpuHistory.length > CPU_HISTORY_MAX_LENGTH) {
            cpuHistory.shift();
        }
        
        // Update CPU display
        const cpuEl = document.getElementById('statusCpuValue');
        if (cpuEl) {
            cpuEl.textContent = `${Math.round(cpuLoad)}%`;
            // Color coding
            if (cpuLoad <= 30) {
                cpuEl.className = 'text-green-400';
            } else if (cpuLoad <= 60) {
                cpuEl.className = 'text-yellow-400';
            } else {
                cpuEl.className = 'text-red-400';
            }
        }
        
        // Update CPU history sparkline
        updateCpuHistorySparkline();
        
        // Update memory display (if available)
        if (performance.memory) {
            const memEl = document.getElementById('statusMemValue');
            if (memEl) {
                const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                memEl.textContent = `${usedMB} MB`;
            }
        }
        
        // Update undo/redo count display
        const undoEl = document.getElementById('statusUndoCount');
        const redoEl = document.getElementById('statusRedoCount');
        if (undoEl) undoEl.textContent = getUndoCount ? getUndoCount() : 0;
        if (redoEl) redoEl.textContent = getRedoCount ? getRedoCount() : 0;

        // Update session timer (ProjectSessionTimer module — MM:SS, click to reset)
        const sessionEl = document.getElementById('statusSessionTimerValue');
        if (sessionEl) {
            if (typeof refreshProjectSessionTimer === 'function') {
                refreshProjectSessionTimer();
            } else if (typeof window !== 'undefined' && typeof window.refreshProjectSessionTimer === 'function') {
                window.refreshProjectSessionTimer();
            } else {
                // Fallback to legacy HH:MM:SS format if module not loaded.
                const totalSeconds = Math.floor((now - snawSessionStartTime) / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                sessionEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }

        // Update track count
        const trackCountEl = document.getElementById('statusTrackCountValue');
        if (trackCountEl && typeof getTracksState === 'function') {
            trackCountEl.textContent = getTracksState().length;
        }

        // Update clip count (sum of timelineClips across all tracks)
        const clipCountEl = document.getElementById('statusClipCountValue');
        if (clipCountEl && typeof getTracksState === 'function') {
            const allTracks = getTracksState();
            let totalClips = 0;
            if (Array.isArray(allTracks)) {
                for (const t of allTracks) {
                    if (t && Array.isArray(t.timelineClips)) {
                        totalClips += t.timelineClips.length;
                    }
                }
            }
            clipCountEl.textContent = totalClips;
        }

        // Update note count (sum of active step notes across all instrument tracks' active sequences)
        const noteCountEl = document.getElementById('statusNoteCountValue');
        if (noteCountEl && typeof getTracksState === 'function') {
            const allTracks = getTracksState();
            let totalNotes = 0;
            if (Array.isArray(allTracks)) {
                for (const t of allTracks) {
                    if (!t || t.type === 'Audio') continue;
                    if (!Array.isArray(t.sequences) || t.sequences.length === 0) continue;
                    const activeSeq = t.sequences.find(s => s && s.id === t.activeSequenceId) || t.sequences[0];
                    if (activeSeq && Array.isArray(activeSeq.data)) {
                        // activeSeq.data is a 2D array (rows x cols); iterate each row's steps
                        for (const row of activeSeq.data) {
                            if (!Array.isArray(row)) continue;
                            for (const step of row) {
                                if (step && step.active) totalNotes += 1;
                            }
                        }
                    }
                }
            }
            noteCountEl.textContent = totalNotes;
        }

        // Update selection count + total selection length (mm:ss)
        const selCountEl = document.getElementById('statusSelectionCountValue');
        const selLenEl = document.getElementById('statusSelectionLengthValue');
        if (selCountEl && selLenEl && typeof getTracksState === 'function') {
            let selectedCount = 0;
            let totalSelectionSeconds = 0;
            try {
                const selSet = (typeof appServices !== 'undefined' && typeof appServices.getSelectedClipIds === 'function')
                    ? appServices.getSelectedClipIds()
                    : null;
                const allTracks = getTracksState();
                if (Array.isArray(allTracks) && selSet && typeof selSet.has === 'function') {
                    for (const t of allTracks) {
                        if (!t || !Array.isArray(t.timelineClips)) continue;
                        for (const clip of t.timelineClips) {
                            if (!clip || !selSet.has(String(clip.id))) continue;
                            selectedCount += 1;
                            const dur = Number(clip.duration);
                            if (Number.isFinite(dur) && dur > 0) totalSelectionSeconds += dur;
                        }
                    }
                }
            } catch (e) {
                // Silently fall back to zero on any read error so the status bar stays usable
            }
            selCountEl.textContent = selectedCount;
            const mins = Math.floor(totalSelectionSeconds / 60);
            const secs = Math.floor(totalSelectionSeconds % 60);
            selLenEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        // Update master output peak level (dB), read from the master meter node
        const masterPeakEl = document.getElementById('statusMasterPeakValue');
        if (masterPeakEl) {
            let peakDb = -Infinity;
            try {
                const meter = (typeof getMasterMeterNode === 'function') ? getMasterMeterNode() : null;
                if (meter && typeof meter.getValue === 'function' && !meter.disposed) {
                    const raw = meter.getValue();
                    // Tone.Meter returns dB; if stereo array, take the louder channel
                    const v = Array.isArray(raw) ? raw[0] : raw;
                    if (typeof v === 'number' && isFinite(v)) peakDb = v;
                }
            } catch (e) {
                // Silently leave peakDb at -Infinity so the indicator shows -∞
            }
            masterPeakEl.textContent = !isFinite(peakDb) ? '-∞' : `${peakDb.toFixed(1)} dB`;
            // Color coding: green for safe, yellow for hot, red for clipping
            if (!isFinite(peakDb) || peakDb <= -6) {
                masterPeakEl.className = 'text-green-400';
            } else if (peakDb <= -0.1) {
                masterPeakEl.className = 'text-yellow-400';
            } else {
                masterPeakEl.className = 'text-red-400';
            }
        }
    }
}

function updateCpuHistorySparkline() {
    const container = document.getElementById('statusCpuHistory');
    if (!container) return;
    
    container.innerHTML = cpuHistory.map(val => {
        const height = Math.max(1, Math.min(12, Math.round((val / 100) * 12)));
        const color = val <= 30 ? 'bg-green-400' : (val <= 60 ? 'bg-yellow-400' : 'bg-red-400');
        return `<div class="${color}" style="width: 2px; height: ${height}px;"></div>`;
    }).join('');
}

function getCpuMonitorData() {
    return {
        fps: fpsValue,
        cpuHistory: [...cpuHistory],
        currentCpu: cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1] : 0,
        memory: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        } : null,
        tracks: getTracksState ? getTracksState().map(t => ({
            id: t.id,
            name: t.name,
            type: t.type,
            isPlaying: t.isPlaying,
            hasActiveSequence: t.activeSequenceId !== null
        })) : []
    };
}

function updateMetersLoop() {
    try {
        if (typeof updateMeters === 'function') {
            const mixerWindow = getWindowByIdState ? getWindowByIdState('mixer') : null;
            const mixerMasterMeterBar = mixerWindow?.element && !mixerWindow.isMinimized ? mixerWindow.element.querySelector('#mixerMasterMeterBar') : null;
            const tracks = getTracksState ? getTracksState() : [];
            updateMeters(uiElementsCache.masterMeterBarGlobal, mixerMasterMeterBar, tracks);
        }
        // Update CC Visualizer bars
        if (typeof updateCcVisualizerBars === 'function') {
            updateCcVisualizerBars();
        }
        if (typeof updatePlayheadPosition === 'function') {
            updatePlayheadPosition();
        }
        // Auto-scroll timeline during playback
        if (typeof autoScrollTimeline === 'function') {
            autoScrollTimeline();
        }
        // Update performance stats (FPS/CPU/Memory)
        if (typeof updatePerformanceStats === 'function') {
            updatePerformanceStats();
        }
        // Transport Loop Count - Check if loop count limit reached
        if (typeof checkTransportLoopCount === 'function') {
            checkTransportLoopCount();
        }
        // Loop Practice Trainer - Track loop iteration timings
        if (typeof checkLoopPracticeTrainer === 'function') {
            checkLoopPracticeTrainer();
        }
    } catch (loopError) {
        console.warn("[Main updateMetersLoop] Error in UI update loop:", loopError);
    }
    requestAnimationFrame(updateMetersLoop);
}

function applyDesktopBackground(sourceUrl, bgType = 'image') {
    const desktop = uiElementsCache.desktop;
    const videoBg = document.getElementById('desktopVideoBg');
    const imageBgProbe = document.getElementById('desktopImageBgProbe');

    if (!desktop) {
        console.warn("Desktop element not found in cache for applying background.");
        return;
    }

    try {
        // Reset both image and video backgrounds
        desktop.style.backgroundImage = '';
        if (videoBg) {
            videoBg.style.display = 'none';
            videoBg.pause();
            videoBg.src = '';
        }

        if (bgType === 'image' && sourceUrl) {
            // Image background
            // One-shot decode diagnostic. If the image is corrupt, truncated, or uses a
            // codec the browser can't decode (e.g. WebP on a browser that doesn't ship it,
            // malformed JPEG/PNG headers), the CSS backgroundImage will silently fail and
            // the user sees a black desktop. Probe via a hidden img element so we can
            // surface a clear, actionable notification. Mirrors the Day 745 video-bg
            // diagnostic on the same desktop-bg pipeline.
            if (imageBgProbe) {
                if (imageBgProbe._snugosImgErrorHandler) imageBgProbe.removeEventListener('error', imageBgProbe._snugosImgErrorHandler);
                if (imageBgProbe._snugosImgLoadHandler) imageBgProbe.removeEventListener('load', imageBgProbe._snugosImgLoadHandler);
                imageBgProbe._snugosImgErrorHandler = () => {
                    // Don't fire on a user-initiated switch that arrives mid-decode: only
                    // surface if the *current* backgroundImage URL is the one that failed.
                    // (Day 745's video branch doesn't need this guard because the video
                    // element is single-purpose; the img probe is reused for every apply.)
                    const currentBg = desktop.style.backgroundImage || '';
                    if (currentBg.indexOf(sourceUrl) === -1) return;
                    console.warn("[desktopImageBg] decode failed for sourceUrl:", sourceUrl);
                    if (typeof showSafeNotification === 'function') {
                        showSafeNotification(
                            "Custom background image failed to load (corrupt file or unsupported format). " +
                            "Try re-exporting as PNG or JPEG.",
                            5000
                        );
                    }
                    // Clear the broken background so the user isn't left with a black
                    // desktop; fall back to the default background color.
                    desktop.style.backgroundImage = '';
                    desktop.style.backgroundColor = (typeof Constants !== 'undefined' && Constants.defaultDesktopBg) || '#101010';
                };
                imageBgProbe._snugosImgLoadHandler = () => {
                    if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
                };
                imageBgProbe.addEventListener('error', imageBgProbe._snugosImgErrorHandler, { once: true });
                imageBgProbe.addEventListener('load', imageBgProbe._snugosImgLoadHandler, { once: true });
                // Kick off the probe; the actual visual application happens immediately
                // below — if the decode succeeds the load handler is a no-op, if it fails
                // the error handler rolls the background back.
                try { imageBgProbe.src = sourceUrl; } catch (probeErr) { /* ignore */ }
            }
            desktop.style.backgroundImage = `url('${sourceUrl}')`;
            desktop.style.backgroundSize = 'cover';
            desktop.style.backgroundPosition = 'center center';
            desktop.style.backgroundRepeat = 'no-repeat';
            desktop.style.backgroundColor = '';
        } else if (bgType === 'video' && sourceUrl && videoBg) {
            // Video background
            // One-shot codec/load diagnostic. If the browser can't decode the file
            // (AV1 on Safari, HEVC on Chrome, etc.) or it fails to load, fire a
            // notification so the user knows why the desktop is black instead of
            // staring at an empty background wondering what went wrong.
            if (videoBg._snugosBgErrorHandler) videoBg.removeEventListener('error', videoBg._snugosBgErrorHandler);
            if (videoBg._snugosBgLoadedHandler) videoBg.removeEventListener('loadeddata', videoBg._snugosBgLoadedHandler);
            videoBg._snugosBgErrorHandler = () => {
                const err = videoBg.error;
                const code = err && typeof err.code === 'number' ? err.code : 0;
                // 1=MEDIA_ERR_ABORTED, 2=MEDIA_ERR_NETWORK, 3=MEDIA_ERR_DECODE, 4=MEDIA_ERR_SRC_NOT_SUPPORTED
                let hint = "Browser could not play this video.";
                if (code === 4) hint = "Video codec or container not supported in this browser. Try H.264/MP4.";
                else if (code === 3) hint = "Video is corrupted or uses an unsupported codec. Try re-encoding as H.264/MP4.";
                console.warn("[desktopBgVideo] decode error, code=", code, err);
                if (typeof showSafeNotification === 'function') {
                    showSafeNotification("Custom background video failed: " + hint, 5000);
                }
            };
            videoBg._snugosBgLoadedHandler = () => {
                if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
            };
            videoBg.addEventListener('error', videoBg._snugosBgErrorHandler, { once: true });
            videoBg.addEventListener('loadeddata', videoBg._snugosBgLoadedHandler, { once: true });
            videoBg.src = sourceUrl;
            videoBg.style.display = 'block';
            videoBg.play().catch(e => console.warn("Video autoplay prevented:", e));
            desktop.style.backgroundColor = '';
        } else {
            // No background - use default
            desktop.style.backgroundColor = Constants.defaultDesktopBg || '#101010';
        }
    } catch (e) {
        console.error("Error applying desktop background style:", e);
    }
}

// Restore background on load
async function restoreDesktopBackground() {
    const bgType = localStorage.getItem(DESKTOP_BG_TYPE_KEY);

    if (bgType === 'video') {
        let restored = false;
        try {
            const videoBlob = await bgDb.get('desktopVideo');
            if (videoBlob) {
                const objectUrl = URL.createObjectURL(videoBlob);
                // Track this URL so removeCustomDesktopBackground (and a later
                // restore on top of an existing video bg) can revoke it instead
                // of leaking the Blob.
                if (currentDesktopVideoObjectUrl) {
                    try { URL.revokeObjectURL(currentDesktopVideoObjectUrl); } catch (_) {}
                }
                currentDesktopVideoObjectUrl = objectUrl;
                applyDesktopBackground(objectUrl, 'video');
                if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
                return;
            }
            // Blob missing — clear stale video marker, fall through to image fallback
            console.warn('[restoreDesktopBackground] Stored video bg marker set but IDB blob is missing. Clearing marker.');
            localStorage.removeItem(DESKTOP_BG_TYPE_KEY);
            if (typeof showSafeNotification === 'function') {
                showSafeNotification("Stored video background could not be restored (missing data). Falling back to default.", 3500);
            }
        } catch (e) {
            console.warn("Could not restore video background:", e);
            localStorage.removeItem(DESKTOP_BG_TYPE_KEY);
            if (typeof showSafeNotification === 'function') {
                showSafeNotification("Video background restore failed. Falling back to default.", 3500);
            }
        }
    }

    // Image-IDB fallback: if the image was stored via the upload-time quota fallback
    // path (large images saved as Blobs in bgDb under 'desktopImage'), the localStorage
    // entry may be a blob: URL that no longer resolves (e.g. tab reload before the
    // user re-applies). Try bgDb first; only fall through to the legacy data:/localStorage
    // path if that fails. Mirrors the video-IDB restore branch above.
    if (bgType === 'image') {
        try {
            const imageBlob = await bgDb.get('desktopImage');
            if (imageBlob) {
                const objectUrl = URL.createObjectURL(imageBlob);
                if (currentDesktopImageObjectUrl) {
                    try { URL.revokeObjectURL(currentDesktopImageObjectUrl); } catch (_) {}
                }
                currentDesktopImageObjectUrl = objectUrl;
                applyDesktopBackground(objectUrl, 'image');
                if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
                return;
            }
        } catch (e) {
            console.warn("[restoreDesktopBackground] Image-IDB restore failed, falling back to localStorage:", e);
        }
    }

    if (bgType === 'image' || !bgType) {
        const imageUrl = localStorage.getItem(DESKTOP_BACKGROUND_KEY);
        if (imageUrl) {
            // Defensive: a stale or corrupt imageUrl (revoked blob URL, empty string,
            // an unsupported scheme like javascript:, or a value that fails to parse)
            // would otherwise silently leave the desktop with a broken background.
            // Mirror the Day 738 video fallback: clear the stale markers and notify.
            const trimmed = String(imageUrl).trim();
            const looksSafe =
                trimmed.length > 0 &&
                (trimmed.startsWith('data:') ||
                 trimmed.startsWith('blob:') ||
                 trimmed.startsWith('http://') ||
                 trimmed.startsWith('https://'));
            if (looksSafe) {
                applyDesktopBackground(trimmed, 'image');
                if (typeof updateBgStatusIndicator === 'function') updateBgStatusIndicator();
            } else {
                console.warn('[restoreDesktopBackground] Stored image bg URL is invalid or uses an unsupported scheme. Clearing marker.');
                localStorage.removeItem(DESKTOP_BACKGROUND_KEY);
                if (!bgType) localStorage.removeItem(DESKTOP_BG_TYPE_KEY);
                if (typeof showSafeNotification === 'function') {
                    showSafeNotification("Stored image background could not be restored (invalid data). Falling back to default.", 3500);
                }
            }
        }
    }
}


// --- Enhancement: Timeline Ruler Click Time Tooltip ---
// Shows time position tooltip when clicking on the timeline ruler
function showPlayheadTooltip(clientX, clientY) {
    const tooltip = document.getElementById('playheadTooltip') || createPlayheadTooltip();
    // Defensive: if timeline position accessor is unavailable or returns NaN,
    // fall back to 0 so the tooltip still renders (instead of going stale/blank).
    let time = 0;
    try {
        if (typeof getCurrentTimelinePosition === 'function') {
            const t = getCurrentTimelinePosition();
            if (typeof t === 'number' && isFinite(t) && t >= 0) time = t;
        }
    } catch (_) { /* swallow — tooltip still shows 0:00:000 */ }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    // Clamp ms to 0-999 to defend against floating-point drift (e.g. 59.9999s
    // showing as "0:59:999" instead of "1:00:000"). The integer floor + clamp
    // guarantees a stable, parseable MM:SS:mmm display.
    let ms = Math.floor((time % 1) * 1000);
    if (!isFinite(ms) || ms < 0) ms = 0;
    if (ms > 999) ms = 999;
    tooltip.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
    tooltip.style.left = (clientX + 10) + 'px';
    tooltip.style.top = (clientY + 10) + 'px';
    tooltip.style.display = 'block';
    clearTimeout(window._playheadTooltipTimeout);
    window._playheadTooltipTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 2000);
}

function createPlayheadTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'playheadTooltip';
    tooltip.style.cssText = 'position:fixed;background:rgba(0,0,0,0.85);color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;pointer-events:none;z-index:100000;display:none;';
    document.body.appendChild(tooltip);
    return tooltip;
}

// --- Global Event Listeners ---
if (typeof window !== 'undefined') {
window.addEventListener('load', initializeSnugOS);
window.addEventListener('beforeunload', (e) => {
    const tracksExist = getTracksState && getTracksState().length > 0;
    const undoStackExists = getUndoStackState && getUndoStackState().length > 0;

    if (tracksExist || undoStackExists) {
        e.preventDefault(); 
        e.returnValue = ''; 
        return "You have unsaved changes. Are you sure you want to leave?"; 
    }
});
}
console.log(`SCRIPT EXECUTION FINISHED - SnugOS (main.js - Version ${Constants.APP_VERSION})`);
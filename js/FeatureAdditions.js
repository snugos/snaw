// js/FeatureAdditions.js - Additional feature implementations for SnugOS DAW

// Import new feature modules
export { VisualizationModes, VISUALIZATION_MODES, COLOR_SCHEMES, openVisualizationModesPanel } from './VisualizationModes.js';
export { PerformanceMode, Scene, SCENE_TYPES, TRIGGER_MODES, initPerformanceMode, openPerformanceModePanel } from './PerformanceMode.js';
export { SmartQuantize, QUANTIZE_MODES, GROOVE_TEMPLATES, quantizeNotes, analyzeNotes, openSmartQuantizePanel } from './SmartQuantize.js';
export { AudioSpectrumComparison, createAudioSpectrumComparison, createAudioSpectrumComparisonPanel } from './AudioSpectrumComparison.js';
export { RealtimeMIDIMonitor, createRealtimeMIDIMonitor, createMIDIMonitorPanel } from './RealtimeMIDIMonitor.js';
export { initializeTrackGroups, getTrackGroups, getTrackGroupById, getTrackGroupForTrack, createTrackGroup, removeTrackGroup, renameTrackGroup, updateTrackGroup, addTrackToGroup, removeTrackFromGroup, setGroupVolume, setGroupMute, setGroupSolo, setGroupPan, toggleGroupCollapse, duplicateGroup, moveGroup, selectGroupTracks, ungroup, handleTrackDeletedFromGroups, clearAllTrackGroups, getTrackGroupsForSave, restoreTrackGroups, createTrackGroupsPanel } from './TrackGrouping.js';
export { DrumPatternGenerator, DRUM_STYLES, COMPLEXITY_LEVELS, generateDrumPattern } from './DrumPatternGenerator.js';
export { MelodyGenerator, MELODY_STYLES, MELODY_MOODS, COMPLEXITY, generateMelodyQuick } from './MelodyGenerator.js';
export { initDrumReplace, openDrumReplacePanel } from './DrumReplace.js';
export { initSpectralSubtractiveEQ, openSpectralSubtractiveEQPanel, spectralEQEngine } from './SpectralSubtractiveEQ.js';
export { initTremoloauto, openTremoloautoPanel, tremoloautoEngine } from './Tremoloauto.js';
export { calculateProjectStatistics, formatProjectStatistics, ProjectStatisticsPanel } from './ProjectStatisticsPanel.js';
// New features from 2026-04-24 queue
export { openProjectTemplateBrowserPanel, closeProjectTemplateBrowserPanel } from './ProjectTemplateBrowser.js';
export { openMIDILearnVisualizationPanel, closeMIDILearnVisualizationPanel } from './MIDILearnVisualization.js';
export { openQuantizeStrengthPanel, closeQuantizeStrengthPanel, getQuantizeStrength, setQuantizeStrength } from './QuantizeStrengthControl.js';
export { openRandomNoteGeneratorPanel, closeRandomNoteGeneratorPanel } from './RandomNoteGenerator.js';
// Mixer Snapshot feature
export { openMixerSnapshotPanel, saveMixerSnapshot, loadMixerSnapshot, deleteMixerSnapshot, getMixerSnapshots, getMixerSnapshotNames } from './MixerSnapshot.js';
// Piano Roll Sequencer - Feature #1
export { initPianoRollSequencer, openTrackSequencerWindow, refreshSequencerUI } from './PianoRollSequencer.js';
// Clip Reverse - Reverse audio/MIDI clips
export { initClipReverse, reverseAudioClip, reverseMIDISequence, openClipReversePanel } from './ClipReverse.js';
// Headphone Mix - Route tracks to a dedicated headphone mix with separate volume
export { initHeadphoneMix, openHeadphoneMixPanel, addTrackToHeadphoneMix, removeTrackFromHeadphoneMix, setHeadphoneMixVolume, getHeadphoneMixVolume, setTrackHeadphoneSendLevel, getTracksInHeadphoneMix } from './HeadphoneMix.js';
// Auto-Beat Sync - Automatically sync tempo to detected BPM from audio input
export { initAutoBeatSync, openAutoBeatSyncPanel, getAutoBeatSyncState, isAutoBeatSyncEnabled, getDetectedBpm } from './AutoBeatSync.js';
// Audio Tap Tempo - Tap-based and audio input beat detection for setting tempo
export { initAudioTapTempo, openAudioTapTempoPanel, recordTap, setTempoFromTap, getTapStatus, resetTapHistory, startAudioBeatDetection, stopAudioBeatDetection, getAudioBeatStatus } from './AudioTapTempo.js';
// Auto-Ducking - Automatic track volume reduction based on sidechain input
export { initAutoDucking, getDuckingConfigs, getDuckingConfigForTrack, setDuckingConfig, removeDuckingConfig, toggleDucking, processDucking, openAutoDuckingPanel } from './AutoDucking.js';
// Lyrics Display - Karaoke-style lyrics synced to playback
export { initLyricsDisplay, openLyricsPanel } from './LyricsDisplay.js';
// Track Stacks - Collapse/expand groups of tracks
export { initTrackStack, openTrackStackPanel, createTrackStack, deleteTrackStack, addTrackToStack, removeTrackFromStack, toggleStackCollapse, updateTrackVisibility, getTrackStacks, setTrackStacksState, getTrackStackId, getTrackStack } from './TrackStack.js';
// Timeline Markers - Markers on timeline for navigation
export { initTimelineMarkers, getTimelineMarkers, addTimelineMarker, removeTimelineMarker, updateTimelineMarker, openTimelineMarkersPanel } from './TimelineMarkers.js';
// Clip Context Menu - Right-click context menu for timeline clips with Reverse option
export { initClipContextMenu, showClipContextMenu, closeClipContextMenu } from './ClipContextMenu.js';
// Transport Timecode Display - Shows current position in BBT format with transport controls
export { openTransportTimecodePanel, renderTransportTimecodeContent, updateTransportTimecodeDisplay } from './TransportTimecodeUI.js';
export { createTransportTimecodeDisplay, secondsToBarsBeatsTicks, startTransportTimecodeLoop, updateTransportTimecodeFromTransport } from './TransportTimecodeCore.js';
// Transport Loop Count - Set number of loop repetitions before stopping
export { initTransportLoopCount, getLoopCount, setLoopCount, getCurrentLoopIteration, setCurrentLoopIteration, isLoopCountFeatureEnabled, setLoopCountFeatureEnabled, incrementLoopIteration, resetLoopIteration, openTransportLoopCountPanel, updateLoopCountDisplay } from './TransportLoopCount.js';
// Clip Gain Envelope Editor - Visual envelope editor for clip-level volume automation with drawable curves
export { initClipGainEnvelopeEditor, openClipGainEnvelopeEditorPanel } from './ClipGainEnvelopeEditor.js';
// Audio Clip Hover Preview - Hover over audio clips to hear a 2-second preview
export { initAudioClipHoverPreview, isPreviewPlaying, getCurrentPreviewClipId } from './AudioClipHoverPreview.js';
// Phase Invert Button - One-click phase invert for correcting out-of-phase audio recordings
export { createPhaseInvertButton, openPhaseInvertButtonPanel } from './PhaseInvertButton.js';
// Score Editor - Visual staff notation display showing notes as musical notation
export { initScoreEditor, openScoreEditorWindow, updateScoreEditor } from './ScoreEditor.js';
export { initStepSequencerView, openStepSequencerView, updateStepSequencerPanel, getStepSequencerWindow } from './StepSequencerView.js';
// Track Solo Chain - Mute all tracks except selected chain
export { initTrackSoloChain, openSoloChainPanel } from './TrackSoloChain.js';
// Loop Region Presets - Predefined loop regions for quick selection
export { initLoopRegionPresets, openLoopRegionPresetsPanel } from './LoopRegionPresets.js';
// Track Lane Reorder - Drag-and-drop to reorder tracks in timeline lanes
export { initTrackLaneReorder, enableTrackLaneReorder, disableTrackLaneReorder, isDragging, getDraggedTrackId } from './TrackLaneReorder.js';
// Chord Progression Assistant - Visual chord picker with music theory
export { initChordProgressionAssistant, openChordProgressionPanel, generateProgression, getCommonProgressions } from './ChordProgressionAssistant.js';

// Sidechain Visualizer - Show which tracks are being affected by sidechain compression in real-time
export { initSidechainVisualizer, openSidechainVisualizerPanel, triggerSidechainVisualizer, getDuckingLevel, resetDuckingIndicators, updateSidechainVisualizer, closeSidechainVisualizerPanel } from './SidechainVisualizer.js';

// Loopback Audio Routing - Route DAW output back to input for sampling external sources
export { initLoopbackAudioRouting, openLoopbackRoutingPanel, startLoopbackRouting, stopLoopbackRouting, isLoopbackActive, isLoopbackSupported, setLoopbackGain, getLoopbackStream } from './LoopbackAudioRouting.js';

// Tempo Sync Helper - Detect tempo from audio and suggest optimal BPM
export { initTempoSyncHelper, openTempoSyncHelperPanel, setupTempoSyncMenuItem } from './TempoSyncHelper.js';
// Scale Preview Keys - Play scale notes when hovering over piano keys
export { initScalePreviewKeys, setScalePreviewEnabled, isScalePreviewEnabled, openScalePreviewSettings, setupPianoKeyHoverListeners } from './ScalePreviewKeys.js';

// Arrangement Snap Grid - Customizable snap grid with visual subdivisions
export { initArrangementSnapGrid, openSnapGridPanel, getSnapValue, setSnapValue, snapTimeToGrid, toggleSnapEnabled, getSnapInfo } from './ArrangementSnapGrid.js';
// MIDI Velocity Curve - Apply custom velocity curves to MIDI input for expressive performance
export { openMIDIVelocityCurvePanel } from './MIDIVelocityCurve.js';

// Loop Region Snap - Snap loop region boundaries to clip edges
export { initLoopRegionSnap, openLoopRegionSnapSettings, openLoopSnapPanel, isLoopRegionSnapEnabled, setLoopRegionSnapEnabled, toggleLoopSnap, getSnapConfig, snapLoopRegionStart, snapLoopRegionEnd, snapLoopRegion, getLoopRegionSnapSettings, setSnapThreshold } from './LoopRegionSnap.js';
// Drum Pattern Splitter - AI-powered separation of drum tracks into kick/snare/hihat components
export { initDrumPatternSplitter, openDrumPatternSplitterPanel } from './DrumPatternSplitter.js';
// Auto Key Detection - Analyze MIDI/audio to detect musical key and suggest scale
export { initAutoKeyDetection, detectKeyFromNotes, analyzeProjectKey, getDetectedKey, applyKeyToProject, openAutoKeyDetectionPanel, closeAutoKeyDetectionPanel } from './AutoKeyDetection.js';
// Timeline Snap Resolution - Quick buttons to switch snap between 1/4, 1/8, 1/16, 1/32
export { initTimelineSnapResolution, openSnapResolutionPanel, getSnapResolution, setSnapResolution, toggleSnapResolutionPanel } from './TimelineSnapResolution.js';

// Scale Highlight Intensity - Feature #10
export { initScaleHighlightGlobal, openScaleHighlightGlobalPanel, isGlobalScaleHighlightEnabled, toggleGlobalScaleHighlight, setGlobalScale, setGlobalRootNote, getGlobalScaleInfo, getGlobalScaleIntensity, setGlobalScaleIntensity } from './ScaleHighlightGlobal.js';
// Track Rename Hotkey - Press F2 to rename selected track inline
export { initTrackRenameHotkey, handleTrackRenameKey } from './TrackRenameHotkey.js';
// Quick Slice Tool - Press Shift+S to slice selected clip at playhead
export { initQuickSliceTool, setQuickSliceEnabled, isQuickSliceEnabled } from './QuickSliceTool.js';
// Waveform Visualization - Draw real-time waveform on audio clips in timeline
export { initWaveformVisualization, openWaveformSettingsPanel, updateWaveformDisplay, renderTrackWaveforms, getWaveformPeaks, computeWaveformPeaks, clearWaveformCache, clearAllWaveformCache } from './WaveformVisualization.js';

// Crossfade Loop Points - Set loop start/end within an audio clip with crossfade preview
export { initCrossfadeLoopPoints, openCrossfadeLoopPointsPanel } from './CrossfadeLoopPoints.js';

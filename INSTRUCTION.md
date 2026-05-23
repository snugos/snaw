## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

**All features from the original queue have been implemented.** The codebase has **493 JS files** with **259,000+ lines of code** covering a complete DAW feature set.

### Original Queue (Complete):
1. ~~**Piano Roll Editor** - Clickable piano roll with note editing~~ ✅ (see `js/PianoRollEditor.js`)
2. ~~**Audio Recording** - Record audio from microphone into tracks~~ ✅ (see `js/AudioRecorder.js`)
3. ~~**VST Plugin Support** - Load WebAudio plugins via AudioWorklet~~ ✅ (limited to browser-compatible formats)
4. ~~**MIDI File Import/Export** - Drag & drop .mid files~~ ✅
5. ~~**Track Effects Presets** - Save/load effect chain presets per track~~ ✅ (see `js/ClipFadePresets.js`)
6. ~~**Quantize Selection** - Quantize selected notes to grid~~ ✅ (see `js/ScaleQuantize.js`, `js/SmartQuantize.js`)
7. ~~**Undo/Redo Visual Stack** - Show undo history in a panel~~ ✅ (see `js/UndoHistoryPanel.js`)
8. ~~**Keyboard Shortcuts Panel** - Press `?` to show all shortcuts~~ ✅ (see `js/KeyboardShortcuts.js`)
9. ~~**Waveform Visualization** - Draw waveform on audio clips~~ ✅ (see `js/WaveformVisualization.js`)
10. ~~**Track Color Coding** - Assign colors to tracks for visual grouping~~ ✅ (see `js/TrackColorPanel.js`)

### Additional Features (Pre-Implemented):
- Audio Reverse ✅
- Velocity Curve Editor ✅
- Track Send Routing ✅
- MIDITranspose ✅
- Clip Batch Transpose ✅
- Track Grouping ✅
- Click Track Generator ✅
- Track Lane Reorder ✅
- Audio Waveform Annotation ✅
- Clip Probability Distribution ✅
- Real-time Spectrum Visualizer ✅
- Track Lane Solo Mode ✅
- MIDI CC Automation Lanes ✅
- Adaptive BPM Detection ✅
- Clip Fade Shape Presets ✅
- Track Color Themes ✅
- MIDI Learn Presets ✅
- Clip Ghost Preview ✅
- Tap Tempo / Tap History ✅
- Drum Pattern Generator ✅
- Melody Generator ✅
- Tempo Ramper ✅
- Lyrics Track ✅
- Video Export ✅
- Cloud Sync ✅
- Notation Export ✅
- Clipboard History Manager ✅

## When Queue is Empty

Since all features are implemented, generate new ideas when needed:

```
Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

Generate 10 NEW feature ideas that are:
1. Achievable in a single session
2. Complement existing features
3. Enhance creative workflow
```

## Workflow

### Step 1: Check Queue
- Read this instruction to see current status
- If queue is empty, generate new ideas and update this file

### Step 2: Implement Feature (if new)
- Keep it SIMPLE and MINIMAL
- Follow existing code patterns
- Add necessary UI, state, and audio logic

### Step 3: Commit & Push
- Commit: `feat: [feature name]`
- Push to `LWB-with-Bugs` branch
- Wait ~60 seconds for GitHub Pages deploy

### Step 4: Verify
- Open https://snugos.github.io/snaw/ in browser
- Test the new feature works
- Check console for errors

### Step 5: Update Queue
After successfully implementing a feature:
- Remove it from the queue
- Renumber remaining features
- Update this instruction

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`
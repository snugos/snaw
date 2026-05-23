## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

**All features below were already implemented in previous sessions. The codebase has 480+ JS files with 259,000+ lines of code covering all these features.**

1. ~~**Audio Reverse** - Reverse audio clips with one click~~ ✅
2. ~~**Velocity Curve Editor** - Map velocity input response curves for MIDI controllers~~ ✅ (see `js/VelocityCurveEditor.js` and `js/MIDIVelocityCurve.js`)
3. ~~**Track Send Routing** - Visual send pre/post fader with wet/dry amount to buses~~ ✅ (see `js/TrackSendRouting.js`)
4. ~~**MIDITranspose** - Transpose entire MIDI tracks by semitones~~ ✅ (see `js/MIDITransposeTrack.js`)
5. ~~**Clip Batch Transpose** - Transpose multiple selected clips by semitones at once~~ ✅
6. ~~**Track Grouping** - Group tracks with shared mute/solo/volume controls~~ ✅ (see `js/SmartTrackGrouping.js`)
7. ~~**MIDI Input Velocity Curve** - Adjust sensitivity response curve for MIDI input velocity~~ ✅ (see `js/MIDIVelocityCurve.js`)
8. ~~**Click Track Generator** - Generate custom click track with accent patterns~~ ✅
9. ~~**Track Lane Reorder** - Drag and drop to reorder track lanes in timeline~~ ✅ (see `js/TrackLaneReorder.js`)

## When Queue is Empty

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

### New Feature Ideas:

1. ~~**Audio Waveform Annotation** - Add text notes directly onto audio waveforms for collaboration comments~~ ✅
2. ~~**Clip Probability Distribution** - Assign probability of clip playing each pass for generative variations~~ ✅
3. ~~**Real-time Spectrum Visualizer** - Floating spectrum analyzer that follows playhead during recording~~ ✅
4. ~~**Track Lane Solo Mode** - Solo only selected lane(s) while keeping other lanes at reduced volume~~ ✅
5. ~~**MIDI CC Automation Lanes** - Dedicated automation lanes for MIDI CC parameters~~ ✅
6. ~~**Adaptive BPM Detection** - Analyze imported audio and suggest matching BPM automatically~~ ✅
7. ~~**Clip Fade Shape Presets** - Save custom fade curves (exponential, S-curve, logarithmic) as reusable presets~~ ✅
8. ~~**Track Color Themes** - Save/load complete track color schemes as project themes~~ ✅
9. ~~**MIDI Learn Presets** - Save and recall complete MIDI learn mappings for different hardware setups~~ ✅ (see `js/MIDILearnPresets.js`)
10. ~~**Clip Ghost Preview** - Show semi-transparent preview of selected clip at mouse position during drag operations~~ ✅

## Workflow

### Step 1: Pick Next Feature
- Read this instruction to see which feature you're on
- Work on features IN ORDER (1, then 2, then 3...)

### Step 2: Implement Feature
- Keep it SIMPLE and MINIMAL
- Follow existing code patterns
- Add necessary UI, state, and audio logic
- Test locally before committing

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
- Renumber the remaining features
- Update this instruction with new queue

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`
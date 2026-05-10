## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

**Note:** Several features below already have partial implementations that need completion or connection to the UI:
- **Send Effect Amount** - `js/Track.js` has `sendLevels = {reverb: 0, delay: 0}` and mixer has sends section
- **Track Solo Mode Toggle** - Solo is single mode only (exclusive); chain/exclusive toggle not yet UI-exposed

1. **Send Effect Amount** - Add reverb/delay send knobs to track inspector or mixer channel strip
2. **Loop Start/End Snapping** - Add snap options for loop region to clip boundaries
3. **Track Solo Mode Toggle** - Add toggle between exclusive solo (one track) and chain solo (multiple)
4. **Clip Name Inline Edit** - Double-click clip name to rename directly on timeline
5. **MIDI Velocity Quantize** - Ensure Quantize panel with velocity options is accessible

## COMPLETED FEATURES (for reference)
- ✅ Keyboard Velocity Curve - Connect `js/MIDIVelocityCurve.js` to Start menu for MIDI velocity curve editing
- ✅ Track Group Collapse - Complete collapse/expand UI for track groups in arrangement view
- ✅ Tempo Tap Visual - Animated visual showing tap tempo rhythm for visual metronome
- ✅ Track Duplicate with Offset - Duplicate track with configurable time offset for layered takes
- ✅ Clip Fade Handles - Drag handles on clip edges to adjust fade in/out with visual curve preview
- ✅ Scale Highlight Global - Show scale highlights across all tracks for harmonic consistency
- ✅ Audio Clip Stretch Markers - Visual markers showing where audio was time-stretched
- ✅ Sidechain Volume Envelope - Draw ducking volume curves directly on clips for sidechain effects
- ✅ Time Signature Per Track - Allow different time signatures per track for polyrhythmic compositions
- ✅ Lyrics Track Timeline - Timeline synced lyrics display and editing
- ✅ Loop Region Markers - Named markers at loop boundaries
- ✅ Tempo Ramper Visual - Draw tempo automation curves on canvas
- ✅ Tap History - Floating panel showing recent tap values
- ✅ MIDI Chord Display - Show chord names (Cmaj7, D7, etc.) above MIDI clips
- ✅ Piano Roll Sequencer - Full piano roll editor with clickable note editing
- ✅ Piano Roll Editor - Alternative editor with drag/move/resize notes
- ✅ Track Color Coding - Tracks have color property with color picker UI
- ✅ Waveform Visualization - Audio clips display waveforms on timeline
- ✅ Keyboard Shortcuts Panel - Press `?` or use menu to show all shortcuts

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

## When Queue is Empty

Generate 10 new feature ideas based on SnugOS DAW capabilities (Tone.js, multi-track, effects rack, sequencer, MIDI) and update this instruction with the new queue.

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`
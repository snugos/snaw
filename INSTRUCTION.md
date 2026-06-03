## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Completed Features

- **Piano Roll Editor** - Clickable piano roll with note editing, drag to move, velocity edit ✅
- **Audio Recording** - Record audio from microphone into tracks ✅
- **Track Effects Presets** - Save/load effect chain presets per track ✅
- **Undo/Redo Visual Stack** - Show undo history in a panel ✅
- **Keyboard Shortcuts Panel** - Press `?` to show all shortcuts ✅
- **Waveform Visualization** - Draw waveform on audio clips ✅
- **Track Color Coding** - Assign colors to tracks for visual grouping ✅
- **Quantize Selection** - Quantize selected notes to grid ✅
- **Tempo Ramper UI** - Draw tempo automation points for gradual tempo changes ✅
- **Ripple Edit** - When deleting, close gaps by rippling following clips ✅
- **MIDI Channel Per-Row** - Allow different rows in step sequencer to send on different MIDI channels ✅
- **Clip Gain Per-Instance** - Per-clip volume knob independent of track gain for quick level adjustments ✅
- **Step Sequencer Probability** - Each step has configurable trigger probability for generative variations ✅
- **Drum Pattern Randomizer** - Generate random but musical drum patterns from template-based algorithms ✅
- **Velocity Curve Per-Track** - Per-track velocity response curve for customizing MIDI input dynamics ✅
- **Track Latency Compensation** - Per-track adjustable delay to compensate for plugin processing latency ✅
- **MIDI CC Learn Panel** - Visual panel to assign and manage MIDI CC to virtual parameter mappings ✅
- **Audio Quantize Strength** - Control how strictly audio snaps to grid (0-100% strength slider) ✅
- **Clip Fade Handles** - Drag start/end of audio clips to set fade in/out curves ✅
- **MIDI Learn Visual Feedback** - Highlight knobs/controls that are MIDI-mapped with a glow ✅

## Current Feature Queue

1. ~~**Metronome Visual Flash** - Show a flashing indicator on beat during playback for visual timing~~ ✅ *Now shows during ANY playback*
2. **Clip Reverse** - Right-click clip to reverse audio playback direction
3. **Track Mute Automation** - Draw mute/unmute automation on tracks for conditional silencing
4. **Send Amount Knob** - Per-track send level knobs to aux sends for parallel processing
5. **MIDI Velocity Editor** - Draw velocity curve on selected notes for dynamic shaping
6. ~~**Track Solo Automation** - Draw solo/unsolo automation for section-based listening~~ ✅ *(Already implemented)*
7. **Crossfade Loop Points** - Set loop start/end within audio clip with crossfade preview
8. **BPM Tap Average Display** - Show tap tempo average with standard deviation indicator
9. **Quick Volume Ramp** - Drag track volume to create quick fade in/out shapes
10. **Keyboard octave display** - Show current octave shift value in transport bar

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
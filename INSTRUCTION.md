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
- **Track Mute Automation** - Draw mute/unmute automation on tracks for conditional silencing ✅
- **BPM Tap Average Display** - Show tap tempo average with standard deviation indicator ✅
- **MIDI Velocity Editor** - Draw velocity curve on selected notes for dynamic shaping ✅
- **Crossfade Loop Points** - Set loop start/end within audio clip with crossfade preview ✅
- **Tuner** - Live microphone pitch detection panel with note/frequency/cents display ✅
- **Detune Per-Track** - Per-track fine detune (±100 cents) via Tone.PitchShift for parallel layering and stereo width tricks ✅

## Current Feature Queue

1. **Loop Practice Trainer** - Set loop region, count loops, track best/avg time-to-nail
2. **Track Notes Panel** - Per-track text notes (lyrics, mix notes, performance cues) stored in project
3. **One-Shot Preview Pad** - Click a pad to hear a track's currently active sequence without entering playback
4. **Bounce To Track** - Render selected tracks/clips to a new audio track in place
5. **MIDI Panic Button** - Send all-notes-off + reset controllers to all MIDI outputs (one-click panic)
6. **Drum Kit Piece Selector** - Quickly swap drum kit pieces in a Sampler (Pads) track from a curated list
7. **Loudness Meter (LUFS)** - Show integrated/short-term LUFS on master with true-peak readout
8. **Sends Overview Panel** - Visual matrix of send levels from every track to every send bus
9. **Step Sequencer Note Length** - Set default note length per step in the step sequencer (e.g., 1/16, 1/8, 1/4)

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
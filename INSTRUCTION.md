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

## Current Feature Queue

1. **Audio Quantize Strength** - Control how strictly audio snaps to grid (0-100% strength slider)
2. **Clip Fade Handles** - Drag start/end of audio clips to set fade in/out curves
3. **MIDI Learn Visual Feedback** - Highlight knobs/controls that are MIDI-mapped with a glow

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

Run this brainstorming process:

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

Output as numbered list and update this instruction.
```

## Rules

- ONE feature per run
- NO bug fixing (that's the other agent's job)
- If you can't complete a feature, skip it and move to next
- Always commit working code
- Keep features minimal and focused

## Context Files
- Repo: `/home/workspace/app-repaired`
- Main files: `js/main.js`, `js/state.js`, `js/ui.js`, `js/audio.js`, `index.html`
## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Rename Hotkey (F2)** - Press F2 to rename selected track inline
2. **Arrangement Navigator Mini-Map** - Overview mini-map of full arrangement for quick navigation
3. **MIDI Velocity Randomizer** - Add random variation to MIDI note velocities for humanization
4. **Crossfade Loop Preview** - Preview loop transitions before committing
5. **Track Freeze** - Freeze track to audio to reduce CPU usage
6. **MIDI Chord Splitter** - Split chord MIDI input into separate notes on different tracks
7. **BPM/Ratio Calculator** - Calculate BPM relationships between tracks (e.g., 120 BPM split into 3 against 140 BPM)
8. **Quick Quantize Panel** - Floating panel with common quantize values (1/4, 1/8, 1/16, 1/4T, 1/8T)
9. **Audio Bit-Depth Display** - Show current audio bit-depth in status bar
10. **Track Duplicate with Offset** - Duplicate track with option for time/pitch offset

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
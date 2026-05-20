## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~Track Compressor Limiter~~ ✅
2. **MIDILearn Indicator** - Highlight which parameters are currently MIDI-mapped with a pulsing indicator
3. **Audio Phase Flip** - Instantly flip the phase of an audio clip by 180 degrees
4. **Clip Start Offset** - Shift the start point of a clip within its timeline slot without moving the clip
5. **Track Noise Gate** - Add a noise gate with threshold, attack, hold, release, and range controls
6. **Grid Snap Intensity** - Slider to control how strongly clips snap to grid (0% = free placement, 100% = full snap)
7. **MIDI Program Change** - Send MIDI program change messages to change patch on external synths
8. **Click Track Export** - Bounce just the metronome/click to a separate audio file
9. **Tempo Tap Visual** - Show a visual representation of tap tempo pattern (shows if you're on beat)
10. **Track Color Palette** - Quick-access color swatches to change track colors

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
## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Quick Swap** - Right-click two track headers to swap their positions instantly
2. **Metronome Sound Selector** - Choose different click sounds (wooden, electronic, voice count)
3. **Tempo Jump Markers** - Set quick tempo jump points during playback with single click
4. **Clip Fade Shape Presets** - Choose fade curves: linear, exponential, S-curve, logarithmic
5. **Track Mute Automation** - Draw mute/unmute automation points on any track
6. **Quick Track Color** - Right-click track header for fast color picker palette
7. **Clip Start/End Fine Tune** - Hold Shift + drag clip edge for pixel-perfect trim
8. **Mute Selected Tracks** - Press M to mute/unmute all currently selected tracks
9. **Project Template Quick Save** - Save current project state as template with one shortcut
10. **Scale Highlight Intensity** - Slider to adjust how prominently scale notes are highlighted

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
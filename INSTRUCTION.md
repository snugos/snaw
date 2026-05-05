## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~**BPM Tap Avg Display** - Show rolling average of last N tap tempo values in transport bar~~ ✅ COMPLETED
2. **Track Freeze Export** - One-click export of frozen track stems to audio files
3. **MIDI Chord Display** - Show chord names (Cmaj7, D7, etc.) above MIDI clip sections
4. **Audio Clip Stretch Markers** - Visual markers showing where audio was time-stretched
5. **Scale Highlight Global** - Show scale highlights across all tracks for harmonic consistency

## COMPLETED FEATURES (for reference)
- ✅ Sidechain Volume Envelope - Draw ducking volume curves directly on clips for sidechain effects
- ✅ Time Signature Per Track - Allow different time signatures per track for polyrhythmic compositions
- ✅ Lyrics Track Timeline - Timeline synced lyrics display and editing
- ✅ Loop Region Markers - Named markers at loop boundaries
- ✅ Tempo Ramper Visual - Draw tempo automation curves on canvas
- ✅ Tap History - Floating panel showing recent tap values

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
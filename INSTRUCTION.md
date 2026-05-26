## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Freeze Quick Toggle** - Instantly freeze/unfreeze selected track to save CPU
2. **Ghost Track Signals** - Show faint waveform overlay of other tracks for visual reference while mixing
3. **Mixer Channel Strip Presets** - Save/load complete channel strip settings (gain, pan, EQ, sends)
4. **MIDI Velocity Curve Editor** - Adjust how hard/soft notes map to velocity response
5. **BPM Tap Tempo** - Tap to set tempo manually by clicking rhythm
6. **Audio Normalizer** - Automatic loudness normalization for imported audio clips
7. **Track Icon Picker** - Assign visual icons to tracks for quick identification
8. **Groove Extractor** - Extract timing/velocity groove from audio and apply to other clips
9. **Count-in Metronome** - Play count-in bars before recording starts
10. **Loop Region Quick Set** - Set loop start/end by clicking timeline positions

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

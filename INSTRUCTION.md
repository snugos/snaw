## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **MIDI Guitar Tab Editor** - Draw guitar tablature with bend/pull-up icons, export as MIDI
2. **Track AB Compare** - A/B toggle between original and processed audio on the same track
3. **Audio-to-MIDI Converter** - Monophonic pitch detection to convert recorded audio to MIDI notes
4. **Collaborative Session Link** - Generate a shareable URL to invite others to a live session
5. **Track Group with Group FX** - Group multiple tracks into a sub-mix with shared effects chain
6. **Piano Roll Step Sequencer View** - Toggle between piano roll and step sequencer grid display
7. **Clip Automation Envelope** - Draw volume/pan automation directly on audio clips
8. **Modular Patch Bay** - Visual node-based routing graph for complex audio chains
9. **Groove Quantize Template** - Save swing/shuffle grids and apply them to any track
10. **Sidechain Punch-In** - Record audio while monitoring a specific track's signal as cue

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
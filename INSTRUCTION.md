## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Chord Trigger Mode** - Play a chord by pressing a single key, with configurable voicings
2. **Sampler Loop Trim** - Visual waveform editor to set exact loop start/end points in sampler clips
3. **Track Ghost Signals** - Show faint visual overlay of other tracks' waveforms for visual reference
4. **Clip Probability** - Set random chance (0-100%) for each clip to play, for generative variations
5. **Send Effects Reorder** - Drag to reorder send effect slots in the mixer
6. **Velocity Scaling** - Shift all note velocities in a selection up/down by a percentage
7. **Timeline Ruler Click** - Click on the timeline ruler/bar to jump playhead to that position
8. **Export Stems with Effects** - Export individual track stems with their effect chains applied
9. **Pattern Chaining** - Chain multiple patterns together to play in sequence automatically
10. **AI Mixing Suggestions** - Analyze mix and suggest volume/pan/EQ corrections

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
## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

All 10 features from the previous queue have been implemented. New queue:

1. **Audio Clip Reverse** - Add a button/menu item to reverse audio clips in place for creative effect
2. **Track Freeze with Effects** - Freeze a track to audio including all effect processing
3. **MIDI Velocity Editor** - Visual lane to adjust velocities of selected MIDI notes with a brush tool
4. **Automation Curve Types** - Support for different curve interpolation (linear, exponential, S-curve, stepped)
5. **Sample Rate Conversion** - Convert project sample rate for export (44.1kHz to 48kHz etc.)
6. **Track Grouping** - Group tracks together so they can be selected/muted/soloed as one unit
7. **Clip Color Themes** - Apply color themes to audio/MIDI clips based on content type
8. **Mixer Snapshot Presets** - Save and recall complete mixer fader/pan settings as presets
9. **Audio Buffer Size Settings** - UI to adjust audio buffer size for latency/performance tradeoff
10. **Export Selection** - Export only selected tracks or loop region to audio file

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
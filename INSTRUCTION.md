## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~**Track Ghost Signals**~~ ✅
2. ~~**Clip Probability**~~ ✅ - Set random chance (0-100%) for each clip to play
3. ~~**Send Effects Reorder**~~ ✅ - Drag to reorder send effect slots in mixer
4. ~~**Velocity Scaling**~~ ✅ - Shift note velocities in selection up/down
5. ~~**Timeline Ruler Click**~~ ✅ - Click ruler to jump playhead
6. ~~**Export Stems with Effects**~~ ✅ - Export stems with effect chains
7. ~~**Pattern Chaining**~~ ✅ - Chain patterns for sequence playback
8. ~~**AI Mixing Suggestions**~~ ✅ - Analyze mix and suggest corrections
9. ~~**MIDI Polyphonic Expression**~~ ✅ - Per-note pitch bend/modulation
10. ~~**Track Color Coding**~~ ✅ - Assign colors to tracks
11. ~~**Audio Buffer Preview**~~ ✅ - Hover over audio clip to preview 2 seconds

## NEW Feature Queue (2026-05-14)

1. **Metronome Visual Flash** - Flash indicator on beat during playback
2. **Multi-Select Delete** - Select multiple clips and delete together
3. **Effect Bypass Hotkey** - Toggle effect bypass with keyboard shortcut
4. **Loop Region Nudge** - Nudge loop region start/end with arrow keys
5. **Save Window Layout** - Save and restore custom window arrangements

## When Queue Empty - Generate New Features

Based on SnugOS being a browser-based DAW with:
- Tone.js audio engine
- Multi-track timeline
- Effects rack
- Sequencer mode
- MIDI support

**10 NEW Feature Ideas:**

1. **Clip Reverse Audio** - One-click reverse audio clips in timeline
2. **Step Sequencer Grid Size** - Adjust step count per pattern (8/16/32/64)
3. **Track Solo Mode Toggle** - Toggle between solo-in-place and solo-exclusive modes
4. **Metronome Visual Flash** - Flash indicator on beat during playback
5. **Audio Buffer Preview** - Hover over audio clip to preview 2 seconds
6. **Multi-Select Delete** - Select multiple clips and delete together
7. **Effect Bypass Hotkey** - Toggle effect bypass with keyboard shortcut
8. **Loop Region Nudge** - Nudge loop region start/end with arrow keys
9. **Track Duplicate** - Duplicate track with all settings and clips
10. **Save Window Layout** - Save and restore custom window arrangements

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
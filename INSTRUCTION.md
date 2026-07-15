## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Renumber Shortcut** - Press `Shift+R` on a selected track to open a small inline prompt that lets you renumber the track (e.g. move it to position 1) and rename it; updates all clip references
2. **Master Output Meter Bridge** - Add a small peak/RMS meter in the transport bar that shows the master output level (mono sum) with a hold-and-decay indicator
3. **Pre-Roll Count-In Toggle** - Add a "Pre-roll 1 bar" toggle in transport settings that plays a click-only count-in (no audio playback) for one bar at the current tempo before recording starts; mirrors the established Metronome visual accents
4. **Track Activity LED** - Add a tiny per-track LED in the track header that flashes green when the track emits audio above a threshold, amber when it clips; great for live monitoring in a mix with many tracks

## Workflow

### Step 1: Pick Next Feature
- Read this instruction to see which feature you're on
- Work on features IN ORDER (1, then 2, then 3...)

### Step 2: Implement Feature
- Keep it SIMPLE and MINIMAL
- Follow existing code patterns (look at e.g. `QuickBounce.js`, `AudioClipLabeling.js`, `SoloMuteShortcuts.js` for the IIFE + init(appServices) + window export pattern)
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
- 576+ feature modules already shipped

Generate 10 NEW feature ideas that are:
1. Achievable in a single session
2. Complement existing features (don't duplicate what already exists in /home/workspace/app-repaired/js/)
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
- 576+ existing feature modules in `js/` (grep to check before naming a new feature)

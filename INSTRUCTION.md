## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

Queue item 1 shipped as v0.4.26 Metronome Accent Pattern. The next builder run should pick candidate 1 below.

1. **Selection Bookmark Slots** — save and recall up to four timeline selection ranges, including start/end and track scope, without changing the project arrangement.
2. **MIDI Note Channel Inspector** — show and edit the MIDI channel of selected piano-roll notes, defaulting to channel 1 for new notes.
3. **Recording Take Labels** — automatically label each newly recorded clip with a sequential take number and recording timestamp while preserving manual renaming.
4. **Missing Audio Asset Scan** — add a small project command that lists clips whose audio buffer is unavailable and identifies the affected track and clip name.
5. **Master Mono Audition Toggle** — add a reversible master-monitor control that sums the output to mono for quick compatibility checks without changing the project mix.
6. **Track Input Source Badge** — show the active input source and monitoring state directly in the track header, with a tooltip for the complete routing path.
7. **Snapshot Compare Summary** — compare the current project to a selected saved snapshot and show concise counts for changed tracks, clips, tempo, and effects.

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

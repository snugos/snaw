## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

Queue empty — the Pre-Roll Count-In Toggle and Track Activity LED are shipped. For the next feature-builder run, brainstorm 10 new single-session workflow ideas before implementation.

### Brainstorm candidates

1. **Marker color legend** — show a compact legend for semantic timeline-marker colors.
2. **Clip audition hotkey** — preview the selected clip from its start without changing transport position.
3. **Track header meter peak hold** — show the last peak value beside each track LED.
4. **Tempo nudge history** — undo the last few tempo nudges as a compact history list.
5. **Record-arm status tooltip** — show the armed track name and input-monitor state on the record control.
6. **Loop-region duration badge** — show loop length in seconds and bars beside the loop controls.
7. **MIDI input activity badge** — show the last received MIDI channel beside the input selector.
8. **Selected-clip inspector shortcut** — open the inspector for the current clip with one keyboard command.
9. **Project dirty-state indicator** — show when the current project has unsaved changes.
10. **Mixer channel focus shortcut** — jump keyboard focus to the selected track’s mixer controls.

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

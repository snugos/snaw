## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Track Notes Sidebar** - Per-track plain-text notes panel; click a small 📝 button in the track header to open an inline textarea (separate from `TrackNotes.js` which is for project notes)
2. **Smart Undo Description** - When undoing/redoing, briefly show a floating "↶ Undid: Delete Clip" / "↷ Redid: Move Clip" toast so the action is named
3. **Project Tempo Tap Display** - Already-existing TapTempo is per-track; add a small "TAP" button in the transport bar that sets the project BPM from a 4-tap average
4. **Duplicate Track with Clones** - "Duplicate Track with Clones" right-click action that copies the source track AND clones every timeline clip on it (1-shot, no repeats)
5. **Clip Fades Indicator** - When a clip has a fade-in or fade-out, draw a small ⤴/⤵ triangle badge in the clip header so it's visible without opening the clip
6. **Loop Region Bar Marker** - When a loop region is active, show a small "A→B" label floating in the transport bar with the loop start/stop times
7. **Project Session Timer** - Add an "MM:SS" elapsed-since-load timer to the status bar that updates once per second; click to reset
8. **Mute-Others Solo Shortcut** - Press `Shift+S` on a selected track to solo ONLY that track and temporarily mute every other track (toggle off with same shortcut)

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
- 568+ feature modules already shipped

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
- 568+ existing feature modules in `js/` (grep to check before naming a new feature)

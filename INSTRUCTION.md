## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. **Project Session Timer** - Add an "MM:SS" elapsed-since-load timer to the status bar that updates once per second; click to reset
2. **Mute-Others Solo Shortcut** - Press `Shift+S` on a selected track to solo ONLY that track and temporarily mute every other track (toggle off with same shortcut)
3. **Quick Project Snapshot List** - Add a small panel listing the last 5 saved project snapshots (auto-saved + manual) so producers can pick a previous state without opening the file dialog
4. **Inline Track Number Labels** - Add small "1", "2", "3" keyboard-numeral labels next to each track header so producers can see which number key triggers the corresponding track (e.g. for arming/solo shortcuts)
5. **Recent Project File History** - Store a localStorage list of the last 5 loaded/saved project file names and show them in a "Recent" submenu of the project menu
6. **Transport Bar Master Output Meter** - Add a small L/R horizontal meter in the transport bar showing master output peaks (post-master-fader, pre-limiter) updated on every audio frame
7. **Last-Used Effect Preset Memory** - Remember the last effect preset used per-effect-type and offer it as a "Last used" quick-pick at the top of the preset dropdown

8. **Track Renumber Shortcut** - Press `Shift+R` on a selected track to open a small inline prompt that lets you renumber the track (e.g. move it to position 1) and rename it; updates all clip references
9. **Master Output Meter Bridge** - Add a small peak/RMS meter in the transport bar that shows the master output level (mono sum) with a hold-and-decay indicator
10. **Quick Marker Set** - Press `M` during playback to drop a numbered marker at the current playhead; `Shift+M` removes the last marker; marker list shown in a tiny popover

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

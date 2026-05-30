## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~**Clickable Piano Roll** - Make the piano roll editor notes click-draggable for repositioning~~ ✅ Done
2. ~~**MIDI File Import** - Drag & drop .mid files onto tracks to import MIDI data~~ ✅ Done
3. ~~**MIDI File Export** - Export selected MIDI patterns as .mid files~~ ✅ Done
4. ~~**Plugin Preset Browser** - Browse and load VST3/AudioWorklet plugin presets from a panel~~ ✅ Done
5. ~~**Track Effects Presets** - Save/load effect chain configurations as named presets per track~~ ✅ Done
6. ~~**Keyboard Shortcuts Panel** - Full keyboard shortcuts reference panel (press `?` to show)~~ ✅ Done
7. ~~**Waveform Overview** - Mini overview waveform in track header showing full clip range~~ ✅ Done
8. ~~**Track Color Coding** - Assign custom colors from palette to tracks for visual grouping~~ ✅ Done

## Next Features Queue

1. ~~**Tempo Per Track** - Allow different tracks to have independent playback rates/tempo multipliers~~ ✅ Done
2. ~~**Audio Scrubbing** - Click and drag on timeline to scrub audio with preview~~ ✅ Done
3. ~~**Track Snap Resolution** - Per-track snap-to-grid sensitivity settings~~ ✅ Done
4. ~~**Loop Region Presets** - Save and recall loop region positions as named presets~~ ✅ Done
5. ~~**Ghost Notes Preview** - Show MIDI ghost notes from other tracks while recording~~ ✅ Done
6. ~~**Scale Quantize Panel** - Dedicated panel to set scale/key and quantize notes accordingly~~ ✅ Done
7. ~~**Tap Tempo Visual** - Visual tap tempo with average display and beat confirmation~~ ✅ Done
8. ~~**Lyrics Track** - Dedicated track type for storing and displaying song lyrics~~ ✅ Done
9. ~~**Marker Navigation** - Add named markers for quick navigation to specific positions~~ ✅ Done
10. ~~**Auto-save Indicator** - Visual indicator showing when project was last auto-saved~~ ✅ Done

## New Features Queue

1. ~~**Arpeggiator Pattern Panel** - Visual panel showing arpeggiator pattern with step editing~~ ✅ Done
2. **Audio Normalization** - One-click loudness normalization for tracks and clips
3. **Tempo Tap History** - List of recent tap tempo values with one-click recall
4. **Track Import/Export** - Export single track as project file and import into other projects
5. **Clip Fade Curve Types** - Choose between linear, exponential, logarithmic fade curves
6. **Bounce Selected to Audio** - Render selected clips to audio track
7. ~~**Metronome Count-In Settings** - Configure count-in bars, sound, and visual countdown~~ ✅ Done
8. **Keyboard Octave Shift** - Quick octave up/down buttons for MIDI keyboard input
9. **Timeline Zoom Memory** - Remember zoom level per project
10. **Clip Choppper Grid** - Slice audio clip with automatic grid-based slice points

When queue is empty, run the brainstorming process described in Step 5.

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
## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Current Feature Queue

1. ~~**Lyrics Track Display**~~ ✅ - Display karaoke-style lyrics synced to playback timeline (ENHANCED: js/LyricsDisplay.js updated with Tone.Transport integration)
2. ~~**Drum Pattern Splitter**~~ ✅ - AI-powered separation of drum tracks into kick/snare/hihat components (implemented: c38f1a0)
3. **Clip Stretch with Handles** - Drag clip edges to stretch/squash audio non-destructively
4. **Track Compressor Visualizer** - Real-time gain reduction meter on track compressor
5. **MIDI Polyphonic Expression** - Per-note pitch bend and modulation for expressive MIDI
6. **Project Templates Gallery** - Browse and preview project templates with audio demos
7. **Multi-Timeline Views** - Save and switch between different visible track arrangements
8. **Audio Waveform Overview** - Mini overview of full project waveform above timeline
9. **Track Mute Group Hierarchy** - Nested mute groups for complex routing
10. **One-Shot Sample Trigger** - Map one-shot samples to keys with choke groups support

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
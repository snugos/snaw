## Task: Snaw Feature Builder Agent

You are the feature addition agent for SnugOS DAW (snugos/snaw). Your ONLY job is to add new features — no bug fixing.

## Completed Features

- **Piano Roll Editor** - Clickable piano roll with note editing, drag to move, velocity edit ✅
- **Audio Recording** - Record audio from microphone into tracks ✅
- **Track Effects Presets** - Save/load effect chain presets per track ✅
- **Undo/Redo Visual Stack** - Show undo history in a panel ✅
- **Keyboard Shortcuts Panel** - Press `?` to show all shortcuts ✅
- **Waveform Visualization** - Draw waveform on audio clips ✅
- **Track Color Coding** - Assign colors to tracks for visual grouping ✅
- **Quantize Selection** - Quantize selected notes to grid ✅
- **Tempo Ramper UI** - Draw tempo automation points for gradual tempo changes ✅
- **Ripple Edit** - When deleting, close gaps by rippling following clips ✅
- **MIDI Channel Per-Row** - Allow different rows in step sequencer to send on different MIDI channels ✅
- **Clip Gain Per-Instance** - Per-clip volume knob independent of track gain for quick level adjustments ✅
- **Step Sequencer Probability** - Each step has configurable trigger probability for generative variations ✅
- **Drum Pattern Randomizer** - Generate random but musical drum patterns from template-based algorithms ✅
- **Velocity Curve Per-Track** - Per-track velocity response curve for customizing MIDI input dynamics ✅
- **Track Latency Compensation** - Per-track adjustable delay to compensate for plugin processing latency ✅
- **MIDI CC Learn Panel** - Visual panel to assign and manage MIDI CC to virtual parameter mappings ✅
- **Audio Quantize Strength** - Control how strictly audio snaps to grid (0-100% strength slider) ✅
- **Clip Fade Handles** - Drag start/end of audio clips to set fade in/out curves ✅
- **MIDI Learn Visual Feedback** - Highlight knobs/controls that are MIDI-mapped with a glow ✅
- **Track Mute Automation** - Draw mute/unmute automation on tracks for conditional silencing ✅
- **BPM Tap Average Display** - Show tap tempo average with standard deviation indicator ✅
- **MIDI Velocity Editor** - Draw velocity curve on selected notes for dynamic shaping ✅
- **Crossfade Loop Points** - Set loop start/end within audio clip with crossfade preview ✅
- **Tuner** - Live microphone pitch detection panel with note/frequency/cents display ✅
- **Detune Per-Track** - Per-track fine detune (±100 cents) via Tone.PitchShift for parallel layering and stereo width tricks ✅
- **Loop Practice Trainer** - Set loop region, count loops, track best/avg time-to-nail ✅
- **Track Notes Panel** - Per-track text notes (lyrics, mix notes, performance cues) stored in project ✅
- **One-Shot Preview Pad** - Click a pad to hear a track's currently active sequence without entering playback ✅
- **MIDI Panic Button** - Send all-notes-off + reset controllers to all MIDI outputs (one-click panic) ✅
- **Step Sequencer Note Length** - Set default note length per step in the step sequencer (e.g., 1/16, 1/8, 1/4) ✅
- **Bounce To Track** - Render a track or selected clips to a new audio track in place ✅
- **Drum Kit Piece Selector** - Quickly swap drum kit pieces in a Sampler (Pads) track from a curated list ✅
- **Audio Recording Panel UI** - Start menu entry + dockable panel with track selector and Start/Stop controls (v0.3.55) ✅
- **Loudness Meter (LUFS + true-peak dBTP)** - Draggable panel with momentary/short-term/integrated LUFS, true peak, true peak hold (v0.3.59) ✅
- **Sends Overview Panel** - Visual matrix of send levels from every track to every send bus (v0.3.60) ✅
- **Mark Track As Bass / Drums / Vocal** - Quick-classify tracks for smart mix presets ✅
- **Export Region Selection** - Export a specific time region (full project / loop region / between two markers / custom time range) (v0.3.62) ✅
- **Loop Until Marker** - Extend the active loop region to the next/previous timeline marker (or both adjacent markers); works against Timeline Markers, Loop Region Markers, and state.js markers with auto-merge/dedup; optional auto-mode that re-snaps the loop end when the playhead crosses it (v0.3.63) ✅
- **Project Search** - Search all track names + clip names + notes for a substring ✅
- **Drum Pad Trigger Mouse-Over** - When the one-shot preview pad is open, mouse-over each pad to highlight the note name and velocity range; click a single pad to preview just that pad in isolation (v0.3.71) ✅
- **Click Track Volume Slider** - Independent volume control for the metronome click that doesn't affect the project audio (v0.3.77) ✅
- **Quick Bounce (in-place)** - Ctrl/Cmd+Shift+B skips the bounce dialog and immediately renders selected clips (or all clips on the first non-empty track if nothing is selected) to audio in place (v0.3.78) ✅

## Completed Features (recent)

- **Master Limiter Toggle** - Quick on/off for a brick-wall master limiter to catch overs ✅
- **Track Reorder Hotkeys** - Alt+ArrowUp / Alt+ArrowDown to move the active track one slot up/down in the track list (v0.3.70) ✅
- **Mix-Bus Group Presets** - Save the entire group+send+fx+volume state of a group of tracks as a preset you can re-apply (v0.3.72) ✅

- **Plugin Bypass Per-Track** - Per-track effect-chain bypass (mixer B button + right-click context menu); sources route directly to gainNode while effect settings/params are preserved (v0.3.73) ✅
- **Tap Tempo MIDI Clock In** - Use a MIDI controller pad as the tap-tempo source instead of the keyboard `T` ✅
- **Track Folder Collapse Memory** - Remember collapsed state of track folders across sessions ✅

## Current Feature Queue

1. **Quick-Bounce Markers** - Mark two timeline points and one-click render just the audio between them to a new track
2. **Drag-to-Reorder Master FX** - Drag master-bus effects in the effects rack to reorder them
3. **Performance Mode Recall** - Save the current panel layout (open/closed/minimized state for every dockable panel) as a "Performance Mode" you can recall
4. **Tooltips On Hover For Toolbar Buttons** - Show the keyboard shortcut and a one-line description for every toolbar button on mouseover

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
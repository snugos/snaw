// js/MidiFileIO.js - Standard MIDI File (.mid) parser and writer
// Pure data utilities - no UI, no Tone.js dependency. Used by MidiFilePanel.
//
// Standard MIDI File format reference: http://www.midi.org/techspecs/midi_files.php
//
// Supports: format 0 (single track) and format 1 (multi-track) with Note On/Off events.
// Reads tempo (meta 0x51) and time signature (meta 0x58) from the first track if present.

const MTHD_HEADER = [0x4d, 0x54, 0x68, 0x64]; // "MThd"
const MTRK_HEADER = [0x4d, 0x54, 0x72, 0x6b]; // "MTrk"

// Read a variable-length quantity (VLQ) starting at offset
function readVLQ(bytes, offset) {
    let value = 0;
    let bytesRead = 0;
    while (true) {
        if (offset + bytesRead >= bytes.length) throw new Error('Unexpected end of file in VLQ');
        const b = bytes[offset + bytesRead];
        value = (value << 7) | (b & 0x7f);
        bytesRead += 1;
        if ((b & 0x80) === 0) break;
        if (bytesRead > 4) throw new Error('VLQ too long (>4 bytes)');
    }
    return { value, length: bytesRead };
}

function writeVarLen(value) {
    if (value < 0) value = 0;
    // Build bytes from low-order 7-bit groups; high bit set on all but last
    const buffer = [value & 0x7f];
    while ((value >>= 7) > 0) {
        buffer.unshift((value & 0x7f) | 0x80);
    }
    return buffer;
}

function readUint32BE(bytes, offset) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUint16BE(bytes, offset) {
    return ((bytes[offset] << 8) | bytes[offset + 1]) & 0xffff;
}

function writeUint32BE(n) {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function writeUint16BE(n) {
    return [(n >>> 8) & 0xff, n & 0xff];
}

// Decode a single MTrk chunk into an array of { delta, type, data, ... } events
function decodeTrack(bytes) {
    const events = [];
    let pos = 0;
    let runningStatus = 0;
    while (pos < bytes.length) {
        const { value: delta, length: dl } = readVLQ(bytes, pos);
        pos += dl;
        if (pos >= bytes.length) {
            events.push({ delta, type: 'eof' });
            break;
        }
        let status = bytes[pos];
        if (status < 0x80) {
            // Use running status
            status = runningStatus;
        } else {
            pos += 1;
        }
        if (status === 0xff) {
            // Meta event
            const metaType = bytes[pos]; pos += 1;
            const { value: metaLen, length: ml } = readVLQ(bytes, pos);
            pos += ml;
            const metaData = bytes.slice(pos, pos + metaLen);
            pos += metaLen;
            runningStatus = 0; // Meta events clear running status
            if (metaType === 0x2f) {
                events.push({ delta, type: 'endOfTrack' });
                break;
            } else if (metaType === 0x51 && metaData.length >= 3) {
                const micros = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
                events.push({ delta, type: 'tempo', bpm: Math.round((60000000 / micros) * 1000) / 1000 });
            } else if (metaType === 0x58 && metaData.length >= 4) {
                events.push({ delta, type: 'timeSignature', numerator: metaData[0], denominator: Math.pow(2, metaData[1]) });
            } else if (metaType === 0x03) {
                events.push({ delta, type: 'trackName', name: String.fromCharCode(...metaData) });
            } else {
                events.push({ delta, type: 'meta', metaType, data: metaData });
            }
        } else if (status === 0xf0 || status === 0xf7) {
            // SysEx
            const { value: sysexLen, length: sl } = readVLQ(bytes, pos);
            pos += sl;
            events.push({ delta, type: 'sysex', data: bytes.slice(pos, pos + sysexLen) });
            pos += sysexLen;
            runningStatus = 0;
        } else {
            const eventType = status & 0xf0;
            const channel = status & 0x0f;
            runningStatus = status;
            if (eventType === 0x90 || eventType === 0x80 || eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
                // 2 data bytes
                if (pos + 1 >= bytes.length) break;
                const d1 = bytes[pos]; const d2 = bytes[pos + 1];
                pos += 2;
                if (eventType === 0x90 && d2 > 0) {
                    events.push({ delta, type: 'noteOn', channel, note: d1, velocity: d2 });
                } else if (eventType === 0x80 || (eventType === 0x90 && d2 === 0)) {
                    events.push({ delta, type: 'noteOff', channel, note: d1 });
                } else {
                    events.push({ delta, type: 'other', eventType, channel, data: [d1, d2] });
                }
            } else if (eventType === 0xc0 || eventType === 0xd0) {
                if (pos >= bytes.length) break;
                events.push({ delta, type: 'other', eventType, channel, data: [bytes[pos]] });
                pos += 1;
            } else {
                // Unknown - abort
                break;
            }
        }
    }
    return events;
}

/**
 * Parse a Standard MIDI File (.mid) from an ArrayBuffer.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{
 *   format: number,
 *   ticksPerBeat: number,
 *   bpm: number,
 *   timeSignature: { numerator: number, denominator: number },
 *   tracks: Array<{ name: string, notes: Array<{ midi: number, time: number, duration: number, velocity: number, channel: number }> }>
 * }}
 */
export function parseMidiFile(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    // Validate MThd
    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== MTHD_HEADER[i]) {
            throw new Error('Not a valid MIDI file: missing MThd header');
        }
    }
    const headerLen = readUint32BE(bytes, 4);
    if (headerLen !== 6) throw new Error(`Unexpected MThd length: ${headerLen} (expected 6)`);
    const format = readUint16BE(bytes, 8);
    const numTracks = readUint16BE(bytes, 10);
    const ticksPerBeat = readUint16BE(bytes, 12);
    if (ticksPerBeat & 0x8000) {
        throw new Error('SMPTE-timed MIDI files are not supported');
    }

    // Read all MTrk chunks
    let pos = 14;
    const rawTracks = [];
    while (pos + 8 <= bytes.length && rawTracks.length < numTracks) {
        for (let i = 0; i < 4; i++) {
            if (bytes[pos + i] !== MTRK_HEADER[i]) {
                throw new Error(`Expected MTrk header at byte ${pos}`);
            }
        }
        const trackLen = readUint32BE(bytes, pos + 4);
        const trackBytes = bytes.slice(pos + 8, pos + 8 + trackLen);
        rawTracks.push(decodeTrack(trackBytes));
        pos += 8 + trackLen;
    }

    // Extract global tempo/time signature from first track
    let bpm = 120;
    let timeSignature = { numerator: 4, denominator: 4 };
    if (rawTracks.length > 0) {
        for (const e of rawTracks[0]) {
            if (e.type === 'tempo') bpm = e.bpm;
            else if (e.type === 'timeSignature') timeSignature = { numerator: e.numerator, denominator: e.denominator };
        }
    }

    // Convert each track to a list of notes with absolute times
    const tracks = rawTracks.map((events, ti) => {
        let tick = 0;
        const activeNotes = new Map(); // key: "channel-note" -> { startTick, velocity, channel }
        const notes = [];
        let trackName = `Track ${ti + 1}`;
        for (const e of events) {
            tick += e.delta;
            if (e.type === 'trackName') {
                trackName = e.name.trim() || trackName;
            } else if (e.type === 'noteOn') {
                const key = `${e.channel}-${e.note}`;
                activeNotes.set(key, { startTick: tick, velocity: e.velocity, channel: e.channel });
            } else if (e.type === 'noteOff') {
                const key = `${e.channel}-${e.note}`;
                const start = activeNotes.get(key);
                if (start) {
                    notes.push({
                        midi: e.note,
                        time: start.startTick / ticksPerBeat,
                        duration: (tick - start.startTick) / ticksPerBeat,
                        velocity: start.velocity,
                        channel: start.channel
                    });
                    activeNotes.delete(key);
                }
            }
        }
        return { name: trackName, notes };
    });

    return { format, ticksPerBeat, bpm, timeSignature, tracks };
}

/**
 * Build a Standard MIDI File from a list of tracks. Each track has notes
 * with the same shape as returned by parseMidiFile.
 *
 * @param {Array<{ name: string, notes: Array<{midi: number, time: number, duration: number, velocity: number, channel: number}> }>} tracks
 * @param {{ bpm?: number, ticksPerBeat?: number, includeTempo?: boolean }} options
 * @returns {Uint8Array}
 */
export function buildMidiFile(tracksOrObj, options = {}) {
    const tracks = Array.isArray(tracksOrObj) ? tracksOrObj : (tracksOrObj && tracksOrObj.tracks ? tracksOrObj.tracks : []);
    const ticksPerBeat = options.ticksPerBeat || 480;
    const bpm = options.bpm || 120;
    const includeTempo = options.includeTempo !== false;

    // Tempo track (format 1 only)
    const tempoTrack = [];
    if (includeTempo) {
        const micros = Math.round(60000000 / bpm);
        tempoTrack.push({ delta: 0, type: 'tempo', micros });
        tempoTrack.push({ delta: 0, type: 'endOfTrack' });
    }

    // Build each note track
    const noteTracks = tracks.map(t => {
        const events = [];
        // Sort notes by start tick
        const sortedNotes = t.notes.slice().sort((a, b) => a.time - b.time);
        let lastTick = 0;
        for (const n of sortedNotes) {
            const startTick = Math.round(n.time * ticksPerBeat);
            const endTick = Math.round((n.time + n.duration) * ticksPerBeat);
            const velocity = Math.max(1, Math.min(127, Math.round((n.velocity || 0.8) * 127)));
            const midi = Math.max(0, Math.min(127, n.midi | 0));
            const channel = Math.max(0, Math.min(15, n.channel || 0));
            events.push({ delta: startTick - lastTick, type: 'noteOn', channel, note: midi, velocity });
            lastTick = startTick;
            events.push({ delta: endTick - lastTick, type: 'noteOff', channel, note: midi });
            lastTick = endTick;
        }
        events.push({ delta: 0, type: 'endOfTrack' });
        return events;
    });

    // Encode MTrk
    function encodeTrack(events) {
        const out = [];
        for (const e of events) {
            out.push(...writeVarLen(Math.max(0, e.delta | 0)));
            if (e.type === 'noteOn') {
                out.push(0x90 | (e.channel & 0x0f));
                out.push(e.note & 0x7f);
                out.push(e.velocity & 0x7f);
            } else if (e.type === 'noteOff') {
                out.push(0x80 | (e.channel & 0x0f));
                out.push(e.note & 0x7f);
                out.push(0);
            } else if (e.type === 'tempo') {
                out.push(0xff, 0x51, 3);
                out.push((e.micros >> 16) & 0xff);
                out.push((e.micros >> 8) & 0xff);
                out.push(e.micros & 0xff);
            } else if (e.type === 'endOfTrack') {
                out.push(0xff, 0x2f, 0);
            }
        }
        return new Uint8Array(out);
    }

    const allTracks = includeTempo ? [tempoTrack, ...noteTracks] : noteTracks;
    const trackBytes = allTracks.map(encodeTrack);

    // Build the file
    const headerBytes = [
        ...MTHD_HEADER,
        ...writeUint32BE(6),
        ...writeUint16BE(1), // format 1
        ...writeUint16BE(allTracks.length),
        ...writeUint16BE(ticksPerBeat)
    ];

    let totalSize = headerBytes.length;
    for (const tb of trackBytes) totalSize += 8 + tb.length;
    const out = new Uint8Array(totalSize);
    let pos = 0;
    out.set(headerBytes, pos); pos += headerBytes.length;
    for (const tb of trackBytes) {
        out.set(MTRK_HEADER, pos); pos += 4;
        out.set(writeUint32BE(tb.length), pos); pos += 4;
        out.set(tb, pos); pos += tb.length;
    }
    return out;
}

/**
 * Convert parsed MIDI tracks into SnugOS sequence data shape.
 * Each result entry: { name, ticksPerBeat, numRows, length, data: 2D array, bpm }
 *
 * @param {{ tracks: Array<{name, notes: Array<{midi, time, duration, velocity, channel}>}>, bpm: number, ticksPerBeat: number }} parsed
 * @param {{ lengthInSteps?: number, stepsPerBeat?: number, trackTypes?: string[] }} options
 * @returns {Array<{ name: string, numRows: number, length: number, data: any[][], bpm: number, channel: number }>}
 */
export function midiTracksToSequences(parsed, options = {}) {
    const stepsPerBeat = options.stepsPerBeat || 4; // 16th notes
    const targetLength = options.lengthInSteps || 32; // default 2 bars of 16th notes
    const results = [];
    parsed.tracks.forEach((track, ti) => {
        if (!track.notes || track.notes.length === 0) return;
        const rows = 72; // matches synthPitches length
        const data = Array(rows).fill(null).map(() => Array(targetLength).fill(null));
        let minTime = Infinity, maxTime = -Infinity;
        let totalBeats = 0;
        for (const n of track.notes) {
            if (n.time < minTime) minTime = n.time;
            const endTime = n.time + n.duration;
            if (endTime > maxTime) maxTime = endTime;
            if (endTime > totalBeats) totalBeats = endTime;
        }
        // MIDI row index mapping: synthPitches is reversed (B6 at idx 0, C1 at idx 71)
        // MIDI 60 (C4) -> idx 35, MIDI 24 (C1) -> idx 71
        // Formula: rowIndex = 95 - midi
        for (const n of track.notes) {
            const row = 95 - n.midi;
            if (row < 0 || row >= rows) continue;
            const step = Math.floor(n.time * stepsPerBeat);
            if (step < 0 || step >= targetLength) continue;
            const velocity = Math.max(0.05, Math.min(1, n.velocity / 127));
            data[row][step] = { active: true, velocity, duration: 1 };
        }
        const trackType = (options.trackTypes && options.trackTypes[ti]) || 'Synth';
        results.push({
            name: track.name || `MIDI Track ${ti + 1}`,
            numRows: trackType === 'DrumSampler' ? 8 : rows,
            length: targetLength,
            data,
            bpm: parsed.bpm,
            channel: track.notes[0]?.channel ?? 0
        });
    });
    return results;
}

// Map a SnugOS row index back to a MIDI note number for synth/instrument tracks.
// synthPitches is reversed: index 0 = B6, index 35 = C4, index 71 = C1.
function synthRowToMidi(rowIndex) {
    return 95 - rowIndex;
}

/**
 * Convert a SnugOS sequence's `data` (2D array) + length + bpm into an array of
 * plain MIDI note objects suitable for buildMidiFile().
 *
 * SnugOS stores notes in sequence.data[row][col] as { active: true, velocity: 0..1 }.
 * For Synth/InstrumentSampler, `row` indexes the reversed synthPitches array
 * (row 35 = C4 = MIDI 60, row 0 = B6 = MIDI 83).
 * For DrumSampler, `row` is the pad index (0..7) and the MIDI note is taken
 * from the pad's midiNote or row index (default row 0 = MIDI 36, row 7 = MIDI 43).
 *
 * The `length` is in 16th-note steps. We assume 4 steps per beat (16th-note grid)
 * and convert to beats.
 *
 * @param {Object} seq - { data: any[][], length: number, type?: string, drumSamplerPads?: any[] }
 * @param {Object} [opts]
 * @param {number} [opts.channel=0] - MIDI channel (0-15)
 * @returns {Array<{midi:number, time:number, duration:number, velocity:number, channel:number}>}
 */
export function sequenceDataToMidiNotes(seq, opts = {}) {
    const channel = Math.max(0, Math.min(15, opts.channel || 0));
    if (!seq || !Array.isArray(seq.data)) return [];
    const length = seq.length || (seq.data[0] ? seq.data[0].length : 0);
    if (length <= 0) return [];

    const isDrum = seq.type === 'DrumSampler';
    const pads = isDrum && Array.isArray(seq.drumSamplerPads) ? seq.drumSamplerPads : null;

    // 4 steps per beat on a 16th-note grid
    const STEPS_PER_BEAT = 4;
    const notes = [];

    for (let row = 0; row < seq.data.length; row++) {
        const rowData = seq.data[row];
        if (!Array.isArray(rowData)) continue;

        // Resolve MIDI note for this row
        let midi;
        if (isDrum) {
            const pad = pads ? pads[row] : null;
            if (pad && Number.isFinite(pad.midiNote)) {
                midi = pad.midiNote;
            } else {
                // GM drum map default: pad index 0 = MIDI 36 (Kick), pad 7 = MIDI 43
                midi = 36 + row;
            }
        } else {
            midi = synthRowToMidi(row);
        }
        if (midi < 0 || midi > 127) continue;

        // Walk the row looking for note-ons. We coalesce adjacent steps with the
        // same velocity into a single note (default duration = 1 step).
        let stepOn = -1;
        let activeVel = 0;
        for (let step = 0; step <= length; step++) {
            const cell = step < length ? rowData[step] : null;
            const isActive = cell && cell.active;
            if (isActive && stepOn < 0) {
                stepOn = step;
                activeVel = typeof cell.velocity === 'number' ? cell.velocity : 0.8;
            } else if (!isActive && stepOn >= 0) {
                notes.push({
                    midi,
                    time: stepOn / STEPS_PER_BEAT,
                    duration: Math.max(1 / STEPS_PER_BEAT, (step - stepOn) / STEPS_PER_BEAT),
                    velocity: activeVel,
                    channel
                });
                stepOn = -1;
            }
        }
    }
    notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
    return notes;
}

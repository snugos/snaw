// js/AutoKeyDetection.js - Auto Key Detection for SnugOS DAW
// Feature: Analyze MIDI/audio to detect musical key and suggest scale

let localAppServices = {};
let keyDetectionPanel = null;
let detectedKey = null;

// Musical keys and their notes (semitones from root)
const KEYS = {
    'C': { root: 0, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'C#': { root: 1, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'Db': { root: 1, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'D': { root: 2, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'D#': { root: 3, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'Eb': { root: 3, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'E': { root: 4, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'F': { root: 5, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'F#': { root: 6, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'Gb': { root: 6, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'G': { root: 7, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'G#': { root: 8, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'Ab': { root: 8, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'A': { root: 9, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'A#': { root: 10, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'Bb': { root: 10, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    'B': { root: 11, mode: 'major', notes: [0, 2, 4, 5, 7, 9, 11] }
};

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALE_SUGGESTIONS = {
    major: ['Ionian', 'Lydian', 'Mixolydian'],
    minor: ['Aeolian', 'Dorian', 'Phrygian']
};

/**
 * Initialize the Auto Key Detection module
 * @param {object} services - App services
 */
export function initAutoKeyDetection(services) {
    localAppServices = services || {};
    console.log('[AutoKeyDetection] Initialized');
}

/**
 * Analyze MIDI notes to detect the musical key
 * @param {Array} notes - Array of {note, velocity, time} objects
 * @returns {object} Detected key info
 */
export function detectKeyFromNotes(notes) {
    if (!notes || notes.length < 4) {
        return { detected: false, key: null, scale: null, confidence: 0 };
    }

    // Count semitone occurrences
    const noteCounts = {};
    notes.forEach(n => {
        const semitone = n.note % 12;
        noteCounts[semitone] = (noteCounts[semitone] || 0) + 1;
    });

    // Score each possible key
    const keyScores = {};
    KEY_NAMES.forEach((keyName, index) => {
        const scaleNotes = KEYS[keyName].notes;
        let score = 0;
        let hasRoot = false;

        scaleNotes.forEach(note => {
            const adjustedNote = (note + index) % 12;
            if (noteCounts[adjustedNote]) {
                score += noteCounts[adjustedNote];
                if (note === 0) hasRoot = true;
            }
        });

        // Bonus for having the root note
        if (hasRoot) score += 5;

        keyScores[keyName] = score;
    });

    // Find best matching key
    let bestKey = 'C';
    let bestScore = 0;
    Object.entries(keyScores).forEach(([key, score]) => {
        if (score > bestScore) {
            bestScore = score;
            bestKey = key;
        }
    });

    // Determine if major or minor based on 3rd and 6th
    const rootSemitone = KEY_NAMES.indexOf(bestKey);
    const thirdSemitone = (rootSemitone + 4) % 12;
    const sixthSemitone = (rootSemitone + 9) % 12;
    const thirdCount = noteCounts[thirdSemitone] || 0;
    const sixthCount = noteCounts[sixthSemitone] || 0;

    const isMajor = thirdCount > sixthCount;
    const scale = isMajor ? 'Major' : 'Minor';

    // Calculate confidence (0-100)
    const totalNotes = notes.length;
    const maxPossibleScore = totalNotes * 1.5;
    const confidence = Math.min(100, Math.round((bestScore / maxPossibleScore) * 100));

    detectedKey = {
        key: bestKey,
        scale: scale,
        rootSemitone: rootSemitone,
        confidence: confidence,
        noteCounts: noteCounts
    };

    console.log(`[AutoKeyDetection] Detected: ${bestKey} ${scale} (confidence: ${confidence}%)`);
    return detectedKey;
}

/**
 * Analyze all MIDI tracks to detect project key
 * @returns {object} Detected key info
 */
export function analyzeProjectKey() {
    const tracks = localAppServices.getTracks?.() || [];
    const allNotes = [];

    tracks.forEach(track => {
        if (track.sequences) {
            track.sequences.forEach(seq => {
                if (seq.notes) {
                    seq.notes.forEach(note => {
                        allNotes.push({
                            note: note.note || note.pitch || 60,
                            velocity: note.velocity || 100,
                            time: note.time || 0
                        });
                    });
                }
            });
        }
    });

    return detectKeyFromNotes(allNotes);
}

/**
 * Get scale degrees for the detected key
 * @returns {Array} Array of scale note names
 */
export function getScaleNotes() {
    if (!detectedKey) return [];

    const root = detectedKey.rootSemitone;
    const scaleType = detectedKey.scale;
    const scaleNotes = scaleType === 'Major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];

    return scaleNotes.map(interval => NOTE_NAMES[(root + interval) % 12]);
}

/**
 * Get current detected key
 * @returns {object|null}
 */
export function getDetectedKey() {
    return detectedKey;
}

/**
 * Apply detected key to project (set scale highlighting)
 * @param {object} keyInfo - Key info to apply
 */
export function applyKeyToProject(keyInfo) {
    if (!keyInfo || !keyInfo.detected) return;

    if (localAppServices.setProjectScale) {
        localAppServices.setProjectScale(keyInfo.key, keyInfo.scale);
    }

    localAppServices.showNotification?.(`Key set to ${keyInfo.key} ${keyInfo.scale}`, 2000);
}

/**
 * Open the Key Detection panel
 */
export function openAutoKeyDetectionPanel() {
    const existingPanel = document.getElementById('autoKeyDetectionPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    // Analyze current project
    const analysis = analyzeProjectKey();

    const panel = document.createElement('div');
    panel.id = 'autoKeyDetectionPanel';
    panel.className = 'fixed bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg shadow-2xl z-[9999]';
    panel.style.cssText = 'width:360px;left:50%;top:50%;transform:translate(-50%,-50%);';

    const scaleNotes = analysis.detected ? getScaleNotes() : [];
    const scaleNotesHtml = scaleNotes.length > 0
        ? scaleNotes.map((n, i) => `<span class="px-2 py-1 rounded ${i === 0 ? 'bg-[#ff7700]' : 'bg-[#3a3a3a]'} text-xs">${n}</span>`).join('')
        : '<span class="text-xs text-[#888]">Analyze a project first</span>';

    const confidenceColor = analysis.confidence > 70 ? '#10b981' : analysis.confidence > 40 ? '#f59e0b' : '#ef4444';

    panel.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-[#3a3a3a] cursor-move" data-drag-handle>
            <span class="text-sm font-semibold text-[#e0e0e0]">🎼 Auto Key Detection</span>
            <button id="autoKeyClose" class="w-5 h-5 flex items-center justify-center text-[#888] hover:text-[#fff] text-lg">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <!-- Detect Button -->
            <button id="detectKeyBtn" class="w-full py-3 bg-[#ff7700] hover:bg-[#ff8800] text-white font-semibold rounded transition-colors">
                Detect Key from Project
            </button>
            
            <!-- Results -->
            <div id="keyResults" class="p-4 bg-[#1a1a1a] rounded space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs text-[#888]">Detected Key</span>
                    <span id="detectedKeyDisplay" class="text-xl font-bold text-[#ff7700]">${analysis.key || '—'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-[#888]">Scale</span>
                    <span id="detectedScaleDisplay" class="text-lg font-semibold text-[#e0e0e0]">${analysis.scale || '—'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-[#888]">Confidence</span>
                    <span id="confidenceDisplay" class="text-sm font-bold" style="color:${confidenceColor}">${analysis.confidence || 0}%</span>
                </div>
                
                <!-- Scale Notes -->
                <div>
                    <span class="text-xs text-[#888] block mb-2">Scale Notes</span>
                    <div id="scaleNotesDisplay" class="flex gap-1 flex-wrap">
                        ${scaleNotesHtml}
                    </div>
                </div>
            </div>
            
            <!-- Apply Button -->
            <button id="applyKeyBtn" class="w-full py-2 bg-[#10b981] hover:bg-[#11b981] text-white font-semibold rounded transition-colors ${!analysis.detected ? 'opacity-50 cursor-not-allowed' : ''}" ${!analysis.detected ? 'disabled' : ''}>
                Apply Key to Project
            </button>
        </div>
    `;

    document.body.appendChild(panel);
    keyDetectionPanel = panel;

    // Close button
    document.getElementById('autoKeyClose').addEventListener('click', () => {
        panel.remove();
    });

    // Detect button
    document.getElementById('detectKeyBtn').addEventListener('click', () => {
        const newAnalysis = analyzeProjectKey();
        updatePanelWithResults(newAnalysis);
        localAppServices.showNotification?.('Key detection complete', 1500);
    });

    // Apply button
    document.getElementById('applyKeyBtn').addEventListener('click', () => {
        if (detectedKey && detectedKey.detected !== false) {
            applyKeyToProject(detectedKey);
        }
    });

    // Make panel draggable
    makeDraggable(panel);
}

/**
 * Update panel with analysis results
 * @param {object} analysis 
 */
function updatePanelWithResults(analysis) {
    const scaleNotes = analysis.detected ? getScaleNotes() : [];
    const scaleNotesHtml = scaleNotes.length > 0
        ? scaleNotes.map((n, i) => `<span class="px-2 py-1 rounded ${i === 0 ? 'bg-[#ff7700]' : 'bg-[#3a3a3a]'} text-xs">${n}</span>`).join('')
        : '<span class="text-xs text-[#888]">Not enough notes</span>';

    const confidenceColor = analysis.confidence > 70 ? '#10b981' : analysis.confidence > 40 ? '#f59e0b' : '#ef4444';

    const keyDisplay = document.getElementById('detectedKeyDisplay');
    const scaleDisplay = document.getElementById('detectedScaleDisplay');
    const confidenceDisplay = document.getElementById('confidenceDisplay');
    const scaleNotesDisplay = document.getElementById('scaleNotesDisplay');
    const applyBtn = document.getElementById('applyKeyBtn');

    if (keyDisplay) keyDisplay.textContent = analysis.key || '—';
    if (scaleDisplay) scaleDisplay.textContent = analysis.scale || '—';
    if (confidenceDisplay) {
        confidenceDisplay.textContent = `${analysis.confidence || 0}%`;
        confidenceDisplay.style.color = confidenceColor;
    }
    if (scaleNotesDisplay) scaleNotesDisplay.innerHTML = scaleNotesHtml;
    if (applyBtn) {
        applyBtn.disabled = !analysis.detected;
        applyBtn.classList.toggle('opacity-50', !analysis.detected);
        applyBtn.classList.toggle('cursor-not-allowed', !analysis.detected);
    }
}

/**
 * Make element draggable
 * @param {HTMLElement} element
 */
function makeDraggable(element) {
    const dragHandle = element.querySelector('[data-drag-handle]');
    if (!dragHandle) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = `${startLeft + dx}px`;
        element.style.top = `${startTop + dy}px`;
        element.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * Close the panel
 */
export function closeAutoKeyDetectionPanel() {
    if (keyDetectionPanel) {
        keyDetectionPanel.remove();
        keyDetectionPanel = null;
    }
}
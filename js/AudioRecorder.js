// js/AudioRecorder.js - Audio Recording Module for SnugOS DAW
// Feature: Record audio from microphone into tracks

let localAppServices = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStream = null;
let recordingIndicatorElement = null;

export function initAudioRecorder(services) {
    localAppServices = services;
    // Create recording indicator element
    createRecordingIndicator();
    console.log('[AudioRecorder] Initialized');
}

function createRecordingIndicator() {
    const existing = document.getElementById('recordingPulseIndicator');
    if (existing) {
        recordingIndicatorElement = existing;
        return;
    }
    const indicator = document.createElement('div');
    indicator.id = 'recordingPulseIndicator';
    indicator.innerHTML = `<span style="display:inline-block;width:8px;height:8px;background:#fff;border-radius:50%;margin-right:8px;animation:recordingDot 1s ease-in-out infinite;"></span>REC`;
    Object.assign(indicator.style, {
        display: 'none',
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        background: 'rgba(220,38,38,0.9)',
        color: 'white',
        padding: '6px 16px',
        borderRadius: '20px',
        fontFamily: 'Inter,sans-serif',
        fontSize: '13px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(220,38,38,0.4)'
    });
    const style = document.createElement('style');
    style.textContent = '@keyframes recordingDot{0%,100%{opacity:1}50%{opacity:0.4}}';
    document.head.appendChild(style);
    document.body.appendChild(indicator);
    recordingIndicatorElement = indicator;
}

export function setRecordingIndicatorVisible(visible) {
    if (recordingIndicatorElement) {
        recordingIndicatorElement.style.display = visible ? 'block' : 'none';
    }
}

/**
 * Request microphone access
 * @returns {Promise<MediaStream|null>}
 */
export async function requestMicAccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        recordingStream = stream;
        console.log('[AudioRecorder] Microphone access granted');
        return stream;
    } catch (error) {
        console.error('[AudioRecorder] Microphone access denied:', error);
        localAppServices.showNotification?.('Microphone access denied. Please allow microphone in browser settings.', 3000);
        return null;
    }
}

/**
 * Start recording audio
 * @param {number} trackId - The track ID to record into
 * @returns {boolean} Success
 */
export async function startRecording(trackId) {
    if (isRecording) {
        console.warn('[AudioRecorder] Already recording');
        return false;
    }

    const stream = recordingStream || await requestMicAccess();
    if (!stream) {
        return false;
    }

    try {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await saveRecordingToTrack(trackId, audioBlob);
            }
        };

        mediaRecorder.start(100); // Collect data every 100ms
        isRecording = true;
        
        // Update UI
        setRecordingIndicatorVisible(true);
        localAppServices.showNotification?.('Recording started', 1500);
        if (localAppServices.setIsRecordingState) {
            localAppServices.setIsRecordingState(true);
        }
        if (localAppServices.setRecordingTrackIdState) {
            localAppServices.setRecordingTrackIdState(trackId);
        }
        if (localAppServices.setRecordingStartTimeState) {
            localAppServices.setRecordingStartTimeState(Date.now());
        }
        
        console.log('[AudioRecorder] Recording started for track', trackId);
        return true;
    } catch (error) {
        console.error('[AudioRecorder] Failed to start recording:', error);
        return false;
    }
}

/**
 * Stop recording audio
 * @returns {boolean} Success
 */
export function stopRecording() {
    if (!isRecording || !mediaRecorder) {
        console.warn('[AudioRecorder] Not currently recording');
        return false;
    }

    try {
        mediaRecorder.stop();
        isRecording = false;
        setRecordingIndicatorVisible(false);
        
        localAppServices.showNotification?.('Recording stopped', 1500);
        if (localAppServices.setIsRecordingState) {
            localAppServices.setIsRecordingState(false);
        }
        if (localAppServices.setRecordingTrackIdState) {
            localAppServices.setRecordingTrackIdState(null);
        }
        
        console.log('[AudioRecorder] Recording stopped');
        return true;
    } catch (error) {
        console.error('[AudioRecorder] Failed to stop recording:', error);
        return false;
    }
}

/**
 * Check if currently recording
 * @returns {boolean}
 */
export function isRecordingActive() {
    return isRecording;
}

/**
 * Save the recorded audio blob to a track
 * @param {number} trackId - Track ID
 * @param {Blob} audioBlob - Audio blob to save
 */
async function saveRecordingToTrack(trackId, audioBlob) {
    try {
        const track = localAppServices.getTrackById?.(trackId);
        if (!track) {
            console.error('[AudioRecorder] Track not found:', trackId);
            return;
        }

        // Convert blob to File
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Load audio into Tone.js buffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        
        // Create audio clip data
        const clipData = {
            id: `clip-${Date.now()}`,
            name: `Recording ${new Date().toLocaleTimeString()}`,
            audioBuffer: audioBuffer,
            file: audioFile,
            startTime: 0,
            duration: audioBuffer.duration,
            playbackRate: 1.0,
            offset: 0
        };

        // Add to track timeline clips
        if (!track.timelineClips) {
            track.timelineClips = [];
        }
        
        // Get current playhead position for placement
        let insertPosition = 0;
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            insertPosition = Tone.Transport.seconds;
        }
        
        clipData.startTime = insertPosition;
        track.timelineClips.push(clipData);
        
        // Update track UI
        localAppServices.updateTrackUI?.(trackId, 'timelineClipsChanged');
        localAppServices.showNotification?.(`Recording saved (${audioBuffer.duration.toFixed(1)}s)`, 2000);
        
        console.log('[AudioRecorder] Recording saved to track', trackId);
    } catch (error) {
        console.error('[AudioRecorder] Failed to save recording:', error);
        localAppServices.showNotification?.('Failed to save recording', 2000);
    }
}

/**
 * Clean up recording resources
 */
export function cleanupRecording() {
    if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
    }
    mediaRecorder = null;
    audioChunks = [];
    isRecording = false;
    console.log('[AudioRecorder] Cleanup complete');
}

/**
 * Get recording status
 * @returns {{isRecording: boolean, duration: number}}
 */
export function getRecordingStatus() {
    let duration = 0;
    if (isRecording && localAppServices.getRecordingStartTimeState) {
        const startTime = localAppServices.getRecordingStartTimeState();
        if (startTime) {
            duration = (Date.now() - startTime) / 1000;
        }
    }
    return { isRecording, duration };
}

// --- Audio Recording Panel UI ---
let isPanelOpen = false;
const WINDOW_ID = 'audioRecordingPanel';
const PANEL_CONTENT_ID = 'audioRecordingPanelContent';

export function openAudioRecordingPanel() {
    if (isPanelOpen && localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(WINDOW_ID)) {
            openWindows.get(WINDOW_ID).restore?.();
            renderPanelContent();
            return openWindows.get(WINDOW_ID);
        }
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = PANEL_CONTENT_ID;
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white overflow-y-auto';

    const options = {
        width: 380,
        height: 280,
        minWidth: 320,
        minHeight: 240,
        initialContentKey: WINDOW_ID,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow?.(WINDOW_ID, 'Audio Recording', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

export function isAudioRecordingPanelOpen() {
    return isPanelOpen;
}

function renderPanelContent() {
    const container = document.getElementById(PANEL_CONTENT_ID);
    if (!container) return;

    const tracks = (localAppServices.getTracksState?.() || []).filter(t => t && t.type === 'Audio');
    const trackOptions = tracks.length === 0
        ? '<option value="">(no Audio tracks — create one first)</option>'
        : tracks.map(t => `<option value="${t.id}">${t.name || ('Track ' + t.id)}</option>`).join('');

    const statusText = isRecording ? '🔴 Recording…' : 'Idle';

    container.innerHTML = `
        <div class="mb-3 text-sm text-gray-300">
            Record audio from your microphone into an Audio track. The recording will be inserted at the current playhead position when stopped.
        </div>
        <label class="block text-xs text-gray-400 mb-1" for="recTrackSelect">Target Track</label>
        <select id="recTrackSelect" class="w-full mb-4 px-2 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm">
            ${trackOptions}
        </select>
        <div class="flex items-center gap-3 mb-3">
            <button id="recStartBtn" class="px-4 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold">● Start Recording</button>
            <button id="recStopBtn" class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold" disabled>■ Stop</button>
        </div>
        <div id="recStatus" class="text-xs text-gray-400">Status: ${statusText}</div>
    `;

    const startBtn = container.querySelector('#recStartBtn');
    const stopBtn = container.querySelector('#recStopBtn');
    const trackSelect = container.querySelector('#recTrackSelect');
    const statusDiv = container.querySelector('#recStatus');

    function refreshButtons() {
        startBtn.disabled = isRecording || tracks.length === 0;
        stopBtn.disabled = !isRecording;
        statusDiv.textContent = 'Status: ' + (isRecording ? '🔴 Recording…' : 'Idle');
    }

    startBtn.addEventListener('click', async () => {
        const trackId = trackSelect.value;
        if (!trackId) {
            localAppServices.showNotification?.('Please select an Audio track first', 2000);
            return;
        }
        await startRecording(trackId);
        refreshButtons();
    });

    stopBtn.addEventListener('click', () => {
        stopRecording();
        // Status updates on mediaRecorder.onstop; give it a moment then refresh
        setTimeout(refreshButtons, 250);
    });

    refreshButtons();
}
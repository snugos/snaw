// js/AudioWaveformAnnotation.js - Add text notes directly onto audio waveforms

let localAppServices = {};
let annotations = new Map(); // clipId -> Array of {id, x, y, text, timestamp, author}

/**
 * Initialize the Audio Waveform Annotation module
 * @param {object} services - App services 
 */
export function initAudioWaveformAnnotation(services) {
    localAppServices = services;
    console.log('[AudioWaveformAnnotation] Initialized');
}

/**
 * Add an annotation to an audio clip
 * @param {string} clipId - Clip ID
 * @param {object} annotation - {x: 0-1, y: 0-1, text: string, author?: string}
 * @returns {object} The created annotation
 */
export function addAnnotation(clipId, annotation) {
    if (!annotations.has(clipId)) {
        annotations.set(clipId, []);
    }
    
    const clipAnnotations = annotations.get(clipId);
    const newAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: Math.max(0, Math.min(1, annotation.x || 0)),
        y: Math.max(0, Math.min(1, annotation.y || 0.5)),
        text: annotation.text || '',
        author: annotation.author || 'User',
        timestamp: Date.now(),
        color: annotation.color || '#ffcc00'
    };
    
    clipAnnotations.push(newAnnotation);
    saveAnnotations();
    
    console.log(`[AudioWaveformAnnotation] Added annotation to clip ${clipId}: "${newAnnotation.text}"`);
    return newAnnotation;
}

/**
 * Remove an annotation from a clip
 * @param {string} clipId - Clip ID
 * @param {string} annotationId - Annotation ID
 * @returns {boolean} Success
 */
export function removeAnnotation(clipId, annotationId) {
    const clipAnnotations = annotations.get(clipId);
    if (!clipAnnotations) return false;
    
    const index = clipAnnotations.findIndex(a => a.id === annotationId);
    if (index === -1) return false;
    
    clipAnnotations.splice(index, 1);
    saveAnnotations();
    
    console.log(`[AudioWaveformAnnotation] Removed annotation ${annotationId} from clip ${clipId}`);
    return true;
}

/**
 * Get all annotations for a clip
 * @param {string} clipId - Clip ID
 * @returns {Array} Array of annotations
 */
export function getAnnotations(clipId) {
    return annotations.get(clipId) || [];
}

/**
 * Update an annotation's text
 * @param {string} clipId - Clip ID
 * @param {string} annotationId - Annotation ID
 * @param {string} newText - New text
 * @returns {boolean} Success
 */
export function updateAnnotationText(clipId, annotationId, newText) {
    const clipAnnotations = annotations.get(clipId);
    if (!clipAnnotations) return false;
    
    const annotation = clipAnnotations.find(a => a.id === annotationId);
    if (!annotation) return false;
    
    annotation.text = newText;
    annotation.timestamp = Date.now();
    saveAnnotations();
    
    return true;
}

/**
 * Save annotations to localStorage
 */
function saveAnnotations() {
    try {
        const data = {};
        annotations.forEach((value, key) => {
            data[key] = value;
        });
        localStorage.setItem('snugos_waveform_annotations', JSON.stringify(data));
    } catch (e) {
        console.error('[AudioWaveformAnnotation] Failed to save:', e);
    }
}

/**
 * Load annotations from localStorage
 */
export function loadAnnotations() {
    try {
        const data = JSON.parse(localStorage.getItem('snugos_waveform_annotations') || '{}');
        annotations.clear();
        Object.entries(data).forEach(([key, value]) => {
            annotations.set(key, value);
        });
        console.log('[AudioWaveformAnnotation] Loaded annotations');
    } catch (e) {
        console.error('[AudioWaveformAnnotation] Failed to load:', e);
    }
}

/**
 * Open the annotation panel for a clip
 * @param {string} clipId - Clip ID
 * @param {string} trackId - Track ID (optional)
 */
export function openAnnotationPanel(clipId, trackId = null) {
    // Remove existing panel
    const existing = document.getElementById('waveform-annotation-panel');
    if (existing) existing.remove();
    
    // Ensure annotations loaded
    if (annotations.size === 0) loadAnnotations();
    
    const clipAnnotations = getAnnotations(clipId);
    
    const panel = document.createElement('div');
    panel.id = 'waveform-annotation-panel';
    panel.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 w-80 max-h-96 overflow-hidden flex flex-col';
    
    panel.innerHTML = `
        <div class="bg-zinc-800 border-b border-zinc-700 p-3 flex justify-between items-center">
            <h3 class="text-sm font-semibold text-white">Waveform Annotations</h3>
            <button id="close-annotation-panel" class="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div class="p-3 flex-1 overflow-y-auto" id="annotation-list">
            ${clipAnnotations.length === 0 ? '<p class="text-zinc-500 text-sm">No annotations yet. Click on the waveform to add one.</p>' : ''}
            ${clipAnnotations.map(ann => `
                <div class="bg-zinc-800 rounded p-2 mb-2 text-sm" data-ann-id="${ann.id}">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-zinc-400 text-xs">${ann.author} • ${formatTime(ann.timestamp)}</span>
                        <button class="delete-ann text-red-400 hover:text-red-300 text-xs" data-ann-id="${ann.id}">✕</button>
                    </div>
                    <div class="text-white">${ann.text}</div>
                </div>
            `).join('')}
        </div>
        <div class="border-t border-zinc-700 p-3">
            <textarea id="new-annotation-text" placeholder="Add annotation..." class="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-600 rounded text-white resize-none" rows="2"></textarea>
            <button id="add-annotation-btn" class="mt-2 w-full px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded">
                Add Note
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    panel.querySelector('#close-annotation-panel').addEventListener('click', () => {
        panel.remove();
    });
    
    panel.querySelector('#add-annotation-btn').addEventListener('click', () => {
        const text = panel.querySelector('#new-annotation-text').value.trim();
        if (text) {
            addAnnotation(clipId, {
                x: 0.5,
                y: 0.5,
                text: text
            });
            localAppServices.showNotification?.('Annotation added', 1500);
            openAnnotationPanel(clipId, trackId); // Refresh
        }
    });
    
    panel.querySelectorAll('.delete-ann').forEach(btn => {
        btn.addEventListener('click', () => {
            const annId = btn.dataset.annId;
            removeAnnotation(clipId, annId);
            openAnnotationPanel(clipId, trackId); // Refresh
        });
    });
    
    // Close on escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            panel.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Show annotation markers on a clip's waveform
 * @param {HTMLElement} clipElement - The clip DOM element
 * @param {string} clipId - Clip ID
 */
export function renderAnnotationMarkers(clipElement, clipId) {
    const clipAnnotations = getAnnotations(clipId);
    if (clipAnnotations.length === 0) return;
    
    // Find or create marker container
    let markerContainer = clipElement.querySelector('.annotation-markers');
    if (!markerContainer) {
        markerContainer = document.createElement('div');
        markerContainer.className = 'annotation-markers';
        markerContainer.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;';
        clipElement.appendChild(markerContainer);
    }
    
    markerContainer.innerHTML = '';
    
    clipAnnotations.forEach(ann => {
        const marker = document.createElement('div');
        marker.className = 'annotation-marker';
        marker.style.cssText = `
            position: absolute;
            left: ${ann.x * 100}%;
            top: ${ann.y * 100}%;
            transform: translate(-50%, -50%);
            width: 8px;
            height: 8px;
            background: ${ann.color};
            border-radius: 50%;
            pointer-events: auto;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.5);
        `;
        marker.title = ann.text;
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            // Show tooltip with full text
            const tooltip = document.createElement('div');
            tooltip.className = 'annotation-tooltip';
            tooltip.style.cssText = `
                position: absolute;
                left: ${ann.x * 100}%;
                top: ${ann.y * 100}%;
                transform: translate(-50%, -120%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                max-width: 200px;
                white-space: normal;
                z-index: 100;
                pointer-events: auto;
            `;
            tooltip.textContent = ann.text;
            
            // Remove on click outside
            const closeHandler = (e) => {
                if (!tooltip.contains(e.target)) {
                    tooltip.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 10);
            
            clipElement.appendChild(tooltip);
        });
        markerContainer.appendChild(marker);
    });
}

console.log('[AudioWaveformAnnotation] Module loaded');
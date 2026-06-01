/**
 * StepSequencerProbability.js
 * Per-step probability settings for generative variations in step sequencer
 */

// Probability state storage - keyed by trackId then "row-step"
let probabilityState = new Map();

// Default probability
const DEFAULT_PROBABILITY = 1.0; // 100% - always trigger

/**
 * Initialize the step sequencer probability module
 */
export function initStepSequencerProbability(appServices) {
    console.log('[StepSequencerProbability] Module initialized');
    return {
        setStepProbability,
        getStepProbability,
        getProbabilityColor,
        shouldTriggerStep,
        clearProbabilityForTrack
    };
}

/**
 * Set probability for a specific step
 * @param {string} trackId - Track identifier
 * @param {number} row - Row index
 * @param {number} step - Step index
 * @param {number} probability - Value between 0 and 1
 */
export function setStepProbability(trackId, row, step, probability) {
    const key = `${trackId}:${row}-${step}`;
    probabilityState.set(key, Math.max(0, Math.min(1, probability)));
}

/**
 * Get probability for a specific step
 * @param {string} trackId - Track identifier
 * @param {number} row - Row index
 * @param {number} step - Step index
 * @returns {number} Probability between 0 and 1
 */
export function getStepProbability(trackId, row, step) {
    const key = `${trackId}:${row}-${step}`;
    return probabilityState.get(key) ?? DEFAULT_PROBABILITY;
}

/**
 * Get color for probability visualization
 * @param {number} probability - Value between 0 and 1
 * @returns {string} CSS color string
 */
export function getProbabilityColor(probability) {
    if (probability >= 1.0) {
        return 'rgba(34, 197, 94, 0.8)'; // Green - always triggers
    } else if (probability >= 0.75) {
        return 'rgba(132, 204, 22, 0.8)'; // Lime
    } else if (probability >= 0.5) {
        return 'rgba(234, 179, 8, 0.8)'; // Yellow
    } else if (probability >= 0.25) {
        return 'rgba(249, 115, 22, 0.8)'; // Orange
    } else if (probability > 0) {
        return 'rgba(239, 68, 68, 0.8)'; // Red - rarely triggers
    } else {
        return 'rgba(107, 114, 128, 0.5)'; // Gray - disabled
    }
}

/**
 * Determine if a step should trigger based on probability
 * @param {string} trackId - Track identifier
 * @param {number} row - Row index
 * @param {number} step - Step index
 * @returns {boolean} Whether the step should trigger
 */
export function shouldTriggerStep(trackId, row, step) {
    const probability = getStepProbability(trackId, row, step);
    return Math.random() < probability;
}

/**
 * Clear probability state for a track
 * @param {string} trackId - Track identifier
 */
export function clearProbabilityForTrack(trackId) {
    const prefix = `${trackId}:`;
    for (const key of probabilityState.keys()) {
        if (key.startsWith(prefix)) {
            probabilityState.delete(key);
        }
    }
}

/**
 * Get all probability values for a track (for UI display)
 * @param {string} trackId - Track identifier
 * @param {number} numRows - Number of rows
 * @param {number} numSteps - Number of steps
 * @returns {Array} 2D array of probabilities
 */
export function getTrackProbabilities(trackId, numRows, numSteps) {
    const result = [];
    for (let r = 0; r < numRows; r++) {
        const row = [];
        for (let s = 0; s < numSteps; s++) {
            row.push(getStepProbability(trackId, r, s));
        }
        result.push(row);
    }
    return result;
}

/**
 * Set probabilities for an entire row
 * @param {string} trackId - Track identifier
 * @param {number} row - Row index
 * @param {number} probability - Value between 0 and 1
 * @param {number} numSteps - Number of steps
 */
export function setRowProbability(trackId, row, probability, numSteps) {
    for (let s = 0; s < numSteps; s++) {
        setStepProbability(trackId, row, s, probability);
    }
}

/**
 * Set probabilities for an entire column (step)
 * @param {string} trackId - Track identifier
 * @param {number} step - Step index
 * @param {number} probability - Value between 0 and 1
 * @param {number} numRows - Number of rows
 */
export function setColumnProbability(trackId, step, probability, numRows) {
    for (let r = 0; r < numRows; r++) {
        setStepProbability(trackId, r, step, probability);
    }
}

export default {
    initStepSequencerProbability,
    setStepProbability,
    getStepProbability,
    getProbabilityColor,
    shouldTriggerStep,
    clearProbabilityForTrack,
    getTrackProbabilities,
    setRowProbability,
    setColumnProbability
};
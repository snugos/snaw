/**
 * TransportSync - Keeps Timeline Playhead aligned with Audio Context time
 * Provides robust sync with graceful fallback when Tone.js is not available
 */
const TransportSync = {
    _syncInterval: null,
    _lastReportedBeat: -1,
    _isInitialized: false,
    _initError: null,
    
    /**
     * Initialize TransportSync with error handling
     * Call this before start() to get proper error diagnostics
     * @returns {boolean} true if properly initialized, false otherwise
     */
    init() {
        try {
            // Check if Tone.js is available and has Transport
            if (typeof Tone === 'undefined') {
                this._initError = 'Tone.js not loaded';
                console.warn('[TransportSync] Tone.js not available - playhead sync disabled');
                return false;
            }
            if (typeof Tone.Transport === 'undefined') {
                this._initError = 'Tone.Transport not available';
                console.warn('[TransportSync] Tone.Transport not available - playhead sync disabled');
                return false;
            }
            this._isInitialized = true;
            this._initError = null;
            console.log('[TransportSync] Initialized successfully');
            return true;
        } catch (e) {
            this._initError = e.message;
            console.warn('[TransportSync] Initialization failed:', e.message);
            return false;
        }
    },
    
    /**
     * Start the sync interval
     * Automatically initializes if not already done
     */
    start() {
        // Auto-init if not initialized
        if (!this._isInitialized && !this.init()) {
            console.warn('[TransportSync] Cannot start - initialization failed:', this._initError);
            return;
        }
        
        if (this._syncInterval) return;
        
        // Double-check Tone is available (might have changed)
        if (typeof Tone === 'undefined' || typeof Tone.Transport === 'undefined') {
            console.warn('[TransportSync] Tone.js became unavailable - cannot start');
            this._isInitialized = false;
            return;
        }
        
        this._syncInterval = setInterval(() => this._sync(), 50);
        console.log('[TransportSync] Started');
    },
    
    /**
     * Stop the sync interval
     */
    stop() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
        this._lastReportedBeat = -1;
        console.log('[TransportSync] Stopped');
    },
    
    /**
     * Core sync function - safely sync playhead position
     */
    _sync() {
        try {
            // Guard against Tone.Transport becoming unavailable
            if (typeof Tone === 'undefined' || typeof Tone.Transport === 'undefined') {
                this.stop();
                this._isInitialized = false;
                return;
            }
            
            const pos = Math.floor(Tone.Transport.position);
            if (pos !== this._lastReportedBeat) {
                this._lastReportedBeat = pos;
                if (typeof updatePlayheadPosition === 'function') {
                    updatePlayheadPosition(Tone.Transport.seconds);
                }
            }
        } catch (e) {
            // Unexpected error during sync - stop to prevent continuous errors
            console.warn('[TransportSync] Sync error, stopping:', e.message);
            this.stop();
        }
    },
    
    /**
     * Check if sync is currently active
     * @returns {boolean} true if running
     */
    isActive() { return !!this._syncInterval; },
    
    /**
     * Get last reported beat position
     * @returns {number} last beat, or -1 if never reported
     */
    getLastBeat() { return this._lastReportedBeat; },
    
    /**
     * Check if initialization was successful
     * @returns {boolean} true if initialized (or was at some point)
     */
    isInitialized() { return this._isInitialized; },
    
    /**
     * Get current initialization error if any
     * @returns {string|null} error message or null
     */
    getError() { return this._initError; }
};

window.TransportSync = TransportSync;
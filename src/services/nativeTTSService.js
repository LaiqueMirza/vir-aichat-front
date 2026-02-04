/**
 * Native Browser Text-to-Speech Service
 * Uses the Web Speech API's SpeechSynthesis for real-time TTS
 */
class NativeTTSService {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.isSupported = !!this.synthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    
    // Speech queue to prevent interruptions
    this.speechQueue = [];
    this.isProcessingQueue = false;
    
    // Default settings
    this.settings = {
			rate: 1.0, // Speech rate (0.1 to 10)
			pitch: 1.0, // Speech pitch (0 to 2)
			volume: 0.8, // Speech volume (0 to 1)
			voiceName: "Google US English", // Voice name to use
			lang: "en-US", // Language
		};

    // Event callbacks
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;
    this.onPause = null;
    this.onResume = null;

    this.initializeVoices();
  }
  /**
   * Initialize available voices
   */
  async initializeVoices() {
    if (!this.isSupported) return;

    // No need to search for voices - we'll set the voice by name directly
    console.log('🎤 TTS initialized with default voice:', this.settings.voiceName);
  }

  /**
   * Speak text using native TTS with queue-based processing
   * @param {string} text - Text to speak
   * @param {Object} options - Optional TTS settings override
   */
  async speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported) {
        reject(new Error('Speech synthesis not supported in this browser'));
        return;
      }

      if (!text || text.trim() === '') {
        resolve();
        return;
      }

      // Add to queue for sequential processing
      this.speechQueue.push({ text, options, resolve, reject });
      console.log(`🎤 Added to speech queue (queue length: ${this.speechQueue.length})`);
      
      // Process queue if not already processing
      this.processQueue();
    });
  }

  /**
   * Process the speech queue sequentially
   */
  async processQueue() {
    if (this.isProcessingQueue || this.speechQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log('🎤 Starting to process speech queue');

    while (this.speechQueue.length > 0) {
      const { text, options, resolve, reject } = this.speechQueue.shift();
      
      try {
        await this._speakSingle(text, options);
        resolve();
        console.log('✅ Speech completed successfully');
      } catch (error) {
        console.error('❌ Speech failed:', error);
        reject(error);
      }
      
      // Small delay between speeches to ensure clean transitions
      if (this.speechQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessingQueue = false;
    console.log('🎤 Speech queue processing completed');
  }

  /**
   * Internal method to speak a single utterance with retry logic
   */
  async _speakSingle(text, options = {}, retryCount = 0) {
    const maxRetries = 3;
    
    return new Promise((resolve, reject) => {
      // Cancel any existing speech first
      if (this.synthesis.speaking || this.synthesis.pending) {
        console.log('🔇 Cancelling existing speech');
        this.synthesis.cancel();
      }

      // Wait a bit after cancellation to ensure it takes effect
      setTimeout(() => {
        // Create utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Set state immediately
        this.isPlaying = true;
        this.isPaused = false;
        
        // Apply settings
        const finalSettings = { ...this.settings, ...options };
        this.currentUtterance.rate = finalSettings.rate;
        this.currentUtterance.pitch = finalSettings.pitch;
        this.currentUtterance.volume = finalSettings.volume;
        this.currentUtterance.lang = finalSettings.lang;
        
        // Set voice by name - browser will find the matching voice automatically
        if (finalSettings.voiceName) {
          const voices = this.synthesis.getVoices();
          const selectedVoice = voices.find(voice => voice.name === finalSettings.voiceName);
          if (selectedVoice) {
            this.currentUtterance.voice = selectedVoice;
          }
        }

        // Set up event handlers
        this.currentUtterance.onstart = () => {
          this.isPlaying = true;
          this.isPaused = false;
          console.log('🎤 TTS started:', text.substring(0, 50) + '...');
          if (this.onStart) this.onStart();
        };

        this.currentUtterance.onend = () => {
          this.isPlaying = false;
          this.isPaused = false;
          this.currentUtterance = null;
          console.log('🎤 TTS completed');
          if (this.onEnd) this.onEnd();
          resolve();
        };

        this.currentUtterance.onerror = async (event) => {
          this.isPlaying = false;
          this.isPaused = false;
          this.currentUtterance = null;
          
          if (event.error === 'interrupted' && retryCount < maxRetries) {
            console.warn(`⚠️ TTS interrupted (attempt ${retryCount + 1}/${maxRetries}), retrying...`);
            
            // Retry after a longer delay
            setTimeout(async () => {
              try {
                const result = await this._speakSingle(text, options, retryCount + 1);
                resolve(result);
              } catch (retryError) {
                reject(retryError);
              }
            }, 200 * (retryCount + 1)); // Increasing delay for each retry
          } else {
            console.error('❌ TTS error (final):', event.error);
            if (this.onError) this.onError(event.error);
            reject(new Error(`TTS Error: ${event.error}`));
          }
        };

        this.currentUtterance.onpause = () => {
          this.isPaused = true;
          console.log('⏸️ TTS paused');
          if (this.onPause) this.onPause();
        };

        this.currentUtterance.onresume = () => {
          this.isPaused = false;
          console.log('▶️ TTS resumed');
          if (this.onResume) this.onResume();
        };

        // Start speaking
        try {
          this.synthesis.speak(this.currentUtterance);
        } catch (error) {
          console.error('❌ Failed to start TTS:', error);
          reject(error);
        }
      }, 50); // Wait 50ms after cancellation
    });
  }

  /**
   * Speak text in chunks for better performance with long text
   * @param {string} text - Long text to speak
   * @param {number} chunkSize - Maximum characters per chunk
   * @param {Object} options - TTS settings
   */
  async speakInChunks(text, chunkSize = 200, options = {}) {
    if (!text || text.trim() === '') return;

    const chunks = this.splitTextIntoChunks(text, chunkSize);
    
    for (let i = 0; i < chunks.length; i++) {
      if (!this.isPlaying && i > 0) break; // Stop if cancelled
      
      try {
        await this.speak(chunks[i], options);
        
        // Small pause between chunks to avoid overlap
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error speaking chunk ${i + 1}:`, error);
        break;
      }
    }
  }

  /**
   * Split text into natural chunks for TTS
   * @param {string} text - Text to split
   * @param {number} maxLength - Maximum chunk length
   */
  splitTextIntoChunks(text, maxLength = 200) {
    if (text.length <= maxLength) return [text];

    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // Handle very long sentences by splitting on commas or spaces
          if (sentence.length > maxLength) {
            const subChunks = sentence.split(',');
            for (const subChunk of subChunks) {
              if (subChunk.length <= maxLength) {
                chunks.push(subChunk.trim());
              } else {
                // Last resort: split on spaces
                const words = subChunk.trim().split(' ');
                let wordChunk = '';
                for (const word of words) {
                  if (wordChunk.length + word.length + 1 <= maxLength) {
                    wordChunk += (wordChunk ? ' ' : '') + word;
                  } else {
                    if (wordChunk) chunks.push(wordChunk);
                    wordChunk = word;
                  }
                }
                if (wordChunk) chunks.push(wordChunk);
              }
            }
          } else {
            chunks.push(sentence);
          }
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks.filter(chunk => chunk.trim());
  }

  /**
   * Stop current speech and clear queue
   */
  stop() {
    // Clear the speech queue
    this.speechQueue = [];
    this.isProcessingQueue = false;
    
    if (this.isSupported && (this.synthesis.speaking || this.synthesis.pending)) {
      this.synthesis.cancel();
      console.log('🔇 TTS stopped and queue cleared');
    }
    
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;
  }

  /**
   * Pause current speech
   */
  pause() {
    if (this.isSupported && this.synthesis.speaking && !this.isPaused) {
      this.synthesis.pause();
      console.log('⏸️ TTS paused');
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.isSupported && this.isPaused) {
      this.synthesis.resume();
      console.log('▶️ TTS resumed');
    }
  }

  /**
   * Get current playback state
   */
  getState() {
		// Use multiple indicators for more reliable state detection
		const synthesisSpeaking = this.synthesis?.speaking || false;
		const synthesisPending = this.synthesis?.pending || false;
		const hasCurrentUtterance = !!this.currentUtterance;
		const hasQueueItems = this.speechQueue.length > 0;

		return {
			isSupported: this.isSupported,
			isPlaying: this.isPlaying,
			isPaused: this.isPaused,
			isSpeaking: synthesisSpeaking || (hasCurrentUtterance && this.isPlaying),
			pending: synthesisPending,
			hasUtterance: hasCurrentUtterance,
			queueLength: this.speechQueue.length,
			isProcessingQueue: this.isProcessingQueue,
			isActive:
				this.isPlaying ||
				synthesisSpeaking ||
				synthesisPending ||
				hasCurrentUtterance ||
				hasQueueItems ||
				this.isProcessingQueue,
		};
	}

  /**
   * Update TTS settings
   * @param {Object} newSettings - Settings to update
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('🎤 TTS settings updated:', this.settings);
  }

  /**
   * Get available voices
   */
  getVoices() {
    return this.synthesis ? this.synthesis.getVoices() : [];
  }

  /**
   * Set specific voice by name or index
   * @param {string|number} voice - Voice name or index
   */
  setVoice(voice) {
    const voices = this.getVoices();
    
    if (typeof voice === 'string') {
      this.settings.voiceName = voice;
      console.log('🎤 Voice name set to:', voice);
    } else if (typeof voice === 'number' && voices[voice]) {
      this.settings.voiceName = voices[voice].name;
      console.log('🎤 Voice set to:', voices[voice].name);
    }
  }

  /**
   * Set speech rate (0.1 to 10)
   * @param {number} rate - Speech rate
   */
  setRate(rate) {
    this.settings.rate = Math.max(0.1, Math.min(10, rate));
    console.log('🎤 Speech rate set to:', this.settings.rate);
  }

  /**
   * Set speech pitch (0 to 2)
   * @param {number} pitch - Speech pitch
   */
  setPitch(pitch) {
    this.settings.pitch = Math.max(0, Math.min(2, pitch));
    console.log('🎤 Speech pitch set to:', this.settings.pitch);
  }

  /**
   * Set speech volume (0 to 1)
   * @param {number} volume - Speech volume
   */
  setVolume(volume) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    console.log('🎤 Speech volume set to:', this.settings.volume);
  }

  /**
   * Check if speech synthesis is supported
   */
  static isSupported() {
    return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  /**
   * Test TTS with sample text
   */
  async testTTS() {
    const testText = "Hello! This is a test of the native text-to-speech system.";
    try {
      await this.speak(testText);
      console.log('✅ TTS test successful');
      return true;
    } catch (error) {
      console.error('❌ TTS test failed:', error);
      return false;
    }
  }
}

export default NativeTTSService;
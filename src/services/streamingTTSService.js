/**
 * Streaming Text-to-Speech Service
 * Handles real-time TTS from WebSocket message chunks with speech recognition isolation
 * 
 * Key Features:
 * - Queue-based sequential speech processing to prevent interruptions
 * - Speech recognition isolation to prevent AI voice feedback loops
 * - Event-driven completion detection (no artificial delays)
 * - Progressive word accumulation for natural streaming
 * 
 * Usage with Speech Recognition Isolation:
 * ```javascript
 * const ttsService = new StreamingTTSService();
 * 
 * // Set up isolation callback to disable speech recognition during TTS
 * ttsService.setUICallbacks(
 *   () => console.log('TTS started'),
 *   () => console.log('TTS ended'),
 *   (error) => console.log('TTS error', error),
 *   (isActive) => {
 *     // This callback isolates TTS from speech recognition
 *     if (isActive) {
 *       speechRecognition.pause(); // Disable speech recognition during TTS
 *     } else {
 *       speechRecognition.resume(); // Re-enable after TTS completes
 *     }
 *   }
 * );
 * ```
 */
import NativeTTSService from './nativeTTSService.js';

class StreamingTTSService {
	constructor() {
		this.tts = new NativeTTSService();
		this.isEnabled = false;
		this.isMicrophoneMode = false;

		// Streaming settings
		this.streamSettings = {
			chunkDelay: 50, // Reduced delay between TTS chunks (ms)
			wordAccumulation: 10, // Start with 10 words to accumulate before speaking
			maxChunkLength: 1000, // Reduced maximum characters per TTS chunk for faster response
			pauseBetweenChunks: 0, // Reduced pause between natural chunks (ms)
		};

		// Progressive word limit settings
		this.wordLimitForTTS = 10; // Initial word limit (will increase over time)
		this.wordLimitMultiplier = 2; // Multiply word limit by this value after each chunk

		// Streaming state
		this.accumulatedText = "";
		this.isStreaming = false;
		this.currentStream = null;
		this.streamQueue = [];
		this.isProcessingQueue = false;
		this.lastChunkTime = null; // Track when last chunk was received
		this.chunkTimeout = null; // Timeout for forcing chunk speech

		// Mode detection
		this.voiceInputActive = false;
		this.chatInputActive = false;

		// UI callback functions for state changes
		this.onSpeakingStart = null;
		this.onSpeakingEnd = null;
		this.onError = null;

		// Speech recognition isolation callbacks
		this.onTTSActiveChange = null; // Callback to notify when TTS becomes active/inactive

		this.initialize();
	}

	async initialize() {
		try {
			await this.tts.initializeVoices();

			// Set optimal settings for streaming
			this.tts.updateSettings({
				rate: 1.2, // Faster rate for real-time responsiveness
				volume: 0.95, // Clear volume
				pitch: 0.95, // Slightly lower pitch for better clarity at higher speed
			});

			console.log("🎤 Streaming TTS Service initialized");

			// Test TTS on initialization
			if (process.env.NODE_ENV === "development") {
				// this.testStreamingTTS();
			}
		} catch (error) {
			console.error("❌ Failed to initialize Streaming TTS:", error);
		}
	}

	/**
	 * Set callback functions for UI state changes
	 * @param {Function} onSpeakingStart - Called when TTS starts speaking
	 * @param {Function} onSpeakingEnd - Called when TTS stops speaking
	 * @param {Function} onError - Called when TTS encounters an error
	 * @param {Function} onTTSActiveChange - Called when TTS active state changes (for speech recognition isolation)
	 */
	setUICallbacks(onSpeakingStart, onSpeakingEnd, onError, onTTSActiveChange) {
		this.onSpeakingStart = onSpeakingStart;
		this.onSpeakingEnd = onSpeakingEnd;
		this.onError = onError;
		this.onTTSActiveChange = onTTSActiveChange;

		// Set up TTS event callbacks
		if (this.tts) {
			this.tts.onStart = () => {
				console.log("🎤 TTS started speaking - triggering UI callback");
				if (this.onSpeakingStart) {
					this.onSpeakingStart();
				}
				// Signal that TTS is now active (disable speech recognition)
				if (this.onTTSActiveChange) {
					this.onTTSActiveChange(true);
				}
			};

			this.tts.onEnd = () => {
				console.log("🎤 TTS stopped speaking - triggering UI callback");
				if (this.onSpeakingEnd) {
					this.onSpeakingEnd();
				}
				// Signal that TTS is now inactive (re-enable speech recognition)
				if (this.onTTSActiveChange) {
					this.onTTSActiveChange(false);
				}
			};

			this.tts.onError = (error) => {
				console.error("🎤 TTS error - triggering UI callback:", error);
				if (this.onError) {
					this.onError(error);
				}
				if (this.onSpeakingEnd) {
					this.onSpeakingEnd();
				}
				// Signal that TTS is now inactive due to error
				if (this.onTTSActiveChange) {
					this.onTTSActiveChange(false);
				}
			};
		}
	}

	/**
	 * Enable/disable TTS based on input mode
	 * @param {boolean} microphoneMode - True if user is using microphone
	 */
	setMode(microphoneMode) {
		this.isMicrophoneMode = microphoneMode;
		this.isEnabled = microphoneMode;

		console.log(
			`🎤 TTS Mode: ${microphoneMode ? "Voice (TTS ON)" : "Chat (TTS OFF)"}`
		);

		if (!this.isEnabled) {
			this.stopStreaming();
		}
	}

	/**
	 * Start streaming TTS session
	 */
	startStreaming() {
		if (!this.isEnabled) {
			console.log("🎤 TTS not enabled, cannot start streaming");
			return;
		}

		// Reset all state
		this.isStreaming = true;
		this.accumulatedText = "";
		this.streamQueue = [];
		this.isProcessingQueue = false;
		this.currentStream = Date.now();
		this.lastChunkTime = Date.now();

		// Clear any existing timeout
		if (this.chunkTimeout) {
			clearTimeout(this.chunkTimeout);
			this.chunkTimeout = null;
		}

		// Reset word limit to initial value for new streaming session
		this.wordLimitForTTS = this.streamSettings.wordAccumulation;

		console.log(
			"🎤 Starting TTS streaming session with initial word limit:",
			this.wordLimitForTTS
		);
	}

	/**
	 * Process incoming text chunk from WebSocket
	 * @param {string} textChunk - New text chunk
	 * @param {boolean} isComplete - Whether this is the final chunk
	 */
  async processTextChunk(textChunk) {
    // debugger;
		if (!this.isEnabled) {
			console.log("🎤 TTS not enabled, ignoring chunk");
			return;
		}

		// Start streaming if not already started
		if (!this.isStreaming) {
			console.log("🎤 Starting streaming session");
			this.startStreaming();
		}

		// Process actual text chunk first if it exists
		if (textChunk && textChunk.trim()) {
			// Clean up text chunk - replace multiple whitespaces with a single space also remove any special characters only speak words and numbers except , and .
			const cleanContent = textChunk
				.replace(/\s+/g, " ")
				.replace(/[^a-zA-Z0-9,.\s]/g, "")
				.trim();

			// Only proceed if there's meaningful content after filtering
			if (cleanContent.length > 0) {
				// Accumulate text
				this.accumulatedText +=
					(this.accumulatedText ? " " : "") + cleanContent;
				this.lastChunkTime = Date.now();

				console.log(
					`🎤 Received chunk: "${cleanContent}" (total accumulated: ${this.accumulatedText.length} chars)`
				);

				// Clear any existing timeout
				if (this.chunkTimeout) {
					clearTimeout(this.chunkTimeout);
					this.chunkTimeout = null;
				}

				// Set a timeout to force speak accumulated text if no more chunks arrive
				// This ensures that text doesn't get stuck waiting for more chunks
				this.chunkTimeout = setTimeout(() => {
					if (this.accumulatedText.trim() && this.isStreaming) {
						console.log(
							"🎤 ⏰ Timeout: Force speaking accumulated text due to inactivity"
						);
						this.speakAccumulatedText(false);
					}
				}, 3000); // Wait 3 seconds for more chunks
			}
		}

		// Handle completion or check if we should speak
	
			// Check if we should speak accumulated text based on word limit or other criteria
			await this.checkAndSpeakChunk();
	}

	/**
	 * Check if accumulated text should be spoken
	 */
	async checkAndSpeakChunk() {
		if (!this.accumulatedText || !this.accumulatedText.trim()) return;

		const words = this.accumulatedText.trim().split(/\s+/);
		const hasEnoughWords = words.length >= this.wordLimitForTTS;
		const endsWithSentence = this.endsWithSentence(this.accumulatedText);
		// never stop on clause
		// const endsWithClause = this.endsWithClause(this.accumulatedText);

		console.log(
			`🎤 Check speak: ${words.length} words (limit: ${this.wordLimitForTTS}), sentence: ${endsWithSentence}`
		);

		const shouldSpeak = hasEnoughWords || endsWithSentence;

		if (shouldSpeak) {
			console.log(
				`🎤 Speaking: ${words.length} words (reason: ${
					hasEnoughWords
						? "word limit"
						: endsWithSentence
						? "sentence end"
						: "clause end"
				})`
			);
      // debugger;
			await this.speakAccumulatedText(false);

			// Increase word limit for next chunk (progressive accumulation) - but cap it at 50 words max
			if (this.wordLimitForTTS < 25) {
				this.wordLimitForTTS = this.wordLimitForTTS * this.wordLimitMultiplier;
			}

			console.log(`🎤 Word limit increased to: ${this.wordLimitForTTS}`);
		} else {
			console.log(
				`🎤 Not speaking yet: ${words.length} words < ${this.wordLimitForTTS} limit, no sentence ending`
			);
		}
	}

	/**
	 * Check if text ends with clause-ending punctuation
	 * @param {string} text - Text to check
	 */
	endsWithClause(text) {
		return /[,;:]\s*$/.test(text.trim());
	}

	/**
	 * Speak accumulated text
	 * @param {boolean} isComplete - Whether this is the final chunk
	 */
	async speakAccumulatedText(isComplete = false) {
		if (!this.accumulatedText || !this.accumulatedText.trim()) {
			console.log("🎤 No accumulated text to speak");
			if (isComplete) {
				console.log("🎤 Finishing streaming due to completion with no text");
				this.finishStreaming();
			}
			return;
		}

		const textToSpeak = this.accumulatedText.trim();

		console.log(
			`🎤 Adding to queue: "${textToSpeak.substring(0, 100)}..." (${
				textToSpeak.length
			} chars, isComplete: ${isComplete})`
		);

		// Add to queue for sequential processing
		this.streamQueue.push({
			text: textToSpeak,
			isComplete,
			timestamp: Date.now(),
		});

		// Reset accumulated text immediately
		this.accumulatedText = "";

		// Clear any timeout since we're processing now
		if (this.chunkTimeout) {
			clearTimeout(this.chunkTimeout);
			this.chunkTimeout = null;
		}

		// Process queue - this will handle the completion logic
		await this.processStreamQueue();
	}

	/**
	 * Process the TTS queue sequentially
	 */
	async processStreamQueue() {
		if (this.isProcessingQueue) {
			console.log("🎤 Queue processing already in progress, skipping");
			return;
		}

		if (this.streamQueue.length === 0) {
			console.log("🎤 No items in queue to process");
			return;
		}

		console.log(
			`🎤 Starting to process queue with ${this.streamQueue.length} items`
		);
		this.isProcessingQueue = true;
		let completionFound = false;

		try {
			while (this.streamQueue.length > 0) {
				const chunk = this.streamQueue.shift();

				console.log(
					`🎤 Speaking chunk: "${chunk.text}..." (isComplete: ${chunk.isComplete})`
				);

				// Check if this is the final chunk
				if (chunk.isComplete) {
					completionFound = true;
					console.log("🎤 Processing completion chunk");
				}

				try {
					// Speak the chunk and wait for it to complete naturally
					await this.speakChunkAndWait(chunk.text);
					console.log(
						`🎤 Successfully spoke chunk of ${chunk.text.length} characters`
					);
				} catch (error) {
					console.error(
						"❌ Error speaking chunk:",
						chunk.text.substring(0, 50) + "...",
						error
					);
					// Continue with next chunk even if this one failed
					continue;
				}
			}

			// If we processed a completion chunk, finish streaming
			if (completionFound) {
				console.log(
					"🎤 Completion chunk processed, finishing streaming session"
				);
				this.finishStreaming();
			} else {
				console.log("🎤 Queue processing completed, waiting for more chunks");
			}
		} catch (error) {
			console.error("❌ Error in queue processing:", error);
		} finally {
			this.isProcessingQueue = false;
			console.log("🎤 Queue processing finished");
		}
	}

	/**
	 * Speak a chunk and wait for it to complete naturally
	 * @param {string} text - Text to speak
	 * @returns {Promise} - Resolves when speech completes
	 */
	async speakChunkAndWait(text) {
		console.log("🎤 Speaking completee:", text);
		
		// With queue-based approach, we don't need to wait or check state
		// The nativeTTSService will handle sequencing automatically
		try {
			await this.tts.speak(text);
			console.log("✅ Chunk completed successfully");
		} catch (error) {
			console.error("❌ Error speaking completee:", error);
			throw error;
		}
	}

	/**
	 * Check if text ends with sentence-ending punctuation
	 * @param {string} text - Text to check
	 */
	endsWithSentence(text) {
		return /[.!?]\s*$/.test(text.trim());
	}

	/**
	 * Stop current streaming session
	 */
	stopStreaming() {
		console.log("🔇 Stopping TTS streaming");

		this.isStreaming = false;
		this.accumulatedText = "";
		this.streamQueue = [];
		this.currentStream = null;
		this.isProcessingQueue = false;
		this.lastChunkTime = null;

		// Clear any pending timeout
		if (this.chunkTimeout) {
			clearTimeout(this.chunkTimeout);
			this.chunkTimeout = null;
		}

		// Stop any current TTS gracefully
		try {
			if (this.tts.getState().isSpeaking || this.tts.getState().isPlaying) {
				this.tts.stop();
			}
		} catch (error) {
			console.warn("⚠️ Error stopping TTS during streaming cleanup:", error);
		}
	}

	/**
	 * Finish streaming session
	 */
	async finishStreaming() {
		console.log("✅ TTS streaming session finishing...");

		// Clear any pending timeout first
		if (this.chunkTimeout) {
			clearTimeout(this.chunkTimeout);
			this.chunkTimeout = null;
		}

		// Final safety check: if there's any remaining accumulated text, speak it now
		if (this.accumulatedText && this.accumulatedText.trim()) {
			console.log(
				"🎤 🚨 Final safety check: Found remaining accumulated text, speaking it now"
			);
			const finalText = this.accumulatedText.trim();
			console.log(`🎤 Final text to speak: "${finalText}"`);

			// Add to queue immediately and process it
			this.streamQueue.push({
				text: finalText,
				isComplete: true,
				timestamp: Date.now(),
			});

			// Clear accumulated text before processing
			this.accumulatedText = "";

			// Process the final text
			await this.processStreamQueue();

			return; // Let the queue processing handle finishing
		}

		this.isStreaming = false;
		this.currentStream = null;

		console.log("✅ TTS streaming session completed");

		// Ensure UI callback is triggered when streaming completes
		if (this.onSpeakingEnd && !this.tts.getState().isPlaying) {
			console.log(
				"🎤 Triggering onSpeakingEnd callback after streaming completion"
			);
			this.onSpeakingEnd();
		}
	}

	/**
	 * Handle complete message (fallback for non-streaming)
	 * @param {string} fullText - Complete message text
	 */
	async speakCompleteMessage(fullText) {
		if (!this.isEnabled || !fullText) return;

		console.log(
			"🎤 Speaking complete message:",
			fullText.substring(0, 100) + "..."
		);

		try {
			await this.tts.speakInChunks(
				fullText,
				this.streamSettings.maxChunkLength
			);
		} catch (error) {
			console.error("❌ Error speaking complete message:", error);
		}
	}

	/**
	 * Update streaming settings
	 * @param {Object} settings - New settings
	 */
	updateStreamSettings(settings) {
		this.streamSettings = { ...this.streamSettings, ...settings };

		// Update progressive word limit if provided
		if (settings.wordAccumulation !== undefined) {
			this.wordLimitForTTS = settings.wordAccumulation;
		}

		// Update word limit multiplier if provided
		if (settings.wordLimitMultiplier !== undefined) {
			this.wordLimitMultiplier = settings.wordLimitMultiplier;
		}

		console.log("🎤 Stream settings updated:", {
			...this.streamSettings,
			currentWordLimit: this.wordLimitForTTS,
			wordLimitMultiplier: this.wordLimitMultiplier,
		});
	}

	/**
	 * Update TTS voice settings
	 * @param {Object} ttsSettings - New TTS settings
	 */
	updateTTSSettings(ttsSettings) {
		this.tts.updateSettings(ttsSettings);
	}

	/**
	 * Check if TTS is currently active (speaking or processing queue)
	 * @returns {boolean} - True if TTS is active
	 */
	isTTSActive() {
		return this.isProcessingQueue || 
			   this.tts.getState().isActive ||
			   this.streamQueue.length > 0;
	}

	/**
	 * Get current state
	 */
	getState() {
		return {
			isEnabled: this.isEnabled,
			isMicrophoneMode: this.isMicrophoneMode,
			isStreaming: this.isStreaming,
			isProcessingQueue: this.isProcessingQueue,
			queueLength: this.streamQueue.length,
			accumulatedLength: this.accumulatedText.length,
			currentWordLimit: this.wordLimitForTTS,
			wordLimitMultiplier: this.wordLimitMultiplier,
			isPlaying: this.tts.getState().isPlaying,
			ttsState: this.tts.getState(),
			accumulatedText:
				this.accumulatedText.substring(0, 200) +
				(this.accumulatedText.length > 200 ? "..." : ""),
			hasTimeout: !!this.chunkTimeout,
			lastChunkTime: this.lastChunkTime,
			timeSinceLastChunk: this.lastChunkTime
				? Date.now() - this.lastChunkTime
				: null,
		};
	}

	/**
	 * Debug method to check if text is stuck and needs processing
	 */
	checkStuckText() {
		const state = this.getState();
		console.log("🎤 🔍 Debug - Current TTS State:", state);

		if (
			state.accumulatedLength > 0 &&
			!state.isProcessingQueue &&
			state.isStreaming
		) {
			const timeSinceLastChunk = state.timeSinceLastChunk;
			if (timeSinceLastChunk && timeSinceLastChunk > 5000) {
				// 5 seconds
				console.log("🎤 ⚠️ Text appears stuck, forcing processing");
				this.forceProcessRemaining();
				return true;
			}
		}
		return false;
	}

	/**
	 * Force process any remaining accumulated text (recovery method)
	 */
	forceProcessRemaining() {
		console.log("🎤 🔧 Force processing remaining text:", this.accumulatedText);
		if (
			this.accumulatedText &&
			this.accumulatedText.trim() &&
			this.isStreaming
		) {
			console.log("🎤 🔧 Force speaking accumulated text");
			this.speakAccumulatedText(false);
		}
	}

	/**
	 * Force complete the streaming session (recovery method)
	 */
	forceComplete() {
		console.log("🎤 🔧 Force completing streaming session");
		if (this.accumulatedText && this.accumulatedText.trim()) {
			this.speakAccumulatedText(true);
		} else {
			this.finishStreaming();
		}
	}

	/**
	 * Get available voices
	 */
	getVoices() {
		return this.tts.getVoices();
	}

	/**
	 * Set TTS voice
	 * @param {string|number} voice - Voice name or index
	 */
	setVoice(voice) {
		this.tts.setVoice(voice);
	}

	/**
	 * Pause current TTS
	 */
	pause() {
		this.tts.pause();
	}

	/**
	 * Resume paused TTS
	 */
	resume() {
		this.tts.resume();
	}

	/**
	 * Stop all TTS immediately with enhanced state cleanup
	 */
	stop() {
		console.log("🔇 Stopping TTS streaming and playback (enhanced cleanup)");
		
		// Stop streaming first
		this.stopStreaming();

		// Force clear any current speech with robust cancellation
		if (this.tts) {
			try {
				// Stop the underlying TTS service completely
				this.tts.stop();
				
				// Manually trigger callbacks to ensure UI state is updated
				if (this.onSpeakingEnd) {
					console.log("🎤 Triggering onSpeakingEnd callback from stop()");
					this.onSpeakingEnd();
				}
				
				// Signal TTS is now inactive to resume speech recognition
				if (this.onTTSActiveChange) {
					console.log("🎤 Triggering onTTSActiveChange(false) from stop()");
					this.onTTSActiveChange(false);
				}
			} catch (error) {
				console.warn("⚠️ Error during TTS stop:", error);
				// Still trigger end callbacks for consistent state
				if (this.onSpeakingEnd) {
					this.onSpeakingEnd();
				}
				if (this.onTTSActiveChange) {
					this.onTTSActiveChange(false);
				}
			}
		}
	}

	/**
	 * Utility: Create delay promise
	 * @param {number} ms - Milliseconds to delay
	 */
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Test streaming TTS
	 */
	async testStreamingTTS() {
		console.log("🧪 Testing streaming TTS...");

		this.setMode(true); // Enable microphone mode
		this.startStreaming();

		const testChunks = [
			"Hello there! ",
			"This is a test ",
			"of the streaming ",
			"text-to-speech system. ",
			"It should speak ",
			"each chunk as ",
			"it receives them. ",
			"Pretty cool, right?",
		];

		for (let i = 0; i < testChunks.length; i++) {
			// No artificial delay - process chunks as they arrive
			const isComplete = i === testChunks.length - 1;
			await this.processTextChunk(testChunks[i], isComplete);
		}
	}

	/**
	 * Debug TTS state detection
	 */
	async testTTSState() {
		console.log("🧪 Testing TTS state detection...");
		
		// Test 1: Check initial state
		console.log("Initial state:", this.tts.getState());
		
		// Test 2: Start TTS and check state immediately
		console.log("Starting TTS...");
		const promise = this.tts.speak("Testing state detection");
		console.log("State immediately after speak() call:", this.tts.getState());
		
		// Test 3: Wait a bit and check again
		await new Promise(resolve => setTimeout(resolve, 100));
		console.log("State after 100ms:", this.tts.getState());
		
		// Wait for completion
		await promise;
		console.log("State after completion:", this.tts.getState());
	}

	/**
	 * Check if browser supports TTS
	 */
	static isSupported() {
		return NativeTTSService.isSupported();
	}
}

export default StreamingTTSService;
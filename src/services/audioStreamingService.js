class AudioStreamPlayer {
  constructor() {
    this.audioContext = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentSource = null;
    this.nextStartTime = 0;
    this.bufferDuration = 0.1; // 100ms buffer
    this.sampleRate = 22050; // Common TTS sample rate
    
    this.initializeAudioContext();
  }

  async initializeAudioContext() {
    try {
      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume context if suspended (Chrome requirement)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('🎵 Audio streaming context initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
      throw new Error('Audio streaming not supported in this browser');
    }
  }

  /**
   * Add an audio chunk to the playback queue
   * @param {string} base64Audio - Base64 encoded audio data
   */
  async queueAudioChunk(base64Audio) {
    try {
      if (!base64Audio) return;

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Add to queue
      this.audioQueue.push(audioBuffer);
      
      console.log(`🎵 Audio chunk queued: ${audioBuffer.duration.toFixed(2)}s`);
      
      // Start playing if not already playing
      if (!this.isPlaying) {
        this.playNext();
      }
      
    } catch (error) {
      console.error('❌ Error queuing audio chunk:', error);
    }
  }

  /**
   * Play the next audio chunk in the queue
   */
  playNext() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift();
    
    try {
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      // Calculate when to start
      const now = this.audioContext.currentTime;
      const startTime = Math.max(now, this.nextStartTime);
      
      // Set up next chunk timing
      this.nextStartTime = startTime + audioBuffer.duration;
      
      // Handle playback end
      source.onended = () => {
        console.log('🎵 Audio chunk finished playing');
        // Play next chunk if available
        if (this.audioQueue.length > 0) {
          this.playNext();
        } else {
          this.isPlaying = false;
          this.onPlaybackComplete();
        }
      };
      
      // Start playback
      source.start(startTime);
      this.currentSource = source;
      
      console.log(`🎵 Playing audio chunk at ${startTime.toFixed(2)}s`);
      
    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Stop all audio playback and clear queue
   */
  stop() {
    try {
      if (this.currentSource) {
        this.currentSource.stop();
        this.currentSource = null;
      }
      
      this.audioQueue = [];
      this.isPlaying = false;
      this.nextStartTime = 0;
      
      console.log('🔇 Audio playback stopped');
    } catch (error) {
      console.error('❌ Error stopping audio:', error);
    }
  }

  /**
   * Pause audio playback
   */
  pause() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.isPlaying = false;
    console.log('⏸️  Audio playback paused');
  }

  /**
   * Resume audio playback
   */
  resume() {
    if (!this.isPlaying && this.audioQueue.length > 0) {
      this.playNext();
      console.log('▶️  Audio playback resumed');
    }
  }

  /**
   * Get current playback state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      queueLength: this.audioQueue.length,
      currentTime: this.audioContext?.currentTime || 0
    };
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume) {
    // Note: Web Audio API doesn't have direct volume control on context
    // You'd need to use a GainNode for volume control
    console.log(`🔊 Volume set to: ${volume}`);
  }

  /**
   * Callback when all queued audio has finished playing
   */
  onPlaybackComplete() {
    console.log('🎵 All audio chunks completed');
    // Override this method to handle completion
  }

  /**
   * Check if audio streaming is supported
   */
  static isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Alternative implementation using HTML5 Audio for simpler use cases
class SimpleAudioStreamPlayer {
  constructor() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;
  }

  async queueAudioChunk(base64Audio) {
    try {
      if (!base64Audio) return;

      // Convert base64 to blob URL
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.audioQueue.push(audioUrl);
      
      if (!this.isPlaying) {
        this.playNext();
      }
      
    } catch (error) {
      console.error('❌ Error queuing simple audio chunk:', error);
    }
  }

  playNext() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.onPlaybackComplete();
      return;
    }

    this.isPlaying = true;
    const audioUrl = this.audioQueue.shift();
    
    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.volume = 0.8;
    
    this.currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      this.playNext();
    };
    
    this.currentAudio.onerror = (error) => {
      console.error('❌ Error playing simple audio:', error);
      URL.revokeObjectURL(audioUrl);
      this.playNext();
    };
    
    this.currentAudio.play().catch(error => {
      console.error('❌ Audio play failed:', error);
      URL.revokeObjectURL(audioUrl);
      this.playNext();
    });
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    // Clean up queued URLs
    this.audioQueue.forEach(url => URL.revokeObjectURL(url));
    this.audioQueue = [];
    this.isPlaying = false;
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    this.isPlaying = false;
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
      this.isPlaying = true;
    }
  }

  onPlaybackComplete() {
    console.log('🎵 Simple audio playback completed');
  }

  static isSupported() {
    return !!window.Audio;
  }
}

export { AudioStreamPlayer, SimpleAudioStreamPlayer };

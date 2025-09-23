/**
 * WebSocket Service for Real-time Chat Streaming
 * Handles bidirectional streaming for voice chat with AI agents
 */
import { io } from 'socket.io-client';

class WebSocketService {
	constructor() {
		this.socket = null;
		this.isConnected = false;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.reconnectDelay = 1000;
		this.messageHandlers = new Map();
		this.audioQueue = [];                 
		this.isPlaying = false;
		this.currentAudio = null;
		this.audioContext = null;
		this.currentSourceNode = null;
		this.currentSession = null;

		// Initialize Audio Context for streaming playback
		this.initializeAudioContext();
	}

	/**
	 * Initialize Web Audio API for streaming audio playback
	 */
	async initializeAudioContext() {
		try {
			this.audioContext = new (window.AudioContext ||
				window.webkitAudioContext)();
			console.log("🎵 Audio context initialized");
		} catch (error) {
			console.error("❌ Failed to initialize audio context:", error);
		}
	}

	/**
	 * Connect to WebSocket server
	 * @param {string} url - WebSocket server URL
	 */
	connect(url = null) {
		const serverUrl =
			url ||
			process.env.REACT_APP_API_URL?.replace("/api", "") ||
			"http://localhost:8000";

		try {
			console.log(
				`🔌 Attempting to connect to Socket.IO server at ${serverUrl}`
			);
			this.socket = io(serverUrl, {
				transports: ["websocket", "polling"],
				timeout: 10000,
				forceNew: true,
			});

			this.socket.on("connect", this.handleConnect.bind(this));
			this.socket.on("disconnect", this.handleDisconnect.bind(this));
			this.socket.on("connect_error", this.handleError.bind(this));

			// Chat-specific events
			this.socket.on("textChunk", this.handleTextChunk.bind(this));
			this.socket.on("audioChunk", this.handleAudioChunk.bind(this));
			this.socket.on("messageComplete", this.handleResponseComplete.bind(this));
			this.socket.on("audioComplete", this.handleAudioComplete.bind(this));
			this.socket.on("message-received", this.handleMessageReceived.bind(this));
			this.socket.on("responseStart", this.handleResponseStart.bind(this));
			this.socket.on("message-response", this.handleMessageResponse.bind(this));
			this.socket.on("message-chunk-response", this.handleMessageChunkResponse.bind(this));
			this.socket.on("message-audio-chunk", this.handleMessageAudioChunk.bind(this));
			this.socket.on("error", this.handleServerError.bind(this));

			// Add a catch-all event listener to log all incoming events
			this.socket.onAny((eventName, ...args) => {
				console.log(`🔍 [WebSocketService] Received event: ${eventName}`, args);
			});

			console.log(`🔌 Attempting to connect to ${serverUrl}`);
		} catch (error) {
			console.error("❌ WebSocket connection failed:", error);
			this.handleReconnect();
		}
	}

	/**
	 * Handle Socket.IO connection
	 */
	handleConnect() {
		console.log("✅ Socket.IO connected successfully");
		this.isConnected = true;
		this.reconnectAttempts = 0;

		// Resume audio context if suspended (for autoplay policy)
		if (this.audioContext && this.audioContext.state === "suspended") {
			this.audioContext.resume();
		}

		// Trigger connected callback
		this.triggerHandler("connected", { status: "connected" });
	}

	/**
	 * Handle Socket.IO disconnection
	 */
	handleDisconnect() {
		console.log("🔌 Socket.IO disconnected");
		this.isConnected = false;
		this.triggerHandler("disconnected", { status: "disconnected" });
		this.handleReconnect();
	}

	/**
	 * Handle message received acknowledgment
	 */
	handleMessageReceived(data) {
		console.log("📨 Message received acknowledgment:", data);
		this.triggerHandler("messageReceived", data);
	}

	/**
	 * Handle response start
	 */
	handleResponseStart(data) {
		console.log("🚀 Response started:", data);
		this.triggerHandler("responseStart", data);
	}

	/**
	 * Handle message response from server
	 */
	handleMessageResponse(data) {
		console.log("📨 Received message response:", data);
		this.triggerHandler("messageResponse", data);
	}

	/**
	 * Handle message chunk response from server (streaming chunks)
	 */
	handleMessageChunkResponse(data) {
		console.log("📨 Received message chunk response:", data);
		this.triggerHandler("messageChunkResponse", data);
	}

	/**
	 * Handle message audio chunk from server
	 */
	handleMessageAudioChunk(data) {
		// Forward the event to the ChatInterface
		this.triggerHandler("messageAudioChunk", data);
		console.log("🎵 [WebSocketService] Event forwarded to ChatInterface");
	}

	/**
	 * Handle text chunk from server
	 */
	handleTextChunk(data) {
		console.log("📨 Received text chunk:", data.chunk);
		this.triggerHandler("textChunk", data);
	}

	/**
	 * Handle response completion
	 */
	handleResponseComplete(data) {
		console.log("✅ Response complete");
		this.triggerHandler("messageComplete", data);
	}

	/**
	 * Handle audio completion
	 */
	handleAudioComplete(data) {
		console.log("🎵 Audio streaming complete");
		this.triggerHandler("audioComplete", data);
	}

	/**
	 * Handle server error
	 */
	handleServerError(error) {
		console.error("❌ Server error:", error);
		this.triggerHandler("error", error);
	}

	/**
	 * Handle audio chunk streaming
	 */
	async handleAudioChunk(data) {
		console.log(
			"🎵 Received audio chunk:",
			data.audioData?.length || 0,
			"bytes"
		);

		try {
			// Emit the audio chunk to listeners first
			this.triggerHandler("audioChunk", data);

			// Also handle audio playback if audioData is provided
			if (data.audioData) {
				// Decode base64 audio data
				const audioData = this.base64ToArrayBuffer(data.audioData);

				// Queue audio chunk for playback
				this.audioQueue.push(audioData);

				// Start playback if not already playing
				if (!this.isPlaying) {
					await this.playAudioQueue();
				}
			}
		} catch (error) {
			console.error("❌ Failed to handle audio chunk:", error);
		}
	}

	/**
	 * Play audio chunks from queue using Web Audio API
	 */
	async playAudioQueue() {
		if (!this.audioContext || this.audioQueue.length === 0) return;

		this.isPlaying = true;

		try {
			while (this.audioQueue.length > 0) {
				const audioData = this.audioQueue.shift();
				await this.playAudioChunk(audioData);
			}
		} catch (error) {
			console.error("❌ Audio playback error:", error);
		} finally {
			this.isPlaying = false;
			this.triggerHandler("audioComplete", { status: "complete" });
		}
	}

	/**
	 * Play a single audio chunk
	 */
	async playAudioChunk(audioData) {
		return new Promise((resolve, reject) => {
			try {
				this.audioContext
					.decodeAudioData(audioData)
					.then((audioBuffer) => {
						const sourceNode = this.audioContext.createBufferSource();
						sourceNode.buffer = audioBuffer;
						sourceNode.connect(this.audioContext.destination);

						sourceNode.onended = () => {
							resolve();
						};

						// Store reference for potential interruption
						this.currentSourceNode = sourceNode;
						sourceNode.start();
					})
					.catch(reject);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Stop current audio playback
	 */
	stopAudio() {
		if (this.currentSourceNode) {
			try {
				this.currentSourceNode.stop();
				this.currentSourceNode = null;
			} catch (error) {
				console.log("Audio already stopped");
			}
		}

		// Clear audio queue
		this.audioQueue = [];
		this.isPlaying = false;
	}

	/**
	 * Send message to server
	 */
	sendMessage(text, messageData = {}) {
		if (!this.isConnected) {
			console.error("❌ WebSocket not connected");
			return false;
		}

		// Use the exact format passed from frontend
		const message = {
			message: messageData.message || text,
			chat_id: messageData.chat_id,
			agent: messageData.agent, // Send complete agent object instead of just agent_id
			lead_id: messageData.lead_id, // Include lead_id
			chat_history: messageData.chat_history, // Include chat history
			sender: messageData.sender || "user",
			requestAudio: messageData.requestAudio || false,
		};

		this.socket.emit("send-message", message);
		console.log("📤 Sent chat message:", text);
		return true;
	}

	/**
	 * Send voice message to server
	 */
	sendVoiceMessage(text, messageData = {}) {
		if (!this.isConnected) {
			console.error("❌ WebSocket not connected");
			return false;
		}

		// Use the exact format passed from frontend (same as text message but for voice)
		const message = {
			message: messageData.message || text,
			chat_id: messageData.chat_id,
			agent: messageData.agent, // Send complete agent object instead of just agent_id
			lead_id: messageData.lead_id, // Include lead_id
			chat_history: messageData.chat_history, // Include chat history
			sender: messageData.sender || "user",
			requestAudio: messageData.requestAudio || true, // Default to true for voice messages
			timestamp: Date.now(),
		};

		this.socket.emit("chat-message", message); // Using same event as text messages
		console.log("📤 Sent voice message:", text);
		return true;
	}

	/**
	 * Register event handler
	 */
	on(event, handler) {
		if (!this.messageHandlers.has(event)) {
			this.messageHandlers.set(event, []);
		}
		this.messageHandlers.get(event).push(handler);
	}

	/**
	 * Remove event handler
	 */
	off(event, handler) {
		if (this.messageHandlers.has(event)) {
			const handlers = this.messageHandlers.get(event);
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Trigger event handlers
	 */
	triggerHandler(event, data) {
		if (this.messageHandlers.has(event)) {
			this.messageHandlers.get(event).forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					console.error(`❌ Error in ${event} handler:`, error);
				}
			});
		}
	}

	/**
	 * Handle WebSocket errors
	 */
	handleError(error) {
		console.error("❌ WebSocket error:", error);
		this.triggerHandler("error", { error });
	}

	/**
	 * Handle reconnection logic
	 */
	handleReconnect() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			const delay =
				this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

			console.log(
				`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
			);

			setTimeout(() => {
				this.connect();
			}, delay);
		} else {
			console.error("❌ Max reconnection attempts reached");
			this.triggerHandler("maxReconnectAttemptsReached", {
				attempts: this.reconnectAttempts,
			});
		}
	}

	/**
	 * Close WebSocket connection
	 */
	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
		this.isConnected = false;
		this.stopAudio();

		// Close audio context
		if (this.audioContext && this.audioContext.state !== "closed") {
			this.audioContext.close();
		}
	}

	/**
	 * Utility: Convert ArrayBuffer to Base64
	 */
	arrayBufferToBase64(buffer) {
		let binary = "";
		const bytes = new Uint8Array(buffer);
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return window.btoa(binary);
	}

	/**
	 * Utility: Convert Base64 to ArrayBuffer
	 */
	base64ToArrayBuffer(base64) {
		const binaryString = window.atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	/**
	 * Get connection status
	 */
	getConnectionStatus() {
		return {
			isConnected: this.isConnected,
			reconnectAttempts: this.reconnectAttempts,
			audioPlaying: this.isPlaying,
			queueLength: this.audioQueue.length,
		};
	}
}

// Export singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;

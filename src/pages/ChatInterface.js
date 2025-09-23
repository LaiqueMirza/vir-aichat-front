import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Bot, User, Loader2, Mic, MicOff } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chatAPI, leadAPI, handleApiError } from "../services/api";
import websocketService from "../services/websocketService";

const ChatInterface = () => {
	const { agentId } = useParams();
	const navigate = useNavigate();
	const [agent, setAgent] = useState({});
	const [chat, setChat] = useState({});
	const [lead, setLead] = useState({}); // Add lead state
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [chatId, setChatId] = useState(null);
	const [leadCaptured, setLeadCaptured] = useState(true);
	const [isLoadingAgent, setIsLoadingAgent] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	// Voice interaction states
	const [isListening, setIsListening] = useState(false);
	const [speechRecognition, setSpeechRecognition] = useState(null);
	const [isVoiceSupported, setIsVoiceSupported] = useState(false);
	const [isVoiceMode, setIsVoiceMode] = useState(false);
	const [transcript, setTranscript] = useState("");
	const [showMicPopover, setShowMicPopover] = useState(false);
	const [micState, setMicState] = useState("idle"); // 'idle', 'listening', 'speaking'

	// WebSocket and streaming states
	const [streamingResponse, setStreamingResponse] = useState("");
	const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

	// Refs
	const silenceTimerRef = useRef(null);
	const transcriptRef = useRef("");
	const isVoiceModeRef = useRef(isVoiceMode);
	const currentAudioRef = useRef(null);
	const streamingResponseRef = useRef("");
	const audioQueueRef = useRef([]);
	const isPlayingAudioRef = useRef(false);
	const playAudioResponseRef = useRef(null);
	const micStateRef = useRef("idle");

	useEffect(() => {
		transcriptRef.current = transcript;
		isVoiceModeRef.current = isVoiceMode;
		streamingResponseRef.current = streamingResponse;
		micStateRef.current = micState;

		// Debug log to track streaming response changes
		if (streamingResponse) {
			console.log(
				"🔄 Streaming response updated:",
				streamingResponse.length,
				"characters"
			);
		}
	}, [transcript, isVoiceMode, streamingResponse, micState]);

	// Process audio queue sequentially
	const processAudioQueue = useCallback(async () => {
		if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) {
			return;
		}

		console.log(
			"🎵 Processing audio queue, items:",
			audioQueueRef.current.length
		);
		const nextAudioChunk = audioQueueRef.current.shift();

		if (nextAudioChunk) {
			console.log("🎵 Playing next audio chunk from queue");
			setMicState("speaking");

			// Add text to streaming response if available
			// if (nextAudioChunk.text) {
			// 	setStreamingResponse((prev) => {
			// 		const newResponse = prev + nextAudioChunk.text;
			// 		console.log("📝 [Queue] Updated streamingResponse:", newResponse.length);
			// 		return newResponse;
			// 	});
			// }

			// Use the ref to call the audio response function
			if (playAudioResponseRef.current) {
				try {
					await playAudioResponseRef.current(nextAudioChunk.audio);
				} catch (error) {
					console.error("❌ Failed to play audio chunk from queue:", error);
					// Continue processing queue even on error
					setMicState("idle");
				}
			}
		}
	}, []);

	// Audio playback function for WebSocket responses
	const playAudioResponse = useCallback(
		async (base64AudioData) => {
			try {
				if (!base64AudioData) {
					throw new Error("No audio data provided");
				}

				console.log("🎵 Playing audio response");
				isPlayingAudioRef.current = true;

				const binaryString = atob(base64AudioData);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}

				if (bytes.length === 0) {
					throw new Error("Empty audio data received");
				}

				const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
				const audioUrl = URL.createObjectURL(audioBlob);
				const audio = new Audio(audioUrl);

				audio.onloadstart = () => console.log("🎵 Audio loading started");
				audio.oncanplay = () => console.log("🎵 Audio ready to play");
				audio.onended = () => {
					console.log("✅ Audio playback completed");
					URL.revokeObjectURL(audioUrl);
					currentAudioRef.current = null;
					isPlayingAudioRef.current = false;

					// Return to idle state when audio ends
					if (isVoiceModeRef.current) {
						setMicState("idle");
					}

					// Process next audio chunk in queue if available
					processAudioQueue();
				};
				audio.onerror = (e) => {
					console.error("❌ Audio playback error:", e);
					URL.revokeObjectURL(audioUrl);
					currentAudioRef.current = null;
					isPlayingAudioRef.current = false;
					toast.error(
						"Failed to play audio response. Please check your audio settings."
					);

					// Process next audio chunk in queue even on error
					processAudioQueue();
				};

				audio.volume = 0.8;
				currentAudioRef.current = audio;
				await audio.play();
			} catch (error) {
				console.error("❌ Error playing audio:", error);
				currentAudioRef.current = null;
				isPlayingAudioRef.current = false;

				if (error.name === "NotAllowedError") {
					toast.error(
						"Audio playback blocked. Please allow audio autoplay in your browser."
					);
				} else if (error.name === "NotSupportedError") {
					toast.error("Audio format not supported by your browser.");
				} else if (error.message.includes("No audio data")) {
					toast.error("No audio response received from server.");
				} else if (error.message.includes("Empty audio data")) {
					toast.error("Empty audio response received.");
				} else {
					toast.error("Failed to play audio response.");
				}

				// Process next audio chunk in queue even on error
				processAudioQueue();
			}
		},
		[processAudioQueue]
	);

	// Update the ref whenever the function changes
	useEffect(() => {
		playAudioResponseRef.current = playAudioResponse;
	}, [playAudioResponse]);

	// Clear audio queue when starting new message
	const clearAudioQueue = useCallback(() => {
		console.log("🗑️ Clearing audio queue");
		audioQueueRef.current = [];
		if (currentAudioRef.current) {
			currentAudioRef.current.pause();
			currentAudioRef.current = null;
		}
		isPlayingAudioRef.current = false;
	}, []);

	// Initialize WebSocket connection
	useEffect(() => {
		if (agentId) {
			// Connect to WebSocket server
			websocketService.connect();

			// Set up WebSocket event handlers
			const handleConnected = () => {
				console.log("✅ WebSocket connected for chat");
				setIsWebSocketConnected(true);
			};

			const handleDisconnected = () => {
				console.log("🔌 WebSocket disconnected");
				setIsWebSocketConnected(false);
			};

			const handleTextChunk = (data) => {
				console.log("📝 Received text chunk:", data.chunk);
				// Update streaming response in real-time
				setStreamingResponse((prev) => {
					console.log("📝 Previous streamingResponse length:", prev.length);
					const newResponse = prev + data.chunk;
					console.log(
						"📝 Updated streamingResponse length:",
						newResponse.length
					);
					return newResponse;
				});
			};

			const handleAudioChunk = (data) => {
				console.log(
					"🎵 Received audio chunk:",
					data.audioData?.length || 0,
					"bytes"
				);
				// Audio chunks are automatically played by the websocketService
				// Set mic state to indicate audio is playing
				setMicState("speaking");
			};

			const handleMessageAudioChunk = async (data) => {
				console.log("🎵 [ChatInterface] Received message audio chunk:", data);
				console.log(
					"🎵 [ChatInterface] Voice mode status:",
					isVoiceModeRef.current
				);
				console.log(
					"🎵 [ChatInterface] Audio data available:",
					!!data.data?.audio
				);
				console.log("🎵 [ChatInterface] Text data:", data.data?.text);
				console.log("🎵 [ChatInterface] Success status:", data.success);
				console.log(
					"🎵 [ChatInterface] Is currently playing audio:",
					isPlayingAudioRef.current
				);
				console.log("🎵 [ChatInterface] Mic state:", micStateRef.current);

				// Always process audio chunks if available, regardless of voice mode for testing
				if (data.success && data.data?.audio) {
					console.log("🎵 [ChatInterface] Attempting to process audio chunk");
					console.log(
						"🎵 [ChatInterface] Audio data length:",
						data.data.audio.length
					);

					// Create audio chunk object for queue
					const audioChunk = {
						audio: data.data.audio,
						text: data.data.text || "",
					};

					// If AI is currently speaking, queue the chunk instead of interrupting
					if (isPlayingAudioRef.current && micStateRef.current === "speaking") {
						console.log(
							"🎵 [ChatInterface] AI is currently speaking, adding chunk to queue"
						);
						audioQueueRef.current.push(audioChunk);
						console.log(
							"🎵 [ChatInterface] Queue length:",
							audioQueueRef.current.length
						);
					} else {
						// If not playing or not in speaking state, check if we should stop current audio
						if (currentAudioRef.current && micStateRef.current !== "speaking") {
							console.log(
								"🔇 [ChatInterface] Stopping non-speaking audio to play new chunk"
							);
							currentAudioRef.current.pause();
							currentAudioRef.current = null;
							isPlayingAudioRef.current = false;
						}

						// If no audio is currently playing, play immediately
						if (!isPlayingAudioRef.current) {
							console.log("🎵 [ChatInterface] Playing audio chunk immediately");
							setMicState("speaking");

							try {
								// Play the audio chunk immediately
								await playAudioResponse(audioChunk.audio);

								console.log(
									"✅ [ChatInterface] Audio chunk played successfully"
								);

								// Also add the text to streaming response for visual feedback
								// if (audioChunk.text) {
								// 	setStreamingResponse((prev) => {
								// 		const newResponse = prev + audioChunk.text;
								// 		console.log("📝 [ChatInterface] Updated streamingResponse with audio text:", newResponse.length);
								// 		return newResponse;
								// 	});
								// }
							} catch (error) {
								console.error(
									"❌ [ChatInterface] Failed to play audio chunk:",
									error
								);
								console.error(
									"❌ [ChatInterface] Error details:",
									error.name,
									error.message
								);

								// Fall back to text streaming if audio fails
								if (audioChunk.text) {
									setStreamingResponse((prev) => prev + audioChunk.text);
								}

								// Reset mic state on error
								setMicState("idle");
								isPlayingAudioRef.current = false;
							}
						} else {
							// If audio is playing but not in speaking state, queue it
							console.log(
								"🎵 [ChatInterface] Audio playing but not speaking state, queueing chunk"
							);
							audioQueueRef.current.push(audioChunk);
						}
					}
				} else if (data.data?.text) {
					// If no audio, just update streaming text
					console.log("📝 [ChatInterface] No audio data, updating text only");
					setStreamingResponse((prev) => prev + data.data.text);
				} else {
					console.warn(
						"⚠️ [ChatInterface] Received audio chunk with no usable data:",
						data
					);
				}
			};

			const handleMessageComplete = (data) => {
				console.log("✅ Message streaming complete");
				// Add the complete streamed message to messages using the current streaming response
				const currentStreamingResponse = streamingResponseRef.current;
				if (currentStreamingResponse.trim()) {
					const assistantMessage = {
						id: Date.now() + 1,
						message: currentStreamingResponse,
						sender: "assistant",
						timestamp: new Date().toISOString(),
					};
					setMessages((prev) => [...prev, assistantMessage]);
				}
				setStreamingResponse(""); // Clear streaming response
				setIsLoading(false);
			};

			const handleAudioComplete = () => {
				console.log("🎵 Audio streaming complete");
				setMicState("idle");
			};

			const handleError = (data) => {
				console.error("❌ WebSocket error:", data.error);
				toast.error("Connection error occurred");
				setIsLoading(false);
			};

			const handleMessageResponse = async (data) => {
				console.log("📨 Received final message response:", data);
				setIsLoading(false);

				if (data.success && data.data?.response) {
					// Clear streaming response since we're finalizing the message
					setStreamingResponse("");

					const assistantMessage = {
						id: Date.now() + 1,
						message: data.data.response,
						sender: "assistant",
						timestamp: new Date().toISOString(),
					};
					setMessages((prev) => [...prev, assistantMessage]);

					// // Play audio response if available and in voice mode
					// if (isVoiceModeRef.current && data.data?.audio) {
					// 	try {
					// 		await playAudioResponse(data.data.audio);
					// 	} catch (error) {
					// 		console.error("❌ Failed to play audio response:", error);
					// 		toast.error("Failed to play audio response");
					// 	}
					// } else if (isVoiceModeRef.current) {
					// 	toast.error(
					// 		"Audio response not available, but text response is shown."
					// 	);
					// }
				} else {
					toast.error("Failed to get response from AI");
					// Clear streaming response on error
					setStreamingResponse("");
				}

				// Reset mic state after processing response
				setMicState("idle");
			};

			const handleMessageChunkResponse = (data) => {
				console.log("📨 Received message chunk response:", data.data.response);

				if (data.success && data.data?.response) {
					// Update streaming response with the chunk
					setStreamingResponse((prev) => prev + data.data.response);
				}
			};

			// Register event handlers
			websocketService.on("connected", handleConnected);
			websocketService.on("disconnected", handleDisconnected);
			websocketService.on("textChunk", handleTextChunk);
			websocketService.on("audioChunk", handleAudioChunk);
			websocketService.on("messageComplete", handleMessageComplete);
			websocketService.on("audioComplete", handleAudioComplete);
			websocketService.on("messageResponse", handleMessageResponse);
			websocketService.on("messageChunkResponse", handleMessageChunkResponse);
			websocketService.on("messageAudioChunk", handleMessageAudioChunk);
			websocketService.on("error", handleError);

			// Cleanup on unmount
			return () => {
				websocketService.off("connected", handleConnected);
				websocketService.off("disconnected", handleDisconnected);
				websocketService.off("textChunk", handleTextChunk);
				websocketService.off("audioChunk", handleAudioChunk);
				websocketService.off("messageComplete", handleMessageComplete);
				websocketService.off("audioComplete", handleAudioComplete);
				websocketService.off("messageResponse", handleMessageResponse);
				websocketService.off(
					"messageChunkResponse",
					handleMessageChunkResponse
				);
				websocketService.off("messageAudioChunk", handleMessageAudioChunk);
				websocketService.off("error", handleError);
				websocketService.disconnect();
			};
		}
	}, [agentId, playAudioResponse]);

	const messagesEndRef = useRef(null);
	const inputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const messageCache = useRef(new Map());
	const debounceTimeoutRef = useRef(null);
	const scrollTimeoutRef = useRef(null);
	const streamingMessageRef = useRef(null);

	// Check if this is the first load of the session
	const isFirstLoad = useCallback(() => {
		const firstLoadKey = `first_load_${agentId}`;
		return !sessionStorage.getItem(firstLoadKey);
	}, [agentId]);

	// Mark first load as completed
	const markFirstLoadCompleted = useCallback(() => {
		const firstLoadKey = `first_load_${agentId}`;
		sessionStorage.setItem(firstLoadKey, "completed");
	}, [agentId]);

	// Send message (text or voice transcript)
	const handleSendMessage = useCallback(
		async (messageText, voiceMode = false) => {
			if (!messageText.trim() || isLoading) return;

			setInputMessage("");
			setTranscript("");
			setIsLoading(true);
			const userMessage = {
				id: Date.now(),
				message: messageText,
				sender: "user",
				timestamp: new Date().toISOString(),
			};
			setMessages((prev) => [...prev, userMessage]);
			try {
				// Use WebSocket for all messages (both text and audio)
				if (isWebSocketConnected) {
					console.log("🚀 Using WebSocket streaming for message");

					// Clear any previous streaming response and audio queue before starting new message
					setStreamingResponse("");
					clearAudioQueue();

					// Set mic state to speaking while waiting for response (for voice mode)
					if (voiceMode) {
						setMicState("speaking");
					}

					// Format the last 4 chat messages for context
					const last4Messages = messages.slice(-4);
					const formattedChatHistory = last4Messages.length > 0 
						? last4Messages
							.map(
								(msg) =>
									`${msg.sender === "user" ? "user" : "assistant"}: ${
										msg.message
									}`
							)
							.join("\n")
						: []; // Return empty array if no messages instead of empty string

					// Ensure agent has required properties, fallback to agent_id if needed
					const agentData = agent && Object.keys(agent).length > 0 ? agent : { agent_id: agentId };
					
					// Ensure lead_id is properly extracted
					const leadId = lead && typeof lead === 'object' && lead.lead_id ? lead.lead_id : null;

					// Send message via WebSocket (same format for both text and voice)
					const success = websocketService.sendMessage(messageText, {
						message: messageText,
						chat_id: chatId || sessionStorage.getItem(`chat_id_${agentId}`),
						agent: agentData, // Send complete agent data with fallback
						lead_id: leadId, // Include lead_id with proper fallback
						chat_history: formattedChatHistory, // Include formatted chat history or empty array
						sender: "user",
						requestAudio: voiceMode,
					});

					if (!success) {
						throw new Error("Failed to send message via WebSocket");
					}

					// WebSocket event handlers will manage the streaming response
					return;
				} else {
					// No WebSocket connection available
					throw new Error(
						"WebSocket not connected. Please refresh the page and try again."
					);
				}
			} catch (error) {
				const errorInfo = handleApiError(error);
				let errorMessage = "Failed to send message";
				if (error.response?.status === 429) {
					errorMessage =
						"Rate limit exceeded. Please wait a moment before trying again.";
				} else if (error.response?.status === 503) {
					errorMessage =
						"Service temporarily unavailable. Please try again later.";
				} else if (error.response?.status >= 500) {
					errorMessage = "Server error occurred. Please try again.";
				} else if (error.code === "NETWORK_ERROR" || !navigator.onLine) {
					errorMessage =
						"Network connection lost. Please check your internet connection.";
				} else if (
					voiceMode &&
					error.response?.data?.message?.includes("ElevenLabs")
				) {
					errorMessage =
						"Voice synthesis service is temporarily unavailable. Your message was processed but audio could not be generated.";
				} else if (
					voiceMode &&
					error.response?.data?.message?.includes("audio")
				) {
					errorMessage =
						"Audio generation failed. Your message was processed successfully.";
				} else {
					errorMessage = errorInfo.message || "An unexpected error occurred";
				}
				toast.error(errorMessage);
				setMessages((prev) => {
					const filtered = prev.filter((msg) => msg.id !== userMessage.id);
					return [
						...filtered,
						{
							id: Date.now() + 2,
							message: `❌ ${errorMessage} Please try again.`,
							sender: "system",
							timestamp: new Date().toISOString(),
							chat_id: chatId,
							isError: true,
						},
					];
				});
			} finally {
				setIsLoading(false);
				setInputMessage("");
				setTranscript("");
			}
		},
		[
			agentId,
			chatId,
			isLoading,
			isWebSocketConnected,
			clearAudioQueue,
			lead,
			agent,
			messages,
		]
	);

	// Keep a stable reference to handleSendMessage for useEffect
	const handleSendMessageRef = useRef(handleSendMessage);
	handleSendMessageRef.current = handleSendMessage;

	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage(inputMessage, false);
		}
	};

	// Voice interaction handlers
	const handleVoiceToggle = async () => {
		if (!isVoiceSupported || !recognitionRef.current) {
			toast.error(
				"Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari."
			);
			return;
		}

		// If currently listening, stop recognition and hide popover
		if (isListening && isVoiceMode) {
			console.log("Stopping voice recognition");
			try {
				// Batch state updates
				setTimeout(() => {
					setIsVoiceMode(false);
					setIsListening(false);
					setTranscript("");
					setShowMicPopover(false);
					setMicState("idle");
				}, 0);

				// Clear any pending timers
				if (silenceTimerRef.current) {
					clearTimeout(silenceTimerRef.current);
				}

				recognitionRef.current.stop();
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (error) {
				console.error("Error stopping recognition:", error);
			}
		} else {
			// Show popover when starting voice mode
			setShowMicPopover(true);
			setMicState("idle");
			// Check microphone permissions before starting
			const startRecognition = async () => {
				try {
					// Check permissions first
					if (navigator.permissions) {
						const permission = await navigator.permissions.query({
							name: "microphone",
						});
						if (permission.state === "denied") {
							toast.error(
								"Microphone access is blocked. Please enable microphone permissions in your browser settings."
							);
							return;
						}
					}

					// Test microphone access
					if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
						try {
							const stream = await navigator.mediaDevices.getUserMedia({
								audio: true,
							});
							stream.getTracks().forEach((track) => track.stop());
						} catch (micError) {
							toast.error(
								"Microphone access denied. Please allow microphone access and try again."
							);
							return;
						}
					}

					// Clear any existing state and timers
					setTranscript("");
					lastProcessedResultIndexRef.current = 0; // Reset for new session

					if (silenceTimerRef.current) {
						clearTimeout(silenceTimerRef.current);
					}

					// Start recognition with the existing instance
					console.log("Starting voice recognition");
					try {
						if (recognitionRef.current) {
							await recognitionRef.current.start();
							console.log("Voice recognition started successfully");

							// Batch state updates after successful start
							setTimeout(() => {
								setIsVoiceMode(true);
								setIsListening(true);
							}, 0);
						} else {
							throw new Error("Recognition instance not initialized");
						}
					} catch (error) {
						console.error("Error starting recognition:", error);

						// Batch state updates on error
						setTimeout(() => {
							setIsVoiceMode(false);
							setIsListening(false);
						}, 0);

						if (error.name === "NotAllowedError") {
							toast.error(
								"Microphone access denied. Please allow microphone access and try again."
							);
						} else if (error.name === "InvalidStateError") {
							console.log("Recognition was already running, restarting...");
							try {
								await recognitionRef.current.stop();
								await new Promise((resolve) => setTimeout(resolve, 500));
								await recognitionRef.current.start();

								// Batch state updates after successful restart
								setTimeout(() => {
									setIsVoiceMode(true);
									setIsListening(true);
								}, 0);
							} catch (restartError) {
								console.error("Failed to restart recognition:", restartError);
								toast.error(
									"Failed to restart voice recognition. Please try again."
								);
							}
						} else {
							toast.error(
								"Failed to start voice recognition. Please try again."
							);
						}
					}
				} catch (error) {
					console.error("Voice recognition setup error:", error);
					// Batch state updates on setup error
					setTimeout(() => {
						setIsVoiceMode(false);
						setIsListening(false);
					}, 0);
					toast.error("Failed to setup voice recognition. Please try again.");
				}
			};

			// Start the recognition process
			// Wait for any existing recognition to fully stop before starting new one
			if (isListening) {
				console.log("Stopping existing recognition first");
				try {
					speechRecognition.stop();
					// Wait for the recognition to fully stop
					await new Promise((resolve) => setTimeout(resolve, 500));
				} catch (error) {
					console.log("Error stopping existing recognition:", error);
				}
			}
			startRecognition();
		}
	};

	const handleInputChange = (e) => {
		setInputMessage(e.target.value);

		if (chatId) {
			// Debounce typing status updates
			if (debounceTimeoutRef.current) {
				clearTimeout(debounceTimeoutRef.current);
			}

			// Clear existing typing timeout
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}

			// Debounced typing status update
			debounceTimeoutRef.current = setTimeout(() => {
				if (chatAPI.updateTypingStatus) {
					chatAPI.updateTypingStatus(chatId, true);
				}
			}, 300); // 300ms debounce

			// Set timeout to stop typing
			typingTimeoutRef.current = setTimeout(() => {
				if (chatAPI.updateTypingStatus) {
					chatAPI.updateTypingStatus(chatId, false);
				}
			}, 10000);
		}
	};

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
			if (debounceTimeoutRef.current) {
				clearTimeout(debounceTimeoutRef.current);
			}
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, []);

	// Load chat history from backend
	const loadChatHistory = useCallback(
		async (chatId, limit = 50, offset = 0) => {
			if (!chatId) return { messages: [], hasMore: false };

			// Check cache first
			const cacheKey = `${chatId}_${limit}_${offset}`;
			if (messageCache.current.has(cacheKey)) {
				return messageCache.current.get(cacheKey);
			}

			try {
				setIsLoadingHistory(true);
				const response = await chatAPI.getChatHistoryForPersistence(
					chatId,
					limit,
					offset
				);

				if (response.data.success) {
					const result = {
						messages: response.data.data.messages || [],
						hasMore: response.data.data.pagination?.hasMore || false,
						total: response.data.data.pagination?.total || 0,
					};

					// Cache the result
					messageCache.current.set(cacheKey, result);

					return result;
				} else {
					throw new Error(
						response.data.message || "Failed to load chat history"
					);
				}
			} catch (error) {
				const errorInfo = handleApiError(error);
				console.error("Failed to load chat history:", errorInfo.message);
				toast.error(`Failed to load chat history: ${errorInfo.message}`);
				return { messages: [], hasMore: false };
			} finally {
				setIsLoadingHistory(false);
			}
		},
		[]
	);

	const handleLeadSubmit = useCallback(async () => {
		try {
			const response = await leadAPI.create(agentId);
			if (response.data.success) {
				setLeadCaptured(true);
				setIsLoadingAgent(false);
				setAgent(response.data.agent);
				setChat(response.data.chat);
				setLead(response.data.lead); // Store lead information
				setChatId(response.data.chat.chat_id);

				// Load existing messages if chat exists
				if (response.data.chat.chat_id) {
					const historyResult = await loadChatHistory(
						response.data.chat.chat_id
					);
					if (historyResult.messages.length > 0) {
						// Transform backend messages to frontend format
						const transformedMessages = historyResult.messages.map((msg) => ({
							id: msg.chat_log_id || Date.now() + Math.random(),
							message: msg.message,
							sender: msg.role === "user" ? "user" : "assistant",
							timestamp: msg.created_at,
							chat_id: msg.chat_id,
						}));
						setMessages(transformedMessages);
					}
				}

				toast.success("Welcome! You can now start chatting.");
			} else {
				throw new Error(
					response.data.message || "Failed to submit lead information"
				);
			}
		} catch (error) {
			const errorInfo = handleApiError(error);
			toast.error(`Failed to submit information: ${errorInfo.message}`);
			throw error;
		}
	}, [agentId, loadChatHistory]);

	// Initialize session and handle first load logic
	useEffect(() => {
		if (agentId) {
			const loadSessionData = async () => {
				if (isFirstLoad()) {
					console.log("First load detected - calling leadAPI.create");
					try {
						await handleLeadSubmit();
						markFirstLoadCompleted();
					} catch (error) {
						console.error("Failed to handle first load:", error);
					}
				} else {
					console.log("Subsequent load detected - restoring session");
					const storedChatId = sessionStorage.getItem(`chat_id_${agentId}`);
					const storedAgent = sessionStorage.getItem(`agent_${agentId}`);
					const storedChat = sessionStorage.getItem(`chat_${agentId}`);

					if (storedChatId && storedAgent && storedChat) {
						try {
							setChatId(storedChatId);
							setAgent(JSON.parse(storedAgent));
							setChat(JSON.parse(storedChat));

							// Restore lead information if available
							const storedLead = sessionStorage.getItem(`lead_${agentId}`);
							if (storedLead) {
								setLead(JSON.parse(storedLead));
							}

							setLeadCaptured(true);

							// Load chat history for the restored session
							const historyResult = await loadChatHistory(storedChatId);
							if (historyResult.messages.length > 0) {
								const transformedMessages = historyResult.messages.map(
									(msg) => ({
										id: msg.chat_log_id || Date.now() + Math.random(),
										message: msg.message,
										sender: msg.role === "user" ? "user" : "assistant",
										timestamp: msg.created_at,
										chat_id: msg.chat_id,
									})
								);
								setMessages(transformedMessages);
							}
						} catch (error) {
							console.error("Failed to restore session data:", error);
							await handleLeadSubmit();
							markFirstLoadCompleted();
						}
					} else {
						// No stored data, treat as first load
						await handleLeadSubmit();
						markFirstLoadCompleted();
					}
				}
			};

			loadSessionData();
		}
	}, [
		agentId,
		isFirstLoad,
		handleLeadSubmit,
		markFirstLoadCompleted,
		loadChatHistory,
	]);

	// Store session data when chat/agent/lead data changes
	useEffect(() => {
		if (agentId && chat.chat_id && agent.name) {
			sessionStorage.setItem(`chat_id_${agentId}`, chat.chat_id);
			sessionStorage.setItem(`agent_${agentId}`, JSON.stringify(agent));
			sessionStorage.setItem(`chat_${agentId}`, JSON.stringify(chat));

			// Store lead information if available
			if (lead.lead_id) {
				sessionStorage.setItem(`lead_${agentId}`, JSON.stringify(lead));
			}
		}
	}, [agentId, chat, agent, lead]);

	// Initialize speech recognition instance once
	const recognitionRef = useRef(null);
	const lastProcessedResultIndexRef = useRef(0);

	useEffect(() => {
		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			setIsVoiceSupported(false);
			toast.error(
				"Voice recognition is not supported in your browser. Please use a modern browser like Chrome or Edge."
			);
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = "en-US";
		recognitionRef.current = recognition;

		// Set up all event handlers
		recognition.onstart = () => {
			console.log("Speech recognition started - clearing all previous state");
			// Reset the index to track which results we've processed
			lastProcessedResultIndexRef.current = 0;
			// Clear any existing transcript and timers for fresh start
			setTranscript("");
			if (silenceTimerRef.current) {
				clearTimeout(silenceTimerRef.current);
			}
			// Batch state updates together
			setTimeout(() => {
				setIsListening(true);
				setIsVoiceMode(true);
				setMicState("idle");
			}, 0);
		};

		recognition.onerror = (event) => {
			console.log("Speech recognition error occurred:", event.error);

			// Handle specific error cases
			switch (event.error) {
				case "not-allowed":
					// Batch state updates
					setTimeout(() => {
						setIsListening(false);
						setIsVoiceMode(false);
					}, 0);
					toast.error(
						"Microphone access denied. Please allow microphone access and try again."
					);
					break;

				case "aborted":
					// Normal when stopping, just log
					console.log("Recognition aborted - this is normal when stopping");
					break;

				case "no-speech":
					// Just log, don't update state
					console.log("No speech detected - continuing to listen");
					break;

				default:
					console.error("Speech recognition error:", event.error);
					// Batch state updates
					setTimeout(() => {
						setIsListening(false);
						setIsVoiceMode(false);
					}, 0);
					toast.error("Voice recognition error. Please try again.");
					break;
			}
		};
		recognition.onend = () => {
			console.log("Speech recognition ended");

			// Only update state if we're not in voice mode
			if (!isVoiceModeRef.current) {
				setTimeout(() => {
					setIsListening(false);
					setIsVoiceMode(false);
				}, 0);
				return;
			}

			// Only restart if we're still in voice mode
			if (isVoiceModeRef.current) {
				const restartDelay = 200;
				console.log(`Scheduling recognition restart in ${restartDelay}ms`);

				const restartTimeout = setTimeout(async () => {
					// Double check we're still in voice mode when timeout fires
					if (!isVoiceModeRef.current) {
						console.log("Voice mode disabled before restart, canceling");
						return;
					}

					try {
						await recognition.start();
						console.log("Successfully restarted recognition");
					} catch (error) {
						console.error("Failed to restart recognition:", error);

						// Batch state updates
						setTimeout(() => {
							setIsListening(false);
							setIsVoiceMode(false);
						}, 0);

						if (error.name === "InvalidStateError") {
							console.log("Recognition was already running, cleaning up");
						} else {
							toast.error(
								"Failed to restart voice recognition. Please try again."
							);
						}
					}
				}, restartDelay);

				// Store the timeout ID for cleanup
				return () => clearTimeout(restartTimeout);
			} else {
				console.log("Voice mode disabled or processing, not restarting");
				// Batch state updates
				setTimeout(() => {
					setIsListening(false);
				}, 0);
			}
		};

		recognition.onresult = (event) => {
			console.log("Speech recognition result received");
			let finalTranscript = "";
			let hasInterimResults = false;

			// Interrupt any currently playing audio when user starts speaking
			if (currentAudioRef.current) {
				console.log("🔇 Interrupting AI audio - user started speaking");
				currentAudioRef.current.pause();
				currentAudioRef.current = null;
			}

			// Process only NEW results from lastProcessedResultIndexRef.current onwards
			for (
				let i = lastProcessedResultIndexRef.current;
				i < event.results.length;
				i++
			) {
				const result = event.results[i];
				const transcript = result[0].transcript;

				console.log(`Processing NEW result ${i}:`, {
					transcript: transcript.trim(),
					isFinal: result.isFinal,
					confidence: result[0].confidence,
				});

				if (result.isFinal) {
					finalTranscript += transcript;
					lastProcessedResultIndexRef.current = i + 1; // Update the last processed index
				} else {
					hasInterimResults = true;
				}
			}

			// Update mic state based on speech activity
			if (finalTranscript || hasInterimResults) {
				setMicState("listening");
			}

			// Update the transcript state with deduplication
			if (finalTranscript) {
				setTranscript((prev) => {
					// Remove any duplicate phrases
					const newTranscript = prev.trim();
					const incoming = finalTranscript.trim();

					// If the incoming text is already at the end of the previous text, don't add it
					if (newTranscript.endsWith(incoming)) {
						return newTranscript;
					}

					// If the incoming text starts with the end of the previous text,
					// only add the new part
					const words = incoming.split(" ");
					const prevWords = newTranscript.split(" ");

					for (let i = Math.min(words.length, prevWords.length); i > 0; i--) {
						const overlap = prevWords.slice(-i).join(" ");
						if (incoming.startsWith(overlap)) {
							return (
								newTranscript + " " + incoming.slice(overlap.length).trim()
							);
						}
					}

					return (newTranscript + " " + incoming).trim();
				});

				// Update silence detection timer if we have new speech
				if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
				silenceTimerRef.current = setTimeout(() => {
					// After 3s of silence, send the complete transcript
					const finalTranscript = transcriptRef.current.trim();
					if (finalTranscript) {
						console.log(
							"Silence detected, sending transcript:",
							finalTranscript
						);
						setMicState("speaking"); // Set to speaking when AI is responding
						handleSendMessageRef.current(finalTranscript, true);
						setTranscript("");
					} else {
						setMicState("idle"); // Back to idle if no transcript
					}
				}, 1000);
			}
		};

		setSpeechRecognition(recognition);
		setIsVoiceSupported(true);

		return () => {
			if (recognition) {
				try {
					recognition.stop();
				} catch (error) {
					console.error("Error stopping recognition:", error);
				}
			}
			if (silenceTimerRef.current) {
				clearTimeout(silenceTimerRef.current);
			}
		};
	}, []); // Remove handleSendMessage from dependencies

	// Update the ref whenever isVoiceMode changes
	useEffect(() => {
		isVoiceModeRef.current = isVoiceMode;
	}, [isVoiceMode]);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	// Throttled scroll function for streaming responses
	const throttledScrollToBottom = useCallback(() => {
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}
		scrollTimeoutRef.current = setTimeout(() => {
			// Prefer scrolling to streaming message if it exists and has content
			if (streamingMessageRef.current && streamingResponse) {
				streamingMessageRef.current.scrollIntoView({ 
					behavior: "smooth",
					block: "end" // Ensure the bottom of the streaming message is visible
				});
			} else if (messagesEndRef.current) {
				messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
			}
		}, 20); // Reduced throttle to 50ms for more responsive scrolling during streaming
	}, [streamingResponse]);

	// Auto-scroll to bottom when streaming response updates
	useEffect(() => {
		if (streamingResponse) {
			throttledScrollToBottom();
		}
	}, [streamingResponse, throttledScrollToBottom]);

	// Auto-scroll to bottom when loading starts (new message being processed)
	useEffect(() => {
		if (isLoading && messagesEndRef.current) {
			// Immediate scroll when loading starts
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [isLoading]);

	// Keep inputMessage in sync with transcript for voice mode
	useEffect(() => {
		if (isVoiceMode) {
			setInputMessage(transcript);
		}
	}, [transcript, isVoiceMode]);

	const formatMessageTime = (timestamp) => {
		return format(new Date(timestamp), "HH:mm");
	};

	const renderMessage = (message) => {
		const isUser = message.sender === "user";
		const isSystem = message.sender === "system";
		const isError = message.isError;

		return (
			<div
				key={message.id}
				className={`message ${
					isUser ? "user" : isSystem ? "system" : "assistant"
				} ${
					isUser
						? "message-user"
						: isSystem
						? "message-system"
						: "message-assistant"
				}`}>
				<div className="message-avatar">
					{isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
				</div>
				<div
					className={`message-content ${
						isError ? "error-message-content" : ""
					}`}>
					{isUser || isSystem ? (
						<p>{message.message}</p>
					) : (
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								code: ({ node, inline, className, children, ...props }) => {
									return inline ? (
										<code
											className="bg-gray-100 px-1 py-0.5 rounded text-sm"
											{...props}>
											{children}
										</code>
									) : (
										<pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto">
											<code {...props}>{children}</code>
										</pre>
									);
								},
							}}>
							{message.message}
						</ReactMarkdown>
					)}
					<div className="message-time">
						{formatMessageTime(message.timestamp)}
					</div>
				</div>
			</div>
		);
	};

	if (!agent) {
		return (
			<div className="chat-container">
				<div className="loading-container">
					<div className="loading-spinner"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="chat-container">
			{/* Mic Popover Overlay */}
			{showMicPopover && (
				<div
					className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
					style={{ backdropFilter: "blur(2px)" }}>
					<div className="relative bg-white rounded-3xl p-12 shadow-2xl flex flex-col items-center">
						{/* Close button */}
						<button
							onClick={() => {
								// Stop any currently playing AI audio when closing popover
								if (currentAudioRef.current) {
									console.log("🔇 Stopping AI audio - popover closed");
									currentAudioRef.current.pause();
									currentAudioRef.current = null;
									// Reset mic state to idle when audio is stopped
									setMicState("idle");
								}
								setShowMicPopover(false);
								handleVoiceToggle();
							}}
							className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
							×
						</button>

						{/* Mic Icon with Animation */}
						<div className="relative mb-6">
							{/* Pulsing waves background */}
							{micState === "listening" && (
								<>
									<div
										className="absolute inset-0 rounded-full bg-green-400 opacity-20 animate-ping"
										style={{ animationDuration: "1s" }}></div>
									<div
										className="absolute inset-0 rounded-full bg-green-400 opacity-30 animate-ping"
										style={{
											animationDuration: "1.5s",
											animationDelay: "0.2s",
										}}></div>
									<div
										className="absolute inset-0 rounded-full bg-green-400 opacity-10 animate-ping"
										style={{
											animationDuration: "2s",
											animationDelay: "0.4s",
										}}></div>
								</>
							)}
							{micState === "speaking" && (
								<>
									<div
										className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping"
										style={{ animationDuration: "1s" }}></div>
									<div
										className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping"
										style={{
											animationDuration: "1.5s",
											animationDelay: "0.2s",
										}}></div>
									<div
										className="absolute inset-0 rounded-full bg-blue-400 opacity-10 animate-ping"
										style={{
											animationDuration: "2s",
											animationDelay: "0.4s",
										}}></div>
								</>
							)}

							{/* Main mic icon */}
							<div
								className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-300 ${
									micState === "listening"
										? "bg-green-500"
										: micState === "speaking"
										? "bg-blue-500"
										: "bg-gray-500"
								}`}>
								<Mic className="w-12 h-12 text-white" />
							</div>
						</div>

						{/* Status text */}
						<div className="text-center">
							<p className="text-lg font-semibold text-gray-800 mb-2">
								{micState === "listening"
									? "Listening..."
									: micState === "speaking"
									? "AI Speaking..."
									: "Ready to Listen"}
							</p>
							<p className="text-sm text-gray-600">
								{transcript && micState === "listening"
									? `"${transcript}"`
									: micState === "speaking"
									? "Playing AI response"
									: "Start speaking when ready"}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Main Chat Interface */}
			{isLoadingAgent ? (
				<div className="loading-container">
					<div className="loading-spinner"></div>
					<p>Loading agent...</p>
				</div>
			) : (
				leadCaptured && (
					<>
						{/* Header */}
						<div className="chat-header">
							<div className="flex items-center gap-3">
								<button
									onClick={() => navigate("/admin")}
									className="p-2 hover:bg-white/10 rounded-lg transition-colors">
									<ArrowLeft className="w-5 h-5" />
								</button>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
										<Bot className="w-5 h-5" />
									</div>
									<div>
										<h1 className="font-semibold">{agent.name}</h1>
									</div>
								</div>
							</div>
						</div>

						{/* Messages */}
						<div className="chat-messages">
							{isLoadingHistory ? (
								<div className="loading-container">
									<div className="loading-spinner"></div>
									<p>Loading chat history...</p>
								</div>
							) : messages.length === 0 ? (
								<div className="text-center py-12">
									<Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
									<h3 className="text-lg font-medium text-gray-900 mb-2">
										Start a conversation with {agent.name}
									</h3>
									<p className="text-gray-500">
										{agent.description || "Ask me anything!"}
									</p>
								</div>
							) : (
								<>
									{messages.map(renderMessage)}
									{/* Show streaming response in real-time - Always show when isLoading or has content */}
									{(isLoading || streamingResponse) && (
										<div
											ref={streamingMessageRef}
											className="message assistant message-assistant streaming-message"
											style={{
												backgroundColor: "#f0f8ff",
												border: "2px solid #007acc",
											}}>
											<div className="message-avatar">
												<Bot className="w-4 h-4" />
											</div>
											<div className="message-content">
												<div className="text-xs text-blue-600 mb-1">
													{streamingResponse
														? "Streaming..."
														: "Waiting for response..."}
												</div>
												{streamingResponse ? (
													<div className="streaming-content">
														{/* Show raw text while streaming for better UX */}
														<div className="whitespace-pre-wrap">
															{streamingResponse}
														</div>
													</div>
												) : (
													<div className="text-gray-500 italic">
														Processing your message...
													</div>
												)}
												<div className="message-time">
													{format(new Date(), "HH:mm")}
													<span className="ml-1 text-blue-500 typing-indicator animate-pulse">
														●
													</span>
													{/* Streaming indicator with animation */}
												</div>
											</div>
										</div>
									)}
									<div ref={messagesEndRef} />
								</>
							)}
						</div>

						{/* Input */}
						<div className="chat-input-container">
							<div className="chat-input-wrapper">
								<textarea
									ref={inputRef}
									value={inputMessage}
									onChange={handleInputChange}
									onKeyPress={handleKeyPress}
									placeholder={`Message ${agent.name}...`}
									className="chat-input"
									rows={1}
									disabled={isLoading || (isListening && isVoiceMode)}
								/>
								{isVoiceSupported && (
									<div className="voice-input-container">
										<button
											onClick={handleVoiceToggle}
											disabled={isLoading}
											className={`voice-button ${
												isListening && isVoiceMode ? "listening" : "idle"
											}`}
											title={
												isListening && isVoiceMode
													? "Stop recording"
													: "Start voice input"
											}>
											{isListening && isVoiceMode ? (
												<MicOff className="w-5 h-5" />
											) : (
												<Mic className="w-5 h-5" />
											)}
										</button>
										{isListening && isVoiceMode && (
											<div className="recording-indicator">
												<div className="recording-dot"></div>
												<span className="recording-text">Recording...</span>
											</div>
										)}
									</div>
								)}
								<button
									onClick={() => handleSendMessage(inputMessage, false)}
									disabled={
										!inputMessage.trim() ||
										isLoading ||
										(isListening && isVoiceMode)
									}
									className="send-button">
									{isLoading ? (
										<Loader2 className="w-5 h-5 loading-spinner" />
									) : (
										<Send className="w-5 h-5" />
									)}
								</button>
							</div>
						</div>
					</>
				)
			)}
		</div>
	);
};

export default ChatInterface;
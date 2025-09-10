import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Send,
	Paperclip,
	MoreVertical,
	ArrowLeft,
	Bot,
	User,
	Loader2,
	Mic,
	MicOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chatAPI, agentAPI, leadAPI, handleApiError } from "../services/api";
import TypingIndicator from "../components/TypingIndicator";
import FileUpload from "../components/FileUpload";
import LeadCaptureModal from "../components/LeadCaptureModal";

const POLLING_INTERVAL = 3000; // 3 seconds

const ChatInterface = () => {
	const { agentId } = useParams();
	const navigate = useNavigate();
	const [agent, setAgent] = useState({});
	const [chat, setChat] = useState({});
	const [lead, setLead] = useState({});
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isTyping, setIsTyping] = useState(false);
	const [chatId, setChatId] = useState(null);
	const [showFileUpload, setShowFileUpload] = useState(false);
	const [lastMessageId, setLastMessageId] = useState(null);
	const [showLeadCapture, setShowLeadCapture] = useState(false);
	const [leadCaptured, setLeadCaptured] = useState(true);
	const [isSubmittingLead, setIsSubmittingLead] = useState(false);
	const [isLoadingAgent, setIsLoadingAgent] = useState(false);
	const [isLoadingChat, setIsLoadingChat] = useState(false);
	const [agentError, setAgentError] = useState(null);
	const [chatError, setChatError] = useState(null);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [sessionId, setSessionId] = useState(null);
	// Voice interaction states
	const [isListening, setIsListening] = useState(false);
	const [isProcessingVoice, setIsProcessingVoice] = useState(false);
	const [speechRecognition, setSpeechRecognition] = useState(null);
	const [isVoiceSupported, setIsVoiceSupported] = useState(false);
	const [isManualStop, setIsManualStop] = useState(false);
	const [isVoiceMode, setIsVoiceMode] = useState(false);
	const [speechHistory, setSpeechHistory] = useState([]);

	const messagesEndRef = useRef(null);
	const inputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const messageCache = useRef(new Map());
	const debounceTimeoutRef = useRef(null);

	// Generate or retrieve session ID
	const getSessionId = useCallback(() => {
		const sessionKey = `chat_session_${agentId}`;
		let currentSessionId = sessionStorage.getItem(sessionKey);

		if (!currentSessionId) {
			currentSessionId = `session_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`;
			sessionStorage.setItem(sessionKey, currentSessionId);
		}

		return currentSessionId;
	}, [agentId]);

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

	const handleSendMessage = async () => {
		if (!inputMessage.trim() || isLoading) return;
		const messageText = inputMessage.trim();
		setInputMessage("");
		setSpeechHistory([]);
		setIsLoading(true);

		const userMessage = {
			id: Date.now(),
			message: messageText,
			sender: "user",
			timestamp: new Date().toISOString(),
		};

		setMessages((prev) => [...prev, userMessage]);

		try {
			const response = await chatAPI.sendMessage({
				message: messageText,
				chat_id: chat.chat_id,
				agent_id: agentId,
				sender: "user",
				requestAudio: isVoiceMode,
			});

			if (response.data?.data?.response) {
				const assistantMessage = {
					id: Date.now() + 1,
					message: response.data.data.response,
					sender: "assistant",
					timestamp: new Date().toISOString(),
				};
				setMessages((prev) => [...prev, assistantMessage]);
				setLastMessageId(assistantMessage.id);

				// Play audio response if available
				if (isVoiceMode && response.data?.data?.audio) {
					await playAudioResponse(response.data.data.audio);
				} else if (isVoiceMode) {
					// Fallback if no audio data received
					setIsProcessingVoice(false);
					toast.error(
						"Audio response not available, but text response is shown."
					);
				}

				// Reset voice mode when message is sent
				setIsVoiceMode(false);

				// Clear input field after successful response
				setInputMessage("");
				setSpeechHistory([]);
			}
		} catch (error) {
			const errorInfo = handleApiError(error);
			console.error("Message send error:", error);

			// Enhanced error handling for different types of failures
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
				isVoiceMode &&
				error.response?.data?.message?.includes("ElevenLabs")
			) {
				errorMessage =
					"Voice synthesis service is temporarily unavailable. Your message was processed but audio could not be generated.";
			} else if (
				isVoiceMode &&
				error.response?.data?.message?.includes("audio")
			) {
				errorMessage =
					"Audio generation failed. Your message was processed successfully.";
			} else {
				errorMessage = errorInfo.message || "An unexpected error occurred";
			}

			toast.error(errorMessage);

			if (isVoiceMode) {
				setIsProcessingVoice(false);
			}

			// Reset voice mode after error
			setIsVoiceMode(false);

			// Remove the failed user message and add an error message
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
			if (isVoiceMode) {
				setIsProcessingVoice(false);
			}
			// Reset voice mode in finally block
			setIsVoiceMode(false);

			// Ensure input is cleared after API call completes
			setInputMessage("");
			setSpeechHistory([]);
		}
	};

	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	// Voice interaction handlers
	const handleVoiceToggle = async () => {
		if (!isVoiceSupported) {
			toast.error(
				"Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari."
			);
			return;
		}

		if (isListening) {
			// Stop listening
			if (speechRecognition) {
				setIsManualStop(true);
				setIsProcessingVoice(false);
				// Keep isVoiceMode true until API response
				speechRecognition.stop();
			}
		} else {
			// Check microphone permissions before starting
			try {
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
						// Stop the test stream immediately
						stream.getTracks().forEach((track) => track.stop());
					} catch (micError) {
						console.error("Microphone access error:", micError);
						if (micError.name === "NotAllowedError") {
							toast.error(
								"Microphone access denied. Please allow microphone access and try again."
							);
						} else if (micError.name === "NotFoundError") {
							toast.error(
								"No microphone found. Please connect a microphone and try again."
							);
						} else {
							toast.error(
								"Unable to access microphone. Please check your microphone settings."
							);
						}
						return;
					}
				}

				// Start listening - preserve existing text
				if (speechRecognition) {
					// Preserve existing input text by adding it to speech history
					const existingText = inputMessage.trim();
					if (existingText) {
						setSpeechHistory([existingText]);
					} else {
						setSpeechHistory([]);
					}
					setIsManualStop(false);
					setIsProcessingVoice(false);
					setIsVoiceMode(true);
					speechRecognition.start();
				}
			} catch (error) {
				console.error("Failed to start speech recognition:", error);
				toast.error("Failed to start voice recognition. Please try again.");
			}
		}
	};

	const playAudioResponse = async (base64AudioData) => {
		try {
			if (!base64AudioData) {
				throw new Error("No audio data provided");
			}

			console.log("🎵 Playing audio response");

			// Convert base64 to blob
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

			audio.onloadstart = () => {
				console.log("🎵 Audio loading started");
			};

			audio.oncanplay = () => {
				console.log("🎵 Audio ready to play");
			};

			audio.onended = () => {
				console.log("✅ Audio playback completed");
				URL.revokeObjectURL(audioUrl);
				setIsProcessingVoice(false);
				// isVoiceMode will be reset by API response handler
			};

			audio.onerror = (e) => {
				console.error("❌ Audio playback error:", e);
				URL.revokeObjectURL(audioUrl);
				setIsProcessingVoice(false);
				// isVoiceMode will be reset by API response handler
				toast.error(
					"Failed to play audio response. Please check your audio settings."
				);
			};

			// Set volume and play
			audio.volume = 0.8;
			await audio.play();
		} catch (error) {
			console.error("❌ Error playing audio:", error);
			setIsProcessingVoice(false);
			// isVoiceMode will be reset by API response handler

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
			}, 2000);
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

	const handleLeadSubmit = async () => {
		setIsSubmittingLead(true);
		try {
			const response = await leadAPI.create(agentId);
			if (response.data.success) {
				setLeadCaptured(true);
				setShowLeadCapture(false);
				setIsLoadingAgent(false);
				setAgent(response.data.agent);
				setChat(response.data.chat);
				setLead(response.data.lead);
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
			throw error; // Re-throw to prevent modal from closing
		} finally {
			setIsSubmittingLead(false);
		}
	};

	// Initialize session and handle first load logic
	useEffect(() => {
		if (agentId) {
			// Initialize session ID
			const currentSessionId = getSessionId();
			setSessionId(currentSessionId);

			// Only call leadAPI.create on first load
			if (isFirstLoad()) {
				console.log("First load detected - calling leadAPI.create");
				handleLeadSubmit()
					.then(() => {
						markFirstLoadCompleted();
					})
					.catch((error) => {
						console.error("Failed to handle first load:", error);
						// Don't mark as completed if it failed
					});
			} else {
				console.log("Subsequent load detected - skipping leadAPI.create");
				// On subsequent loads, try to restore session data
				const storedChatId = sessionStorage.getItem(`chat_id_${agentId}`);
				const storedAgent = sessionStorage.getItem(`agent_${agentId}`);
				const storedChat = sessionStorage.getItem(`chat_${agentId}`);

				if (storedChatId && storedAgent && storedChat) {
					try {
						setChatId(storedChatId);
						setAgent(JSON.parse(storedAgent));
						setChat(JSON.parse(storedChat));
						setLeadCaptured(true);

						// Load chat history for the restored session
						loadChatHistory(storedChatId).then((historyResult) => {
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
						});
					} catch (error) {
						console.error("Failed to restore session data:", error);
						// If restoration fails, treat as first load
						handleLeadSubmit().then(() => {
							markFirstLoadCompleted();
						});
					}
				} else {
					// No stored data, treat as first load
					handleLeadSubmit().then(() => {
						markFirstLoadCompleted();
					});
				}
			}
		}
	}, [
		agentId,
		getSessionId,
		isFirstLoad,
		markFirstLoadCompleted,
		loadChatHistory,
	]);

	// Store session data when chat/agent data changes
	useEffect(() => {
		if (agentId && chat.chat_id && agent.name) {
			sessionStorage.setItem(`chat_id_${agentId}`, chat.chat_id);
			sessionStorage.setItem(`agent_${agentId}`, JSON.stringify(agent));
			sessionStorage.setItem(`chat_${agentId}`, JSON.stringify(chat));
		}
	}, [agentId, chat, agent]);

	// Initialize speech recognition
	useEffect(() => {
		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;

		if (SpeechRecognition) {
			const recognition = new SpeechRecognition();
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.maxAlternatives = 1;
			recognition.lang = "en-US";

			// Optimize for smoother speech recognition
			if ("webkitSpeechRecognition" in window) {
				recognition.webkitSpeechRecognition = true;
			}

			// Reduce audio processing delays
			try {
				recognition.serviceURI = recognition.serviceURI || "";
			} catch (e) {
				// Ignore if not supported
			}

			recognition.onstart = () => {
				setIsListening(true);
			};

			recognition.onresult = (event) => {
				if (event.results) {
					let finalTranscript = "";
					let interimTranscript = "";

					// Process all results from the current event
					for (let i = event.resultIndex; i < event.results.length; i++) {
						const transcript = event.results[i][0].transcript;
						if (event.results[i].isFinal) {
							finalTranscript += transcript;
						} else {
							interimTranscript += transcript;
						}
					}

					// Update speech history with final results only
					if (finalTranscript) {
						const trimmedTranscript = finalTranscript.trim();
						if (trimmedTranscript) {
							setSpeechHistory((prev) => {
								const newHistory = [...prev, trimmedTranscript];
								// Update input message with complete history
								const combinedText = newHistory.join(" ");
								setInputMessage(combinedText);
								return newHistory;
							});
						}
					} else if (interimTranscript) {
						// For interim results, combine existing history with current interim
						setSpeechHistory((currentHistory) => {
							const combinedText =
								currentHistory.length > 0
									? currentHistory.join(" ") + " " + interimTranscript.trim()
									: interimTranscript.trim();
							setInputMessage(combinedText);
							return currentHistory; // Don't modify history for interim results
						});
					}
				}
			};

			recognition.onend = () => {
				setIsListening(false);

				// Check if this was a manual stop
				if (isManualStop) {
					setIsManualStop(false);
					setIsProcessingVoice(false);
					// Keep isVoiceMode true until API response
					// Preserve input text when manually stopping microphone
					return;
				}

				// Restart recognition automatically to keep microphone active
				// unless user explicitly stopped it
				if (!isManualStop && speechRecognition && isVoiceMode) {
					try {
						setTimeout(() => {
							if (!isManualStop && speechRecognition && isVoiceMode) {
								speechRecognition.start();
							}
						}, 100); // Small delay to prevent rapid restart issues
					} catch (error) {
						console.error("Failed to restart speech recognition:", error);
						setIsProcessingVoice(false);
						// Keep isVoiceMode true until API response
					}
				} else {
					setIsProcessingVoice(false);
					// Keep isVoiceMode true until API response
				}
			};

			recognition.onerror = (event) => {
				console.error("Speech recognition error:", event.error);
				setIsListening(false);
				setIsProcessingVoice(false);

				// Only reset voice mode for serious errors, not recoverable ones
				const seriousErrors = [
					"not-allowed",
					"audio-capture",
					"service-not-allowed",
				];
				if (seriousErrors.includes(event.error)) {
					setIsVoiceMode(false);
				}

				switch (event.error) {
					case "not-allowed":
						toast.error(
							"Microphone access denied. Please enable microphone permissions in your browser settings."
						);
						break;
					case "no-speech":
						// Don't show error for no speech - this is normal and recoverable
						console.log("No speech detected, continuing to listen...");
						break;
					case "audio-capture":
						toast.error(
							"Microphone not found or not working. Please check your microphone."
						);
						break;
					case "network":
						toast.error(
							"Network error occurred. Please check your internet connection."
						);
						// Network errors are recoverable, don't reset voice mode
						break;
					case "aborted":
						// Don't show error for user-initiated stops
						break;
					case "service-not-allowed":
						toast.error(
							"Speech recognition service not allowed. Please try again."
						);
						break;
					default:
						toast.error(
							`Speech recognition failed: ${event.error}. Please try again.`
						);
					// Keep isVoiceMode true for unknown errors until API response
				}
			};

			setSpeechRecognition(recognition);
			setIsVoiceSupported(true);
		} else {
			setIsVoiceSupported(false);
			console.warn("Speech recognition not supported in this browser");
			toast.error(
				"Voice recognition is not supported in your browser. Please use a modern browser like Chrome or Edge."
			);
		}
	}, []);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

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
							{isLoadingChat || isLoadingHistory ? (
								<div className="loading-container">
									<div className="loading-spinner"></div>
									<p>
										{isLoadingHistory
											? "Loading chat history..."
											: "Loading chat..."}
									</p>
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
									{isTyping && <TypingIndicator />}
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
									disabled={isLoading || isListening}
								/>
								{isVoiceSupported && (
									<div className="voice-input-container">
										<button
											onClick={handleVoiceToggle}
											disabled={
												isLoading || (isProcessingVoice && !isManualStop)
											}
											className={`voice-button ${
												isListening
													? "listening"
													: isProcessingVoice && !isManualStop
													? "processing"
													: "idle"
											}`}
											title={
												isListening ? "Stop recording" : "Start voice input"
											}>
											{isProcessingVoice && !isManualStop ? (
												<Loader2 className="w-5 h-5 loading-spinner" />
											) : isListening ? (
												<MicOff className="w-5 h-5" />
											) : (
												<Mic className="w-5 h-5" />
											)}
										</button>
										{isListening && (
											<div className="recording-indicator">
												<div className="recording-dot"></div>
												<span className="recording-text">Recording...</span>
											</div>
										)}
									</div>
								)}
								<button
									onClick={handleSendMessage}
									disabled={!inputMessage.trim() || isLoading || isListening}
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






import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Bot, User, Loader2, Mic, MicOff } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chatAPI, leadAPI, handleApiError } from "../services/api";

const ChatInterface = () => {
	const { agentId } = useParams();
	const navigate = useNavigate();
	const [agent, setAgent] = useState({});
	const [chat, setChat] = useState({});
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [chatId, setChatId] = useState(null);
	const [leadCaptured, setLeadCaptured] = useState(true);
	const [isLoadingAgent, setIsLoadingAgent] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	// Voice interaction states
	const [isListening, setIsListening] = useState(false);
	const [isProcessingVoice, setIsProcessingVoice] = useState(false);
	const [speechRecognition, setSpeechRecognition] = useState(null);
	const [isVoiceSupported, setIsVoiceSupported] = useState(false);
	const [isVoiceMode, setIsVoiceMode] = useState(false);
	const [transcript, setTranscript] = useState("");
	const silenceTimerRef = useRef(null);
	const transcriptRef = useRef("");
	const isVoiceModeRef = useRef(isVoiceMode);

	useEffect(() => {
		transcriptRef.current = transcript;
		isVoiceModeRef.current = isVoiceMode;
	}, [transcript, isVoiceMode]);

	const messagesEndRef = useRef(null);
	const inputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const messageCache = useRef(new Map());
	const debounceTimeoutRef = useRef(null);

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

			const playAudioResponse = async (base64AudioData) => {
				try {
					if (!base64AudioData) {
						throw new Error("No audio data provided");
					}

					console.log("🎵 Playing audio response");

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
						setIsProcessingVoice(false);
					};
					audio.onerror = (e) => {
						console.error("❌ Audio playback error:", e);
						URL.revokeObjectURL(audioUrl);
						setIsProcessingVoice(false);
						toast.error(
							"Failed to play audio response. Please check your audio settings."
						);
					};

					audio.volume = 0.8;
					await audio.play();
				} catch (error) {
					console.error("❌ Error playing audio:", error);
					setIsProcessingVoice(false);

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
				}
			};

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
				const response = await chatAPI.sendMessage({
					message: messageText,
					chat_id: chat.chat_id,
					agent_id: agentId,
					sender: "user",
					requestAudio: voiceMode,
				});
				if (response.data?.data?.response) {
					const assistantMessage = {
						id: Date.now() + 1,
						message: response.data.data.response,
						sender: "assistant",
						timestamp: new Date().toISOString(),
					};
					setMessages((prev) => [...prev, assistantMessage]);

					// Play audio response if available
					if (voiceMode && response.data?.data?.audio) {
						await playAudioResponse(response.data.data.audio);
					} else if (voiceMode) {
						setIsProcessingVoice(false);
						toast.error(
							"Audio response not available, but text response is shown."
						);
					}
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
				setIsProcessingVoice(false);
				setInputMessage("");
				setTranscript("");
			}
		},
		[agentId, chat.chat_id, chatId, isLoading]
	);

	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage(inputMessage, false);
		}
	};

	// Voice interaction handlers
	const handleVoiceToggle = () => {
		if (!isVoiceSupported || !speechRecognition) {
			toast.error(
				"Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari."
			);
			return;
		}
    debugger;
		if (isListening && isVoiceMode) {
			console.log("Stopping voice recognition");
			try {
				speechRecognition.stop();
				setIsVoiceMode(false);
				setTranscript("");
				if (silenceTimerRef.current) {
					clearTimeout(silenceTimerRef.current);
				}
			} catch (error) {
				console.error("Error stopping recognition:", error);
			}
		} else {
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

					// Clear any existing state
					setTranscript("");
					if (silenceTimerRef.current) {
						clearTimeout(silenceTimerRef.current);
					}

					// Set voice mode and start recognition
					setIsVoiceMode(true);
					console.log("Starting voice recognition");
					try {
						await speechRecognition.start();
						console.log("Voice recognition started successfully");
					} catch (error) {
						console.error("Error starting recognition:", error);
						setIsVoiceMode(false);
						if (error.name === "NotAllowedError") {
							toast.error(
								"Microphone access denied. Please allow microphone access and try again."
							);
						} else {
							toast.error(
								"Failed to start voice recognition. Please try again."
							);
						}
					}
				} catch (error) {
					console.error("Voice recognition setup error:", error);
					setIsVoiceMode(false);
					toast.error("Failed to setup voice recognition. Please try again.");
				}
			};

			// Start the recognition process
			startRecognition();
		}
	};

	const playAudioResponse = async (base64AudioData) => {
		try {
			if (!base64AudioData) {
				throw new Error("No audio data provided");
			}

			console.log("🎵 Playing audio response");

			// Convert base64 to blob
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

			audio.onloadstart = () => {
				console.log("🎵 Audio loading started");
			};

			audio.oncanplay = () => {
				console.log("🎵 Audio ready to play");
			};

			audio.onended = () => {
				console.log("✅ Audio playback completed");
				URL.revokeObjectURL(audioUrl);
				setIsProcessingVoice(false);
				// isVoiceMode will be reset by API response handler
			};

			audio.onerror = (e) => {
				console.error("❌ Audio playback error:", e);
				URL.revokeObjectURL(audioUrl);
				setIsProcessingVoice(false);
				// isVoiceMode will be reset by API response handler
				toast.error(
					"Failed to play audio response. Please check your audio settings."
				);
			};

			// Set volume and play
			audio.volume = 0.8;
			await audio.play();
		} catch (error) {
			console.error("❌ Error playing audio:", error);
			setIsProcessingVoice(false);
			// isVoiceMode will be reset by API response handler

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
			}, 2000);
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

	// Store session data when chat/agent data changes
	useEffect(() => {
		if (agentId && chat.chat_id && agent.name) {
			sessionStorage.setItem(`chat_id_${agentId}`, chat.chat_id);
			sessionStorage.setItem(`agent_${agentId}`, JSON.stringify(agent));
			sessionStorage.setItem(`chat_${agentId}`, JSON.stringify(chat));
		}
	}, [agentId, chat, agent]);

	// Initialize speech recognition with silence detection
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

		// Store the last processed result index to avoid duplicates
		let lastProcessedIndex = 0;

		// Set up all event handlers
		recognition.onstart = () => {
			console.log("Speech recognition started");
			setIsListening(true);
		};

    recognition.onerror = (event) => {
      debugger;
			console.error("Speech recognition error:", event.error);
			setIsListening(false);
			setIsProcessingVoice(false);
			setIsVoiceMode(false);
			if (event.error === "not-allowed") {
				toast.error(
					"Microphone access denied. Please allow microphone access and try again."
				);
			} else {
				toast.error("Speech recognition error: " + event.error);
			}
		};

		recognition.onend = () => {
			console.log("Speech recognition ended");
			// Use the ref value instead of the state directly
			if (isVoiceModeRef.current) {
				console.log("Attempting to restart recognition");
				setTimeout(() => {
					try {
						recognition.start();
						console.log("Successfully restarted recognition");
					} catch (error) {
						console.error("Failed to restart recognition:", error);
						setIsListening(false);
						setIsVoiceMode(false);
						toast.error(
							"Failed to restart voice recognition. Please try again."
						);
					}
				}, 100); // Small delay to ensure clean restart
			} else {
				setIsListening(false);
			}
		};

		recognition.onresult = (event) => {
			console.log("Speech recognition result received");
			let finalTranscript = "";

			// Process only new results
			for (let i = lastProcessedIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const transcript = result[0].transcript;

				if (result.isFinal) {
					finalTranscript += transcript;
					lastProcessedIndex = i + 1; // Update the last processed index
				}
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
						setIsProcessingVoice(true);
						handleSendMessage(finalTranscript, true);
						setTranscript("");
					}
				}, 3000);
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
	}, [handleSendMessage, isVoiceModeRef]);

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
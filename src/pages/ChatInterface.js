import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, 
  Paperclip, 
  MoreVertical, 
  ArrowLeft,
  Bot,
  User,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatAPI, agentAPI, leadAPI, handleApiError } from '../services/api';
import TypingIndicator from '../components/TypingIndicator';
import FileUpload from '../components/FileUpload';
import LeadCaptureModal from '../components/LeadCaptureModal';

const POLLING_INTERVAL = 3000; // 3 seconds

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState({});
  const [chat, setChat] = useState({});
  const [lead, setLead] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
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
      currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    sessionStorage.setItem(firstLoadKey, 'completed');
  }, [agentId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    const userMessage = {
			id: Date.now(),
			message: messageText,
			sender: "user",
			timestamp: new Date().toISOString(),
		};

    setMessages((prev) => [
			...prev,
			userMessage,
		]);

    try {
      const response = await chatAPI.sendMessage({
				message: messageText,
				chat_id: chat.chat_id,
				agent_id: agentId,
				sender: "user",
			});

      if (response.data?.data?.response) {
        const assistantMessage = {
          id: Date.now() + 1,
          message: response.data.data.response,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setLastMessageId(assistantMessage.id);
      }
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to send message: ${errorInfo.message}`);
      
      // Remove the failed user message and add an error message
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== userMessage.id);
        return [...filtered, {
          id: Date.now() + 2,
          message: `❌ Failed to send message: ${errorInfo.message}. Please try again.`,
          sender: 'system',
          timestamp: new Date().toISOString(),
          chat_id: chatId,
          isError: true
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
  const loadChatHistory = useCallback(async (chatId, limit = 50, offset = 0) => {
    if (!chatId) return { messages: [], hasMore: false };
    
    // Check cache first
    const cacheKey = `${chatId}_${limit}_${offset}`;
    if (messageCache.current.has(cacheKey)) {
      return messageCache.current.get(cacheKey);
    }
    
    try {
      setIsLoadingHistory(true);
      const response = await chatAPI.getChatHistoryForPersistence(chatId, limit, offset);
      
      if (response.data.success) {
        const result = {
          messages: response.data.data.messages || [],
          hasMore: response.data.data.pagination?.hasMore || false,
          total: response.data.data.pagination?.total || 0
        };
        
        // Cache the result
        messageCache.current.set(cacheKey, result);
        
        return result;
      } else {
        throw new Error(response.data.message || 'Failed to load chat history');
      }
    } catch (error) {
      const errorInfo = handleApiError(error);
      console.error('Failed to load chat history:', errorInfo.message);
      toast.error(`Failed to load chat history: ${errorInfo.message}`);
      return { messages: [], hasMore: false };
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

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
          const historyResult = await loadChatHistory(response.data.chat.chat_id);
          if (historyResult.messages.length > 0) {
            // Transform backend messages to frontend format
            const transformedMessages = historyResult.messages.map(msg => ({
              id: msg.chat_log_id || Date.now() + Math.random(),
              message: msg.message,
              sender: msg.role === 'user' ? 'user' : 'assistant',
              timestamp: msg.created_at,
              chat_id: msg.chat_id
            }));
            setMessages(transformedMessages);
          }
        }
        
        toast.success('Welcome! You can now start chatting.');
      } else {
        throw new Error(response.data.message || 'Failed to submit lead information');
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
        console.log('First load detected - calling leadAPI.create');
        handleLeadSubmit().then(() => {
          markFirstLoadCompleted();
        }).catch((error) => {
          console.error('Failed to handle first load:', error);
          // Don't mark as completed if it failed
        });
      } else {
        console.log('Subsequent load detected - skipping leadAPI.create');
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
                const transformedMessages = historyResult.messages.map(msg => ({
                  id: msg.chat_log_id || Date.now() + Math.random(),
                  message: msg.message,
                  sender: msg.role === 'user' ? 'user' : 'assistant',
                  timestamp: msg.created_at,
                  chat_id: msg.chat_id
                }));
                setMessages(transformedMessages);
              }
            });
          } catch (error) {
            console.error('Failed to restore session data:', error);
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
  }, [agentId, getSessionId, isFirstLoad, markFirstLoadCompleted, loadChatHistory]);

  // Store session data when chat/agent data changes
  useEffect(() => {
    if (agentId && chat.chat_id && agent.name) {
      sessionStorage.setItem(`chat_id_${agentId}`, chat.chat_id);
      sessionStorage.setItem(`agent_${agentId}`, JSON.stringify(agent));
      sessionStorage.setItem(`chat_${agentId}`, JSON.stringify(chat));
    }
  }, [agentId, chat, agent]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatMessageTime = (timestamp) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const renderMessage = (message) => {
    const isUser = message.sender === 'user';
    const isSystem = message.sender === 'system';
    const isError = message.isError;
    
    return (
      <div
        key={message.id}
        className={`message ${isUser ? 'user' : isSystem ? 'system' : 'assistant'} ${isUser ? 'message-user' : isSystem ? 'message-system' : 'message-assistant'}`}
      >
        <div className="message-avatar">
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
        <div className={`message-content ${isError ? 'error-message-content' : ''}`}>
          {isUser || isSystem ? (
            <p>{message.message}</p>
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ node, inline, className, children, ...props }) => {
                  return inline ? (
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  ) : (
                    <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      <code {...props}>{children}</code>
                    </pre>
                  );
                }
              }}
            >
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
			) : leadCaptured && (
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
								<p>{isLoadingHistory ? 'Loading chat history...' : 'Loading chat...'}</p>
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
								disabled={isLoading}
							/>
							<button
								onClick={handleSendMessage}
								disabled={!inputMessage.trim() || isLoading}
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
			)}
		</div>
	);
};

export default ChatInterface;
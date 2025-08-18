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
import { chatAPI, agentAPI, handleApiError } from '../services/api';
import TypingIndicator from '../components/TypingIndicator';
import FileUpload from '../components/FileUpload';

const POLLING_INTERVAL = 3000; // 3 seconds

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const loadAgent = useCallback(async () => {
    try {
      const response = await agentAPI.getById(agentId);
      setAgent(response.data);
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to load agent: ${errorInfo.message}`);
      navigate('/admin');
    }
  }, [agentId, navigate]);

  const initializeChat = useCallback(async () => {
    try {
      const response = await chatAPI.getHistory(agentId, 50);
      if (response.data.length > 0) {
        setMessages(response.data);
        const recentMessage = response.data[response.data.length - 1];
        if (recentMessage) {
          setChatId(recentMessage.chat_id);
          setLastMessageId(recentMessage.id);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [agentId]);

  const startPolling = useCallback(() => {
    let failedAttempts = 0;
    const MAX_RETRY_ATTEMPTS = 3;
    const RETRY_DELAY = 1000; // 1 second

    const poll = async () => {
      try {
        // Poll for new messages
        if (lastMessageId) {
          const messagesResponse = await chatAPI.getNewMessages(chatId, lastMessageId);
          if (messagesResponse.data.length > 0) {
            setMessages(prev => [...prev, ...messagesResponse.data]);
            setLastMessageId(messagesResponse.data[messagesResponse.data.length - 1].id);
          }
          failedAttempts = 0; // Reset failed attempts on success
          setIsConnected(true); // Update connection status on successful poll
        }

        // Poll for typing status
        const typingResponse = await chatAPI.getTypingStatus(chatId);
        setIsTyping(typingResponse.data.isTyping);
      } catch (error) {
        console.error('Polling error:', error);
        failedAttempts++;
        setIsConnected(false); // Update connection status on error

        if (failedAttempts >= MAX_RETRY_ATTEMPTS) {
          // Stop polling after max retries
          clearInterval(pollingIntervalRef.current);
          toast.error('Connection lost. Attempting to reconnect...');
          
          // Attempt to reconnect after delay
          setTimeout(() => {
            failedAttempts = 0;
            pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL);
            toast.success('Reconnected successfully!');
            setIsConnected(true); // Update connection status on reconnect
          }, RETRY_DELAY);
        }
      }
    };

    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL);
    setIsConnected(true); // Set initial connection status

    // Initial poll
    poll();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        setIsConnected(false);
      }
    };
  }, [chatId, lastMessageId]);

  useEffect(() => {
    if (agentId) {
      loadAgent();
      initializeChat();
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [agentId, loadAgent, initializeChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (chatId) {
      startPolling();
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [chatId, startPolling]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    const userMessage = {
      id: Date.now(),
      message: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
      chat_id: chatId
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await chatAPI.sendMessage(agentId, messageText, chatId);
      
      if (response.data.chatId && !chatId) {
        setChatId(response.data.chatId);
      }

      if (response.data.response) {
        const assistantMessage = {
          id: Date.now() + 1,
          message: response.data.response,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          chat_id: response.data.chatId
        };
        setMessages(prev => [...prev, assistantMessage]);
        setLastMessageId(assistantMessage.id);
      }
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to send message: ${errorInfo.message}`);
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
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
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing status
      chatAPI.updateTypingStatus(chatId, true);

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        chatAPI.updateTypingStatus(chatId, false);
      }, 2000);
    }
  };

  const handleFileUpload = async (files) => {
    try {
      await agentAPI.uploadFiles(agentId, files);
      toast.success('Files uploaded successfully');
      setShowFileUpload(false);
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to upload files: ${errorInfo.message}`);
    }
  };

  const formatMessageTime = (timestamp) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const renderMessage = (message) => {
    const isUser = message.sender === 'user';
    
    return (
      <div
        key={message.id}
        className={`message ${isUser ? 'user' : 'assistant'} ${isUser ? 'message-user' : 'message-assistant'}`}
      >
        <div className="message-avatar">
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
        <div className="message-content">
          {isUser ? (
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
      {/* Header */}
      <div className="chat-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold">{agent.name}</h1>
              <p className="text-sm opacity-90">
                {isConnected ? 'Online' : 'Connecting...'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFileUpload(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Upload files"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start a conversation with {agent.name}
            </h3>
            <p className="text-gray-500">
              {agent.description || 'Ask me anything!'}
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
            className="send-button"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 loading-spinner" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload
          onClose={() => setShowFileUpload(false)}
          onUpload={handleFileUpload}
          agentId={agentId}
        />
      )}
    </div>
  );
};

export default ChatInterface;
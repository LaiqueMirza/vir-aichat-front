import React, { useState, useEffect, useRef } from 'react';
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
import socketService from '../services/socket';
import TypingIndicator from '../components/TypingIndicator';
import FileUpload from '../components/FileUpload';

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (agentId) {
      loadAgent();
      initializeChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Setup socket connection
    if (agentId) {
      socketService.connect(agentId);
      
      // Socket event listeners
      socketService.on('connectionStatus', handleConnectionStatus);
      socketService.on('message', handleNewMessage);
      socketService.on('typing', handleTypingStart);
      socketService.on('stopTyping', handleTypingStop);
      socketService.on('error', handleSocketError);

      return () => {
        socketService.off('connectionStatus', handleConnectionStatus);
        socketService.off('message', handleNewMessage);
        socketService.off('typing', handleTypingStart);
        socketService.off('stopTyping', handleTypingStop);
        socketService.off('error', handleSocketError);
        
        if (chatId) {
          socketService.leaveChat(chatId);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, chatId]);

  const loadAgent = async () => {
    try {
      const response = await agentAPI.getById(agentId);
      setAgent(response.data);
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to load agent: ${errorInfo.message}`);
      navigate('/admin');
    }
  };

  const initializeChat = async () => {
    try {
      // Load recent chat history
      const response = await chatAPI.getHistory(agentId, 50);
      if (response.data.length > 0) {
        setMessages(response.data);
        // Use the most recent chat ID
        const recentChatId = response.data[response.data.length - 1]?.chat_id;
        if (recentChatId) {
          setChatId(recentChatId);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleConnectionStatus = ({ connected }) => {
    setIsConnected(connected);
    if (connected && chatId) {
      socketService.joinChat(chatId);
    }
  };

  const handleNewMessage = (messageData) => {
    setMessages(prev => [...prev, messageData]);
    setIsTyping(false);
    setIsLoading(false);
  };

  const handleTypingStart = () => {
    setIsTyping(true);
  };

  const handleTypingStop = () => {
    setIsTyping(false);
  };

  const handleSocketError = (error) => {
    console.error('Socket error:', error);
    toast.error('Connection error occurred');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      message: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
      chat_id: chatId
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Send via socket if connected, otherwise use API
      if (isConnected && chatId) {
        socketService.sendMessage(chatId, messageText, agentId);
      } else {
        // Fallback to API
        const response = await chatAPI.sendMessage(agentId, messageText, chatId);
        
        if (response.data.chatId && !chatId) {
          setChatId(response.data.chatId);
          socketService.joinChat(response.data.chatId);
        }

        // Add assistant response
        if (response.data.response) {
          const assistantMessage = {
            id: Date.now() + 1,
            message: response.data.response,
            sender: 'assistant',
            timestamp: new Date().toISOString(),
            chat_id: response.data.chatId
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        setIsLoading(false);
      }
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to send message: ${errorInfo.message}`);
      setIsLoading(false);
      
      // Remove the user message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
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
    
    // Send typing indicator
    if (isConnected && chatId) {
      socketService.startTyping(chatId);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(chatId);
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
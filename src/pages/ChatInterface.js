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
import { chatAPI, agentAPI, leadAPI, handleApiError } from '../services/api';
import FileUpload from '../components/FileUpload';
import LeadCaptureForm from '../components/LeadCaptureForm';

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(true);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (agentId) {
      loadAgent();
      initializeChat();
      
      // Check if this user has already submitted lead info for this agent
      // For now, we'll just show the form every time, but you could add logic to check localStorage or cookies
      setShowLeadForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAgent = async () => {
    try {
      const response = await agentAPI.getById(agentId);
      if (response.data && response.data.data) {
        setAgent(response.data.data);
      } else {
        // Handle case where response doesn't have expected structure
        toast.error('Failed to load agent: Invalid response format');
        navigate('/admin');
      }
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to load agent: ${errorInfo.message}`);
      navigate('/admin');
    }
  };

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      // Load recent chat history
      const response = await chatAPI.getHistory(agentId, 50);
      if (response.data && response.data.data) {
        setMessages(response.data.data);
      } else {
        // Empty chat history is normal for new agents
        console.log('No chat history found or empty history');
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Don't show error toast for new agents without history
      if (error.response && error.response.status !== 404) {
        toast.error('Failed to load chat history');
      }
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !leadSubmitted) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    
    // Get lead_id from sessionStorage
    const leadId = sessionStorage.getItem('lead_id');

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      message: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      lead_id: leadId // Include lead_id if available
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Send message via HTTP API with lead_id if available
      const payload = { message: messageText };
      if (leadId) {
        payload.lead_id = leadId;
      }
      
      const response = await chatAPI.sendMessage(agentId, payload);
      
      // Add assistant response
      if (response.data && response.data.data && response.data.data.response) {
        const assistantMessage = {
          id: Date.now() + 1,
          message: response.data.data.response,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          agent_id: agentId,
          lead_id: leadId // Include lead_id if available
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
      setIsLoading(false);
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to send message: ${errorInfo.message}`);
      setIsLoading(false);
      
      // Remove the user message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && leadSubmitted) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleLeadFormSubmit = () => {
    setLeadSubmitted(true);
    setShowLeadForm(false);
  };
  
  const handleLeadFormClose = () => {
    // If you want to allow users to skip the form, uncomment this line
    // setShowLeadForm(false);
    // For now, we'll keep the form visible until they submit
    toast.error('Please provide your information to continue');
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
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
    try {
      if (!timestamp) return 'N/A';
      return format(new Date(timestamp), 'HH:mm');
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'N/A';
    }
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
  console.log("agent", agent);
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
            <div className="flex-1">
              <h1 className="font-semibold">{agent.name}</h1>
              <p className="text-sm opacity-90">
                {agent.name || 'AI Assistant'}
              </p>
              <div className="text-xs opacity-75 mt-1">
                ID: {agent.id} | Status: {agent.status} | Documents: {agent.document_count}
              </div>
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
            placeholder={leadSubmitted ? `Message ${agent.name}...` : 'Please provide your information to continue...'}
            className="chat-input"
            rows={1}
            disabled={isLoading || !leadSubmitted}
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
      
      {/* Lead Capture Form */}
      {showLeadForm && agent && (
        <LeadCaptureForm
          agentId={agentId}
          onSubmitSuccess={handleLeadFormSubmit}
          onClose={handleLeadFormClose}
        />
      )}
    </div>
  );
};

export default ChatInterface;
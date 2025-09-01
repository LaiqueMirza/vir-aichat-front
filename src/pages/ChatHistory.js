import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import './ChatHistory.css';

const ChatHistory = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chatData, setChatData] = useState(null);
  const [chatLogs, setChatLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChatHistory();
  }, [chatId]);

  const fetchChatHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/chat/logs/${chatId}`);
      
      if (response.data.success) {
        // Handle the new API structure
        const data = response.data.data;
        setChatData(data);
        setChatLogs(data.chat_logs || []);
      } else {
        setError('Failed to fetch chat history');
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
      setError('Failed to fetch chat history');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    const duration = new Date(endTime) - new Date(startTime);
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    // Ensure we never show "0 0s" - minimum duration should be 1 second
    if (minutes === 0 && seconds === 0) {
      return '< 1s';
    }
    
    return `${minutes}m ${seconds}s`;
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'status-badge status-active';
      case 'completed':
        return 'status-badge status-completed';
      case 'pending':
        return 'status-badge status-pending';
      default:
        return 'status-badge status-unknown';
    }
  };

  if (loading) {
    return (
      <div className="chat-history-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading chat history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-history-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="back-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-history-container">
      <div className="chat-history-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Chat History</h1>
      </div>

      {chatData && (
        <>
          {/* Detailed Information Section with Integrated Overview */}
          <div className="chat-details-section">
            <div className="section-header">
              <h2>Chat Session Details</h2>
              <div className="chat-id-badge">
                ID: {chatData.chat_id || 'Unknown'}
              </div>
            </div>
            
            <div className="details-grid">
              <div className="detail-group">
                <h4>👤 Client Information</h4>
                <div className="detail-items">
                  <div className="detail-item">
                    <label>Name:</label>
                    <span>{chatData.client_name || 'Anonymous User'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{chatData.client_email || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Mobile:</label>
                    <span>{chatData.client_mobile || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Lead ID:</label>
                    <span>{chatData.lead_id || 'Not linked'}</span>
                  </div>
                </div>
              </div>
              
              <div className="detail-group">
                <h4>🤖 Agent Information</h4>
                <div className="detail-items">
                  <div className="detail-item">
                    <label>Agent Name:</label>
                    <span>{chatData.agent_name || 'Unknown Agent'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Agent ID:</label>
                    <span>{chatData.agent_id || 'Not available'}</span>
                  </div>
                </div>
              </div>
              
              <div className="detail-group enhanced-session-details">
                <h4>📊 Session Details & Statistics</h4>
                <div className="detail-items">
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={getStatusBadgeClass(chatData.status)}>
                      {chatData.status || 'Unknown'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Total Messages:</label>
                    <span className="stat-highlight">
                      {chatData.summary?.total_messages || 0}
                      <small> (User: {chatData.summary?.user_messages || 0}, AI: {chatData.summary?.assistant_messages || 0})</small>
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Total Tokens:</label>
                    <span className="stat-highlight">{(chatData.total_tokens || 0).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <label>Total Cost:</label>
                    <span className="stat-highlight">${(chatData.total_cost || 0).toFixed(4)}</span>
                  </div>
                  <div className="detail-item">
                    <label>User ID:</label>
                    <span>{chatData.user_id || 'Not available'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Started:</label>
                    <span>{formatTimestamp(chatData.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="chat-logs-section">
        <h2>Conversation History</h2>
        {chatLogs.length === 0 ? (
          <div className="no-messages">
            <p>No messages found for this chat.</p>
          </div>
        ) : (
          <div className="chat-messages">
            {chatLogs.map((log, index) => {
              const isUser = log.role === 'user';
              return (
                <div key={index} className={`message ${isUser ? 'user' : 'assistant'} ${isUser ? 'message-user' : 'message-assistant'}`}>
                  <div className="message-avatar">
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="message-content">
                    {isUser ? (
                      <p>{log.message || 'Empty message'}</p>
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
                        {log.message || 'Empty response'}
                      </ReactMarkdown>
                    )}
                    <div className="message-time">
                      {formatTimestamp(log.created_at || log.updated_at)}
                    </div>
                    {(log.total_tokens > 0 || log.total_cost > 0) && (
                      <div className="message-meta">
                        {log.total_tokens > 0 && (
                          <span className="token-info">Tokens: {log.total_tokens.toLocaleString()}</span>
                        )}
                        {log.total_cost > 0 && (
                          <span className="cost-info">Cost: ${parseFloat(log.total_cost).toFixed(4)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
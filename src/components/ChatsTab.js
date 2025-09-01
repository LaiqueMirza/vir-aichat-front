import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../services/api';
import './ChatsTab.css';

const ChatsTab = () => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalChats, setTotalChats] = useState(0);
  const chatsPerPage = 20;

  useEffect(() => {
    loadChats();
  }, [currentPage]);

  const loadChats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await chatAPI.getRecentChats({
        limit: chatsPerPage,
        offset: (currentPage - 1) * chatsPerPage
      });
      
      if (response.data && response.data.success) {
        setChats(response.data.data || []);
        setTotalChats(response.data.data ? response.data.data.length : 0);
      } else {
        throw new Error('Failed to fetch chats');
      }
    } catch (err) {
      console.error('Error loading chats:', err);
      setError(err.message || 'Failed to load chats');
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    
    if (durationMs <= 0) return 'N/A';
    
    const minutes = Math.floor(durationMs / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'completed':
        return 'status-completed';
      case 'abandoned':
        return 'status-abandoned';
      default:
        return 'status-default';
    }
  };

  const totalPages = Math.ceil(totalChats / chatsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (loading) {
    return (
      <div className="chats-tab">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading Chats...</h3>
          <p>Please wait while we fetch the chat data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chats-tab">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Chats</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={loadChats}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="chats-tab">
        <div className="chats-header">
          <div className="chats-title">
            <h2>Chat Conversations</h2>
            <p className="chats-subtitle">No chat conversations found</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>No Chats Available</h3>
          <p>There are no chat conversations to display at the moment.</p>
        </div>
      </div>
    );
  }

  return (
		<div className="chats-tab">
			<div className="chats-header">
				<div className="chats-title">
					<h2>Chat Conversations</h2>
					<p className="chats-subtitle">
						Showing {chats.length} of {totalChats} total conversations
					</p>
				</div>
				<div className="chats-stats">
					<div className="stat-item">
						<span className="stat-label">Total Chats:</span>
						<span className="stat-value">{totalChats}</span>
					</div>
					<div className="stat-item">
						<span className="stat-label">Page:</span>
						<span className="stat-value">
							{currentPage} of {totalPages}
						</span>
					</div>
				</div>
			</div>

			<div className="chats-table-container">
				<table className="chats-table">
					<thead>
						<tr>
							<th>Client Info</th>
							<th>Agent</th>
							<th>Lead</th>
							<th>Messages</th>
							<th>Tokens</th>
							<th>Cost</th>
							<th>Status</th>
							<th>Started</th>
						</tr>
					</thead>
					<tbody>
						{chats.map((chat) => (
							<tr key={chat.chat_id} className="chat-row">
								<td className="client-info">
									<div className="client-details">
										<div className="client-name">
											{chat.client_name || "Anonymous"}
										</div>
										<div className="client-contact">
											{chat.client_email && (
												<div className="contact-item">
													📧 {chat.client_email}
												</div>
											)}
											{chat.client_phone && (
												<div className="contact-item">
													📞 {chat.client_phone}
												</div>
											)}
										</div>
									</div>
								</td>

								<td className="agent-info">
									<div className="agent-name">
										{chat.agent_name || "Unassigned"}
									</div>
								</td>

								<td className="lead-info">
									{chat.lead_id ? (
										<div className="lead-badge">🎯 Lead #{chat.lead_id}</div>
									) : (
										<span className="no-lead">No Lead</span>
									)}
								</td>

								<td className="message-count">
									<button
										className="view-chats-button"
										onClick={() =>
                        window.open(`/admin/chat-history/${chat.chat_id}`, '_blank')
										}
										title="View complete chat history">
										View Chats
									</button>
								</td>

								<td className="token-count">
									{chat.total_tokens
										? chat.total_tokens.toLocaleString()
										: "0"}
								</td>

								<td className="cost">
									${chat.total_cost
										? parseFloat(chat.total_cost).toFixed(4)
										: "0.0000"}
								</td>

								<td className="status">
									<span
										className={`status-badge ${getStatusBadgeClass(
											chat.status
										)}`}>
										{chat.status || "Unknown"}
									</span>
								</td>

								<td className="created-date">{formatDate(chat.created_at)}</td>

							</tr>
						))}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="pagination">
					<button
						className="pagination-button"
						onClick={handlePrevPage}
						disabled={currentPage === 1}>
						← Previous
					</button>

					<div className="pagination-info">
						Page {currentPage} of {totalPages}
					</div>

					<button
						className="pagination-button"
						onClick={handleNextPage}
						disabled={currentPage === totalPages}>
						Next →
					</button>
				</div>
			)}
		</div>
	);
};

export default ChatsTab;
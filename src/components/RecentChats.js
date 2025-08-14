import React from 'react';
import { MessageCircle, Clock, User, Bot } from 'lucide-react';

const RecentChats = ({ chats = [], onChatClick }) => {
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const chatTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - chatTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return chatTime.toLocaleDateString();
  };

  const truncateMessage = (message, maxLength = 60) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (!chats || chats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Recent Chats</h3>
        </div>
        <div className="text-center py-8">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No recent chats</p>
          <p className="text-sm text-gray-400 mt-1">Chat conversations will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Recent Chats</h3>
        </div>
        <span className="text-sm text-gray-500">{chats.length} conversations</span>
      </div>

      <div className="space-y-3">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onChatClick && onChatClick(chat)}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {chat.leadName || chat.leadEmail || 'Anonymous'}
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(chat.status)}`}>
                  {chat.status || 'active'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(chat.lastMessageAt || chat.createdAt)}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">{chat.agentName}</span>
            </div>

            {chat.lastMessage && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">
                  {chat.lastMessage.sender === 'user' ? 'User: ' : 'Agent: '}
                </span>
                {truncateMessage(chat.lastMessage.content)}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span>{chat.messageCount || 0} messages</span>
              {chat.leadGenerated && (
                <span className="text-green-600 font-medium">Lead Generated</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {chats.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All Chats
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentChats;
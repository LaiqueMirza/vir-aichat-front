import React, { useState } from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  Settings, 
  Trash2, 
  ExternalLink,
  Bot,
  FileText,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatNumber } from '../services/api';

const AgentCard = ({ agent, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleChatClick = () => {
    window.open(`/chat/${agent.id}`, '_blank');
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete(agent.id);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'training':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="stat-card group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{agent.name}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
              {agent.status || 'active'}
            </span>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                onClick={handleChatClick}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Chat
              </button>
              <button
                onClick={handleDeleteClick}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatNumber(agent.total_chats || 0)}
          </div>
          <div className="text-xs text-gray-500">Conversations</div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatNumber(agent.total_leads || 0)}
          </div>
          <div className="text-xs text-gray-500">Leads</div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium text-gray-900">
            {formatNumber(agent.document_count || 0)}
          </div>
          <div className="text-xs text-gray-500">Documents</div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium text-gray-900">
            {formatCurrency(agent.total_cost || 0)}
          </div>
          <div className="text-xs text-gray-500">Total Cost</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Created {agent.created_at ? format(new Date(agent.created_at), 'MMM d, yyyy') : 'Unknown'}
        </div>
        
        <button
          onClick={handleChatClick}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </button>
      </div>

      {/* Click overlay for menu close */}
      {showMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default AgentCard;
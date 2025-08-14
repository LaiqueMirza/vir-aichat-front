import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MessageSquare, 
  Star,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Tag,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

const LeadCard = ({ lead, onDelete, onEdit, onViewChat }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleEditClick = () => {
    if (onEdit) {
      onEdit(lead);
    }
    setShowMenu(false);
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      onDelete(lead.id);
    }
    setShowMenu(false);
  };

  const handleViewChatClick = () => {
    if (onViewChat) {
      onViewChat(lead);
    }
    setShowMenu(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-green-100 text-green-800';
      case 'converted':
        return 'bg-purple-100 text-purple-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {lead.name || 'Anonymous Lead'}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                  {lead.status || 'New'}
                </span>
                {lead.priority && (
                  <div className="flex items-center space-x-1">
                    <Star className={`w-3 h-3 ${getPriorityColor(lead.priority)}`} />
                    <span className={`text-xs font-medium ${getPriorityColor(lead.priority)}`}>
                      {lead.priority}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {lead.score && (
              <div className="text-right">
                <div className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
                  {lead.score}
                </div>
                <div className="text-xs text-gray-500">Score</div>
              </div>
            )}
            
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                  <div className="py-1">
                    <button
                      onClick={handleEditClick}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit Lead</span>
                    </button>
                    <button
                      onClick={handleViewChatClick}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Chat</span>
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Lead</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="px-6 pb-4">
        <div className="space-y-2">
          {lead.email && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Mail className="w-4 h-4" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{lead.phone}</span>
            </div>
          )}
          {lead.company && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Tag className="w-4 h-4" />
              <span className="truncate">{lead.company}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lead Details */}
      {lead.notes && (
        <div className="px-6 pb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-700 line-clamp-2">
              {lead.notes}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span className="text-lg font-semibold text-gray-900">
                {lead.messageCount || 0}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Messages</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-lg font-semibold text-gray-900">
                {lead.responseTime ? `${lead.responseTime}m` : 'N/A'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Avg Response</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-1">
            {lead.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {lead.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{lead.tags.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3" />
            <span>
              Created {lead.createdAt ? format(new Date(lead.createdAt), 'MMM d, yyyy') : 'Unknown'}
            </span>
          </div>
          {lead.lastActivity && (
            <div>
              Last activity {format(new Date(lead.lastActivity), 'MMM d')}
            </div>
          )}
        </div>
        
        <div className="flex space-x-3 mt-3">
          <button
            onClick={handleViewChatClick}
            className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            View Chat
          </button>
          <button
            onClick={handleEditClick}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default LeadCard;
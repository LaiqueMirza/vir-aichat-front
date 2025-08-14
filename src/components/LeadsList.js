import React, { useState } from 'react';
import { Users, Search, Filter, Mail, Phone, Calendar, ExternalLink, Download } from 'lucide-react';

const LeadsList = ({ leads = [], onLeadClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');

  const statusOptions = [
    { value: 'all', label: 'All Leads' },
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'converted', label: 'Converted' },
    { value: 'lost', label: 'Lost' }
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'name', label: 'Name' },
    { value: 'score', label: 'Lead Score' },
    { value: 'lastContact', label: 'Last Contact' }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-purple-100 text-purple-800';
      case 'converted':
        return 'bg-green-100 text-green-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredLeads = leads
    .filter(lead => {
      const matchesSearch = !searchTerm || 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'score':
          return (b.score || 0) - (a.score || 0);
        case 'lastContact':
          return new Date(b.lastContact || 0) - new Date(a.lastContact || 0);
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

  const exportLeads = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Status', 'Score', 'Source', 'Created At'],
      ...filteredLeads.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company || '',
        lead.status || '',
        lead.score || '',
        lead.source || '',
        lead.createdAt || ''
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!leads || leads.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Leads</h3>
        </div>
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No leads generated yet</p>
          <p className="text-sm text-gray-400 mt-1">Leads from chat conversations will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Leads</h3>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">
            {filteredLeads.length}
          </span>
        </div>
        
        <button
          onClick={exportLeads}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>
              Sort by {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {filteredLeads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onLeadClick && onLeadClick(lead)}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-medium text-gray-900">
                    {lead.name || 'Anonymous Lead'}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                    {lead.status || 'new'}
                  </span>
                  {lead.score && (
                    <span className={`text-sm font-medium ${getScoreColor(lead.score)}`}>
                      Score: {lead.score}/100
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {lead.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {lead.email}
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {lead.phone}
                    </div>
                  )}
                  {lead.company && (
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-4 h-4" />
                      {lead.company}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-right text-sm text-gray-500">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(lead.createdAt)}
                </div>
                {lead.source && (
                  <div className="text-xs">
                    via {lead.source}
                  </div>
                )}
              </div>
            </div>

            {lead.notes && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <strong>Notes:</strong> {lead.notes}
              </div>
            )}

            {lead.interests && lead.interests.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {lead.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredLeads.length === 0 && leads.length > 0 && (
        <div className="text-center py-8">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No leads match your filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

export default LeadsList;
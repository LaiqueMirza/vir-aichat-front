import React, { useState, useEffect } from 'react';
import { leadAPI, handleApiError } from '../services/api';
import './LeadsTab.css';

const LeadsTab = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 20;

  const loadLeads = async (status = '', page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (page - 1) * leadsPerPage;
      const response = await leadAPI.getAll(status || null, leadsPerPage, offset);
      
      if (response.data.success) {
        setLeads(response.data.data);
        setTotalLeads(response.data.pagination?.total || response.data.data.length);
      } else {
        throw new Error('Failed to fetch leads');
      }
    } catch (err) {
      console.error('Error loading leads:', err);
      setError(handleApiError(err));
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads(statusFilter, currentPage);
  }, [statusFilter, currentPage]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
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

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'new': return 'status-badge status-new';
      case 'contacted': return 'status-badge status-contacted';
      case 'qualified': return 'status-badge status-qualified';
      case 'converted': return 'status-badge status-converted';
      case 'lost': return 'status-badge status-lost';
      default: return 'status-badge status-default';
    }
  };

  const totalPages = Math.ceil(totalLeads / leadsPerPage);

  if (loading) {
    return (
      <div className="leads-tab">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading leads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leads-tab">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Leads</h3>
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={() => loadLeads(statusFilter, currentPage)}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="leads-tab">
      <div className="leads-header">
        <div className="leads-title">
          <h2>Leads Management</h2>
          <p className="leads-subtitle">
            Total: {totalLeads} leads
          </p>
        </div>
        
        <div className="leads-filters">
          <select 
            value={statusFilter} 
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="status-filter"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Converted">Converted</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Leads Found</h3>
          <p>
            {statusFilter 
              ? `No leads found with status "${statusFilter}".`
              : 'No leads have been created yet.'
            }
          </p>
        </div>
      ) : (
        <>
          <div className="leads-table-container">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Lead Info</th>
                  <th>Agent</th>
                  <th>Status</th>
                  
                  <th>Created</th>
                  <th>Follow Up</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="lead-row">
                    <td className="lead-info">
                      <div className="lead-details">
                        <div className="lead-name">
                          {lead.name || 'Anonymous Lead'}
                        </div>
                        <div className="lead-contact">
                          {lead.email && (
                            <span className="contact-item">
                              📧 {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="contact-item">
                              📞 {lead.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="agent-info">
                      <div className="agent-name">
                        {lead.agent_name || 'Unknown Agent'}
                      </div>
                    </td>
                    <td className="status-info">
                      <span className={getStatusBadgeClass(lead.status)}>
                        {lead.status || 'Unknown'}
                      </span>
                    </td>
                    
                    <td className="created-date">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="follow-up">
                      {lead.follow_up ? (
                        <div className="follow-up-date">
                          📅 {formatDate(lead.follow_up)}
                        </div>
                      ) : (
                        <span className="no-follow-up">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              
              <div className="pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              
              <button 
                className="pagination-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeadsTab;
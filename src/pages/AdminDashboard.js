import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  DollarSign, 
  Plus,
  Settings,
  BarChart3,
  Activity,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAPI, analyticsAPI, handleApiError, formatCurrency, formatNumber } from '../services/api';
import AgentCard from '../components/AgentCard';
import CreateAgentModal from '../components/CreateAgentModal';
import ConfirmationModal from '../components/ConfirmationModal';
import StatsCard from '../components/StatsCard';
import CostAnalytics from '../components/CostAnalytics';

const AdminDashboard = () => {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalChats: 0,
    totalLeads: 0,
    totalCost: 0,
    monthlyChats: 0,
    monthlyLeads: 0,
    monthlyCost: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agentsError, setAgentsError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    setAgentsError(null);
    setStatsError(null);
      
      // Call only essential APIs for dashboard overview
      let agentsResponse = null;
      let analyticsResponse = null;
      let hasErrors = false;

      try {
        agentsResponse = await agentAPI.getAll();
      } catch (error) {
        console.error('Failed to fetch agents:', error);
        setAgentsError('Failed to load agents. Please try refreshing the page.');
        hasErrors = true;
      }
      
      try {
        analyticsResponse = await analyticsAPI.postDashboardStats('30d');
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        setStatsError('Failed to load analytics data. Please try refreshing the page.');
        hasErrors = true;
      }
      
      // The API returns { success: true, data: [...] }
      // With axios, the response is wrapped in .data, so agentsResponse.data = { success: true, data: [...] }
      const agentsData = agentsResponse?.data?.data || [];
      const analyticsData = analyticsResponse?.data?.data || {};
      
      const finalAgents = Array.isArray(agentsData) ? agentsData : [];
      
      setAgents(finalAgents);
      
      // Handle the analytics data structure from backend
      setStats({
        totalAgents: agentsData.length || 0,
        totalChats: analyticsData.totalChats || 0,
        totalLeads: analyticsData.totalLeads || 0,
        totalCost: analyticsData.totalCost || 0,
        totalTokens: analyticsData.totalTokens || 0,
        totalFiles: analyticsData.totalFiles || 0,
        monthlyChats: 0, // These could be calculated from analytics if needed
        monthlyLeads: 0,
        monthlyCost: 0
      });

      // Set general error if both requests failed
      if (hasErrors && !agentsResponse && !analyticsResponse) {
        setError('Failed to load dashboard data. Please check your connection and try again.');
      }
      
      setLoading(false);
  };

  const handleCreateAgent = async (agentData) => {
    try {
      // Create the agent with all data including files
      const response = await agentAPI.create(agentData);
      const newAgent = response.data.data;
      
      setAgents(prev => [...prev, newAgent]);
      setStats(prev => ({ ...prev, totalAgents: prev.totalAgents + 1 }));
      setShowCreateModal(false);
      toast.success('Agent created successfully!');
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to create agent: ${errorInfo.message}`);
    }
  };

  const handleDeleteAgent = (agentId) => {
    setAgentToDelete(agentId);
    setShowDeleteModal(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      await agentAPI.delete(agentToDelete);
      setAgents(prev => prev.filter(agent => agent.agent_id !== agentToDelete));
      setStats(prev => ({ ...prev, totalAgents: Math.max(0, prev.totalAgents - 1) }));
      setShowDeleteModal(false);
      setAgentToDelete(null);
      toast.success('Agent deleted successfully');
      
      // on delete, reload the dashboard data
      loadDashboardData();
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to delete agent: ${errorInfo.message}`);
      setShowDeleteModal(false);
      setAgentToDelete(null);
    }
  };

  const cancelDeleteAgent = () => {
    setShowDeleteModal(false);
    setAgentToDelete(null);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
              <p className="text-red-800 font-medium">Error Loading Dashboard</p>
            </div>
            <button
              onClick={loadDashboardData}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
          <p className="text-red-600 text-sm mt-2">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        {statsError ? (
          <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
                <p className="text-yellow-800 font-medium">Stats Unavailable</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
              >
                Retry
              </button>
            </div>
            <p className="text-yellow-600 text-sm mt-2">{statsError}</p>
          </div>
        ) : (
          <>
            <StatsCard
              title="Total Agents"
              value={formatNumber(stats.totalAgents)}
              icon={Users}
              color="blue"
              change={`+${stats.newAgentsThisMonth || 0} this month`}
              changeType="positive"
            />
            <StatsCard
              title="Total Conversations"
              value={formatNumber(stats.totalChats)}
              icon={MessageSquare}
              color="green"
              change={`+${formatNumber(stats.monthlyChats)} this month`}
              changeType="positive"
            />
            <StatsCard
              title="Total Leads"
              value={formatNumber(stats.totalLeads)}
              icon={TrendingUp}
              color="purple"
              change={`+${formatNumber(stats.monthlyLeads)} this month`}
              changeType="positive"
            />
            <StatsCard
              title="Total Files"
              value={formatNumber(stats.totalFiles)}
              icon={FileText}
              color="indigo"
              change={`+0 this month`}
              changeType="neutral"
            />
            <StatsCard
              title="Total Cost"
              value={formatCurrency(stats.totalCost)}
              icon={DollarSign}
              color="orange"
              change={`${formatCurrency(stats.monthlyCost)} this month`}
              changeType="neutral"
            />
          </>
        )}
      </div>

      {/* Agents Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">AI Agents</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors btn-hover"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>
        
        {agentsError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
                <p className="text-red-800 font-medium">Failed to Load Agents</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
            <p className="text-red-600 text-sm">{agentsError}</p>
          </div>
        ) : loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="text-center text-gray-500 mt-4">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents yet</h3>
            <p className="text-gray-500 mb-4">Create your first AI agent to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(agents) && agents.map(agent => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                onDelete={handleDeleteAgent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Analytics & Insights</h2>
      <CostAnalytics />
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    // { id: 'analytics', label: 'Analytics', icon: Activity },
  ];

  if (loading && agents.length === 0) {
    return (
      <div className="admin-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Chat Agent Dashboard</h1>
            <p className="text-gray-600">Manage your AI agents and monitor performance</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="admin-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAgent}
        />
      )}
      
      <ConfirmationModal
        isOpen={showDeleteModal}
        onConfirm={confirmDeleteAgent}
        onCancel={cancelDeleteAgent}
        title="Delete Agent"
        message="Are you sure you want to delete this agent? This action cannot be undone."
      />
    </div>
  );
};

export default AdminDashboard;
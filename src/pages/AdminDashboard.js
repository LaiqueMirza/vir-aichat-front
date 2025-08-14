import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  DollarSign, 
  Plus,
  Settings,
  BarChart3,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAPI, analyticsAPI, chatAPI, leadAPI, handleApiError, formatCurrency, formatNumber } from '../services/api';
import AgentCard from '../components/AgentCard';
import CreateAgentModal from '../components/CreateAgentModal';
import StatsCard from '../components/StatsCard';
import RecentChats from '../components/RecentChats';
import CostAnalytics from '../components/CostAnalytics';
import LeadsList from '../components/LeadsList';

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
  const [recentChats, setRecentChats] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  console.log('agents:', agents);
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
      
      // Call APIs individually to prevent one failure from affecting others
      let agentsResponse = null;
      let statsResponse = null;
      let chatsResponse = null;
      let leadsResponse = null;

      try {
        agentsResponse = await agentAPI.getAll();
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      }

      try {
        statsResponse = await analyticsAPI.getDashboardStats('30d');
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }

      try {
        chatsResponse = await chatAPI.getRecentChats(10);
      } catch (error) {
        console.error('Failed to fetch recent chats:', error);
      }

      try {
        leadsResponse = await leadAPI.getAll(null, 20, 0);
      } catch (error) {
        console.error('Failed to fetch leads:', error);
      }

      // Debug logging
      console.log('=== AGENTS RESPONSE DEBUG ===');
      console.log('agentsResponse:', agentsResponse);
      console.log('agentsResponse.data:', agentsResponse?.data);
      console.log('agentsResponse.data.success:', agentsResponse?.data?.success);
      console.log('agentsResponse.data.data:', agentsResponse?.data?.data);
      
      // The API returns { success: true, data: [...] }
      // With axios, the response is wrapped in .data, so agentsResponse.data = { success: true, data: [...] }
      const agentsData = agentsResponse?.data?.data || [];
      console.log('agentsData after processing:', agentsData);
      console.log('agentsData is array:', Array.isArray(agentsData));
      console.log('agentsData length:', agentsData.length);
      
      const finalAgents = Array.isArray(agentsData) ? agentsData : [];
      console.log('finalAgents:', finalAgents);
      console.log('finalAgents length:', finalAgents.length);
      
      setAgents(finalAgents);
      console.log('setAgents called with:', finalAgents);
      
      // Handle the analytics data structure from backend
      const analyticsData = statsResponse?.data?.data || statsResponse?.data || {};
      const overview = analyticsData.overview || {};
      
      setStats({
        totalAgents: agentsData.length || 0,
        totalChats: overview.totalChats || 0,
        totalLeads: overview.totalLeads || 0,
        totalCost: overview.totalCost || 0,
        monthlyChats: overview.totalMessages || 0,
        monthlyLeads: overview.totalLeads || 0,
        monthlyCost: overview.totalCost || 0,
        totalMessages: overview.totalMessages || 0,
        uniqueUsers: overview.uniqueUsers || 0,
        activeAgents: overview.activeAgents || 0,
        totalTokens: overview.totalTokens || 0,
        totalFiles: overview.totalFiles || 0,
        totalFileSize: overview.totalFileSize || 0
      });

      // Set recent chats data and transform to match component expectations
      const chatsData = chatsResponse?.data?.data || chatsResponse?.data || [];
      const transformedChats = Array.isArray(chatsData) ? chatsData.map(chat => ({
        ...chat,
        agentName: chat.agent_name,
        leadName: chat.client_name,
        leadEmail: chat.client_email,
        createdAt: chat.created_at,
        lastMessageAt: chat.last_message_at || chat.created_at
      })) : [];
      setRecentChats(transformedChats);

      // Set leads data and transform to match component expectations
      const leadsData = leadsResponse?.data?.data || leadsResponse?.data || [];
      const transformedLeads = Array.isArray(leadsData) ? leadsData.map(lead => ({
        ...lead,
        agentName: lead.agent_name,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
        chatCount: lead.chat_count || 0
      })) : [];
      setLeads(transformedLeads);
      
      setLoading(false);
  };

  const handleCreateAgent = async (agentData) => {
    try {
      const response = await agentAPI.create(agentData);
      setAgents(prev => [...prev, response.data]);
      setStats(prev => ({ ...prev, totalAgents: prev.totalAgents + 1 }));
      setShowCreateModal(false);
      toast.success('Agent created successfully!');
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to create agent: ${errorInfo.message}`);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return;
    }

    try {
      await agentAPI.delete(agentId);
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
      setStats(prev => ({ ...prev, totalAgents: Math.max(0, prev.totalAgents - 1) }));
      toast.success('Agent deleted successfully');
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(`Failed to delete agent: ${errorInfo.message}`);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="stats-grid">
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
          title="Total Cost"
          value={formatCurrency(stats.totalCost)}
          icon={DollarSign}
          color="orange"
          change={`${formatCurrency(stats.monthlyCost)} this month`}
          changeType="neutral"
        />
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
        
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents yet</h3>
            <p className="text-gray-500 mb-4">Create your first AI agent to get started</p>
            <p className="text-xs text-red-500 mb-4">DEBUG: agents.length = {agents.length}, agents = {JSON.stringify(agents)}</p>
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
                key={agent.id}
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

  const renderLeads = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Lead Management</h2>
      <LeadsList leads={leads} />
    </div>
  );

  const renderChats = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Recent Conversations</h2>
      <RecentChats chats={recentChats} />
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'leads', label: 'Leads', icon: TrendingUp },
    { id: 'chats', label: 'Chats', icon: MessageSquare },
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
        {activeTab === 'leads' && renderLeads()}
        {activeTab === 'chats' && renderChats()}
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAgent}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
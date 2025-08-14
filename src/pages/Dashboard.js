import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Activity,
  Plus,
  Filter,
  Search,
  Download
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { agentAPI, analyticsAPI, leadAPI, handleApiError, formatNumber, formatCurrency } from '../services/api';
import AgentCard from '../components/AgentCard';
import LeadCard from '../components/LeadCard';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalLeads: 0,
    totalChats: 0,
    totalRevenue: 0,
    activeAgents: 0,
    conversionRate: 0,
    avgResponseTime: 0,
    customerSatisfaction: 0
  });
  
  const [agents, setAgents] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [chartData, setChartData] = useState({
    chatsOverTime: null,
    leadsOverTime: null,
    agentPerformance: null,
    leadSources: null
  });
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats
      const [statsResponse, agentsResponse, leadsResponse, analyticsResponse] = await Promise.all([
        analyticsAPI.getDashboardStats(),
        agentAPI.getAll(),
        leadAPI.getAll({ limit: 6, sort: 'created_at', order: 'desc' }),
        analyticsAPI.getChartData(timeRange)
      ]);

      setStats(statsResponse.data || {
        totalAgents: 0,
        totalLeads: 0,
        totalChats: 0,
        totalRevenue: 0,
        activeAgents: 0,
        conversionRate: 0,
        avgResponseTime: 0,
        customerSatisfaction: 0
      });
      setAgents(agentsResponse.data || []);
      setRecentLeads(leadsResponse.data || []);
      
      // Process analytics data for charts
      const analytics = analyticsResponse.data;
      setChartData({
        chatsOverTime: analytics.chatsOverTime || [],
        leadsOverTime: analytics.leadsOverTime || [],
        agentPerformance: analytics.agentPerformance || [],
        leadSources: analytics.leadSources || []
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      try {
        await agentAPI.delete(agentId);
        setAgents(agents.filter(agent => agent.id !== agentId));
      } catch (error) {
        console.error('Error deleting agent:', error);
      }
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await leadAPI.delete(leadId);
        setRecentLeads(recentLeads.filter(lead => lead.id !== leadId));
      } catch (error) {
        console.error('Error deleting lead:', error);
      }
    }
  };

  const StatCard = ({ title, value, icon: Icon, change, color = 'blue' }) => (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change}% from last period
            </p>
          )}
        </div>
        <div className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your AI agents.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Agents"
          value={formatNumber(stats.totalAgents)}
          icon={Bot}
          change={stats.agentsChange}
          color="blue"
        />
        <StatCard
          title="Total Leads"
          value={formatNumber(stats.totalLeads)}
          icon={Users}
          change={stats.leadsChange}
          color="green"
        />
        <StatCard
          title="Total Chats"
          value={formatNumber(stats.totalChats)}
          icon={MessageSquare}
          change={stats.chatsChange}
          color="purple"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          change={stats.revenueChange}
          color="yellow"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chats Over Time */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Chats Over Time</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.chatsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="chats" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leads Over Time */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Leads Generated</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.leadsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="leads" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Performance */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Agent Performance</h3>
            <Bot className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.agentPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="conversations" fill="#8B5CF6" />
              <Bar dataKey="leads" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Sources */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Lead Sources</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.leadSources}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.leadSources.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'][index % 6]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Agents */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Agents</h3>
            <button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              New Agent
            </button>
          </div>
          
          <div className="space-y-4">
            {Array.isArray(agents) && agents.slice(0, 3).map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={handleDeleteAgent}
              />
            ))}
            
            {(!Array.isArray(agents) || agents.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No agents created yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
            <button className="btn-secondary">
              View All
            </button>
          </div>
          
          <div className="space-y-4">
            {recentLeads.slice(0, 3).map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onDelete={handleDeleteLead}
              />
            ))}
            
            {recentLeads.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No leads generated yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
import React, { useState } from 'react';
import { DollarSign, TrendingUp, Calendar, BarChart3 } from 'lucide-react';

const CostAnalytics = ({ costData = {} }) => {
  const [timeRange, setTimeRange] = useState('7d');

  const {
    totalCost = 0,
    dailyCosts = [],
    costByAgent = [],
    costByModel = [],
    trend = 0
  } = costData;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const timeRangeOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' }
  ];

  const generateMockDailyCosts = () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cost: Math.random() * 5 + 1
    }));
  };

  const mockDailyCosts = dailyCosts.length > 0 ? dailyCosts : generateMockDailyCosts();
  const maxCost = Math.max(...mockDailyCosts.map(d => d.cost));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Cost Analytics</h3>
        </div>
        
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
        >
          {timeRangeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Total Cost Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Cost</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(totalCost)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Daily Average</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(totalCost / mockDailyCosts.length)}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Trend</p>
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold text-purple-900">
                  {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                </p>
                <TrendingUp className={`w-4 h-4 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Daily Cost Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Daily Cost Trend</h4>
        <div className="h-32 flex items-end justify-between gap-1">
          {mockDailyCosts.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                style={{
                  height: `${(day.cost / maxCost) * 100}%`,
                  minHeight: '4px'
                }}
                title={`${day.date}: ${formatCurrency(day.cost)}`}
              />
              <span className="text-xs text-gray-500 mt-1 transform rotate-45 origin-left">
                {new Date(day.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cost by Agent */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Cost by Agent</h4>
          <div className="space-y-2">
            {(costByAgent.length > 0 ? costByAgent : [
              { agentName: 'Customer Support Bot', cost: totalCost * 0.4 },
              { agentName: 'Sales Assistant', cost: totalCost * 0.35 },
              { agentName: 'Technical Support', cost: totalCost * 0.25 }
            ]).map((agent, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700">{agent.agentName}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(agent.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost by Model */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Cost by Model</h4>
          <div className="space-y-2">
            {(costByModel.length > 0 ? costByModel : [
              { model: 'gpt-4o-mini', cost: totalCost * 0.7 },
              { model: 'gpt-4o', cost: totalCost * 0.3 }
            ]).map((model, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700">{model.model}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(model.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Optimization Tips */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h4 className="text-sm font-medium text-yellow-800 mb-2">💡 Cost Optimization Tips</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Use gpt-4o-mini for simpler tasks to reduce costs</li>
          <li>• Optimize system prompts to reduce token usage</li>
          <li>• Set appropriate max token limits for responses</li>
          <li>• Monitor and analyze high-cost conversations</li>
        </ul>
      </div>
    </div>
  );
};

export default CostAnalytics;
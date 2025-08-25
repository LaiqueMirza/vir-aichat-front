import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatsCard = ({ title, value, icon: Icon, change, changeType, color = 'blue' }) => {
  const colorClasses = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      icon: 'text-blue-600',
      text: 'text-blue-900',
      border: 'border-blue-200',
      shadow: 'shadow-blue-100'
    },
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-green-100',
      icon: 'text-green-600',
      text: 'text-green-900',
      border: 'border-green-200',
      shadow: 'shadow-green-100'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      icon: 'text-purple-600',
      text: 'text-purple-900',
      border: 'border-purple-200',
      shadow: 'shadow-purple-100'
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      icon: 'text-orange-600',
      text: 'text-orange-900',
      border: 'border-orange-200',
      shadow: 'shadow-orange-100'
    },
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100',
      icon: 'text-red-600',
      text: 'text-red-900',
      border: 'border-red-200',
      shadow: 'shadow-red-100'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border-2 ${colors.border} p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 transform stats-card-enhanced`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-4 rounded-xl ${colors.bg} ${colors.shadow} shadow-lg`}>
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </div>
        
        {change && (
          <div className="flex items-center">
            {changeType === 'positive' ? (
              <div className="flex items-center bg-green-100 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
                <span className="text-xs font-semibold text-green-700">+</span>
              </div>
            ) : changeType === 'negative' ? (
              <div className="flex items-center bg-red-100 px-2 py-1 rounded-full">
                <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
                <span className="text-xs font-semibold text-red-700">-</span>
              </div>
            ) : (
              <div className="flex items-center bg-gray-100 px-2 py-1 rounded-full">
                <span className="text-xs font-semibold text-gray-700">~</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-gray-900 leading-none">{formatValue(value)}</p>
        
        {change && (
          <div className="pt-2">
            <span className={`text-sm font-medium ${
              changeType === 'positive' ? 'text-green-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {change}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
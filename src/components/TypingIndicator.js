import React from 'react';

const TypingIndicator = () => {
  return (
    <div className="flex items-center space-x-1 p-4">
      <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
      </div>
      <span className="text-sm text-gray-500 ml-2">AI is typing...</span>
    </div>
  );
};

export default TypingIndicator;
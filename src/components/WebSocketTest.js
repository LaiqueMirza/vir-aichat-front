import React, { useState, useEffect } from 'react';
import websocketService from '../services/websocketService';

const WebSocketTest = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [testMessage, setTestMessage] = useState('Hello, this is a WebSocket streaming test message.');
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [streamingResponse, setStreamingResponse] = useState('');

  useEffect(() => {
    console.log('🧪 WebSocketTest component mounted, initializing connection...');
    
    const connectWebSocket = async () => {
      try {
        setConnectionStatus('Connecting...');
        
        // Set up event listeners first
        websocketService.on('connected', () => {
          setIsConnected(true);
          setConnectionStatus('Connected ✅');
          console.log('✅ WebSocket connected successfully');
        });

        websocketService.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          setConnectionStatus('Error ❌');
          setIsConnected(false);
        });

        websocketService.on('disconnected', () => {
          console.log('🔌 WebSocket disconnected');
          setConnectionStatus('Disconnected 🔌');
          setIsConnected(false);
        });

        // Connect to WebSocket
        websocketService.connect();

        // Set up message event listeners
        websocketService.on('textChunk', (data) => {
          console.log('📝 Received text chunk:', data.chunk);
          setStreamingResponse(prev => prev + data.chunk);
        });

        websocketService.on('audioChunk', (data) => {
          console.log('🔊 Received audio chunk, size:', data.audioData?.length || 0);
        });

        websocketService.on('messageComplete', () => {
          console.log('✅ Streaming complete');
          setStreamingResponse(currentResponse => {
            if (currentResponse.trim()) {
              setMessages(prev => [...prev, { 
                type: 'assistant', 
                content: currentResponse,
                timestamp: new Date().toISOString()
              }]);
            }
            return '';
          });
        });

      } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
        setConnectionStatus('Failed ❌');
      }
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection...');
      websocketService.disconnect();
    };
  }, []);

  const sendTestMessage = async () => {
    if (!isConnected || !testMessage.trim()) return;

    console.log('📤 Sending test message:', testMessage);
    
    // Add user message to display
    const userMessage = {
      type: 'user',
      content: testMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear streaming response
    setStreamingResponse('');

    try {
      // Send message via WebSocket
      const success = websocketService.sendTextMessage(testMessage, {
        agentId: 'test-agent-123',
        leadId: 'test-lead-456',
        voiceEnabled: isAudioEnabled,
        sessionId: 'websocket-test-session'
      });
      
      if (success) {
        console.log('✅ Message sent successfully');
      } else {
        throw new Error('Failed to send message via WebSocket');
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Failed to send message: ' + error.message,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingResponse('');
  };

  const testAudioContext = () => {
    console.log('🔊 Testing Audio Context...');
    
    if (typeof window !== 'undefined' && window.AudioContext) {
      const audioContext = new window.AudioContext();
      console.log('✅ AudioContext available:', audioContext.state);
      
      // Resume if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('▶️ AudioContext resumed');
        });
      }
      
      audioContext.close();
    } else {
      console.log('❌ AudioContext not available');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          🧪 WebSocket Streaming Test
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Connection Status:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {connectionStatus}
            </span>
          </div>
          <button
            onClick={testAudioContext}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Test Audio
          </button>
        </div>
      </div>

      {/* Test Message Input */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <h3 className="font-medium text-gray-700 mb-3">Send Test Message</h3>
        <div className="space-y-3">
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Enter your test message..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAudioEnabled}
                onChange={(e) => setIsAudioEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Enable Voice Response (TTS)</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={clearMessages}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={sendTestMessage}
                disabled={!isConnected || !testMessage.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Send Test Message
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Streaming Response */}
      {streamingResponse && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="animate-pulse flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
            <span className="text-sm text-blue-600 font-medium">Streaming...</span>
          </div>
          <div className="text-gray-800">{streamingResponse}</div>
        </div>
      )}

      {/* Messages Display */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">Messages</h3>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No messages yet. Send a test message to begin.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-100 border-l-4 border-blue-500 ml-8'
                    : message.type === 'assistant'
                    ? 'bg-green-100 border-l-4 border-green-500 mr-8'
                    : 'bg-red-100 border-l-4 border-red-500'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-gray-600 uppercase">
                    {message.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-800">{message.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebSocketTest;

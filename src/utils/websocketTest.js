/**
 * WebSocket Connection Test Utility
 * This utility helps test and debug the WebSocket streaming functionality
 */

import websocketService from '../services/websocketService';

class WebSocketTester {
  constructor() {
    this.testResults = [];
    this.isConnected = false;
  }

  /**
   * Run comprehensive WebSocket tests
   */
  async runTests() {
    console.log('🧪 Starting WebSocket Tests...');
    
    try {
      // Test 1: Connection Test
      await this.testConnection();
      
      // Test 2: Text Message Test
      await this.testTextMessage();
      
      // Test 3: Audio Streaming Test
      await this.testAudioStreaming();
      
      // Test 4: Error Handling Test
      await this.testErrorHandling();
      
      this.displayResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  /**
   * Test WebSocket connection
   */
  async testConnection() {
    console.log('🔌 Testing WebSocket connection...');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.addResult('Connection Test', false, 'Connection timeout after 5s');
        reject(new Error('Connection timeout'));
      }, 5000);

      websocketService.on('connected', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.addResult('Connection Test', true, 'Successfully connected to WebSocket server');
        console.log('✅ WebSocket connected');
        resolve();
      });

      websocketService.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('Connection Test', false, `Connection error: ${error.message}`);
        reject(error);
      });

      // Attempt connection
      websocketService.connect();
    });
  }

  /**
   * Test text message sending and receiving
   */
  async testTextMessage() {
    if (!this.isConnected) {
      this.addResult('Text Message Test', false, 'Not connected to server');
      return;
    }

    console.log('💬 Testing text message streaming...');
    
    return new Promise((resolve) => {
      let receivedChunks = 0;
      const timeout = setTimeout(() => {
        this.addResult('Text Message Test', receivedChunks > 0, 
          `Received ${receivedChunks} text chunks`);
        resolve();
      }, 10000);

      websocketService.on('textChunk', (data) => {
        receivedChunks++;
        console.log(`📝 Received text chunk ${receivedChunks}:`, data.text);
      });

      websocketService.on('messageComplete', (data) => {
        clearTimeout(timeout);
        this.addResult('Text Message Test', true, 
          `Message complete with ${receivedChunks} chunks`);
        console.log('✅ Text message streaming complete');
        resolve();
      });

      // Send test message
      const success = websocketService.sendTextMessage('Hello, this is a test message for WebSocket streaming!', {
        agent_id: 'test-agent',
        chat_id: 'test-chat',
        requestAudio: false
      });

      if (!success) {
        clearTimeout(timeout);
        this.addResult('Text Message Test', false, 'Failed to send message');
        resolve();
      }
    });
  }

  /**
   * Test audio streaming functionality
   */
  async testAudioStreaming() {
    if (!this.isConnected) {
      this.addResult('Audio Streaming Test', false, 'Not connected to server');
      return;
    }

    console.log('🎵 Testing audio streaming...');
    
    return new Promise((resolve) => {
      let receivedAudioChunks = 0;
      const timeout = setTimeout(() => {
        this.addResult('Audio Streaming Test', receivedAudioChunks > 0, 
          `Received ${receivedAudioChunks} audio chunks`);
        resolve();
      }, 15000);

      websocketService.on('audioChunk', (data) => {
        receivedAudioChunks++;
        console.log(`🎵 Received audio chunk ${receivedAudioChunks}:`, data.audioData?.length || 0, 'bytes');
      });

      websocketService.on('audioComplete', (data) => {
        clearTimeout(timeout);
        this.addResult('Audio Streaming Test', true, 
          `Audio streaming complete with ${receivedAudioChunks} chunks`);
        console.log('✅ Audio streaming complete');
        resolve();
      });

      // Send test voice message
      const success = websocketService.sendTextMessage('Please respond with audio for testing.', {
        agent_id: 'test-agent',
        chat_id: 'test-chat',
        requestAudio: true
      });

      if (!success) {
        clearTimeout(timeout);
        this.addResult('Audio Streaming Test', false, 'Failed to send voice message');
        resolve();
      }
    });
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('⚠️ Testing error handling...');
    
    return new Promise((resolve) => {
      let errorReceived = false;
      const timeout = setTimeout(() => {
        this.addResult('Error Handling Test', errorReceived, 
          errorReceived ? 'Error handling working' : 'No error response received');
        resolve();
      }, 5000);

      websocketService.on('error', (data) => {
        errorReceived = true;
        console.log('⚠️ Received error (expected):', data.error);
        clearTimeout(timeout);
        this.addResult('Error Handling Test', true, 'Error handling working correctly');
        resolve();
      });

      // Send invalid message to trigger error
      websocketService.sendTextMessage('', {
        agent_id: '',
        chat_id: '',
        requestAudio: false
      });
    });
  }

  /**
   * Add test result
   */
  addResult(testName, passed, message) {
    this.testResults.push({
      testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Display test results
   */
  displayResults() {
    console.log('\n🧪 WebSocket Test Results:');
    console.log('='.repeat(50));
    
    let passedTests = 0;
    let totalTests = this.testResults.length;
    
    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const statusText = result.passed ? 'PASSED' : 'FAILED';
      
      console.log(`${index + 1}. ${result.testName}: ${status} ${statusText}`);
      console.log(`   Message: ${result.message}`);
      console.log(`   Time: ${new Date(result.timestamp).toLocaleTimeString()}`);
      console.log('');
      
      if (result.passed) passedTests++;
    });
    
    console.log('='.repeat(50));
    console.log(`📊 Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! WebSocket streaming is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check the implementation for issues.');
    }

    // Disconnect after testing
    websocketService.disconnect();
  }

  /**
   * Get connection status for debugging
   */
  getConnectionStatus() {
    return websocketService.getConnectionStatus();
  }
}

// Export for use in development
export default WebSocketTester;

// Auto-run tests in development mode if needed
if (process.env.NODE_ENV === 'development' && window.location.search.includes('test-websocket')) {
  const tester = new WebSocketTester();
  tester.runTests();
}

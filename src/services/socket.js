import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(agentId) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000';
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      query: {
        agentId: agentId
      }
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      this.isConnected = true;
      this.emit('connectionStatus', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      this.isConnected = false;
      this.emit('connectionStatus', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.emit('connectionError', error);
    });

    // Chat events
    this.socket.on('message', (data) => {
      this.emit('message', data);
    });

    this.socket.on('typing', (data) => {
      this.emit('typing', data);
    });

    this.socket.on('stopTyping', (data) => {
      this.emit('stopTyping', data);
    });

    this.socket.on('messageStatus', (data) => {
      this.emit('messageStatus', data);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.emit('error', error);
    });

    // Agent events
    this.socket.on('agentStatus', (data) => {
      this.emit('agentStatus', data);
    });

    // Lead events
    this.socket.on('newLead', (data) => {
      this.emit('newLead', data);
    });

    this.socket.on('leadUpdated', (data) => {
      this.emit('leadUpdated', data);
    });
  }

  // Send message
  sendMessage(chatId, message, agentId) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('sendMessage', {
      chatId,
      message,
      agentId,
      timestamp: new Date().toISOString()
    });
  }

  // Join chat room
  joinChat(chatId) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('joinChat', { chatId });
  }

  // Leave chat room
  leaveChat(chatId) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('leaveChat', { chatId });
  }

  // Send typing indicator
  startTyping(chatId) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('typing', { chatId });
  }

  // Stop typing indicator
  stopTyping(chatId) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('stopTyping', { chatId });
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socket: this.socket
    };
  }

  // Reconnect
  reconnect(agentId) {
    this.disconnect();
    return this.connect(agentId);
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
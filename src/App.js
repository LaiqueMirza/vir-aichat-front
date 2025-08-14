import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminDashboard from './pages/AdminDashboard';
import ChatInterface from './pages/ChatInterface';
import './App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Admin Dashboard Route */}
          <Route path="/admin" element={<AdminDashboard />} />
          
          {/* Chat Interface Route */}
          <Route path="/chat/:agentId" element={<ChatInterface />} />
          
          {/* Default redirect to admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          
          {/* Catch all route - redirect to admin */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Router>
      
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            theme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            theme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
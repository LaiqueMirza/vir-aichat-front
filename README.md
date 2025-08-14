# VIR AI Chat Frontend

A modern React.js frontend for the VIR AI Chat multi-tenant chatbot system. This application provides both an admin dashboard for managing AI agents and a chat interface for end users.

## Features

### Admin Dashboard
- **Agent Management**: Create, configure, and manage AI agents
- **Analytics Dashboard**: View comprehensive statistics and cost analytics
- **Lead Management**: Track and manage leads generated from conversations
- **Chat History**: Monitor all chat conversations across agents
- **Real-time Updates**: Live updates using Socket.IO

### Chat Interface
- **Real-time Messaging**: Instant messaging with AI agents
- **Markdown Support**: Rich text formatting in AI responses
- **File Upload**: Support for document uploads during conversations
- **Typing Indicators**: Visual feedback during AI processing
- **Mobile Responsive**: Optimized for all device sizes

### Key Components
- **AgentCard**: Display agent information and statistics
- **CreateAgentModal**: Form for creating new AI agents
- **StatsCard**: Reusable statistics display component
- **RecentChats**: Recent conversation overview
- **CostAnalytics**: Detailed cost tracking and analysis
- **LeadsList**: Lead management with filtering and export

## Technology Stack

- **React 18**: Modern React with hooks and functional components
- **React Router**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API communication
- **Socket.IO Client**: Real-time communication
- **Lucide React**: Modern icon library
- **React Markdown**: Markdown rendering
- **React Hot Toast**: Toast notifications

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Backend API server running on port 8000

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd vir-aichat-front
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`.

### Environment Setup

The application is configured to proxy API requests to `http://localhost:8000`. Make sure your backend server is running on this port.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AgentCard.js
│   ├── CreateAgentModal.js
│   ├── StatsCard.js
│   ├── RecentChats.js
│   ├── CostAnalytics.js
│   └── LeadsList.js
├── pages/              # Main page components
│   ├── AdminDashboard.js
│   └── ChatInterface.js
├── services/           # API and service layers
│   ├── api.js
│   └── socket.js
├── App.js             # Main application component
├── App.css            # Global styles and Tailwind imports
└── index.js           # Application entry point
```

## API Integration

The frontend integrates with the backend API through:

- **REST API**: For CRUD operations (agents, leads, analytics)
- **WebSocket**: For real-time chat functionality
- **File Upload**: For document processing and knowledge base

### Key API Endpoints
- `GET /api/agents` - Fetch all agents
- `POST /api/agents` - Create new agent
- `GET /api/chats` - Fetch chat history
- `GET /api/leads` - Fetch leads
- `GET /api/analytics` - Fetch analytics data

## Styling

The application uses Tailwind CSS for styling with:
- Custom color palette
- Responsive design utilities
- Custom animations and transitions
- Dark/light theme support (configurable)

## Real-time Features

Socket.IO integration provides:
- Live chat messaging
- Typing indicators
- Agent status updates
- Lead notifications
- Real-time analytics updates

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

### Code Style

The project follows:
- ES6+ JavaScript standards
- Functional components with hooks
- Consistent naming conventions
- Modular component architecture

## Deployment

### Production Build

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

### Environment Variables

For production deployment, configure:
- API base URL
- Socket.IO server URL
- Any environment-specific settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

For support and questions, please contact the development team.
# EaselyBot - Node.js/JavaScript Version

EaselyBot is a Facebook Messenger chatbot that serves as a Canvas LMS assistant. It helps students manage assignments, deadlines, and academic tasks through conversational interfaces. This is the JavaScript/Node.js version of the application.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Facebook Developer Account
- Supabase Account (for database)
- Canvas LMS Access Token

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd EaselyBot
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start Development Server**
   ```bash
   npm run dev  # Uses nodemon for auto-restart
   # OR
   npm start    # Standard start
   ```

### Required Environment Variables

```env
# Facebook Messenger
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
VERIFY_TOKEN=your_webhook_verification_token

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Application
APP_ENV=development
PORT=5000
DEBUG=true
```

## 🏗️ Architecture

### Project Structure
```
├── main.js                     # Express application entry point
├── package.json               # Dependencies and scripts
├── config/
│   └── settings.js            # Configuration management
├── app/
│   ├── api/
│   │   └── messengerApi.js    # Facebook Messenger API wrapper
│   ├── core/
│   │   └── eventHandler.js    # Message processing and conversation flow
│   └── database/
│       └── supabaseClient.js  # Database operations
└── tests/                     # Test directory
```

### Key Components

**main.js** - Express.js application that:
- Handles webhook verification (`GET /webhook`)
- Processes incoming messages (`POST /webhook`)
- Routes events to appropriate handlers
- Provides health check endpoint (`GET /`)
- Includes bot setup endpoint (`POST /setup`)

**app/core/eventHandler.js** - Central message processor that:
- Manages conversation state using Supabase sessions
- Handles different message types (text, postbacks, quick replies)
- Implements onboarding flow for new users
- Manages task creation and Canvas token input workflows

**app/api/messengerApi.js** - Messenger API abstraction that:
- Provides methods for sending messages, quick replies, and button templates
- Handles typing indicators and webhook verification
- Creates reusable UI components (menus, pickers, task lists)

**config/settings.js** - Configuration module that:
- Loads environment variables with defaults
- Provides structured configuration via `CONFIG` object
- Includes validation functions for required settings

## 🔧 Development

### Available Scripts

```bash
npm start      # Start production server
npm run dev    # Start development server with auto-reload
npm test       # Run tests (when implemented)
```

### Testing the Webhook

Since this is a Facebook Messenger webhook, you'll need to:

1. **Set up ngrok for local testing:**
   ```bash
   ngrok http 5000
   ```

2. **Configure Facebook App webhook URL:**
   - Point to your ngrok URL + `/webhook`
   - Use the verification endpoint: `GET /webhook` with proper hub parameters

3. **Set up bot profile (run once):**
   ```bash
   curl -X POST http://localhost:5000/setup
   ```

### Environment Setup

The application requires environment variables for:
- `PAGE_ACCESS_TOKEN` - Facebook Page Access Token
- `VERIFY_TOKEN` - Webhook verification token
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key

### Legal Documentation

The bot references these legal documents during onboarding:
- **Privacy Policy**: https://easelyprivacypolicy.onrender.com
- **Terms of Use**: https://easelytermsofuse.onrender.com

## 📊 Database Schema

The application uses Supabase with these main tables:

### users
- `facebook_id` (primary key)
- `canvas_token` (encrypted in production)
- `onboarding_completed`
- `canvas_sync_enabled`
- `premium_user`
- Timestamps

### user_sessions
- `facebook_id`
- `session_key`
- `session_data`
- Timestamps

### webhook_events (logging)
- `event_type`
- `facebook_id`
- `event_data`
- `processing_status`

## 🚀 Deployment

### Environment Configuration
- Set `APP_ENV=production`
- Configure Supabase database URL
- Set proper logging levels
- Enable/disable features via feature flags

### Facebook App Configuration
- Configure webhook URL to point to your deployment
- Set up proper page access tokens
- Configure persistent menu and getting started button
- Set privacy policy and terms of use URLs

### Render Deployment (Recommended)

1. **Connect your GitHub repo to Render**

2. **Add environment variables:**
   - All variables from `.env.example`
   - Set `APP_ENV=production`

3. **Build and Start Commands:**
   ```
   Build: npm install
   Start: npm start
   ```

## 🔌 API Endpoints

### Main Endpoints

- `GET /` - Health check with dependency validation
- `GET /webhook` - Webhook verification for Facebook
- `POST /webhook` - Message processing webhook
- `POST /setup` - Bot profile setup (persistent menu, greeting)
- `POST /broadcast` - Broadcast messages to multiple users

### Health Check Response
```json
{
  "status": "running",
  "service": "Easely Bot",
  "version": "1.0.0",
  "environment": "development",
  "database": "connected"
}
```

## 🤖 Bot Features

### Free Features
- View tasks due Today/This Week/Overdue
- Basic Canvas sync (import assignments)
- Add manual tasks (limited)
- Reminders and quick actions

### Premium Features (Coming Soon)
- Enhanced reminders (multiple alerts)
- Unlimited manual tasks
- AI-powered study planning
- Weekly digest reports

## 🛠️ Development Guidelines

### Adding New Message Handlers
1. Create handler function in `eventHandler.js`
2. Add payload routing in `handlePostback()`
3. Create corresponding quick reply/button in `messengerApi.js`
4. Update user state management if needed

### Adding New API Endpoints
1. Add route in `main.js`
2. Implement proper error handling
3. Return appropriate HTTP status codes
4. Add logging for debugging

### Error Handling
- Always return 200 OK to Facebook webhook (prevents retry loops)
- Log errors for debugging but don't expose to users
- Provide fallback responses for unhandled cases
- Use typing indicators to show processing status

## 📋 Migration from Python

This JavaScript version maintains API compatibility with the original Python version:

### Key Differences
- **Framework**: Flask → Express.js
- **Dependencies**: requirements.txt → package.json
- **Modules**: Python imports → Node.js require/ES modules
- **Async**: Python async/await → JavaScript async/await
- **Database**: Same Supabase schema and operations

### Preserved Features
- All webhook endpoints work identically
- Same conversation flows and user experience
- Compatible database schema
- Same environment variable names

## 🐛 Troubleshooting

### Common Issues

1. **Webhook not responding**
   - Check ngrok is running and URL is correct
   - Verify `VERIFY_TOKEN` matches Facebook app settings
   - Check server logs for errors

2. **Database connection issues**
   - Verify Supabase credentials in `.env`
   - Check network connectivity
   - Confirm database tables exist

3. **Message sending fails**
   - Verify `PAGE_ACCESS_TOKEN` is correct
   - Check Facebook app permissions
   - Monitor API rate limits

## 📝 Contributing

1. Follow existing code style and patterns
2. Add proper error handling and logging
3. Update tests when adding new features
4. Document new environment variables

## 📄 License

This project is licensed under the MIT License.

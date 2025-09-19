# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

EaselyBot is a Facebook Messenger chatbot that serves as a Canvas LMS assistant. It helps students manage assignments, deadlines, and academic tasks through conversational interfaces. The bot integrates with Canvas API to fetch assignments and provides reminders and task management features.

## Development Commands

### Initial Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file with required environment variables
cp .env.example .env  # (create .env.example first or manually create .env)
```

### Running the Application
```bash
python main.py
```
The application runs on port 5000 by default (configurable via environment variables).

### Testing the Webhook
Since this is a Facebook Messenger webhook, you'll need to:
1. Set up ngrok for local testing: `ngrok http 5000`
2. Configure Facebook App webhook URL to point to your ngrok URL + `/webhook`
3. Use the webhook verification endpoint: `GET /webhook` with proper hub parameters

### Environment Setup
The application requires a `.env` file (not included in repo) with:
- `PAGE_ACCESS_TOKEN` - Facebook Page Access Token
- `VERIFY_TOKEN` - Webhook verification token
- `CANVAS_BASE_URL` - Canvas instance URL
- `DATABASE_URL` - PostgreSQL database URL (for production)

### Legal Documentation
The bot uses these legal documents during onboarding:
- **Privacy Policy**: https://easelyprivacypolicy.onrender.com
- **Terms of Use**: https://easelytermsofuse.onrender.com

### Video Tutorial
The bot includes a Canvas token generation video tutorial:
- File: `test.mkv` (883KB)
- Uploads directly to Facebook Messenger
- Fallback: Written step-by-step instructions

## Architecture

### Core Structure
```
main.py                    # Flask application entry point and webhook handler
├── app/
│   ├── api/
│   │   └── messenger_api.py    # Facebook Messenger API wrapper
│   └── core/
│       └── event_handler.py    # Message processing and conversation flow
├── config/
│   └── settings.py        # Configuration management
└── tests/                 # Test directory (currently empty)
```

### Key Components

**main.py** - Flask application that:
- Handles webhook verification (`GET /webhook`)
- Processes incoming messages (`POST /webhook`)
- Routes events to appropriate handlers
- Provides health check endpoint (`GET /`)

**app/core/event_handler.py** - Central message processor that:
- Manages conversation state using in-memory storage (`user_sessions`)
- Handles different message types (text, postbacks, quick replies)
- Implements onboarding flow for new users
- Manages task creation and Canvas token input workflows
- Routes payloads to specific handlers based on user state

**app/api/messenger_api.py** - Messenger API abstraction layer that:
- Provides methods for sending messages, quick replies, and button templates
- Handles typing indicators and webhook verification
- Creates reusable UI components (menus, pickers, task lists)

**config/settings.py** - Configuration module that:
- Loads environment variables with defaults
- Provides structured configuration via `CONFIG` dictionary
- Includes validation functions for required settings
- Manages feature flags and rate limiting settings

### User State Management
The application uses a simple in-memory session store (`user_sessions`) to track:
- User conversation state (`waiting_for_token`, `waiting_for_task_title`, etc.)
- Temporary data during task creation (title, date, time)
- User onboarding status

**Note**: In production, this should be replaced with a persistent database.

### Message Flow Architecture
1. **Webhook Reception**: `main.py` receives and validates Facebook webhook
2. **Event Processing**: `process_message_event()` extracts sender and message data
3. **Routing**: Events routed to `handle_message()` or `handle_postback()`
4. **State Checking**: Handler checks user state to determine response
5. **API Response**: Appropriate response sent via `messenger_api.py`

### Canvas Integration Points
The application is designed to integrate with Canvas LMS API for:
- Token validation (`handle_token_input()`)
- Assignment fetching (placeholder implementation in task handlers)
- Task synchronization (planned feature)

### Premium Features Architecture
The codebase includes infrastructure for premium features:
- Payment integration via Ko-fi webhooks
- Feature gating based on user subscription status
- Different reminder intervals for free vs premium users
- Activation flow for premium features

## Development Guidelines

### Adding New Message Handlers
1. Create handler function in `event_handler.py`
2. Add payload routing in `handle_postback()` 
3. Create corresponding quick reply/button in `messenger_api.py`
4. Update user state management if needed

### Adding New API Endpoints
1. Add route decorator in `main.py`
2. Implement proper error handling (follow existing pattern)
3. Return appropriate HTTP status codes
4. Add logging for debugging

### User State Management
- Always use helper functions (`set_user_state()`, `clear_user_state()`, etc.)
- Check state before processing user input
- Clear state after completing workflows
- Consider database replacement for production deployment

### Error Handling
- Always return 200 OK to Facebook webhook (prevents retry loops)
- Log errors for debugging but don't expose to users
- Provide fallback responses for unhandled cases
- Use typing indicators to show processing status

### Canvas API Integration
- Store Canvas tokens securely (implement proper encryption)
- Implement proper API rate limiting
- Handle Canvas API errors gracefully
- Cache assignment data to reduce API calls

## Deployment Notes

### Environment Configuration
- Set `APP_ENV=production` for production deployment
- Configure PostgreSQL database URL
- Set proper logging levels
- Enable/disable features via feature flags

### Facebook App Configuration
- Configure webhook URL to point to your deployment
- Set up proper page access tokens
- Configure persistent menu and getting started button
- Set privacy policy and terms of use URLs

### Database Setup
The application is designed to use PostgreSQL in production. Key considerations:
- User session storage
- Canvas token storage (encrypted)
- Task and reminder data
- Premium subscription tracking
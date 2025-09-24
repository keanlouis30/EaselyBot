# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

EaselyBot is a Facebook Messenger webhook service that helps students manage their Canvas Learning Management System (LMS) assignments. It integrates with Facebook Messenger for user interaction and Canvas API for assignment synchronization. The bot lets students view their course assignments, add tasks, and receive reminders through a conversational interface.

## Common Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run database connection test
node test-db.js

# Test Canvas API integration (edit test_canvas_api.js first to add your Canvas token)
node test_canvas_api.js

# Test task creation flow (for debugging webhook)
node test_task_creation.js
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Generate encryption key for securing tokens
openssl rand -base64 32

# Verify environment variables are set
node -e "console.log('VERIFY_TOKEN:', !!process.env.VERIFY_TOKEN)"
node -e "console.log('PAGE_ACCESS_TOKEN:', !!process.env.PAGE_ACCESS_TOKEN)"
node -e "console.log('APP_SECRET:', !!process.env.APP_SECRET)"
node -e "console.log('SUPABASE_URL:', !!process.env.SUPABASE_URL)"
```

### Webhook Testing
```bash
# Health check endpoint
curl http://localhost:3000/

# Simulate webhook verification (Facebook's verification)
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"

# View admin dashboard stats (requires admin token)
curl -H "X-Admin-Token: your_admin_token" http://localhost:3000/admin/stats
```

### Deployment
```bash
# Deploy to Render.com (automatic via GitHub integration)
git push origin main

# Manual deployment: Render uses render.yaml configuration
# Build: npm install
# Start: npm start
```

## Architecture

### Core Components

#### 1. Webhook Server (index.js)
- Express.js server handling Facebook Messenger webhooks
- Request signature verification using HMAC-SHA256
- Message routing system with quick replies and postbacks
- Canvas API integration for task synchronization
- Admin dashboard API for user management and broadcasts

#### 2. Database Service (services/database.js)
- Supabase integration for persistent data storage
- User management and session tracking
- Secure token encryption using CryptoJS
- Task and course data storage with Canvas synchronization

#### 3. Admin Dashboard API
- User statistics and broadcast functionality
- Authentication via admin token
- Broadcast messaging to targeted user segments

### Data Flow

1. **Facebook Webhook** receives messages (`POST /webhook`)
2. **Request Verification** checks signature against APP_SECRET 
3. **Message Router** identifies message type and user intent
4. **Session Manager** maintains conversation state in database
5. **Canvas Integration** syncs assignments and validates tokens
6. **Response Generator** creates appropriate replies
7. **Database** persists all user data and sessions

### Database Schema

The application uses Supabase (PostgreSQL) with the following tables:
- **users**: User profiles with Canvas integration status
- **user_sessions**: Active conversation flows and state
- **tasks**: Canvas assignments and manual tasks
- **courses**: Canvas courses linked to users
- **activity_log**: User interactions for analytics

### User Onboarding Flow
1. Introduction messages (features overview)
2. Privacy Policy consent collection
3. Terms of Use consent collection
4. Canvas token request with tutorial options
5. Token validation and account connection
6. Main menu presentation

### Canvas Integration
- **Token Validation**: Validates against Canvas API endpoint `/api/v1/users/self`
- **Assignment Fetching**: On-demand sync with Canvas API
- **Course Sync**: Fetches active courses and their assignments
- **Task Creation**: Uses Canvas Planner Notes API for persistence
- **Default Canvas URL**: `https://dlsu.instructure.com` (configurable via CANVAS_BASE_URL)

### Session Management
- **Database-backed Storage**: Persistent session storage (replacing in-memory Map)
- **Session Expiration**: Automatic cleanup after 1 hour of inactivity
- **Multi-step Flows**: Complex interactions tracked via database sessions
- **User Properties**:
  - `is_onboarded`: Tracks if user completed setup
  - `canvas_token`: Encrypted Canvas API token
  - `subscription_tier`: 'free' or 'premium'
  - `agreed_privacy`, `agreed_terms`: Consent tracking

### Message Handling Patterns
- **Command Detection**: Keywords like "hi", "menu", "activate"
- **Canvas Token Detection**: Pattern matching for long alphanumeric strings
- **Quick Reply Payloads**: Structured actions (e.g., GET_TASKS_TODAY)
- **Session Flows**: Multi-step interactions tracked via database sessions

## Important Implementation Details

### Security Features
- Request signature verification using `X-Hub-Signature-256` header
- HMAC-SHA256 validation with APP_SECRET
- Canvas token encryption using AES
- Admin API token protection
- Environment variable protection for sensitive credentials

### Canvas Integration
- Token validation against `/api/v1/users/self` endpoint
- Course synchronization for active enrollments
- Assignment fetching with pagination
- Task creation via Planner Notes API

### Session Management
- Database-backed session storage (replacing in-memory Map)
- Session expiration after 1 hour of inactivity
- Multi-step conversation flows for complex interactions
- Clear session boundaries with automatic cleanup

### Message Types
- Text messages with natural language understanding
- Quick replies for structured interactions
- Postback buttons for multi-option choices
- Canvas token detection via regex pattern

### Facebook Messenger Integration
- Graph API version: v18.0
- Message types: text, quick_replies, button templates
- Webhook events: messages, postbacks
- Rate limiting considerations built into response flow

### Task Management Features
- **Due Today**: Filters assignments due on current date (Manila timezone)
- **Due This Week**: Shows next 7 days of assignments
- **Overdue**: Past due assignments
- **Add Task**: Multi-step flow (title → course → description → date → time)
- Timezone handling: Asia/Manila for date formatting

### Error Handling
- Canvas API connection failures with retry suggestions
- Invalid token detection with helpful error messages
- Missing environment variable warnings on startup
- Graceful degradation when Canvas is unavailable

## Deployment

### Render.com Setup
```bash
# Deploy to Render.com (automatic via GitHub integration)
git push origin main
```

The `render.yaml` file defines:
- Web service: Node.js with Express
- PostgreSQL database connection
- Environment variables configuration
- Automatic deployment triggers

### Environment Variables
Essential variables required for deployment:
- `VERIFY_TOKEN`: Webhook verification token
- `PAGE_ACCESS_TOKEN`: Facebook Page access token
- `APP_SECRET`: Facebook App secret
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`: Database credentials
- `ENCRYPTION_KEY`: For secure storage of Canvas tokens

## Troubleshooting

### Common Issues

1. **Webhook Verification Failing**
   - Verify `VERIFY_TOKEN` matches between Facebook app and environment
   - Check that the callback URL is correct in Facebook developer portal
   - Confirm webhook subscription to `messages` and `messaging_postbacks`

2. **Database Connection Issues**
   - Run `node test-db.js` to verify Supabase connectivity
   - Check environment variables for database credentials
   - Verify the database schema has been applied in Supabase SQL editor

3. **Canvas Integration Problems**
   - Test Canvas token with `node test_canvas_api.js`
   - Verify `CANVAS_BASE_URL` matches the institution's Canvas URL
   - Check Canvas API permissions for the token

4. **Session Flow Getting Stuck**
   - Use `node test_task_creation.js` to debug conversation flows
   - Check session expiration logic in database.js
   - Verify that the flow transitions are correctly implemented

## Important Notes

- **Database Migration**: Application now uses Supabase for persistent storage
- **Canvas API Rate Limits**: Implementation defers bulk fetching to avoid overwhelming the API
- **Premium Features**: Activation flow exists but payment integration pending (Ko-fi planned)
- **Manual Tasks**: Stored in database and can be synced to Canvas via Planner Notes API

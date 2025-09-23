# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

EaselyBot is a Facebook Messenger webhook service that helps students manage their Canvas LMS assignments. It integrates with Facebook Messenger for user interaction and Canvas API for assignment synchronization.

## Common Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Test webhook locally
curl http://localhost:3000/  # Health check
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"  # Webhook verification
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials (required variables):
# VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET
```

### Deployment
```bash
# Deploy to Render.com (automatic via GitHub integration)
git push origin main

# Manual deployment: Render uses render.yaml configuration
# Build: npm install
# Start: npm start
```

### Testing Canvas Integration
```bash
# Test Canvas token validation (replace with actual token)
# Send a long alphanumeric string to the bot in Messenger
# Pattern: /^[a-zA-Z0-9~]+$/ with length > 20
```

## Architecture

### Core Components

**index.js** - Main webhook server (1171 lines)
- Express.js server handling Facebook Messenger webhooks
- Request signature verification using HMAC-SHA256 for security
- In-memory user session management (Map-based storage)
- Canvas API integration for assignment synchronization
- Message routing system with quick replies and postbacks

### Request Flow
1. **Webhook Verification** (GET /webhook): Facebook validates the webhook during setup
2. **Message Processing** (POST /webhook): 
   - Validates request signature against APP_SECRET
   - Routes messages based on content and user state
   - Handles text messages, quick replies, and postbacks
   - Maintains user sessions for multi-step flows

### User Onboarding Flow
1. Introduction messages (features overview)
2. Privacy Policy consent collection
3. Terms of Use consent collection
4. Canvas token request with tutorial options
5. Token validation and account connection
6. Main menu presentation

### Canvas Integration
- **Token Validation**: Validates against Canvas API endpoint `/api/v1/users/self`
- **Assignment Fetching**: Currently implemented but deferred to on-demand
- **Course Sync**: Fetches active courses and their assignments
- **Default Canvas URL**: `https://dlsu.instructure.com` (configurable via CANVAS_BASE_URL)

### Session Management
- **User Storage**: Map keyed by sender ID
- **Session Storage**: Temporary state for multi-step flows (e.g., task creation)
- **User Properties**:
  - `isOnboarded`: Tracks if user completed setup
  - `canvasToken`: Stores Canvas API token
  - `subscriptionTier`: 'free' or 'premium'
  - `assignments`: Array of synced assignments
  - `agreedPrivacy`, `agreedTerms`: Consent tracking

### Message Handling Patterns
- **Command Detection**: Keywords like "hi", "menu", "activate"
- **Canvas Token Detection**: Pattern matching for long alphanumeric strings
- **Quick Reply Payloads**: Structured actions (e.g., GET_TASKS_TODAY)
- **Session Flows**: Multi-step interactions tracked via userSessions Map

## Key Implementation Details

### Security
- Request signature verification using `X-Hub-Signature-256` header
- HMAC-SHA256 validation with APP_SECRET
- Environment variable protection for sensitive credentials

### Facebook Messenger Integration
- Graph API version: v18.0
- Message types: text, quick_replies, button templates
- Webhook events: messages, postbacks
- Rate limiting considerations built into response flow

### Task Management Features
- **Due Today**: Filters assignments due on current date (Manila timezone)
- **Due This Week**: Shows next 7 days of assignments
- **Overdue**: Past due assignments
- **Add Task**: Two-step flow (title → time)
- Timezone handling: Asia/Manila for date formatting

### Error Handling
- Canvas API connection failures with retry suggestions
- Invalid token detection with helpful error messages
- Missing environment variable warnings on startup
- Graceful degradation when Canvas is unavailable

## Deployment Configuration

**render.yaml** defines:
- Web service: Node.js environment with free plan
- PostgreSQL database: Pre-configured for future use
- Environment variables: Mix of hardcoded and dashboard-configured
- Auto-deploy: Enabled for main branch pushes

## Important Notes

- **In-Memory Storage**: User data resets on deployment (planned PostgreSQL migration)
- **Canvas API Rate Limits**: Implementation defers bulk fetching to avoid overwhelming the API
- **Premium Features**: Activation flow exists but payment integration pending (Ko-fi planned)
- **Manual Tasks**: Currently stored in memory, not synced back to Canvas

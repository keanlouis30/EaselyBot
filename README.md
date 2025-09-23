# Easely - Facebook Messenger Webhook

A Facebook Messenger webhook service for Easely, the Canvas Learning Management System assistant. This webhook handles user interactions, Canvas API integration, and provides a seamless conversational interface for students to manage their academic workload.

## Features

- 🔗 **Facebook Messenger Integration**: Full webhook support for receiving and sending messages
- 🔐 **Secure Webhook Verification**: Request signature validation using Facebook App Secret
- 📝 **Canvas LMS Integration**: Ready for Canvas API token validation and assignment sync
- 🎯 **Interactive User Interface**: Quick replies and postback handling for seamless UX
- 🚀 **Render.com Deployment**: Production-ready deployment configuration
- 💾 **PostgreSQL Ready**: Database configuration for user data and assignment storage

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd EaselyBot
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Edit `.env` with your Facebook App credentials:

```env
VERIFY_TOKEN=your_unique_verify_token
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
APP_SECRET=your_facebook_app_secret
PORT=3000
```

### 3. Local Development

```bash
# Start the development server
npm run dev

# Or start production server
npm start
```

The webhook will be available at `http://localhost:3000/webhook`

### 4. Test the Webhook

**Health Check:**
```bash
curl http://localhost:3000/
```

**Webhook Verification (simulating Facebook):**
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"
```

## Facebook App Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app → Business → Continue
3. Add **Messenger** product to your app

### Step 2: Configure Messenger

1. **Page Access Token**: Generate token for your Facebook Page
2. **Webhooks**: 
   - Callback URL: `https://your-render-app.onrender.com/webhook`
   - Verify Token: Use the same token as in your `.env` file
   - Subscribe to: `messages`, `messaging_postbacks`

### Step 3: App Secret

1. Go to App Settings → Basic
2. Copy the **App Secret** to your environment variables

## Deployment to Render.com

### Option 1: Using render.yaml (Recommended)

1. **Connect Repository**: Link your GitHub repo to Render
2. **Set Environment Variables**: In Render dashboard, add:
   ```
   VERIFY_TOKEN=your_verify_token
   PAGE_ACCESS_TOKEN=your_page_access_token  
   APP_SECRET=your_app_secret
   ```
3. **Deploy**: Render will automatically use the `render.yaml` configuration

### Option 2: Manual Web Service

1. **Create Web Service**: New → Web Service
2. **Configuration**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/`
   - **Environment**: Node
   - **Plan**: Free

3. **Environment Variables**: Add the same variables as above

### Get Your Webhook URL

After deployment, your webhook URL will be:
```
https://your-app-name.onrender.com/webhook
```

Use this URL in your Facebook App webhook configuration.

## API Endpoints

### GET /
**Health Check**
- **Purpose**: Verify service is running
- **Response**: Service status and metadata
- **Example**:
  ```bash
  curl https://your-app.onrender.com/
  ```

### GET /webhook
**Webhook Verification**
- **Purpose**: Facebook webhook verification during setup
- **Parameters**: `hub.mode`, `hub.verify_token`, `hub.challenge`
- **Response**: Challenge string if verification succeeds

### POST /webhook
**Message Processing**
- **Purpose**: Receive and process Facebook Messenger events
- **Security**: Validates request signature using App Secret
- **Handles**: Messages, postbacks, quick replies

## Message Flow Examples

### New User Onboarding
1. User sends "Get Started"
2. Bot responds with consent request and quick reply buttons
3. User clicks "✅ I Agree, Let's Go!"
4. Bot requests Canvas access token
5. User provides token → Bot validates and syncs data

### Returning User Menu
1. User sends "Hi" or "Menu"  
2. Bot displays main menu with quick replies:
   - 🔥 Due Today
   - ⏰ Due This Week  
   - ❗️ Show Overdue
   - 🗓 View All Upcoming
   - ➕ Add New Task

### Canvas Token Processing
1. User pastes long alphanumeric string
2. Bot detects it as Canvas token using pattern matching
3. Validates token against Canvas API
4. Syncs user's assignments and courses
5. Displays personalized assignment list

## Project Structure

```
EaselyBot/
├── index.js                 # Main webhook server
├── package.json             # Dependencies and scripts
├── render.yaml              # Render deployment config
├── .env.example             # Environment template
├── .env                     # Your actual environment (don't commit!)
├── README.md               # This documentation
└── Easely App.pdf          # Project requirements
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VERIFY_TOKEN` | Yes | Webhook verification token (you choose this) |
| `PAGE_ACCESS_TOKEN` | Yes | Facebook Page access token |
| `APP_SECRET` | Yes | Facebook App secret for signature verification |
| `PORT` | No | Server port (default: 3000, auto-set by Render) |
| `NODE_ENV` | No | Environment (development/production) |
| `CANVAS_API_URL` | No | Canvas LMS base URL (default: canvas.instructure.com) |
| `DATABASE_URL` | No | PostgreSQL connection string (for future use) |

## Testing the Bot

### 1. Send Test Message

Once deployed, send a message to your Facebook Page:

**Test Messages:**
- "Hi" → Should trigger welcome menu
- "Get Started" → Should start onboarding flow  
- "Menu" → Should display quick reply options
- "Activate" → Should show premium activation message

### 2. Test Canvas Token

Send a long alphanumeric string (simulating a Canvas token):
```
1234567890abcdefghijklmnopqrstuvwxyz123456789
```

The bot should detect this as a Canvas token and respond with sync confirmation.

### 3. Test Quick Replies

Click the quick reply buttons to test different flows:
- **Due Today**: Shows today's tasks
- **Due This Week**: Shows weekly overview
- **Add New Task**: Starts task creation flow

## Development Notes

### Current Implementation
- ✅ Facebook Messenger webhook handling
- ✅ Message routing and response logic
- ✅ Canvas token detection (pattern-based)
- ✅ Interactive quick replies and postbacks
- ✅ Secure request signature validation
- ✅ Production deployment configuration

### TODO: Future Enhancements
- [ ] Canvas API integration for real token validation
- [ ] PostgreSQL database integration  
- [ ] User session management
- [ ] Real assignment data sync
- [ ] Reminder scheduling with cron jobs
- [ ] Ko-fi payment integration for premium features

### Message Types Handled
- **Text Messages**: Routed based on content
- **Postbacks**: Button click events  
- **Quick Replies**: Structured response options

### Security Features
- Request signature verification using HMAC-SHA256
- Environment variable protection for sensitive data
- Input validation for Canvas tokens
- Error handling for malformed requests

## Troubleshooting

### Webhook Not Receiving Messages
1. **Check URL**: Ensure webhook URL in Facebook app matches your Render deployment
2. **Verify Token**: Confirm verify token matches between Facebook app and environment
3. **Check Logs**: View logs in Render dashboard for error details
4. **Test Health Check**: Ensure `https://your-app.onrender.com/` returns 200

### Facebook Verification Failing
1. **Verify Token Match**: Ensure `VERIFY_TOKEN` in `.env` matches Facebook app setting
2. **Case Sensitivity**: Tokens are case-sensitive
3. **URL Format**: Use full webhook URL with `/webhook` path

### Messages Not Sending
1. **Page Access Token**: Verify token has correct permissions
2. **App Review**: Some features require Facebook app review
3. **API Version**: Ensure using compatible Graph API version (v18.0)

### Environment Variables Missing
```bash
# Check required variables are set
node -e "console.log('VERIFY_TOKEN:', !!process.env.VERIFY_TOKEN)"
node -e "console.log('PAGE_ACCESS_TOKEN:', !!process.env.PAGE_ACCESS_TOKEN)"  
node -e "console.log('APP_SECRET:', !!process.env.APP_SECRET)"
```

## Support

For questions about Easely implementation:
1. Check the `Easely App.pdf` for detailed feature specifications
2. Review Facebook Messenger Platform documentation
3. Test webhook locally before deploying to production

---

**Built with Express.js and deployed on Render.com**

*Ready to help students never miss another assignment! 📚✨*

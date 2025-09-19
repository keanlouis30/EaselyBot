<<<<<<< HEAD
# EaselyBot

🤖 **Facebook Messenger Chatbot for Canvas LMS Integration**

EaselyBot is an intelligent chatbot that helps students manage their Canvas assignments, deadlines, and academic tasks through Facebook Messenger. It provides automated reminders, task management, and seamless Canvas API integration.

## 🚀 Features

- **Canvas LMS Integration**: Sync assignments and deadlines from Canvas
- **Smart Reminders**: Automated notifications before due dates
- **Task Management**: Add custom tasks and track progress
- **Premium Features**: Advanced reminders, AI planning, unlimited tasks
- **Privacy-First**: GDPR compliant with secure token storage
- **Payment Integration**: Ko-fi integration for premium subscriptions
- **Supabase Backend**: Real-time database, automatic scaling, built-in auth
- **Real-time Updates**: Live data synchronization across all bot interactions

## 🏗️ Architecture

```
├── main.py                    # Flask application entry point
├── app/
│   ├── api/
│   │   └── messenger_api.py    # Facebook Messenger API wrapper
│   └── core/
│       └── event_handler.py    # Message processing and conversation flow
├── config/
│   └── settings.py            # Configuration management
├── init_db.py                 # Database initialization script
├── requirements.txt           # Python dependencies
├── render.yaml               # Render deployment configuration
├── Procfile                  # Process definition
├── gunicorn.conf.py          # Production server configuration
└── .env.example              # Environment variables template
```

## 📋 Prerequisites

- Python 3.11+
- Supabase account and project (free tier available)
- Facebook Developer Account
- Canvas LMS instance with API access
- Render account (for deployment)

## 🛠️ Local Development Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd EaselyBot

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required: PAGE_ACCESS_TOKEN, VERIFY_TOKEN, DATABASE_URL
```

### 3. Supabase Setup

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project credentials:
   - Go to Project Settings > API
   - Copy your `URL` and `anon public` key
   - Copy your `service_role secret` key (for database setup)
4. Add these to your `.env` file:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_public_key_here
SUPABASE_SERVICE_KEY=your_service_role_secret_here
```

5. Initialize the database:

```bash
python init_db.py
```

### 4. Facebook App Setup

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Messenger product
3. Generate Page Access Token
4. Set webhook URL (use ngrok for local testing)
5. Subscribe to webhook events: `messages`, `messaging_postbacks`

### 5. Run Development Server

```bash
# For local testing with ngrok
ngrok http 5000  # In separate terminal

# Start the application
python main.py
```

## 🌐 Production Deployment on Render

### Step 1: Prepare Your Repository

Ensure your repository contains all the deployment files created by this setup:

- `render.yaml` - Render service configuration
- `Procfile` - Process definition  
- `gunicorn.conf.py` - Production server settings
- `.env.example` - Environment variables template
- `init_db.py` - Database initialization script

### Step 2: Set Up Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project:
   - **Name**: `easely-bot`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
   - **Plan**: `Free` (includes 500MB database + 2GB bandwidth)
3. Wait for project setup to complete
4. **Get your credentials**:
   - Go to Project Settings > API
   - Copy `URL`, `anon public`, and `service_role secret` keys
5. **Initialize database schema**:
   - Either run `python init_db.py` locally with service key
   - Or copy the SQL from `init_db.py` and run in Supabase SQL Editor

### Step 3: Create Render Web Service

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure service:
   - **Name**: `easely-bot`
   - **Region**: `Oregon (US West)`
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 main:app`
   - **Plan**: `Free` (for testing) or `Starter` (for production)

### Step 4: Configure Environment Variables

In your Render web service settings, add these environment variables:

#### Required Variables
```bash
# Facebook Messenger
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
VERIFY_TOKEN=your_webhook_verification_token

# Supabase (from Step 2)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_secret

# Application
APP_ENV=production
DEBUG=false
SECRET_KEY=your-super-secret-key-change-this
```

#### Optional Variables
```bash
# Canvas Integration
CANVAS_BASE_URL=https://your-school.instructure.com

# URLs (update after deployment)
WEBHOOK_URL=https://your-app-name.onrender.com/webhook
PRIVACY_POLICY_URL=https://easelyprivacypolicy.onrender.com
TERMS_OF_USE_URL=https://easelytermsofuse.onrender.com

# Payment Integration
KOFI_WEBHOOK_TOKEN=your_kofi_webhook_token
KOFI_SHOP_URL=https://ko-fi.com/easely

# Feature Flags
ENABLE_AI_FEATURES=false
ENABLE_PREMIUM=true

# Logging
LOG_LEVEL=INFO
```

### Step 5: Database Schema Verification

Your database should already be initialized from Step 2. To verify:

1. Go to your Supabase project dashboard
2. Click on "Table Editor" in the sidebar
3. Verify that the following tables exist:
   - `users`
   - `user_sessions`
   - `tasks`
   - `reminders`
   - `canvas_sync_log`
   - `transactions`

**If tables are missing**, you can:
- Run `python init_db.py` locally with your service key, OR
- Copy the SQL schema from `init_db.py` and run it in Supabase SQL Editor

### Step 6: Configure Facebook Webhook

1. In your Facebook App settings:
   - **Webhook URL**: `https://your-app-name.onrender.com/webhook`
   - **Verify Token**: (same as your `VERIFY_TOKEN` environment variable)
   - **Subscription Fields**: `messages`, `messaging_postbacks`

2. Test webhook verification by clicking "Verify and Save"

### Step 7: Set Up Bot Profile

After successful deployment, initialize your bot profile:

```bash
curl -X POST https://your-app-name.onrender.com/setup
```

This configures:
- Welcome message
- Persistent menu
- Get Started button
- Greeting text

## 🔧 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|----------|
| `PAGE_ACCESS_TOKEN` | ✅ | Facebook Page Access Token | `EAAx...` |
| `VERIFY_TOKEN` | ✅ | Webhook verification token | `my_secret_token` |
| `SUPABASE_URL` | ✅ | Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_KEY` | ✅ | Supabase anon public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_KEY` | ❌ | Supabase service role secret (for admin ops) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `APP_ENV` | ❌ | Environment mode | `production` |
| `DEBUG` | ❌ | Enable debug mode | `false` |
| `SECRET_KEY` | ❌ | Flask secret key | `random-secret-key` |
| `CANVAS_BASE_URL` | ❌ | Canvas instance URL | `https://school.instructure.com` |
| `WEBHOOK_URL` | ❌ | Public webhook URL | `https://app.onrender.com/webhook` |
| `PRIVACY_POLICY_URL` | ❌ | Privacy policy link | `https://example.com/privacy` |
| `TERMS_OF_USE_URL` | ❌ | Terms of use link | `https://example.com/terms` |
| `KOFI_WEBHOOK_TOKEN` | ❌ | Ko-fi payment webhook token | `abc123...` |
| `ENABLE_PREMIUM` | ❌ | Enable premium features | `true` |
| `LOG_LEVEL` | ❌ | Logging level | `INFO` |

## 📊 Monitoring and Health Checks

The application includes comprehensive health monitoring:

### Health Check Endpoint
```bash
GET https://your-app-name.onrender.com/
```

Returns:
```json
{
  "status": "running",
  "service": "Easely Bot",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "environment": "production",
  "database": "connected"
}
```

### Render Monitoring

Render automatically monitors:
- Application uptime
- Response times
- Error rates
- Resource usage

### Logging

Application logs are available in the Render dashboard under "Logs". Key events logged:
- Webhook verifications
- Message processing
- Database connections
- Error conditions

## 🐛 Troubleshooting

### Common Issues

#### 1. Webhook Verification Failed
```bash
# Check environment variables
echo $VERIFY_TOKEN
echo $PAGE_ACCESS_TOKEN

# Test health endpoint
curl https://your-app-name.onrender.com/
```

#### 2. Supabase Connection Issues
```bash
# Verify Supabase environment variables
echo $SUPABASE_URL
echo $SUPABASE_KEY

# Test connection
python -c "from app.database.supabase_client import supabase_client; print('Connected!' if supabase_client.test_connection() else 'Failed!')"
```

#### 3. Bot Not Responding
```bash
# Check logs in Render dashboard
# Verify webhook subscription in Facebook App
# Test with /webhook endpoint directly
```

#### 4. Video Upload Issues
```bash
# Ensure test.mkv is in repository root
# Check file size limits (25MB for Messenger)
# Verify video file path in event_handler.py
```

### Getting Help

1. Check Render logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test individual endpoints using curl
4. Check Facebook Developer Console for webhook delivery issues

## 🔒 Security Considerations

- **Environment Variables**: Never commit secrets to version control
- **Token Storage**: Canvas tokens should be encrypted in production
- **HTTPS**: Always use HTTPS for webhook endpoints
- **Input Validation**: Validate all user inputs
- **Rate Limiting**: Implement rate limiting for API endpoints
- **Database**: Use connection pooling and prepared statements

## 📈 Scaling

For higher loads, consider:

1. **Upgrade Render Plan**: Move from Free to Starter/Professional
2. **Database Scaling**: Upgrade PostgreSQL plan
3. **Worker Configuration**: Increase Gunicorn workers
4. **Caching**: Add Redis for session storage
5. **Queue System**: Use Celery for background tasks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

[Add your license information here]

## 🆘 Support

For support questions:
- Check the troubleshooting section above
- Review Render deployment logs
- Verify Facebook App configuration
- Test webhook endpoints manually
=======
# EaselyPrivacyPolicy
>>>>>>> 91626ed042db76770b7431e069afd9de40942b50

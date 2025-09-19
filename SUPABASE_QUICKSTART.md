# 🚀 EaselyBot Supabase Quick Start Guide

This guide will get your EaselyBot connected to Supabase and ready for deployment in **less than 10 minutes**.

## 📋 What You'll Need

1. **Supabase Account** - Free at [supabase.com](https://supabase.com)
2. **Facebook Developer Account** - For Messenger integration  
3. **Render Account** - For deployment (free tier available)

## ⚡ Quick Setup (3 Steps)

### Step 1: Create Supabase Project (2 minutes)

1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Click "New Project"**
3. **Fill in project details:**
   - **Name**: `easely-bot`
   - **Database Password**: Choose a strong password  
   - **Region**: Choose closest to your users
   - **Plan**: `Free` (perfect for getting started)
4. **Wait 2-3 minutes** for project setup
5. **Get your credentials:**
   - Go to **Settings > API**
   - Copy these 3 values:
     - `URL` → This is your `SUPABASE_URL`
     - `anon public` → This is your `SUPABASE_KEY`  
     - `service_role secret` → This is your `SUPABASE_SERVICE_KEY`

### Step 2: Set Environment Variables (30 seconds)

```bash
# Add these to your .env file or export them
export SUPABASE_URL="https://your-project-id.supabase.co"
export SUPABASE_KEY="your_anon_public_key_here"
export SUPABASE_SERVICE_KEY="your_service_role_secret_here"
```

### Step 3: Run Setup Script (1 minute)

```bash
# Run the automated setup
python setup_supabase.py
```

That's it! 🎉 Your database is ready.

## 🗄️ What Gets Created

The setup creates a **production-ready database** with 7 tables:

### 📊 Core Tables

1. **`users`** - User profiles, Canvas tokens, subscription status
2. **`user_sessions`** - Conversation state (what step user is on)
3. **`tasks`** - Assignments from Canvas + manual tasks
4. **`reminders`** - Smart reminder system (free vs premium tiers)
5. **`canvas_sync_log`** - Track Canvas API performance
6. **`transactions`** - Payment tracking for premium subscriptions
7. **`user_analytics`** - User engagement metrics

### 🔧 Advanced Features Created

- ✅ **UUID Primary Keys** - Secure, globally unique IDs
- ✅ **Row-Level Security** - Users only see their own data
- ✅ **Automatic Timestamps** - `created_at`, `updated_at` auto-managed
- ✅ **Smart Triggers** - Auto-create reminders, update statistics
- ✅ **Performance Indexes** - Optimized for Facebook Messenger workload
- ✅ **Data Validation** - Check constraints prevent invalid data
- ✅ **Cascade Deletes** - GDPR compliant user data removal

## 🎯 Key Database Design Features

### Premium Reminder System
```sql
-- Free users get 1 reminder (24 hours before)
-- Premium users get full cascade: 1w, 3d, 1d, 8h, 2h, 1h
reminder_type VARCHAR(20)  -- '1w', '3d', '1d', '8h', '2h', '1h'
```

### Canvas Integration
```sql
-- Store Canvas assignment data for sync
canvas_assignment_id VARCHAR(100)    -- Link to Canvas
canvas_course_id VARCHAR(100)        -- Course organization  
canvas_points_possible DECIMAL       -- Grade weight
canvas_html_url VARCHAR(500)         -- Direct Canvas link
```

### Flexible Session Management
```sql
-- Store conversation context as JSON
session_key VARCHAR(100)     -- 'waiting_for_token', 'creating_task'
session_value JSONB          -- {"title": "Math", "step": "date"}
```

### Subscription Tracking
```sql
-- Built-in premium subscription management
subscription_status VARCHAR(20)      -- 'free', 'premium', 'expired'
subscription_expires_at TIMESTAMP    -- Auto-expiry handling
monthly_task_count INTEGER          -- Free tier limits (5/month)
```

## 🔍 Understanding Your Schema

### User Journey Flow

```
1. New user messages bot
2. Record created in `users` table
3. Onboarding stored in `user_sessions` 
4. Canvas token collected → encrypted in `users.canvas_token`
5. Tasks synced from Canvas → stored in `tasks` table
6. Reminders auto-created → stored in `reminders` table
7. User activity tracked → `user_analytics` table
```

### Data Relationships

```
users (1) ──┬── (N) user_sessions   [Conversation state]
            ├── (N) tasks           [Assignments & manual tasks]  
            │     └── (N) reminders [Notification scheduling]
            ├── (N) canvas_sync_log [API monitoring]
            ├── (N) transactions    [Payment tracking]
            └── (N) user_analytics  [Usage metrics]
```

### Smart Automation Examples

```sql
-- When task created → reminders auto-created based on user tier
CREATE TRIGGER create_task_reminders_trigger 
AFTER INSERT ON tasks FOR EACH ROW 
EXECUTE FUNCTION create_task_reminders();

-- When task completed → analytics updated  
CREATE TRIGGER update_user_task_stats_trigger 
AFTER UPDATE ON tasks FOR EACH ROW 
EXECUTE FUNCTION update_user_task_stats();

-- Expired sessions auto-cleaned
DELETE FROM user_sessions WHERE expires_at < NOW();
```

## 💡 Why This Design?

### 🔐 Security First
- **Row-Level Security**: Database enforces user isolation
- **Encrypted Tokens**: Canvas access tokens stored securely  
- **GDPR Compliant**: Complete user data removal with CASCADE DELETE

### ⚡ Performance Optimized
- **Strategic Indexes**: Optimized for Messenger bot query patterns
- **Partial Indexes**: Only index active data (premium users, pending reminders)
- **JSONB Storage**: Flexible conversation state without performance loss

### 📈 Business Intelligence Ready
- **Analytics Built-in**: Track user engagement, feature adoption
- **Payment Tracking**: Full audit trail for subscription management
- **Canvas Monitoring**: API performance and sync reliability metrics

### 🛠️ Developer Friendly
- **Clear Naming**: Self-documenting table and column names
- **Flexible**: JSONB columns for evolving requirements  
- **Maintainable**: Built-in cleanup functions and monitoring queries

## 🚀 Deployment to Render

### Update Environment Variables

In Render, set these environment variables:

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_public_key
SUPABASE_SERVICE_KEY=your_service_role_secret

# Facebook Messenger (Required) 
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
VERIFY_TOKEN=your_webhook_verification_token

# Application (Required)
APP_ENV=production
DEBUG=false
SECRET_KEY=your-super-secret-key
```

### No Database Service Needed!
✅ **Supabase replaces PostgreSQL** - No need to create separate database service on Render
✅ **Cost Savings** - Supabase free tier vs Render database costs
✅ **Better Features** - Real-time, built-in auth, automatic backups

## 📊 Monitoring Your Database

### Supabase Dashboard
- **Table Editor**: View and edit data visually
- **SQL Editor**: Run custom queries and reports  
- **API Logs**: Monitor database performance
- **Auth**: Manage user access (if needed later)

### Common Monitoring Queries

```sql
-- User growth over time
SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as new_users
FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY day ORDER BY day;

-- Task completion rates
SELECT status, COUNT(*) as count, 
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks GROUP BY status;

-- Canvas sync health
SELECT status, COUNT(*) as syncs, AVG(duration_ms) as avg_duration
FROM canvas_sync_log WHERE sync_started_at >= NOW() - INTERVAL '7 days'
GROUP BY status;

-- Premium conversion rate
SELECT 
    COUNT(*) FILTER (WHERE subscription_status = 'premium') as premium_users,
    COUNT(*) as total_users,
    ROUND(COUNT(*) FILTER (WHERE subscription_status = 'premium') * 100.0 / COUNT(*), 2) as conversion_rate
FROM users;
```

## 🔧 Advanced Configuration

### Canvas Token Encryption
In production, encrypt Canvas tokens before storing:

```python
from cryptography.fernet import Fernet

# Generate key (store securely)
key = Fernet.generate_key()
cipher = Fernet(key)

# Encrypt before storing
encrypted_token = cipher.encrypt(canvas_token.encode())

# Store encrypted_token in database
update_user(facebook_id, {'canvas_token': encrypted_token.decode()})
```

### Rate Limiting Setup
Add rate limiting to prevent API abuse:

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
```

### Scheduled Tasks Setup
For production, set up scheduled tasks:

```python
# Cleanup expired sessions (run daily)
SELECT cleanup_old_data();

# Canvas sync for all users (run every 6 hours)
# Implement in your application

# Send pending reminders (run every 15 minutes) 
# Query reminders table for due notifications
```

## ❗ Important Notes

### Security
- **Never commit** your `SUPABASE_SERVICE_KEY` to version control
- **Use environment variables** for all sensitive data
- **Enable RLS policies** (done automatically by setup)

### Canvas Integration  
- **Encrypt Canvas tokens** in production
- **Implement proper error handling** for Canvas API failures
- **Respect Canvas API rate limits** (1000 requests/hour typical)

### Backup & Recovery
- **Supabase automatic backups**: 7 days retention (free tier)
- **Manual backups**: Use `pg_dump` for additional safety
- **Point-in-time recovery**: Available on Pro tier ($25/month)

## 🆘 Troubleshooting

### Common Issues

**Connection Failed**
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_KEY

# Test connection
python -c "from app.database.supabase_client import supabase_client; print('OK' if supabase_client.test_connection() else 'FAIL')"
```

**Schema Creation Failed**
```sql
-- Run manually in Supabase SQL Editor
-- Copy contents of supabase_schema_detailed.sql
-- Execute section by section
```

**Permission Denied**
- Verify `SUPABASE_SERVICE_KEY` has admin permissions
- Check if project is active and accessible

### Getting Help

1. **Check logs** in Supabase dashboard
2. **Review setup script** output for error details  
3. **Test individual components** using provided validation queries
4. **Manual setup** using SQL Editor if automated setup fails

## 🎯 Next Steps

1. **✅ Database is ready** - Your schema is production-ready
2. **🤖 Deploy your bot** - Use Render with Supabase environment variables  
3. **📱 Test end-to-end** - Create test user, add task, verify reminders
4. **📊 Monitor usage** - Use Supabase dashboard and monitoring queries
5. **🚀 Scale up** - Upgrade Supabase plan as you grow

Your EaselyBot now has a **professional, scalable database** that can handle thousands of users while maintaining **security, performance, and reliability**! 🎉
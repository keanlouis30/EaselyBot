# Setup Logging Tables for EaselyBot

## Issue
The bot's new comprehensive logging system requires additional database tables that don't exist in your current Supabase schema. You'll see errors like:
```
Could not find the table 'public.webhook_logs' in the schema cache
```

## Quick Fix

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** 
3. Copy and paste the entire contents of `add_logging_tables.sql`
4. Click **Run** to execute the SQL

### Option 2: psql Command Line
If you have psql installed and your Supabase connection string:
```bash
psql "your-supabase-connection-string" -f add_logging_tables.sql
```

## Tables Being Added

### Core Logging Tables
- **`message_logs`** - All user messages and bot responses
- **`webhook_logs`** - Complete webhook event processing logs  
- **`conversation_states`** - User conversation state transitions
- **`bot_actions`** - Bot response actions and API calls
- **`user_analytics`** - Key user behavior events

### Analytics Views
- **`user_activity_summary`** - User engagement overview
- **`conversation_flow_analysis`** - User journey analysis
- **`bot_performance_summary`** - Bot performance metrics

## Verification
After running the SQL, you can verify the tables exist by running:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('message_logs', 'webhook_logs', 'conversation_states', 'bot_actions', 'user_analytics');
```

You should see all 5 tables listed.

## What This Enables
Once the tables are created, your bot will automatically start:
- ✅ Logging all user interactions
- ✅ Tracking conversation flows
- ✅ Recording bot performance metrics
- ✅ Building analytics for user behavior
- ✅ Providing debugging information for issues

## Testing
After adding the tables, try interacting with your bot again. The logging errors should disappear and you'll start seeing comprehensive logging data in your Supabase tables.
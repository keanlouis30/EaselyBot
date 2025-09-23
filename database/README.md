# EaselyBot Database Setup Guide

## Overview
This directory contains the database schema for EaselyBot using Supabase (PostgreSQL). The schema replaces the in-memory storage with persistent database storage.

## Quick Start

### 1. Create a Supabase Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project (free tier is sufficient)
3. Save your project URL and anon/service keys

### 2. Run the Schema
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Create a new query
4. Copy the entire contents of `schema.sql`
5. Paste and run the query
6. You should see "Success. No rows returned" message

### 3. Configure Environment Variables
Add these to your `.env` file:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key  # For server-side operations
```

## Database Tables

### Core Tables
- **users** - Facebook Messenger users and Canvas integration
- **tasks** - Canvas assignments and user-created tasks
- **courses** - Canvas courses for each user
- **user_sessions** - Temporary conversation flows
- **reminders** - Scheduled task reminders

### Supporting Tables
- **activity_log** - User interaction history
- **broadcast_messages** - Broadcast message history
- **feedback** - Bug reports and feature requests

## Key Features

### 1. Automatic Timestamps
All tables have `created_at` and `updated_at` fields that auto-update.

### 2. UUID Primary Keys
Using UUIDs instead of serial IDs for better distributed system compatibility.

### 3. Row Level Security (RLS)
RLS is enabled but policies need to be configured based on your auth method.

### 4. Helper Functions
- `get_tasks_due_today(user_id)` - Get tasks due today (Manila timezone)
- `get_overdue_tasks(user_id, max_days)` - Get overdue tasks
- `cleanup_expired_sessions()` - Clean expired sessions

### 5. Indexes
Optimized indexes for common query patterns:
- User lookups by sender_id
- Tasks by due date
- Active sessions
- Unsent reminders

## Migration from In-Memory Storage

### Step 1: Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### Step 2: Create Database Service
Create `database/db.js`:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
```

### Step 3: Update User Functions
Replace in-memory Maps with database calls:

```javascript
// Old (in-memory)
function getUser(senderId) {
  return users.get(senderId) || null;
}

// New (database)
async function getUser(senderId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('sender_id', senderId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user:', error);
  }
  return data || null;
}
```

### Step 4: Update Task Management
```javascript
// Create task in database
async function createTask(userId, taskData) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: taskData.title,
      description: taskData.description,
      due_date: taskData.dueDate,
      course_name: taskData.courseName,
      is_manual: true,
      canvas_type: taskData.canvasType,
      canvas_id: taskData.canvasId
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }
  return data;
}
```

## Security Considerations

### 1. Canvas Token Encryption
⚠️ **Important**: Canvas tokens should be encrypted before storage!

Install encryption library:
```bash
npm install crypto-js
```

Example encryption:
```javascript
const CryptoJS = require('crypto-js');

function encryptToken(token) {
  return CryptoJS.AES.encrypt(token, process.env.ENCRYPTION_KEY).toString();
}

function decryptToken(encryptedToken) {
  const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

### 2. Row Level Security
For production, implement RLS policies:
```sql
-- Only bot service can access all data
CREATE POLICY "Service role has full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Similar policies for other tables
```

### 3. API Rate Limiting
Consider implementing rate limiting for database queries to prevent abuse.

## Maintenance

### Regular Tasks
1. **Clean expired sessions**: Run periodically
   ```sql
   SELECT cleanup_expired_sessions();
   ```

2. **Monitor table sizes**: Check in Supabase dashboard under Database > Tables

3. **Backup data**: Supabase provides automatic backups on paid plans

### Performance Monitoring
- Use Supabase dashboard's **Database** tab to monitor:
  - Query performance
  - Table sizes
  - Index usage
  - Slow queries

## Troubleshooting

### Common Issues

1. **"relation does not exist"**
   - Make sure you ran the schema.sql file
   - Check you're in the correct schema (public)

2. **"permission denied"**
   - Check your Supabase keys are correct
   - Ensure you're using the service key for server operations

3. **Slow queries**
   - Check indexes are being used (EXPLAIN ANALYZE)
   - Consider adding composite indexes for complex queries

4. **Timezone issues**
   - Database uses UTC internally
   - Functions handle Manila timezone conversion
   - Always store timestamps in UTC

## Next Steps

1. **Implement database service layer** in your Node.js app
2. **Migrate existing user data** if any
3. **Set up scheduled jobs** for reminders
4. **Configure RLS policies** based on your security needs
5. **Set up monitoring** and alerts

## Support

For Supabase-specific issues:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)

For EaselyBot database schema issues:
- Check this README
- Review the schema.sql comments
- Contact the development team

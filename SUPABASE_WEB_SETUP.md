# 🌐 EaselyBot Database Setup Using Supabase Website

This guide shows you how to set up your EaselyBot database using **only the Supabase website** - no command line needed!

## 🚀 **Step 1: Create Supabase Project** (2 minutes)

### **A. Go to Supabase Dashboard**
1. Visit [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in or create account (free)
3. Click "**New Project**"

### **B. Fill Project Details**
- **Organization**: Select your organization (or create one)
- **Name**: `easely-bot` 
- **Database Password**: Choose a **strong password** (save it!)
- **Region**: Choose closest to your location
- **Plan**: Select "**Free**" (perfect for getting started)

### **C. Create & Wait**
- Click "**Create new project**"
- ⏳ **Wait 2-3 minutes** for project setup
- You'll see a progress indicator

---

## 🗄️ **Step 2: Set Up Database Schema** (5 minutes)

### **A. Open SQL Editor**
1. In your project dashboard, click "**SQL Editor**" (left sidebar)
2. Click "**+ New Query**" 
3. You'll see a text editor

### **B. Copy & Paste Schema**

**Option 1: Use Complete Schema (Recommended)**
1. Open the file `supabase_schema_detailed.sql` from your project
2. **Copy ALL the content** (it's long - 690 lines!)
3. **Paste it** into the SQL Editor
4. Click "**Run**" (bottom right)
5. ⏳ Wait 30-60 seconds for execution

**Option 2: Use Simplified Schema (Quick)**
Copy and paste this shorter version:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) UNIQUE NOT NULL,
    canvas_token TEXT,
    canvas_url VARCHAR(500),
    canvas_user_id VARCHAR(50),
    last_canvas_sync TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    notifications_enabled BOOLEAN DEFAULT true,
    subscription_status VARCHAR(20) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    monthly_task_count INTEGER DEFAULT 0,
    last_task_count_reset DATE DEFAULT CURRENT_DATE,
    onboarding_completed BOOLEAN DEFAULT false,
    privacy_policy_accepted BOOLEAN DEFAULT false,
    terms_accepted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User sessions for conversation state
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    session_key VARCHAR(100) NOT NULL,
    session_value JSONB,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(facebook_id, session_key)
);

-- 3. Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    task_type VARCHAR(20) DEFAULT 'manual',
    priority VARCHAR(10) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    canvas_assignment_id VARCHAR(100),
    canvas_course_id VARCHAR(100),
    course_name VARCHAR(200),
    completion_percentage INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Reminders table
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_type VARCHAR(20) NOT NULL,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Canvas sync log
CREATE TABLE canvas_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    sync_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    assignments_fetched INTEGER DEFAULT 0,
    error_message TEXT,
    sync_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_completed_at TIMESTAMP WITH TIME ZONE
);

-- 6. Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payment_provider VARCHAR(20) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    subscription_months INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 7. User analytics
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    canvas_syncs INTEGER DEFAULT 0,
    reminders_received INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(facebook_id, date)
);

-- Performance indexes
CREATE INDEX idx_users_facebook_id ON users(facebook_id);
CREATE INDEX idx_user_sessions_facebook_id ON user_sessions(facebook_id);
CREATE INDEX idx_tasks_facebook_id ON tasks(facebook_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_reminders_task_id ON reminders(task_id);
CREATE INDEX idx_reminders_time ON reminders(reminder_time);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (users can only access their own data)
CREATE POLICY user_isolation_policy ON users
    USING (facebook_id = current_setting('app.current_user', true));

CREATE POLICY user_sessions_isolation_policy ON user_sessions
    USING (facebook_id = current_setting('app.current_user', true));

CREATE POLICY tasks_isolation_policy ON tasks
    USING (facebook_id = current_setting('app.current_user', true));

CREATE POLICY canvas_sync_isolation_policy ON canvas_sync_log
    USING (facebook_id = current_setting('app.current_user', true));

CREATE POLICY transactions_isolation_policy ON transactions
    USING (facebook_id = current_setting('app.current_user', true));

CREATE POLICY analytics_isolation_policy ON user_analytics
    USING (facebook_id = current_setting('app.current_user', true));

-- Reminders policy (access through tasks)
CREATE POLICY reminders_isolation_policy ON reminders
    USING (EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = reminders.task_id 
        AND tasks.facebook_id = current_setting('app.current_user', true)
    ));
```

### **C. Run the SQL**
1. Click "**Run**" (bottom right corner)
2. You should see "**Success. No rows returned**" 
3. If you see errors, check if you copied the full schema

---

## ✅ **Step 3: Verify Your Database** (1 minute)

### **A. Check Tables Created**
1. Click "**Table Editor**" (left sidebar)
2. You should see **7 tables**:
   - ✅ `users`
   - ✅ `user_sessions` 
   - ✅ `tasks`
   - ✅ `reminders`
   - ✅ `canvas_sync_log`
   - ✅ `transactions`
   - ✅ `user_analytics`

### **B. Test With Sample Data**
1. Click on the `users` table
2. Click "**+ Insert row**"
3. Fill in:
   - `facebook_id`: `test_user_123`
   - `subscription_status`: `premium`
   - Leave other fields as default
4. Click "**Save**"
5. You should see your test user appear!

---

## 🔑 **Step 4: Get Your API Keys** (1 minute)

### **A. Go to Settings**
1. Click "**Settings**" (left sidebar)
2. Click "**API**" 

### **B. Copy Your Keys**
Copy these **3 important values**:

1. **URL** (something like `https://abcdefghij.supabase.co`)
2. **anon public** key (long string starting with `eyJhbG...`)
3. **service_role secret** key (long string starting with `eyJhbG...`)

### **C. Save Them Securely**
```bash
# Add these to your .env file or save them somewhere safe
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_public_key_here
SUPABASE_SERVICE_KEY=your_service_role_secret_here
```

---

## 🎯 **What You've Accomplished**

### ✅ **Production-Ready Database**
Your database now has:
- **User management** with Canvas integration
- **Task storage** for assignments and manual tasks
- **Smart reminder system** with free/premium tiers
- **Payment tracking** for subscriptions
- **Analytics** for monitoring bot usage
- **Security** with Row-Level Security enabled

### ✅ **Visual Database Management** 
You can now:
- **View data** in Table Editor (like Excel for your database)
- **Run queries** in SQL Editor  
- **Monitor usage** in the dashboard
- **See real-time updates** as your bot runs

### ✅ **Ready for Your Bot**
Your EaselyBot can now:
- Store user profiles and Canvas tokens
- Track conversation state during onboarding
- Save tasks from Canvas and manual input
- Schedule and send reminders
- Process premium subscriptions
- Monitor performance and errors

---

## 🚀 **Next Steps**

### **1. Update Your Bot Code**
Add these environment variables to your deployment:

```bash
# In Render or your deployment platform
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_public_key  # Note: Use anon key, not service key for app
```

### **2. Test Your Bot**
Your bot should now be able to:
- Save new users who message it
- Store Canvas tokens during onboarding
- Create and manage tasks
- Send reminders

### **3. Monitor Your Database**
- Use **Table Editor** to see users and tasks being created
- Check **SQL Editor** for custom queries
- Monitor **API** section for usage statistics

---

## 🆘 **Troubleshooting**

### **❌ SQL Errors**
- **Error: "extension uuid-ossp does not exist"**
  - Solution: Make sure the first line `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` ran successfully

- **Error: "relation already exists"**  
  - Solution: This is OK! It means tables are already created

- **Error: "permission denied"**
  - Solution: Make sure you're logged into the correct Supabase project

### **❌ No Tables Visible**
- Refresh the page
- Check if SQL ran successfully (should show "Success" message)
- Try running the simplified schema instead of the full one

### **❌ Can't Connect from Bot**
- Double-check your `SUPABASE_URL` and `SUPABASE_KEY`  
- Make sure you're using the `anon public` key, not the `service_role` key for your bot
- Verify the URL doesn't have extra spaces or characters

---

## 🎉 **You're Done!**

Congratulations! You've successfully set up a **professional, production-ready database** for your EaselyBot using just the Supabase website. 

Your database can now handle:
- ✅ **Thousands of users**
- ✅ **Canvas LMS integration** 
- ✅ **Premium subscriptions**
- ✅ **Smart reminders**
- ✅ **Analytics and monitoring**

**No command line needed** - everything managed through the beautiful Supabase dashboard! 🚀
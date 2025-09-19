-- =====================================================
-- EASELY BOT SUPABASE DATABASE SCHEMA
-- Comprehensive schema for Facebook Messenger Bot
-- Canvas LMS Integration with Premium Features
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- 1. USERS TABLE - Core User Management
-- =====================================================
-- Purpose: Store user profiles, preferences, and subscription status
-- Primary Key: Facebook ID (since users authenticate via Messenger)
-- Features: Canvas integration, timezone support, premium subscriptions

CREATE TABLE users (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) UNIQUE NOT NULL, -- Facebook User ID (primary identifier)
    
    -- Canvas LMS Integration
    canvas_token TEXT, -- Encrypted Canvas access token
    canvas_url VARCHAR(500), -- User's Canvas instance URL
    canvas_user_id VARCHAR(50), -- Canvas internal user ID
    last_canvas_sync TIMESTAMP WITH TIME ZONE, -- When we last synced with Canvas
    canvas_sync_enabled BOOLEAN DEFAULT true,
    
    -- User Preferences
    timezone VARCHAR(50) DEFAULT 'UTC', -- User's timezone for scheduling
    notifications_enabled BOOLEAN DEFAULT true, -- Master notification toggle
    reminder_preferences JSONB DEFAULT '{"free": ["1d"], "premium": ["1w","3d","1d","8h","2h","1h"]}', -- Reminder intervals
    
    -- Premium Subscription Management
    subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium', 'expired', 'cancelled')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE, -- When premium expires
    subscription_start_date TIMESTAMP WITH TIME ZONE, -- When premium started
    monthly_task_count INTEGER DEFAULT 0, -- Track free tier usage (resets monthly)
    last_task_count_reset DATE DEFAULT CURRENT_DATE,
    
    -- User Engagement Analytics
    onboarding_completed BOOLEAN DEFAULT false,
    privacy_policy_accepted BOOLEAN DEFAULT false,
    terms_accepted BOOLEAN DEFAULT false,
    first_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_messages_sent INTEGER DEFAULT 0,
    total_tasks_created INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z_/]+$'),
    CONSTRAINT valid_subscription_dates CHECK (
        subscription_expires_at IS NULL OR 
        subscription_start_date IS NULL OR 
        subscription_expires_at > subscription_start_date
    )
);

-- Indexes for users table
CREATE INDEX idx_users_facebook_id ON users(facebook_id);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_users_subscription_expires ON users(subscription_expires_at) WHERE subscription_expires_at IS NOT NULL;
CREATE INDEX idx_users_last_seen ON users(last_seen);
CREATE INDEX idx_users_canvas_sync ON users(last_canvas_sync) WHERE canvas_sync_enabled = true;

-- =====================================================
-- 2. USER SESSIONS TABLE - Conversation State Management
-- =====================================================
-- Purpose: Track conversation flow and temporary data during user interactions
-- Features: Automatic expiration, conversation context, form data storage

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    
    -- Session Management
    session_key VARCHAR(100) NOT NULL, -- e.g., 'waiting_for_token', 'creating_task', 'onboarding_step'
    session_value JSONB, -- Flexible storage for conversation data
    
    -- Expiration Management
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one session per user per key
    UNIQUE(facebook_id, session_key)
);

-- Indexes for user_sessions table
CREATE INDEX idx_user_sessions_facebook_id ON user_sessions(facebook_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_key ON user_sessions(session_key);

-- Auto-cleanup trigger for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. TASKS TABLE - Assignment and Task Management
-- =====================================================
-- Purpose: Store both Canvas assignments and manually created tasks
-- Features: Due date tracking, priority levels, completion status, Canvas sync

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    
    -- Task Basic Information
    title VARCHAR(500) NOT NULL, -- Assignment/task title
    description TEXT, -- Detailed description or instructions
    
    -- Task Scheduling
    due_date TIMESTAMP WITH TIME ZONE NOT NULL, -- When the task is due
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estimated_duration INTEGER, -- Estimated minutes to complete
    
    -- Task Classification
    task_type VARCHAR(20) DEFAULT 'manual' CHECK (task_type IN ('manual', 'canvas', 'imported')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
    
    -- Canvas Integration
    canvas_assignment_id VARCHAR(100), -- Canvas assignment ID for sync
    canvas_course_id VARCHAR(100), -- Canvas course ID
    course_name VARCHAR(200), -- Human-readable course name
    canvas_points_possible DECIMAL(10,2), -- Assignment points
    canvas_submission_types TEXT[], -- Array of submission types
    canvas_html_url VARCHAR(500), -- Direct link to Canvas assignment
    
    -- Task Management Features
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT, -- User's personal notes about the task
    tags TEXT[], -- User-defined tags for organization
    
    -- Reminder Management
    reminder_sent BOOLEAN DEFAULT false,
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Business logic constraints
    CONSTRAINT valid_completion CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status != 'completed' AND completed_at IS NULL)
    ),
    CONSTRAINT valid_canvas_assignment CHECK (
        (task_type = 'canvas' AND canvas_assignment_id IS NOT NULL) OR
        (task_type != 'canvas')
    )
);

-- Indexes for tasks table
CREATE INDEX idx_tasks_facebook_id ON tasks(facebook_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(task_type);
CREATE INDEX idx_tasks_canvas_assignment ON tasks(canvas_assignment_id) WHERE canvas_assignment_id IS NOT NULL;
CREATE INDEX idx_tasks_course ON tasks(canvas_course_id) WHERE canvas_course_id IS NOT NULL;
CREATE INDEX idx_tasks_overdue ON tasks(due_date, status) WHERE status = 'pending' AND due_date < NOW();
CREATE INDEX idx_tasks_reminders ON tasks(due_date, reminder_sent) WHERE status = 'pending' AND reminder_sent = false;

-- =====================================================
-- 4. REMINDERS TABLE - Notification Scheduling
-- =====================================================
-- Purpose: Schedule and track reminder notifications
-- Features: Multiple reminders per task, different intervals for free/premium

CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- Reminder Scheduling
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL, -- When to send the reminder
    reminder_type VARCHAR(20) NOT NULL, -- '1w', '3d', '1d', '8h', '2h', '1h', 'overdue'
    
    -- Delivery Management
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
    failure_reason TEXT, -- If delivery failed, why?
    retry_count INTEGER DEFAULT 0,
    
    -- Reminder Content (can be customized)
    message_template TEXT, -- Custom reminder message
    urgency_level VARCHAR(10) DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Business logic constraints
    CONSTRAINT valid_sent_status CHECK (
        (sent = true AND sent_at IS NOT NULL) OR
        (sent = false AND sent_at IS NULL)
    )
);

-- Indexes for reminders table
CREATE INDEX idx_reminders_task_id ON reminders(task_id);
CREATE INDEX idx_reminders_time ON reminders(reminder_time);
CREATE INDEX idx_reminders_pending ON reminders(reminder_time, sent) WHERE sent = false AND delivery_status = 'pending';
CREATE INDEX idx_reminders_type ON reminders(reminder_type);

-- =====================================================
-- 5. CANVAS_SYNC_LOG TABLE - Integration Monitoring
-- =====================================================
-- Purpose: Track Canvas API synchronization attempts and results
-- Features: Error logging, performance monitoring, sync history

CREATE TABLE canvas_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    
    -- Sync Operation Details
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'single_course', 'single_assignment')),
    sync_trigger VARCHAR(30) DEFAULT 'manual' CHECK (sync_trigger IN ('manual', 'scheduled', 'webhook', 'user_request')),
    
    -- Sync Results
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'timeout')),
    assignments_fetched INTEGER DEFAULT 0,
    assignments_created INTEGER DEFAULT 0,
    assignments_updated INTEGER DEFAULT 0,
    assignments_deleted INTEGER DEFAULT 0,
    
    -- Performance Metrics
    sync_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER, -- Sync duration in milliseconds
    
    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(50),
    canvas_rate_limit_hit BOOLEAN DEFAULT false,
    retry_attempt INTEGER DEFAULT 0,
    
    -- API Details
    canvas_api_calls_made INTEGER DEFAULT 0,
    canvas_response_data JSONB, -- Store API response for debugging
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for canvas_sync_log table
CREATE INDEX idx_canvas_sync_facebook_id ON canvas_sync_log(facebook_id);
CREATE INDEX idx_canvas_sync_status ON canvas_sync_log(status);
CREATE INDEX idx_canvas_sync_started ON canvas_sync_log(sync_started_at);
CREATE INDEX idx_canvas_sync_type ON canvas_sync_log(sync_type);
CREATE INDEX idx_canvas_sync_errors ON canvas_sync_log(status, error_code) WHERE status = 'failed';

-- =====================================================
-- 6. TRANSACTIONS TABLE - Payment and Subscription Management
-- =====================================================
-- Purpose: Track premium subscription payments and Ko-fi transactions
-- Features: Multiple payment providers, refund tracking, subscription linking

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    
    -- Transaction Identification
    transaction_id VARCHAR(100) UNIQUE NOT NULL, -- External payment ID
    payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('kofi', 'stripe', 'paypal', 'manual')),
    payment_provider_fee_cents INTEGER DEFAULT 0,
    
    -- Payment Details
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,6) DEFAULT 1.0, -- For non-USD currencies
    
    -- Subscription Details
    subscription_months INTEGER DEFAULT 1 CHECK (subscription_months > 0),
    subscription_type VARCHAR(20) DEFAULT 'premium' CHECK (subscription_type IN ('premium', 'premium_plus', 'lifetime')),
    
    -- Transaction Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed', 'cancelled')),
    
    -- Timeline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment Provider Data
    webhook_data JSONB, -- Raw webhook data from payment provider
    customer_email VARCHAR(255), -- Email from payment provider
    customer_name VARCHAR(255), -- Name from payment provider
    
    -- Refund Management
    refund_reason TEXT,
    refund_amount_cents INTEGER,
    refund_transaction_id VARCHAR(100),
    
    -- Business Intelligence
    utm_source VARCHAR(100), -- Marketing attribution
    utm_campaign VARCHAR(100),
    utm_medium VARCHAR(100),
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Business logic constraints
    CONSTRAINT valid_completion CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status != 'completed')
    ),
    CONSTRAINT valid_refund CHECK (
        (status = 'refunded' AND refunded_at IS NOT NULL AND refund_amount_cents IS NOT NULL) OR
        (status != 'refunded')
    )
);

-- Indexes for transactions table
CREATE INDEX idx_transactions_facebook_id ON transactions(facebook_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_provider ON transactions(payment_provider);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_external_id ON transactions(transaction_id);

-- =====================================================
-- 7. USER_ANALYTICS TABLE - Usage Analytics and Insights
-- =====================================================
-- Purpose: Track user engagement, feature usage, and bot performance metrics
-- Features: Daily/weekly/monthly aggregations, feature adoption tracking

CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    
    -- Time Period
    date DATE NOT NULL,
    week_of_year INTEGER, -- ISO week number
    month_year VARCHAR(7), -- Format: YYYY-MM
    
    -- Message Analytics
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    session_duration_minutes INTEGER DEFAULT 0,
    
    -- Feature Usage
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    canvas_syncs INTEGER DEFAULT 0,
    reminders_received INTEGER DEFAULT 0,
    
    -- User Journey
    onboarding_steps_completed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    help_requests INTEGER DEFAULT 0,
    
    -- Engagement Metrics
    quick_replies_used INTEGER DEFAULT 0,
    menu_interactions INTEGER DEFAULT 0,
    deep_link_clicks INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per user per date
    UNIQUE(facebook_id, date)
);

-- Indexes for user_analytics table
CREATE INDEX idx_analytics_facebook_id ON user_analytics(facebook_id);
CREATE INDEX idx_analytics_date ON user_analytics(date);
CREATE INDEX idx_analytics_week ON user_analytics(week_of_year);
CREATE INDEX idx_analytics_month ON user_analytics(month_year);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- 1. Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_analytics_updated_at BEFORE UPDATE ON user_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Auto-update task status based on due date
CREATE OR REPLACE FUNCTION update_task_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark overdue tasks
    IF NEW.due_date < NOW() AND NEW.status = 'pending' THEN
        NEW.status = 'overdue';
    END IF;
    
    -- Set completion timestamp
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
        NEW.completion_percentage = 100;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_status_trigger BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_task_status();

-- 3. Auto-create reminders for new tasks
CREATE OR REPLACE FUNCTION create_task_reminders()
RETURNS TRIGGER AS $$
DECLARE
    user_record users%ROWTYPE;
    reminder_intervals TEXT[];
    interval_text TEXT;
    reminder_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get user subscription status
    SELECT * INTO user_record FROM users WHERE facebook_id = NEW.facebook_id;
    
    -- Determine reminder intervals based on subscription
    IF user_record.subscription_status = 'premium' THEN
        reminder_intervals := ARRAY['7 days', '3 days', '1 day', '8 hours', '2 hours', '1 hour'];
    ELSE
        reminder_intervals := ARRAY['1 day'];
    END IF;
    
    -- Create reminders
    FOREACH interval_text IN ARRAY reminder_intervals
    LOOP
        reminder_time := NEW.due_date - CAST(interval_text AS INTERVAL);
        
        -- Only create reminders for future times
        IF reminder_time > NOW() THEN
            INSERT INTO reminders (task_id, reminder_time, reminder_type)
            VALUES (NEW.id, reminder_time, 
                CASE interval_text
                    WHEN '7 days' THEN '1w'
                    WHEN '3 days' THEN '3d'
                    WHEN '1 day' THEN '1d'
                    WHEN '8 hours' THEN '8h'
                    WHEN '2 hours' THEN '2h'
                    WHEN '1 hour' THEN '1h'
                END
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_task_reminders_trigger AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION create_task_reminders();

-- 4. Update user statistics on task creation/completion
CREATE OR REPLACE FUNCTION update_user_task_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment task creation count
        UPDATE users SET 
            total_tasks_created = total_tasks_created + 1,
            monthly_task_count = CASE 
                WHEN last_task_count_reset = CURRENT_DATE THEN monthly_task_count + 1
                ELSE 1 
            END,
            last_task_count_reset = CURRENT_DATE
        WHERE facebook_id = NEW.facebook_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Track task completion
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            -- Update daily analytics
            INSERT INTO user_analytics (facebook_id, date, tasks_completed)
            VALUES (NEW.facebook_id, CURRENT_DATE, 1)
            ON CONFLICT (facebook_id, date) 
            DO UPDATE SET 
                tasks_completed = user_analytics.tasks_completed + 1,
                updated_at = NOW();
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_task_stats_trigger AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_user_task_stats();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS for data isolation and security

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
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

-- =====================================================
-- INITIAL DATA AND CONFIGURATIONS
-- =====================================================

-- Create indexes for full-text search on tasks
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Create partial indexes for common queries
CREATE INDEX idx_tasks_due_soon ON tasks(due_date, facebook_id) WHERE status IN ('pending', 'in_progress') AND due_date <= NOW() + INTERVAL '7 days';
CREATE INDEX idx_premium_users ON users(subscription_status, subscription_expires_at) WHERE subscription_status = 'premium';

-- =====================================================
-- UTILITY VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active premium users
CREATE VIEW active_premium_users AS
SELECT 
    facebook_id,
    subscription_status,
    subscription_expires_at,
    subscription_start_date,
    EXTRACT(DAYS FROM (subscription_expires_at - NOW())) AS days_until_expiry
FROM users 
WHERE subscription_status = 'premium' 
AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW());

-- View for overdue tasks
CREATE VIEW overdue_tasks AS
SELECT 
    t.*,
    u.timezone,
    u.notifications_enabled
FROM tasks t
JOIN users u ON t.facebook_id = u.facebook_id
WHERE t.status IN ('pending', 'in_progress')
AND t.due_date < NOW()
AND u.notifications_enabled = true;

-- View for upcoming reminders
CREATE VIEW upcoming_reminders AS
SELECT 
    r.*,
    t.title,
    t.due_date,
    u.timezone,
    u.notifications_enabled
FROM reminders r
JOIN tasks t ON r.task_id = t.id
JOIN users u ON t.facebook_id = u.facebook_id
WHERE r.sent = false
AND r.delivery_status = 'pending'
AND r.reminder_time <= NOW() + INTERVAL '1 hour'
AND u.notifications_enabled = true;

-- =====================================================
-- PERFORMANCE OPTIMIZATION
-- =====================================================

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE user_sessions;
ANALYZE tasks;
ANALYZE reminders;
ANALYZE canvas_sync_log;
ANALYZE transactions;
ANALYZE user_analytics;

-- =====================================================
-- MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to cleanup old data (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Cleanup expired sessions
    DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Cleanup old sync logs (keep last 90 days)
    DELETE FROM canvas_sync_log WHERE sync_started_at < NOW() - INTERVAL '90 days';
    
    -- Cleanup old analytics (keep last 2 years)
    DELETE FROM user_analytics WHERE date < CURRENT_DATE - INTERVAL '2 years';
    
    -- Mark old overdue tasks as cancelled (after 30 days overdue)
    UPDATE tasks SET status = 'cancelled' 
    WHERE status = 'overdue' 
    AND due_date < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEMA VALIDATION
-- =====================================================

-- Function to validate schema integrity
CREATE OR REPLACE FUNCTION validate_schema()
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
    -- Check required tables exist
    RETURN QUERY
    SELECT 
        'Required Tables'::TEXT,
        CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*) || ' of 7 required tables'::TEXT
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'user_sessions', 'tasks', 'reminders', 'canvas_sync_log', 'transactions', 'user_analytics');
    
    -- Check indexes exist
    RETURN QUERY
    SELECT 
        'Required Indexes'::TEXT,
        CASE WHEN COUNT(*) >= 20 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*) || ' indexes'::TEXT
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    -- Check triggers exist
    RETURN QUERY
    SELECT 
        'Required Triggers'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*) || ' triggers'::TEXT
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================

-- Log schema creation
DO $$
BEGIN
    RAISE NOTICE 'EaselyBot Supabase schema created successfully at %', NOW();
    RAISE NOTICE 'Schema includes: Users, Sessions, Tasks, Reminders, Canvas Sync, Transactions, Analytics';
    RAISE NOTICE 'Total tables: 7, Total indexes: 20+, Total triggers: 5+';
    RAISE NOTICE 'RLS enabled for data security';
    RAISE NOTICE 'Run SELECT * FROM validate_schema() to verify installation';
END $$;
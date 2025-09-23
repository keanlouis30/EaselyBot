-- ============================================
-- EaselyBot Supabase Database Schema
-- ============================================
-- This schema supports persistent storage for the EaselyBot Facebook Messenger
-- Canvas LMS integration, replacing the in-memory storage with a proper database.

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
-- Stores Facebook Messenger users and their Canvas integration details
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id VARCHAR(255) UNIQUE NOT NULL, -- Facebook Messenger sender ID
    is_onboarded BOOLEAN DEFAULT FALSE,
    canvas_token TEXT, -- Encrypted Canvas API token
    canvas_user_id INTEGER, -- Canvas user ID
    canvas_user_name VARCHAR(255), -- Canvas user display name
    canvas_user_email VARCHAR(255), -- Canvas user email
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    agreed_privacy BOOLEAN DEFAULT FALSE,
    agreed_terms BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE, -- Last time assignments were synced
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    INDEX idx_users_sender_id (sender_id),
    INDEX idx_users_subscription (subscription_tier)
);

-- ============================================
-- COURSES TABLE
-- ============================================
-- Stores Canvas courses for each user
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    canvas_course_id INTEGER NOT NULL,
    course_name VARCHAR(500) NOT NULL,
    course_code VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    enrollment_type VARCHAR(50), -- student, teacher, ta, observer, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique course per user
    UNIQUE(user_id, canvas_course_id),
    INDEX idx_courses_user_id (user_id),
    INDEX idx_courses_canvas_id (canvas_course_id)
);

-- ============================================
-- TASKS TABLE
-- ============================================
-- Stores both Canvas assignments and user-created tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    
    -- Canvas integration fields
    canvas_id VARCHAR(100), -- Canvas assignment/planner_note/calendar_event ID
    canvas_type VARCHAR(50) CHECK (canvas_type IN ('assignment', 'planner_note', 'calendar_event')),
    canvas_course_id INTEGER, -- Direct Canvas course ID reference
    
    -- Task details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    due_date_text VARCHAR(255), -- Human-readable due date for display
    
    -- Task metadata
    course_name VARCHAR(500), -- Denormalized for quick access
    points_possible DECIMAL(10, 2),
    submission_types TEXT[], -- Array of submission types
    html_url TEXT, -- Canvas URL for the task
    
    -- Task status
    is_manual BOOLEAN DEFAULT FALSE, -- TRUE if user-created, FALSE if from Canvas
    is_completed BOOLEAN DEFAULT FALSE,
    has_submitted BOOLEAN DEFAULT FALSE, -- For Canvas assignments
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    INDEX idx_tasks_user_id (user_id),
    INDEX idx_tasks_due_date (due_date),
    INDEX idx_tasks_canvas_id (canvas_id),
    INDEX idx_tasks_is_manual (is_manual),
    INDEX idx_tasks_user_due (user_id, due_date)
);

-- ============================================
-- USER_SESSIONS TABLE
-- ============================================
-- Stores temporary conversation flows and multi-step interactions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL, -- 'add_task', 'report_problem', 'feature_request', etc.
    session_data JSONB NOT NULL DEFAULT '{}', -- Flexible JSON storage for session state
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    
    -- Only one active session per user
    UNIQUE(user_id, is_active) WHERE is_active = TRUE,
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_expires (expires_at)
);

-- ============================================
-- REMINDERS TABLE
-- ============================================
-- Stores reminder schedules for tasks
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_type VARCHAR(50) NOT NULL, -- '1_week', '3_days', '1_day', '8_hours', '2_hours', '1_hour'
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate reminders
    UNIQUE(task_id, reminder_type),
    INDEX idx_reminders_time (reminder_time),
    INDEX idx_reminders_user_id (user_id),
    INDEX idx_reminders_is_sent (is_sent)
);

-- ============================================
-- ACTIVITY_LOG TABLE
-- ============================================
-- Stores user interactions for analytics and debugging
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_id VARCHAR(255), -- Keep sender_id even if user is deleted
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_activity_user_id (user_id),
    INDEX idx_activity_action (action),
    INDEX idx_activity_created (created_at)
);

-- ============================================
-- BROADCAST_MESSAGES TABLE
-- ============================================
-- Stores broadcast message history
CREATE TABLE IF NOT EXISTS broadcast_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_text TEXT NOT NULL,
    target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'premium', 'custom'
    target_user_ids TEXT[], -- Array of specific user IDs if custom
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',
    sent_by VARCHAR(255), -- Admin identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_broadcast_created (created_at)
);

-- ============================================
-- FEEDBACK TABLE
-- ============================================
-- Stores user feedback, bug reports, and feature requests
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_id VARCHAR(255),
    feedback_type VARCHAR(50) NOT NULL, -- 'bug_report', 'feature_request', 'general'
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'wont_fix'
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_feedback_status (status),
    INDEX idx_feedback_created (created_at)
);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get tasks due today for a user (Manila timezone)
CREATE OR REPLACE FUNCTION get_tasks_due_today(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    course_name VARCHAR(500),
    is_manual BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.course_name,
        t.is_manual
    FROM tasks t
    WHERE t.user_id = p_user_id
        AND t.due_date IS NOT NULL
        AND DATE(t.due_date AT TIME ZONE 'Asia/Manila') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
        AND t.is_completed = FALSE
    ORDER BY t.due_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get overdue tasks for a user
CREATE OR REPLACE FUNCTION get_overdue_tasks(p_user_id UUID, p_max_days_overdue INTEGER DEFAULT 300)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    course_name VARCHAR(500),
    days_overdue INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.course_name,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.due_date))::INTEGER as days_overdue
    FROM tasks t
    WHERE t.user_id = p_user_id
        AND t.due_date IS NOT NULL
        AND t.due_date < CURRENT_TIMESTAMP
        AND t.is_completed = FALSE
        AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.due_date)) <= p_max_days_overdue
    ORDER BY t.due_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Note: You'll need to create appropriate RLS policies based on your authentication method
-- For service-level access (your bot), you might use a service role that bypasses RLS
-- Example policies are commented out below:

-- -- Allow users to see only their own data
-- CREATE POLICY "Users can view own profile" ON users
--     FOR SELECT USING (auth.uid() = id);

-- CREATE POLICY "Users can view own tasks" ON tasks
--     FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Composite indexes for common query patterns
CREATE INDEX idx_tasks_user_date_manual ON tasks(user_id, due_date, is_manual);
CREATE INDEX idx_reminders_unsent ON reminders(reminder_time, is_sent) WHERE is_sent = FALSE;
CREATE INDEX idx_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- INITIAL DATA / SAMPLE DATA (Optional)
-- ============================================

-- You can add any initial configuration or sample data here
-- INSERT INTO users (sender_id, is_onboarded) VALUES ('test_user_1', false);

-- ============================================
-- GRANTS (Adjust based on your Supabase setup)
-- ============================================
-- Grant appropriate permissions to the authenticated and service roles
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE users IS 'Stores Facebook Messenger users and their Canvas integration details';
COMMENT ON TABLE tasks IS 'Stores both Canvas assignments and user-created tasks';
COMMENT ON TABLE user_sessions IS 'Temporary storage for multi-step conversation flows';
COMMENT ON TABLE reminders IS 'Scheduled reminders for tasks';
COMMENT ON TABLE activity_log IS 'User interaction history for analytics and debugging';
COMMENT ON TABLE broadcast_messages IS 'History of broadcast messages sent to users';
COMMENT ON TABLE feedback IS 'User feedback, bug reports, and feature requests';

COMMENT ON COLUMN users.sender_id IS 'Facebook Messenger sender ID - unique identifier from Facebook';
COMMENT ON COLUMN users.canvas_token IS 'Encrypted Canvas API token - should be encrypted before storage';
COMMENT ON COLUMN tasks.canvas_type IS 'Type of Canvas item: assignment, planner_note, or calendar_event';
COMMENT ON COLUMN tasks.is_manual IS 'TRUE if created by user via bot, FALSE if synced from Canvas';

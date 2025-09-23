-- ============================================
-- EaselyBot Supabase Database Schema (Fixed)
-- ============================================
-- Ready to paste into Supabase SQL Editor

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id VARCHAR(255) UNIQUE NOT NULL,
    is_onboarded BOOLEAN DEFAULT FALSE,
    canvas_token TEXT,
    canvas_user_id INTEGER,
    canvas_user_name VARCHAR(255),
    canvas_user_email VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    agreed_privacy BOOLEAN DEFAULT FALSE,
    agreed_terms BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_sender_id ON users(sender_id);
CREATE INDEX idx_users_subscription ON users(subscription_tier);

-- ============================================
-- COURSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    canvas_course_id INTEGER NOT NULL,
    course_name VARCHAR(500) NOT NULL,
    course_code VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    enrollment_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, canvas_course_id)
);

CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_courses_canvas_id ON courses(canvas_course_id);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    
    -- Canvas integration fields
    canvas_id VARCHAR(100),
    canvas_type VARCHAR(50) CHECK (canvas_type IN ('assignment', 'planner_note', 'calendar_event')),
    canvas_course_id INTEGER,
    
    -- Task details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    due_date_text VARCHAR(255),
    
    -- Task metadata
    course_name VARCHAR(500),
    points_possible DECIMAL(10, 2),
    submission_types TEXT[],
    html_url TEXT,
    
    -- Task status
    is_manual BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    has_submitted BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_canvas_id ON tasks(canvas_id);
CREATE INDEX idx_tasks_is_manual ON tasks(is_manual);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date);

-- ============================================
-- USER_SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL,
    session_data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

-- Create partial unique index for active sessions
CREATE UNIQUE INDEX idx_sessions_user_active ON user_sessions(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- REMINDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_type VARCHAR(50) NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, reminder_type)
);

CREATE INDEX idx_reminders_time ON reminders(reminder_time);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_is_sent ON reminders(is_sent);

-- ============================================
-- ACTIVITY_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_action ON activity_log(action);
CREATE INDEX idx_activity_created ON activity_log(created_at);

-- ============================================
-- BROADCAST_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS broadcast_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_text TEXT NOT NULL,
    target_audience VARCHAR(50) DEFAULT 'all',
    target_user_ids TEXT[],
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',
    sent_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_broadcast_created ON broadcast_messages(created_at);

-- ============================================
-- FEEDBACK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_id VARCHAR(255),
    feedback_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created ON feedback(created_at);

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

-- Function to get upcoming tasks for a user (next 7 days)
CREATE OR REPLACE FUNCTION get_upcoming_tasks(p_user_id UUID, p_days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    course_name VARCHAR(500),
    is_manual BOOLEAN,
    canvas_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.course_name,
        t.is_manual,
        t.canvas_type
    FROM tasks t
    WHERE t.user_id = p_user_id
        AND t.due_date IS NOT NULL
        AND t.due_date >= CURRENT_TIMESTAMP
        AND t.due_date <= CURRENT_TIMESTAMP + (p_days_ahead || ' days')::INTERVAL
        AND t.is_completed = FALSE
    ORDER BY t.due_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPOSITE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_tasks_user_date_manual ON tasks(user_id, due_date, is_manual);
CREATE INDEX idx_reminders_unsent ON reminders(reminder_time, is_sent) WHERE is_sent = FALSE;
CREATE INDEX idx_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS for all tables (policies to be added based on auth method)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TABLE COMMENTS FOR DOCUMENTATION
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

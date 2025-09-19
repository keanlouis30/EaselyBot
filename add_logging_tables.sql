-- =====================================================
-- EASELY BOT LOGGING TABLES - Add to existing schema
-- Missing tables for comprehensive logging system
-- =====================================================

-- =====================================================
-- MESSAGE LOGS TABLE - User Message Tracking
-- =====================================================
-- Purpose: Log all user messages and bot responses
CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL,
    
    -- Message Details
    message_type VARCHAR(20) NOT NULL, -- 'text', 'postback', 'quick_reply', 'attachment'
    message_content TEXT NOT NULL, -- User's message content or payload
    response_action VARCHAR(200), -- What action the bot took
    
    -- Event Context
    event_data JSONB, -- Full Facebook webhook event for debugging
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for message_logs table
CREATE INDEX idx_message_logs_facebook_id ON message_logs(facebook_id);
CREATE INDEX idx_message_logs_timestamp ON message_logs(timestamp);
CREATE INDEX idx_message_logs_type ON message_logs(message_type);

-- =====================================================
-- WEBHOOK LOGS TABLE - Webhook Event Processing
-- =====================================================
-- Purpose: Log webhook events for debugging and monitoring
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id VARCHAR(50) NOT NULL,
    
    -- Event Details
    event_type VARCHAR(50) NOT NULL, -- 'text_message', 'postback', 'quick_reply', etc.
    event_data JSONB NOT NULL, -- Complete webhook event data
    processing_status VARCHAR(20) NOT NULL, -- 'success', 'error', 'warning'
    error_message TEXT, -- Error details if processing failed
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for webhook_logs table
CREATE INDEX idx_webhook_logs_sender_id ON webhook_logs(sender_id);
CREATE INDEX idx_webhook_logs_timestamp ON webhook_logs(timestamp);
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(processing_status);

-- =====================================================
-- CONVERSATION STATES TABLE - Flow State Tracking
-- =====================================================
-- Purpose: Track user conversation state transitions
CREATE TABLE conversation_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL,
    
    -- State Transition Details
    previous_state VARCHAR(100), -- Previous conversation state
    new_state VARCHAR(100) NOT NULL, -- New conversation state
    trigger_action VARCHAR(200) NOT NULL, -- What caused the state change
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for conversation_states table
CREATE INDEX idx_conversation_states_facebook_id ON conversation_states(facebook_id);
CREATE INDEX idx_conversation_states_timestamp ON conversation_states(timestamp);
CREATE INDEX idx_conversation_states_new_state ON conversation_states(new_state);

-- =====================================================
-- BOT ACTIONS TABLE - Bot Response Tracking
-- =====================================================
-- Purpose: Log bot actions for performance monitoring
CREATE TABLE bot_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL,
    
    -- Action Details
    action_type VARCHAR(100) NOT NULL, -- 'send_message', 'api_call', 'task_created', etc.
    action_details JSONB, -- Specific details about the action
    success BOOLEAN NOT NULL DEFAULT true, -- Whether the action succeeded
    error_message TEXT, -- Error details if action failed
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bot_actions table
CREATE INDEX idx_bot_actions_facebook_id ON bot_actions(facebook_id);
CREATE INDEX idx_bot_actions_timestamp ON bot_actions(timestamp);
CREATE INDEX idx_bot_actions_type ON bot_actions(action_type);
CREATE INDEX idx_bot_actions_success ON bot_actions(success);

-- =====================================================
-- USER ANALYTICS TABLE - User Behavior Analytics
-- =====================================================
-- Purpose: Track key user events for analytics
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL,
    
    -- Event Details
    event_type VARCHAR(100) NOT NULL, -- 'session_start', 'token_validated', 'task_created', etc.
    event_data JSONB, -- Additional context for the event
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_analytics table
CREATE INDEX idx_user_analytics_facebook_id ON user_analytics(facebook_id);
CREATE INDEX idx_user_analytics_timestamp ON user_analytics(timestamp);
CREATE INDEX idx_user_analytics_event_type ON user_analytics(event_type);

-- =====================================================
-- CREATE VIEWS FOR EASY ANALYTICS QUERIES
-- =====================================================

-- User Activity Summary View
CREATE VIEW user_activity_summary AS
SELECT 
    u.facebook_id,
    u.subscription_status,
    u.created_at as user_created_at,
    COUNT(ml.id) as total_messages,
    COUNT(DISTINCT DATE(ml.timestamp)) as active_days,
    MAX(ml.timestamp) as last_message_time,
    COUNT(CASE WHEN ua.event_type = 'token_validated' THEN 1 END) as tokens_validated,
    COUNT(CASE WHEN ua.event_type = 'task_created' THEN 1 END) as tasks_created
FROM users u
LEFT JOIN message_logs ml ON u.facebook_id = ml.facebook_id
LEFT JOIN user_analytics ua ON u.facebook_id = ua.facebook_id
GROUP BY u.facebook_id, u.subscription_status, u.created_at;

-- Conversation Flow Analysis View
CREATE VIEW conversation_flow_analysis AS
SELECT 
    cs.facebook_id,
    cs.previous_state,
    cs.new_state,
    cs.trigger_action,
    COUNT(*) as transition_count,
    AVG(EXTRACT(EPOCH FROM (LEAD(cs.timestamp) OVER (PARTITION BY cs.facebook_id ORDER BY cs.timestamp) - cs.timestamp))) as avg_time_in_state_seconds
FROM conversation_states cs
GROUP BY cs.facebook_id, cs.previous_state, cs.new_state, cs.trigger_action;

-- Bot Performance Summary View
CREATE VIEW bot_performance_summary AS
SELECT 
    DATE(timestamp) as date,
    action_type,
    COUNT(*) as total_actions,
    COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_actions,
    ROUND(COUNT(CASE WHEN success = true THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as success_rate_percent
FROM bot_actions
GROUP BY DATE(timestamp), action_type
ORDER BY date DESC, total_actions DESC;

COMMENT ON TABLE message_logs IS 'Logs all user messages and bot responses for debugging and analytics';
COMMENT ON TABLE webhook_logs IS 'Logs Facebook webhook events for monitoring and debugging';
COMMENT ON TABLE conversation_states IS 'Tracks user conversation state transitions for flow analytics';
COMMENT ON TABLE bot_actions IS 'Logs bot actions and responses for performance monitoring';
COMMENT ON TABLE user_analytics IS 'Tracks key user behavior events for business analytics';
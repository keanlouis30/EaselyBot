-- =====================================================
-- FIX RLS POLICIES FOR LOGGING TABLES
-- =====================================================

-- Option 1: Disable RLS for logging tables (Recommended for logging)
-- Logging tables don't need user-level security since they're system logs

ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE bot_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics DISABLE ROW LEVEL SECURITY;

-- Option 2: If you prefer to keep RLS enabled, add permissive policies
-- (Uncomment these if you want to keep RLS but allow all operations)

/*
-- Enable RLS (if not already enabled)
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for logging tables
CREATE POLICY "Allow all operations on message_logs" ON message_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on webhook_logs" ON webhook_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on conversation_states" ON conversation_states FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on bot_actions" ON bot_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on user_analytics" ON user_analytics FOR ALL USING (true) WITH CHECK (true);
*/

-- Grant necessary permissions to authenticated and anon roles
GRANT ALL ON message_logs TO authenticated, anon;
GRANT ALL ON webhook_logs TO authenticated, anon;
GRANT ALL ON conversation_states TO authenticated, anon;
GRANT ALL ON bot_actions TO authenticated, anon;
GRANT ALL ON user_analytics TO authenticated, anon;

-- Grant usage on sequences (for auto-incrementing IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
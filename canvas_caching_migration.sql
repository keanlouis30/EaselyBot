-- =====================================================
-- CANVAS CACHING MIGRATION
-- Add missing fields needed for Canvas assignment caching
-- =====================================================

-- Add course_code field to tasks table
-- This stores the short course code (e.g., "MATH-101") alongside the full course name
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS course_code VARCHAR(50);

-- Add index for course_code for faster filtering
CREATE INDEX IF NOT EXISTS idx_tasks_course_code ON tasks(course_code) WHERE course_code IS NOT NULL;

-- Create aliases/views for the field naming differences
-- The caching code expects 'points_possible' but schema has 'canvas_points_possible'
-- The caching code expects 'html_url' but schema has 'canvas_html_url'

-- We'll handle this in the application code instead of changing the schema
-- This keeps the schema clean and consistent

-- Verify the tasks table has all required fields for caching
DO $$ 
BEGIN
    -- Check if all required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'canvas_assignment_id'
    ) THEN
        RAISE EXCEPTION 'Missing canvas_assignment_id column in tasks table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'course_name'
    ) THEN
        RAISE EXCEPTION 'Missing course_name column in tasks table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'canvas_points_possible'
    ) THEN
        RAISE EXCEPTION 'Missing canvas_points_possible column in tasks table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'canvas_html_url'
    ) THEN
        RAISE EXCEPTION 'Missing canvas_html_url column in tasks table';
    END IF;
    
    -- All good!
    RAISE NOTICE 'All required fields for Canvas caching are present!';
END $$;

-- =====================================================
-- CLEANUP FUNCTION FOR OLD CACHED ASSIGNMENTS
-- =====================================================
-- Function to clean up cached Canvas assignments older than X days
CREATE OR REPLACE FUNCTION cleanup_old_canvas_cache(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tasks 
    WHERE task_type = 'canvas' 
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old cached Canvas assignments', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Query to check current Canvas cache status
-- SELECT 
--     u.facebook_id,
--     u.last_canvas_sync,
--     COUNT(t.id) as cached_assignments,
--     MAX(t.created_at) as last_cache_update
-- FROM users u
-- LEFT JOIN tasks t ON u.facebook_id = t.facebook_id AND t.task_type = 'canvas'
-- WHERE u.canvas_token IS NOT NULL
-- GROUP BY u.facebook_id, u.last_canvas_sync
-- ORDER BY u.last_canvas_sync DESC;
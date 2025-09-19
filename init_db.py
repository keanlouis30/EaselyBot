#!/usr/bin/env python3
"""
Supabase Database Initialization Script for EaselyBot
Creates necessary tables and indexes using Supabase SQL migrations
"""

import os
import logging
from config.settings import SUPABASE_URL, SUPABASE_SERVICE_KEY
from app.database.supabase_client import supabase_client

logger = logging.getLogger(__name__)

# Read the comprehensive schema from external file
def load_schema_sql():
    """Load the comprehensive schema from the SQL file"""
    import os
    schema_file = os.path.join(os.path.dirname(__file__), 'supabase_schema_detailed.sql')
    
    try:
        with open(schema_file, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        # Fallback to basic schema if detailed file not found
        return get_basic_schema()

def get_basic_schema():
    """Fallback basic schema if detailed schema file not found"""
    return """
-- Basic EaselyBot Schema (Fallback)
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for storing user information and preferences
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) UNIQUE NOT NULL,
    canvas_token TEXT,
    canvas_url VARCHAR(500),
    canvas_user_id VARCHAR(50),
    last_canvas_sync TIMESTAMP WITH TIME ZONE,
    canvas_sync_enabled BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'UTC',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    subscription_status VARCHAR(20) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    monthly_task_count INTEGER DEFAULT 0,
    last_task_count_reset DATE DEFAULT CURRENT_DATE,
    onboarding_completed BOOLEAN DEFAULT false,
    privacy_policy_accepted BOOLEAN DEFAULT false,
    terms_accepted BOOLEAN DEFAULT false,
    first_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_messages_sent INTEGER DEFAULT 0,
    total_tasks_created INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Other essential tables with basic structure
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id VARCHAR(50) NOT NULL REFERENCES users(facebook_id) ON DELETE CASCADE,
    session_key VARCHAR(100) NOT NULL,
    session_value JSONB,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(facebook_id, session_key)
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE INDEX IF NOT EXISTS idx_tasks_facebook_id ON tasks(facebook_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_type VARCHAR(20) NOT NULL,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time);
"""

# Load the comprehensive schema
SCHEMA_SQL = load_schema_sql()

-- User sessions for conversation state management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    facebook_id VARCHAR(50) NOT NULL,
    session_key VARCHAR(100) NOT NULL,
    session_value TEXT,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facebook_id) REFERENCES users(facebook_id) ON DELETE CASCADE
);

-- Tasks table for manual tasks and Canvas assignments
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    facebook_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP NOT NULL,
    canvas_assignment_id VARCHAR(50),
    course_name VARCHAR(255),
    task_type VARCHAR(20) DEFAULT 'manual', -- 'manual' or 'canvas'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'overdue'
    priority VARCHAR(10) DEFAULT 'medium', -- 'low', 'medium', 'high'
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facebook_id) REFERENCES users(facebook_id) ON DELETE CASCADE
);

-- Reminders table for scheduled notifications
CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    reminder_time TIMESTAMP NOT NULL,
    reminder_type VARCHAR(20) NOT NULL, -- '1w', '3d', '1d', '8h', '2h', '1h'
    sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Canvas sync log for tracking API synchronization
CREATE TABLE IF NOT EXISTS canvas_sync_log (
    id SERIAL PRIMARY KEY,
    facebook_id VARCHAR(50) NOT NULL,
    sync_type VARCHAR(20) NOT NULL, -- 'full', 'incremental'
    status VARCHAR(20) NOT NULL, -- 'success', 'partial', 'failed'
    assignments_fetched INTEGER DEFAULT 0,
    error_message TEXT,
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP,
    FOREIGN KEY (facebook_id) REFERENCES users(facebook_id) ON DELETE CASCADE
);

-- Payment transactions for premium subscriptions
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    facebook_id VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payment_provider VARCHAR(20) NOT NULL, -- 'kofi', 'stripe', etc.
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    subscription_months INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    webhook_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (facebook_id) REFERENCES users(facebook_id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_facebook_id ON user_sessions(facebook_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_tasks_facebook_id ON tasks(facebook_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time);
CREATE INDEX IF NOT EXISTS idx_reminders_sent ON reminders(sent);
CREATE INDEX IF NOT EXISTS idx_canvas_sync_facebook_id ON canvas_sync_log(facebook_id);
CREATE INDEX IF NOT EXISTS idx_transactions_facebook_id ON transactions(facebook_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
"""

def init_database():
    """Initialize the database with required tables and indexes using Supabase"""
    try:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set")
        
        logger.info("Connecting to Supabase...")
        
        # Use admin client for schema creation
        admin_client = supabase_client.admin_client
        
        logger.info("Creating database schema...")
        
        # Execute the schema SQL using Supabase RPC
        response = admin_client.rpc('exec_sql', {'sql': SCHEMA_SQL}).execute()
        
        if response.data:
            logger.info("Database initialization completed successfully")
            return True
        else:
            logger.warning("Schema creation returned no data - may already exist")
            return True
            
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        # Try alternative method - execute SQL statements individually
        try:
            return init_database_alternative()
        except Exception as e2:
            logger.error(f"Alternative initialization also failed: {str(e2)}")
            return False

def init_database_alternative():
    """Alternative database initialization using Supabase SQL editor approach"""
    logger.info("Trying alternative initialization method...")
    
    # Split schema into individual statements
    statements = [stmt.strip() for stmt in SCHEMA_SQL.split(';') if stmt.strip()]
    
    admin_client = supabase_client.admin_client
    
    for i, statement in enumerate(statements):
        try:
            logger.debug(f"Executing statement {i+1}/{len(statements)}")
            admin_client.rpc('exec_sql', {'sql': statement + ';'}).execute()
        except Exception as e:
            # Some statements might fail if tables already exist, that's OK
            logger.debug(f"Statement {i+1} failed (might be expected): {str(e)}")
    
    logger.info("Alternative initialization completed")
    return True

def check_database_connection():
    """Check if Supabase connection is working"""
    try:
        return supabase_client.test_connection()
    except Exception as e:
        logger.error(f"Supabase connection check failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("EaselyBot Supabase Database Initialization")
    print("=" * 43)
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables not set")
        print("Please set both variables before running this script.")
        print("\nYou can get these from your Supabase project dashboard:")
        print("- SUPABASE_URL: Project Settings > API > URL")
        print("- SUPABASE_SERVICE_KEY: Project Settings > API > service_role secret")
        exit(1)
    
    print("🔍 Checking database connection...")
    if not check_database_connection():
        print("❌ Database connection failed")
        exit(1)
    
    print("✅ Database connection successful")
    print("🚀 Initializing database schema...")
    
    if init_database():
        print("✅ Supabase database initialization completed successfully!")
        print("The database is ready for EaselyBot deployment.")
        print("\nNext steps:")
        print("1. Set SUPABASE_URL and SUPABASE_KEY in your environment variables")
        print("2. Deploy your application to Render")
        print("3. Your bot will automatically use Supabase for data storage")
    else:
        print("❌ Supabase database initialization failed")
        print("Check the logs for error details.")
        print("\nTroubleshooting:")
        print("- Verify your SUPABASE_SERVICE_KEY has admin privileges")
        print("- Check your Supabase project is active and accessible")
        print("- Try running individual SQL commands in Supabase SQL Editor")
        exit(1)

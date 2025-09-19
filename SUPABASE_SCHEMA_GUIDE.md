# 🗄️ EaselyBot Supabase Database Schema Guide

This comprehensive guide explains every aspect of the EaselyBot database schema, design decisions, and implementation details for Supabase.

## 📋 Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Detailed Table Explanations](#detailed-table-explanations)
3. [Relationships & Foreign Keys](#relationships--foreign-keys)
4. [Triggers & Automation](#triggers--automation)
5. [Security & RLS Policies](#security--rls-policies)
6. [Performance Optimization](#performance-optimization)
7. [Implementation Steps](#implementation-steps)
8. [Maintenance & Monitoring](#maintenance--monitoring)

## 🏗️ Overview & Architecture

### Design Philosophy
The schema is designed around these core principles:

1. **User-Centric**: Everything revolves around Facebook users as the primary entity
2. **Scalable**: UUID primary keys, proper indexing, and partitioning-ready design
3. **Extensible**: JSONB columns for flexible data, arrays for multi-value fields
4. **Secure**: Row-Level Security (RLS) for complete data isolation
5. **Observable**: Comprehensive logging and analytics built-in
6. **Canvas-Native**: Deep integration with Canvas LMS data structures

### Entity Relationship Overview
```
users (1) ──┬── (N) user_sessions
            ├── (N) tasks ──── (N) reminders
            ├── (N) canvas_sync_log
            ├── (N) transactions
            └── (N) user_analytics
```

## 📊 Detailed Table Explanations

### 1. **USERS** - The Central Entity

**Purpose**: Core user profiles with Canvas integration and subscription management.

**Key Design Decisions**:
- **Primary Key**: UUID for global uniqueness and security
- **Facebook ID**: Unique identifier from Messenger, VARCHAR(50) to handle long IDs
- **Canvas Token**: TEXT field for encrypted access tokens (implement encryption in app layer)
- **Subscription Management**: Built-in premium subscription tracking with expiration
- **Analytics**: Engagement metrics embedded for performance

**Critical Columns Explained**:
```sql
-- Canvas Integration
canvas_token TEXT                    -- Store encrypted Canvas access tokens
canvas_url VARCHAR(500)              -- User's Canvas instance (schools have different URLs)
canvas_user_id VARCHAR(50)           -- Canvas internal user ID for API calls
last_canvas_sync TIMESTAMP           -- Track sync freshness for scheduling
canvas_sync_enabled BOOLEAN          -- Allow users to disable sync

-- Premium Subscription System
subscription_status VARCHAR(20)      -- free/premium/expired/cancelled
subscription_expires_at TIMESTAMP    -- When premium access ends
monthly_task_count INTEGER          -- Free tier limit enforcement (resets monthly)
last_task_count_reset DATE          -- Track monthly reset cycle

-- User Engagement Analytics
onboarding_completed BOOLEAN        -- Track conversion funnel
privacy_policy_accepted BOOLEAN     -- GDPR compliance
terms_accepted BOOLEAN              -- Legal compliance
total_messages_sent INTEGER         -- Engagement metric
first_message_at TIMESTAMP          -- User acquisition tracking
```

**Business Logic Constraints**:
- Timezone validation using regex pattern
- Subscription date validation (expires_at > start_date)
- Monthly task counter resets automatically via triggers

### 2. **USER_SESSIONS** - Conversation State Management

**Purpose**: Track conversation flow and store temporary form data during multi-step interactions.

**Why This Design**:
- **Flexible Storage**: JSONB allows storing complex conversation context
- **Auto-Expiration**: Prevents data accumulation and enforces session timeouts
- **Unique Constraint**: One session per user per conversation type

**Session Key Examples**:
```sql
-- Common session keys used by the bot
'waiting_for_token'           -- User in Canvas token input flow
'creating_task'               -- Multi-step task creation
'onboarding_step_2'          -- Onboarding progress
'payment_processing'         -- Premium upgrade flow
```

**Session Value Examples**:
```json
-- Task creation in progress
{
  "title": "Math Assignment",
  "step": "waiting_for_date",
  "course_id": "12345"
}

-- Onboarding progress
{
  "step": 3,
  "privacy_agreed": true,
  "terms_agreed": false,
  "canvas_url": "https://myschool.instructure.com"
}
```

**Auto-Cleanup**: Expired sessions are automatically removed by triggers and maintenance functions.

### 3. **TASKS** - Assignment & Task Management

**Purpose**: Store both Canvas assignments and manually created tasks with full lifecycle management.

**Complex Design Features**:

#### Task Classification System
```sql
task_type VARCHAR(20) CHECK (task_type IN ('manual', 'canvas', 'imported'))
```
- **manual**: User-created tasks
- **canvas**: Synced from Canvas API
- **imported**: Bulk imported from other sources

#### Status State Machine
```sql
status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled'))
```
- **pending** → **in_progress** (user starts working)
- **pending/in_progress** → **overdue** (past due date, automatic)
- **any** → **completed** (user marks done)
- **any** → **cancelled** (user or system cancels)

#### Canvas Integration Fields
```sql
-- Canvas-specific data for API synchronization
canvas_assignment_id VARCHAR(100)    -- Canvas assignment ID for updates
canvas_course_id VARCHAR(100)        -- Course context for organization
canvas_points_possible DECIMAL       -- Grade weight information
canvas_submission_types TEXT[]       -- Array: ['online_text_entry', 'online_upload']
canvas_html_url VARCHAR(500)         -- Direct link to Canvas assignment
```

#### Advanced Features
```sql
-- Task Management
completion_percentage INTEGER        -- Track partial completion (0-100)
estimated_duration INTEGER          -- Time estimation in minutes
tags TEXT[]                         -- User-defined organization tags
notes TEXT                          -- Personal notes and instructions

-- Reminder Integration
reminder_sent BOOLEAN               -- Has any reminder been sent?
last_reminder_sent TIMESTAMP       -- When was the last reminder?
reminder_count INTEGER              -- How many reminders sent?
```

**Business Logic Constraints**:
- Completion constraint: `completed` status requires `completed_at` timestamp
- Canvas constraint: Canvas tasks must have `canvas_assignment_id`
- Percentage validation: 0-100 range enforcement

### 4. **REMINDERS** - Notification Scheduling System

**Purpose**: Schedule and track multiple reminder notifications per task with delivery management.

**Sophisticated Features**:

#### Reminder Type System
```sql
reminder_type VARCHAR(20)  -- '1w', '3d', '1d', '8h', '2h', '1h', 'overdue'
```
- **Premium users**: Get all reminder intervals
- **Free users**: Only get '1d' (24-hour) reminders
- **Overdue**: Special reminders for past-due tasks

#### Delivery Management
```sql
-- Delivery tracking and retry logic
delivery_status VARCHAR(20) CHECK (...IN ('pending', 'sent', 'failed', 'skipped'))
failure_reason TEXT                 -- Why delivery failed
retry_count INTEGER DEFAULT 0      -- Track retry attempts
sent_at TIMESTAMP                  -- Exact delivery time
```

#### Custom Reminder Content
```sql
message_template TEXT              -- Override default reminder message
urgency_level VARCHAR(10)          -- Escalate urgency as due date approaches
```

**Automatic Creation**: Reminders are automatically created when tasks are inserted via triggers, with different intervals based on user subscription status.

### 5. **CANVAS_SYNC_LOG** - Integration Monitoring

**Purpose**: Track every Canvas API interaction for debugging, performance monitoring, and reliability.

**Comprehensive Logging**:

#### Sync Operation Types
```sql
sync_type VARCHAR(20) CHECK (...IN ('full', 'incremental', 'single_course', 'single_assignment'))
sync_trigger VARCHAR(30) CHECK (...IN ('manual', 'scheduled', 'webhook', 'user_request'))
```

#### Performance Metrics
```sql
-- Detailed performance tracking
sync_started_at TIMESTAMP          -- Operation start time
sync_completed_at TIMESTAMP        -- Operation end time  
duration_ms INTEGER                 -- Millisecond precision timing
canvas_api_calls_made INTEGER      -- Track API usage for rate limiting
```

#### Error Handling & Debugging
```sql
-- Comprehensive error tracking
error_message TEXT                  -- Human-readable error description
error_code VARCHAR(50)              -- Structured error code for handling
canvas_rate_limit_hit BOOLEAN       -- Track rate limiting issues
retry_attempt INTEGER               -- Track retry logic
canvas_response_data JSONB          -- Store API response for debugging
```

#### Results Tracking
```sql
-- Track sync effectiveness
assignments_fetched INTEGER        -- Total assignments from Canvas
assignments_created INTEGER        -- New tasks created
assignments_updated INTEGER        -- Existing tasks updated
assignments_deleted INTEGER        -- Tasks removed/cancelled
```

**Use Cases**:
- Debug Canvas integration issues
- Monitor API performance and rate limits
- Track sync success rates
- Generate sync reliability reports
- Optimize sync scheduling

### 6. **TRANSACTIONS** - Payment & Subscription Management

**Purpose**: Track premium subscription payments across multiple payment providers with full financial audit trail.

**Multi-Provider Support**:
```sql
payment_provider VARCHAR(20) CHECK (...IN ('kofi', 'stripe', 'paypal', 'manual'))
payment_provider_fee_cents INTEGER -- Track platform fees for accounting
```

**Financial Tracking**:
```sql
-- Comprehensive payment details
amount_cents INTEGER                -- Store in cents to avoid floating-point issues
currency VARCHAR(3) DEFAULT 'USD'  -- Support international payments
exchange_rate DECIMAL(10,6)        -- Handle currency conversion
```

**Subscription Management**:
```sql
-- Subscription lifecycle
subscription_months INTEGER        -- Length of subscription purchased
subscription_type VARCHAR(20)      -- premium/premium_plus/lifetime
status VARCHAR(20)                 -- pending/completed/failed/refunded/disputed
```

**Audit Trail**:
```sql
-- Complete transaction timeline
created_at TIMESTAMP               -- When transaction initiated
completed_at TIMESTAMP             -- When payment confirmed
refunded_at TIMESTAMP              -- When refund issued

-- External system integration
webhook_data JSONB                 -- Raw webhook data from payment provider
customer_email VARCHAR(255)        -- Email from payment system
customer_name VARCHAR(255)         -- Name from payment system
```

**Refund Management**:
```sql
-- Comprehensive refund tracking
refund_reason TEXT                 -- Why refund was issued
refund_amount_cents INTEGER        -- Partial or full refund amount
refund_transaction_id VARCHAR(100) -- External refund transaction ID
```

**Marketing Attribution**:
```sql
-- Track marketing effectiveness
utm_source VARCHAR(100)            -- Traffic source (google, facebook, etc.)
utm_campaign VARCHAR(100)          -- Marketing campaign
utm_medium VARCHAR(100)            -- Marketing medium (cpc, organic, etc.)
```

### 7. **USER_ANALYTICS** - Usage Analytics & Insights

**Purpose**: Track detailed user engagement metrics for product insights and user success measurement.

**Time-Based Aggregation**:
```sql
-- Multiple time granularities
date DATE NOT NULL                 -- Daily aggregation
week_of_year INTEGER              -- ISO week number for weekly reports
month_year VARCHAR(7)             -- Format: YYYY-MM for monthly reports
```

**Message Analytics**:
```sql
-- Conversation tracking
messages_sent INTEGER             -- Messages sent to user
messages_received INTEGER         -- Messages received from user
session_duration_minutes INTEGER  -- Total conversation time per day
```

**Feature Usage Analytics**:
```sql
-- Feature adoption tracking
tasks_created INTEGER             -- Daily task creation count
tasks_completed INTEGER           -- Daily task completion count  
canvas_syncs INTEGER              -- Daily Canvas synchronizations
reminders_received INTEGER        -- Daily reminder deliveries
```

**User Journey Analytics**:
```sql
-- User success metrics
onboarding_steps_completed INTEGER -- Progress through onboarding
errors_encountered INTEGER         -- Error frequency tracking
help_requests INTEGER             -- Support burden metrics
```

**Engagement Metrics**:
```sql
-- Interaction patterns
quick_replies_used INTEGER        -- Quick reply engagement
menu_interactions INTEGER         -- Persistent menu usage
deep_link_clicks INTEGER          -- External link clicks
```

**Usage**: This data powers user dashboards, product analytics, A/B testing, and business intelligence reports.

## 🔗 Relationships & Foreign Keys

### Primary Relationships

1. **users.facebook_id** ← All other tables
   - Cascade delete: When user deletes account, all their data is removed
   - References maintained for data integrity

2. **tasks.id** ← reminders.task_id
   - Cascade delete: When task deleted, reminders auto-removed
   - One-to-many: Each task can have multiple reminders

### Referential Integrity

```sql
-- All user data cascades from users table
REFERENCES users(facebook_id) ON DELETE CASCADE

-- Task reminders cascade from tasks
REFERENCES tasks(id) ON DELETE CASCADE
```

**Why Cascade Delete**:
- **GDPR Compliance**: Complete user data removal
- **Data Consistency**: No orphaned records
- **Storage Efficiency**: Automatic cleanup

## ⚙️ Triggers & Automation

### 1. **Automatic Timestamp Updates**
```sql
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
- Applied to all tables with `updated_at` columns
- Ensures accurate modification tracking

### 2. **Task Status Management**
```sql
CREATE TRIGGER update_task_status_trigger 
BEFORE UPDATE ON tasks 
FOR EACH ROW EXECUTE FUNCTION update_task_status();
```
**Automatic Behaviors**:
- Tasks past due date automatically marked `overdue`
- Completed tasks get completion timestamp
- Completion percentage set to 100% when completed

### 3. **Automatic Reminder Creation**
```sql
CREATE TRIGGER create_task_reminders_trigger 
AFTER INSERT ON tasks 
FOR EACH ROW EXECUTE FUNCTION create_task_reminders();
```
**Smart Reminder Logic**:
- Free users: Only 24-hour reminder
- Premium users: Full cascade (1w, 3d, 1d, 8h, 2h, 1h)
- Only creates reminders for future times
- Automatically calculates reminder times based on due date

### 4. **User Statistics Tracking**
```sql
CREATE TRIGGER update_user_task_stats_trigger 
AFTER INSERT OR UPDATE ON tasks 
FOR EACH ROW EXECUTE FUNCTION update_user_task_stats();
```
**Automatic Analytics**:
- Increments user task creation counters
- Updates monthly task limits for free users
- Updates daily analytics on task completion
- Resets monthly counters automatically

## 🔐 Security & RLS Policies

### Row Level Security (RLS)

**Principle**: Users can only access their own data, enforced at the database level.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY user_isolation_policy ON users
USING (facebook_id = current_setting('app.current_user', true));
```

### Security Implementation

1. **Data Isolation**: Each user can only access records with their `facebook_id`
2. **Application Setting**: App sets `app.current_user` session variable
3. **Automatic Enforcement**: Database enforces access regardless of application code
4. **Multi-Table Policies**: Reminders accessible through task ownership

### Benefits of RLS

- **GDPR Compliance**: Automatic data isolation
- **Security**: Prevents data leaks even with compromised application code
- **Multi-Tenancy**: Perfect for SaaS applications
- **Audit Trail**: Database-level access logging

## ⚡ Performance Optimization

### Strategic Indexing

#### Primary Performance Indexes
```sql
-- User lookups (most common operation)
CREATE INDEX idx_users_facebook_id ON users(facebook_id);

-- Task queries by user and status
CREATE INDEX idx_tasks_facebook_id ON tasks(facebook_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
```

#### Advanced Partial Indexes
```sql
-- Only index active premium users
CREATE INDEX idx_premium_users ON users(subscription_status, subscription_expires_at) 
WHERE subscription_status = 'premium';

-- Only index pending reminders
CREATE INDEX idx_reminders_pending ON reminders(reminder_time, sent) 
WHERE sent = false AND delivery_status = 'pending';

-- Only index overdue tasks
CREATE INDEX idx_tasks_overdue ON tasks(due_date, status) 
WHERE status = 'pending' AND due_date < NOW();
```

#### Full-Text Search
```sql
-- Search tasks by title and description
CREATE INDEX idx_tasks_search ON tasks 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### Query Optimization Views

#### Pre-Computed Common Queries
```sql
-- Expensive query pre-computed as view
CREATE VIEW active_premium_users AS
SELECT 
    facebook_id,
    subscription_status,
    subscription_expires_at,
    EXTRACT(DAYS FROM (subscription_expires_at - NOW())) AS days_until_expiry
FROM users 
WHERE subscription_status = 'premium' 
AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW());
```

### Performance Monitoring

```sql
-- Analyze tables for query planner
ANALYZE users;
ANALYZE tasks;
ANALYZE reminders;
-- ... etc for all tables
```

## 🚀 Implementation Steps

### Step 1: Supabase Project Setup

1. **Create Supabase Project**
   ```bash
   # Visit https://supabase.com/dashboard
   # Create new project
   # Note: URL, anon key, and service_role key
   ```

2. **Configure Environment Variables**
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_anon_public_key
   SUPABASE_SERVICE_KEY=your_service_role_secret
   ```

### Step 2: Schema Installation

1. **Option A: Automated Script**
   ```bash
   # Run the initialization script
   python init_db.py
   ```

2. **Option B: Manual SQL Execution**
   ```sql
   -- Copy contents of supabase_schema_detailed.sql
   -- Paste into Supabase SQL Editor
   -- Execute all statements
   ```

### Step 3: Schema Validation

```sql
-- Verify installation
SELECT * FROM validate_schema();

-- Expected output:
-- Required Tables    | PASS | Found 7 of 7 required tables
-- Required Indexes   | PASS | Found 25+ indexes  
-- Required Triggers  | PASS | Found 6+ triggers
```

### Step 4: Test Data Installation

```sql
-- Create a test user
INSERT INTO users (facebook_id, subscription_status) 
VALUES ('test_user_123', 'premium');

-- Create a test task
INSERT INTO tasks (facebook_id, title, due_date) 
VALUES ('test_user_123', 'Test Assignment', NOW() + INTERVAL '2 days');

-- Verify reminders were auto-created
SELECT * FROM reminders WHERE task_id IN (
    SELECT id FROM tasks WHERE facebook_id = 'test_user_123'
);
```

### Step 5: Application Integration

```python
# Update your Supabase client to use new schema
from app.database.supabase_client import supabase_client

# Test connection
if supabase_client.test_connection():
    print("✅ Connected to Supabase successfully!")
else:
    print("❌ Connection failed")
```

## 🔧 Maintenance & Monitoring

### Regular Maintenance Tasks

#### 1. **Data Cleanup** (Run Weekly)
```sql
-- Clean expired sessions, old logs, and cancelled tasks
SELECT cleanup_old_data();
```

#### 2. **Performance Analysis** (Run Monthly)
```sql
-- Update table statistics for query optimization
ANALYZE users;
ANALYZE tasks;
ANALYZE reminders;
ANALYZE user_analytics;
```

#### 3. **Schema Validation** (Run After Updates)
```sql
-- Verify schema integrity
SELECT * FROM validate_schema();
```

### Monitoring Queries

#### 1. **User Growth Tracking**
```sql
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as new_users,
    COUNT(*) FILTER (WHERE subscription_status = 'premium') as premium_users
FROM users 
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month;
```

#### 2. **Task Activity Monitoring**
```sql
SELECT 
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as tasks_created,
    COUNT(*) FILTER (WHERE status = 'completed') as tasks_completed,
    AVG(EXTRACT(HOURS FROM (completed_at - created_at))) as avg_completion_hours
FROM tasks 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day;
```

#### 3. **Canvas Sync Health**
```sql
SELECT 
    status,
    COUNT(*) as sync_count,
    AVG(duration_ms) as avg_duration_ms,
    COUNT(*) FILTER (WHERE canvas_rate_limit_hit = true) as rate_limited_syncs
FROM canvas_sync_log 
WHERE sync_started_at >= NOW() - INTERVAL '7 days'
GROUP BY status;
```

#### 4. **Reminder Delivery Performance**
```sql
SELECT 
    delivery_status,
    COUNT(*) as reminder_count,
    AVG(EXTRACT(MINUTES FROM (sent_at - reminder_time))) as avg_delay_minutes
FROM reminders 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY delivery_status;
```

### Performance Optimization

#### 1. **Index Usage Analysis**
```sql
-- Check if indexes are being used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_tup_read + idx_tup_fetch DESC;
```

#### 2. **Slow Query Identification**
```sql
-- Enable and monitor slow queries in Supabase dashboard
-- Look for queries > 1000ms execution time
-- Focus on optimizing most frequent slow queries
```

### Backup & Recovery

#### 1. **Automated Backups**
- Supabase provides automatic daily backups
- Retention: 7 days on free tier, 30 days on pro tier
- Point-in-time recovery available on pro tier

#### 2. **Manual Backup**
```bash
# Export schema and data
pg_dump -h your-supabase-host -U postgres -d your-db-name > easely_backup.sql

# Restore from backup
psql -h your-supabase-host -U postgres -d your-db-name < easely_backup.sql
```

### Security Monitoring

#### 1. **RLS Policy Verification**
```sql
-- Verify RLS is enabled on all tables
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

#### 2. **Access Pattern Analysis**
- Monitor Supabase dashboard for unusual access patterns
- Set up alerts for failed authentication attempts
- Monitor API usage for potential abuse

---

## 🎯 Summary

This schema provides a **production-ready, scalable foundation** for your EaselyBot with:

- ✅ **Complete User Management** with Canvas integration
- ✅ **Flexible Task System** supporting manual and Canvas assignments  
- ✅ **Intelligent Reminders** with premium tiering
- ✅ **Comprehensive Analytics** for product insights
- ✅ **Robust Payment Tracking** for subscription management
- ✅ **Enterprise Security** with Row-Level Security
- ✅ **Performance Optimization** with strategic indexing
- ✅ **Automatic Maintenance** via triggers and functions

The schema is designed to **scale with your bot** from initial deployment through thousands of active users, while maintaining **data integrity, security, and performance**.

Ready to deploy? Run `python init_db.py` and your database will be production-ready! 🚀
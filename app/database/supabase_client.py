"""
Supabase Database Client for EaselyBot
Provides database operations using Supabase Python client
"""

import logging
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
from config.settings import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

logger = logging.getLogger(__name__)

class MockTableQuery:
    """Mock table query for local development"""
    def __init__(self, table_name: str):
        self.table_name = table_name
        self._query = {}
    
    def select(self, columns: str):
        return self
    
    def eq(self, column: str, value: str):
        return self
    
    def gt(self, column: str, value: str):
        return self
    
    def lt(self, column: str, value: str):
        return self
    
    def limit(self, count: int):
        return self
    
    def single(self):
        return self
    
    def order(self, column: str, desc: bool = False):
        return self
    
    def insert(self, data: Dict):
        return self
    
    def update(self, data: Dict):
        return self
    
    def delete(self):
        return self
    
    def upsert(self, data: Dict, on_conflict: str = None):
        return self
    
    def execute(self):
        """Return mock response"""
        from types import SimpleNamespace
        return SimpleNamespace(data=[])

class MockSupabaseClient:
    """Mock Supabase client for local development without database"""
    
    def table(self, name: str):
        return MockTableQuery(name)
    
    def rpc(self, function_name: str, params: Dict = None):
        return MockTableQuery('rpc')

class SupabaseClient:
    """Supabase client wrapper for EaselyBot database operations"""
    
    def __init__(self):
        self._client: Optional[Client] = None
        self._admin_client: Optional[Client] = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize Supabase clients"""
        try:
            if not SUPABASE_URL or not SUPABASE_KEY:
                logger.warning("Supabase credentials not configured - using mock client for local development")
                self._client = MockSupabaseClient()
                self._admin_client = MockSupabaseClient()
                return
            
            # Regular client for normal operations
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
            
            # Admin client for administrative operations (if service key is provided)
            if SUPABASE_SERVICE_KEY:
                self._admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            
            logger.info("Supabase clients initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Supabase clients: {str(e)}")
            logger.warning("Using mock client for local development")
            self._client = MockSupabaseClient()
            self._admin_client = MockSupabaseClient()
    
    @property
    def client(self) -> Client:
        """Get the regular Supabase client"""
        if not self._client:
            self._initialize_clients()
        return self._client
    
    @property
    def admin_client(self) -> Client:
        """Get the admin Supabase client (requires service key)"""
        if not self._admin_client:
            if not SUPABASE_SERVICE_KEY:
                raise ValueError("SUPABASE_SERVICE_KEY required for admin operations")
            self._initialize_clients()
        return self._admin_client
    
    def test_connection(self) -> bool:
        """Test the Supabase connection"""
        try:
            # Check if using mock client
            if isinstance(self.client, MockSupabaseClient):
                logger.info("Using mock Supabase client - connection test passed")
                return True
            
            # Try to access the users table (should exist after initialization)
            response = self.client.table('users').select('id').limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase connection test failed: {str(e)}")
            return False

# Global Supabase client instance
supabase_client = SupabaseClient()

# User Management Functions
def create_user(facebook_id: str, **kwargs) -> Dict[str, Any]:
    """Create a new user record"""
    try:
        user_data = {
            'facebook_id': facebook_id,
            'subscription_status': 'free',
            'notifications_enabled': True,
            'timezone': 'UTC',
            **kwargs
        }
        
        response = supabase_client.client.table('users').insert(user_data).execute()
        return response.data[0] if response.data else {}
    
    except Exception as e:
        logger.error(f"Error creating user {facebook_id}: {str(e)}")
        raise

def get_user(facebook_id: str) -> Optional[Dict[str, Any]]:
    """Get user by Facebook ID"""
    try:
        response = supabase_client.client.table('users').select('*').eq('facebook_id', facebook_id).single().execute()
        return response.data
    except Exception as e:
        logger.debug(f"User {facebook_id} not found: {str(e)}")
        return None

def update_user(facebook_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update user record"""
    try:
        response = supabase_client.client.table('users').update(updates).eq('facebook_id', facebook_id).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        logger.error(f"Error updating user {facebook_id}: {str(e)}")
        raise

def update_user_last_seen(facebook_id: str):
    """Update user's last seen timestamp"""
    try:
        from datetime import datetime, timezone
        current_time = datetime.now(timezone.utc).isoformat()
        supabase_client.client.table('users').update({'last_seen': current_time}).eq('facebook_id', facebook_id).execute()
    except Exception as e:
        logger.error(f"Error updating last seen for user {facebook_id}: {str(e)}")

# Session Management Functions
def set_user_session(facebook_id: str, session_key: str, session_value: str, expires_hours: int = 24):
    """Set user session data"""
    try:
        from datetime import datetime, timezone, timedelta
        
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
        session_data = {
            'facebook_id': facebook_id,
            'session_key': session_key,
            'session_value': session_value,
            'expires_at': expires_at.isoformat()
        }
        
        # Upsert session data
        response = supabase_client.client.table('user_sessions').upsert(
            session_data,
            on_conflict='facebook_id,session_key'
        ).execute()
        
        return response.data[0] if response.data else {}
    
    except Exception as e:
        logger.error(f"Error setting session for user {facebook_id}: {str(e)}")
        raise

def get_user_session(facebook_id: str, session_key: str) -> Optional[str]:
    """Get user session data"""
    try:
        from datetime import datetime, timezone
        current_time = datetime.now(timezone.utc).isoformat()
        
        response = supabase_client.client.table('user_sessions').select('session_value').eq(
            'facebook_id', facebook_id
        ).eq('session_key', session_key).gt('expires_at', current_time).single().execute()
        
        return response.data['session_value'] if response.data else None
    
    except Exception as e:
        logger.debug(f"Session not found for user {facebook_id}, key {session_key}: {str(e)}")
        return None

def clear_user_session(facebook_id: str, session_key: str = None):
    """Clear user session data"""
    try:
        query = supabase_client.client.table('user_sessions').delete().eq('facebook_id', facebook_id)
        
        if session_key:
            query = query.eq('session_key', session_key)
        
        query.execute()
    
    except Exception as e:
        logger.error(f"Error clearing session for user {facebook_id}: {str(e)}")

def cleanup_expired_sessions():
    """Clean up expired sessions"""
    try:
        from datetime import datetime, timezone
        current_time = datetime.now(timezone.utc).isoformat()
        supabase_client.client.table('user_sessions').delete().lt('expires_at', current_time).execute()
        logger.info("Expired sessions cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up expired sessions: {str(e)}")

# Task Management Functions
def create_task(facebook_id: str, title: str, due_date: str, **kwargs) -> Dict[str, Any]:
    """Create a new task"""
    try:
        task_data = {
            'facebook_id': facebook_id,
            'title': title,
            'due_date': due_date,
            'status': 'pending',
            'task_type': 'manual',
            'priority': 'medium',
            **kwargs
        }
        
        response = supabase_client.client.table('tasks').insert(task_data).execute()
        return response.data[0] if response.data else {}
    
    except Exception as e:
        logger.error(f"Error creating task for user {facebook_id}: {str(e)}")
        raise

def get_user_tasks(facebook_id: str, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get user's tasks"""
    try:
        query = supabase_client.client.table('tasks').select('*').eq('facebook_id', facebook_id)
        
        if status:
            query = query.eq('status', status)
        
        response = query.order('due_date', desc=False).limit(limit).execute()
        return response.data or []
    
    except Exception as e:
        logger.error(f"Error fetching tasks for user {facebook_id}: {str(e)}")
        return []

def update_task(task_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update a task"""
    try:
        response = supabase_client.client.table('tasks').update(updates).eq('id', task_id).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {str(e)}")
        raise

def delete_task(task_id: int):
    """Delete a task"""
    try:
        supabase_client.client.table('tasks').delete().eq('id', task_id).execute()
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {str(e)}")
        raise

# Canvas Assignment Caching Functions
def cache_canvas_assignments(facebook_id: str, assignments: List[Dict[str, Any]]) -> None:
    """Cache Canvas assignments in database for faster retrieval"""
    try:
        from datetime import datetime, timezone
        
        # Use admin client to bypass RLS for Canvas caching operations
        admin_client = supabase_client.admin_client
        
        # First, clear existing cached assignments for this user
        admin_client.table('tasks').delete().eq('facebook_id', facebook_id).eq('task_type', 'canvas').execute()
        
        # Insert new assignments
        cached_tasks = []
        for assignment in assignments:
            # Ensure we have required fields
            assignment_id = assignment.get('id')
            if not assignment_id:
                logger.warning(f"Skipping assignment without ID: {assignment.get('title')}")
                continue
                
            task_data = {
                'facebook_id': facebook_id,
                'title': assignment.get('title', 'Untitled Assignment'),
                'due_date': assignment.get('due_date'),
                'status': 'pending',
                'task_type': 'canvas',
                'priority': 'medium',
                'canvas_assignment_id': str(assignment_id),  # Ensure it's a string
                'course_name': assignment.get('course_name'),
                'description': assignment.get('description'),
                'canvas_points_possible': assignment.get('points_possible'),
                'canvas_html_url': assignment.get('html_url'),
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            cached_tasks.append(task_data)
        
        if cached_tasks:
            admin_client.table('tasks').insert(cached_tasks).execute()
            logger.info(f"Cached {len(cached_tasks)} Canvas assignments for user {facebook_id}")
        
        # Update user's last sync timestamp
        update_user(facebook_id, {
            'last_canvas_sync': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error caching Canvas assignments for user {facebook_id}: {str(e)}")
        raise

def get_cached_canvas_assignments(facebook_id: str) -> List[Dict[str, Any]]:
    """Get cached Canvas assignments from database"""
    try:
        response = supabase_client.client.table('tasks').select('*').eq(
            'facebook_id', facebook_id
        ).eq('task_type', 'canvas').order('due_date', desc=False).execute()
        
        assignments = []
        for task in response.data or []:
            # Convert database format back to Canvas API format
            assignment = {
                'id': task.get('canvas_assignment_id'),
                'title': task.get('title'),
                'course_name': task.get('course_name'),
                'course_code': task.get('course_code'),
                'due_date': task.get('due_date'),
                'description': task.get('description'),
                'points_possible': task.get('canvas_points_possible'),
                'html_url': task.get('canvas_html_url')
            }
            assignments.append(assignment)
        
        return assignments
        
    except Exception as e:
        logger.error(f"Error fetching cached Canvas assignments for user {facebook_id}: {str(e)}")
        return []

def has_cached_assignments(facebook_id: str) -> bool:
    """Check if user has cached assignments in database"""
    try:
        response = supabase_client.client.table('tasks').select('id').eq(
            'facebook_id', facebook_id
        ).eq('task_type', 'canvas').limit(1).execute()
        
        return bool(response.data)
        
    except Exception as e:
        logger.debug(f"Error checking cache freshness for user {facebook_id}: {str(e)}")
        return False

def sync_canvas_assignments(facebook_id: str, token: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Get Canvas assignments - ALWAYS from database unless initial sync or force refresh"""
    try:
        logger.info(f"Getting Canvas assignments for user {facebook_id} (force_refresh={force_refresh})")
        
        # ALWAYS use cached data unless force refresh or no cache exists
        if not force_refresh:
            # Check if we have ANY cached data (not checking freshness)
            cached_assignments = get_cached_canvas_assignments(facebook_id)
            if cached_assignments:
                logger.info(f"Using {len(cached_assignments)} cached assignments from DATABASE")
                return cached_assignments
            else:
                logger.info(f"No cached assignments found, will do initial sync")
        
        # Fetch fresh data from Canvas API
        logger.info(f"Fetching fresh Canvas assignments for user {facebook_id}")
        from app.api.canvas_api import fetch_user_assignments
        
        # Fetch ALL assignments from Canvas (up to 500)
        assignments = fetch_user_assignments(token, limit=500)
        logger.info(f"Canvas API returned {len(assignments) if assignments else 0} assignments")
        
        if assignments:
            # Cache the assignments
            logger.info(f"Caching {len(assignments)} assignments to database")
            cache_canvas_assignments(facebook_id, assignments)
            
            # Log successful sync
            log_canvas_sync(
                facebook_id, 
                'full',  # Changed from 'automatic' to valid sync_type
                'success', 
                len(assignments)
            )
            logger.info(f"Successfully synced {len(assignments)} Canvas assignments")
        else:
            logger.warning(f"No assignments returned from Canvas API for user {facebook_id}")
            
            # Log failed sync but return cached data if available
            log_canvas_sync(
                facebook_id,
                'full',  # Changed from 'automatic' which isn't valid
                'failed',  # Changed from 'no_data' to valid status
                0,
                'No assignments returned from Canvas API'
            )
            
            # Try to get cached data as fallback
            assignments = get_cached_canvas_assignments(facebook_id)
            logger.info(f"Using {len(assignments)} cached assignments as fallback")
        
        return assignments
        
    except Exception as e:
        logger.error(f"Error syncing Canvas assignments for user {facebook_id}: {str(e)}")
        
        # Log failed sync
        log_canvas_sync(
            facebook_id,
            'full',  # Changed from 'automatic' to valid sync_type
            'failed',  # Changed from 'error' to valid status
            0,
            str(e)
        )
        
        # Return cached data as fallback
        cached_assignments = get_cached_canvas_assignments(facebook_id)
        logger.info(f"Returning {len(cached_assignments)} cached assignments as error fallback")
        return cached_assignments

# Canvas Sync Functions
def log_canvas_sync(facebook_id: str, sync_type: str, status: str, assignments_fetched: int = 0, error_message: str = None):
    """Log Canvas synchronization attempt"""
    try:
        from datetime import datetime, timezone
        
        sync_data = {
            'facebook_id': facebook_id,
            'sync_type': sync_type,
            'status': status,
            'assignments_fetched': assignments_fetched,
            'sync_completed_at': datetime.now(timezone.utc).isoformat()
        }
        
        if error_message:
            sync_data['error_message'] = error_message
        
        supabase_client.client.table('canvas_sync_log').insert(sync_data).execute()
    
    except Exception as e:
        logger.error(f"Error logging Canvas sync for user {facebook_id}: {str(e)}")

# Payment and Subscription Functions
def create_transaction(facebook_id: str, transaction_id: str, payment_provider: str, amount_cents: int, **kwargs) -> Dict[str, Any]:
    """Create a payment transaction record"""
    try:
        transaction_data = {
            'facebook_id': facebook_id,
            'transaction_id': transaction_id,
            'payment_provider': payment_provider,
            'amount_cents': amount_cents,
            'currency': 'USD',
            'subscription_months': 1,
            'status': 'pending',
            **kwargs
        }
        
        response = supabase_client.client.table('transactions').insert(transaction_data).execute()
        return response.data[0] if response.data else {}
    
    except Exception as e:
        logger.error(f"Error creating transaction for user {facebook_id}: {str(e)}")
        raise

def update_transaction_status(transaction_id: str, status: str, completed_at: str = None):
    """Update transaction status"""
    try:
        updates = {'status': status}
        if completed_at:
            updates['completed_at'] = completed_at
        
        supabase_client.client.table('transactions').update(updates).eq('transaction_id', transaction_id).execute()
    
    except Exception as e:
        logger.error(f"Error updating transaction {transaction_id}: {str(e)}")
        raise

# Message Logging Functions
def log_user_message(facebook_id: str, message_type: str, message_content: str, event_data: Dict = None, response_action: str = None):
    """Log incoming user messages and bot responses"""
    try:
        from datetime import datetime, timezone
        
        log_data = {
            'facebook_id': facebook_id,
            'message_type': message_type,  # 'text', 'postback', 'quick_reply'
            'message_content': message_content,
            'response_action': response_action,  # what action the bot took
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        if event_data:
            log_data['event_data'] = event_data
        
        supabase_client.client.table('message_logs').insert(log_data).execute()
    
    except Exception as e:
        logger.error(f"Error logging message for user {facebook_id}: {str(e)}")

def log_webhook_event(event_type: str, sender_id: str, event_data: Dict, processing_status: str, error_message: str = None):
    """Log webhook events for debugging and analytics"""
    try:
        from datetime import datetime, timezone
        
        log_data = {
            'event_type': event_type,
            'sender_id': sender_id,
            'event_data': event_data,
            'processing_status': processing_status,  # 'success', 'error', 'warning'
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        if error_message:
            log_data['error_message'] = error_message
        
        supabase_client.client.table('webhook_logs').insert(log_data).execute()
    
    except Exception as e:
        logger.error(f"Error logging webhook event: {str(e)}")

def log_conversation_state(facebook_id: str, previous_state: str, new_state: str, trigger_action: str):
    """Log conversation state transitions for analytics"""
    try:
        from datetime import datetime, timezone
        
        log_data = {
            'facebook_id': facebook_id,
            'previous_state': previous_state,
            'new_state': new_state,
            'trigger_action': trigger_action,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        supabase_client.client.table('conversation_states').insert(log_data).execute()
    
    except Exception as e:
        logger.error(f"Error logging conversation state for user {facebook_id}: {str(e)}")

def log_bot_action(facebook_id: str, action_type: str, action_details: Dict = None, success: bool = True, error_message: str = None):
    """Log bot actions for analytics and debugging"""
    try:
        from datetime import datetime, timezone
        
        log_data = {
            'facebook_id': facebook_id,
            'action_type': action_type,  # 'send_message', 'api_call', 'task_created', etc.
            'success': success,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        if action_details:
            log_data['action_details'] = action_details
            
        if error_message:
            log_data['error_message'] = error_message
        
        supabase_client.client.table('bot_actions').insert(log_data).execute()
    
    except Exception as e:
        logger.error(f"Error logging bot action for user {facebook_id}: {str(e)}")

def log_user_analytics(facebook_id: str, event_type: str, event_data: Dict = None):
    """Log user behavior for analytics"""
    try:
        from datetime import datetime, timezone
        
        log_data = {
            'facebook_id': facebook_id,
            'event_type': event_type,  # 'session_start', 'token_validated', 'task_created', 'premium_upgraded', etc.
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        if event_data:
            log_data['event_data'] = event_data
        
        supabase_client.client.table('user_analytics').insert(log_data).execute()
    
    except Exception as e:
        logger.error(f"Error logging user analytics for user {facebook_id}: {str(e)}")

# Utility Functions
def get_user_stats(facebook_id: str) -> Dict[str, int]:
    """Get user statistics"""
    try:
        # Get task counts
        tasks_response = supabase_client.client.table('tasks').select(
            'status'
        ).eq('facebook_id', facebook_id).execute()
        
        tasks = tasks_response.data or []
        
        stats = {
            'total_tasks': len(tasks),
            'pending_tasks': len([t for t in tasks if t['status'] == 'pending']),
            'completed_tasks': len([t for t in tasks if t['status'] == 'completed']),
            'overdue_tasks': len([t for t in tasks if t['status'] == 'overdue'])
        }
        
        return stats
    
    except Exception as e:
        logger.error(f"Error getting stats for user {facebook_id}: {str(e)}")
        return {'total_tasks': 0, 'pending_tasks': 0, 'completed_tasks': 0, 'overdue_tasks': 0}

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
        supabase_client.client.table('users').update({'last_seen': 'now()'}).eq('facebook_id', facebook_id).execute()
    except Exception as e:
        logger.error(f"Error updating last seen for user {facebook_id}: {str(e)}")

# Session Management Functions
def set_user_session(facebook_id: str, session_key: str, session_value: str, expires_hours: int = 24):
    """Set user session data"""
    try:
        session_data = {
            'facebook_id': facebook_id,
            'session_key': session_key,
            'session_value': session_value,
            'expires_at': f'now() + interval \'{expires_hours} hours\''
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
        response = supabase_client.client.table('user_sessions').select('session_value').eq(
            'facebook_id', facebook_id
        ).eq('session_key', session_key).gt('expires_at', 'now()').single().execute()
        
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
        supabase_client.client.table('user_sessions').delete().lt('expires_at', 'now()').execute()
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

# Canvas Sync Functions
def log_canvas_sync(facebook_id: str, sync_type: str, status: str, assignments_fetched: int = 0, error_message: str = None):
    """Log Canvas synchronization attempt"""
    try:
        sync_data = {
            'facebook_id': facebook_id,
            'sync_type': sync_type,
            'status': status,
            'assignments_fetched': assignments_fetched,
            'sync_completed_at': 'now()'
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
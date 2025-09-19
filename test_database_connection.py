#!/usr/bin/env python3
"""
Database Connection Test Script for EaselyBot
Tests all database operations to verify Supabase connectivity
"""

import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_environment_variables():
    """Test if required environment variables are set"""
    print("🔍 Testing Environment Variables...")
    
    required_vars = {
        'SUPABASE_URL': os.getenv('SUPABASE_URL'),
        'SUPABASE_KEY': os.getenv('SUPABASE_KEY'),
        'SUPABASE_SERVICE_KEY': os.getenv('SUPABASE_SERVICE_KEY')
    }
    
    missing_vars = []
    for var_name, var_value in required_vars.items():
        if not var_value:
            missing_vars.append(var_name)
            print(f"  ❌ {var_name}: Not set")
        else:
            # Show partial value for security
            masked_value = var_value[:10] + "..." + var_value[-5:] if len(var_value) > 20 else var_value[:5] + "..."
            print(f"  ✅ {var_name}: {masked_value}")
    
    if missing_vars:
        print(f"\n⚠️  Missing environment variables: {', '.join(missing_vars)}")
        print("   Please check your .env file")
        return False
    
    print("✅ All environment variables are set!\n")
    return True

def test_supabase_client_initialization():
    """Test Supabase client initialization"""
    print("🔧 Testing Supabase Client Initialization...")
    
    try:
        from app.database.supabase_client import supabase_client
        
        # Check if client is initialized
        if hasattr(supabase_client, '_client') and supabase_client._client:
            print("  ✅ Supabase client initialized successfully")
            
            # Check if it's a mock client (for local development)
            from app.database.supabase_client import MockSupabaseClient
            if isinstance(supabase_client._client, MockSupabaseClient):
                print("  ⚠️  Using Mock client (local development mode)")
                return False
            else:
                print("  ✅ Using real Supabase client")
                return True
        else:
            print("  ❌ Supabase client not initialized")
            return False
            
    except Exception as e:
        print(f"  ❌ Error initializing Supabase client: {str(e)}")
        return False

def test_database_connection():
    """Test basic database connection"""
    print("🌐 Testing Database Connection...")
    
    try:
        from app.database.supabase_client import supabase_client
        
        # Test connection
        connection_test = supabase_client.test_connection()
        
        if connection_test:
            print("  ✅ Database connection successful!")
            return True
        else:
            print("  ❌ Database connection failed")
            return False
            
    except Exception as e:
        print(f"  ❌ Connection test error: {str(e)}")
        return False

def test_user_operations():
    """Test user CRUD operations"""
    print("👤 Testing User Operations...")
    test_facebook_id = "test_user_12345"
    
    try:
        from app.database.supabase_client import create_user, get_user, update_user
        
        # Test 1: Create user
        print("  📝 Testing user creation...")
        user_data = create_user(test_facebook_id, first_interaction_message="test connection")
        if user_data:
            print(f"    ✅ User created successfully: {user_data.get('id', 'N/A')}")
        else:
            print("    ⚠️  User creation returned no data")
        
        # Test 2: Get user
        print("  🔍 Testing user retrieval...")
        user = get_user(test_facebook_id)
        if user:
            print(f"    ✅ User retrieved: {user.get('facebook_id')} (created: {user.get('created_at')})")
        else:
            print("    ❌ User not found after creation")
            return False
        
        # Test 3: Update user
        print("  ✏️  Testing user update...")
        updated_user = update_user(test_facebook_id, {
            'onboarding_completed': True,
            'canvas_token': 'test_token_connection_test'
        })
        if updated_user:
            print("    ✅ User updated successfully")
        else:
            print("    ❌ User update failed")
            return False
        
        # Test 4: Verify update
        updated_user_check = get_user(test_facebook_id)
        if updated_user_check and updated_user_check.get('onboarding_completed'):
            print("    ✅ User update verified")
        else:
            print("    ❌ User update verification failed")
            return False
            
        print("  ✅ All user operations successful!")
        return True
        
    except Exception as e:
        print(f"  ❌ User operations error: {str(e)}")
        return False

def test_session_operations():
    """Test session management operations"""
    print("🔄 Testing Session Operations...")
    test_facebook_id = "test_user_12345"
    
    try:
        from app.database.supabase_client import set_user_session, get_user_session, clear_user_session
        
        # Test 1: Set session
        print("  📝 Testing session creation...")
        session_data = set_user_session(test_facebook_id, 'test_key', 'test_value', 1)
        print("    ✅ Session created")
        
        # Test 2: Get session
        print("  🔍 Testing session retrieval...")
        session_value = get_user_session(test_facebook_id, 'test_key')
        if session_value == 'test_value':
            print("    ✅ Session retrieved correctly")
        else:
            print(f"    ❌ Session value mismatch: expected 'test_value', got '{session_value}'")
            return False
        
        # Test 3: Clear session
        print("  🗑️  Testing session cleanup...")
        clear_user_session(test_facebook_id, 'test_key')
        
        # Verify session cleared
        cleared_session = get_user_session(test_facebook_id, 'test_key')
        if cleared_session is None:
            print("    ✅ Session cleared successfully")
        else:
            print(f"    ⚠️  Session not cleared: {cleared_session}")
        
        print("  ✅ All session operations successful!")
        return True
        
    except Exception as e:
        print(f"  ❌ Session operations error: {str(e)}")
        return False

def test_logging_operations():
    """Test logging operations"""
    print("📝 Testing Logging Operations...")
    test_facebook_id = "test_user_12345"
    
    try:
        from app.database.supabase_client import (
            log_user_message, log_webhook_event, log_conversation_state, 
            log_bot_action, log_user_analytics
        )
        
        # Test message logging
        print("  💬 Testing message logging...")
        log_user_message(test_facebook_id, "text", "test message", {"test": "data"}, "test_response")
        print("    ✅ Message logged")
        
        # Test webhook logging
        print("  🔗 Testing webhook logging...")
        log_webhook_event("test_event", test_facebook_id, {"test": "webhook"}, "success")
        print("    ✅ Webhook event logged")
        
        # Test conversation state logging
        print("  🗣️  Testing conversation state logging...")
        log_conversation_state(test_facebook_id, "none", "test_state", "test_action")
        print("    ✅ Conversation state logged")
        
        # Test bot action logging
        print("  🤖 Testing bot action logging...")
        log_bot_action(test_facebook_id, "test_action", {"detail": "test"}, True)
        print("    ✅ Bot action logged")
        
        # Test analytics logging
        print("  📊 Testing analytics logging...")
        log_user_analytics(test_facebook_id, "test_event", {"data": "test"})
        print("    ✅ Analytics logged")
        
        print("  ✅ All logging operations successful!")
        return True
        
    except Exception as e:
        print(f"  ❌ Logging operations error: {str(e)}")
        print(f"       This might be due to missing tables or RLS policies")
        return False

def test_task_operations():
    """Test task management operations"""
    print("📋 Testing Task Operations...")
    test_facebook_id = "test_user_12345"
    
    try:
        from app.database.supabase_client import create_task, get_user_tasks, update_task
        
        # Test 1: Create task
        print("  📝 Testing task creation...")
        task_data = create_task(
            test_facebook_id, 
            "Test Assignment", 
            (datetime.now()).isoformat(),
            description="Test task for connection verification"
        )
        
        if task_data and task_data.get('id'):
            task_id = task_data.get('id')
            print(f"    ✅ Task created: {task_id}")
        else:
            print("    ❌ Task creation failed")
            return False
        
        # Test 2: Get tasks
        print("  🔍 Testing task retrieval...")
        tasks = get_user_tasks(test_facebook_id)
        if tasks and len(tasks) > 0:
            print(f"    ✅ Retrieved {len(tasks)} tasks")
        else:
            print("    ❌ No tasks found")
            return False
        
        print("  ✅ Task operations successful!")
        return True
        
    except Exception as e:
        print(f"  ❌ Task operations error: {str(e)}")
        return False

def cleanup_test_data():
    """Clean up test data"""
    print("🧹 Cleaning up test data...")
    
    try:
        from app.database.supabase_client import supabase_client
        
        # Remove test user and related data
        test_facebook_id = "test_user_12345"
        
        # Note: In a real cleanup, you'd want to remove related data first
        # due to foreign key constraints, but for this test we'll do basic cleanup
        
        try:
            # Delete user (this should cascade to related tables)
            supabase_client.client.table('users').delete().eq('facebook_id', test_facebook_id).execute()
            print("  ✅ Test user data cleaned up")
        except Exception as e:
            print(f"  ⚠️  Cleanup warning: {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Cleanup error: {str(e)}")
        return False

def main():
    """Run all database tests"""
    print("🧪 EaselyBot Database Connection Test")
    print("=" * 50)
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Supabase Client", test_supabase_client_initialization),
        ("Database Connection", test_database_connection),
        ("User Operations", test_user_operations),
        ("Session Operations", test_session_operations),
        ("Logging Operations", test_logging_operations),
        ("Task Operations", test_task_operations),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {str(e)}")
            results[test_name] = False
        
        print()  # Add spacing between tests
    
    # Cleanup
    cleanup_test_data()
    print()
    
    # Summary
    print("📊 Test Results Summary")
    print("=" * 30)
    
    passed = 0
    total = len(tests)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {test_name:<20} {status}")
        if result:
            passed += 1
    
    print()
    print(f"Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your database connection is working perfectly!")
    elif passed > 0:
        print("⚠️  Some tests passed. Check the failed tests above.")
    else:
        print("❌ All tests failed. Check your database configuration.")
        print("\nTroubleshooting:")
        print("1. Verify your .env file has correct SUPABASE_URL and SUPABASE_KEY")
        print("2. Run the SQL scripts: add_logging_tables.sql and fix_logging_rls.sql")
        print("3. Check your Supabase project is active and accessible")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
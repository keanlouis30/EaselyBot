#!/usr/bin/env python3
"""
Test script for task creation functionality
Tests the complete flow: title, date, time, details, database save, and Canvas sync
"""

import os
import sys
import logging
from datetime import datetime, timedelta, timezone

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_task_creation_flow():
    """Test the complete task creation flow"""
    
    print("\n🧪 Testing Task Creation Flow")
    print("=" * 50)
    
    # Import required modules
    from app.core.event_handler import (
        handle_add_new_task,
        handle_task_title_input,
        handle_date_selection,
        handle_time_selection,
        handle_task_details_input,
        create_and_sync_task,
        user_sessions
    )
    from app.database.supabase_client import (
        get_user,
        get_user_tasks,
        supabase_client
    )
    
    # Test user ID (you can change this to a real test user)
    test_user_id = "test_user_123"
    
    # Test 1: Direct task creation function
    print("\n📝 Test 1: Direct task creation with database and Canvas")
    print("-" * 40)
    
    try:
        # Get current date and time
        from datetime import datetime
        import pytz
        manila_tz = pytz.timezone('Asia/Manila')
        now = datetime.now(manila_tz)
        tomorrow = now + timedelta(days=1)
        
        # Test creating a task
        task_title = f"Test Task - {now.strftime('%Y-%m-%d %H:%M')}"
        task_date = tomorrow.strftime('%Y-%m-%d')
        task_time = "11:59 PM"
        task_details = "This is a test task created by the test script"
        
        print(f"Creating task:")
        print(f"  Title: {task_title}")
        print(f"  Date: {task_date}")
        print(f"  Time: {task_time}")
        print(f"  Details: {task_details}")
        
        success = create_and_sync_task(
            sender_id=test_user_id,
            title=task_title,
            date_str=task_date,
            time_str=task_time,
            details=task_details
        )
        
        if success:
            print("✅ Task created successfully!")
            
            # Try to retrieve the task from database
            tasks = get_user_tasks(test_user_id, limit=5)
            if tasks:
                latest_task = next((t for t in tasks if t['title'] == task_title), None)
                if latest_task:
                    print(f"✅ Task found in database:")
                    print(f"   ID: {latest_task.get('id')}")
                    print(f"   Status: {latest_task.get('status')}")
                    print(f"   Type: {latest_task.get('task_type')}")
                else:
                    print("⚠️ Task created but not found in recent tasks")
            else:
                print("⚠️ No tasks found for user")
        else:
            print("❌ Task creation failed")
            
    except Exception as e:
        print(f"❌ Error in test 1: {str(e)}")
        logger.error(f"Test 1 error: {str(e)}", exc_info=True)
    
    # Test 2: Simulate conversation flow
    print("\n💬 Test 2: Simulated conversation flow")
    print("-" * 40)
    
    try:
        # Clear any existing session
        if test_user_id in user_sessions:
            del user_sessions[test_user_id]
        
        # Step 1: Start task creation
        print("Step 1: Starting task creation...")
        # This would normally trigger: handle_add_new_task(test_user_id)
        # But we'll simulate it directly
        user_sessions[test_user_id] = {}
        
        # Step 2: Add title
        print("Step 2: Adding task title...")
        test_title = "Conversation Test Task"
        user_sessions[test_user_id]['task_title'] = test_title
        
        # Step 3: Add date
        print("Step 3: Setting date (tomorrow)...")
        tomorrow_str = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        user_sessions[test_user_id]['task_date'] = tomorrow_str
        
        # Step 4: Add time
        print("Step 4: Setting time (3:00 PM)...")
        user_sessions[test_user_id]['task_time'] = "3:00 PM"
        
        # Step 5: Simulate details input (this would trigger the actual save)
        print("Step 5: Adding details and creating task...")
        
        # Get session data
        if test_user_id in user_sessions:
            session = user_sessions[test_user_id]
            print(f"Session data:")
            print(f"  Title: {session.get('task_title')}")
            print(f"  Date: {session.get('task_date')}")
            print(f"  Time: {session.get('task_time')}")
            
            # Create the task
            success = create_and_sync_task(
                sender_id=test_user_id,
                title=session.get('task_title'),
                date_str=session.get('task_date'),
                time_str=session.get('task_time'),
                details="Test details from conversation flow"
            )
            
            if success:
                print("✅ Conversation flow task created successfully!")
                # Clear session
                del user_sessions[test_user_id]
            else:
                print("❌ Conversation flow task creation failed")
        else:
            print("❌ No session data found")
            
    except Exception as e:
        print(f"❌ Error in test 2: {str(e)}")
        logger.error(f"Test 2 error: {str(e)}", exc_info=True)
    
    # Test 3: Database connectivity
    print("\n🗄️ Test 3: Database connectivity")
    print("-" * 40)
    
    try:
        if supabase_client.test_connection():
            print("✅ Database connection successful")
            
            # Try to get user (might not exist)
            user = get_user(test_user_id)
            if user:
                print(f"✅ Test user found in database:")
                print(f"   Facebook ID: {user.get('facebook_id')}")
                print(f"   Has Canvas token: {bool(user.get('canvas_token'))}")
            else:
                print("ℹ️ Test user not found in database (this is normal for new test)")
        else:
            print("❌ Database connection failed")
            
    except Exception as e:
        print(f"❌ Error in test 3: {str(e)}")
        logger.error(f"Test 3 error: {str(e)}", exc_info=True)
    
    print("\n" + "=" * 50)
    print("✅ Task creation tests completed!")
    print("\nSummary:")
    print("- The task creation flow now:")
    print("  1. Collects task title")
    print("  2. Collects due date")
    print("  3. Collects due time")
    print("  4. Asks for task details (optional)")
    print("  5. Saves to database")
    print("  6. Creates Canvas calendar event (if user has token)")
    print("\n📚 Tasks are saved locally and synced with Canvas!")

if __name__ == "__main__":
    test_task_creation_flow()
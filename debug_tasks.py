#!/usr/bin/env python3
"""
Debug Script for EaselyBot Task Issues
Helps diagnose why no tasks are being returned
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def debug_user_tasks(facebook_id: str):
    """Debug task retrieval for a specific user"""
    print(f"🔍 Debugging tasks for Facebook ID: {facebook_id}")
    print("=" * 60)
    
    try:
        # Check if user exists
        print("1. Checking if user exists in database...")
        from app.database.supabase_client import get_user
        user = get_user(facebook_id)
        
        if not user:
            print("❌ User not found in database")
            print("   → The user needs to complete onboarding first")
            return
        else:
            print("✅ User found in database")
            print(f"   → Name: {user.get('facebook_id')}")
            print(f"   → Onboarding completed: {user.get('onboarding_completed', False)}")
            print(f"   → Last Canvas sync: {user.get('last_canvas_sync', 'Never')}")
        
        # Check Canvas token
        print("\n2. Checking Canvas token...")
        canvas_token = user.get('canvas_token')
        if not canvas_token:
            print("❌ No Canvas token found")
            print("   → User needs to provide Canvas access token")
            return
        else:
            print("✅ Canvas token found")
            print(f"   → Token length: {len(canvas_token)} characters")
            print(f"   → Token prefix: {canvas_token[:10]}...")
        
        # Validate Canvas token
        print("\n3. Validating Canvas token...")
        from app.api.canvas_api import validate_canvas_token
        validation = validate_canvas_token(canvas_token)
        
        if not validation['valid']:
            print("❌ Canvas token is invalid")
            print(f"   → Error: {validation.get('error_message', 'Unknown error')}")
            return
        else:
            print("✅ Canvas token is valid")
            user_info = validation.get('user_info', {})
            print(f"   → Canvas user: {user_info.get('name', 'Unknown')}")
            print(f"   → Canvas ID: {user_info.get('id', 'Unknown')}")
        
        # Fetch assignments from Canvas API
        print("\n4. Fetching assignments from Canvas API...")
        from app.api.canvas_api import fetch_user_assignments
        assignments = fetch_user_assignments(canvas_token, limit=20)
        
        print(f"📚 Found {len(assignments) if assignments else 0} assignments total")
        
        if not assignments:
            print("❌ No assignments returned from Canvas API")
            print("   Possible reasons:")
            print("   → You have no assignments in Canvas")
            print("   → All assignments lack due dates")
            print("   → Your Canvas courses are not active")
            print("   → Token doesn't have access to course data")
            return
        
        # Show all assignments
        print("\n📋 All assignments from Canvas:")
        for i, assignment in enumerate(assignments, 1):
            due_date = assignment.get('due_date', 'No due date')
            print(f"   {i}. {assignment.get('title', 'Untitled')}")
            print(f"      Course: {assignment.get('course_name', 'Unknown')}")
            print(f"      Due: {due_date}")
            print()
        
        # Check cached assignments in database
        print("5. Checking cached assignments in database...")
        from app.database.supabase_client import get_cached_canvas_assignments
        cached = get_cached_canvas_assignments(facebook_id)
        print(f"💾 Found {len(cached)} cached assignments")
        
        # Filter by date
        print("\n6. Filtering assignments by date...")
        from app.core.event_handler import filter_assignments_by_date
        
        today_assignments = filter_assignments_by_date(assignments, 'today')
        week_assignments = filter_assignments_by_date(assignments, 'week')
        overdue_assignments = filter_assignments_by_date(assignments, 'overdue')
        all_upcoming = filter_assignments_by_date(assignments, 'all')
        
        print(f"📅 Today: {len(today_assignments)} assignments")
        print(f"📅 This week: {len(week_assignments)} assignments") 
        print(f"⏰ Overdue: {len(overdue_assignments)} assignments")
        print(f"🔮 All upcoming: {len(all_upcoming)} assignments")
        
        # Show today's assignments specifically
        if today_assignments:
            print("\n🔥 Tasks due TODAY:")
            for assignment in today_assignments:
                print(f"   • {assignment.get('title')} ({assignment.get('course_code')})")
        else:
            print("\n❌ No assignments due today")
            if week_assignments:
                print("📌 But you have assignments this week:")
                for assignment in week_assignments[:3]:
                    print(f"   • {assignment.get('title')} - {assignment.get('due_date')}")
        
    except Exception as e:
        print(f"❌ Error during debugging: {str(e)}")
        import traceback
        traceback.print_exc()

def debug_canvas_connection():
    """Debug Canvas API connection"""
    print("🔗 Testing Canvas API connection...")
    print("=" * 40)
    
    # Check environment variables
    canvas_url = os.getenv('CANVAS_BASE_URL', 'https://dlsu.instructure.com')
    print(f"Canvas URL: {canvas_url}")
    
    # Test API with dummy token
    from app.api.canvas_api import validate_canvas_token
    result = validate_canvas_token("dummy_token")
    
    if not result['valid']:
        print("✅ Canvas API is accessible (correctly rejected dummy token)")
        print(f"   Error message: {result.get('error_message', 'No error message')}")
    else:
        print("❌ Unexpected result - dummy token was accepted")

if __name__ == "__main__":
    print("🤖 EaselyBot Task Debugging Tool")
    print("================================\n")
    
    if len(sys.argv) < 2:
        print("Usage: python debug_tasks.py <facebook_id>")
        print("Or: python debug_tasks.py canvas (to test Canvas connection)")
        print("\nTo find your Facebook ID:")
        print("1. Check your Supabase database 'users' table")
        print("2. Look at webhook logs for incoming messages")
        sys.exit(1)
    
    if sys.argv[1] == "canvas":
        debug_canvas_connection()
    else:
        facebook_id = sys.argv[1]
        debug_user_tasks(facebook_id)
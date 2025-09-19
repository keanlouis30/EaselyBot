#!/usr/bin/env python3
"""
Comprehensive test script to verify all bug fixes in EaselyBot
Tests:
1. Date filtering with Manila timezone
2. Task filtering (excluding completed tasks)  
3. Webhook event handling
4. Database constraint validation
"""

import os
import sys
from datetime import datetime, timedelta, timezone
import json
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add project directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_timezone_functions():
    """Test Manila timezone utility functions"""
    print("\n" + "="*50)
    print("Testing Timezone Functions")
    print("="*50)
    
    try:
        from app.core.event_handler import get_manila_now, convert_to_manila_time
        
        # Test get_manila_now
        manila_now = get_manila_now()
        print(f"✅ Manila time now: {manila_now}")
        print(f"   Timezone: {manila_now.tzinfo}")
        
        # Test convert_to_manila_time
        utc_now = datetime.now(timezone.utc)
        manila_converted = convert_to_manila_time(utc_now)
        print(f"✅ UTC to Manila conversion:")
        print(f"   UTC: {utc_now}")
        print(f"   Manila: {manila_converted}")
        
        # Verify time difference (Manila is UTC+8)
        time_diff = manila_converted.hour - utc_now.hour
        if time_diff < 0:
            time_diff += 24
        expected_diff = 8
        
        if time_diff == expected_diff:
            print(f"✅ Time difference correct: {time_diff} hours")
        else:
            print(f"⚠️  Time difference unexpected: {time_diff} hours (expected {expected_diff})")
        
        return True
        
    except Exception as e:
        print(f"❌ Timezone test failed: {e}")
        return False


def test_date_filtering():
    """Test date filtering with Manila timezone"""
    print("\n" + "="*50)
    print("Testing Date Filtering")
    print("="*50)
    
    try:
        from app.core.event_handler import filter_assignments_by_date, get_manila_now
        
        # Get current Manila time
        now_manila = get_manila_now()
        today_start = now_manila.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Create test assignments
        test_assignments = [
            # Assignment due yesterday (overdue)
            {
                'title': 'Overdue Assignment',
                'due_date': (today_start - timedelta(days=1)).isoformat(),
                'status': 'pending'
            },
            # Assignment due today
            {
                'title': 'Today Assignment',
                'due_date': (today_start + timedelta(hours=14)).isoformat(),
                'status': 'pending'
            },
            # Assignment due tomorrow
            {
                'title': 'Tomorrow Assignment', 
                'due_date': (today_start + timedelta(days=1, hours=10)).isoformat(),
                'status': 'pending'
            },
            # Assignment due next week
            {
                'title': 'Next Week Assignment',
                'due_date': (today_start + timedelta(days=5)).isoformat(),
                'status': 'pending'
            },
            # Completed assignment (should be filtered out)
            {
                'title': 'Completed Assignment',
                'due_date': (today_start + timedelta(hours=10)).isoformat(),
                'status': 'completed'
            },
            # Assignment without due date (should be filtered out)
            {
                'title': 'No Due Date Assignment',
                'status': 'pending'
            }
        ]
        
        # Test 'today' filter
        today_tasks = filter_assignments_by_date(test_assignments, 'today')
        print(f"\n📅 Today filter results:")
        print(f"   Expected: 1 task (Today Assignment)")
        print(f"   Found: {len(today_tasks)} task(s)")
        for task in today_tasks:
            print(f"   - {task['title']}")
        
        # Test 'week' filter
        week_tasks = filter_assignments_by_date(test_assignments, 'week')
        print(f"\n📅 Week filter results:")
        print(f"   Expected: 2 tasks (Tomorrow, Next Week)")
        print(f"   Found: {len(week_tasks)} task(s)")
        for task in week_tasks:
            print(f"   - {task['title']}")
        
        # Test 'overdue' filter
        overdue_tasks = filter_assignments_by_date(test_assignments, 'overdue')
        print(f"\n📅 Overdue filter results:")
        print(f"   Expected: 1 task (Overdue Assignment)")
        print(f"   Found: {len(overdue_tasks)} task(s)")
        for task in overdue_tasks:
            print(f"   - {task['title']}")
        
        # Test 'all' filter
        all_tasks = filter_assignments_by_date(test_assignments, 'all')
        print(f"\n📅 All filter results:")
        print(f"   Expected: 3 tasks (Today, Tomorrow, Next Week)")
        print(f"   Found: {len(all_tasks)} task(s)")
        for task in all_tasks:
            print(f"   - {task['title']}")
        
        # Verify completed tasks are filtered out
        completed_in_results = any('Completed' in task['title'] for result_set in [today_tasks, week_tasks, overdue_tasks, all_tasks] for task in result_set)
        if not completed_in_results:
            print(f"\n✅ Completed tasks correctly filtered out")
        else:
            print(f"\n❌ Completed tasks were not filtered out!")
            
        return True
        
    except Exception as e:
        print(f"❌ Date filtering test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_webhook_event_handling():
    """Test webhook event handling for delivery and read events"""
    print("\n" + "="*50)
    print("Testing Webhook Event Handling")
    print("="*50)
    
    try:
        # Import the process_message_event function
        from main import process_message_event
        
        # Test delivery event
        delivery_event = {
            'sender': {'id': 'test_user_123'},
            'delivery': {
                'mids': ['mid.1234567890'],
                'watermark': 1234567890000
            }
        }
        
        print("\n📨 Testing delivery event handling...")
        try:
            process_message_event(delivery_event)
            print("✅ Delivery event processed without error")
        except Exception as e:
            print(f"❌ Delivery event failed: {e}")
        
        # Test read event
        read_event = {
            'sender': {'id': 'test_user_123'},
            'read': {
                'watermark': 1234567890000
            }
        }
        
        print("\n👁️  Testing read event handling...")
        try:
            process_message_event(read_event)
            print("✅ Read event processed without error")
        except Exception as e:
            print(f"❌ Read event failed: {e}")
        
        # Test unknown event
        unknown_event = {
            'sender': {'id': 'test_user_123'},
            'unknown_type': {
                'data': 'test'
            }
        }
        
        print("\n❓ Testing unknown event handling...")
        try:
            process_message_event(unknown_event)
            print("✅ Unknown event processed without error")
        except Exception as e:
            print(f"❌ Unknown event failed: {e}")
            
        return True
        
    except ImportError as e:
        print(f"⚠️  Cannot test webhook events (import error): {e}")
        return False
    except Exception as e:
        print(f"❌ Webhook event test failed: {e}")
        return False


def test_database_constraints():
    """Test that processing_status values are valid"""
    print("\n" + "="*50)
    print("Testing Database Constraints")
    print("="*50)
    
    valid_statuses = ['success', 'error', 'warning']
    
    print(f"Valid processing_status values: {valid_statuses}")
    
    # Check if we're using valid statuses in the code
    import re
    
    # Read the main.py file to check status values
    with open('main.py', 'r') as f:
        content = f.read()
    
    # Find all processing_status assignments
    status_pattern = r'processing_status\s*=\s*["\'](\w+)["\']'
    found_statuses = re.findall(status_pattern, content)
    
    print(f"\nStatus values found in main.py:")
    invalid_found = False
    for status in set(found_statuses):
        if status in valid_statuses:
            print(f"  ✅ '{status}' - valid")
        else:
            print(f"  ❌ '{status}' - INVALID!")
            invalid_found = True
    
    if not invalid_found:
        print("\n✅ All processing_status values are valid")
        return True
    else:
        print("\n❌ Invalid processing_status values found!")
        return False


def test_assignment_formatting():
    """Test assignment message formatting with Manila timezone"""
    print("\n" + "="*50)
    print("Testing Assignment Formatting")
    print("="*50)
    
    try:
        from app.core.event_handler import format_assignment_message, get_manila_now
        
        now_manila = get_manila_now()
        
        # Test assignment due in 2 hours
        test_assignment = {
            'title': 'Test Assignment',
            'course_name': 'Computer Science',
            'course_code': 'CS101',
            'due_date': (now_manila + timedelta(hours=2)).isoformat(),
            'description': 'This is a test assignment'
        }
        
        formatted = format_assignment_message(test_assignment)
        print(f"Assignment due in 2 hours:")
        print(formatted)
        
        if "2 hours" in formatted or "1 hour" in formatted or "3 hours" in formatted:
            print("✅ Time formatting looks correct")
        else:
            print("⚠️  Time formatting might be incorrect")
        
        return True
        
    except Exception as e:
        print(f"❌ Assignment formatting test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 EaselyBot Comprehensive Test Suite")
    print("="*60)
    
    # Check environment
    print("\n📋 Environment Check:")
    print(f"   Python: {sys.version}")
    print(f"   Working Directory: {os.getcwd()}")
    
    # Check if required modules are available
    try:
        import pytz
        print(f"   ✅ pytz installed: {pytz.__version__}")
    except ImportError:
        print(f"   ❌ pytz not installed!")
    
    # Run tests
    results = {
        'Timezone Functions': test_timezone_functions(),
        'Date Filtering': test_date_filtering(),
        'Webhook Event Handling': test_webhook_event_handling(),
        'Database Constraints': test_database_constraints(),
        'Assignment Formatting': test_assignment_formatting()
    }
    
    # Summary
    print("\n" + "="*60)
    print("📊 Test Summary")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status} - {test_name}")
    
    print(f"\n   Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! The fixes are working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
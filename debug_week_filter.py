#!/usr/bin/env python3
"""
Debug script to test why "This Week" is showing old assignments
and why messages are truncated with "... and 5 more"
"""

import sys
import os
from datetime import datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_filter_logic():
    """Test the filter_assignments_by_date function with mock data"""
    from app.core.event_handler import filter_assignments_by_date, get_manila_now
    
    now_manila = get_manila_now()
    print(f"Current Manila time: {now_manila}")
    print(f"Today starts at: {now_manila.replace(hour=0, minute=0, second=0, microsecond=0)}")
    print("")
    
    # Create test assignments including past ones
    test_assignments = [
        # Very old assignment (1040 days ago)
        {
            'title': 'NSTP Form (1040 days old)',
            'due_date': (now_manila - timedelta(days=1040)).isoformat(),
            'course_name': 'NSTP101',
            'status': 'pending'
        },
        # 234 days ago
        {
            'title': 'Reflection Videos (234 days old)',
            'due_date': (now_manila - timedelta(days=234)).isoformat(),
            'course_name': 'LCENWRD',
            'status': 'pending'
        },
        # 7 days ago
        {
            'title': 'Lab 1 (7 days old)',
            'due_date': (now_manila - timedelta(days=7)).isoformat(),
            'course_name': 'NSCOM03',
            'status': 'pending'
        },
        # Today
        {
            'title': 'Lab 2 (Due Today)',
            'due_date': (now_manila + timedelta(hours=2)).isoformat(),
            'course_name': 'NSCOM03',
            'status': 'pending'
        },
        # Tomorrow
        {
            'title': 'Research 3 (Due Tomorrow)',
            'due_date': (now_manila + timedelta(days=1, hours=10)).isoformat(),
            'course_name': 'NSCOM03',
            'status': 'pending'
        },
        # In 5 days
        {
            'title': 'Final Project (In 5 days)',
            'due_date': (now_manila + timedelta(days=5)).isoformat(),
            'course_name': 'CS401',
            'status': 'pending'
        }
    ]
    
    print("Test Assignments Created:")
    for assignment in test_assignments:
        print(f"  - {assignment['title']}")
    print("")
    
    # Test 'week' filter
    print("=" * 60)
    print("Testing 'week' filter (should show Today + Next 7 days):")
    print("=" * 60)
    week_filtered = filter_assignments_by_date(test_assignments, 'week')
    print(f"Found {len(week_filtered)} assignments:")
    for assignment in week_filtered:
        print(f"  ✓ {assignment['title']}")
    
    # Check if any old assignments leaked through
    for assignment in week_filtered:
        if '(7 days old)' in assignment['title'] or '(234 days old)' in assignment['title'] or '(1040 days old)' in assignment['title']:
            print(f"  ❌ ERROR: Old assignment in week filter: {assignment['title']}")
    
    print("")
    
    # Test 'today' filter  
    print("=" * 60)
    print("Testing 'today' filter (should show only today):")
    print("=" * 60)
    today_filtered = filter_assignments_by_date(test_assignments, 'today')
    print(f"Found {len(today_filtered)} assignments:")
    for assignment in today_filtered:
        print(f"  ✓ {assignment['title']}")
    
    print("")
    
    # Test 'overdue' filter
    print("=" * 60)
    print("Testing 'overdue' filter (should show past assignments):")
    print("=" * 60)
    overdue_filtered = filter_assignments_by_date(test_assignments, 'overdue')
    print(f"Found {len(overdue_filtered)} assignments:")
    for assignment in overdue_filtered:
        print(f"  ✓ {assignment['title']}")


def test_canvas_api_fetch():
    """Test what the Canvas API is actually returning"""
    print("\n" + "=" * 60)
    print("Testing Canvas API fetch_user_assignments")
    print("=" * 60)
    
    # Mock the Canvas API
    from unittest.mock import Mock
    import app.api.canvas_api as canvas_module
    
    # Create mock assignments with various dates
    mock_assignments = []
    now = datetime.now(timezone.utc)
    
    # Add old assignments (these should NOT be returned)
    for days_ago in [1040, 234, 100, 50, 10, 5, 1]:
        mock_assignments.append({
            'id': f'old_{days_ago}',
            'title': f'Old Assignment ({days_ago} days ago)',
            'due_date': (now - timedelta(days=days_ago)).isoformat(),
            'course_name': 'Old Course'
        })
    
    # Add future assignments (these SHOULD be returned)
    for days_ahead in [0, 1, 3, 5, 7, 10]:
        mock_assignments.append({
            'id': f'future_{days_ahead}',
            'title': f'Future Assignment (in {days_ahead} days)',
            'due_date': (now + timedelta(days=days_ahead)).isoformat(),
            'course_name': 'Current Course'
        })
    
    print(f"Created {len(mock_assignments)} mock assignments")
    print(f"  - {len([a for a in mock_assignments if 'old_' in a['id']])} old/overdue")
    print(f"  - {len([a for a in mock_assignments if 'future_' in a['id']])} current/future")
    
    # Mock the canvas client
    mock_client = Mock()
    mock_client.get_assignments.return_value = mock_assignments
    mock_client.get_upcoming_assignments.return_value = mock_assignments  # This is the problem!
    
    original_client = canvas_module.canvas_client
    canvas_module.canvas_client = mock_client
    
    # Test fetch
    from app.api.canvas_api import fetch_user_assignments
    result = fetch_user_assignments('test_token')
    
    print(f"\nfetch_user_assignments returned {len(result)} assignments:")
    old_count = 0
    future_count = 0
    for assignment in result:
        if 'old_' in str(assignment.get('id', '')):
            old_count += 1
            print(f"  ❌ OLD: {assignment['title']}")
        else:
            future_count += 1
            print(f"  ✓ OK: {assignment['title']}")
    
    print(f"\nSummary:")
    print(f"  Old assignments (should be 0): {old_count}")
    print(f"  Future assignments: {future_count}")
    
    if old_count > 0:
        print("\n⚠️  ERROR: Canvas API is returning OLD/OVERDUE assignments!")
        print("This is why 'This Week' shows assignments from 1040 days ago!")
    
    # Restore
    canvas_module.canvas_client = original_client


def main():
    """Run all debug tests"""
    print("\n" + "="*70)
    print("🔍 Debugging Week Filter and Assignment Issues")
    print("="*70)
    
    test_filter_logic()
    test_canvas_api_fetch()
    
    print("\n" + "="*70)
    print("📊 Debug Summary")
    print("="*70)
    print("\nIssues Found:")
    print("1. Canvas API's get_upcoming_assignments includes PAST assignments")
    print("2. This causes 'This Week' to show very old overdue tasks")
    print("3. The '... and 5 more' might be Facebook's message limit")
    print("\nThe fix should:")
    print("- Make get_upcoming_assignments exclude past dates")
    print("- Ensure filter_assignments_by_date works correctly") 
    print("- Consider breaking very long lists into batches")


if __name__ == "__main__":
    main()
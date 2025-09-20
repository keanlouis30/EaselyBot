#!/usr/bin/env python3
"""
Comprehensive debugging script for Canvas API direct fetching
This will help identify why assignments might not be showing up
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging
from datetime import datetime, timezone, timedelta
import pytz
import json

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def debug_canvas_api(token):
    """Debug the Canvas API to see what's being returned"""
    
    print("=" * 80)
    print("CANVAS API DEBUGGING - DIRECT FETCH")
    print("=" * 80)
    
    from app.api.canvas_api import canvas_client
    from app.core.event_handler import (
        fetch_and_filter_canvas_assignments,
        filter_assignments_by_date,
        get_manila_now,
        convert_to_manila_time
    )
    
    # Step 1: Test raw API connection
    print("\n1. Testing Canvas API Connection:")
    print("-" * 40)
    try:
        validation = canvas_client.validate_token(token)
        if validation['valid']:
            print(f"✅ Token is valid")
            print(f"   User: {validation['user_info']['name']}")
            print(f"   ID: {validation['user_info']['id']}")
        else:
            print(f"❌ Token validation failed: {validation.get('error_message')}")
            return
    except Exception as e:
        print(f"❌ Error validating token: {str(e)}")
        return
    
    # Step 2: Get courses with detailed info
    print("\n2. Fetching All Courses (with pagination):")
    print("-" * 40)
    try:
        courses = canvas_client.get_user_courses(token)
        print(f"✅ Found {len(courses)} active courses:")
        for i, course in enumerate(courses, 1):
            print(f"   {i}. {course['name']} (ID: {course['id']}, Code: {course['course_code']})")
    except Exception as e:
        print(f"❌ Error fetching courses: {str(e)}")
        return
    
    # Step 3: Get raw assignments without any filtering
    print("\n3. Fetching ALL Assignments (Raw API Call):")
    print("-" * 40)
    try:
        all_assignments = canvas_client.get_assignments(token, limit=500)
        print(f"✅ Total assignments found: {len(all_assignments)}")
        
        # Analyze the assignments
        if all_assignments:
            # Show first few assignments
            print("\n   First 5 assignments (raw data):")
            for i, assignment in enumerate(all_assignments[:5], 1):
                print(f"\n   Assignment {i}:")
                print(f"      Title: {assignment.get('title')}")
                print(f"      Course: {assignment.get('course_name')}")
                print(f"      Due Date: {assignment.get('due_date')}")
                print(f"      ID: {assignment.get('id')}")
                if 'status' in assignment:
                    print(f"      Status: {assignment.get('status')}")
                if 'submission' in assignment:
                    print(f"      Submission: {assignment.get('submission')}")
        else:
            print("   ⚠️  No assignments found!")
    except Exception as e:
        print(f"❌ Error fetching assignments: {str(e)}")
        import traceback
        traceback.print_exc()
        return
    
    # Step 4: Test date filtering
    print("\n4. Testing Date Filtering:")
    print("-" * 40)
    
    # Get current time info
    now_manila = get_manila_now()
    today_start = now_manila.replace(hour=0, minute=0, second=0, microsecond=0)
    
    print(f"   Current Manila time: {now_manila}")
    print(f"   Today starts at: {today_start}")
    
    # Count assignments by date category
    overdue_count = 0
    today_count = 0
    this_week_count = 0
    future_count = 0
    no_date_count = 0
    
    # Calculate week end
    days_until_sunday = (6 - now_manila.weekday()) % 7
    if days_until_sunday == 0:
        days_until_sunday = 0
    week_end = today_start + timedelta(days=days_until_sunday, hours=23, minutes=59, seconds=59)
    
    print(f"   Week ends at: {week_end}")
    
    # Detailed assignment analysis
    print("\n5. Detailed Assignment Analysis:")
    print("-" * 40)
    
    if all_assignments:
        for assignment in all_assignments:
            if not assignment.get('due_date'):
                no_date_count += 1
            else:
                try:
                    due_date_utc = datetime.fromisoformat(assignment['due_date'].replace('Z', '+00:00'))
                    due_date_manila = convert_to_manila_time(due_date_utc)
                    
                    if due_date_manila < today_start:
                        overdue_count += 1
                    elif today_start <= due_date_manila <= today_start.replace(hour=23, minute=59, second=59):
                        today_count += 1
                        print(f"   📅 TODAY: {assignment['title']} - Due: {due_date_manila}")
                    elif today_start <= due_date_manila <= week_end:
                        this_week_count += 1
                        print(f"   📆 THIS WEEK: {assignment['title']} - Due: {due_date_manila}")
                    else:
                        future_count += 1
                        if future_count <= 3:  # Show first 3 future assignments
                            print(f"   🔮 FUTURE: {assignment['title']} - Due: {due_date_manila}")
                except Exception as e:
                    print(f"   ⚠️  Error parsing date for {assignment['title']}: {e}")
                    no_date_count += 1
    
    print(f"\n   Summary:")
    print(f"   - Overdue: {overdue_count}")
    print(f"   - Due today: {today_count}")
    print(f"   - Due this week: {this_week_count}")
    print(f"   - Future (beyond this week): {future_count}")
    print(f"   - No due date: {no_date_count}")
    print(f"   - TOTAL: {len(all_assignments) if all_assignments else 0}")
    
    # Step 5: Test the fetch_and_filter function
    print("\n6. Testing fetch_and_filter_canvas_assignments:")
    print("-" * 40)
    
    filters = ['all', 'today', 'week', 'overdue']
    for filter_type in filters:
        try:
            filtered = fetch_and_filter_canvas_assignments(token, filter_type)
            print(f"   '{filter_type}' filter: {len(filtered)} assignments")
            if filtered and len(filtered) <= 3:
                for assignment in filtered:
                    print(f"      - {assignment['title']}")
        except Exception as e:
            print(f"   ❌ Error with '{filter_type}' filter: {str(e)}")
    
    # Step 6: Check for specific date ranges
    print("\n7. Looking for assignments in specific date ranges:")
    print("-" * 40)
    
    # Look for assignments in the next 30 days
    future_30_days = today_start + timedelta(days=30)
    count_next_30 = 0
    
    if all_assignments:
        for assignment in all_assignments:
            if assignment.get('due_date'):
                try:
                    due_date_utc = datetime.fromisoformat(assignment['due_date'].replace('Z', '+00:00'))
                    due_date_manila = convert_to_manila_time(due_date_utc)
                    
                    if today_start <= due_date_manila <= future_30_days:
                        count_next_30 += 1
                        if count_next_30 <= 5:  # Show first 5
                            days_away = (due_date_manila.date() - today_start.date()).days
                            print(f"   {assignment['title']} - Due in {days_away} days ({due_date_manila.strftime('%m/%d')})")
                except:
                    pass
    
    print(f"\n   Total assignments in next 30 days: {count_next_30}")
    
    # Step 7: Check pagination
    print("\n8. Verifying Pagination is Working:")
    print("-" * 40)
    
    # Check if we're getting all pages by looking at course assignment counts
    for course in courses[:3]:  # Check first 3 courses
        try:
            # Direct API call to get assignments for one course
            course_assignments = canvas_client._make_request(
                token,
                f'courses/{course["id"]}/assignments',
                params={'per_page': 100},
                paginate=True
            )
            if course_assignments:
                print(f"   {course['name']}: {len(course_assignments)} assignments")
        except:
            print(f"   {course['name']}: Error fetching")
    
    print("\n" + "=" * 80)
    print("DEBUGGING COMPLETE")
    print("=" * 80)


def main():
    """Main function to run debugging"""
    print("\n🔍 Canvas API Direct Fetch Debugger")
    print("This will help identify why assignments might not be showing up\n")
    
    # Get token from environment or ask user
    token = input("Please enter your Canvas access token: ").strip()
    
    if not token:
        print("❌ No token provided. Exiting.")
        return
    
    debug_canvas_api(token)
    
    print("\n✅ Debugging complete!")
    print("Review the output above to identify any issues with assignment fetching.")


if __name__ == "__main__":
    main()
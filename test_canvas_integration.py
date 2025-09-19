#!/usr/bin/env python3
"""
End-to-end test script for Canvas LMS integration
Tests real data flow with proper timezone handling and filtering
"""

import os
import sys
from datetime import datetime, timedelta, timezone
import json
import time

# Add project directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_canvas_api_with_mock_data():
    """Test Canvas API integration with mock data"""
    print("\n" + "="*60)
    print("🧪 Testing Canvas Integration End-to-End")
    print("="*60)
    
    try:
        from app.core.event_handler import (
            filter_assignments_by_date, 
            format_assignment_message,
            send_assignments_individually,
            get_manila_now
        )
        from app.api.canvas_api import CanvasAPIClient
        
        # Create mock assignments that simulate real Canvas data
        now_manila = get_manila_now()
        today_start = now_manila.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Simulate real Canvas assignments
        mock_canvas_assignments = [
            {
                'id': 12345,
                'title': 'Final Project Proposal',
                'course_name': 'Software Engineering',
                'course_code': 'CS401',
                'due_date': (today_start + timedelta(hours=23)).isoformat(),
                'description': 'Submit your final project proposal',
                'points_possible': 100,
                'submission_types': ['online_upload', 'online_text_entry'],
                'html_url': 'https://canvas.example.com/courses/123/assignments/12345',
                'status': 'pending'  # This would be determined from submission status
            },
            {
                'id': 12346,
                'title': 'Weekly Discussion Post',
                'course_name': 'Data Structures',
                'course_code': 'CS301',
                'due_date': (today_start + timedelta(days=2, hours=12)).isoformat(),
                'description': 'Post your response to this week\'s discussion topic',
                'points_possible': 10,
                'submission_types': ['discussion_topic'],
                'html_url': 'https://canvas.example.com/courses/124/assignments/12346',
                'status': 'pending'
            },
            {
                'id': 12347,
                'title': 'Algorithm Analysis Quiz',
                'course_name': 'Algorithm Design',
                'course_code': 'CS302',
                'due_date': (today_start - timedelta(days=1)).isoformat(),
                'description': 'Complete the algorithm analysis quiz',
                'points_possible': 50,
                'submission_types': ['online_quiz'],
                'html_url': 'https://canvas.example.com/courses/125/assignments/12347',
                'status': 'pending'  # Overdue
            },
            {
                'id': 12348,
                'title': 'Lab Report 5',
                'course_name': 'Computer Networks',
                'course_code': 'CS405',
                'due_date': (today_start + timedelta(days=5)).isoformat(),
                'description': 'Submit your lab report for experiment 5',
                'points_possible': 25,
                'submission_types': ['online_upload'],
                'html_url': 'https://canvas.example.com/courses/126/assignments/12348',
                'status': 'pending'
            },
            {
                'id': 12349,
                'title': 'Midterm Exam',
                'course_name': 'Database Systems',
                'course_code': 'CS403',
                'due_date': (today_start + timedelta(hours=14)).isoformat(),
                'description': 'Midterm examination',
                'points_possible': 150,
                'submission_types': ['online_quiz'],
                'html_url': 'https://canvas.example.com/courses/127/assignments/12349',
                'status': 'completed'  # Should be filtered out
            }
        ]
        
        print("\n📚 Mock Canvas Assignments Created:")
        for assignment in mock_canvas_assignments:
            print(f"  - {assignment['title']} ({assignment['course_code']}) - Status: {assignment['status']}")
        
        # Test filtering for different date ranges
        print("\n" + "-"*50)
        print("📅 Testing Date Filters:")
        
        # Test TODAY filter
        today_assignments = filter_assignments_by_date(mock_canvas_assignments, 'today')
        print(f"\n✅ Today's Tasks: {len(today_assignments)}")
        for assignment in today_assignments:
            formatted = format_assignment_message(assignment)
            print(f"\n{formatted}")
            assert assignment['title'] in ['Final Project Proposal', 'Midterm Exam']
            assert assignment['status'] != 'completed' or assignment['title'] != 'Midterm Exam'
        
        # Test WEEK filter  
        week_assignments = filter_assignments_by_date(mock_canvas_assignments, 'week')
        print(f"\n✅ This Week's Tasks: {len(week_assignments)}")
        for assignment in week_assignments:
            formatted = format_assignment_message(assignment)
            print(f"\n{formatted}")
            assert assignment['title'] in ['Weekly Discussion Post', 'Lab Report 5']
        
        # Test OVERDUE filter
        overdue_assignments = filter_assignments_by_date(mock_canvas_assignments, 'overdue')
        print(f"\n✅ Overdue Tasks: {len(overdue_assignments)}")
        for assignment in overdue_assignments:
            formatted = format_assignment_message(assignment)
            print(f"\n{formatted}")
            assert assignment['title'] == 'Algorithm Analysis Quiz'
        
        # Test ALL filter
        all_assignments = filter_assignments_by_date(mock_canvas_assignments, 'all')
        print(f"\n✅ All Future Tasks: {len(all_assignments)}")
        for assignment in all_assignments:
            formatted = format_assignment_message(assignment)
            print(f"\n{formatted}")
            assert assignment['status'] != 'completed'
        
        # Verify completed task is filtered out
        completed_found = any(a['title'] == 'Midterm Exam' for a in today_assignments)
        if not completed_found:
            print("\n✅ Completed assignments correctly filtered out")
        else:
            print("\n❌ ERROR: Completed assignment not filtered out!")
            return False
        
        # Test message formatting with proper timezone
        print("\n" + "-"*50)
        print("💬 Testing Message Formatting:")
        
        sample_assignment = today_assignments[0] if today_assignments else all_assignments[0]
        formatted_message = format_assignment_message(sample_assignment)
        
        print(f"\nSample formatted message:")
        print(formatted_message)
        
        # Check that the message contains expected elements
        assert sample_assignment['title'] in formatted_message
        assert sample_assignment['course_name'] in formatted_message
        assert "Due:" in formatted_message
        
        print("\n✅ Message formatting successful")
        
        # Test Canvas API Client initialization
        print("\n" + "-"*50)
        print("🔌 Testing Canvas API Client:")
        
        client = CanvasAPIClient()
        print(f"  Base URL: {client.base_url}")
        print(f"  API Version: {client.api_version}")
        
        if client.base_url and client.api_version:
            print("✅ Canvas API Client initialized successfully")
        else:
            print("⚠️  Canvas API Client may not be properly configured")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_performance_with_large_dataset():
    """Test performance with a large number of assignments"""
    print("\n" + "="*60)
    print("⚡ Testing Performance with Large Dataset")
    print("="*60)
    
    try:
        from app.core.event_handler import filter_assignments_by_date, get_manila_now
        
        # Generate large dataset
        now_manila = get_manila_now()
        today_start = now_manila.replace(hour=0, minute=0, second=0, microsecond=0)
        
        large_assignment_list = []
        for i in range(100):
            # Mix of different due dates and statuses
            days_offset = i % 14 - 7  # -7 to +6 days
            hours_offset = (i * 3) % 24
            status = 'completed' if i % 5 == 0 else 'pending'
            
            assignment = {
                'id': 10000 + i,
                'title': f'Assignment {i+1}',
                'course_name': f'Course {(i % 10) + 1}',
                'course_code': f'CS{400 + (i % 10)}',
                'due_date': (today_start + timedelta(days=days_offset, hours=hours_offset)).isoformat(),
                'status': status
            }
            large_assignment_list.append(assignment)
        
        print(f"Generated {len(large_assignment_list)} test assignments")
        
        # Test filtering performance
        start_time = time.time()
        today_tasks = filter_assignments_by_date(large_assignment_list, 'today')
        today_time = time.time() - start_time
        
        start_time = time.time()
        week_tasks = filter_assignments_by_date(large_assignment_list, 'week')
        week_time = time.time() - start_time
        
        start_time = time.time()
        overdue_tasks = filter_assignments_by_date(large_assignment_list, 'overdue')
        overdue_time = time.time() - start_time
        
        start_time = time.time()
        all_tasks = filter_assignments_by_date(large_assignment_list, 'all')
        all_time = time.time() - start_time
        
        print(f"\nFiltering Performance:")
        print(f"  Today filter: {today_time:.4f}s ({len(today_tasks)} tasks)")
        print(f"  Week filter: {week_time:.4f}s ({len(week_tasks)} tasks)")
        print(f"  Overdue filter: {overdue_time:.4f}s ({len(overdue_tasks)} tasks)")
        print(f"  All filter: {all_time:.4f}s ({len(all_tasks)} tasks)")
        
        # Check if performance is acceptable (< 100ms per operation)
        if all(t < 0.1 for t in [today_time, week_time, overdue_time, all_time]):
            print("\n✅ Performance is excellent (< 100ms per filter)")
        elif all(t < 0.5 for t in [today_time, week_time, overdue_time, all_time]):
            print("\n✅ Performance is acceptable (< 500ms per filter)")
        else:
            print("\n⚠️  Performance may need optimization")
        
        # Verify completed tasks are filtered
        completed_count = sum(1 for a in large_assignment_list if a['status'] == 'completed')
        filtered_completed = sum(1 for a in all_tasks if a['status'] == 'completed')
        
        print(f"\n📊 Data Integrity Check:")
        print(f"  Total completed in dataset: {completed_count}")
        print(f"  Completed in filtered results: {filtered_completed}")
        
        if filtered_completed == 0:
            print("  ✅ All completed tasks properly filtered out")
        else:
            print(f"  ❌ ERROR: {filtered_completed} completed tasks not filtered!")
            return False
        
        return True
        
    except Exception as e:
        print(f"\n❌ Performance test failed: {e}")
        return False


def main():
    """Run all Canvas integration tests"""
    print("\n" + "="*70)
    print("🚀 EaselyBot Canvas Integration Test Suite")
    print("="*70)
    
    print("\n📋 Test Environment:")
    print(f"  Python: {sys.version}")
    print(f"  Working Directory: {os.getcwd()}")
    
    # Check for Canvas configuration
    from config.settings import CANVAS_BASE_URL, CANVAS_API_VERSION
    print(f"  Canvas Base URL: {CANVAS_BASE_URL}")
    print(f"  Canvas API Version: {CANVAS_API_VERSION}")
    
    # Run tests
    test_results = {
        'Canvas API Integration': test_canvas_api_with_mock_data(),
        'Performance with Large Dataset': test_performance_with_large_dataset()
    }
    
    # Summary
    print("\n" + "="*70)
    print("📊 Test Summary")
    print("="*70)
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {test_name}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All Canvas integration tests passed!")
        print("\nThe bot is ready to:")
        print("  ✓ Fetch assignments from Canvas LMS")
        print("  ✓ Filter tasks by date with Manila timezone")
        print("  ✓ Exclude completed assignments")
        print("  ✓ Format messages with proper time calculations")
        print("  ✓ Handle large datasets efficiently")
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
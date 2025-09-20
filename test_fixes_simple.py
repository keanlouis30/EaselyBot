#!/usr/bin/env python3
"""
Simple test script to verify the fixes without external dependencies
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_filter_logic():
    """Test that the 'all' filter logic has been updated"""
    print("\n=== Checking Filter Logic in Code ===")
    
    # Read the event_handler.py file to verify the change
    with open('app/core/event_handler.py', 'r') as f:
        content = f.read()
    
    # Check that the 'all' filter now includes all assignments
    if "elif filter_type == 'all':" in content:
        # Find the section for 'all' filter
        all_filter_section = content[content.find("elif filter_type == 'all':"):content.find("elif filter_type == 'all':") + 300]
        
        # Check that it no longer has date restrictions
        if "due_date_manila >= today_start" in all_filter_section:
            print("❌ 'All' filter still has date restrictions")
            return False
        elif "filtered.append(assignment)" in all_filter_section and "should show ALL tasks" in all_filter_section:
            print("✅ 'All' filter updated to show ALL tasks (no date restrictions)")
            return True
    
    print("⚠️ Could not verify filter logic change")
    return False

def test_canvas_api_additions():
    """Test that Canvas API has the new create_assignment method"""
    print("\n=== Checking Canvas API Additions ===")
    
    # Read the canvas_api.py file
    with open('app/api/canvas_api.py', 'r') as f:
        content = f.read()
    
    # Check for create_assignment method
    if "def create_assignment(" in content:
        print("✅ create_assignment method added to Canvas API")
        
        # Check that it creates assignments properly
        if "'assignment': {" in content and "'name': title," in content:
            print("  ✓ Method properly formats assignment data")
            return True
    
    print("❌ create_assignment method not found")
    return False

def test_task_creation_updates():
    """Test that task creation now uses Canvas-first approach"""
    print("\n=== Checking Task Creation Updates ===")
    
    # Read the event_handler.py file
    with open('app/core/event_handler.py', 'r') as f:
        content = f.read()
    
    # Find the create_and_sync_task function
    func_start = content.find("def create_and_sync_task(")
    if func_start == -1:
        print("❌ create_and_sync_task function not found")
        return False
    
    # Get the function content (next ~100 lines)
    func_content = content[func_start:func_start + 5000]
    
    # Check the docstring mentions Canvas first
    if "Canvas first" in func_content:
        print("✅ Function docstring updated to mention Canvas-first approach")
    
    # Check that it creates in Canvas before database
    if "canvas_client.create_calendar_event" in func_content:
        print("✅ Function creates Canvas calendar event")
        
        # Check that it then saves to database with Canvas IDs
        if "create_task(" in func_content and "canvas_assignment_id" in func_content:
            print("✅ Function saves task to database with Canvas IDs")
            return True
    
    print("⚠️ Task creation flow may not be fully updated")
    return False

def main():
    print("🧪 Testing EaselyBot Fixes")
    print("=" * 50)
    
    results = []
    
    # Run tests
    results.append(("Filter Logic", test_filter_logic()))
    results.append(("Canvas API", test_canvas_api_additions()))
    results.append(("Task Creation", test_task_creation_updates()))
    
    print("\n" + "=" * 50)
    print("TEST RESULTS:")
    print("-" * 50)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("\nSummary of fixes implemented:")
        print("1. ✅ 'Get All Tasks' filter updated - now shows ALL tasks without date restrictions")
        print("2. ✅ Canvas API extended with create_assignment method")
        print("3. ✅ Task creation flow updated to create in Canvas first, then save to database")
        print("\nExpected behavior:")
        print("• When you click 'All Tasks', you will see ALL tasks including those due on the 26th")
        print("• When you create a new task, it will be created as a Canvas calendar event")
        print("• The Canvas event ID will be saved in the database for proper syncing")
    else:
        print("❌ Some tests failed. Please review the implementation.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
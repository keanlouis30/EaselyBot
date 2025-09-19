#!/usr/bin/env python3
"""
Test script to verify the infinite loop bug is fixed
This was the most critical bug - the bot would keep showing tasks forever!
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_no_automatic_menu_after_tasks():
    """Verify that showing tasks doesn't automatically trigger the main menu"""
    print("\n" + "="*60)
    print("🔍 Testing Infinite Loop Prevention")
    print("="*60)
    
    from app.core.event_handler import (
        send_assignments_individually,
        handle_get_tasks_today,
        handle_get_tasks_week
    )
    
    # Track all messenger API calls
    menu_calls = []
    message_calls = []
    
    # Mock the messenger API
    class MockMessengerAPI:
        def send_text_message(self, recipient, text):
            message_calls.append((recipient, text))
            return True
        
        def send_main_menu(self, recipient):
            menu_calls.append(recipient)
            print(f"⚠️  ALERT: Main menu was called for {recipient}")
            return True
        
        def send_typing_indicator(self, recipient, state):
            return True
        
        def send_quick_replies(self, recipient, text, replies):
            menu_calls.append(f"quick_replies_{recipient}")
            print(f"⚠️  ALERT: Quick replies menu shown to {recipient}")
            return True
    
    # Replace the messenger_api
    import app.core.event_handler as eh
    original_api = eh.messenger_api
    eh.messenger_api = MockMessengerAPI()
    
    try:
        # Test 1: Empty assignments
        print("\n📝 Test 1: Empty assignment list")
        send_assignments_individually("user1", [], "Test Header")
        
        # Check messages
        assert len(menu_calls) == 0, "Menu was shown for empty list!"
        assert any("Type 'menu'" in msg[1] for msg in message_calls), "No guidance message"
        print("✅ No automatic menu for empty list")
        
        # Test 2: With assignments
        print("\n📝 Test 2: With assignments")
        menu_calls.clear()
        message_calls.clear()
        
        test_assignments = [
            {
                'title': 'Assignment 1',
                'course_name': 'Course 1',
                'due_date': '2025-09-20T10:00:00Z'
            },
            {
                'title': 'Assignment 2',
                'course_name': 'Course 2',
                'due_date': '2025-09-21T10:00:00Z'
            }
        ]
        
        send_assignments_individually("user2", test_assignments, "Test Tasks")
        
        assert len(menu_calls) == 0, "Menu was shown after assignments!"
        assert any("menu" in msg[1].lower() for msg in message_calls), "No guidance"
        print("✅ No automatic menu after showing tasks")
        
        # Test 3: Error scenarios (mock a Canvas token error)
        print("\n📝 Test 3: Error handling without menu")
        menu_calls.clear()
        message_calls.clear()
        
        # Mock the token function to return None
        def mock_get_token(sender_id):
            return None
        
        original_get_token = eh.get_user_canvas_token
        eh.get_user_canvas_token = mock_get_token
        
        # This should NOT trigger the main menu
        try:
            handle_get_tasks_today("user3")
        except:
            pass  # Ignore errors, we're testing menu behavior
        
        eh.get_user_canvas_token = original_get_token
        
        # Verify no menu was shown
        if len(menu_calls) > 0:
            print(f"❌ ERROR: Menu was shown {len(menu_calls)} times during error!")
            print(f"   Menu calls: {menu_calls}")
            return False
        
        print("✅ No automatic menu on error")
        
        # Test 4: Unknown input handling
        print("\n📝 Test 4: Unrecognized input handling")
        menu_calls.clear()
        message_calls.clear()
        
        # Simulate unrecognized input
        eh.handle_message("user4", "random gibberish text")
        
        if len(menu_calls) > 0:
            print(f"❌ ERROR: Menu shown for unrecognized input!")
            return False
        
        print("✅ No automatic menu for unrecognized input")
        
        return True
        
    finally:
        # Restore original API
        eh.messenger_api = original_api


def simulate_user_interaction():
    """Simulate what was happening before - the infinite loop scenario"""
    print("\n" + "="*60)
    print("🔄 Simulating Previous Bug Scenario")
    print("="*60)
    
    print("\nBEFORE THE FIX:")
    print("1. User clicks '🔥 Due Today'")
    print("2. Bot shows tasks")
    print("3. Bot automatically shows main menu with buttons")
    print("4. User sees menu and clicks '🔥 Due Today' again")
    print("5. Bot shows tasks again")
    print("6. Bot shows menu again...")
    print("♾️  INFINITE LOOP!")
    
    print("\nAFTER THE FIX:")
    print("1. User clicks '🔥 Due Today'")
    print("2. Bot shows tasks")
    print("3. Bot shows simple text: 'Type menu for options'")
    print("4. User can choose to type 'menu' or do something else")
    print("✅ NO LOOP - User has control!")


def main():
    """Run all infinite loop prevention tests"""
    print("\n" + "="*70)
    print("🛡️ Infinite Loop Prevention Test Suite")
    print("="*70)
    
    print("\n⚠️  This tests the CRITICAL bug fix that was causing infinite loops")
    print("   when users viewed their tasks. The bot would keep showing the menu")
    print("   and users would click buttons, causing an endless cycle.")
    
    # Show the simulation
    simulate_user_interaction()
    
    # Run the actual tests
    success = test_no_automatic_menu_after_tasks()
    
    print("\n" + "="*70)
    print("📊 Test Results")
    print("="*70)
    
    if success:
        print("\n🎉 SUCCESS: Infinite loop bug is FIXED!")
        print("\nThe bot will no longer:")
        print("  ❌ Automatically show the main menu after tasks")
        print("  ❌ Show menu after errors")
        print("  ❌ Show menu for unrecognized input")
        print("\nInstead, the bot will:")
        print("  ✅ Show a simple text prompt")
        print("  ✅ Let users decide when to see the menu")
        print("  ✅ Prevent infinite loops completely")
    else:
        print("\n❌ FAILURE: Infinite loop bug still exists!")
        print("   Please review the fixes in app/core/event_handler.py")
    
    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
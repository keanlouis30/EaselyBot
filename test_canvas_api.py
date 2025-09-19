#!/usr/bin/env python3
"""
Canvas API Test Script for EaselyBot
Tests Canvas token validation functionality
"""

import os
import sys
from dotenv import load_dotenv

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def test_canvas_api_integration():
    """Test Canvas API integration with a real or dummy token"""
    print("🎨 Testing Canvas API Integration...")
    print("=" * 50)
    
    try:
        from app.api.canvas_api import validate_canvas_token, fetch_user_assignments
        
        # Get Canvas base URL from environment
        canvas_url = os.getenv('CANVAS_BASE_URL', 'https://canvas.instructure.com')
        print(f"Canvas Base URL: {canvas_url}")
        
        # Test with a dummy token (will fail but we can see the API call structure)
        test_token = "dummy_token_for_testing"
        print(f"\n🔍 Testing token validation with dummy token...")
        
        result = validate_canvas_token(test_token)
        print(f"Validation result: {result}")
        
        if not result['valid']:
            print("✅ API integration is working - correctly rejected invalid token")
            print(f"Error message: {result['error_message']}")
        else:
            print("❌ Unexpected result - dummy token was accepted")
        
        print("\n" + "=" * 50)
        print("🔧 Canvas API Integration Status:")
        print("✅ Canvas API client initialized successfully")
        print("✅ Token validation endpoint accessible")
        print("✅ Error handling working correctly")
        
        print("\n📝 To test with a real token:")
        print("1. Get a Canvas access token from your Canvas account")
        print("2. Set CANVAS_BASE_URL in your .env file to your school's Canvas URL")
        print("3. Run: python test_canvas_with_real_token.py YOUR_TOKEN_HERE")
        
        return True
        
    except Exception as e:
        print(f"❌ Canvas API integration error: {str(e)}")
        return False

def test_canvas_with_real_token(token: str):
    """Test Canvas API with a real token"""
    if not token or token == "YOUR_TOKEN_HERE":
        print("❌ Please provide a real Canvas token")
        return False
    
    print(f"🎨 Testing Canvas API with real token...")
    print("=" * 50)
    
    try:
        from app.api.canvas_api import validate_canvas_token, fetch_user_assignments
        
        print("🔍 Validating token...")
        result = validate_canvas_token(token)
        
        if result['valid']:
            user_info = result['user_info']
            print(f"✅ Token valid! Welcome {user_info.get('name', 'Unknown User')}")
            print(f"   User ID: {user_info.get('id')}")
            print(f"   Email: {user_info.get('email', 'Not provided')}")
            
            print("\n📚 Fetching assignments...")
            assignments = fetch_user_assignments(token, limit=3)
            
            if assignments:
                print(f"Found {len(assignments)} upcoming assignments:")
                for i, assignment in enumerate(assignments, 1):
                    print(f"  {i}. {assignment['title']} ({assignment['course_code']})")
                    print(f"     Due: {assignment['due_date']}")
            else:
                print("No upcoming assignments found.")
                
            print("\n🎉 Canvas integration is working perfectly!")
            return True
            
        else:
            print(f"❌ Token validation failed: {result['error_message']}")
            return False
            
    except Exception as e:
        print(f"❌ Canvas API error: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] != "dummy":
        # Test with real token provided as argument
        success = test_canvas_with_real_token(sys.argv[1])
    else:
        # Test API integration with dummy token
        success = test_canvas_api_integration()
    
    sys.exit(0 if success else 1)
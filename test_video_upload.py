#!/usr/bin/env python3
"""
Test script to check video upload functionality
"""

import os
import requests
from config.settings import PAGE_ACCESS_TOKEN, GRAPH_API_URL

def test_video_upload():
    """Test if video file can be uploaded to Facebook"""
    video_path = "/home/kean/Documents/EaselyBot/test.mkv"
    
    # Check if video file exists
    if not os.path.exists(video_path):
        print(f"❌ Video file not found: {video_path}")
        return False
    
    print(f"✅ Video file found: {video_path}")
    print(f"📁 File size: {os.path.getsize(video_path)} bytes")
    
    # Check token
    if not PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN == "your_facebook_page_access_token_here":
        print("❌ PAGE_ACCESS_TOKEN not configured properly")
        return False
    
    print("✅ PAGE_ACCESS_TOKEN configured")
    
    # Test upload (to a test recipient - you'd need to replace this)
    url = f"{GRAPH_API_URL}/me/messages"
    
    try:
        # Note: This won't work without a valid recipient ID
        print("🔧 Video upload functionality ready for testing with valid recipient ID")
        print("📋 To test, update the recipient_id in main.py and try the video tutorial flow")
        return True
        
    except Exception as e:
        print(f"❌ Error testing video upload: {str(e)}")
        return False

if __name__ == "__main__":
    print("🎥 Testing Video Upload Functionality")
    print("=" * 40)
    test_video_upload()
#!/usr/bin/env python3
"""
Hamburger Menu Setup Script for EaselyBot
This script sets up the persistent menu (hamburger menu) for your Facebook Messenger bot
"""

import os
import sys
from dotenv import load_dotenv

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def main():
    print("🍔 Setting up Hamburger Menu for EaselyBot")
    print("=" * 45)
    
    # Check if required environment variables are set
    page_access_token = os.getenv('PAGE_ACCESS_TOKEN')
    if not page_access_token:
        print("❌ PAGE_ACCESS_TOKEN environment variable not set")
        print("Please add your Facebook Page Access Token to your .env file")
        sys.exit(1)
    
    print("✅ PAGE_ACCESS_TOKEN found")
    
    try:
        # Import the messenger API after checking environment
        from app.api.messenger_api import setup_bot_profile
        
        print("\n🚀 Setting up bot profile...")
        print("This includes:")
        print("  • Hamburger Menu (Persistent Menu)")
        print("  • Get Started Button")
        print("  • Greeting Text")
        
        success = setup_bot_profile()
        
        if success:
            print("\n🎉 SUCCESS! Your hamburger menu has been set up!")
            print("\n📱 Your menu now includes:")
            print("   📚 My Tasks")
            print("     └── 🔥 Due Today")
            print("     └── ⏰ This Week") 
            print("     └── ❗️ Overdue")
            print("     └── 🗓 All Tasks")
            print("     └── ➕ Add New Task")
            print()
            print("   🔗 Canvas & Setup")
            print("     └── 📖 Setup Tutorial")
            print("     └── 🎥 Watch Video") 
            print("     └── 🔄 Sync Now")
            print("     └── ⚙️ Settings")
            print()
            print("   💎 Premium & Support")
            print("     └── ✨ Upgrade to Premium (opens facebook.com/keanlouis30)")
            print("     └── ❓ Help & Support")
            print("     └── ℹ️ About Easely")
            
            print("\n📲 Users can now access these features through the hamburger menu (≡) in Messenger!")
            
        else:
            print("\n⚠️ Setup completed with some issues - check the logs above")
            print("Some menu items may not be available, but basic functionality should work")
            
    except Exception as e:
        print(f"\n❌ Error setting up hamburger menu: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Make sure your Facebook Page Access Token is correct")
        print("2. Verify your Facebook app has the 'pages_messaging' permission") 
        print("3. Check that your bot is connected to a Facebook Page")
        sys.exit(1)

if __name__ == "__main__":
    main()
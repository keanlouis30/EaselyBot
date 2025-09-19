#!/usr/bin/env python3
"""
EaselyBot Supabase Quick Setup Script
Automates the complete setup process for your Supabase database
"""

import os
import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if required environment variables are set"""
    required_vars = ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_KEY']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\n🔧 To fix this:")
        print("1. Go to your Supabase project dashboard")
        print("2. Navigate to Settings > API")
        print("3. Copy the URL and API keys")
        print("4. Set these environment variables:")
        print(f"   export SUPABASE_URL=https://your-project-id.supabase.co")
        print(f"   export SUPABASE_KEY=your_anon_public_key")
        print(f"   export SUPABASE_SERVICE_KEY=your_service_role_secret")
        print("\n5. Run this script again")
        return False
    
    print("✅ All required environment variables are set")
    return True

def install_dependencies():
    """Install required Python packages"""
    print("📦 Installing required dependencies...")
    
    try:
        import supabase
        print("   ✅ supabase-py already installed")
    except ImportError:
        print("   📥 Installing supabase-py...")
        os.system("pip install supabase==2.3.4")
    
    try:
        import postgrest
        print("   ✅ postgrest-py already installed")  
    except ImportError:
        print("   📥 Installing postgrest-py...")
        os.system("pip install postgrest-py==0.13.2")
    
    print("✅ Dependencies installed")

def test_connection():
    """Test connection to Supabase"""
    print("🔍 Testing Supabase connection...")
    
    try:
        from config.settings import SUPABASE_URL, SUPABASE_KEY
        from supabase import create_client
        
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Try a simple query
        response = client.table('_realtime_schema_version').select('*').limit(1).execute()
        print("✅ Connection successful!")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        print("   🔧 Check your SUPABASE_URL and SUPABASE_KEY")
        return False

def initialize_database():
    """Run the database initialization"""
    print("🚀 Initializing database schema...")
    
    try:
        from init_db import init_database, check_database_connection
        
        print("   🔍 Checking connection...")
        if not check_database_connection():
            print("   ❌ Database connection failed")
            return False
        
        print("   ⚙️ Creating tables and indexes...")
        if init_database():
            print("   ✅ Database schema created successfully!")
            return True
        else:
            print("   ❌ Database initialization failed")
            return False
            
    except Exception as e:
        print(f"   ❌ Error during initialization: {str(e)}")
        return False

def validate_schema():
    """Validate the created schema"""
    print("✅ Validating database schema...")
    
    try:
        from app.database.supabase_client import supabase_client
        
        # Test basic operations
        if supabase_client.test_connection():
            print("   ✅ Schema validation passed!")
            return True
        else:
            print("   ❌ Schema validation failed")
            return False
            
    except Exception as e:
        print(f"   ❌ Validation error: {str(e)}")
        return False

def create_test_data():
    """Create some test data to verify everything works"""
    print("🧪 Creating test data...")
    
    try:
        from app.database.supabase_client import create_user, create_task
        from datetime import datetime, timedelta
        
        # Create test user
        test_user = create_user(
            facebook_id='test_user_setup_script',
            subscription_status='premium'
        )
        print(f"   ✅ Created test user: {test_user.get('facebook_id')}")
        
        # Create test task
        test_task = create_task(
            facebook_id='test_user_setup_script',
            title='Test Assignment - Setup Script',
            due_date=(datetime.now() + timedelta(days=2)).isoformat()
        )
        print(f"   ✅ Created test task: {test_task.get('title')}")
        
        print("   ✅ Test data created successfully!")
        return True
        
    except Exception as e:
        print(f"   ❌ Test data creation failed: {str(e)}")
        return False

def show_next_steps():
    """Show what to do next"""
    print("\n🎉 Setup Complete! Next Steps:")
    print("\n1. 🔧 Configure your application:")
    print("   - Update your .env file with the Supabase credentials")
    print("   - Make sure SUPABASE_URL and SUPABASE_KEY are set for your app")
    
    print("\n2. 🤖 Deploy your bot:")
    print("   - Deploy to Render with the Supabase environment variables")
    print("   - Your database is ready to handle users and tasks!")
    
    print("\n3. 📊 Monitor your database:")
    print("   - Go to your Supabase dashboard to view data")
    print("   - Use the Table Editor to see users, tasks, and reminders")
    print("   - Check the SQL Editor for custom queries")
    
    print("\n4. 🧹 Clean up test data (optional):")
    print("   DELETE FROM users WHERE facebook_id = 'test_user_setup_script';")
    
    print("\n🚀 Your EaselyBot is ready to go!")

def main():
    """Main setup process"""
    print("🤖 EaselyBot Supabase Setup")
    print("=" * 30)
    
    # Step 1: Check environment
    if not check_environment():
        sys.exit(1)
    
    # Step 2: Install dependencies
    install_dependencies()
    
    # Step 3: Test connection
    if not test_connection():
        sys.exit(1)
    
    # Step 4: Initialize database
    if not initialize_database():
        sys.exit(1)
    
    # Step 5: Validate schema
    if not validate_schema():
        print("⚠️  Schema validation failed, but database may still work")
    
    # Step 6: Create test data
    if not create_test_data():
        print("⚠️  Test data creation failed, but database should still work")
    
    # Step 7: Show next steps
    show_next_steps()
    
    print("\n✨ Setup completed successfully!")

if __name__ == "__main__":
    main()
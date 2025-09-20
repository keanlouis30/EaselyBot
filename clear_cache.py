#!/usr/bin/env python3
"""
Clear cached assignments to force fresh data fetch
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def clear_assignment_cache():
    """Clear any cached assignment data"""
    try:
        from app.database.supabase_client import supabase_client
        
        # Update last sync time to force refresh
        print("Forcing cache refresh by updating sync timestamps...")
        
        # This will force the next fetch to get fresh data
        result = supabase_client.client.table('users').update({
            'last_canvas_sync': None
        }).neq('facebook_id', '').execute()
        
        print(f"✅ Cleared cache for all users")
        return True
    except Exception as e:
        print(f"❌ Error clearing cache: {e}")
        return False

if __name__ == "__main__":
    if clear_assignment_cache():
        print("\n✅ Cache cleared successfully!")
        print("Next task request will fetch fresh data from Canvas")
        print("This should fix the Sept 24 appearing in 'This Week' issue")
    else:
        print("\n⚠️ Could not clear cache, but the code fixes should still work")
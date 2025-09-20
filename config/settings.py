"""
Configuration Settings Module
Manages environment variables and application configuration
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Facebook Messenger Configuration
PAGE_ACCESS_TOKEN = os.getenv('PAGE_ACCESS_TOKEN', '')
VERIFY_TOKEN = os.getenv('VERIFY_TOKEN', 'easely_webhook_verify_token_2024')
GRAPH_API_URL = os.getenv('GRAPH_API_URL', 'https://graph.facebook.com/v17.0')

# Canvas API Configuration
CANVAS_BASE_URL = os.getenv('CANVAS_BASE_URL', 'https://dlsu.instructure.com')
CANVAS_API_VERSION = os.getenv('CANVAS_API_VERSION', 'v1')

# Database Configuration (Supabase)
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')  # For admin operations

# Legacy PostgreSQL support (for migration purposes)
DATABASE_URL = os.getenv('DATABASE_URL', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'easely_db')
DB_USER = os.getenv('DB_USER', 'easely_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

# Application Configuration
APP_ENV = os.getenv('APP_ENV', 'development')
DEBUG_MODE = os.getenv('DEBUG', 'False').lower() in ['true', '1', 'yes']
PORT = int(os.getenv('PORT', '5000'))
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Payment Configuration (Ko-fi)
KOFI_WEBHOOK_TOKEN = os.getenv('KOFI_WEBHOOK_TOKEN', '')
KOFI_SHOP_URL = os.getenv('KOFI_SHOP_URL', 'https://facebook.com/keanlouis30')

# Feature Flags
ENABLE_AI_FEATURES = os.getenv('ENABLE_AI_FEATURES', 'False').lower() in ['true', '1', 'yes']
ENABLE_PREMIUM = os.getenv('ENABLE_PREMIUM', 'True').lower() in ['true', '1', 'yes']

# Task Management Settings
MAX_FREE_TASKS_PER_MONTH = int(os.getenv('MAX_FREE_TASKS_PER_MONTH', '5'))
REMINDER_INTERVALS_FREE = ['24h']  # 24 hours before due date
REMINDER_INTERVALS_PREMIUM = ['1w', '3d', '1d', '8h', '2h', '1h']  # Full cascade

# Rate Limiting
API_RATE_LIMIT = int(os.getenv('API_RATE_LIMIT', '100'))  # Requests per minute
CANVAS_API_BATCH_SIZE = int(os.getenv('CANVAS_API_BATCH_SIZE', '10'))  # Users per batch

# Logging Configuration
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FILE = os.getenv('LOG_FILE', 'easely.log')

# Webhook URLs (for deployment)
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://your-app.onrender.com/webhook')
PRIVACY_POLICY_URL = os.getenv('PRIVACY_POLICY_URL', 'https://easely.app/privacy')
TERMS_OF_USE_URL = os.getenv('TERMS_OF_USE_URL', 'https://easely.app/terms')
VIDEO_TUTORIAL_URL = os.getenv('VIDEO_TUTORIAL_URL', 'https://easely.app/tutorial')

# Timezone Configuration
DEFAULT_TIMEZONE = os.getenv('DEFAULT_TIMEZONE', 'UTC')

# Validation function to check required settings
def validate_settings():
    """
    Validate that required settings are configured
    Raises ValueError if critical settings are missing
    """
    required_settings = {
        'PAGE_ACCESS_TOKEN': PAGE_ACCESS_TOKEN,
        'VERIFY_TOKEN': VERIFY_TOKEN,
        'SUPABASE_URL': SUPABASE_URL,
        'SUPABASE_KEY': SUPABASE_KEY
    }
    
    missing = [key for key, value in required_settings.items() if not value]
    
    if missing:
        raise ValueError(f"Missing required settings: {', '.join(missing)}")
    
    return True

# Export configuration as dictionary for easy access
CONFIG = {
    'facebook': {
        'page_access_token': PAGE_ACCESS_TOKEN,
        'verify_token': VERIFY_TOKEN,
        'graph_api_url': GRAPH_API_URL
    },
    'canvas': {
        'base_url': CANVAS_BASE_URL,
        'api_version': CANVAS_API_VERSION
    },
    'database': {
        'supabase_url': SUPABASE_URL,
        'supabase_key': SUPABASE_KEY,
        'supabase_service_key': SUPABASE_SERVICE_KEY,
        # Legacy PostgreSQL (for migration)
        'url': DATABASE_URL,
        'host': DB_HOST,
        'port': DB_PORT,
        'name': DB_NAME,
        'user': DB_USER,
        'password': DB_PASSWORD
    },
    'app': {
        'environment': APP_ENV,
        'debug': DEBUG_MODE,
        'port': PORT,
        'secret_key': SECRET_KEY
    },
    'payment': {
        'kofi_webhook_token': KOFI_WEBHOOK_TOKEN,
        'kofi_shop_url': KOFI_SHOP_URL  # Now points to Facebook profile for premium upgrades
    },
    'features': {
        'ai_enabled': ENABLE_AI_FEATURES,
        'premium_enabled': ENABLE_PREMIUM,
        'max_free_tasks': MAX_FREE_TASKS_PER_MONTH
    },
    'reminders': {
        'free': REMINDER_INTERVALS_FREE,
        'premium': REMINDER_INTERVALS_PREMIUM
    },
    'urls': {
        'webhook': WEBHOOK_URL,
        'privacy': PRIVACY_POLICY_URL,
        'terms': TERMS_OF_USE_URL,
        'tutorial': VIDEO_TUTORIAL_URL
    }
}
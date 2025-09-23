/**
 * Configuration Settings Module
 * Manages environment variables and application configuration
 */

require('dotenv').config();

// Facebook Messenger Configuration
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'easely_webhook_verify_token_2024';
const GRAPH_API_URL = process.env.GRAPH_API_URL || 'https://graph.facebook.com/v17.0';

// Canvas API Configuration
const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
const CANVAS_API_VERSION = process.env.CANVAS_API_VERSION || 'v1';

// Database Configuration (Supabase)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''; // For admin operations

// Legacy PostgreSQL support (for migration purposes)
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'easely_db';
const DB_USER = process.env.DB_USER || 'easely_user';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Application Configuration
const APP_ENV = process.env.NODE_ENV || process.env.APP_ENV || 'development';
const IS_PRODUCTION = APP_ENV === 'production';
const IS_RENDER = process.env.RENDER === 'true';
const DEBUG_MODE = IS_PRODUCTION ? false : ['true', '1', 'yes'].includes((process.env.DEBUG_MODE || process.env.DEBUG || 'false').toLowerCase());
const PORT = parseInt(process.env.PORT || '5000', 10);
const SECRET_KEY = process.env.SECRET_KEY || (IS_PRODUCTION ? null : 'dev-secret-key-change-in-production');

// Payment Configuration (Ko-fi)
const KOFI_WEBHOOK_TOKEN = process.env.KOFI_WEBHOOK_TOKEN || '';
const KOFI_SHOP_URL = process.env.KOFI_SHOP_URL || 'https://facebook.com/keanlouis30';

// Feature Flags
const ENABLE_AI_FEATURES = ['true', '1', 'yes'].includes((process.env.ENABLE_AI_FEATURES || 'false').toLowerCase());
const ENABLE_PREMIUM = ['true', '1', 'yes'].includes((process.env.ENABLE_PREMIUM || 'true').toLowerCase());

// Task Management Settings
const MAX_FREE_TASKS_PER_MONTH = parseInt(process.env.MAX_FREE_TASKS_PER_MONTH || '5', 10);
const REMINDER_INTERVALS_FREE = ['24h']; // 24 hours before due date
const REMINDER_INTERVALS_PREMIUM = ['1w', '3d', '1d', '8h', '2h', '1h']; // Full cascade

// Rate Limiting
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '100', 10); // Requests per minute
const CANVAS_API_BATCH_SIZE = parseInt(process.env.CANVAS_API_BATCH_SIZE || '10', 10); // Users per batch

// Logging Configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const LOG_FILE = process.env.LOG_FILE || 'easely.log';

// Webhook URLs (for deployment)
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-app.onrender.com/webhook';
const PRIVACY_POLICY_URL = process.env.PRIVACY_POLICY_URL || 'https://easely.app/privacy';
const TERMS_OF_USE_URL = process.env.TERMS_OF_USE_URL || 'https://easely.app/terms';
const VIDEO_TUTORIAL_URL = process.env.VIDEO_TUTORIAL_URL || 'https://easely.app/tutorial';

// Timezone Configuration
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';

/**
 * Validate that required settings are configured
 * Throws Error if critical settings are missing
 */
function validateSettings() {
    const warnings = [];
    const errors = [];
    
    // Critical settings for all environments
    if (!VERIFY_TOKEN) {
        errors.push('VERIFY_TOKEN');
    }
    if (!PAGE_ACCESS_TOKEN) {
        errors.push('PAGE_ACCESS_TOKEN');
    }
    
    // Database settings (warning only if missing)
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        warnings.push('Supabase configuration (database features will be disabled)');
    }
    
    // Canvas settings (optional)
    if (!CANVAS_BASE_URL) {
        warnings.push('Canvas configuration (Canvas sync features will be disabled)');
    }
    
    // Log warnings
    if (warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:');
        warnings.forEach(w => console.warn(`  - ${w}`));
    }
    
    // In production on Render, be more lenient
    if (IS_RENDER && IS_PRODUCTION) {
        if (errors.length > 0) {
            console.error('❌ Missing critical settings:', errors.join(', '));
            console.log('🔄 Continuing in degraded mode for Render deployment...');
        }
        return true;
    }
    
    // In other environments, fail if critical settings are missing
    if (errors.length > 0) {
        throw new Error(`Missing required settings: ${errors.join(', ')}`);
    }
    
    return true;
}

// Export configuration as object for easy access
const CONFIG = {
    facebook: {
        pageAccessToken: PAGE_ACCESS_TOKEN,
        verifyToken: VERIFY_TOKEN,
        graphApiUrl: GRAPH_API_URL
    },
    canvas: {
        baseUrl: CANVAS_BASE_URL,
        apiVersion: CANVAS_API_VERSION
    },
    database: {
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_KEY,
        supabaseServiceKey: SUPABASE_SERVICE_KEY,
        // Legacy PostgreSQL (for migration)
        url: DATABASE_URL,
        host: DB_HOST,
        port: DB_PORT,
        name: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD
    },
    app: {
        environment: APP_ENV,
        debug: DEBUG_MODE,
        port: PORT,
        secretKey: SECRET_KEY
    },
    payment: {
        kofiWebhookToken: KOFI_WEBHOOK_TOKEN,
        kofiShopUrl: KOFI_SHOP_URL // Now points to Facebook profile for premium upgrades
    },
    features: {
        aiEnabled: ENABLE_AI_FEATURES,
        premiumEnabled: ENABLE_PREMIUM,
        maxFreeTasks: MAX_FREE_TASKS_PER_MONTH
    },
    reminders: {
        free: REMINDER_INTERVALS_FREE,
        premium: REMINDER_INTERVALS_PREMIUM
    },
    urls: {
        webhook: WEBHOOK_URL,
        privacy: PRIVACY_POLICY_URL,
        terms: TERMS_OF_USE_URL,
        tutorial: VIDEO_TUTORIAL_URL
    },
    rateLimit: {
        apiLimit: API_RATE_LIMIT,
        canvasBatchSize: CANVAS_API_BATCH_SIZE
    },
    logging: {
        level: LOG_LEVEL,
        file: LOG_FILE
    },
    timezone: {
        default: DEFAULT_TIMEZONE
    }
};

module.exports = {
    PAGE_ACCESS_TOKEN,
    VERIFY_TOKEN,
    GRAPH_API_URL,
    CANVAS_BASE_URL,
    CANVAS_API_VERSION,
    SUPABASE_URL,
    SUPABASE_KEY,
    SUPABASE_SERVICE_KEY,
    DATABASE_URL,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    APP_ENV,
    DEBUG_MODE,
    PORT,
    SECRET_KEY,
    KOFI_WEBHOOK_TOKEN,
    KOFI_SHOP_URL,
    ENABLE_AI_FEATURES,
    ENABLE_PREMIUM,
    MAX_FREE_TASKS_PER_MONTH,
    REMINDER_INTERVALS_FREE,
    REMINDER_INTERVALS_PREMIUM,
    API_RATE_LIMIT,
    CANVAS_API_BATCH_SIZE,
    LOG_LEVEL,
    LOG_FILE,
    WEBHOOK_URL,
    PRIVACY_POLICY_URL,
    TERMS_OF_USE_URL,
    VIDEO_TUTORIAL_URL,
    DEFAULT_TIMEZONE,
    validateSettings,
    CONFIG
};

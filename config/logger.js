/**
 * Production-Ready Logger Configuration
 * Handles logging for different environments
 */

const { APP_ENV, DEBUG_MODE, LOG_LEVEL } = require('./settings');

// Log levels
const LogLevels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Current log level
const currentLogLevel = LogLevels[LOG_LEVEL] || LogLevels.INFO;

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

/**
 * Format log message with timestamp and level
 */
function formatLogMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (APP_ENV === 'production') {
        // In production, use structured logging for better parsing
        return JSON.stringify({
            timestamp,
            level,
            message,
            data: args.length > 0 ? args : undefined,
            environment: APP_ENV
        });
    }
    
    // In development, use colored console output
    let color = colors.reset;
    switch (level) {
        case 'ERROR':
            color = colors.red;
            break;
        case 'WARN':
            color = colors.yellow;
            break;
        case 'INFO':
            color = colors.green;
            break;
        case 'DEBUG':
            color = colors.cyan;
            break;
    }
    
    return `${color}${prefix}${colors.reset} ${message}`;
}

/**
 * Logger object with production-ready methods
 */
const logger = {
    error: (message, ...args) => {
        if (currentLogLevel >= LogLevels.ERROR) {
            console.error(formatLogMessage('ERROR', message, ...args));
        }
    },
    
    warn: (message, ...args) => {
        if (currentLogLevel >= LogLevels.WARN) {
            console.warn(formatLogMessage('WARN', message, ...args));
        }
    },
    
    info: (message, ...args) => {
        if (currentLogLevel >= LogLevels.INFO) {
            console.log(formatLogMessage('INFO', message, ...args));
        }
    },
    
    debug: (message, ...args) => {
        if (currentLogLevel >= LogLevels.DEBUG && DEBUG_MODE) {
            console.log(formatLogMessage('DEBUG', message, ...args));
        }
    },
    
    // Special method for logging API calls
    api: (method, url, statusCode, duration) => {
        const message = `${method} ${url} ${statusCode} ${duration}ms`;
        if (APP_ENV === 'production') {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                type: 'api_request',
                method,
                url,
                statusCode,
                duration,
                environment: APP_ENV
            }));
        } else {
            const color = statusCode >= 400 ? colors.red : colors.green;
            console.log(`${color}[API]${colors.reset} ${message}`);
        }
    },
    
    // Special method for webhook events
    webhook: (eventType, senderId, status) => {
        const message = `Webhook: ${eventType} from ${senderId} - ${status}`;
        if (APP_ENV === 'production') {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                type: 'webhook_event',
                eventType,
                senderId,
                status,
                environment: APP_ENV
            }));
        } else {
            console.log(`${colors.cyan}[WEBHOOK]${colors.reset} ${message}`);
        }
    }
};

// Export logger
module.exports = logger;

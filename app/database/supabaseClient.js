/**
 * Supabase Database Client
 * Handles all database operations for user management and session storage
 */

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } = require('../../config/settings');

// Initialize Supabase client (only if credentials are provided)
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.warn('Supabase credentials not found. Database features will be disabled.');
}

// Helper function to check database availability
function isDatabaseAvailable() {
    return supabase !== null;
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
    if (!supabase) {
        console.warn('Supabase client not initialized');
        return false;
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('Supabase connection test failed:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Supabase connection error:', error.message);
        return false;
    }
}

/**
 * Get user by Facebook ID
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUser(facebookId) {
    if (!supabase) {
        console.warn('Database not available - returning mock user data');
        return null;
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('facebook_id', facebookId)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error fetching user:', error.message);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error in getUser:', error.message);
        return null;
    }
}

/**
 * Create a new user
 * @param {string} facebookId - Facebook user ID
 * @param {Object} additionalData - Additional user data
 * @returns {Promise<Object|null>} Created user object or null if failed
 */
async function createUser(facebookId, additionalData = {}) {
    if (!isDatabaseAvailable()) {
        console.warn('Database not available - createUser operation skipped');
        return { facebook_id: facebookId, onboarding_completed: false };
    }
    
    try {
        const userData = {
            facebook_id: facebookId,
            created_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            onboarding_completed: false,
            canvas_sync_enabled: false,
            premium_user: false,
            ...additionalData
        };
        
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating user:', error.message);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error in createUser:', error.message);
        return null;
    }
}

/**
 * Update user data
 * @param {string} facebookId - Facebook user ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated user object or null if failed
 */
async function updateUser(facebookId, updateData) {
    if (!isDatabaseAvailable()) {
        console.warn('Database not available - updateUser operation skipped');
        return { facebook_id: facebookId, ...updateData };
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('facebook_id', facebookId)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating user:', error.message);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error in updateUser:', error.message);
        return null;
    }
}

/**
 * Update user's last seen timestamp
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<boolean>} True if successful
 */
async function updateUserLastSeen(facebookId) {
    if (!isDatabaseAvailable()) return true; // Silent success when DB unavailable
    
    try {
        const { error } = await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('facebook_id', facebookId);
        
        if (error) {
            console.error('Error updating last seen:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in updateUserLastSeen:', error.message);
        return false;
    }
}

/**
 * Get user session data
 * @param {string} facebookId - Facebook user ID
 * @param {string} key - Session key
 * @returns {Promise<any>} Session value or null if not found
 */
async function getUserSession(facebookId, key) {
    if (!isDatabaseAvailable()) return null; // No session when DB unavailable
    
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .select('session_data')
            .eq('facebook_id', facebookId)
            .eq('session_key', key)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error fetching user session:', error.message);
            return null;
        }
        
        return data ? data.session_data : null;
    } catch (error) {
        console.error('Error in getUserSession:', error.message);
        return null;
    }
}

/**
 * Set user session data
 * @param {string} facebookId - Facebook user ID
 * @param {string} key - Session key
 * @param {any} value - Session value
 * @returns {Promise<boolean>} True if successful
 */
async function setUserSession(facebookId, key, value) {
    if (!isDatabaseAvailable()) return true; // Silent success when DB unavailable
    
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .upsert({
                facebook_id: facebookId,
                session_key: key,
                session_data: value,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'facebook_id,session_key'
            });
        
        if (error) {
            console.error('Error setting user session:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in setUserSession:', error.message);
        return false;
    }
}

/**
 * Clear all user session data
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<boolean>} True if successful
 */
async function clearUserSession(facebookId) {
    if (!isDatabaseAvailable()) return true; // Silent success when DB unavailable
    
    try {
        const { error } = await supabase
            .from('user_sessions')
            .delete()
            .eq('facebook_id', facebookId);
        
        if (error) {
            console.error('Error clearing user session:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in clearUserSession:', error.message);
        return false;
    }
}

/**
 * Log webhook event for analytics
 * @param {string} eventType - Type of event
 * @param {string} facebookId - Facebook user ID
 * @param {Object} eventData - Raw event data
 * @param {string} processingStatus - Processing status
 * @param {string} errorMessage - Error message if any
 * @returns {Promise<boolean>} True if successful
 */
async function logWebhookEvent(eventType, facebookId, eventData, processingStatus, errorMessage = null) {
    if (!isDatabaseAvailable()) return true; // Silent success when DB unavailable
    
    try {
        const { error } = await supabase
            .from('webhook_logs')  // Fixed table name
            .insert([{
                event_type: eventType,
                sender_id: facebookId,  // Changed to match schema
                event_data: eventData,
                processing_status: processingStatus,
                error_message: errorMessage,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                retry_count: 0
            }]);
        
        if (error) {
            console.error('Error logging webhook event:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in logWebhookEvent:', error.message);
        return false;
    }
}

/**
 * Log user message for analytics
 * @param {string} facebookId - Facebook user ID
 * @param {string} messageType - Type of message
 * @param {string} messageContent - Message content
 * @param {Object} eventData - Raw event data
 * @param {string} responseAction - Action taken in response
 * @returns {Promise<boolean>} True if successful
 */
async function logUserMessage(facebookId, messageType, messageContent, eventData = null, responseAction = null) {
    if (!isDatabaseAvailable()) return true; // Silent success when DB unavailable
    
    try {
        const { error } = await supabase
            .from('message_logs')  // Fixed table name
            .insert([{
                facebook_id: facebookId,
                message_type: messageType,
                message_content: messageContent,
                event_data: eventData,
                response_action: responseAction,
                created_at: new Date().toISOString(),
                timestamp: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Error logging user message:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in logUserMessage:', error.message);
        return false;
    }
}

/**
 * Log user analytics event
 * @param {string} facebookId - Facebook user ID
 * @param {string} eventName - Name of the analytics event
 * @param {Object} eventProperties - Event properties/data
 * @returns {Promise<boolean>} True if successful
 */
async function logUserAnalytics(facebookId, eventName, eventProperties = {}) {
    if (!isDatabaseAvailable()) return true; // Silent success when DB unavailable
    
    try {
        const { error } = await supabase
            .from('user_analytics')
            .insert([{
                facebook_id: facebookId,
                event_name: eventName,
                event_properties: eventProperties,
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Error logging user analytics:', error.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in logUserAnalytics:', error.message);
        return false;
    }
}

module.exports = {
    supabase,
    testConnection,
    getUser,
    createUser,
    updateUser,
    updateUserLastSeen,
    getUserSession,
    setUserSession,
    clearUserSession,
    logWebhookEvent,
    logUserMessage,
    logUserAnalytics
};

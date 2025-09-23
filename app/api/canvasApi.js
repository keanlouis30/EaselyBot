/**
 * Canvas LMS API Integration
 * Fetches assignments and course data using user-specific Canvas tokens
 */

const axios = require('axios');
const { CANVAS_BASE_URL, CANVAS_API_VERSION } = require('../../config/settings');
const { getUser } = require('../database/supabaseClient');
const moment = require('moment-timezone');

/**
 * Create Canvas API client for a specific user
 * @param {string} canvasToken - User's Canvas API token
 * @param {string} canvasUrl - Canvas instance URL (optional, uses default if not provided)
 * @returns {Object} Axios instance configured for Canvas API
 */
function createCanvasClient(canvasToken, canvasUrl = null) {
    const baseURL = `${canvasUrl || CANVAS_BASE_URL}/api/${CANVAS_API_VERSION}`;
    
    return axios.create({
        baseURL,
        headers: {
            'Authorization': `Bearer ${canvasToken}`,
            'Accept': 'application/json+canvas-string-ids',
            'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
    });
}

/**
 * Get user's Canvas token from database
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Object|null>} Object with token and URL or null if not found
 */
async function getUserCanvasCredentials(facebookId) {
    try {
        console.log(`Fetching Canvas credentials for user ${facebookId}`);
        const user = await getUser(facebookId);
        
        if (!user) {
            console.log(`User ${facebookId} not found in database`);
            return null;
        }
        
        if (!user.canvas_token) {
            console.log(`No Canvas token found for user ${facebookId}`);
            return null;
        }
        
        console.log(`Found Canvas token for user ${facebookId}, URL: ${user.canvas_url || CANVAS_BASE_URL}`);
        
        return {
            token: user.canvas_token,
            url: user.canvas_url || CANVAS_BASE_URL,
            userId: user.canvas_user_id
        };
    } catch (error) {
        console.error(`Error fetching Canvas credentials for user ${facebookId}:`, error.message);
        return null;
    }
}

/**
 * Fetch all active courses for a user
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Array>} Array of course objects
 */
async function fetchUserCourses(facebookId) {
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    
    try {
        const response = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        return response.data || [];
    } catch (error) {
        console.error('Error fetching Canvas courses:', error.response?.data || error.message);
        throw new Error('Failed to fetch courses from Canvas. Please check your Canvas token.');
    }
}

/**
 * Fetch upcoming assignments for a user
 * @param {string} facebookId - Facebook user ID
 * @param {number} daysAhead - Number of days to look ahead (default: 7)
 * @returns {Promise<Array>} Array of assignment objects
 */
async function fetchUpcomingAssignments(facebookId, daysAhead = 7) {
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    const endDate = moment().add(daysAhead, 'days').toISOString();
    
    try {
        // First, get all active courses
        const coursesResponse = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        const courses = coursesResponse.data || [];
        
        // For each course, fetch assignments
        for (const course of courses) {
            try {
                const assignmentsResponse = await client.get(`/courses/${course.id}/assignments`, {
                    params: {
                        per_page: 100,
                        order_by: 'due_at',
                        bucket: 'upcoming' // Get upcoming assignments
                    }
                });
                
                const courseAssignments = assignmentsResponse.data || [];
                
                // Filter assignments by due date and add course info
                const upcomingAssignments = courseAssignments
                    .filter(assignment => {
                        if (!assignment.due_at) return false;
                        const dueDate = moment(assignment.due_at);
                        return dueDate.isAfter(moment()) && dueDate.isBefore(endDate);
                    })
                    .map(assignment => ({
                        ...assignment,
                        course_name: course.name,
                        course_code: course.course_code,
                        course_id: course.id
                    }));
                
                assignments.push(...upcomingAssignments);
            } catch (courseError) {
                console.error(`Error fetching assignments for course ${course.id}:`, courseError.message);
                // Continue with other courses even if one fails
            }
        }
        
        // Sort by due date
        assignments.sort((a, b) => moment(a.due_at).diff(moment(b.due_at)));
        
        return assignments;
    } catch (error) {
        console.error('Error fetching Canvas assignments:', error.response?.data || error.message);
        throw new Error('Failed to fetch assignments from Canvas. Please check your Canvas token.');
    }
}

/**
 * Fetch assignments for this week
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Array>} Array of assignment objects
 */
async function fetchThisWeekAssignments(facebookId) {
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    
    // Calculate week boundaries
    const startOfWeek = moment().startOf('week');
    const endOfWeek = moment().endOf('week');
    
    try {
        // Get all active courses
        const coursesResponse = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        const courses = coursesResponse.data || [];
        
        // Fetch assignments for each course
        for (const course of courses) {
            try {
                const assignmentsResponse = await client.get(`/courses/${course.id}/assignments`, {
                    params: {
                        per_page: 100,
                        order_by: 'due_at'
                    }
                });
                
                const courseAssignments = assignmentsResponse.data || [];
                
                // Filter for this week's assignments
                const weekAssignments = courseAssignments
                    .filter(assignment => {
                        if (!assignment.due_at) return false;
                        const dueDate = moment(assignment.due_at);
                        return dueDate.isBetween(startOfWeek, endOfWeek, 'day', '[]');
                    })
                    .map(assignment => ({
                        ...assignment,
                        course_name: course.name,
                        course_code: course.course_code,
                        course_id: course.id
                    }));
                
                assignments.push(...weekAssignments);
            } catch (courseError) {
                console.error(`Error fetching assignments for course ${course.id}:`, courseError.message);
            }
        }
        
        // Sort by due date
        assignments.sort((a, b) => moment(a.due_at).diff(moment(b.due_at)));
        
        return assignments;
    } catch (error) {
        console.error('Error fetching this week\'s assignments:', error.response?.data || error.message);
        throw new Error('Failed to fetch this week\'s assignments from Canvas.');
    }
}

/**
 * Fetch a single assignment by ID
 * @param {string} facebookId - Facebook user ID
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Canvas assignment ID
 * @returns {Promise<Object>} Assignment object
 */
async function fetchAssignment(facebookId, courseId, assignmentId) {
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    
    try {
        const response = await client.get(`/courses/${courseId}/assignments/${assignmentId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching assignment:', error.response?.data || error.message);
        throw new Error('Failed to fetch assignment from Canvas.');
    }
}

/**
 * Test Canvas API connection with user's token
 * @param {string} canvasToken - Canvas API token
 * @param {string} canvasUrl - Canvas instance URL (optional)
 * @returns {Promise<Object>} User profile if successful
 */
async function testCanvasConnection(canvasToken, canvasUrl = null) {
    const client = createCanvasClient(canvasToken, canvasUrl);
    
    try {
        const response = await client.get('/users/self');
        return {
            success: true,
            user: response.data
        };
    } catch (error) {
        console.error('Canvas connection test failed:', error.response?.data || error.message);
        return {
            success: false,
            error: 'Invalid Canvas token or URL. Please check your credentials.'
        };
    }
}

/**
 * Format assignment for display
 * @param {Object} assignment - Canvas assignment object
 * @returns {string} Formatted assignment string
 */
function formatAssignment(assignment) {
    const dueDate = moment(assignment.due_at);
    const now = moment();
    const daysUntilDue = dueDate.diff(now, 'days');
    const hoursUntilDue = dueDate.diff(now, 'hours');
    
    let timeString;
    if (daysUntilDue > 1) {
        timeString = `in ${daysUntilDue} days`;
    } else if (daysUntilDue === 1) {
        timeString = 'tomorrow';
    } else if (hoursUntilDue > 0) {
        timeString = `in ${hoursUntilDue} hours`;
    } else {
        timeString = 'OVERDUE';
    }
    
    return `📚 ${assignment.name}\n` +
           `📖 ${assignment.course_name}\n` +
           `⏰ Due: ${dueDate.format('MMM D, h:mm A')} (${timeString})\n` +
           `${assignment.html_url ? `🔗 ${assignment.html_url}` : ''}`;
}

/**
 * Format multiple assignments for display
 * @param {Array} assignments - Array of Canvas assignment objects
 * @returns {string} Formatted assignments string
 */
function formatAssignmentsList(assignments) {
    if (!assignments || assignments.length === 0) {
        return '✨ No assignments due! You\'re all caught up!';
    }
    
    const formattedList = assignments
        .slice(0, 10) // Limit to 10 assignments to avoid message being too long
        .map((assignment, index) => {
            const dueDate = moment(assignment.due_at);
            const shortDate = dueDate.format('MMM D');
            const shortTime = dueDate.format('h:mm A');
            return `${index + 1}. ${assignment.name}\n   📖 ${assignment.course_code || assignment.course_name}\n   ⏰ ${shortDate} at ${shortTime}`;
        })
        .join('\n\n');
    
    const header = assignments.length === 1 
        ? '📚 You have 1 assignment:\n\n' 
        : `📚 You have ${assignments.length} assignments:\n\n`;
    
    return header + formattedList;
}

module.exports = {
    createCanvasClient,
    getUserCanvasCredentials,
    fetchUserCourses,
    fetchUpcomingAssignments,
    fetchThisWeekAssignments,
    fetchAssignment,
    testCanvasConnection,
    formatAssignment,
    formatAssignmentsList
};

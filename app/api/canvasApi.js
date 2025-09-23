/**
 * Canvas LMS API Integration
 * Fetches assignments and course data using user-specific Canvas tokens
 */

const axios = require('axios');
const { CANVAS_BASE_URL, CANVAS_API_VERSION } = require('../../config/settings');
const { getUser } = require('../database/supabaseClient');
const moment = require('moment-timezone');

// Set default timezone to Manila
moment.tz.setDefault('Asia/Manila');

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
        console.log(`\n🔑 Fetching Canvas credentials for user ${facebookId}`);
        const user = await getUser(facebookId);
        
        if (!user) {
            console.log(`❌ User ${facebookId} not found in database`);
            return null;
        }
        
        if (!user.canvas_token) {
            console.log(`❌ No Canvas token found for user ${facebookId}`);
            return null;
        }
        
        // Log token details (safely)
        console.log(`✅ Found Canvas token for user ${facebookId}`);
        console.log(`   Token length: ${user.canvas_token.length} characters`);
        console.log(`   Token preview: ${user.canvas_token.substring(0, 10)}...`);
        console.log(`   Canvas URL: ${user.canvas_url || CANVAS_BASE_URL}`);
        console.log(`   Canvas User ID: ${user.canvas_user_id || 'Not stored'}`);
        
        return {
            token: user.canvas_token,
            url: user.canvas_url || CANVAS_BASE_URL,
            userId: user.canvas_user_id
        };
    } catch (error) {
        console.error(`❌ Error fetching Canvas credentials for user ${facebookId}:`, error.message);
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
    console.log(`\n📚 Fetching upcoming assignments for user ${facebookId} (next ${daysAhead} days)`);
    
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        console.log(`❌ Cannot fetch assignments - no Canvas token found`);
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    console.log(`🔗 Creating Canvas API client with user's token`);
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    const endDate = moment().add(daysAhead, 'days').toISOString();
    
    try {
        // First, get all active courses
        console.log(`📡 Calling Canvas API: GET /courses (using token: ${credentials.token.substring(0, 10)}...)`);
        const coursesResponse = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        const courses = coursesResponse.data || [];
        console.log(`📁 Found ${courses.length} active courses`);
        
        // For each course, fetch assignments
        for (const course of courses) {
            try {
                console.log(`  📡 Fetching assignments for course: ${course.name}`);
                const assignmentsResponse = await client.get(`/courses/${course.id}/assignments`, {
                    params: {
                        per_page: 100,
                        order_by: 'due_at',
                        bucket: 'upcoming' // Get upcoming assignments
                    }
                });
                
                const courseAssignments = assignmentsResponse.data || [];
                console.log(`    Found ${courseAssignments.length} assignments in ${course.name}`);
                
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
        
        console.log(`✅ Successfully fetched ${assignments.length} total assignments using user's token`);
        return assignments;
    } catch (error) {
        console.error('❌ Error fetching Canvas assignments:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            throw new Error('Canvas token is invalid or expired. Please update your Canvas token.');
        }
        throw new Error('Failed to fetch assignments from Canvas. Please check your Canvas token.');
    }
}

/**
 * Fetch assignments due today (Manila timezone)
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Array>} Array of assignment objects
 */
async function fetchTodayAssignments(facebookId) {
    console.log(`\n📅 Fetching today's assignments for user ${facebookId}`);
    
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        console.log(`❌ Cannot fetch assignments - no Canvas token found`);
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    console.log(`🔗 Using Canvas token from database`);
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    
    // Get today's date range in Manila timezone
    const todayStart = moment.tz('Asia/Manila').startOf('day');
    const todayEnd = moment.tz('Asia/Manila').endOf('day');
    console.log(`📆 Today's range (Manila): ${todayStart.format('MMM D, h:mm A')} - ${todayEnd.format('h:mm A')}`);
    
    try {
        const coursesResponse = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        const courses = coursesResponse.data || [];
        
        for (const course of courses) {
            try {
                const assignmentsResponse = await client.get(`/courses/${course.id}/assignments`, {
                    params: {
                        per_page: 100,
                        order_by: 'due_at'
                    }
                });
                
                const courseAssignments = assignmentsResponse.data || [];
                
                // Filter for today's assignments (Manila timezone)
                const todayAssignments = courseAssignments
                    .filter(assignment => {
                        if (!assignment.due_at) return false;
                        const dueDate = moment.tz(assignment.due_at, 'Asia/Manila');
                        return dueDate.isBetween(todayStart, todayEnd, 'minute', '[]');
                    })
                    .map(assignment => ({
                        ...assignment,
                        course_name: course.name,
                        course_code: course.course_code,
                        course_id: course.id
                    }));
                
                assignments.push(...todayAssignments);
            } catch (courseError) {
                console.error(`Error fetching assignments for course ${course.id}:`, courseError.message);
            }
        }
        
        assignments.sort((a, b) => moment.tz(a.due_at, 'Asia/Manila').diff(moment.tz(b.due_at, 'Asia/Manila')));
        console.log(`✅ Found ${assignments.length} assignments due today`);
        return assignments;
    } catch (error) {
        console.error('❌ Error fetching today\'s assignments:', error.message);
        throw new Error('Failed to fetch today\'s assignments.');
    }
}

/**
 * Fetch assignments for this week
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Array>} Array of assignment objects
 */
async function fetchThisWeekAssignments(facebookId) {
    console.log(`\n📅 Fetching this week's assignments for user ${facebookId}`);
    
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        console.log(`❌ Cannot fetch assignments - no Canvas token found`);
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    console.log(`🔗 Using Canvas token from database for user ${facebookId}`);
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    
    // Calculate week boundaries in Manila timezone
    const startOfWeek = moment.tz('Asia/Manila').startOf('week');
    const endOfWeek = moment.tz('Asia/Manila').endOf('week');
    console.log(`📆 Week range (Manila): ${startOfWeek.format('MMM D')} - ${endOfWeek.format('MMM D')}`);
    
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
 * Fetch assignments for this month (Manila timezone)
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Array>} Array of assignment objects
 */
async function fetchThisMonthAssignments(facebookId) {
    console.log(`\n📅 Fetching this month's assignments for user ${facebookId}`);
    
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        console.log(`❌ Cannot fetch assignments - no Canvas token found`);
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    
    // Get current month boundaries in Manila timezone
    const monthStart = moment.tz('Asia/Manila').startOf('month');
    const monthEnd = moment.tz('Asia/Manila').endOf('month');
    console.log(`📆 Month range (Manila): ${monthStart.format('MMM D')} - ${monthEnd.format('MMM D')}`);
    
    try {
        const coursesResponse = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        const courses = coursesResponse.data || [];
        
        for (const course of courses) {
            try {
                const assignmentsResponse = await client.get(`/courses/${course.id}/assignments`, {
                    params: {
                        per_page: 100,
                        order_by: 'due_at'
                    }
                });
                
                const courseAssignments = assignmentsResponse.data || [];
                
                // Filter for this month's assignments
                const monthAssignments = courseAssignments
                    .filter(assignment => {
                        if (!assignment.due_at) return false;
                        const dueDate = moment.tz(assignment.due_at, 'Asia/Manila');
                        return dueDate.isBetween(monthStart, monthEnd, 'day', '[]');
                    })
                    .map(assignment => ({
                        ...assignment,
                        course_name: course.name,
                        course_code: course.course_code,
                        course_id: course.id
                    }));
                
                assignments.push(...monthAssignments);
            } catch (courseError) {
                console.error(`Error fetching assignments for course ${course.id}:`, courseError.message);
            }
        }
        
        assignments.sort((a, b) => moment.tz(a.due_at, 'Asia/Manila').diff(moment.tz(b.due_at, 'Asia/Manila')));
        console.log(`✅ Found ${assignments.length} assignments this month`);
        return assignments;
    } catch (error) {
        console.error('❌ Error fetching this month\'s assignments:', error.message);
        throw new Error('Failed to fetch this month\'s assignments.');
    }
}

/**
 * Fetch overdue assignments (Manila timezone)
 * @param {string} facebookId - Facebook user ID
 * @returns {Promise<Array>} Array of assignment objects
 */
async function fetchOverdueAssignments(facebookId) {
    console.log(`\n⚠️ Fetching overdue assignments for user ${facebookId}`);
    
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        console.log(`❌ Cannot fetch assignments - no Canvas token found`);
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    const assignments = [];
    
    // Current time in Manila timezone
    const now = moment.tz('Asia/Manila');
    console.log(`🕰️ Current time (Manila): ${now.format('MMM D, h:mm A')}`);
    
    try {
        const coursesResponse = await client.get('/courses', {
            params: {
                enrollment_state: 'active',
                per_page: 100
            }
        });
        
        const courses = coursesResponse.data || [];
        
        for (const course of courses) {
            try {
                const assignmentsResponse = await client.get(`/courses/${course.id}/assignments`, {
                    params: {
                        per_page: 100,
                        order_by: 'due_at'
                    }
                });
                
                const courseAssignments = assignmentsResponse.data || [];
                
                // Filter for overdue assignments
                const overdueAssignments = courseAssignments
                    .filter(assignment => {
                        if (!assignment.due_at) return false;
                        const dueDate = moment.tz(assignment.due_at, 'Asia/Manila');
                        return dueDate.isBefore(now);
                    })
                    .map(assignment => ({
                        ...assignment,
                        course_name: course.name,
                        course_code: course.course_code,
                        course_id: course.id
                    }));
                
                assignments.push(...overdueAssignments);
            } catch (courseError) {
                console.error(`Error fetching assignments for course ${course.id}:`, courseError.message);
            }
        }
        
        // Sort by due date (most recent overdue first)
        assignments.sort((a, b) => moment.tz(b.due_at, 'Asia/Manila').diff(moment.tz(a.due_at, 'Asia/Manila')));
        console.log(`✅ Found ${assignments.length} overdue assignments`);
        return assignments;
    } catch (error) {
        console.error('❌ Error fetching overdue assignments:', error.message);
        throw new Error('Failed to fetch overdue assignments.');
    }
}

/**
 * Create a calendar event/task in Canvas
 * @param {string} facebookId - Facebook user ID
 * @param {Object} taskData - Task details { title, description, date, time, courseId }
 * @returns {Promise<Object>} Created event object
 */
async function createCanvasTask(facebookId, taskData) {
    console.log(`\n➕ Creating Canvas task for user ${facebookId}`);
    
    const credentials = await getUserCanvasCredentials(facebookId);
    
    if (!credentials) {
        console.log(`❌ Cannot create task - no Canvas token found`);
        throw new Error('Canvas not connected. Please provide your Canvas API token first.');
    }
    
    const client = createCanvasClient(credentials.token, credentials.url);
    
    try {
        // Combine date and time in Manila timezone
        const taskDateTime = moment.tz(`${taskData.date} ${taskData.time}`, 'YYYY-MM-DD HH:mm', 'Asia/Manila');
        const startAt = taskDateTime.toISOString();
        const endAt = taskDateTime.clone().add(1, 'hour').toISOString(); // Default 1 hour duration
        
        console.log(`📅 Task scheduled for: ${taskDateTime.format('MMM D, h:mm A')} Manila time`);
        
        // Create calendar event
        const eventData = {
            calendar_event: {
                context_code: taskData.courseId ? `course_${taskData.courseId}` : `user_${credentials.userId || 'self'}`,
                title: taskData.title,
                description: taskData.description || '',
                start_at: startAt,
                end_at: endAt,
                time_zone_edited: 'Asia/Manila'
            }
        };
        
        const response = await client.post('/calendar_events', eventData);
        
        console.log(`✅ Task created successfully with ID: ${response.data.id}`);
        return response.data;
    } catch (error) {
        console.error('❌ Error creating Canvas task:', error.response?.data || error.message);
        throw new Error('Failed to create task in Canvas. Please try again.');
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
 * Format assignment for display (Manila timezone)
 * @param {Object} assignment - Canvas assignment object
 * @returns {string} Formatted assignment string
 */
function formatAssignment(assignment) {
    const dueDate = moment.tz(assignment.due_at, 'Asia/Manila');
    const now = moment.tz('Asia/Manila');
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
           `⏰ Due: ${dueDate.format('MMM D, h:mm A')} Manila (${timeString})\n` +
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
            const dueDate = moment.tz(assignment.due_at, 'Asia/Manila');
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
    fetchTodayAssignments,
    fetchThisWeekAssignments,
    fetchThisMonthAssignments,
    fetchOverdueAssignments,
    createCanvasTask,
    fetchAssignment,
    testCanvasConnection,
    formatAssignment,
    formatAssignmentsList
};

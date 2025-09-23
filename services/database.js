// Database service for Supabase integration
const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Encryption helpers
function encryptToken(token) {
  if (!token) return null;
  return CryptoJS.AES.encrypt(token, process.env.ENCRYPTION_KEY).toString();
}

function decryptToken(encryptedToken) {
  if (!encryptedToken) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Failed to decrypt token:', error);
    return null;
  }
}

// User management functions
async function getUser(senderId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('sender_id', senderId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching user:', error);
      return null;
    }
    
    // Decrypt canvas token if present
    if (data && data.canvas_token) {
      data.canvas_token = decryptToken(data.canvas_token);
    }
    
    return data;
  } catch (err) {
    console.error('Database error in getUser:', err);
    return null;
  }
}

async function createUser(senderId) {
  try {
    const userData = {
      sender_id: senderId,
      is_onboarded: false,
      subscription_tier: 'free',
      agreed_privacy: false,
      agreed_terms: false
    };
    
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Database error in createUser:', err);
    return null;
  }
}

async function updateUser(senderId, updates) {
  try {
    // Encrypt canvas token if being updated
    if (updates.canvas_token) {
      updates.canvas_token = encryptToken(updates.canvas_token);
    }
    
    // Extract Canvas user info if provided
    if (updates.canvasUser) {
      updates.canvas_user_id = updates.canvasUser.id;
      updates.canvas_user_name = updates.canvasUser.name;
      updates.canvas_user_email = updates.canvasUser.primary_email;
      delete updates.canvasUser; // Remove the nested object
    }
    
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('sender_id', senderId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      return null;
    }
    
    // Decrypt token for return
    if (data && data.canvas_token) {
      data.canvas_token = decryptToken(data.canvas_token);
    }
    
    return data;
  } catch (err) {
    console.error('Database error in updateUser:', err);
    return null;
  }
}

// Session management functions
async function getUserSession(senderId) {
  try {
    // First get user ID
    const user = await getUser(senderId);
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching session:', error);
      return null;
    }
    
    // Return session data if exists
    return data ? data.session_data : null;
  } catch (err) {
    console.error('Database error in getUserSession:', err);
    return null;
  }
}

async function setUserSession(senderId, sessionData) {
  try {
    const user = await getUser(senderId);
    if (!user) return false;
    
    // Deactivate existing sessions
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    // Create new session
    const { error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionData.flow || 'unknown',
        session_data: sessionData,
        is_active: true,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      });
    
    if (error) {
      console.error('Error creating session:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Database error in setUserSession:', err);
    return false;
  }
}

async function clearUserSession(senderId) {
  try {
    const user = await getUser(senderId);
    if (!user) return false;
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error clearing session:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Database error in clearUserSession:', err);
    return false;
  }
}

// Task management functions
async function getUserTasks(senderId, options = {}) {
  try {
    const user = await getUser(senderId);
    if (!user) return [];
    
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false);
    
    // Add filters based on options
    if (options.dueToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      query = query
        .gte('due_date', today.toISOString())
        .lt('due_date', tomorrow.toISOString());
    }
    
    if (options.overdue) {
      query = query.lt('due_date', new Date().toISOString());
    }
    
    if (options.upcoming) {
      const future = new Date();
      future.setDate(future.getDate() + (options.daysAhead || 7));
      
      query = query
        .gte('due_date', new Date().toISOString())
        .lte('due_date', future.toISOString());
    }
    
    const { data, error } = await query.order('due_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Database error in getUserTasks:', err);
    return [];
  }
}

async function createTask(senderId, taskData) {
  try {
    const user = await getUser(senderId);
    if (!user) return null;
    
    // Get course if specified
    let courseId = null;
    if (taskData.courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('user_id', user.id)
        .eq('canvas_course_id', taskData.courseId)
        .single();
      
      courseId = course?.id;
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        course_id: courseId,
        title: taskData.title,
        description: taskData.description || '',
        due_date: taskData.dueDate,
        due_date_text: taskData.dueDateText,
        course_name: taskData.courseName || taskData.course || 'Personal',
        is_manual: true,
        canvas_type: taskData.canvasType,
        canvas_id: taskData.canvasId,
        canvas_course_id: taskData.courseId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Database error in createTask:', err);
    return null;
  }
}

async function syncCanvasAssignments(senderId, assignments) {
  try {
    const user = await getUser(senderId);
    if (!user) return false;
    
    // Start a transaction-like operation
    for (const assignment of assignments) {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('canvas_id', assignment.id.toString())
        .single();
      
      if (!existing) {
        // Create new task from Canvas assignment
        await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            canvas_id: assignment.id.toString(),
            canvas_type: 'assignment',
            canvas_course_id: assignment.courseId,
            title: assignment.title,
            description: assignment.description,
            due_date: assignment.dueDate,
            course_name: assignment.course,
            points_possible: assignment.pointsPossible,
            submission_types: assignment.submissionTypes,
            html_url: assignment.htmlUrl,
            has_submitted: assignment.hasSubmitted,
            is_manual: false
          });
      }
    }
    
    // Update last sync time
    await updateUser(senderId, { last_sync_at: new Date().toISOString() });
    
    return true;
  } catch (err) {
    console.error('Database error in syncCanvasAssignments:', err);
    return false;
  }
}

// Activity logging
async function logActivity(senderId, action, details = {}) {
  try {
    const user = await getUser(senderId);
    
    await supabase
      .from('activity_log')
      .insert({
        user_id: user?.id,
        sender_id: senderId,
        action: action,
        details: details
      });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Get all users for broadcast
async function getAllUsers(filter = 'all') {
  try {
    let query = supabase
      .from('users')
      .select('sender_id, subscription_tier, is_onboarded');
    
    if (filter === 'premium') {
      query = query.eq('subscription_tier', 'premium');
    } else if (filter === 'onboarded') {
      query = query.eq('is_onboarded', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Database error in getAllUsers:', err);
    return [];
  }
}

// Clean up expired sessions (run periodically)
async function cleanupExpiredSessions() {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true);
    
    if (error) {
      console.error('Error cleaning up sessions:', error);
    }
  } catch (err) {
    console.error('Database error in cleanupExpiredSessions:', err);
  }
}

module.exports = {
  supabase,
  getUser,
  createUser,
  updateUser,
  getUserSession,
  setUserSession,
  clearUserSession,
  getUserTasks,
  createTask,
  syncCanvasAssignments,
  logActivity,
  getAllUsers,
  cleanupExpiredSessions,
  encryptToken,
  decryptToken
};

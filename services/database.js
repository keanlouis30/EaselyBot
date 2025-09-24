// Database service for Supabase integration
const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

// Helper function to get Manila timezone date parts
function getManilaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year').value),
    month: parseInt(parts.find(p => p.type === 'month').value),
    day: parseInt(parts.find(p => p.type === 'day').value),
    hour: parseInt(parts.find(p => p.type === 'hour').value),
    minute: parseInt(parts.find(p => p.type === 'minute').value),
    second: parseInt(parts.find(p => p.type === 'second').value)
  };
}

// Helper function to create Manila timezone Date object
function createManilaDate({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+08:00`);
}

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
      const today = getManilaDateParts();
      const startOfTodayManila = createManilaDate({ year: today.year, month: today.month, day: today.day, hour: 0, minute: 0, second: 0 });
      const endOfTodayManila = createManilaDate({ year: today.year, month: today.month, day: today.day, hour: 23, minute: 59, second: 59 });
      
      console.log(`📅 dueToday filter: Manila date ${today.year}-${today.month}-${today.day}, UTC range: ${startOfTodayManila.toISOString()} to ${endOfTodayManila.toISOString()}`);
      
      query = query
        .gte('due_date', startOfTodayManila.toISOString())
        .lte('due_date', endOfTodayManila.toISOString());
    }
    
    if (options.overdue) {
      const now = getManilaDateParts();
      const currentManilaTime = createManilaDate(now);
      
      console.log(`⏰ overdue filter: Current Manila time: ${currentManilaTime.toISOString()}`);
      
      query = query.lt('due_date', currentManilaTime.toISOString());
    }
    
    if (options.upcoming) {
      const daysAhead = options.daysAhead || 7;
      
      const now = getManilaDateParts();
      const currentManilaTime = createManilaDate(now);
      
      // Calculate future date in Manila timezone
      const futureDate = new Date(currentManilaTime.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
      const futureParts = getManilaDateParts(futureDate);
      const endOfFutureDayManila = createManilaDate({ ...futureParts, hour: 23, minute: 59, second: 59 });
      
      console.log(`📅 upcoming filter: ${daysAhead} days ahead, Manila range: ${currentManilaTime.toISOString()} to ${endOfFutureDayManila.toISOString()}`);
      
      query = query
        .gte('due_date', currentManilaTime.toISOString())
        .lte('due_date', endOfFutureDayManila.toISOString());
    }
    
    const { data, error } = await query.order('due_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
    
    console.log(`📄 getUserTasks results for user ${user.id}:`, {
      totalFound: (data || []).length,
      manualTasks: (data || []).filter(t => t.is_manual).length,
      options,
      taskTitles: (data || []).map(t => `"${t.title}" (${new Date(t.due_date).toISOString()})`)
    });
    
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
    
    const taskInsertData = {
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
    };
    
    console.log(`📝 Creating task for user ${user.id}:`, {
      title: taskInsertData.title,
      due_date: taskInsertData.due_date,
      due_date_iso: taskData.dueDate?.toISOString ? taskData.dueDate.toISOString() : 'not a date object',
      course: taskInsertData.course_name,
      is_manual: taskInsertData.is_manual
    });
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskInsertData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
      return null;
    }
    
    // Automatically create reminder for the new task (free users get 24-hour reminder)
    if (data && taskData.dueDate) {
      try {
        const dueDate = new Date(taskData.dueDate);
        const reminderTime = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
        
        // Only create reminder if it's in the future
        if (reminderTime > new Date()) {
          await createReminder({
            task_id: data.id,
            user_id: user.id,
            reminder_time: reminderTime,
            reminder_type: '1_day'
          });
          console.log(`Reminder created for task ${data.id}`);
        }
      } catch (reminderError) {
        console.error('Error creating reminder for task:', reminderError);
        // Don't fail task creation if reminder creation fails
      }
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
        const { data: newTask, error } = await supabase
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
          })
          .select()
          .single();
        
        // Create reminder for synced assignment if due date is in the future
        if (newTask && assignment.dueDate && !error) {
          try {
            const dueDate = new Date(assignment.dueDate);
            const reminderTime = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
            
            // Only create reminder if it's in the future
            if (reminderTime > new Date()) {
              await createReminder({
                task_id: newTask.id,
                user_id: user.id,
                reminder_time: reminderTime,
                reminder_type: '1_day'
              });
              console.log(`Reminder created for Canvas assignment ${newTask.id}`);
            }
          } catch (reminderError) {
            console.error('Error creating reminder for Canvas assignment:', reminderError);
          }
        }
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

// Reminder functions
async function createReminder(reminderData) {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert(reminderData)
      .select()
      .single();
    
    if (error) {
      // If it's a duplicate reminder, that's ok
      if (error.code === '23505') {
        console.log('Reminder already exists for this task and type');
        return null;
      }
      console.error('Error creating reminder:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Database error in createReminder:', err);
    return null;
  }
}

async function getUnsentReminders() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('is_sent', false)
      .lte('reminder_time', now)
      .order('reminder_time');
    
    if (error) {
      console.error('Error fetching unsent reminders:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Database error in getUnsentReminders:', err);
    return [];
  }
}

async function markReminderAsSent(reminderId) {
  try {
    const { error } = await supabase
      .from('reminders')
      .update({ 
        is_sent: true, 
        sent_at: new Date().toISOString() 
      })
      .eq('id', reminderId);
    
    if (error) {
      console.error('Error marking reminder as sent:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Database error in markReminderAsSent:', err);
    return false;
  }
}

async function getTasksNeedingReminders(userId) {
  try {
    // Get tasks that don't have reminders yet
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        reminders!left (
          id,
          reminder_type
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .gte('due_date', new Date().toISOString());
    
    if (error) {
      console.error('Error fetching tasks needing reminders:', error);
      return [];
    }
    
    // Filter tasks that don't have a 1_day reminder (for free users)
    const tasksNeedingReminders = (data || []).filter(task => {
      const hasOneDayReminder = task.reminders?.some(r => r.reminder_type === '1_day');
      return !hasOneDayReminder;
    });
    
    return tasksNeedingReminders;
  } catch (err) {
    console.error('Database error in getTasksNeedingReminders:', err);
    return [];
  }
}

async function getUserById(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Database error in getUserById:', err);
    return null;
  }
}

async function getTaskById(taskId) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error) {
      console.error('Error fetching task by ID:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Database error in getTaskById:', err);
    return null;
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
  decryptToken,
  // Reminder functions
  createReminder,
  getUnsentReminders,
  markReminderAsSent,
  getTasksNeedingReminders,
  getUserById,
  getTaskById
};

// Reminder service for handling deadline notifications
const db = require('./database');
const axios = require('axios');

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a reminder message to a user via Facebook Messenger
 * @param {string} senderId - Facebook sender ID
 * @param {object} task - Task object with details
 * @param {string} reminderType - Type of reminder (e.g., '1_day')
 */
async function sendReminderMessage(senderId, task, reminderType) {
  try {
    const hoursBefore = getReminderHours(reminderType);
    const hoursText = hoursBefore === 24 ? '24 hours' : `${hoursBefore} hours`;
    
    // Format the message based on task type
    const courseInfo = task.course_name ? ` for ${task.course_name}` : '';
    const message = {
      text: `⏰ Reminder: "${task.title}"${courseInfo} is due in ${hoursText}!\n\n` +
            `📅 Due: ${formatDueDate(task.due_date)}\n` +
            (task.description ? `📝 ${task.description.substring(0, 200)}` : '') +
            `\n\nDon't forget to complete your task on time! 💪`
    };

    // Send message via Facebook Messenger API
    const response = await axios.post(
      `${GRAPH_API_URL}/me/messages`,
      {
        recipient: { id: senderId },
        message: message
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN }
      }
    );

    console.log(`Reminder sent to ${senderId} for task ${task.id}`);
    return true;
  } catch (error) {
    console.error(`Failed to send reminder to ${senderId}:`, error.message);
    return false;
  }
}

/**
 * Get hours before deadline for a reminder type
 * @param {string} reminderType - Type of reminder
 * @returns {number} Hours before deadline
 */
function getReminderHours(reminderType) {
  const reminderMap = {
    '1_week': 168,
    '3_days': 72,
    '1_day': 24,
    '8_hours': 8,
    '2_hours': 2,
    '1_hour': 1
  };
  return reminderMap[reminderType] || 24;
}

/**
 * Format due date for display in Manila timezone
 * @param {Date|string} dueDate - Due date
 * @returns {string} Formatted date string
 */
function formatDueDate(dueDate) {
  const date = new Date(dueDate);
  const options = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila'
  };
  return date.toLocaleString('en-US', options);
}

/**
 * Check and send pending reminders
 * This function is called by the cron job
 */
async function processPendingReminders() {
  try {
    console.log('Processing pending reminders...');
    
    // Get all unsent reminders that are due now
    const pendingReminders = await db.getUnsentReminders();
    
    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('No pending reminders found');
      return { processed: 0, sent: 0, failed: 0 };
    }

    console.log(`Found ${pendingReminders.length} pending reminders`);
    
    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        // Get user details
        const user = await db.getUserById(reminder.user_id);
        if (!user) {
          console.error(`User not found for reminder ${reminder.id}`);
          continue;
        }

        // Get task details
        const task = await db.getTaskById(reminder.task_id);
        if (!task) {
          console.error(`Task not found for reminder ${reminder.id}`);
          continue;
        }

        // Check if task is still incomplete
        if (task.is_completed) {
          console.log(`Task ${task.id} already completed, skipping reminder`);
          await db.markReminderAsSent(reminder.id);
          continue;
        }

        // Send the reminder
        const success = await sendReminderMessage(
          user.sender_id,
          task,
          reminder.reminder_type
        );

        if (success) {
          await db.markReminderAsSent(reminder.id);
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
        failed++;
      }
    }

    console.log(`Reminder processing complete: ${sent} sent, ${failed} failed`);
    return { processed: pendingReminders.length, sent, failed };
  } catch (error) {
    console.error('Error in processPendingReminders:', error);
    throw error;
  }
}

/**
 * Create reminders for upcoming tasks
 * This function checks for tasks that need reminders and creates them
 */
async function createUpcomingReminders() {
  try {
    console.log('Creating reminders for upcoming tasks...');
    
    // Get all active users
    const users = await db.getAllUsers('active');
    let remindersCreated = 0;

    for (const user of users) {
      try {
        // Get user's upcoming tasks that don't have reminders yet
        const tasks = await db.getTasksNeedingReminders(user.id);
        
        for (const task of tasks) {
          // Skip if task doesn't have a due date
          if (!task.due_date) continue;

          const dueDate = new Date(task.due_date);
          const now = new Date();
          const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

          // For free users, create only 24-hour reminder
          if (user.subscription_tier === 'free') {
            if (hoursUntilDue > 24 && hoursUntilDue <= 25) {
              const reminderTime = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
              const created = await db.createReminder({
                task_id: task.id,
                user_id: user.id,
                reminder_time: reminderTime,
                reminder_type: '1_day'
              });
              if (created) remindersCreated++;
            }
          } else if (user.subscription_tier === 'premium') {
            // Premium users get multiple reminders
            const reminderSchedule = [
              { hours: 168, type: '1_week' },
              { hours: 72, type: '3_days' },
              { hours: 24, type: '1_day' },
              { hours: 8, type: '8_hours' },
              { hours: 2, type: '2_hours' }
            ];

            for (const schedule of reminderSchedule) {
              if (hoursUntilDue > schedule.hours && hoursUntilDue <= schedule.hours + 1) {
                const reminderTime = new Date(dueDate.getTime() - schedule.hours * 60 * 60 * 1000);
                const created = await db.createReminder({
                  task_id: task.id,
                  user_id: user.id,
                  reminder_time: reminderTime,
                  reminder_type: schedule.type
                });
                if (created) remindersCreated++;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error creating reminders for user ${user.id}:`, error);
      }
    }

    console.log(`Created ${remindersCreated} new reminders`);
    return remindersCreated;
  } catch (error) {
    console.error('Error in createUpcomingReminders:', error);
    throw error;
  }
}

/**
 * Main function to process reminders
 * This should be called by the cron job
 */
async function processReminders() {
  try {
    // First, create reminders for upcoming tasks
    const created = await createUpcomingReminders();
    
    // Then, send pending reminders
    const result = await processPendingReminders();
    
    return {
      remindersCreated: created,
      ...result
    };
  } catch (error) {
    console.error('Error in processReminders:', error);
    throw error;
  }
}

module.exports = {
  sendReminderMessage,
  processPendingReminders,
  createUpcomingReminders,
  processReminders,
  formatDueDate
};

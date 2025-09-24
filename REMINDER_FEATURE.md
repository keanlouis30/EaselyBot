# Reminder Feature Documentation

## Overview
EaselyBot now includes an automated reminder system that sends notifications to users about upcoming assignment deadlines. Free users receive reminders 24 hours before their deadlines.

## Features

### For Free Users
- **24-Hour Reminders**: Automatic notification sent 24 hours before any task deadline
- **Smart Detection**: Works for both Canvas assignments and manually created tasks
- **Automatic Setup**: Reminders are created automatically when tasks are added or synced

### For Premium Users (Future Enhancement)
- Multiple reminder intervals:
  - 1 week before
  - 3 days before
  - 24 hours before
  - 8 hours before
  - 2 hours before

## How It Works

### 1. Automatic Reminder Creation
When a task is created or synced from Canvas:
- The system automatically creates a reminder for 24 hours before the due date
- Only creates reminders for tasks with future due dates
- Prevents duplicate reminders for the same task

### 2. Reminder Processing
The reminder system runs every hour and:
- Checks for reminders that are due to be sent
- Sends Facebook Messenger notifications to users
- Marks reminders as sent to avoid duplicates
- Skips reminders for completed tasks

### 3. Message Format
Users receive a notification like:
```
⏰ Reminder: "Assignment Title" for Course Name is due in 24 hours!

📅 Due: Mon, Dec 25, 2024, 11:59 PM
📝 Assignment description (if available)

Don't forget to complete your task on time! 💪
```

## Implementation Details

### Components
1. **`services/reminderService.js`**: Core reminder logic
   - `sendReminderMessage()`: Sends notifications via Facebook Messenger
   - `createUpcomingReminders()`: Creates reminders for tasks
   - `processPendingReminders()`: Sends due reminders

2. **`jobs/send-reminders.js`**: Cron job script
   - Runs hourly to process reminders
   - Logs results for monitoring

3. **Database Functions** in `services/database.js`:
   - `createReminder()`: Creates new reminder records
   - `getUnsentReminders()`: Fetches due reminders
   - `markReminderAsSent()`: Updates sent status
   - `getTasksNeedingReminders()`: Finds tasks without reminders

### Database Schema
The `reminders` table stores:
- `task_id`: Link to the task
- `user_id`: User to notify
- `reminder_time`: When to send the reminder
- `reminder_type`: Type of reminder (e.g., '1_day')
- `is_sent`: Whether reminder was sent
- `sent_at`: When it was sent

## Deployment

### Local Development
1. Test the reminder functionality:
   ```bash
   node test_reminders.js
   ```

2. Run the reminder job manually:
   ```bash
   node jobs/send-reminders.js
   ```

### Production (Render.com)
The reminder cron job is configured in `render.yaml`:
- Runs every hour (`0 * * * *`)
- Processes all pending reminders
- Logs results for monitoring

### Required Environment Variables
- `PAGE_ACCESS_TOKEN`: Facebook Page access token
- `SUPABASE_URL`: Database URL
- `SUPABASE_SERVICE_KEY`: Database service key
- `ENCRYPTION_KEY`: For secure token storage

## Monitoring

### Check Reminder Status
View reminder processing logs in Render dashboard or server logs:
```
🔔 Reminder Job Started
Creating reminders for upcoming tasks...
Created 5 new reminders
Processing pending reminders...
Found 3 pending reminders
Reminder sent to user_123 for task abc-def-ghi
Reminder processing complete: 3 sent, 0 failed
✅ Reminder Job Completed Successfully
```

### Database Queries
Check reminder status directly in Supabase:
```sql
-- View all pending reminders
SELECT * FROM reminders 
WHERE is_sent = false 
AND reminder_time <= NOW()
ORDER BY reminder_time;

-- View reminders for a specific user
SELECT r.*, t.title 
FROM reminders r
JOIN tasks t ON r.task_id = t.id
WHERE r.user_id = 'USER_ID'
ORDER BY r.reminder_time DESC;
```

## Troubleshooting

### Reminders Not Being Sent
1. Check if the cron job is running (view logs in Render)
2. Verify environment variables are set correctly
3. Check if tasks have valid future due dates
4. Ensure Facebook Page token has messaging permissions

### Duplicate Reminders
- The system prevents duplicates with a unique constraint on `(task_id, reminder_type)`
- If duplicates occur, check for multiple cron job instances

### Testing Reminders
Use the test script to verify functionality:
```bash
node test_reminders.js
```

This will:
- Create a test task
- Verify reminder creation
- Test reminder processing
- Clean up test data

## Future Enhancements

### Planned Features
1. **Custom Reminder Times**: Let users choose when to receive reminders
2. **Snooze Functionality**: Allow users to postpone reminders
3. **Weekly Digest**: Summary of upcoming tasks for the week
4. **Smart Reminders**: AI-powered reminder timing based on task complexity
5. **Multiple Reminder Types**: Email, SMS (via integration)

### Premium Features (Planned)
- Multiple reminder intervals
- Priority-based reminders
- Group study reminders
- Parent/guardian notifications

## Support

If you encounter issues with reminders:
1. Check the logs in your deployment platform
2. Verify all environment variables are set
3. Run the test script to diagnose problems
4. Check the database for reminder records

For help, create an issue in the GitHub repository with:
- Error messages from logs
- Steps to reproduce the issue
- Environment details (deployment platform, etc.)

#!/usr/bin/env node

/**
 * Test script for reminder functionality
 * Tests creation, retrieval, and sending of reminders
 */

require('dotenv').config();
const db = require('./services/database');
const reminderService = require('./services/reminderService');

// Test colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

async function testReminderCreation() {
  log('\n=== Testing Reminder Creation ===', 'cyan');
  
  try {
    // Find a test user (you'll need to replace with an actual user ID)
    const users = await db.getAllUsers('all');
    if (users.length === 0) {
      log('❌ No users found in database. Please onboard at least one user first.', 'red');
      return false;
    }
    
    const testUser = users[0];
    log(`✓ Found test user: ${testUser.sender_id}`, 'green');
    
    // Get full user details
    const user = await db.getUser(testUser.sender_id);
    if (!user) {
      log('❌ Could not fetch user details', 'red');
      return false;
    }
    
    // Create a test task due in 25 hours (so we can create a 24-hour reminder)
    const testTask = {
      title: 'Test Reminder Task',
      description: 'This is a test task to verify reminder functionality',
      dueDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
      courseName: 'Test Course',
      isManual: true
    };
    
    log(`Creating test task: "${testTask.title}"`, 'blue');
    const createdTask = await db.createTask(testUser.sender_id, testTask);
    
    if (!createdTask) {
      log('❌ Failed to create test task', 'red');
      return false;
    }
    
    log(`✓ Task created with ID: ${createdTask.id}`, 'green');
    
    // Check if reminder was created automatically
    const reminders = await db.supabase
      .from('reminders')
      .select('*')
      .eq('task_id', createdTask.id);
    
    if (reminders.data && reminders.data.length > 0) {
      log(`✓ Reminder automatically created for task!`, 'green');
      log(`  Reminder ID: ${reminders.data[0].id}`, 'cyan');
      log(`  Reminder Type: ${reminders.data[0].reminder_type}`, 'cyan');
      log(`  Reminder Time: ${new Date(reminders.data[0].reminder_time).toLocaleString()}`, 'cyan');
      return true;
    } else {
      log('⚠️ No reminder was created automatically', 'yellow');
      return false;
    }
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function testReminderProcessing() {
  log('\n=== Testing Reminder Processing ===', 'cyan');
  
  try {
    // Create reminders for upcoming tasks
    log('Creating reminders for upcoming tasks...', 'blue');
    const created = await reminderService.createUpcomingReminders();
    log(`✓ Created ${created} new reminders`, 'green');
    
    // Get unsent reminders
    log('Fetching unsent reminders...', 'blue');
    const unsentReminders = await db.getUnsentReminders();
    log(`Found ${unsentReminders.length} unsent reminders`, unsentReminders.length > 0 ? 'green' : 'yellow');
    
    if (unsentReminders.length > 0) {
      log('Sample reminder:', 'cyan');
      const sample = unsentReminders[0];
      log(`  Task ID: ${sample.task_id}`, 'cyan');
      log(`  Type: ${sample.reminder_type}`, 'cyan');
      log(`  Due Time: ${new Date(sample.reminder_time).toLocaleString()}`, 'cyan');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function testReminderSending() {
  log('\n=== Testing Reminder Sending (Dry Run) ===', 'cyan');
  
  try {
    // This won't actually send messages unless there are due reminders
    log('Processing pending reminders...', 'blue');
    const result = await reminderService.processPendingReminders();
    
    log('Processing results:', 'green');
    log(`  Processed: ${result.processed}`, 'cyan');
    log(`  Sent: ${result.sent}`, 'cyan');
    log(`  Failed: ${result.failed}`, 'cyan');
    
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function testFormatting() {
  log('\n=== Testing Date Formatting ===', 'cyan');
  
  const testDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const formatted = reminderService.formatDueDate(testDate);
  log(`Tomorrow at this time: ${formatted}`, 'green');
  
  return true;
}

async function cleanup() {
  log('\n=== Cleanup ===', 'cyan');
  
  try {
    // Clean up test tasks and reminders
    const { error } = await db.supabase
      .from('tasks')
      .delete()
      .eq('title', 'Test Reminder Task');
    
    if (error) {
      log('⚠️ Could not clean up test tasks', 'yellow');
    } else {
      log('✓ Cleaned up test data', 'green');
    }
  } catch (error) {
    log(`⚠️ Cleanup error: ${error.message}`, 'yellow');
  }
}

async function main() {
  log('\n🔔 REMINDER SYSTEM TEST SUITE', 'cyan');
  log('================================\n', 'cyan');
  
  // Check environment
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'PAGE_ACCESS_TOKEN'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    log(`❌ Missing environment variables: ${missing.join(', ')}`, 'red');
    process.exit(1);
  }
  
  let allTestsPassed = true;
  
  // Run tests
  allTestsPassed = await testReminderCreation() && allTestsPassed;
  allTestsPassed = await testReminderProcessing() && allTestsPassed;
  allTestsPassed = await testReminderSending() && allTestsPassed;
  allTestsPassed = await testFormatting() && allTestsPassed;
  
  // Cleanup
  await cleanup();
  
  // Summary
  log('\n================================', 'cyan');
  if (allTestsPassed) {
    log('✅ All tests passed!', 'green');
    log('\nTo enable automated reminders:', 'yellow');
    log('1. Deploy the updated code to your server', 'cyan');
    log('2. Set up a cron job to run: node jobs/send-reminders.js', 'cyan');
    log('3. Suggested cron schedule: 0 * * * * (every hour)', 'cyan');
    log('\nFor Render.com deployment:', 'yellow');
    log('Uncomment the cron job section in render.yaml', 'cyan');
  } else {
    log('❌ Some tests failed. Check the output above.', 'red');
  }
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
